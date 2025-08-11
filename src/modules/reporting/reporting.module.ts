import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { ReportRepository } from './report.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { QueueModule } from '../../core/queue/queue.module';
import { AdapterModule } from '../../shared/adapters/adapter.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeeModule } from '../employee/employee.module';
import { DeviceModule } from '../device/device.module';
import { GuestModule } from '../guest/guest.module';
import { AuditModule } from '../audit/audit.module';

@Module({
    imports: [
        DatabaseModule,
        LoggerModule,
        QueueModule,
        AdapterModule,
        AttendanceModule,
        EmployeeModule,
        DeviceModule,
        GuestModule,
        AuditModule,
    ],
    controllers: [ReportingController],
    providers: [ReportingService, ReportRepository],
    exports: [ReportingService, ReportRepository],
})
export class ReportingModule {}
