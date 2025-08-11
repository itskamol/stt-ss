import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { UuidUtil } from '../utils/uuid.util';

export interface RequestWithCorrelation extends Request {
    correlationId: string;
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
    use(req: RequestWithCorrelation, res: Response, next: NextFunction) {
        // Check if correlation ID is provided in headers, otherwise generate one
        const correlationId = (req.headers['x-correlation-id'] as string) || UuidUtil.generate();

        // Add correlation ID to request object
        req.correlationId = correlationId;

        // Add correlation ID to response headers
        res.setHeader('x-correlation-id', correlationId);

        next();
    }
}
