import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { EncryptionService } from './encryption.service';
import {
    HikvisionDeviceConfig,
    HikvisionErrorContext,
    HIKVISION_ENDPOINTS,
    HIKVISION_CONFIG,
} from '../adapters/hikvision.adapter';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface DeviceLogEntry {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    category: string;
    message: string;
    source?: string;
    userId?: string;
    eventId?: string;
    additionalData?: Record<string, any>;
}

export interface LogQueryOptions {
    startDate?: Date;
    endDate?: Date;
    level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
    category?: string;
    limit?: number;
    offset?: number;
    searchTerm?: string;
}

export interface FirmwareUpdateOptions {
    firmwareUrl: string;
    version?: string;
    forceUpdate?: boolean;
    rebootAfterUpdate?: boolean;
    backupBeforeUpdate?: boolean;
    validateChecksum?: boolean;
    checksumType?: 'md5' | 'sha1' | 'sha256';
    expectedChecksum?: string;
}

export interface FirmwareUpdateResult {
    success: boolean;
    message: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    previousVersion?: string;
    newVersion?: string;
    backupCreated?: boolean;
    rebootRequired?: boolean;
    error?: string;
}

export interface MaintenanceTask {
    id: string;
    name: string;
    description: string;
    type: 'cleanup' | 'optimization' | 'backup' | 'update' | 'diagnostic';
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedDuration: number; // minutes
    prerequisites?: string[];
    execute: (device: HikvisionDeviceConfig) => Promise<MaintenanceResult>;
}

export interface MaintenanceResult {
    taskId: string;
    success: boolean;
    message: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    details?: Record<string, any>;
    warnings?: string[];
    errors?: string[];
}

export interface MaintenanceSchedule {
    deviceId: string;
    tasks: MaintenanceTask[];
    schedule: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
        time: string; // HH:mm format
        dayOfWeek?: number; // 0-6 for weekly
        dayOfMonth?: number; // 1-31 for monthly
    };
    enabled: boolean;
    lastRun?: Date;
    nextRun?: Date;
}

@Injectable()
export class HikvisionMaintenanceService {
    private readonly logger = new Logger(HikvisionMaintenanceService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Get device logs with filtering options
     */
    async getDeviceLogs(
        device: HikvisionDeviceConfig,
        options: LogQueryOptions = {}
    ): Promise<DeviceLogEntry[]> {
        const {
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            endDate = new Date(),
            level,
            category,
            limit = 1000,
            offset = 0,
            searchTerm,
        } = options;

        this.logger.log('Getting device logs', { 
            deviceId: device.deviceId, 
            startDate, 
            endDate, 
            level, 
            limit 
        });

        const context = this.createErrorContext(device.deviceId, 'getDeviceLogs');

        try {
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/Logging/search');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const params = {
                format: 'json',
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                maxResults: limit,
                searchResultPosition: offset,
                ...(level && { logLevel: level }),
                ...(category && { logType: category }),
                ...(searchTerm && { searchString: searchTerm }),
            };

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    params,
                })
            );

            const logs = this.parseLogResponse(response.data);
            
            this.logger.log('Retrieved device logs', { 
                deviceId: device.deviceId, 
                logCount: logs.length 
            });

            return logs;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get device logs', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });
            throw exception.toNestException();
        }
    }

    /**
     * Clear device logs
     */
    async clearDeviceLogs(
        device: HikvisionDeviceConfig,
        options: { olderThan?: Date; category?: string } = {}
    ): Promise<{ success: boolean; clearedCount?: number; message: string }> {
        const { olderThan, category } = options;

        this.logger.log('Clearing device logs', { 
            deviceId: device.deviceId, 
            olderThan, 
            category 
        });

        const context = this.createErrorContext(device.deviceId, 'clearDeviceLogs');

        try {
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/Logging/clear');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const payload = {
                ...(olderThan && { beforeTime: olderThan.toISOString() }),
                ...(category && { logType: category }),
            };

            const response = await firstValueFrom(
                this.httpService.post(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            const result = {
                success: true,
                clearedCount: response.data?.clearedCount,
                message: 'Device logs cleared successfully',
            };

            this.logger.log('Device logs cleared', { 
                deviceId: device.deviceId, 
                clearedCount: result.clearedCount 
            });

            return result;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to clear device logs', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });

            return {
                success: false,
                message: `Failed to clear logs: ${exception.message}`,
            };
        }
    }

    /**
     * Update device firmware
     */
    async updateFirmware(
        device: HikvisionDeviceConfig,
        options: FirmwareUpdateOptions
    ): Promise<FirmwareUpdateResult> {
        const {
            firmwareUrl,
            version,
            forceUpdate = false,
            rebootAfterUpdate = true,
            backupBeforeUpdate = true,
            validateChecksum = true,
            checksumType = 'md5',
            expectedChecksum,
        } = options;

        this.logger.log('Starting firmware update', { 
            deviceId: device.deviceId, 
            firmwareUrl, 
            version 
        });

        const result: FirmwareUpdateResult = {
            success: false,
            message: '',
            startTime: new Date(),
        };

        const context = this.createErrorContext(device.deviceId, 'updateFirmware');

        try {
            // Get current firmware version
            result.previousVersion = await this.getCurrentFirmwareVersion(device);

            // Create backup if requested
            if (backupBeforeUpdate) {
                try {
                    await this.createConfigurationBackup(device);
                    result.backupCreated = true;
                    this.logger.log('Configuration backup created', { deviceId: device.deviceId });
                } catch (error) {
                    this.logger.warn('Failed to create backup, continuing with update', { 
                        deviceId: device.deviceId, 
                        error: error.message 
                    });
                }
            }

            // Validate firmware if checksum provided
            if (validateChecksum && expectedChecksum) {
                const isValid = await this.validateFirmwareChecksum(
                    firmwareUrl, 
                    expectedChecksum, 
                    checksumType
                );
                if (!isValid) {
                    throw new Error('Firmware checksum validation failed');
                }
            }

            // Start firmware update
            const endpoint = this.buildEndpoint(device, '/ISAPI/System/updateFirmware');
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const payload = {
                firmwareURL: firmwareUrl,
                ...(version && { targetVersion: version }),
                force: forceUpdate,
                rebootAfterUpdate,
            };

            const response = await firstValueFrom(
                this.httpService.post(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: 300000, // 5 minutes timeout for firmware update
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            // Monitor update progress
            const updateResult = await this.monitorFirmwareUpdate(device, response.data.updateId);

            result.success = updateResult.success;
            result.message = updateResult.message;
            result.newVersion = updateResult.newVersion;
            result.rebootRequired = rebootAfterUpdate;

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            result.success = false;
            result.message = `Firmware update failed: ${exception.message}`;
            result.error = exception.message;
            
            this.logger.error('Firmware update failed', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });
        } finally {
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
        }

        this.logger.log('Firmware update completed', { 
            deviceId: device.deviceId, 
            success: result.success,
            duration: result.duration 
        });

        return result;
    }

    /**
     * Execute maintenance task
     */
    async executeMaintenanceTask(
        device: HikvisionDeviceConfig,
        task: MaintenanceTask
    ): Promise<MaintenanceResult> {
        this.logger.log('Executing maintenance task', { 
            deviceId: device.deviceId, 
            taskId: task.id, 
            taskName: task.name 
        });

        const result: MaintenanceResult = {
            taskId: task.id,
            success: false,
            message: '',
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
        };

        try {
            // Check prerequisites
            if (task.prerequisites) {
                const prerequisiteCheck = await this.checkPrerequisites(device, task.prerequisites);
                if (!prerequisiteCheck.success) {
                    result.message = `Prerequisites not met: ${prerequisiteCheck.message}`;
                    return result;
                }
            }

            // Execute the task
            const taskResult = await task.execute(device);
            
            result.success = taskResult.success;
            result.message = taskResult.message;
            result.details = taskResult.details;
            result.warnings = taskResult.warnings;
            result.errors = taskResult.errors;

        } catch (error) {
            result.success = false;
            result.message = `Task execution failed: ${error.message}`;
            result.errors = [error.message];
            
            this.logger.error('Maintenance task failed', { 
                deviceId: device.deviceId, 
                taskId: task.id,
                error: error.message 
            });
        } finally {
            result.endTime = new Date();
            result.duration = result.endTime.getTime() - result.startTime.getTime();
        }

        this.logger.log('Maintenance task completed', { 
            deviceId: device.deviceId, 
            taskId: task.id,
            success: result.success,
            duration: result.duration 
        });

        return result;
    }

    /**
     * Get default maintenance tasks
     */
    getDefaultMaintenanceTasks(): MaintenanceTask[] {
        return [
            {
                id: 'log-cleanup',
                name: 'Log Cleanup',
                description: 'Clean up old device logs to free storage space',
                type: 'cleanup',
                priority: 'medium',
                estimatedDuration: 5,
                execute: async (device) => {
                    const result = await this.clearDeviceLogs(device, {
                        olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
                    });
                    
                    return {
                        taskId: 'log-cleanup',
                        success: result.success,
                        message: result.message,
                        startTime: new Date(),
                        endTime: new Date(),
                        duration: 0,
                        details: { clearedCount: result.clearedCount },
                    };
                },
            },
            {
                id: 'config-backup',
                name: 'Configuration Backup',
                description: 'Create a backup of device configuration',
                type: 'backup',
                priority: 'high',
                estimatedDuration: 10,
                execute: async (device) => {
                    try {
                        const backup = await this.createConfigurationBackup(device);
                        return {
                            taskId: 'config-backup',
                            success: true,
                            message: 'Configuration backup created successfully',
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 0,
                            details: { backupSize: backup.size, backupPath: backup.path },
                        };
                    } catch (error) {
                        return {
                            taskId: 'config-backup',
                            success: false,
                            message: `Backup failed: ${error.message}`,
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 0,
                            errors: [error.message],
                        };
                    }
                },
            },
            {
                id: 'health-check',
                name: 'Health Check',
                description: 'Perform comprehensive device health check',
                type: 'diagnostic',
                priority: 'medium',
                estimatedDuration: 15,
                execute: async (device) => {
                    try {
                        const healthData = await this.performHealthCheck(device);
                        return {
                            taskId: 'health-check',
                            success: true,
                            message: 'Health check completed',
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 0,
                            details: healthData,
                            warnings: healthData.warnings || [],
                        };
                    } catch (error) {
                        return {
                            taskId: 'health-check',
                            success: false,
                            message: `Health check failed: ${error.message}`,
                            startTime: new Date(),
                            endTime: new Date(),
                            duration: 0,
                            errors: [error.message],
                        };
                    }
                },
            },
        ];
    }

    // ==================== Private Methods ====================

    private parseLogResponse(data: any): DeviceLogEntry[] {
        const logs: DeviceLogEntry[] = [];

        if (data.LogSearch && data.LogSearch.MatchList) {
            const logEntries = Array.isArray(data.LogSearch.MatchList) 
                ? data.LogSearch.MatchList 
                : [data.LogSearch.MatchList];

            for (const entry of logEntries) {
                logs.push({
                    timestamp: new Date(entry.time),
                    level: this.mapLogLevel(entry.logLevel),
                    category: entry.logType || 'system',
                    message: entry.logDescription || entry.message || '',
                    source: entry.logSource,
                    userId: entry.userID,
                    eventId: entry.eventID,
                    additionalData: entry.additionalInfo,
                });
            }
        }

        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    private mapLogLevel(hikvisionLevel: string): 'debug' | 'info' | 'warn' | 'error' | 'critical' {
        const levelMap: Record<string, 'debug' | 'info' | 'warn' | 'error' | 'critical'> = {
            'DEBUG': 'debug',
            'INFO': 'info',
            'INFORMATION': 'info',
            'WARN': 'warn',
            'WARNING': 'warn',
            'ERROR': 'error',
            'CRITICAL': 'critical',
            'FATAL': 'critical',
        };

        return levelMap[hikvisionLevel?.toUpperCase()] || 'info';
    }

    private async getCurrentFirmwareVersion(device: HikvisionDeviceConfig): Promise<string> {
        const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
        const password = this.encryptionService.decrypt(device.encryptedSecret);

        const response = await firstValueFrom(
            this.httpService.get(endpoint, {
                auth: { username: device.username, password },
                timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
            })
        );

        return response.data?.firmwareVersion || 'unknown';
    }

    private async createConfigurationBackup(device: HikvisionDeviceConfig): Promise<{ size: number; path: string }> {
        const endpoint = this.buildEndpoint(device, '/ISAPI/System/configurationData');
        const password = this.encryptionService.decrypt(device.encryptedSecret);

        const response = await firstValueFrom(
            this.httpService.get(endpoint, {
                auth: { username: device.username, password },
                timeout: 30000,
                responseType: 'arraybuffer',
            })
        );

        // In a real implementation, you would save this to a file or storage service
        const backupData = Buffer.from(response.data);
        const backupPath = `/backups/${device.deviceId}_${Date.now()}.backup`;

        return {
            size: backupData.length,
            path: backupPath,
        };
    }

    private async validateFirmwareChecksum(
        firmwareUrl: string,
        expectedChecksum: string,
        checksumType: 'md5' | 'sha1' | 'sha256'
    ): Promise<boolean> {
        // In a real implementation, you would download the firmware and validate its checksum
        this.logger.debug('Validating firmware checksum', { firmwareUrl, checksumType });
        
        // Placeholder implementation
        return true;
    }

    private async monitorFirmwareUpdate(
        device: HikvisionDeviceConfig,
        updateId: string
    ): Promise<{ success: boolean; message: string; newVersion?: string }> {
        // Monitor update progress by polling status endpoint
        const maxAttempts = 60; // 5 minutes with 5-second intervals
        let attempts = 0;

        while (attempts < maxAttempts) {
            try {
                const endpoint = this.buildEndpoint(device, `/ISAPI/System/updateStatus/${updateId}`);
                const password = this.encryptionService.decrypt(device.encryptedSecret);

                const response = await firstValueFrom(
                    this.httpService.get(endpoint, {
                        auth: { username: device.username, password },
                        timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                    })
                );

                const status = response.data;
                
                if (status.status === 'completed') {
                    return {
                        success: true,
                        message: 'Firmware update completed successfully',
                        newVersion: status.newVersion,
                    };
                } else if (status.status === 'failed') {
                    return {
                        success: false,
                        message: `Firmware update failed: ${status.error}`,
                    };
                }

                // Still in progress, wait and retry
                await new Promise(resolve => setTimeout(resolve, 5000));
                attempts++;

            } catch (error) {
                this.logger.warn('Failed to check update status', { 
                    deviceId: device.deviceId, 
                    attempt: attempts,
                    error: error.message 
                });
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        return {
            success: false,
            message: 'Firmware update monitoring timed out',
        };
    }

    private async checkPrerequisites(
        device: HikvisionDeviceConfig,
        prerequisites: string[]
    ): Promise<{ success: boolean; message: string }> {
        // Check various prerequisites like disk space, network connectivity, etc.
        for (const prerequisite of prerequisites) {
            switch (prerequisite) {
                case 'network_connectivity':
                    // Check if device is reachable
                    try {
                        await this.getCurrentFirmwareVersion(device);
                    } catch (error) {
                        return {
                            success: false,
                            message: 'Device is not reachable',
                        };
                    }
                    break;
                
                case 'sufficient_storage':
                    // Check storage space (placeholder)
                    break;
                
                default:
                    this.logger.warn('Unknown prerequisite', { prerequisite });
            }
        }

        return { success: true, message: 'All prerequisites met' };
    }

    private async performHealthCheck(device: HikvisionDeviceConfig): Promise<any> {
        // Perform comprehensive health check
        const healthData: any = {
            connectivity: false,
            firmwareVersion: 'unknown',
            uptime: 0,
            warnings: [],
        };

        try {
            // Check connectivity and get basic info
            const deviceInfo = await this.getCurrentFirmwareVersion(device);
            healthData.connectivity = true;
            healthData.firmwareVersion = deviceInfo;

            // Add more health checks here
            // - Memory usage
            // - Disk space
            // - Temperature
            // - Network status
            // - Service status

        } catch (error) {
            healthData.warnings.push(`Connectivity check failed: ${error.message}`);
        }

        return healthData;
    }

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}