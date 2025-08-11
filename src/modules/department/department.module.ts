import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggerModule } from '../../core/logger/logger.module';

@Module({
    imports: [DatabaseModule, LoggerModule],
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository],
    exports: [DepartmentService, DepartmentRepository],
})
export class DepartmentModule {}
