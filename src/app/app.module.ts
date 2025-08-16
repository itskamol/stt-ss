import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

import { ConfigModule } from '@/core/config/config.module';
import { DatabaseModule } from '@/core/database/database.module';
import { LoggerModule } from '@/core/logger/logger.module';
import { CacheModule } from '@/core/cache/cache.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserModule } from '@/modules/user/user.module';
import { OrganizationModule } from '@/modules/organization/organization.module';
import { BranchModule } from '@/modules/branch/branch.module';
import { DepartmentModule } from '@/modules/department/department.module';
import { EmployeeModule } from '@/modules/employee/employee.module';
import { QueueModule } from '@/core/queue/queue.module';
import { IntegrationsModule } from '@/modules/integrations/integrations.module';
import { DeviceModule } from '@/modules/device/device.module';
import { EventModule } from '@/modules/events/event.module';
import { AttendanceModule } from '@/modules/attendance/attendance.module';
import { GuestModule } from '@/modules/guest/guest.module';

import { GlobalExceptionFilter } from '@/shared/filters';
import { ResponseInterceptor } from '@/shared/interceptors/response.interceptor';
import { DataScopeGuard, JwtAuthGuard, RolesGuard } from '@/shared/guards';
import { CorrelationIdMiddleware, MorganLoggerMiddleware } from '@/shared/middleware';
import { AuditModule } from '@/modules/audit/audit.module';

@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        LoggerModule,
        CacheModule,
        HealthModule,
        AuthModule,
        UserModule,
        OrganizationModule,
        BranchModule,
        DepartmentModule,
        EmployeeModule,
        QueueModule,
        IntegrationsModule,
        DeviceModule,
        EventModule,
        AttendanceModule,
        GuestModule,
        AuditModule,
        // ReportingModule,
        // ReportProcessorModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: DataScopeGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(CorrelationIdMiddleware)
            .forRoutes({ path: '', method: RequestMethod.ALL });
        
        consumer
            .apply(MorganLoggerMiddleware)
            .forRoutes({ path: '', method: RequestMethod.ALL });
    }
}
