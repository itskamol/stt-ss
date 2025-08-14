import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@/core/logger/winston.config';
import { LoggerService } from './services/logger.service';
import { DataSanitizerService } from '@/shared/services/data-sanitizer.service';

@Global()
@Module({
    imports: [WinstonModule.forRoot(winstonConfig)],
    providers: [
        LoggerService,
        DataSanitizerService,
    ],
    exports: [LoggerService],
})
export class LoggerModule {}
