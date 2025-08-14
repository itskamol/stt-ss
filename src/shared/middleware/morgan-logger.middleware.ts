import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as morgan from 'morgan';
import { LoggerService } from '@/core/logger';
import { RequestWithCorrelation } from './correlation-id.middleware';

@Injectable()
export class MorganLoggerMiddleware implements NestMiddleware {
    private morganMiddleware: any;

    constructor(private readonly logger: LoggerService) {
        // Custom format for Morgan with correlation ID and user context
        morgan.format('custom', (tokens, req: RequestWithCorrelation, res) => {
            const userContext = req.user as any;
            const status = parseInt(tokens.status(req, res) || '500');
            const responseTime = parseFloat(tokens['response-time'](req, res) || '0');
            
            const logContext = {
                module: 'http',
                method: tokens.method(req, res),
                url: tokens.url(req, res),
                statusCode: status,
                responseTime,
                userAgent: tokens['user-agent'](req, res),
                userId: userContext?.sub || userContext?.id,
                organizationId: userContext?.organizationId,
                correlationId: req.correlationId,
                ip: req.ip,
                contentLength: tokens.res(req, res, 'content-length'),
            };

            // Use our custom logger instead of console
            const message = `${logContext.method} ${logContext.url} - ${status} (${responseTime}ms)`;

            if (status >= 400) {
                this.logger.warn(message, logContext);
            } else {
                this.logger.log(message, logContext);
            }

            return ''; // Return empty string to prevent console output
        });

        // Create Morgan middleware with custom format
        this.morganMiddleware = morgan('custom', {
            // Skip health check and favicon requests
            skip: (req: Request) => {
                return req.url.includes('/health') || 
                       req.url.includes('/favicon.ico') ||
                       req.url.includes('/metrics');
            },
        });
    }

    use(req: Request, res: Response, next: NextFunction): void {
        this.morganMiddleware(req, res, next);
    }
}
