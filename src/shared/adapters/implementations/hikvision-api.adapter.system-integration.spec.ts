import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

import { DatabaseModule } from '@/core/database/database.module';
import { CacheModule } from '@/core/cache/cache.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { HikvisionAdapterModule } from '../hikvision-adapter.module';
import { HikvisionApiAdapter } from './hikvision-api.adapter';
import { DeviceAdapterFactory } from '../device-adapter.factory';
import { HikvisionConfigValidationService } from '../../services/hikvision-config-validation.service';

/**
 * System Integration Test Suite
 *
 * This test suite verifies the complete integration of the Hikvision adapter
 * with the entire system, including:
 * - Real-world usage scenarios
 * - System-level error handling and recovery
 * - Performance under realistic loads
 * - Integration with all system components
 * - End-to-end workflows
 */

// Mock external system dependencies
class MockNotificationService {
    private notifications: any[] = [];

    async sendAlert(
        type: string,
        message: string,
        severity: 'info' | 'warning' | 'error' | 'critical'
    ) {
        this.notifications.push({
            type,
            message,
            severity,
            timestamp: new Date(),
        });
    }

    async sendBulkNotification(recipients: string[], message: string) {
        this.notifications.push({
            type: 'bulk',
            recipients,
            message,
            timestamp: new Date(),
        });
    }

    getNotifications() {
        return this.notifications;
    }

    clearNotifications() {
        this.notifications = [];
    }
}

class MockSchedulerService {
    private scheduledTasks: Map<string, any> = new Map();
    private taskHistory: any[] = [];

    async scheduleTask(taskId: string, cronExpression: string, taskFunction: () => Promise<void>) {
        this.scheduledTasks.set(taskId, {
            id: taskId,
            cronExpression,
            taskFunction,
            createdAt: new Date(),
            lastRun: null,
            nextRun: this.calculateNextRun(cronExpression),
        });
    }

    async executeTask(taskId: string) {
        const task = this.scheduledTasks.get(taskId);
        if (task) {
            const startTime = Date.now();
            try {
                await task.taskFunction();
                const execution = {
                    taskId,
                    startTime: new Date(startTime),
                    endTime: new Date(),
                    duration: Date.now() - startTime,
                    success: true,
                    error: null,
                };
                this.taskHistory.push(execution);
                task.lastRun = new Date();
                return execution;
            } catch (error) {
                const execution = {
                    taskId,
                    startTime: new Date(startTime),
                    endTime: new Date(),
                    duration: Date.now() - startTime,
                    success: false,
                    error: error.message,
                };
                this.taskHistory.push(execution);
                throw error;
            }
        }
        throw new Error(`Task ${taskId} not found`);
    }

    getScheduledTasks() {
        return Array.from(this.scheduledTasks.values());
    }

    getTaskHistory() {
        return this.taskHistory;
    }

    private calculateNextRun(cronExpression: string): Date {
        // Simple mock - in real implementation would use cron parser
        return new Date(Date.now() + 60000); // Next minute
    }
}

class MockMetricsService {
    private metrics: Map<string, any[]> = new Map();

    recordMetric(name: string, value: number, tags?: Record<string, string>) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        this.metrics.get(name)!.push({
            value,
            tags: tags || {},
            timestamp: new Date(),
        });
    }

    recordTimer(name: string, duration: number, tags?: Record<string, string>) {
        this.recordMetric(`${name}.duration`, duration, tags);
    }

    incrementCounter(name: string, tags?: Record<string, string>) {
        this.recordMetric(`${name}.count`, 1, tags);
    }

    getMetrics(name: string) {
        return this.metrics.get(name) || [];
    }

    getAllMetrics() {
        return Object.fromEntries(this.metrics.entries());
    }

    clearMetrics() {
        this.metrics.clear();
    }
}

// System Integration Service that orchestrates all components
class SystemIntegrationService {
    constructor(
        private readonly deviceAdapter: HikvisionApiAdapter,
        private readonly adapterFactory: DeviceAdapterFactory,
        private readonly configValidation: HikvisionConfigValidationService,
        private readonly notificationService: MockNotificationService,
        private readonly schedulerService: MockSchedulerService,
        private readonly metricsService: MockMetricsService,
        private readonly eventEmitter: EventEmitter2
    ) {
        this.setupEventListeners();
        this.setupScheduledTasks();
    }

    private setupEventListeners() {
        this.eventEmitter.on('device.connected', event => {
            this.metricsService.incrementCounter('device.connections', {
                deviceId: event.deviceId,
            });
        });

        this.eventEmitter.on('device.disconnected', event => {
            this.metricsService.incrementCounter('device.disconnections', {
                deviceId: event.deviceId,
            });
            this.notificationService.sendAlert(
                'device_offline',
                `Device ${event.deviceId} went offline`,
                'warning'
            );
        });

        this.eventEmitter.on('user.sync.failed', event => {
            this.metricsService.incrementCounter('user.sync.failures', {
                deviceId: event.deviceId,
                employeeId: event.employeeId,
            });
        });

        this.eventEmitter.on('system.error', event => {
            this.notificationService.sendAlert(
                'system_error',
                `System error: ${event.error}`,
                'error'
            );
        });
    }

    private async setupScheduledTasks() {
        // Health check task
        await this.schedulerService.scheduleTask(
            'device-health-check',
            '*/5 * * * *', // Every 5 minutes
            async () => {
                await this.performSystemHealthCheck();
            }
        );

        // User sync task
        await this.schedulerService.scheduleTask(
            'user-sync',
            '0 */6 * * *', // Every 6 hours
            async () => {
                await this.performUserSynchronization();
            }
        );

        // Metrics collection task
        await this.schedulerService.scheduleTask(
            'metrics-collection',
            '*/1 * * * *', // Every minute
            async () => {
                await this.collectSystemMetrics();
            }
        );
    }

    async performSystemHealthCheck(): Promise<{
        overallHealth: 'healthy' | 'degraded' | 'unhealthy';
        componentHealth: Record<string, any>;
        recommendations: string[];
    }> {
        const startTime = Date.now();
        const componentHealth: Record<string, any> = {};
        const recommendations: string[] = [];
        let healthyComponents = 0;
        let totalComponents = 0;

        try {
            // Check adapter factory health
            totalComponents++;
            try {
                const adapterHealth = await this.adapterFactory.performHealthCheckOnAllAdapters();
                componentHealth.adapterFactory = {
                    status: 'healthy',
                    adapters: adapterHealth,
                };
                healthyComponents++;
            } catch (error) {
                componentHealth.adapterFactory = {
                    status: 'unhealthy',
                    error: error.message,
                };
                recommendations.push('Check adapter factory configuration');
            }

            // Check configuration validation
            totalComponents++;
            try {
                const configValidation = await this.configValidation.validateConfiguration();
                componentHealth.configuration = {
                    status: configValidation.valid ? 'healthy' : 'unhealthy',
                    validation: configValidation,
                };
                if (configValidation.valid) {
                    healthyComponents++;
                } else {
                    recommendations.push('Fix configuration validation errors');
                }
            } catch (error) {
                componentHealth.configuration = {
                    status: 'unhealthy',
                    error: error.message,
                };
                recommendations.push('Check configuration service');
            }

            // Check device connectivity
            totalComponents++;
            try {
                const devices = await this.deviceAdapter.discoverDevices();
                const deviceHealthChecks = await Promise.allSettled(
                    devices.map(device => this.deviceAdapter.testConnection(device.id))
                );

                const connectedDevices = deviceHealthChecks.filter(
                    result => result.status === 'fulfilled' && result.value === true
                ).length;

                componentHealth.devices = {
                    status: connectedDevices > 0 ? 'healthy' : 'unhealthy',
                    totalDevices: devices.length,
                    connectedDevices,
                    connectionRate:
                        devices.length > 0 ? (connectedDevices / devices.length) * 100 : 0,
                };

                if (connectedDevices > 0) {
                    healthyComponents++;
                } else {
                    recommendations.push('Check device network connectivity');
                }

                if (connectedDevices < devices.length) {
                    recommendations.push(
                        `${devices.length - connectedDevices} devices are offline`
                    );
                }
            } catch (error) {
                componentHealth.devices = {
                    status: 'unhealthy',
                    error: error.message,
                };
                recommendations.push('Check device adapter service');
            }

            // Determine overall health
            const healthPercentage = (healthyComponents / totalComponents) * 100;
            let overallHealth: 'healthy' | 'degraded' | 'unhealthy';

            if (healthPercentage >= 80) {
                overallHealth = 'healthy';
            } else if (healthPercentage >= 50) {
                overallHealth = 'degraded';
                recommendations.push('System is running in degraded mode');
            } else {
                overallHealth = 'unhealthy';
                recommendations.push('System requires immediate attention');
            }

            // Record metrics
            this.metricsService.recordTimer('system.health_check', Date.now() - startTime);
            this.metricsService.recordMetric('system.health_percentage', healthPercentage);
            this.metricsService.recordMetric('system.healthy_components', healthyComponents);

            return {
                overallHealth,
                componentHealth,
                recommendations,
            };
        } catch (error) {
            this.eventEmitter.emit('system.error', { error: error.message });
            throw error;
        }
    }

    async performUserSynchronization(): Promise<{
        totalUsers: number;
        totalDevices: number;
        successfulSyncs: number;
        failedSyncs: number;
        duration: number;
    }> {
        const startTime = Date.now();

        try {
            // Mock user data for testing
            const users = [
                { userId: 'SYS001', accessLevel: 1, name: 'System User 1' },
                { userId: 'SYS002', accessLevel: 2, name: 'System User 2' },
                { userId: 'SYS003', accessLevel: 3, name: 'System Admin' },
            ];

            const devices = await this.deviceAdapter.discoverDevices();
            let successfulSyncs = 0;
            let failedSyncs = 0;

            for (const device of devices) {
                for (const user of users) {
                    try {
                        await this.deviceAdapter.syncUsers(device.id, [user]);
                        successfulSyncs++;
                        this.metricsService.incrementCounter('user.sync.success', {
                            deviceId: device.id,
                            userId: user.userId,
                        });
                    } catch (error) {
                        failedSyncs++;
                        this.metricsService.incrementCounter('user.sync.failure', {
                            deviceId: device.id,
                            userId: user.userId,
                        });
                        this.eventEmitter.emit('user.sync.failed', {
                            deviceId: device.id,
                            employeeId: user.userId,
                            error: error.message,
                        });
                    }
                }
            }

            const duration = Date.now() - startTime;
            this.metricsService.recordTimer('system.user_sync', duration);

            return {
                totalUsers: users.length,
                totalDevices: devices.length,
                successfulSyncs,
                failedSyncs,
                duration,
            };
        } catch (error) {
            this.eventEmitter.emit('system.error', { error: error.message });
            throw error;
        }
    }

    async collectSystemMetrics(): Promise<Record<string, any>> {
        const metrics: Record<string, any> = {};

        try {
            // Collect device metrics
            const devices = await this.deviceAdapter.discoverDevices();
            metrics.deviceCount = devices.length;

            // Collect connection metrics
            const connectionTests = await Promise.allSettled(
                devices.map(device => this.deviceAdapter.testConnection(device.id))
            );

            const connectedDevices = connectionTests.filter(
                result => result.status === 'fulfilled' && result.value === true
            ).length;

            metrics.connectedDevices = connectedDevices;
            metrics.connectionRate =
                devices.length > 0 ? (connectedDevices / devices.length) * 100 : 0;

            // Collect performance metrics
            const performanceTests = await Promise.allSettled(
                devices.slice(0, 3).map(async device => {
                    const startTime = Date.now();
                    await this.deviceAdapter.getDeviceInfo(device.id);
                    return Date.now() - startTime;
                })
            );

            const successfulTests = performanceTests
                .filter(result => result.status === 'fulfilled')
                .map(result => (result as any).value);

            if (successfulTests.length > 0) {
                metrics.averageResponseTime =
                    successfulTests.reduce((a, b) => a + b, 0) / successfulTests.length;
                metrics.maxResponseTime = Math.max(...successfulTests);
                metrics.minResponseTime = Math.min(...successfulTests);
            }

            // Record all metrics
            Object.entries(metrics).forEach(([key, value]) => {
                this.metricsService.recordMetric(`system.${key}`, value as number);
            });

            return metrics;
        } catch (error) {
            this.eventEmitter.emit('system.error', { error: error.message });
            throw error;
        }
    }

    async performDisasterRecovery(): Promise<{
        recoverySteps: string[];
        success: boolean;
        duration: number;
    }> {
        const startTime = Date.now();
        const recoverySteps: string[] = [];

        try {
            // Step 1: Validate configuration
            recoverySteps.push('Validating system configuration');
            const configValidation = await this.configValidation.validateConfiguration();
            if (!configValidation.valid) {
                throw new Error('Configuration validation failed');
            }

            // Step 2: Test adapter factory
            recoverySteps.push('Testing adapter factory');
            const adapterHealth = await this.adapterFactory.performHealthCheckOnAllAdapters();
            const healthyAdapters = adapterHealth.filter(adapter => adapter.healthy);
            if (healthyAdapters.length === 0) {
                throw new Error('No healthy adapters available');
            }

            // Step 3: Reconnect to devices
            recoverySteps.push('Reconnecting to devices');
            const devices = await this.deviceAdapter.discoverDevices();
            const reconnectionResults = await Promise.allSettled(
                devices.map(device => this.deviceAdapter.testConnection(device.id))
            );

            const reconnectedDevices = reconnectionResults.filter(
                result => result.status === 'fulfilled' && result.value === true
            ).length;

            if (reconnectedDevices === 0) {
                throw new Error('Failed to reconnect to any devices');
            }

            recoverySteps.push(`Reconnected to ${reconnectedDevices}/${devices.length} devices`);

            // Step 4: Verify system functionality
            recoverySteps.push('Verifying system functionality');
            const healthCheck = await this.performSystemHealthCheck();
            if (healthCheck.overallHealth === 'unhealthy') {
                throw new Error('System health check failed after recovery');
            }

            recoverySteps.push('Disaster recovery completed successfully');

            return {
                recoverySteps,
                success: true,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            recoverySteps.push(`Recovery failed: ${error.message}`);
            return {
                recoverySteps,
                success: false,
                duration: Date.now() - startTime,
            };
        }
    }

    getSystemStatus(): {
        uptime: number;
        metrics: Record<string, any>;
        scheduledTasks: any[];
        notifications: any[];
    } {
        return {
            uptime: process.uptime() * 1000, // Convert to milliseconds
            metrics: this.metricsService.getAllMetrics(),
            scheduledTasks: this.schedulerService.getScheduledTasks(),
            notifications: this.notificationService.getNotifications(),
        };
    }
}

// Mock server for system integration testing
const server = setupServer(
    // Device discovery endpoints
    http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
        return HttpResponse.json({
                deviceName: 'System Test Device 1',
                deviceType: 'IP Camera',
                serialNumber: 'SYS123456789',
                firmwareVersion: 'V5.6.0',
                macAddress: '00:11:22:33:44:55',
            })
    }),

    http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
        return HttpResponse.json({
                deviceName: 'System Test Device 2',
                deviceType: 'IP Camera',
                serialNumber: 'SYS987654321',
                firmwareVersion: 'V5.6.0',
                macAddress: '00:11:22:33:44:66',
            })
    }),

    // User management endpoints
    http.post(
        'http://192.168.1.100:80/ISAPI/AccessControl/UserInfo/Record',
        async ({ request }) => {
            const body: any = await request.json();
            return HttpResponse.json({ success: true, employeeNo: body.UserInfo?.employeeNo })
            
        }
    ),

    http.post(
        'http://192.168.1.101:80/ISAPI/AccessControl/UserInfo/Record',
        async ({ request }) => {
            const body: any= await request.json();
            return HttpResponse.json({ success: true, employeeNo: body.UserInfo?.employeeNo })
        }
    ),

    // Health status endpoints
    http.get('http://192.168.1.100:80/ISAPI/System/status', () => {
        return HttpResponse.json({
                cpuUsage: 30,
                memoryUsage: 50,
                diskUsage: 70,
                temperature: 40,
                uptime: 172800,
                status: 'healthy',
            })
    }),

    http.get('http://192.168.1.101:80/ISAPI/System/status', () => {
        return HttpResponse.json({
                cpuUsage: 45,
                memoryUsage: 60,
                diskUsage: 80,
                temperature: 45,
                uptime: 86400,
                status: 'healthy',
            })
    }),

    // Session management
    http.get('http://192.168.1.100:80/ISAPI/System/Security/identityKey', () => {
        return HttpResponse.json({
                security: 'sys-security-key-1',
                identityKey: 'sys-identity-key-1',
            })
    }),

    http.get('http://192.168.1.101:80/ISAPI/System/Security/identityKey', () => {
        return HttpResponse.json({
                security: 'sys-security-key-2',
                identityKey: 'sys-identity-key-2',
            })
    })
);

describe('Hikvision Adapter System Integration Tests', () => {
    let app: TestingModule;
    let deviceAdapter: HikvisionApiAdapter;
    let adapterFactory: DeviceAdapterFactory;
    let configValidation: HikvisionConfigValidationService;
    let notificationService: MockNotificationService;
    let schedulerService: MockSchedulerService;
    let metricsService: MockMetricsService;
    let eventEmitter: EventEmitter2;
    let systemService: SystemIntegrationService;

    const mockDevices = [
        {
            id: 'sys-device-1',
            name: 'System Test Device 1',
            ipAddress: '192.168.1.100',
            username: 'admin',
            encryptedSecret: 'encrypted-password-1',
        },
        {
            id: 'sys-device-2',
            name: 'System Test Device 2',
            ipAddress: '192.168.1.101',
            username: 'admin',
            encryptedSecret: 'encrypted-password-2',
        },
    ];

    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'error' });

        // Set up test environment
        process.env.SECRET_ENCRYPTION_KEY =
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.SECRET_ENCRYPTION_IV = '0123456789abcdef0123456789abcdef';
        process.env.DEVICE_ADAPTER_TYPE = 'hikvision';
        process.env.USE_STUB_ADAPTER = 'false';

        app = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                EventEmitterModule.forRoot(),
                ScheduleModule.forRoot(),
                LoggerModule,
                DatabaseModule,
                CacheModule,
                HttpModule,
                HikvisionAdapterModule.forRoot({
                    adapterType: 'hikvision',
                    useStubAdapter: false,
                    httpTimeout: 5000,
                    cacheConfig: { ttl: 300, max: 100 },
                }),
            ],
            providers: [MockNotificationService, MockSchedulerService, MockMetricsService],
        }).compile();

        deviceAdapter = app.get<HikvisionApiAdapter>('HikvisionApiAdapter');
        adapterFactory = app.get<DeviceAdapterFactory>(DeviceAdapterFactory);
        configValidation = app.get<HikvisionConfigValidationService>(
            HikvisionConfigValidationService
        );
        notificationService = app.get<MockNotificationService>(MockNotificationService);
        schedulerService = app.get<MockSchedulerService>(MockSchedulerService);
        metricsService = app.get<MockMetricsService>(MockMetricsService);
        eventEmitter = app.get<EventEmitter2>(EventEmitter2);

        // Create system integration service
        systemService = new SystemIntegrationService(
            deviceAdapter,
            adapterFactory,
            configValidation,
            notificationService,
            schedulerService,
            metricsService,
            eventEmitter
        );

        // Mock PrismaService
        const prismaService = app.get('PrismaService');
        if (prismaService) {
            jest.spyOn(prismaService.device, 'findUnique').mockImplementation((args: any) => {
                const device = mockDevices.find(d => d.id === args.where.id);
                return Promise.resolve(device || null);
            });

            jest.spyOn(prismaService.device, 'findMany').mockResolvedValue(mockDevices);
        }

        // Mock EncryptionService
        const encryptionService = app.get('EncryptionService');
        if (encryptionService) {
            jest.spyOn(encryptionService, 'decrypt').mockReturnValue('admin123');
        }
    });

    afterAll(async () => {
        server.close();
        await app.close();

        // Clean up environment
        delete process.env.SECRET_ENCRYPTION_KEY;
        delete process.env.SECRET_ENCRYPTION_IV;
        delete process.env.DEVICE_ADAPTER_TYPE;
        delete process.env.USE_STUB_ADAPTER;
    });

    beforeEach(() => {
        notificationService.clearNotifications();
        metricsService.clearMetrics();
        jest.clearAllMocks();
    });

    afterEach(() => {
        server.resetHandlers();
    });

    describe('System Health Monitoring', () => {
        it('should perform comprehensive system health check', async () => {
            const healthResult = await systemService.performSystemHealthCheck();

            expect(healthResult.overallHealth).toBeDefined();
            expect(['healthy', 'degraded', 'unhealthy']).toContain(healthResult.overallHealth);
            expect(healthResult.componentHealth).toBeDefined();
            expect(healthResult.componentHealth.adapterFactory).toBeDefined();
            expect(healthResult.componentHealth.configuration).toBeDefined();
            expect(healthResult.componentHealth.devices).toBeDefined();
            expect(Array.isArray(healthResult.recommendations)).toBe(true);

            // Verify metrics were recorded
            const healthMetrics = metricsService.getMetrics('system.health_check.duration');
            expect(healthMetrics.length).toBeGreaterThan(0);
        }, 20000);

        it('should detect and report unhealthy components', async () => {
            // Override server to simulate device failures
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.error();
                }),
                http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.json({ error: 'Internal server error' });
                })
            );

            const healthResult = await systemService.performSystemHealthCheck();

            expect(healthResult.overallHealth).toBe('unhealthy');
            expect(healthResult.componentHealth.devices.status).toBe('unhealthy');
            expect(healthResult.componentHealth.devices.connectedDevices).toBe(0);
            expect(healthResult.recommendations.length).toBeGreaterThan(0);
        }, 15000);

        it('should handle partial system degradation', async () => {
            // Override server to simulate partial failures
            server.use(
                http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.error();
                })
            );

            const healthResult = await systemService.performSystemHealthCheck();

            expect(['healthy', 'degraded']).toContain(healthResult.overallHealth);
            expect(healthResult.componentHealth.devices.connectedDevices).toBe(1);
            expect(healthResult.componentHealth.devices.connectionRate).toBe(50);
        }, 15000);
    });

    describe('Scheduled Task Integration', () => {
        it('should execute scheduled health check task', async () => {
            const execution = await schedulerService.executeTask('device-health-check');

            expect(execution.success).toBe(true);
            expect(execution.duration).toBeGreaterThan(0);
            expect(execution.error).toBeNull();

            // Verify task was recorded in history
            const taskHistory = schedulerService.getTaskHistory();
            const healthCheckExecutions = taskHistory.filter(
                t => t.taskId === 'device-health-check'
            );
            expect(healthCheckExecutions.length).toBeGreaterThan(0);
        }, 25000);

        it('should execute scheduled user sync task', async () => {
            const execution = await schedulerService.executeTask('user-sync');

            expect(execution.success).toBe(true);
            expect(execution.duration).toBeGreaterThan(0);

            // Verify metrics were recorded
            const syncMetrics = metricsService.getMetrics('user.sync.success.count');
            expect(syncMetrics.length).toBeGreaterThan(0);
        }, 20000);

        it('should execute metrics collection task', async () => {
            const execution = await schedulerService.executeTask('metrics-collection');

            expect(execution.success).toBe(true);
            expect(execution.duration).toBeGreaterThan(0);

            // Verify system metrics were collected
            const deviceCountMetrics = metricsService.getMetrics('system.deviceCount');
            const connectionRateMetrics = metricsService.getMetrics('system.connectionRate');
            expect(deviceCountMetrics.length).toBeGreaterThan(0);
            expect(connectionRateMetrics.length).toBeGreaterThan(0);
        }, 15000);

        it('should handle task execution failures gracefully', async () => {
            // Override server to cause failures
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.json({ error: 'Server error' }, {status:500});
                }),
                http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.json({ error: 'Server error' }, {status:500});
                })
            );

            await expect(schedulerService.executeTask('device-health-check')).rejects.toThrow();

            // Verify failure was recorded
            const taskHistory = schedulerService.getTaskHistory();
            const failedExecutions = taskHistory.filter(t => !t.success);
            expect(failedExecutions.length).toBeGreaterThan(0);
        }, 15000);
    });

    describe('Event-Driven System Integration', () => {
        it('should handle device connection events', async () => {
            // Emit device connection event
            eventEmitter.emit('device.connected', { deviceId: 'sys-device-1' });

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify metrics were recorded
            const connectionMetrics = metricsService.getMetrics('device.connections.count');
            expect(connectionMetrics.length).toBeGreaterThan(0);
            expect(connectionMetrics[0].tags.deviceId).toBe('sys-device-1');
        });

        it('should handle device disconnection events with notifications', async () => {
            // Emit device disconnection event
            eventEmitter.emit('device.disconnected', { deviceId: 'sys-device-2' });

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify metrics were recorded
            const disconnectionMetrics = metricsService.getMetrics('device.disconnections.count');
            expect(disconnectionMetrics.length).toBeGreaterThan(0);

            // Verify notification was sent
            const notifications = notificationService.getNotifications();
            const deviceOfflineNotifications = notifications.filter(
                n => n.type === 'device_offline'
            );
            expect(deviceOfflineNotifications.length).toBeGreaterThan(0);
            expect(deviceOfflineNotifications[0].severity).toBe('warning');
        });

        it('should handle system error events', async () => {
            const errorMessage = 'Test system error';

            // Emit system error event
            eventEmitter.emit('system.error', { error: errorMessage });

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify notification was sent
            const notifications = notificationService.getNotifications();
            const errorNotifications = notifications.filter(n => n.type === 'system_error');
            expect(errorNotifications.length).toBeGreaterThan(0);
            expect(errorNotifications[0].message).toContain(errorMessage);
            expect(errorNotifications[0].severity).toBe('error');
        });

        it('should handle user sync failure events', async () => {
            // Emit user sync failure event
            eventEmitter.emit('user.sync.failed', {
                deviceId: 'sys-device-1',
                employeeId: 'EMP001',
                error: 'Sync failed',
            });

            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify metrics were recorded
            const failureMetrics = metricsService.getMetrics('user.sync.failures.count');
            expect(failureMetrics.length).toBeGreaterThan(0);
            expect(failureMetrics[0].tags.deviceId).toBe('sys-device-1');
            expect(failureMetrics[0].tags.employeeId).toBe('EMP001');
        });
    });

    describe('Disaster Recovery Integration', () => {
        it('should perform successful disaster recovery', async () => {
            const recoveryResult = await systemService.performDisasterRecovery();

            expect(recoveryResult.success).toBe(true);
            expect(recoveryResult.recoverySteps.length).toBeGreaterThan(0);
            expect(recoveryResult.duration).toBeGreaterThan(0);
            expect(recoveryResult.recoverySteps).toContain(
                'Disaster recovery completed successfully'
            );
        }, 30000);

        it('should handle disaster recovery failures', async () => {
            // Override configuration validation to fail
            jest.spyOn(configValidation, 'validateConfiguration').mockResolvedValue({
                valid: false,
                errors: ['Configuration error'],
                warnings: [],
                config: null,
                missingRequired: ['REQUIRED_CONFIG'],
                suggestions: []
            });

            const recoveryResult = await systemService.performDisasterRecovery();

            expect(recoveryResult.success).toBe(false);
            expect(recoveryResult.recoverySteps.length).toBeGreaterThan(0);
            expect(
                recoveryResult.recoverySteps.some(step => step.includes('Recovery failed'))
            ).toBe(true);
        }, 20000);

        it('should handle partial recovery scenarios', async () => {
            // Override server to simulate partial device failures
            server.use(
                http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.error();
                })
            );

            const recoveryResult = await systemService.performDisasterRecovery();

            expect(recoveryResult.success).toBe(true); // Should succeed with partial connectivity
            expect(
                recoveryResult.recoverySteps.some(step =>
                    step.includes('Reconnected to 1/2 devices')
                )
            ).toBe(true);
        }, 25000);
    });

    describe('System Status and Monitoring', () => {
        it('should provide comprehensive system status', async () => {
            // Generate some activity first
            await systemService.performSystemHealthCheck();
            await systemService.collectSystemMetrics();

            const systemStatus = systemService.getSystemStatus();

            expect(systemStatus.uptime).toBeGreaterThan(0);
            expect(typeof systemStatus.metrics).toBe('object');
            expect(Array.isArray(systemStatus.scheduledTasks)).toBe(true);
            expect(Array.isArray(systemStatus.notifications)).toBe(true);

            // Verify scheduled tasks are present
            expect(systemStatus.scheduledTasks.length).toBeGreaterThan(0);
            const taskIds = systemStatus.scheduledTasks.map(task => task.id);
            expect(taskIds).toContain('device-health-check');
            expect(taskIds).toContain('user-sync');
            expect(taskIds).toContain('metrics-collection');
        });

        it('should track system metrics over time', async () => {
            // Collect metrics multiple times
            await systemService.collectSystemMetrics();
            await new Promise(resolve => setTimeout(resolve, 100));
            await systemService.collectSystemMetrics();
            await new Promise(resolve => setTimeout(resolve, 100));
            await systemService.collectSystemMetrics();

            const allMetrics = metricsService.getAllMetrics();

            // Verify metrics were collected multiple times
            expect(allMetrics['system.deviceCount']).toBeDefined();
            expect(allMetrics['system.deviceCount'].length).toBeGreaterThanOrEqual(3);
            expect(allMetrics['system.connectionRate']).toBeDefined();
            expect(allMetrics['system.connectionRate'].length).toBeGreaterThanOrEqual(3);
        }, 10000);
    });

    describe('Performance Under System Load', () => {
        it('should maintain performance during concurrent system operations', async () => {
            const operations = [
                () => systemService.performSystemHealthCheck(),
                () => systemService.performUserSynchronization(),
                () => systemService.collectSystemMetrics(),
                () => schedulerService.executeTask('device-health-check'),
                () => schedulerService.executeTask('metrics-collection'),
            ];

            const startTime = Date.now();
            const results = await Promise.allSettled(operations.map(op => op()));
            const duration = Date.now() - startTime;

            // Most operations should succeed
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(operations.length * 0.8);

            // Should complete in reasonable time
            expect(duration).toBeLessThan(45000); // 45 seconds

            console.log(
                `System load test: ${successCount}/${operations.length} operations succeeded in ${duration}ms`
            );
        }, 50000);

        it('should handle high-frequency event processing', async () => {
            const eventCount = 100;
            const events = Array.from({ length: eventCount }, (_, i) => ({
                type:
                    i % 4 === 0
                        ? 'device.connected'
                        : i % 4 === 1
                          ? 'device.disconnected'
                          : i % 4 === 2
                            ? 'user.sync.failed'
                            : 'system.error',
                data: {
                    deviceId: `device-${i % 2}`,
                    employeeId: `emp-${i}`,
                    error: `Error ${i}`,
                },
            }));

            const startTime = Date.now();

            // Emit all events rapidly
            events.forEach(event => {
                eventEmitter.emit(event.type, event.data);
            });

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 1000));

            const duration = Date.now() - startTime;

            // Verify events were processed
            const allMetrics = metricsService.getAllMetrics();
            const totalMetricEntries = Object.values(allMetrics).reduce(
                (total, metrics) => total + (metrics as any[]).length,
                0
            );

            expect(totalMetricEntries).toBeGreaterThan(eventCount * 0.8);
            expect(duration).toBeLessThan(5000); // Should process quickly

            console.log(
                `High-frequency event test: ${totalMetricEntries} metrics recorded in ${duration}ms`
            );
        }, 10000);
    });

    describe('System Integration Edge Cases', () => {
        it('should handle complete system failure and recovery', async () => {
            // Simulate complete system failure
            server.use(
                http.get('http://192.168.1.100:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.error();
                }),
                http.get('http://192.168.1.101:80/ISAPI/System/deviceInfo', () => {
                    return HttpResponse.error();
                })
            );

            // System should detect failure
            const healthCheck = await systemService.performSystemHealthCheck();
            expect(healthCheck.overallHealth).toBe('unhealthy');

            // Reset server to working state
            server.resetHandlers();

            // System should recover
            const recoveryResult = await systemService.performDisasterRecovery();
            expect(recoveryResult.success).toBe(true);

            // Verify system is healthy again
            const postRecoveryHealth = await systemService.performSystemHealthCheck();
            expect(['healthy', 'degraded']).toContain(postRecoveryHealth.overallHealth);
        }, 35000);

        it('should handle resource exhaustion scenarios', async () => {
            // Simulate resource exhaustion by creating many concurrent operations
            const heavyOperations = Array.from({ length: 20 }, () =>
                systemService.performSystemHealthCheck()
            );

            const startTime = Date.now();
            const results = await Promise.allSettled(heavyOperations);
            const duration = Date.now() - startTime;

            // System should handle the load gracefully
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBeGreaterThan(heavyOperations.length * 0.5); // At least 50% success

            // Should not take excessively long
            expect(duration).toBeLessThan(60000); // 1 minute

            console.log(
                `Resource exhaustion test: ${successCount}/${heavyOperations.length} operations succeeded in ${duration}ms`
            );
        }, 65000);
    });
});
