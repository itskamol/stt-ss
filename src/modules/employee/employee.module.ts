import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { EmployeeCredentialService, EmployeeCredentialRepository } from './credentials';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { AdapterModule } from '@/modules/integrations/adapters/adapter.module';
import { PaginationService } from '@/shared/services/pagination.service';

@Module({
    imports: [DatabaseModule, LoggerModule, AdapterModule],
    controllers: [EmployeeController],
    providers: [
        EmployeeService,
        EmployeeRepository,
        EmployeeCredentialService,
        EmployeeCredentialRepository,
        PaginationService,
    ],
    exports: [
        EmployeeService,
        EmployeeRepository,
        EmployeeCredentialService,
        EmployeeCredentialRepository,
    ],
})
export class EmployeeModule {}
