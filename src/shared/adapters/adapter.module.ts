import { Module } from '@nestjs/common';
import { LoggerModule } from '../../core/logger/logger.module';
import { StubStorageAdapter } from './implementations/stub-storage.adapter';
import { StubNotificationAdapter } from './implementations/stub-notification.adapter';
import { StubDeviceAdapter } from './implementations/stub-device.adapter';
import { StubMatchingAdapter } from './implementations/stub-matching.adapter';

@Module({
    imports: [LoggerModule],
    providers: [
        {
            provide: 'IStorageAdapter',
            useClass: StubStorageAdapter,
        },
        {
            provide: 'INotificationAdapter',
            useClass: StubNotificationAdapter,
        },
        {
            provide: 'IDeviceAdapter',
            useClass: StubDeviceAdapter,
        },
        {
            provide: 'IMatchingAdapter',
            useClass: StubMatchingAdapter,
        },
    ],
    exports: ['IStorageAdapter', 'INotificationAdapter', 'IDeviceAdapter', 'IMatchingAdapter'],
})
export class AdapterModule {}
