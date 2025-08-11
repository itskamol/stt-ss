import { CorrelationIdMiddleware, RequestWithCorrelation } from './correlation-id.middleware';
import { Response } from 'express';

describe('CorrelationIdMiddleware', () => {
    let middleware: CorrelationIdMiddleware;
    let mockRequest: Partial<RequestWithCorrelation>;
    let mockResponse: Partial<Response>;
    let nextFunction: jest.Mock;

    beforeEach(() => {
        middleware = new CorrelationIdMiddleware();
        mockRequest = {
            headers: {},
        };
        mockResponse = {
            setHeader: jest.fn(),
        };
        nextFunction = jest.fn();
    });

    it('should be defined', () => {
        expect(middleware).toBeDefined();
    });

    it('should generate correlation ID when not provided in headers', () => {
        middleware.use(
            mockRequest as RequestWithCorrelation,
            mockResponse as Response,
            nextFunction
        );

        expect(mockRequest.correlationId).toBeDefined();
        expect(typeof mockRequest.correlationId).toBe('string');
        expect(mockRequest.correlationId).toHaveLength(36); // UUID v4 length
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            mockRequest.correlationId
        );
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should use existing correlation ID from headers', () => {
        const existingCorrelationId = 'existing-correlation-id';
        mockRequest.headers = {
            'x-correlation-id': existingCorrelationId,
        };

        middleware.use(
            mockRequest as RequestWithCorrelation,
            mockResponse as Response,
            nextFunction
        );

        expect(mockRequest.correlationId).toBe(existingCorrelationId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'x-correlation-id',
            existingCorrelationId
        );
        expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle array of correlation IDs in headers', () => {
        const correlationIds = ['id1', 'id2'];
        mockRequest.headers = {
            'x-correlation-id': correlationIds,
        };

        middleware.use(
            mockRequest as RequestWithCorrelation,
            mockResponse as Response,
            nextFunction
        );

        // Should use the first ID when array is provided
        expect(mockRequest.correlationId).toBe('id1');
        expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'id1');
        expect(nextFunction).toHaveBeenCalled();
    });
});
