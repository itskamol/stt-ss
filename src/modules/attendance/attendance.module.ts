import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';

@Module({
    imports: [DatabaseModule, LoggerModule],
    controllers: [AttendanceController],
    providers: [AttendanceService, AttendanceRepository],
    exports: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
