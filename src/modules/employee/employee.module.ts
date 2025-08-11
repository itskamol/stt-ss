import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';

@Module({
    imports: [DatabaseModule, LoggerModule],
    controllers: [EmployeeController],
    providers: [EmployeeService, EmployeeRepository],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
