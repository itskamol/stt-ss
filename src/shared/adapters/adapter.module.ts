import { Module, DynamicModule } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from '@/core/logger/logger.module';
import { DatabaseModule } from '@/core/database/database.module';
import { EncryptionService } from '../services/encryption.service';
import { XmlJsonService } from '../services/xml-json.service';
import { HikvisionAdapter, StubDeviceAdapter, StubMatchingAdapter, StubNotificationAdapter, StubStorageAdapter } from './implementations';
import { DeviceAdapterFactory } from './factories';
import { ConfigModule } from '@nestjs/config';

export interface AdapterModuleOptions {
    useStubAdapters?: boolean;
    deviceAdapterType?: 'hikvision' | 'stub' | 'auto';
}

@Module({})
export class AdapterModule {
    static forRoot(options: AdapterModuleOptions = {}): DynamicModule {
        const {
            useStubAdapters = false,
            deviceAdapterType = 'auto',
        } = options;

        return {
            module: AdapterModule,
            imports: [
                LoggerModule,
                ConfigModule,
                DatabaseModule,
                HttpModule
            ],
            providers: [
                // Device adapters
                HikvisionAdapter,
                StubDeviceAdapter,
                DeviceAdapterFactory,
                EncryptionService,
                XmlJsonService,

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
                HikvisionAdapter,
                StubDeviceAdapter,
                DeviceAdapterFactory,
                'IStorageAdapter',
                'INotificationAdapter',
                'IMatchingAdapter',
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
                DatabaseModule,
                HttpModule,
                ...(options.imports || []),
            ],
            providers: [
                // Device adapters
                HikvisionAdapter,
                StubDeviceAdapter,
                DeviceAdapterFactory,

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

                // Options provider
                {
                    provide: 'ADAPTER_MODULE_OPTIONS',
                    useFactory: options.useFactory,
                    inject: options.inject || [],
                },
            ],
            exports: [
                HikvisionAdapter,
                StubDeviceAdapter,
                DeviceAdapterFactory,
                'IStorageAdapter',
                'INotificationAdapter',
                'IMatchingAdapter',
                'ADAPTER_MODULE_OPTIONS',
            ],
        };
    }
}

