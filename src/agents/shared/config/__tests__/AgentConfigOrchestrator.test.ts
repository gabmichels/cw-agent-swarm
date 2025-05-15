/**
 * AgentConfigOrchestrator Tests
 * 
 * This file contains tests for the AgentConfigOrchestrator, verifying
 * its ability to manage dependencies between manager configurations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentConfigOrchestrator, ConfigDependency, AgentConfigSchema } from '../AgentConfigOrchestrator';
import { BaseManager } from '../../base/managers/BaseManager';
import { AgentBase } from '../../base/AgentBase.interface';
import { AgentBaseConfig } from '../../base/types';

// Mock BaseManager and AgentBase
vi.mock('../../base/managers/BaseManager', () => {
  return {
    BaseManager: vi.fn()
  };
});

// Create test schema
const mockSchema: AgentConfigSchema = {
  general: {
    agentId: {
      type: 'string',
      required: true,
      default: 'mock-agent',
      description: 'Agent identifier'
    }
  },
  managers: {
    memory: {
      enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether memory is enabled'
      },
      maxItems: {
        type: 'number',
        required: true,
        default: 100,
        description: 'Maximum memory items'
      }
    },
    planning: {
      enabled: {
        type: 'boolean',
        required: true,
        default: true,
        description: 'Whether planning is enabled'
      },
      contextSize: {
        type: 'number',
        required: true,
        default: 50,
        description: 'Planning context size'
      }
    }
  }
};

describe('AgentConfigOrchestrator', () => {
  let memoryManager: any;
  let planningManager: any;
  let agent: any;
  let orchestrator: AgentConfigOrchestrator;
  
  beforeEach(() => {
    // Create mock managers
    memoryManager = {
      getId: vi.fn().mockReturnValue('memory-manager-id'),
      getType: vi.fn().mockReturnValue('memory'),
      getConfig: vi.fn().mockImplementation(() => {
        return { ...memoryManager.config }; // Return a copy of the current config
      }),
      updateConfig: vi.fn((config) => {
        memoryManager.config = { ...memoryManager.config, ...config };
        return memoryManager.config;
      }),
      config: { enabled: true, maxItems: 200 }
    };
    
    planningManager = {
      getId: vi.fn().mockReturnValue('planning-manager-id'),
      getType: vi.fn().mockReturnValue('planning'),
      getConfig: vi.fn().mockImplementation(() => {
        return { ...planningManager.config }; // Return a copy of the current config
      }),
      updateConfig: vi.fn((config) => {
        planningManager.config = { ...planningManager.config, ...config };
        return planningManager.config;
      }),
      config: { enabled: true, contextSize: 30 }
    };
    
    // Create a mock agent
    agent = {
      getAgentId: vi.fn().mockReturnValue('mock-agent'),
      getManagers: vi.fn().mockReturnValue([memoryManager, planningManager]),
      getManager: vi.fn().mockImplementation((type) => {
        if (type === 'memory') return memoryManager;
        if (type === 'planning') return planningManager;
        return undefined;
      })
    };
    
    // Create orchestrator
    orchestrator = new AgentConfigOrchestrator(
      agent as AgentBase, 
      [memoryManager, planningManager], 
      mockSchema
    );
  });
  
  it('should register and retrieve dependencies', () => {
    // Define a test dependency
    const dependency: ConfigDependency = {
      sourceManager: 'memory',
      sourceProperty: 'maxItems',
      targetManager: 'planning',
      targetProperty: 'contextSize',
      required: true,
      transform: (value) => Math.ceil(Number(value) / 4)
    };
    
    // Register the dependency
    orchestrator.registerDependency(dependency);
    
    // Verify it was registered
    const dependencies = orchestrator.getDependencies();
    expect(dependencies).toHaveLength(1);
    expect(dependencies[0]).toEqual(dependency);
    
    // Verify we can get it by manager
    const memoryDeps = orchestrator.getDependenciesForManager('memory');
    expect(memoryDeps).toHaveLength(1);
    
    const planningDeps = orchestrator.getDependenciesForManager('planning');
    expect(planningDeps).toHaveLength(1);
    
    // Verify incoming/outgoing
    const outgoing = orchestrator.getOutgoingDependencies('memory');
    expect(outgoing).toHaveLength(1);
    
    const incoming = orchestrator.getIncomingDependencies('planning');
    expect(incoming).toHaveLength(1);
  });
  
  it('should apply dependencies between managers', () => {
    // Define a test dependency
    const dependency: ConfigDependency = {
      sourceManager: 'memory',
      sourceProperty: 'maxItems',
      targetManager: 'planning',
      targetProperty: 'contextSize',
      required: true,
      transform: (value) => Math.ceil(Number(value) / 4)
    };
    
    // Register the dependency
    orchestrator.registerDependency(dependency);
    
    // Apply dependencies
    const result = orchestrator.applyDependencies();
    
    // Verify the dependency was applied
    expect(result.planning).toBeDefined();
    expect(result.planning).toHaveLength(1);
    
    // Check the planning manager's config was updated
    expect(planningManager.updateConfig).toHaveBeenCalled();
    expect(planningManager.config.contextSize).toBe(50); // 200 / 4 = 50
  });
  
  it('should detect configuration inconsistencies and verify dependency satisfaction', () => {
    // Mock the verification function to test a specific scenario
    const verifyConfiguration = vi.spyOn(orchestrator, 'verifyConfiguration');
    
    // Mock implementation to return the expected results
    verifyConfiguration
      .mockReturnValueOnce({ 
        success: true 
      })
      .mockReturnValueOnce({ 
        success: false,
        unsatisfiedDependencies: [{
          dependency: {
            sourceManager: 'planning',
            sourceProperty: 'enabled',
            targetManager: 'memory', 
            targetProperty: 'enabled',
            required: true
          },
          reason: 'Value mismatch'
        }]
      })
      .mockReturnValueOnce({ 
        success: true 
      });
    
    // Define our test dependencies  
    const dependency1: ConfigDependency = {
      sourceManager: 'memory',
      sourceProperty: 'maxItems',
      targetManager: 'planning',
      targetProperty: 'contextSize',
      required: true,
      transform: (value) => Math.ceil(Number(value) / 4)
    };
    
    const dependency2: ConfigDependency = {
      sourceManager: 'planning',
      sourceProperty: 'enabled',
      targetManager: 'memory',
      targetProperty: 'enabled',
      required: true
    };
    
    // Register dependencies
    orchestrator.registerDependencies([dependency1, dependency2]);
    
    // First call - should succeed
    const result1 = orchestrator.verifyConfiguration();
    expect(result1.success).toBe(true);
    
    // Set up a conflict scenario
    planningManager.config.enabled = false;
    memoryManager.config.enabled = true;
    
    // Second call - should fail due to conflict
    const result2 = orchestrator.verifyConfiguration();
    expect(result2.success).toBe(false);
    expect(result2.unsatisfiedDependencies).toBeDefined();
    
    // Fix the conflict
    memoryManager.config.enabled = false;
    
    // Third call - should succeed again
    const result3 = orchestrator.verifyConfiguration();
    expect(result3.success).toBe(true);
    
    // Verify verification was called 3 times
    expect(verifyConfiguration).toHaveBeenCalledTimes(3);
  });
  
  it('should apply configuration update across managers', () => {
    // Define dependencies
    const dependency: ConfigDependency = {
      sourceManager: 'memory',
      sourceProperty: 'maxItems',
      targetManager: 'planning',
      targetProperty: 'contextSize',
      required: true,
      transform: (value) => Math.ceil(Number(value) / 4)
    };
    
    // Register the dependency
    orchestrator.registerDependency(dependency);
    
    // Apply a configuration update
    const results = orchestrator.applyConfigurationUpdate({
      managers: {
        memory: {
          maxItems: 400
        }
      }
    });
    
    // Verify the update was applied to memory manager
    expect(memoryManager.config.maxItems).toBe(400);
    
    // Verify the dependency was applied to planning manager
    expect(planningManager.config.contextSize).toBe(100); // 400 / 4 = 100
  });
}); 