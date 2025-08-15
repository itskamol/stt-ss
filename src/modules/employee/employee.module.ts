import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { StubStorageAdapter } from '@/modules/integrations/adapters/implementations/storage/stub-storage.adapter';
import { PaginationService } from '@/shared/services/pagination.service';

@Module({
    imports: [DatabaseModule, LoggerModule],
    controllers: [EmployeeController],
    providers: [
        EmployeeService, 
        EmployeeRepository, 
        PaginationService,
        {
            provide: 'IStorageAdapter',
            useClass: StubStorageAdapter,
        }
    ],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}
