import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import { ConfigService } from '../config/config.service';

describe('LoggerService', () => {
    let service: LoggerService;
    let configService: ConfigService;

    const mockConfigService = {
        nodeEnv: 'test',
        isDevelopment: false,
        logLevel: 'info',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LoggerService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<LoggerService>(LoggerService);
        configService = module.get<ConfigService>(ConfigService);

        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('log', () => {
        it('should log info message with structured format', () => {
            const message = 'Test message';
            const context = { userId: '123', module: 'test' };

            service.log(message, context);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"level":"INFO"'));
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Test message"')
            );
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"userId":"123"'));
        });

        it('should include service metadata in log', () => {
            service.log('Test message');

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"service":"sector-staff-v2"')
            );
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"version":"2.1.0"'));
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"environment":"test"')
            );
        });
    });

    describe('error', () => {
        it('should log error message with trace', () => {
            const message = 'Error message';
            const trace = 'Error stack trace';
            const context = { userId: '123' };

            service.error(message, trace, context);

            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"level":"ERROR"'));
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('"trace":"Error stack trace"')
            );
        });
    });

    describe('warn', () => {
        it('should log warning message', () => {
            const message = 'Warning message';

            service.warn(message);

            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"level":"WARN"'));
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Warning message"')
            );
        });
    });

    describe('debug', () => {
        it('should not log debug message in non-development environment', () => {
            service.debug('Debug message');

            expect(console.debug).not.toHaveBeenCalled();
        });

        it('should log debug message when log level is debug', () => {
            mockConfigService.logLevel = 'debug';
            service.debug('Debug message');

            expect(console.debug).toHaveBeenCalledWith(expect.stringContaining('"level":"DEBUG"'));
        });
    });

    describe('logUserAction', () => {
        it('should log user action with proper context', () => {
            service.logUserAction('user-123', 'LOGIN', { ip: '127.0.0.1' }, 'org-456', 'corr-789');

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"message":"User action: LOGIN"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"userId":"user-123"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"organizationId":"org-456"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"correlationId":"corr-789"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"module":"user-action"')
            );
        });
    });

    describe('logDatabaseOperation', () => {
        it('should log database operation with proper context', () => {
            service.logDatabaseOperation(
                'CREATE',
                'Employee',
                'emp-123',
                'user-456',
                'org-789',
                'corr-abc'
            );

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Database operation: CREATE on Employee"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"operation":"CREATE"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"entity":"Employee"')
            );
            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"entityId":"emp-123"')
            );
        });
    });

    describe('logSecurityEvent', () => {
        it('should log security event as warning', () => {
            service.logSecurityEvent('UNAUTHORIZED_ACCESS', { ip: '127.0.0.1' }, 'user-123');

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Security event: UNAUTHORIZED_ACCESS"')
            );
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('"module":"security"')
            );
        });
    });

    describe('logQueueJob', () => {
        it('should log successful job completion', () => {
            service.logQueueJob(
                'ProcessEvent',
                'job-123',
                'completed',
                1500,
                undefined,
                'corr-456'
            );

            expect(console.log).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Queue job ProcessEvent (job-123) completed"')
            );
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"duration":1500'));
        });

        it('should log failed job as error', () => {
            service.logQueueJob(
                'ProcessEvent',
                'job-123',
                'failed',
                500,
                'Connection timeout',
                'corr-456'
            );

            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('"message":"Queue job ProcessEvent (job-123) failed"')
            );
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Connection timeout')
            );
        });
    });
});
