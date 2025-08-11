import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../services/audit-log.service';
import { LoggerService } from '../../core/logger/logger.service';
import { DataScope, UserContext } from '../interfaces';

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
        private readonly logger: LoggerService
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
        const ipAddress = this.getClientIp(request);

        // Capture request data if needed
        const requestData = auditOptions.captureRequest
            ? {
                  body: this.sanitizeData(request.body),
                  params: request.params,
                  query: request.query,
              }
            : undefined;

        const startTime = Date.now();

        return next.handle().pipe(
            tap(async response => {
                try {
                    const duration = Date.now() - startTime;

                    // Capture response data if needed (but sanitize sensitive data)
                    const responseData = auditOptions.captureResponse
                        ? this.sanitizeData(response)
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
                        ipAddress,
                        requestData,
                        responseData,
                        status: 'SUCCESS',
                        duration,
                        timestamp: new Date(),
                    });
                } catch (error) {
                    this.logger.error('Failed to create audit log', error.message, {
                        action: auditOptions.action,
                        resource: auditOptions.resource,
                        userId: user?.sub,
                        organizationId: scope?.organizationId,
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
                        ipAddress,
                        requestData,
                        responseData: undefined,
                        status: 'FAILED',
                        duration,
                        timestamp: new Date(),
                        errorMessage: error.message,
                        errorStack: error.stack,
                    });
                } catch (auditError) {
                    this.logger.error('Failed to create audit log for error', auditError.message, {
                        originalError: error.message,
                        action: auditOptions.action,
                        resource: auditOptions.resource,
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

    private sanitizeData(data: any): any {
        if (!data) return data;

        // Clone the data to avoid modifying the original
        const sanitized = JSON.parse(JSON.stringify(data));

        // List of sensitive fields to redact
        const sensitiveFields = [
            'password',
            'token',
            'secret',
            'key',
            'authorization',
            'cookie',
            'session',
            'credential',
            'pin',
            'ssn',
            'social',
            'credit',
            'card',
            'cvv',
            'cvc',
        ];

        const redactSensitiveData = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) {
                return obj;
            }

            if (Array.isArray(obj)) {
                return obj.map(redactSensitiveData);
            }

            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

                if (isSensitive) {
                    result[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    result[key] = redactSensitiveData(value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        };

        return redactSensitiveData(sanitized);
    }
}
