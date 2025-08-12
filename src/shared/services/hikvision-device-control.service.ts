import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { EncryptionService } from './encryption.service';
import {
    HIKVISION_CONFIG,
    HIKVISION_ENDPOINTS,
    HikvisionDeviceConfig,
    HikvisionErrorContext,
} from '../adapters/hikvision.adapter';
import { 
    DeviceCommand, 
    DeviceCommandResult, 
    DeviceHealth 
} from '../adapters/device.adapter';
import { DeviceStatus } from '@prisma/client';
import { HikvisionExceptionFactory } from '../exceptions/hikvision.exceptions';

export interface DoorControlOptions {
    doorNumber?: number;
    duration?: number; // Duration in seconds for temporary unlock
    force?: boolean; // Force operation even if door is already in desired state
}

export interface DeviceRebootOptions {
    delay?: number; // Delay in seconds before reboot
    reason?: string; // Reason for reboot
}

export interface SystemHealthMetrics {
    deviceId: string;
    timestamp: Date;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    temperature?: number;
    networkStatus: 'connected' | 'disconnected' | 'limited';
    uptime: number;
    lastReboot?: Date;
    activeConnections?: number;
    errorCount?: number;
    warningCount?: number;
}

export interface DeviceStatusInfo {
    deviceId: string;
    online: boolean;
    lastSeen?: Date;
    responseTime?: number;
    firmwareVersion?: string;
    serialNumber?: string;
    deviceType?: string;
    capabilities?: string[];
}

@Injectable()
export class HikvisionDeviceControlService {
    private readonly logger = new Logger(HikvisionDeviceControlService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly encryptionService: EncryptionService,
    ) {}

    /**
     * Control door operations (unlock/lock)
     */
    async controlDoor(
        device: HikvisionDeviceConfig,
        action: 'unlock' | 'lock',
        options: DoorControlOptions = {}
    ): Promise<DeviceCommandResult> {
        const { doorNumber = 1, duration = 5, force = false } = options;
        
        this.logger.log('Controlling door', { 
            deviceId: device.deviceId, 
            action, 
            doorNumber, 
            duration 
        });

        const context = this.createErrorContext(device.deviceId, 'controlDoor', HIKVISION_ENDPOINTS.DOOR_CONTROL);

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DOOR_CONTROL);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const payload = {
                cmd: action === 'unlock' ? 'open' : 'close',
                doorNo: doorNumber,
                ...(action === 'unlock' && duration && { duration }),
                ...(force && { force: true }),
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

            this.logger.log('Door control successful', { 
                deviceId: device.deviceId, 
                action, 
                doorNumber 
            });

            return {
                success: true,
                message: `Door ${doorNumber} ${action} command executed successfully`,
                data: response.data,
                executedAt: new Date(),
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Door control failed', { 
                deviceId: device.deviceId, 
                action, 
                error: exception.message 
            });

            return {
                success: false,
                message: `Door control failed: ${exception.message}`,
                executedAt: new Date(),
            };
        }
    }

    /**
     * Reboot device with options
     */
    async rebootDevice(
        device: HikvisionDeviceConfig,
        options: DeviceRebootOptions = {}
    ): Promise<DeviceCommandResult> {
        const { delay = 0, reason = 'Manual reboot' } = options;
        
        this.logger.log('Rebooting device', { 
            deviceId: device.deviceId, 
            delay, 
            reason 
        });

        const context = this.createErrorContext(device.deviceId, 'rebootDevice', HIKVISION_ENDPOINTS.SYSTEM_REBOOT);

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.SYSTEM_REBOOT);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const payload = {
                ...(delay > 0 && { delay }),
                reason,
            };

            const response = await firstValueFrom(
                this.httpService.post(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout: 30000, // Longer timeout for reboot
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
            );

            this.logger.log('Device reboot initiated', { 
                deviceId: device.deviceId, 
                delay 
            });

            return {
                success: true,
                message: `Device reboot initiated${delay > 0 ? ` with ${delay}s delay` : ''}`,
                data: response.data,
                executedAt: new Date(),
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Device reboot failed', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });

            return {
                success: false,
                message: `Device reboot failed: ${exception.message}`,
                executedAt: new Date(),
            };
        }
    }

    /**
     * Get comprehensive device health information
     */
    async getDeviceHealth(device: HikvisionDeviceConfig): Promise<DeviceHealth> {
        this.logger.log('Getting device health', { deviceId: device.deviceId });

        const context = this.createErrorContext(device.deviceId, 'getDeviceHealth', HIKVISION_ENDPOINTS.SYSTEM_STATUS);

        try {
            const healthMetrics = await this.getSystemHealthMetrics(device);
            
            // Determine overall status based on metrics
            let status: DeviceStatus = DeviceStatus.ONLINE;
            const issues: string[] = [];

            if (healthMetrics.networkStatus !== 'connected') {
                status = DeviceStatus.OFFLINE;
                issues.push('Network connectivity issues');
            }

            if (healthMetrics.memoryUsage && healthMetrics.memoryUsage > 90) {
                status = DeviceStatus.ERROR;
                issues.push('High memory usage');
            }

            if (healthMetrics.temperature && healthMetrics.temperature > 70) {
                status = DeviceStatus.ERROR;
                issues.push('High temperature');
            }

            if (healthMetrics.diskUsage && healthMetrics.diskUsage > 95) {
                status = DeviceStatus.ERROR;
                issues.push('Disk space critical');
            }

            return {
                deviceId: device.deviceId,
                status,
                uptime: healthMetrics.uptime,
                memoryUsage: healthMetrics.memoryUsage,
                diskUsage: healthMetrics.diskUsage,
                temperature: healthMetrics.temperature,
                lastHealthCheck: new Date(),
                issues: issues.length > 0 ? issues : undefined,
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.warn('Failed to get device health', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });

            return {
                deviceId: device.deviceId,
                status: DeviceStatus.OFFLINE,
                uptime: 0,
                lastHealthCheck: new Date(),
                issues: ['Device unreachable'],
            };
        }
    }

    /**
     * Get detailed system health metrics
     */
    async getSystemHealthMetrics(device: HikvisionDeviceConfig): Promise<SystemHealthMetrics> {
        this.logger.debug('Getting system health metrics', { deviceId: device.deviceId });

        const context = this.createErrorContext(device.deviceId, 'getSystemHealthMetrics', HIKVISION_ENDPOINTS.SYSTEM_STATUS);

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.SYSTEM_STATUS);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: HIKVISION_CONFIG.DEFAULT_TIMEOUT,
                })
            );

            const data = response.data;

            return {
                deviceId: device.deviceId,
                timestamp: new Date(),
                cpuUsage: data.cpuUsage,
                memoryUsage: data.memoryUsage,
                diskUsage: data.diskUsage,
                temperature: data.temperature,
                networkStatus: data.networkConnected ? 'connected' : 'disconnected',
                uptime: data.uptime || 0,
                lastReboot: data.lastReboot ? new Date(data.lastReboot) : undefined,
                activeConnections: data.activeConnections,
                errorCount: data.errorCount || 0,
                warningCount: data.warningCount || 0,
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Failed to get system health metrics', { 
                deviceId: device.deviceId, 
                error: exception.message 
            });
            throw exception.toNestException();
        }
    }

    /**
     * Get device status information
     */
    async getDeviceStatus(device: HikvisionDeviceConfig): Promise<DeviceStatusInfo> {
        this.logger.debug('Getting device status', { deviceId: device.deviceId });

        const startTime = Date.now();

        try {
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 5000, // Short timeout for status check
                })
            );

            const responseTime = Date.now() - startTime;
            const data = response.data;

            return {
                deviceId: device.deviceId,
                online: true,
                lastSeen: new Date(),
                responseTime,
                firmwareVersion: data.firmwareVersion,
                serialNumber: data.serialNumber,
                deviceType: data.deviceType,
                capabilities: data.capabilities || [],
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            this.logger.debug('Device status check failed', { 
                deviceId: device.deviceId, 
                responseTime,
                error: error.message 
            });

            return {
                deviceId: device.deviceId,
                online: false,
                responseTime,
            };
        }
    }

    /**
     * Execute custom device command
     */
    async executeCustomCommand(
        device: HikvisionDeviceConfig,
        command: DeviceCommand
    ): Promise<DeviceCommandResult> {
        this.logger.log('Executing custom command', { 
            deviceId: device.deviceId, 
            command: command.command 
        });

        const context = this.createErrorContext(device.deviceId, 'executeCustomCommand');

        try {
            let endpoint: string;
            let method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST';
            let payload: any = command.parameters || {};

            // Map command to appropriate endpoint and method
            switch (command.command) {
                case 'unlock_door':
                    return this.controlDoor(device, 'unlock', command.parameters as DoorControlOptions);
                
                case 'lock_door':
                    return this.controlDoor(device, 'lock', command.parameters as DoorControlOptions);
                
                case 'reboot':
                    return this.rebootDevice(device, command.parameters as DeviceRebootOptions);
                
                case 'sync_users':
                    return {
                        success: true,
                        message: 'User sync command should be handled by user management service',
                        executedAt: new Date(),
                    };
                
                case 'update_firmware':
                    endpoint = this.buildEndpoint(device, '/ISAPI/System/updateFirmware');
                    payload = { firmwareUrl: command.parameters?.firmwareUrl };
                    break;
                
                default:
                    throw new Error(`Unsupported command: ${command.command}`);
            }

            const password = this.encryptionService.decrypt(device.encryptedSecret);
            const timeout = command.timeout ? command.timeout * 1000 : HIKVISION_CONFIG.DEFAULT_TIMEOUT;

            const response = await firstValueFrom(
                this.httpService.post(endpoint, payload, {
                    auth: { username: device.username, password },
                    timeout,
                    headers: { 'Content-Type': 'application/json' },
                })
            );

            return {
                success: true,
                message: `Command ${command.command} executed successfully`,
                data: response.data,
                executedAt: new Date(),
            };

        } catch (error) {
            const exception = HikvisionExceptionFactory.fromHttpError(error, context);
            this.logger.error('Custom command execution failed', { 
                deviceId: device.deviceId, 
                command: command.command,
                error: exception.message 
            });

            return {
                success: false,
                message: `Command execution failed: ${exception.message}`,
                executedAt: new Date(),
            };
        }
    }

    /**
     * Test device connectivity with detailed diagnostics
     */
    async testConnectivity(device: HikvisionDeviceConfig): Promise<{
        connected: boolean;
        responseTime: number;
        error?: string;
        diagnostics: {
            pingable: boolean;
            httpAccessible: boolean;
            authenticated: boolean;
            apiResponsive: boolean;
        };
    }> {
        this.logger.debug('Testing device connectivity', { deviceId: device.deviceId });

        const startTime = Date.now();
        const diagnostics = {
            pingable: false,
            httpAccessible: false,
            authenticated: false,
            apiResponsive: false,
        };

        try {
            // Test basic HTTP connectivity
            const endpoint = this.buildEndpoint(device, HIKVISION_ENDPOINTS.DEVICE_INFO);
            const password = this.encryptionService.decrypt(device.encryptedSecret);

            const response = await firstValueFrom(
                this.httpService.get(endpoint, {
                    auth: { username: device.username, password },
                    timeout: 5000,
                })
            );

            const responseTime = Date.now() - startTime;

            diagnostics.pingable = true;
            diagnostics.httpAccessible = true;
            diagnostics.authenticated = response.status === 200;
            diagnostics.apiResponsive = !!response.data;

            return {
                connected: true,
                responseTime,
                diagnostics,
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            // Analyze error to provide better diagnostics
            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                diagnostics.pingable = false;
            } else if (error.response?.status === 401) {
                diagnostics.pingable = true;
                diagnostics.httpAccessible = true;
                diagnostics.authenticated = false;
            } else if (error.response?.status) {
                diagnostics.pingable = true;
                diagnostics.httpAccessible = true;
                diagnostics.authenticated = true;
                diagnostics.apiResponsive = false;
            }

            return {
                connected: false,
                responseTime,
                error: error.message,
                diagnostics,
            };
        }
    }

    // ==================== Private Methods ====================

    private buildEndpoint(device: HikvisionDeviceConfig, path: string): string {
        const protocol = device.useHttps ? 'https' : 'http';
        const port = device.port || (device.useHttps ? HIKVISION_CONFIG.DEFAULT_HTTPS_PORT : HIKVISION_CONFIG.DEFAULT_PORT);
        
        return `${protocol}://${device.ipAddress}:${port}${path}`;
    }

    private createErrorContext(deviceId: string, operation: string, endpoint?: string): HikvisionErrorContext {
        return {
            deviceId,
            operation,
            endpoint,
            correlationId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        };
    }
}