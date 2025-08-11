import { Module } from '@nestjs/common';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { AuditLogRepository } from '../../shared/services/audit-log.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';

@Module({
    imports: [DatabaseModule, LoggerModule],
    controllers: [AuditLogController],
    providers: [AuditLogService, AuditLogRepository],
    exports: [AuditLogService, AuditLogRepository],
})
export class AuditModule {}
