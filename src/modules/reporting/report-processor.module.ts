import { Module } from '@nestjs/common';
import { ReportGenerationProcessor } from '../../core/queue/processors/report-generation.processor';
import { ReportingModule } from './reporting.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { EmployeeModule } from '../employee/employee.module';
import { DeviceModule } from '../device/device.module';
import { GuestModule } from '../guest/guest.module';
import { AuditModule } from '../audit/audit.module';
import { LoggerModule } from '../../core/logger/logger.module';
import { AdapterModule } from '../../shared/adapters/adapter.module';

@Module({
    imports: [
        LoggerModule,
        AdapterModule,
        ReportingModule,
        AttendanceModule,
        EmployeeModule,
        DeviceModule,
        GuestModule,
        AuditModule,
    ],
    providers: [ReportGenerationProcessor],
    exports: [ReportGenerationProcessor],
})
export class ReportProcessorModule {}
