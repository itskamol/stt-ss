import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../core/logger/logger.service';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: LoggerService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
        const response = context.switchToHttp().getResponse();

        const { method, url, correlationId } = request;
        const userContext = request.user as any;
        const startTime = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    const responseTime = Date.now() - startTime;
                    this.logger.logApiRequest(
                        method,
                        url,
                        response.statusCode,
                        responseTime,
                        userContext?.sub,
                        userContext?.organizationId,
                        correlationId
                    );
                },
                error: error => {
                    const responseTime = Date.now() - startTime;
                    this.logger.error(
                        `API Request failed: ${method} ${url} - ${error.status || 500} (${responseTime}ms)`,
                        error.stack,
                        {
                            method,
                            url,
                            statusCode: error.status || 500,
                            responseTime,
                            userId: userContext?.sub,
                            organizationId: userContext?.organizationId,
                            correlationId,
                            module: 'api',
                            error: error.message,
                        }
                    );
                },
            })
        );
    }
}
