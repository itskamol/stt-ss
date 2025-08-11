import { Test, TestingModule } from '@nestjs/testing';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLog, AuditLogInterceptor } from './audit-log.interceptor';
import { AuditLogService } from '../services/audit-log.service';
import { LoggerService } from '../../core/logger/logger.service';

describe('AuditLogInterceptor', () => {
    let interceptor: AuditLogInterceptor;
    let auditLogService: jest.Mocked<AuditLogService>;
    let loggerService: jest.Mocked<LoggerService>;
    let reflector: jest.Mocked<Reflector>;

    const mockExecutionContext = {
        switchToHttp: () => ({
            getRequest: () => ({
                user: {
                    sub: 'user-123',
                    organizationId: 'org-123',
                },
                scope: {
                    organizationId: 'org-123',
                },
                method: 'POST',
                url: '/api/v1/employees',
                get: jest.fn().mockReturnValue('Mozilla/5.0'),
                body: { name: 'John Doe', password: 'secret123' },
                params: { id: 'emp-123' },
                query: { page: '1' },
                connection: { remoteAddress: '192.168.1.1' },
            }),
        }),
        getHandler: jest.fn(),
    } as unknown as ExecutionContext;

    const mockCallHandler = {
        handle: jest.fn(),
    } as any;

    beforeEach(async () => {
        const mockAuditLogService = {
            createAuditLog: jest.fn(),
        };

        const mockLoggerService = {
            error: jest.fn(),
        };

        const mockReflector = {
            get: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogInterceptor,
                {
                    provide: AuditLogService,
                    useValue: mockAuditLogService,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
                {
                    provide: Reflector,
                    useValue: mockReflector,
                },
            ],
        }).compile();

        interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
        auditLogService = module.get(AuditLogService);
        loggerService = module.get(LoggerService);
        reflector = module.get(Reflector);
    });

    it('should be defined', () => {
        expect(interceptor).toBeDefined();
    });

    it('should skip audit when no audit options are defined', async () => {
        reflector.get.mockReturnValue(undefined);
        mockCallHandler.handle.mockReturnValue(of({ id: 'emp-123' }));

        const result = await interceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .toPromise();

        expect(auditLogService.createAuditLog).not.toHaveBeenCalled();
        expect(result).toEqual({ id: 'emp-123' });
    });

    it('should skip audit when skipAudit is true', async () => {
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
            skipAudit: true,
        });
        mockCallHandler.handle.mockReturnValue(of({ id: 'emp-123' }));

        const result = await interceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .toPromise();

        expect(auditLogService.createAuditLog).not.toHaveBeenCalled();
        expect(result).toEqual({ id: 'emp-123' });
    });

    it('should create audit log for successful operation', async () => {
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
            captureRequest: true,
            captureResponse: true,
        });
        mockCallHandler.handle.mockReturnValue(of({ id: 'emp-123', name: 'John Doe' }));

        const result = await interceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .toPromise();

        expect(auditLogService.createAuditLog).toHaveBeenCalledWith({
            action: 'CREATE',
            resource: 'employee',
            resourceId: 'emp-123',
            userId: 'user-123',
            organizationId: 'org-123',
            method: 'POST',
            url: '/api/v1/employees',
            userAgent: 'Mozilla/5.0',
            ipAddress: '192.168.1.1',
            requestData: {
                body: { name: 'John Doe', password: '[REDACTED]' },
                params: { id: 'emp-123' },
                query: { page: '1' },
            },
            responseData: { id: 'emp-123', name: 'John Doe' },
            status: 'SUCCESS',
            duration: expect.any(Number),
            timestamp: expect.any(Date),
        });
        expect(result).toEqual({ id: 'emp-123', name: 'John Doe' });
    });

    it('should create audit log for failed operation', async () => {
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
        });
        const error = new Error('Validation failed');
        mockCallHandler.handle.mockReturnValue(throwError(error));

        try {
            await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();
        } catch (e) {
            expect(e).toBe(error);
        }

        expect(auditLogService.createAuditLog).toHaveBeenCalledWith({
            action: 'CREATE',
            resource: 'employee',
            resourceId: 'emp-123',
            userId: 'user-123',
            organizationId: 'org-123',
            method: 'POST',
            url: '/api/v1/employees',
            userAgent: 'Mozilla/5.0',
            ipAddress: '192.168.1.1',
            requestData: undefined,
            responseData: undefined,
            status: 'FAILED',
            duration: expect.any(Number),
            timestamp: expect.any(Date),
            errorMessage: 'Validation failed',
            errorStack: expect.any(String),
        });
    });

    it('should sanitize sensitive data in request', async () => {
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
            captureRequest: true,
        });
        mockCallHandler.handle.mockReturnValue(of({ id: 'emp-123' }));

        await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

        const auditCall = auditLogService.createAuditLog.mock.calls[0][0];
        expect(auditCall.requestData.body.password).toBe('[REDACTED]');
        expect(auditCall.requestData.body.name).toBe('John Doe');
    });

    it('should extract resource ID from different sources', async () => {
        // Test with response ID
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
        });
        mockCallHandler.handle.mockReturnValue(of({ id: 'response-123' }));

        await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();

        let auditCall = auditLogService.createAuditLog.mock.calls[0][0];
        expect(auditCall.resourceId).toBe('response-123');

        // Reset mock
        auditLogService.createAuditLog.mockClear();

        // Test with params ID when no response ID
        const contextWithoutResponseId = {
            ...mockExecutionContext,
            switchToHttp: () => ({
                getRequest: () => ({
                    ...mockExecutionContext.switchToHttp().getRequest(),
                    params: { id: 'param-123' },
                }),
            }),
        };

        mockCallHandler.handle.mockReturnValue(of({ name: 'John Doe' }));

        await interceptor.intercept(contextWithoutResponseId as any, mockCallHandler).toPromise();

        auditCall = auditLogService.createAuditLog.mock.calls[0][0];
        expect(auditCall.resourceId).toBe('param-123');
    });

    it('should handle audit log creation errors gracefully', async () => {
        reflector.get.mockReturnValue({
            action: 'CREATE',
            resource: 'employee',
        });
        mockCallHandler.handle.mockReturnValue(of({ id: 'emp-123' }));
        auditLogService.createAuditLog.mockRejectedValue(new Error('Audit service error'));

        const result = await interceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .toPromise();

        expect(loggerService.error).toHaveBeenCalledWith(
            'Failed to create audit log',
            'Audit service error',
            expect.any(Object)
        );
        expect(result).toEqual({ id: 'emp-123' });
    });

    it('should get client IP from various headers', () => {
        const testCases = [
            {
                headers: { 'x-forwarded-for': '203.0.113.1' },
                expected: '203.0.113.1',
            },
            {
                headers: { 'x-real-ip': '203.0.113.2' },
                expected: '203.0.113.2',
            },
            {
                connection: { remoteAddress: '203.0.113.3' },
                expected: '203.0.113.3',
            },
            {
                socket: { remoteAddress: '203.0.113.4' },
                expected: '203.0.113.4',
            },
            {
                ip: '203.0.113.5',
                expected: '203.0.113.5',
            },
            {
                headers: {},
                expected: 'unknown',
            },
        ];

        testCases.forEach((testCase, index) => {
            const mockRequest = {
                headers: testCase.headers || {},
                connection: testCase.connection,
                socket: testCase.socket,
                ip: testCase.ip,
            };

            const ip = (interceptor as any).getClientIp(mockRequest);
            expect(ip).toBe(testCase.expected);
        });
    });

    it('should sanitize nested sensitive data', () => {
        const testData = {
            user: {
                name: 'John Doe',
                password: 'secret123',
                profile: {
                    email: 'john@example.com',
                    creditCard: '1234-5678-9012-3456',
                },
            },
            settings: {
                apiKey: 'sk-1234567890',
                publicData: 'visible',
            },
        };

        const sanitized = (interceptor as any).sanitizeData(testData);

        expect(sanitized.user.name).toBe('John Doe');
        expect(sanitized.user.password).toBe('[REDACTED]');
        expect(sanitized.user.profile.email).toBe('john@example.com');
        expect(sanitized.user.profile.creditCard).toBe('[REDACTED]');
        expect(sanitized.settings.apiKey).toBe('[REDACTED]');
        expect(sanitized.settings.publicData).toBe('visible');
    });
});

// Test the AuditLog decorator
describe('AuditLog decorator', () => {
    it('should set metadata on method', () => {
        class TestController {
            @AuditLog({
                action: 'CREATE',
                resource: 'employee',
                captureRequest: true,
            })
            createEmployee() {
                return { id: 'emp-123' };
            }
        }

        const controller = new TestController();
        const metadata = Reflect.getMetadata('audit_log', controller.createEmployee);

        expect(metadata).toEqual({
            action: 'CREATE',
            resource: 'employee',
            captureRequest: true,
        });
    });
});
