/**
 * ManagerType.test.ts - Tests for the ManagerType enum
 * 
 * This file contains tests to ensure the ManagerType enum works correctly
 * and that it contains all the expected manager types.
 */

import { describe, it, expect } from 'vitest';
import { ManagerType } from './ManagerType';

describe('ManagerType enum', () => {
  it('should define all expected manager types', () => {
    expect(ManagerType.MEMORY).toBe('memory');
    expect(ManagerType.PLANNING).toBe('planning');
    expect(ManagerType.TOOL).toBe('tools');
    expect(ManagerType.KNOWLEDGE).toBe('knowledge');
    expect(ManagerType.REFLECTION).toBe('reflection');
    expect(ManagerType.SCHEDULER).toBe('scheduler');
    expect(ManagerType.INPUT).toBe('input');
    expect(ManagerType.OUTPUT).toBe('output');
    expect(ManagerType.AUTONOMY).toBe('autonomy');
  });

  it('should be usable in a map as keys', () => {
    const managerMap = new Map<string, string>();
    
    managerMap.set(ManagerType.MEMORY, 'Memory Manager');
    managerMap.set(ManagerType.PLANNING, 'Planning Manager');
    
    expect(managerMap.get(ManagerType.MEMORY)).toBe('Memory Manager');
    expect(managerMap.get(ManagerType.PLANNING)).toBe('Planning Manager');
  });

  it('should be usable in conditionals', () => {
    const managerType = ManagerType.MEMORY;
    
    let result = 'Unknown';
    
    if (managerType === ManagerType.MEMORY) {
      result = 'Memory';
    } else if (managerType === ManagerType.PLANNING) {
      result = 'Planning';
    }
    
    expect(result).toBe('Memory');
  });
}); 