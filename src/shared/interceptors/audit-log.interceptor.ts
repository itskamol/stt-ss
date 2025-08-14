import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../services/audit-log.service';
import { LoggerService } from '@/core/logger';
import { DataScope, UserContext } from '../interfaces';
import { DataSanitizerService } from '../services/data-sanitizer.service';

export interface AuditLogOptions {
    action: string;
    resource: string;
    skipAudit?: boolean;
    captureRequest?: boolean;
    captureResponse?: boolean;
}

export const AUDIT_LOG_KEY = 'audit_log';

export const AuditLog = (options: AuditLogOptions) => {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        Reflect.defineMetadata(AUDIT_LOG_KEY, options, descriptor.value);
        return descriptor;
    };
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    constructor(
        private readonly reflector: Reflector,
        private readonly auditLogService: AuditLogService,
        private readonly logger: LoggerService,
        private readonly dataSanitizer: DataSanitizerService
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const auditOptions = this.reflector.get<AuditLogOptions>(
            AUDIT_LOG_KEY,
            context.getHandler()
        );

        if (!auditOptions || auditOptions.skipAudit) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user: UserContext = request.user;
        const scope: DataScope = request.scope;
        const method = request.method;
        const url = request.url;
        const userAgent = request.get('User-Agent');
        const host = this.getClientIp(request);

        // Capture request data if needed
        const requestData = auditOptions.captureRequest
            ? {
                  body: this.dataSanitizer.sanitizeForAudit(request.body).sanitized,
                  params: this.dataSanitizer.sanitizeForLogging(request.params),
                  query: this.dataSanitizer.sanitizeForLogging(request.query),
              }
            : undefined;

        const startTime = Date.now();

        return next.handle().pipe(
            tap(async response => {
                try {
                    const duration = Date.now() - startTime;

                    // Capture response data if needed (but sanitize sensitive data)
                    const responseData = auditOptions.captureResponse
                        ? this.dataSanitizer.sanitizeForAudit(response).sanitized
                        : undefined;

                    await this.auditLogService.createAuditLog({
                        action: auditOptions.action,
                        resource: auditOptions.resource,
                        resourceId: this.extractResourceId(request, response),
                        userId: user?.sub,
                        organizationId: scope?.organizationId || user?.organizationId,
                        method,
                        url,
                        userAgent,
                        host,
                        requestData,
                        responseData,
                        status: 'SUCCESS',
                        duration,
                        timestamp: new Date(),
                    });
                } catch (error) {
                    this.logger.error('Failed to create audit log', error.stack, {
                        action: auditOptions.action,
                        resource: auditOptions.resource,
                        userId: user?.sub,
                        organizationId: scope?.organizationId,
                        module: 'audit-log',
                        correlationId: request.correlationId,
                        error: error.message,
                    });
                }
            }),
            catchError(async error => {
                try {
                    const duration = Date.now() - startTime;

                    await this.auditLogService.createAuditLog({
                        action: auditOptions.action,
                        resource: auditOptions.resource,
                        resourceId: this.extractResourceId(request),
                        userId: user?.sub,
                        organizationId: scope?.organizationId || user?.organizationId,
                        method,
                        url,
                        userAgent,
                        host,
                        requestData,
                        responseData: undefined,
                        status: 'FAILED',
                        duration,
                        timestamp: new Date(),
                        errorMessage: error.message,
                        errorStack: error.stack,
                    });
                } catch (auditError) {
                    this.logger.error('Failed to create audit log for error', auditError.stack, {
                        originalError: error.message,
                        action: auditOptions.action,
                        resource: auditOptions.resource,
                        userId: user?.sub,
                        organizationId: scope?.organizationId,
                        module: 'audit-log',
                        correlationId: request.correlationId,
                        error: auditError.message,
                    });
                }

                throw error;
            })
        );
    }

    private getClientIp(request: any): string {
        return (
            request.headers['x-forwarded-for'] ||
            request.headers['x-real-ip'] ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.ip ||
            'unknown'
        );
    }

    private extractResourceId(request: any, response?: any): string | undefined {
        // Try to get ID from URL params first
        if (request.params?.id) {
            return request.params.id;
        }

        // Try to get ID from response (for create operations)
        if (response?.id) {
            return response.id;
        }

        // Try to get ID from request body (for updates)
        if (request.body?.id) {
            return request.body.id;
        }

        return undefined;
    }


}
