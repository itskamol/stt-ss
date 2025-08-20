import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { LoggerService } from '@/core/logger';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';
import { ApiErrorDto, ApiErrorResponse } from '../dto/api-response.dto';
import { CustomValidationException } from '../exceptions/validation.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: LoggerService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<RequestWithCorrelation>();
        const correlationId = request.correlationId;

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        const error: ApiErrorDto = {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
        };

        if (exception instanceof CustomValidationException) {
            status = HttpStatus.BAD_REQUEST;
            const response = exception.getResponse() as any;
            error.code = 'VALIDATION_ERROR';
            error.message = 'Validation failed';
            error.details = response.errors;
        } else if (exception instanceof HttpException) {
            status = exception.getStatus();
            const response = exception.getResponse();
            error.message = typeof response === 'string' ? response : (response as any).message;
            error.code = this.getErrorCodeFromStatus(status);
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            // See https://www.prisma.io/docs/reference/api-reference/error-reference#error-codes
            switch (exception.code) {
                case 'P2002': // Unique constraint failed
                    status = HttpStatus.CONFLICT;
                    error.code = 'UNIQUE_CONSTRAINT_VIOLATION';
                    error.message = `A record with the same unique value already exists.`;
                    error.details = {
                        target: exception.meta?.target,
                    };
                    break;
                case 'P2025': // Record to update not found
                    status = HttpStatus.NOT_FOUND;
                    error.code = 'RESOURCE_NOT_FOUND';
                    error.message = 'The requested resource could not be found.';
                    break;
                default:
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    error.code = 'DATABASE_ERROR';
                    error.message = 'A database error occurred.';
                    break;
            }
        } else if (exception instanceof Error) {
            // Generic error
            error.message = exception.message;
        }

        const userContext = request.user as any;
        this.logger.logApiError(request.method, request.url, status, error.message, {
            userId: userContext?.sub || userContext?.id,
            organizationId: userContext?.organizationId,
            correlationId,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            trace: exception instanceof Error ? exception.stack : String(exception),
            exceptionType: exception?.constructor?.name || 'Unknown',
            details: error.details,
        });

        // In production, hide sensitive error details
        if (status === HttpStatus.INTERNAL_SERVER_ERROR && process.env.NODE_ENV === 'production') {
            error.message = 'An unexpected internal error occurred.';
            error.details = undefined;
        }

        const errorResponse = new ApiErrorResponse(error, correlationId);
        response.status(status).json(errorResponse);
    }

    private getErrorCodeFromStatus(status: number): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'BAD_REQUEST';
            case HttpStatus.UNAUTHORIZED:
                return 'UNAUTHORIZED';
            case HttpStatus.FORBIDDEN:
                return 'FORBIDDEN_RESOURCE';
            case HttpStatus.NOT_FOUND:
                return 'RESOURCE_NOT_FOUND';
            case HttpStatus.CONFLICT:
                return 'RESOURCE_CONFLICT';
            default:
                return 'SERVER_ERROR';
        }
    }
}
