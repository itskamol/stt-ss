import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  HikvisionException,
  HikvisionConnectionException,
  HikvisionAuthenticationException,
  HikvisionNotFoundException,
  HikvisionBadRequestException,
  HikvisionDeviceException,
  HikvisionSessionException,
  HikvisionTimeoutException,
  HikvisionExceptionFactory,
} from './hikvision.exceptions';
import { HikvisionErrorContext, HikvisionErrorResponse } from '../adapters/hikvision.adapter';

describe('Hikvision Exceptions', () => {
  const mockContext: HikvisionErrorContext = {
    deviceId: 'test-device-1',
    operation: 'addUser',
    endpoint: '/ISAPI/AccessControl/UserInfo/Record',
    correlationId: 'test-correlation-id',
  };

  describe('HikvisionConnectionException', () => {
    it('should create connection exception with correct message', () => {
      const exception = new HikvisionConnectionException(mockContext);
      
      expect(exception.message).toBe('Failed to connect to Hikvision device test-device-1');
      expect(exception.context).toBe(mockContext);
      expect(exception.name).toBe('HikvisionConnectionException');
    });

    it('should convert to InternalServerErrorException', () => {
      const exception = new HikvisionConnectionException(mockContext);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(InternalServerErrorException);
      expect(nestException.message).toBe('Device connection failed: test-device-1');
    });
  });

  describe('HikvisionAuthenticationException', () => {
    it('should create authentication exception with correct message', () => {
      const exception = new HikvisionAuthenticationException(mockContext);
      
      expect(exception.message).toBe('Authentication failed for Hikvision device test-device-1');
      expect(exception.context).toBe(mockContext);
    });

    it('should convert to UnauthorizedException', () => {
      const exception = new HikvisionAuthenticationException(mockContext);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(UnauthorizedException);
      expect(nestException.message).toBe('Device authentication failed: test-device-1');
    });
  });

  describe('HikvisionNotFoundException', () => {
    it('should create not found exception with resource name', () => {
      const exception = new HikvisionNotFoundException(mockContext, 'user-123');
      
      expect(exception.message).toBe("Resource 'user-123' not found on Hikvision device test-device-1");
      expect(exception.context).toBe(mockContext);
    });

    it('should convert to NotFoundException', () => {
      const exception = new HikvisionNotFoundException(mockContext, 'user-123');
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(NotFoundException);
    });
  });

  describe('HikvisionBadRequestException', () => {
    it('should create bad request exception with reason', () => {
      const reason = 'Invalid employee number format';
      const exception = new HikvisionBadRequestException(mockContext, reason);
      
      expect(exception.message).toBe('Bad request to Hikvision device test-device-1: Invalid employee number format');
      expect(exception.context).toBe(mockContext);
    });

    it('should convert to BadRequestException', () => {
      const exception = new HikvisionBadRequestException(mockContext, 'test reason');
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(BadRequestException);
    });
  });

  describe('HikvisionDeviceException', () => {
    const mockHikvisionError: HikvisionErrorResponse = {
      statusCode: 500,
      statusString: 'Internal device error',
      subStatusCode: 'DEVICE_BUSY',
      errorCode: 1001,
      errorMsg: 'Device is currently processing another request',
    };

    it('should create device exception with Hikvision error details', () => {
      const exception = new HikvisionDeviceException(mockContext, mockHikvisionError);
      
      expect(exception.message).toBe('Hikvision device error 500: Internal device error');
      expect(exception.context).toBe(mockContext);
      expect(exception.hikvisionError).toBe(mockHikvisionError);
    });

    it('should convert to UnauthorizedException for 401 status', () => {
      const authError = { ...mockHikvisionError, statusCode: 401 };
      const exception = new HikvisionDeviceException(mockContext, authError);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(UnauthorizedException);
    });

    it('should convert to NotFoundException for 404 status', () => {
      const notFoundError = { ...mockHikvisionError, statusCode: 404 };
      const exception = new HikvisionDeviceException(mockContext, notFoundError);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(NotFoundException);
    });

    it('should convert to BadRequestException for 4xx status', () => {
      const badRequestError = { ...mockHikvisionError, statusCode: 422 };
      const exception = new HikvisionDeviceException(mockContext, badRequestError);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(BadRequestException);
    });

    it('should convert to InternalServerErrorException for 5xx status', () => {
      const exception = new HikvisionDeviceException(mockContext, mockHikvisionError);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('HikvisionSessionException', () => {
    it('should create session exception with reason', () => {
      const reason = 'Session expired';
      const exception = new HikvisionSessionException(mockContext, reason);
      
      expect(exception.message).toBe('Session error for Hikvision device test-device-1: Session expired');
      expect(exception.context).toBe(mockContext);
    });

    it('should convert to InternalServerErrorException', () => {
      const exception = new HikvisionSessionException(mockContext, 'test reason');
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('HikvisionTimeoutException', () => {
    it('should create timeout exception with timeout value', () => {
      const timeoutMs = 10000;
      const exception = new HikvisionTimeoutException(mockContext, timeoutMs);
      
      expect(exception.message).toBe('Request to Hikvision device test-device-1 timed out after 10000ms');
      expect(exception.context).toBe(mockContext);
    });

    it('should convert to InternalServerErrorException', () => {
      const exception = new HikvisionTimeoutException(mockContext, 5000);
      const nestException = exception.toNestException();
      
      expect(nestException).toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('HikvisionExceptionFactory', () => {
    describe('fromHttpError', () => {
      it('should create timeout exception for ECONNABORTED error', () => {
        const error = { code: 'ECONNABORTED', message: 'timeout' };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionTimeoutException);
      });

      it('should create connection exception for ECONNREFUSED error', () => {
        const error = { code: 'ECONNREFUSED', message: 'connection refused' };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionConnectionException);
      });

      it('should create authentication exception for 401 status', () => {
        const error = { response: { status: 401, statusText: 'Unauthorized' } };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionAuthenticationException);
      });

      it('should create not found exception for 404 status', () => {
        const error = { response: { status: 404, statusText: 'Not Found' } };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionNotFoundException);
      });

      it('should create bad request exception for 400 status', () => {
        const error = { response: { status: 400, statusText: 'Bad Request' } };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionBadRequestException);
      });

      it('should create device exception for Hikvision error response', () => {
        const hikvisionError = {
          statusCode: 500,
          statusString: 'Internal Error',
        };
        const error = {
          response: {
            status: 500,
            data: hikvisionError,
          },
        };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionDeviceException);
        expect((exception as HikvisionDeviceException).hikvisionError).toEqual(hikvisionError);
      });

      it('should create connection exception for unknown errors', () => {
        const error = { message: 'Unknown error' };
        const exception = HikvisionExceptionFactory.fromHttpError(error, mockContext);
        
        expect(exception).toBeInstanceOf(HikvisionConnectionException);
      });
    });

    describe('fromValidationError', () => {
      it('should create bad request exception for validation errors', () => {
        const validationMessage = 'Employee number is required';
        const exception = HikvisionExceptionFactory.fromValidationError(mockContext, validationMessage);
        
        expect(exception).toBeInstanceOf(HikvisionBadRequestException);
        expect(exception.message).toContain(validationMessage);
      });
    });

    describe('fromSessionError', () => {
      it('should create session exception with reason', () => {
        const reason = 'Failed to acquire session';
        const exception = HikvisionExceptionFactory.fromSessionError(mockContext, reason);
        
        expect(exception).toBeInstanceOf(HikvisionSessionException);
        expect(exception.message).toContain(reason);
      });
    });
  });
});