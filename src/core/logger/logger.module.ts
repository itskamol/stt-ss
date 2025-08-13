import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '@/core/logger/winston.config';
import { LoggerService } from './services/main-logger.service';

@Global()
@Module({
    imports: [
        WinstonModule.forRoot(winstonConfig)
    ],
    providers: [
        LoggerService
    ],
    exports: [
        LoggerService
    ],
})
export class LoggerModule {}
