import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './services/logger.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

describe('LoggerService', () => {
    let service: LoggerService;
    let mockWinstonLogger: Logger;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                LoggerService,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: {
                        log: jest.fn(),
                        info: jest.fn(),
                        error: jest.fn(),
                        warn: jest.fn(),
                        debug: jest.fn(),
                        verbose: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<LoggerService>(LoggerService);
        mockWinstonLogger = module.get<Logger>(WINSTON_MODULE_PROVIDER);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('log', () => {
        it('should call winston.info with message and context', () => {
            const message = 'Test message';
            const context = { userId: '123', module: 'test' };

            service.log(message, context);

            expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, { context });
        });
    });

    describe('error', () => {
        it('should call winston.error with message, trace and context', () => {
            const message = 'Error message';
            const trace = 'Error stack trace';
            const context = { userId: '123' };

            service.error(message, trace, context);

            expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, { context: { ...context, trace } });
        });
    });

    describe('warn', () => {
        it('should call winston.warn with message and context', () => {
            const message = 'Warning message';
            const context = 'test-warn';
            service.warn(message, context);

            expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, { context: { module: 'test-warn' } });
        });
    });

    describe('debug', () => {
        it('should call winston.debug with message and context', () => {
            service.debug('Debug message');
            expect(mockWinstonLogger.debug).toHaveBeenCalledWith('Debug message', { context: undefined });
        });
    });

    describe('verbose', () => {
        it('should call winston.verbose with message and context', () => {
            service.verbose('Verbose message');
            expect(mockWinstonLogger.verbose).toHaveBeenCalledWith('Verbose message', { context: undefined });
        });
    });

    describe('logWithCorrelationId', () => {
        it('should call the correct log level method with correlationId in context', () => {
            service.logWithCorrelationId('corr-id', 'warn', 'A warning');
            expect(mockWinstonLogger.warn).toHaveBeenCalledWith('A warning', {
                context: { correlationId: 'corr-id' },
            });
        });
    });

    describe('logUserAction', () => {
        it('should log user action with proper context', () => {
            service.logUserAction('user-123', 'LOGIN', { ip: '127.0.0.1' });
            expect(mockWinstonLogger.info).toHaveBeenCalledWith(
                'User action: LOGIN',
                {
                    context: {
                        userId: 'user-123',
                        module: 'user-action',
                        ip: '127.0.0.1',
                    },
                },
            );
        });
    });

    describe('logApiRequest', () => {
        it('should log api request with proper context', () => {
            service.logApiRequest('GET', '/test', 'user-123', 100);
            expect(mockWinstonLogger.info).toHaveBeenCalledWith(
                'GET /test',
                {
                    context: {
                        module: 'api',
                        userId: 'user-123',
                        responseTime: 100,
                    },
                },
            );
        });
    });
});
