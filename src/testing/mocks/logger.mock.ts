import { LoggerService } from '@/core/logger';

export const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  setContext: jest.fn(),
  logUserAction: jest.fn(),
  logSecurityEvent: jest.fn(),
};

export const MockLoggerProvider = {
  provide: LoggerService,
  useValue: mockLoggerService,
};
