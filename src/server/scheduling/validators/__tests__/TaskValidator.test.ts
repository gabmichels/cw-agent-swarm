import { describe, it, expect } from 'vitest';
import { DefaultTaskValidator } from '../TaskValidator';

describe('DefaultTaskValidator', () => {
  it('validates a correct task', () => {
    const validator = new DefaultTaskValidator();
    expect(validator.validate({ id: '1', name: 'Test', status: 'pending' })).toBe(true);
  });
  it('rejects a task with missing id', () => {
    const validator = new DefaultTaskValidator();
    expect(validator.validate({ id: '', name: 'Test', status: 'pending' })).toBe(false);
  });
  it('rejects a task with non-array dependencies', () => {
    const validator = new DefaultTaskValidator();
    expect(validator.validate({ id: '1', name: 'Test', status: 'pending', dependencies: 'not-an-array' as any })).toBe(false);
  });
}); 