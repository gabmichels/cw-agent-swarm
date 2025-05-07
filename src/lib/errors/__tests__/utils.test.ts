import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  convertToAppError, 
  handleSyncError, 
  handleAsyncError, 
  withErrorBoundary,
  errorToHttpResponse 
} from '../utils';
import { AppError } from '../base';
import { ValidationError } from '../types';

describe('Error Utilities', () => {
  describe('convertToAppError', () => {
    it('should return the same error if it is already an AppError', () => {
      const originalError = new AppError('Test error', 'TEST_ERROR');
      const convertedError = convertToAppError(originalError);
      
      expect(convertedError).toEqual(originalError);
    });
    
    it('should convert a standard Error to AppError', () => {
      const originalError = new Error('Standard error');
      const convertedError = convertToAppError(originalError);
      
      expect(convertedError).toBeInstanceOf(AppError);
      expect(convertedError.message).toBe('Standard error');
      expect(convertedError.code).toBe('UNKNOWN_ERROR');
      expect(convertedError.context.originalError).toBe('Error');
      expect(convertedError.context.stack).toBe(originalError.stack);
    });
    
    it('should convert a TypeError to AppError with correct code', () => {
      const originalError = new TypeError('Type error');
      const convertedError = convertToAppError(originalError);
      
      expect(convertedError).toBeInstanceOf(AppError);
      expect(convertedError.message).toBe('Type error');
      expect(convertedError.code).toBe('TYPE_ERROR');
    });
    
    it('should handle string errors', () => {
      const errorMessage = 'String error message';
      const convertedError = convertToAppError(errorMessage);
      
      expect(convertedError).toBeInstanceOf(AppError);
      expect(convertedError.message).toBe(errorMessage);
      expect(convertedError.code).toBe('UNKNOWN_ERROR');
    });
    
    it('should handle unknown error types', () => {
      const convertedError = convertToAppError(null);
      
      expect(convertedError).toBeInstanceOf(AppError);
      expect(convertedError.message).toBe('Unknown error occurred');
      expect(convertedError.code).toBe('UNKNOWN_ERROR');
      expect(convertedError.context.originalError).toBe(null);
    });
    
    it('should include additional context if provided', () => {
      const error = new Error('Test error');
      const context = { operation: 'test', userId: '123' };
      const convertedError = convertToAppError(error, context);
      
      expect(convertedError.context.operation).toBe('test');
      expect(convertedError.context.userId).toBe('123');
    });
  });
  
  describe('handleSyncError', () => {
    beforeEach(() => {
      // Mock console.error to avoid polluting test output
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should return success result for successful operations', () => {
      const operation = () => 42;
      const result = handleSyncError(operation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
      expect(result.error).toBeUndefined();
    });
    
    it('should return failure result for operations that throw', () => {
      const operation = () => {
        throw new Error('Test error');
      };
      const result = handleSyncError(operation);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error?.message).toBe('Test error');
    });
    
    it('should include additional context in the error', () => {
      const operation = () => {
        throw new Error('Test error');
      };
      const context = { operation: 'test' };
      const result = handleSyncError(operation, context);
      
      expect(result.error?.context.operation).toBe('test');
    });
  });
  
  describe('handleAsyncError', () => {
    beforeEach(() => {
      // Mock console.error to avoid polluting test output
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should return success result for successful async operations', async () => {
      const operation = async () => 42;
      const result = await handleAsyncError(operation);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
      expect(result.error).toBeUndefined();
    });
    
    it('should return failure result for async operations that throw', async () => {
      const operation = async () => {
        throw new Error('Async error');
      };
      const result = await handleAsyncError(operation);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error?.message).toBe('Async error');
    });
  });
  
  describe('withErrorBoundary', () => {
    beforeEach(() => {
      // Mock console.error to avoid polluting test output
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      vi.restoreAllMocks();
    });
    
    it('should handle successful function calls', async () => {
      const fn = async (x: number, y: number) => x + y;
      const safeFn = withErrorBoundary(fn);
      
      const result = await safeFn(2, 3);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(5);
    });
    
    it('should handle functions that throw errors', async () => {
      const fn = async () => {
        throw new Error('Function error');
      };
      const safeFn = withErrorBoundary(fn);
      
      const result = await safeFn();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      expect(result.error?.message).toBe('Function error');
    });
    
    it('should capture function arguments in error context', async () => {
      const fn = async (a: string, b: number) => {
        throw new Error('Function error');
      };
      const safeFn = withErrorBoundary(fn);
      
      const result = await safeFn('test', 123);
      
      expect(result.error?.context.args).toEqual(['test', '123']);
    });
  });
  
  describe('errorToHttpResponse', () => {
    it('should convert AppError to appropriate HTTP response', () => {
      const error = new AppError('Test error', 'UNKNOWN_ERROR');
      const response = errorToHttpResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.body.error.message).toBe('Test error');
      expect(response.body.error.code).toBe('UNKNOWN_ERROR');
    });
    
    it('should set appropriate status code for validation errors', () => {
      const error = new ValidationError('Validation failed', [
        { field: 'name', message: 'Name is required' }
      ]);
      const response = errorToHttpResponse(error);
      
      expect(response.statusCode).toBe(400);
    });
    
    it('should set status code 404 for NOT_FOUND errors', () => {
      const error = new AppError('Resource not found', 'RESOURCE_NOT_FOUND');
      const response = errorToHttpResponse(error);
      
      expect(response.statusCode).toBe(404);
    });
    
    it('should set status code 401 for UNAUTHORIZED errors', () => {
      const error = new AppError('Unauthorized', 'UNAUTHORIZED');
      const response = errorToHttpResponse(error);
      
      expect(response.statusCode).toBe(401);
    });
    
    it('should convert non-AppError to AppError before creating response', () => {
      const error = new Error('Standard error');
      const response = errorToHttpResponse(error);
      
      expect(response.statusCode).toBe(500);
      expect(response.body.error.message).toBe('Standard error');
    });
  });
}); 