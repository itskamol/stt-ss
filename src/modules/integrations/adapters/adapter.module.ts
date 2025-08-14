import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from '@/core/logger/logger.module';
import { DatabaseModule } from '@/core/database/database.module';
import { EncryptionService } from '@/shared/services/encryption.service';
import { XmlJsonService } from '@/shared/services/xml-json.service';
import { HikvisionHttpClient, HikvisionAdapter, StubMatchingAdapter, StubNotificationAdapter, StubStorageAdapter } from './implementations';

/**
 * Hikvision qurilmasi bilan ishlash uchun zarur bo'lgan
 * barcha servislarni o'z ichiga olgan soddalashtirilgan modul.
 */
@Module({
    imports: [
        // Tashqi modullar
        LoggerModule,
        ConfigModule,
        DatabaseModule,
        HttpModule,
    ],
    providers: [
        // Hikvision adapteri va unga kerakli yordamchi servislarni ro'yxatdan o'tkazish
        HikvisionAdapter,
        HikvisionHttpClient,
        EncryptionService,
        XmlJsonService,
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
        HikvisionHttpClient,

        // Boshqa modullar HikvisionAdapter'dan foydalana olishi uchun uni eksport qilish
        HikvisionAdapter,
        'IStorageAdapter',
        'INotificationAdapter',
        'IMatchingAdapter',
    ],
})
export class AdapterModule {}
