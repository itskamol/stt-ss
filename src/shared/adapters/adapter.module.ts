import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { LoggerModule } from '@/core/logger/logger.module';
import { StubStorageAdapter } from './implementations/stub-storage.adapter';
import { StubNotificationAdapter } from './implementations/stub-notification.adapter';
import { StubMatchingAdapter } from './implementations/stub-matching.adapter';
import { HikvisionAdapterModule } from './hikvision-adapter.module';

export interface AdapterModuleOptions {
    useStubAdapters?: boolean;
    deviceAdapterType?: 'hikvision' | 'stub' | 'auto';
    hikvisionConfig?: {
        httpTimeout?: number;
        maxRetries?: number;
        cacheConfig?: {
            ttl?: number;
            max?: number;
        };
    };
}

@Module({})
export class AdapterModule {
    static forRoot(options: AdapterModuleOptions = {}): DynamicModule {
        const {
            useStubAdapters = false,
            deviceAdapterType = 'auto',
            hikvisionConfig = {},
        } = options;

        return {
            module: AdapterModule,
            imports: [
                LoggerModule,
                ConfigModule,
                HikvisionAdapterModule.forRoot({
                    useStubAdapter: useStubAdapters,
                    adapterType: deviceAdapterType,
                    ...hikvisionConfig,
                }),
            ],
            providers: [
                // Storage adapter
                {
                    provide: 'IStorageAdapter',
                    useClass: StubStorageAdapter,
                },
                
                // Notification adapter
                {
                    provide: 'INotificationAdapter',
                    useClass: StubNotificationAdapter,
                },
                
                // Matching adapter
                {
                    provide: 'IMatchingAdapter',
                    useClass: StubMatchingAdapter,
                },

                // Device adapter is provided by HikvisionAdapterModule
            ],
            exports: [
                'IStorageAdapter', 
                'INotificationAdapter', 
                'IDeviceAdapter', 
                'IMatchingAdapter',
                HikvisionAdapterModule,
            ],
        };
    }

    static forRootAsync(options: {
        useFactory: (...args: any[]) => Promise<AdapterModuleOptions> | AdapterModuleOptions;
        inject?: any[];
        imports?: any[];
    }): DynamicModule {
        return {
            module: AdapterModule,
            imports: [
                LoggerModule,
                ConfigModule,
                HikvisionAdapterModule.forRootAsync({
                    useFactory: async (...args: any[]) => {
                        const moduleOptions = await options.useFactory(...args);
                        return {
                            useStubAdapter: moduleOptions.useStubAdapters,
                            adapterType: moduleOptions.deviceAdapterType,
                            ...moduleOptions.hikvisionConfig,
                        };
                    },
                    inject: options.inject,
                    imports: options.imports,
                }),
                ...(options.imports || []),
            ],
            providers: [
                // Storage adapter
                {
                    provide: 'IStorageAdapter',
                    useClass: StubStorageAdapter,
                },
                
                // Notification adapter
                {
                    provide: 'INotificationAdapter',
                    useClass: StubNotificationAdapter,
                },
                
                // Matching adapter
                {
                    provide: 'IMatchingAdapter',
                    useClass: StubMatchingAdapter,
                },
            ],
            exports: [
                'IStorageAdapter', 
                'INotificationAdapter', 
                'IDeviceAdapter', 
                'IMatchingAdapter',
                HikvisionAdapterModule,
            ],
        };
    }
}
