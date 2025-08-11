import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { LoggerService } from '../../core/logger/logger.service';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';
import { DatabaseUtil } from '../utils/database.util';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: LoggerService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<RequestWithCorrelation>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let details: any = undefined;

        // Handle different types of exceptions
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                message = (exceptionResponse as any).message || exception.message;
                details = (exceptionResponse as any).details;
            }
        } else {
            // Try to handle Prisma errors
            try {
                DatabaseUtil.handlePrismaError(exception);
            } catch (handledException) {
                if (handledException instanceof HttpException) {
                    status = handledException.getStatus();
                    message = handledException.message;
                }
            }
        }

        // Log the exception
        const userContext = request.user as any;
        this.logger.error(
            `Exception occurred: ${message}`,
            exception instanceof Error ? exception.stack : String(exception),
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                userId: userContext?.sub,
                organizationId: userContext?.organizationId,
                correlationId: request.correlationId,
                module: 'exception-filter',
                userAgent: request.headers['user-agent'],
                ip: request.ip,
            }
        );

        // Prepare error response
        const errorResponse = {
            statusCode: status,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
            correlationId: request.correlationId,
            ...(details && { details }),
        };

        // Don't expose internal errors in production
        if (status === HttpStatus.INTERNAL_SERVER_ERROR && process.env.NODE_ENV === 'production') {
            errorResponse.message = 'Internal server error';
        }

        response.status(status).json(errorResponse);
    }
}
