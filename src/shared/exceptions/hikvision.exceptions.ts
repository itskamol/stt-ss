import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { HikvisionErrorResponse, HikvisionErrorContext } from '../adapters/hikvision.adapter';

/**
 * Base exception for all Hikvision adapter errors
 */
export abstract class HikvisionException extends Error {
  constructor(
    message: string,
    public readonly context: HikvisionErrorContext,
    public readonly originalError?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toNestException(): Error {
    return new InternalServerErrorException(this.message);
  }
}

/**
 * Exception for device connection failures
 */
export class HikvisionConnectionException extends HikvisionException {
  constructor(context: HikvisionErrorContext, originalError?: Error) {
    super(
      `Failed to connect to Hikvision device ${context.deviceId}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new InternalServerErrorException(
      `Device connection failed: ${this.context.deviceId}`,
    );
  }
}

/**
 * Exception for authentication failures
 */
export class HikvisionAuthenticationException extends HikvisionException {
  constructor(context: HikvisionErrorContext, originalError?: Error) {
    super(
      `Authentication failed for Hikvision device ${context.deviceId}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new UnauthorizedException(
      `Device authentication failed: ${this.context.deviceId}`,
    );
  }
}

/**
 * Exception for resource not found errors
 */
export class HikvisionNotFoundException extends HikvisionException {
  constructor(context: HikvisionErrorContext, resource: string, originalError?: Error) {
    super(
      `Resource '${resource}' not found on Hikvision device ${context.deviceId}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new NotFoundException(this.message);
  }
}

/**
 * Exception for invalid request data
 */
export class HikvisionBadRequestException extends HikvisionException {
  constructor(context: HikvisionErrorContext, reason: string, originalError?: Error) {
    super(
      `Bad request to Hikvision device ${context.deviceId}: ${reason}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new BadRequestException(this.message);
  }
}

/**
 * Exception for device-specific errors
 */
export class HikvisionDeviceException extends HikvisionException {
  constructor(
    context: HikvisionErrorContext,
    public readonly hikvisionError: HikvisionErrorResponse,
    originalError?: Error,
  ) {
    super(
      `Hikvision device error ${hikvisionError.statusCode}: ${hikvisionError.statusString}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    const statusCode = this.hikvisionError.statusCode;
    
    if (statusCode === 401 || statusCode === 403) {
      return new UnauthorizedException(this.message);
    }
    
    if (statusCode === 404) {
      return new NotFoundException(this.message);
    }
    
    if (statusCode >= 400 && statusCode < 500) {
      return new BadRequestException(this.message);
    }
    
    return new InternalServerErrorException(this.message);
  }
}

/**
 * Exception for session management errors
 */
export class HikvisionSessionException extends HikvisionException {
  constructor(context: HikvisionErrorContext, reason: string, originalError?: Error) {
    super(
      `Session error for Hikvision device ${context.deviceId}: ${reason}`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new InternalServerErrorException(this.message);
  }
}

/**
 * Exception for timeout errors
 */
export class HikvisionTimeoutException extends HikvisionException {
  constructor(context: HikvisionErrorContext, timeoutMs: number, originalError?: Error) {
    super(
      `Request to Hikvision device ${context.deviceId} timed out after ${timeoutMs}ms`,
      context,
      originalError,
    );
  }

  toNestException(): Error {
    return new InternalServerErrorException(this.message);
  }
}

/**
 * Utility class for creating appropriate exceptions from HTTP responses
 */
export class HikvisionExceptionFactory {
  static fromHttpError(
    error: any,
    context: HikvisionErrorContext,
  ): HikvisionException {
    const status = error.response?.status || error.status;
    const statusText = error.response?.statusText || error.message;

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new HikvisionTimeoutException(
        context,
        context.endpoint ? 10000 : 5000, // Default timeout values
        error,
      );
    }

    // Handle connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH') {
      return new HikvisionConnectionException(context, error);
    }

    // Handle HTTP status codes
    switch (status) {
      case 401:
      case 403:
        return new HikvisionAuthenticationException(context, error);
      
      case 404:
        return new HikvisionNotFoundException(context, 'endpoint', error);
      
      case 400:
      case 422:
        return new HikvisionBadRequestException(context, statusText, error);
      
      default:
        // Try to parse Hikvision-specific error response
        if (error.response?.data && typeof error.response.data === 'object') {
          const hikvisionError = error.response.data as HikvisionErrorResponse;
          if (hikvisionError.statusCode && hikvisionError.statusString) {
            return new HikvisionDeviceException(context, hikvisionError, error);
          }
        }
        
        return new HikvisionConnectionException(context, error);
    }
  }

  static fromValidationError(
    context: HikvisionErrorContext,
    validationMessage: string,
  ): HikvisionBadRequestException {
    return new HikvisionBadRequestException(context, validationMessage);
  }

  static fromSessionError(
    context: HikvisionErrorContext,
    reason: string,
    originalError?: Error,
  ): HikvisionSessionException {
    return new HikvisionSessionException(context, reason, originalError);
  }
}