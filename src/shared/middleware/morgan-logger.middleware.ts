import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as morgan from 'morgan';
import { LoggerService } from '@/core/logger';
import { RequestWithCorrelation } from './correlation-id.middleware';

@Injectable()
export class MorganLoggerMiddleware implements NestMiddleware {
    private morganInstance: any;

    constructor(private readonly logger: LoggerService) {
        morgan.format('custom', (tokens, req: RequestWithCorrelation, res) => {
            const status = parseInt(tokens.status(req, res) || '500');

            if (status >= 500) {
                return '';
            }

            const userContext = req.user as any;
            const responseTime = parseFloat(tokens['response-time'](req, res) || '0');

            const logContext = {
                module: 'HTTP',
                method: tokens.method(req, res),
                url: tokens.url(req, res),
                statusCode: status,
                responseTime,
                userAgent: tokens['user-agent'](req, res),
                userId: userContext?.sub || userContext?.id,
                organizationId: userContext?.organizationId,
                correlationId: req.correlationId,
                ip: req.ip || req.socket?.remoteAddress,
                contentLength: tokens.res(req, res, 'content-length') || '0',
                referrer: tokens.referrer(req, res) || '-',
            };

            const message = `${logContext.method} ${logContext.url} - ${status} (${responseTime}ms)`;

            if (status >= 400) {
                this.logger.warn(message, logContext);
            } else {
                this.logger.log(message, logContext);
            }

            return '';
        });

        this.morganInstance = morgan('custom', {
            stream: { write: () => {} },
        });
    }

    use(req: Request, res: Response, next: NextFunction): void {
        this.morganInstance(req, res, next);
    }
}
