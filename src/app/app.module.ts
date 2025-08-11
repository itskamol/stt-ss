import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '../core/config/config.module';
import { DatabaseModule } from '../core/database/database.module';
import { LoggerModule } from '../core/logger/logger.module';
import { CacheModule } from '../core/cache/cache.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UserModule } from '../modules/user/user.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { BranchModule } from '../modules/branch/branch.module';
import { DepartmentModule } from '../modules/department/department.module';
import { EmployeeModule } from '../modules/employee/employee.module';
import { QueueModule } from '../core/queue/queue.module';
import { AdapterModule } from '../shared/adapters/adapter.module';
import { DeviceModule } from '../modules/device/device.module';
import { EventModule } from '../modules/events/event.module';
import { AttendanceModule } from '../modules/attendance/attendance.module';
import { GuestModule } from '../modules/guest/guest.module';
// import { AuditModule } from '../modules/audit/audit.module';
// import { ReportingModule } from '../modules/reporting/reporting.module';
// import { ReportProcessorModule } from '../modules/reporting/report-processor.module';
import { CorrelationIdMiddleware } from '../shared/middleware/correlation-id.middleware';
import { LoggingInterceptor } from '../shared/interceptors/logging.interceptor';
// import { AuditLogInterceptor } from '../shared/interceptors/audit-log.interceptor';
import { GlobalExceptionFilter } from '../shared/filters/global-exception.filter';
import { DataScopeGuard, JwtAuthGuard, RolesGuard } from '../shared/guards';

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
        AdapterModule,
        DeviceModule,
        EventModule,
        AttendanceModule,
        GuestModule,
        // AuditModule,
        // ReportingModule,
        // ReportProcessorModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
        // {
        //   provide: APP_INTERCEPTOR,
        //   useClass: AuditLogInterceptor,
        // },
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
        consumer.apply(CorrelationIdMiddleware).forRoutes('*');
    }
}
