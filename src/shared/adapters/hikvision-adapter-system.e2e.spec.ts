import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

import { HikvisionAdapterModule } from './hikvision-adapter.module';
import { DeviceAdapterFactory } from './device-adapter.factory';
import { HikvisionConfigValidationService } from '../services/hikvision-config-validation.service';
import { HikvisionSessionService } from '../services/hikvision-session.service';
import { HikvisionUserManagementService } from '../services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '../services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '../services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '../services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '../services/hikvision-maintenance.service';
import { IDeviceAdapter } from './device.adapter';

describe('Hikvision Adapter System Integration', () => {
    let app: TestingModule;
    let configService: ConfigService;
    let adapterFactory: DeviceAdapterFactory;
    let configValidationService: HikvisionConfigValidationService;
    let deviceAdapter: IDeviceAdapter;

    beforeAll(async () => {
        // Set up test environment variables
        process.env.SECRET_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        process.env.SECRET_ENCRYPTION_IV = '0123456789abcdef0123456789abcdef';
        process.env.DEVICE_ADAPTER_TYPE = 'stub';
        process.env.USE_STUB_ADAPTER = 'true';
        process.env.LOG_LEVEL = 'debug';

        app = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.test',
                }),
                HttpModule,
                HikvisionAdapterModule.forRoot({
                    adapterType: 'stub',
                    useStubAdapter: true,
                    httpTimeout: 5000,
                    cacheConfig: { ttl: 300, max: 100 },
                }),
            ],
            providers: [
                HikvisionConfigValidationService,
            ],
        }).compile();

        configService = app.get<ConfigService>(ConfigService);
        adapterFactory = app.get<DeviceAdapterFactory>(DeviceAdapterFactory);
        configValidationService = app.get<HikvisionConfigValidationService>(HikvisionConfigValidationService);
        deviceAdapter = app.get<IDeviceAdapter>('IDeviceAdapter');
    });

    afterAll(async () => {
        await app.close();
        
        // Clean up environment variables
        delete process.env.SECRET_ENCRYPTION_KEY;
        delete process.env.SECRET_ENCRYPTION_IV;
        delete process.env.DEVICE_ADAPTER_TYPE;
        delete process.env.USE_STUB_ADAPTER;
        delete process.env.LOG_LEVEL;
    });

    describe('Module Initialization', () => {
        it('should initialize all required services', () => {
            expect(configService).toBeDefined();
            expect(adapterFactory).toBeDefined();
            expect(configValidationService).toBeDefined();
            expect(deviceAdapter).toBeDefined();
        });

        it('should provide all Hikvision services', () => {
            const sessionService = app.get<HikvisionSessionService>(HikvisionSessionService);
            const userManagementService = app.get<HikvisionUserManagementService>(HikvisionUserManagementService);
            const deviceControlService = app.get<HikvisionDeviceControlService>(HikvisionDeviceControlService);
            const discoveryService = app.get<HikvisionDiscoveryService>(HikvisionDiscoveryService);
            const eventMonitoringService = app.get<HikvisionEventMonitoringService>(HikvisionEventMonitoringService);
            const maintenanceService = app.get<HikvisionMaintenanceService>(HikvisionMaintenanceService);

            expect(sessionService).toBeDefined();
            expect(userManagementService).toBeDefined();
            expect(deviceControlService).toBeDefined();
            expect(discoveryService).toBeDefined();
            expect(eventMonitoringService).toBeDefined();
            expect(maintenanceService).toBeDefined();
        });

        it('should provide health check service', () => {
            const healthCheck = app.get('ADAPTER_HEALTH_CHECK');
            expect(healthCheck).toBeDefined();
            expect(healthCheck.name).toBe('device-adapter');
            expect(typeof healthCheck.check).toBe('function');
        });
    });

    describe('Configuration Validation', () => {
        it('should validate configuration successfully', async () => {
            const validationResult = await configValidationService.validateConfiguration();
            
            expect(validationResult.valid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
            expect(validationResult.config).toBeDefined();
            expect(validationResult.missingRequired).toHaveLength(0);
        });

        it('should generate development configuration', () => {
            const devConfig = configValidationService.generateDevelopmentConfig();
            
            expect(devConfig.config).toBeDefined();
            expect(devConfig.envVars).toBeDefined();
            expect(devConfig.config.deviceAdapterType).toBe('stub');
            expect(devConfig.config.useStubAdapter).toBe(true);
            expect(devConfig.envVars.SECRET_ENCRYPTION_KEY).toBeDefined();
            expect(devConfig.envVars.SECRET_ENCRYPTION_IV).toBeDefined();
        });

        it('should generate production configuration template', () => {
            const prodTemplate = configValidationService.generateProductionConfigTemplate();
            
            expect(prodTemplate.SECRET_ENCRYPTION_KEY).toBeDefined();
            expect(prodTemplate.SECRET_ENCRYPTION_IV).toBeDefined();
            expect(prodTemplate.DEVICE_ADAPTER_TYPE).toBe('hikvision');
            expect(prodTemplate.USE_STUB_ADAPTER).toBe('false');
        });

        it('should check production readiness', () => {
            const readiness = configValidationService.isProductionReady();
            
            // Should not be production ready with stub adapter
            expect(readiness.ready).toBe(false);
            expect(readiness.issues).toContain('Using stub adapter in production is not recommended');
        });
    });

    describe('Adapter Factory', () => {
        it('should create correct adapter based on configuration', () => {
            const adapter = adapterFactory.createAdapterFromConfig();
            expect(adapter).toBeDefined();
            expect(adapter.constructor.name).toBe('StubDeviceAdapter');
        });

        it('should support all adapter types', () => {
            const availableTypes = adapterFactory.getAvailableAdapterTypes();
            const supportedTypes = adapterFactory.getSupportedAdapterTypes();
            
            expect(availableTypes).toContain('hikvision');
            expect(availableTypes).toContain('stub');
            expect(supportedTypes).toContain('hikvision');
            expect(supportedTypes).toContain('stub');
        });

        it('should perform health checks on adapters', async () => {
            const healthStatuses = await adapterFactory.performHealthCheckOnAllAdapters();
            
            expect(healthStatuses.length).toBeGreaterThan(0);
            expect(healthStatuses[0].type).toBeDefined();
            expect(healthStatuses[0].healthy).toBeDefined();
            expect(healthStatuses[0].lastCheck).toBeInstanceOf(Date);
        });

        it('should recommend appropriate adapter type', async () => {
            const recommendedType = await adapterFactory.getRecommendedAdapterType();
            expect(['hikvision', 'stub']).toContain(recommendedType);
        });

        it('should handle adapter failover', async () => {
            const adapter = await adapterFactory.createAdapterWithFailover(['hikvision', 'stub']);
            expect(adapter).toBeDefined();
        });
    });

    describe('Device Adapter Integration', () => {
        it('should perform basic device operations', async () => {
            // Test connection
            const devices = await deviceAdapter.discoverDevices();
            expect(devices).toBeDefined();
            expect(Array.isArray(devices)).toBe(true);

            if (devices.length > 0) {
                const deviceId = devices[0].id;
                
                // Test connectivity
                const isConnected = await deviceAdapter.testConnection(deviceId);
                expect(typeof isConnected).toBe('boolean');

                // Get device info
                const deviceInfo = await deviceAdapter.getDeviceInfo(deviceId);
                expect(deviceInfo.id).toBe(deviceId);
                expect(deviceInfo.name).toBeDefined();

                // Get device health
                const health = await deviceAdapter.getDeviceHealth(deviceId);
                expect(health.deviceId).toBe(deviceId);
                expect(health.status).toBeDefined();
            }
        });

        it('should handle user management operations', async () => {
            const devices = await deviceAdapter.discoverDevices();
            
            if (devices.length > 0) {
                const deviceId = devices[0].id;
                
                // Test user operations
                const users = [
                    { userId: 'TEST001', accessLevel: 1 },
                    { userId: 'TEST002', accessLevel: 2 },
                ];

                await expect(deviceAdapter.syncUsers(deviceId, users)).resolves.not.toThrow();
                await expect(deviceAdapter.removeUser(deviceId, 'TEST001')).resolves.not.toThrow();
            }
        });

        it('should handle device commands', async () => {
            const devices = await deviceAdapter.discoverDevices();
            
            if (devices.length > 0) {
                const deviceId = devices[0].id;
                
                const command = {
                    command: 'unlock_door' as const,
                    parameters: { doorNumber: 1 },
                };

                const result = await deviceAdapter.sendCommand(deviceId, command);
                expect(result.success).toBeDefined();
                expect(result.message).toBeDefined();
                expect(result.executedAt).toBeInstanceOf(Date);
            }
        });

        it('should handle logging operations', async () => {
            const devices = await deviceAdapter.discoverDevices();
            
            if (devices.length > 0) {
                const deviceId = devices[0].id;
                
                const logs = await deviceAdapter.getDeviceLogs(deviceId);
                expect(Array.isArray(logs)).toBe(true);

                await expect(deviceAdapter.clearDeviceLogs(deviceId)).resolves.not.toThrow();
            }
        });
    });

    describe('Service Integration', () => {
        it('should integrate session service properly', async () => {
            const sessionService = app.get<HikvisionSessionService>(HikvisionSessionService);
            
            // Test session metrics
            const allMetrics = sessionService.getAllSessionMetrics();
            expect(Array.isArray(allMetrics)).toBe(true);

            // Test session count
            const activeCount = sessionService.getAllSessionMetrics();
            expect(typeof activeCount).toBe('number');
        });

        it('should integrate event monitoring service properly', async () => {
            const eventService = app.get<HikvisionEventMonitoringService>(HikvisionEventMonitoringService);
            
            // Test monitoring stats
            const allStats = eventService.getAllMonitoringStats();
            expect(Array.isArray(allStats)).toBe(true);

            // Test subscription count
            const activeCount = eventService.getActiveSubscriptionsCount();
            expect(typeof activeCount).toBe('number');
        });

        it('should integrate maintenance service properly', async () => {
            const maintenanceService = app.get<HikvisionMaintenanceService>(HikvisionMaintenanceService);
            
            // Test default maintenance tasks
            const defaultTasks = maintenanceService.getDefaultMaintenanceTasks();
            expect(Array.isArray(defaultTasks)).toBe(true);
            expect(defaultTasks.length).toBeGreaterThan(0);

            // Verify task structure
            const task = defaultTasks[0];
            expect(task.id).toBeDefined();
            expect(task.name).toBeDefined();
            expect(task.type).toBeDefined();
            expect(task.priority).toBeDefined();
            expect(typeof task.execute).toBe('function');
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle configuration errors gracefully', async () => {
            // Temporarily remove required environment variable
            const originalKey = process.env.SECRET_ENCRYPTION_KEY;
            delete process.env.SECRET_ENCRYPTION_KEY;

            try {
                const validationResult = await configValidationService.validateConfiguration();
                expect(validationResult.valid).toBe(false);
                expect(validationResult.errors.length).toBeGreaterThan(0);
                expect(validationResult.missingRequired).toContain('SECRET_ENCRYPTION_KEY');
            } finally {
                // Restore environment variable
                process.env.SECRET_ENCRYPTION_KEY = originalKey;
            }
        });

        it('should handle adapter creation errors gracefully', () => {
            // Test with unsupported adapter type
            const adapter = adapterFactory.createAdapter('unsupported' as any);
            expect(adapter).toBeDefined();
            expect(adapter.constructor.name).toBe('StubDeviceAdapter'); // Should fallback
        });

        it('should handle service errors gracefully', async () => {
            // Test with invalid device ID
            await expect(deviceAdapter.getDeviceInfo('invalid-device-id')).rejects.toThrow();
        });
    });

    describe('Performance Integration', () => {
        it('should handle concurrent operations efficiently', async () => {
            const startTime = Date.now();
            
            // Run multiple operations concurrently
            const promises = [
                deviceAdapter.discoverDevices(),
                adapterFactory.performHealthCheckOnAllAdapters(),
                configValidationService.validateConfiguration(),
            ];

            const results = await Promise.allSettled(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // All operations should complete
            expect(results.every(r => r.status === 'fulfilled')).toBe(true);
            
            // Should complete in reasonable time
            expect(duration).toBeLessThan(10000); // 10 seconds
        });

        it('should maintain performance under load', async () => {
            const operations = Array.from({ length: 10 }, () => 
                deviceAdapter.discoverDevices()
            );

            const startTime = Date.now();
            const results = await Promise.all(operations);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // All should succeed
            expect(results.every(r => Array.isArray(r))).toBe(true);
            
            // Should complete in reasonable time
            expect(duration).toBeLessThan(15000); // 15 seconds
        });
    });

    describe('Health Check Integration', () => {
        it('should provide comprehensive health information', async () => {
            const healthCheck = app.get('ADAPTER_HEALTH_CHECK');
            const healthResult = await healthCheck.check();

            expect(healthResult.status).toBeDefined();
            expect(['healthy', 'unhealthy']).toContain(healthResult.status);
            expect(healthResult.details).toBeDefined();
            expect(healthResult.details.adapterType).toBeDefined();
        });

        it('should integrate with monitoring systems', async () => {
            // Test that health check provides useful monitoring data
            const healthCheck = app.get('ADAPTER_HEALTH_CHECK');
            const healthResult = await healthCheck.check();

            if (healthResult.status === 'healthy') {
                expect(healthResult.details.devicesFound).toBeDefined();
                expect(typeof healthResult.details.devicesFound).toBe('number');
            } else {
                expect(healthResult.details.error).toBeDefined();
            }
        });
    });

    describe('Cleanup and Resource Management', () => {
        it('should clean up resources properly', async () => {
            const eventService = app.get<HikvisionEventMonitoringService>(HikvisionEventMonitoringService);
            
            // Create some subscriptions
            const mockDevice = {
                deviceId: 'cleanup-test',
                ipAddress: '192.168.1.200',
                username: 'admin',
                encryptedSecret: 'test-secret',
            };

            const callback = jest.fn();
            
            // This would normally create subscriptions, but with stub adapter it's safe
            await expect(
                eventService.subscribeToEvents(mockDevice, callback, { useWebSocket: false })
            ).resolves.not.toThrow();

            // Clean up all subscriptions
            await expect(eventService.cleanup()).resolves.not.toThrow();

            // Verify cleanup
            const activeCount = eventService.getActiveSubscriptionsCount();
            expect(activeCount).toBe(0);
        });

        it('should handle module shutdown gracefully', async () => {
            // Test that the module can be closed without errors
            // This is tested in the afterAll hook, but we can verify services are still functional
            expect(deviceAdapter).toBeDefined();
            expect(adapterFactory).toBeDefined();
            expect(configValidationService).toBeDefined();
        });
    });
});