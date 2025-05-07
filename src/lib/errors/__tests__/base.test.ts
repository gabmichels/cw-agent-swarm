import { describe, it, expect } from 'vitest';
import { AppError, Result, successResult, failureResult } from '../base';

describe('AppError', () => {
  it('should create an error with the correct properties', () => {
    const message = 'Test error message';
    const code = 'TEST_ERROR';
    const context = { foo: 'bar' };
    
    const error = new AppError(message, code, context);
    
    expect(error.message).toBe(message);
    expect(error.code).toBe(code);
    expect(error.context).toEqual(context);
    expect(error.name).toBe('AppError');
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.stack).toBeDefined();
  });
  
  it('should serialize to JSON correctly', () => {
    const error = new AppError('Test error', 'TEST_ERROR', { foo: 'bar' });
    const json = error.toJSON();
    
    expect(json.name).toBe('AppError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.context).toEqual({ foo: 'bar' });
    expect(json.timestamp).toBeInstanceOf(Date);
    expect(json.stack).toBeDefined();
  });
  
  it('should add context with withContext method', () => {
    const error = new AppError('Test error', 'TEST_ERROR', { foo: 'bar' });
    const withExtraContext = error.withContext({ baz: 'qux' });
    
    expect(withExtraContext).toBeInstanceOf(AppError);
    expect(withExtraContext.context).toEqual({ foo: 'bar', baz: 'qux' });
    expect(withExtraContext.message).toBe(error.message);
    expect(withExtraContext.code).toBe(error.code);
  });
});

describe('Result', () => {
  it('should create a success result', () => {
    const data = { id: 1, name: 'Test' };
    const result = successResult(data);
    
    expect(result.success).toBe(true);
    expect(result.data).toBe(data);
    expect(result.error).toBeUndefined();
  });
  
  it('should create a failure result', () => {
    const error = new AppError('Test error', 'TEST_ERROR');
    const result = failureResult<{ id: number }>(error);
    
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe(error);
  });
}); 