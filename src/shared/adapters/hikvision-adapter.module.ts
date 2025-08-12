import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LoggerModule } from '@/core/logger/logger.module';
import { DatabaseModule } from '@/core/database/database.module';
import { CacheModule } from '@/core/cache/cache.module';

// Services
import { EncryptionService } from '../services/encryption.service';
import { HikvisionSessionService } from '../services/hikvision-session.service';
import { HikvisionUserManagementService } from '../services/hikvision-user-management.service';
import { HikvisionDeviceControlService } from '../services/hikvision-device-control.service';
import { HikvisionDiscoveryService } from '../services/hikvision-discovery.service';
import { HikvisionEventMonitoringService } from '../services/hikvision-event-monitoring.service';
import { HikvisionMaintenanceService } from '../services/hikvision-maintenance.service';
import { HikvisionDeviceConfigService } from '../services/hikvision-device-config.service';

// Adapters
import { HikvisionApiAdapter } from './implementations/hikvision-api.adapter';
import { StubDeviceAdapter } from './implementations/stub-device.adapter';

// Factory
import { DeviceAdapterFactory } from './device-adapter.factory';

export interface HikvisionAdapterModuleOptions {
    useStubAdapter?: boolean;
    adapterType?: 'hikvision' | 'stub' | 'auto';
    httpTimeout?: number;
    maxRetries?: number;
    cacheConfig?: {
        ttl?: number;
        max?: number;
    };
}

@Module({})
export class HikvisionAdapterModule {
    static forRoot(options: HikvisionAdapterModuleOptions = {}): DynamicModule {
        const {
            useStubAdapter = false,
            adapterType = 'auto',
            httpTimeout = 10000,
            maxRetries = 3,
        } = options;

        return {
            module: HikvisionAdapterModule,
            imports: [
                LoggerModule,
                DatabaseModule,
                CacheModule,
                HttpModule.register({
                    timeout: httpTimeout,
                    maxRedirects: maxRetries,
                }),
                ConfigModule,
            ],
            providers: [
                // Core services
                EncryptionService,
                
                // Hikvision-specific services
                HikvisionSessionService,
                HikvisionUserManagementService,
                HikvisionDeviceControlService,
                HikvisionDiscoveryService,
                HikvisionEventMonitoringService,
                HikvisionMaintenanceService,
                HikvisionDeviceConfigService,

                // Adapters
                HikvisionApiAdapter,
                StubDeviceAdapter,

                // Factory
                DeviceAdapterFactory,

                // Dynamic provider for IDeviceAdapter
                {
                    provide: 'IDeviceAdapter',
                    useFactory: (
                        factory: DeviceAdapterFactory,
                        configService: ConfigService,
                    ) => {
                        // Determine which adapter to use
                        let selectedType = adapterType;
                        
                        if (selectedType === 'auto') {
                            // Auto-detect based on environment
                            const envAdapterType = configService.get<string>('DEVICE_ADAPTER_TYPE');
                            selectedType = envAdapterType as 'hikvision' | 'stub' || 
                                          (useStubAdapter ? 'stub' : 'hikvision');
                        }

                        return factory.createAdapter(selectedType);
                    },
                    inject: [DeviceAdapterFactory, ConfigService],
                },

                // Health check provider
                {
                    provide: 'ADAPTER_HEALTH_CHECK',
                    useFactory: (adapter: any) => {
                        return {
                            name: 'device-adapter',
                            check: async () => {
                                try {
                                    // Basic health check - try to discover devices
                                    const devices = await adapter.discoverDevices();
                                    return {
                                        status: 'healthy',
                                        details: {
                                            adapterType: adapter.constructor.name,
                                            devicesFound: devices.length,
                                        },
                                    };
                                } catch (error) {
                                    return {
                                        status: 'unhealthy',
                                        details: {
                                            error: error.message,
                                        },
                                    };
                                }
                            },
                        };
                    },
                    inject: ['IDeviceAdapter'],
                },
            ],
            exports: [
                'IDeviceAdapter',
                DeviceAdapterFactory,
                EncryptionService,
                HikvisionSessionService,
                HikvisionUserManagementService,
                HikvisionDeviceControlService,
                HikvisionDiscoveryService,
                HikvisionEventMonitoringService,
                HikvisionMaintenanceService,
                HikvisionDeviceConfigService,
                'ADAPTER_HEALTH_CHECK',
            ],
        };
    }

    static forRootAsync(options: {
        useFactory: (...args: any[]) => Promise<HikvisionAdapterModuleOptions> | HikvisionAdapterModuleOptions;
        inject?: any[];
        imports?: any[];
    }): DynamicModule {
        return {
            module: HikvisionAdapterModule,
            imports: [
                LoggerModule,
                DatabaseModule,
                HttpModule,
                ConfigModule,
                ...(options.imports || []),
            ],
            providers: [
                // Core services
                EncryptionService,
                
                // Hikvision-specific services
                HikvisionSessionService,
                HikvisionUserManagementService,
                HikvisionDeviceControlService,
                HikvisionDiscoveryService,
                HikvisionEventMonitoringService,
                HikvisionMaintenanceService,
                HikvisionDeviceConfigService,

                // Adapters
                HikvisionApiAdapter,
                StubDeviceAdapter,

                // Factory
                DeviceAdapterFactory,

                // Async configuration provider
                {
                    provide: 'HIKVISION_ADAPTER_OPTIONS',
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },

                // Dynamic provider for IDeviceAdapter
                {
                    provide: 'IDeviceAdapter',
                    useFactory: async (
                        factory: DeviceAdapterFactory,
                        configService: ConfigService,
                        moduleOptions: HikvisionAdapterModuleOptions,
                    ) => {
                        const adapterType = moduleOptions.adapterType || 'auto';
                        let selectedType = adapterType;
                        
                        if (selectedType === 'auto') {
                            const envAdapterType = configService.get<string>('DEVICE_ADAPTER_TYPE');
                            selectedType = envAdapterType as 'hikvision' | 'stub' || 
                                          (moduleOptions.useStubAdapter ? 'stub' : 'hikvision');
                        }

                        return factory.createAdapter(selectedType);
                    },
                    inject: [DeviceAdapterFactory, ConfigService, 'HIKVISION_ADAPTER_OPTIONS'],
                },
            ],
            exports: [
                'IDeviceAdapter',
                DeviceAdapterFactory,
                EncryptionService,
                HikvisionSessionService,
                HikvisionUserManagementService,
                HikvisionDeviceControlService,
                HikvisionDiscoveryService,
                HikvisionEventMonitoringService,
                HikvisionMaintenanceService,
                HikvisionDeviceConfigService,
            ],
        };
    }
}