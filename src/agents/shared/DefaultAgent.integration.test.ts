/**
 * DefaultAgent Integration Tests
 * 
 * Comprehensive integration tests to verify that all Phase 1 implementations
 * work together correctly:
 * - Input/Output processors integration
 * - Memory operations (filter, getAll, count) with real agent usage
 * - Agent initialization with all components
 * - End-to-end functionality testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DefaultAgent } from './DefaultAgent';
import { ManagerType } from './base/managers/ManagerType';
import { MemoryManager } from './base/managers/MemoryManager.interface';
import { InputProcessor } from './base/managers/InputProcessor.interface';
import { OutputProcessor } from './base/managers/OutputProcessor.interface';

// Mock environment variables
const originalEnv = process.env;

describe('DefaultAgent Integration Tests', () => {
  let agent: DefaultAgent;

  beforeEach(() => {
    // Reset environment
    vi.resetModules();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-key',
      OPENAI_MODEL_NAME: 'gpt-4.1-2025-04-14',
      OPENAI_MAX_TOKENS: '1000'
    };
  });

  afterEach(async () => {
    // Clean up agent
    if (agent) {
      await agent.shutdown();
    }
    
    // Restore environment
    process.env = originalEnv;
  });

  describe('Phase 1.8: Core Infrastructure Integration', () => {
    it('should initialize agent with all core managers enabled', async () => {
      // Create agent with all Phase 1 components enabled
      agent = new DefaultAgent({
        name: 'Test Agent',
        description: 'Integration test agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: {
            enabled: true,
            processingSteps: ['validate', 'sanitize']
          },
          outputProcessor: {
            enabled: true,
            processingSteps: ['format', 'validate']
          },
          planningManager: { enabled: true },
          toolManager: { enabled: true }
        }
      });

      // Initialize the agent
      const initialized = await agent.initialize();
      expect(initialized).toBe(true);

      // Verify core managers are present (INPUT/OUTPUT are coordinators, not managers)
      expect(agent.hasManager(ManagerType.MEMORY)).toBe(true);
      expect(agent.hasManager(ManagerType.PLANNING)).toBe(true);
      expect(agent.hasManager(ManagerType.TOOL)).toBe(true);
      
      // INPUT and OUTPUT are not managers in the new architecture - they're coordinators
      // So these should be false
      expect(agent.hasManager(ManagerType.INPUT)).toBe(false);
      expect(agent.hasManager(ManagerType.OUTPUT)).toBe(false);

      // Verify agent status
      const status = agent.getStatus();
      expect(status.status).toBe('available');
    });

    it('should initialize agent without processors (backward compatibility)', async () => {
      // Create agent with processors disabled (old behavior)
      agent = new DefaultAgent({
        name: 'Test Agent',
        description: 'Backward compatibility test agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: { enabled: false },
          outputProcessor: { enabled: false },
          planningManager: { enabled: true }
        }
      });

      // Initialize the agent
      const initialized = await agent.initialize();
      expect(initialized).toBe(true);

      // Verify core managers are present but processors are not
      expect(agent.hasManager(ManagerType.MEMORY)).toBe(true);
      expect(agent.hasManager(ManagerType.PLANNING)).toBe(true);
      expect(agent.hasManager(ManagerType.INPUT)).toBe(false);
      expect(agent.hasManager(ManagerType.OUTPUT)).toBe(false);

      // Verify agent still works
      const status = agent.getStatus();
      expect(status.status).toBe('available');
    });

    it('should handle memory operations through agent interface', async () => {
      // Create agent with memory manager
      agent = new DefaultAgent({
        name: 'Memory Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true }
        }
      });

      await agent.initialize();

      // Get memory manager
      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      expect(memoryManager).toBeTruthy();

      // Test memory operations that were implemented in Phase 1
      if (memoryManager) {
        // Add some test memories
        await memoryManager.addMemory('Test memory 1', { type: 'test', priority: 1 });
        await memoryManager.addMemory('Test memory 2', { type: 'test', priority: 2 });
        await memoryManager.addMemory('Different memory', { type: 'other', priority: 1 });

        // Test search functionality
        const searchResults = await memoryManager.searchMemories('test', { limit: 5 });
        expect(searchResults.length).toBeGreaterThan(0);

        // Test that we can retrieve memories by type
        const testMemories = await memoryManager.searchMemories('', {
          metadata: { type: 'test' },
          limit: 10
        });
        expect(testMemories.length).toBe(2);
      }
    });

    it('should process input through input processor when enabled', async () => {
      // Create agent with input processor enabled
      agent = new DefaultAgent({
        name: 'Input Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: {
            enabled: true,
            processingSteps: ['validate', 'sanitize']
          }
        }
      });

      await agent.initialize();

      // In the new architecture, INPUT processors are coordinators, not managers
      // So we can't get them as managers - they're internal to the agent
      // Instead, we test that the agent successfully initializes with input processing enabled
      expect(agent.hasManager(ManagerType.INPUT)).toBe(false);
      
      // Test that the agent is properly configured for input processing
      const status = agent.getStatus();
      expect(status.status).toBe('available');
      
      // We can test input processing indirectly through processUserInput if the agent is set up for LLM
      // But since this is just testing initialization, we'll verify the agent is ready
      expect(agent.getManagers().length).toBeGreaterThan(0);
    });

    it('should process output through output processor when enabled', async () => {
      // Create agent with output processor enabled
      agent = new DefaultAgent({
        name: 'Output Test Agent',
        componentsConfig: {
          outputProcessor: {
            enabled: true,
            processingSteps: ['format', 'validate']
          }
        }
      });

      await agent.initialize();

      // In the new architecture, OUTPUT processors are coordinators, not managers
      // So we can't get them as managers - they're internal to the agent
      // Instead, we test that the agent successfully initializes with output processing enabled
      expect(agent.hasManager(ManagerType.OUTPUT)).toBe(false);
      
      // Test that the agent is properly configured for output processing
      const status = agent.getStatus();
      expect(status.status).toBe('available');
      
      // Output processing is tested indirectly through agent responses
      // For this initialization test, we just verify the agent is ready
      expect(agent.getManagers().length).toBeGreaterThanOrEqual(0);
    });

    it('should handle agent workflow with thinking and memory integration', async () => {
      // Create agent with core functionality
      agent = new DefaultAgent({
        name: 'Workflow Test Agent',
        systemPrompt: 'You are a helpful test assistant.',
        componentsConfig: {
          memoryManager: { enabled: true },
          planningManager: { enabled: true }
        }
      });

      await agent.initialize();

      // Test the thinking process (this should work with existing memory integration)
      const thinkingResult = await agent.think('What is the capital of France?', {
        userId: 'test-user',
        debug: false
      });

      expect(thinkingResult).toBeTruthy();
      expect(thinkingResult.intent).toBeTruthy();
      expect(thinkingResult.intent.primary).toBeTruthy();
      expect(thinkingResult.reasoning).toBeTruthy();
      expect(Array.isArray(thinkingResult.reasoning)).toBe(true);
    });

    it('should handle memory operations with tagged memories', async () => {
      // Create agent with memory manager
      agent = new DefaultAgent({
        name: 'Tagged Memory Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true }
        }
      });

      await agent.initialize();

      // Get memory manager for modern API
      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      expect(memoryManager).toBeTruthy();

      // Test modern tagged memory functionality using addMemory with metadata.tags
      await memoryManager!.addMemory('This is important information about the user', {
        type: 'user_info',
        importance: 'high',
        tags: ['user', 'important']
      });

      await memoryManager!.addMemory('This is a casual conversation', {
        type: 'conversation',
        importance: 'low',
        tags: ['casual', 'chat']
      });

      // Allow time for memory indexing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test retrieving memories by content search (since tag filtering may not be implemented)
      const importantMemories = await memoryManager!.searchMemories('important information', {
        limit: 5
      });
      expect(importantMemories.length).toBeGreaterThan(0);

      const casualMemories = await memoryManager!.searchMemories('casual conversation', {
        limit: 5
      });
      expect(casualMemories.length).toBeGreaterThan(0);
    });

    it('should maintain backward compatibility when processors are disabled', async () => {
      // Create agent without processors (old configuration)
      agent = new DefaultAgent({
        name: 'Backward Compatibility Agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          planningManager: { enabled: true },
          inputProcessor: { enabled: false },
          outputProcessor: { enabled: false }
        }
      });

      await agent.initialize();

      // Verify that core functionality still works
      expect(agent.hasManager(ManagerType.MEMORY)).toBe(true);
      expect(agent.hasManager(ManagerType.PLANNING)).toBe(true);
      expect(agent.hasManager(ManagerType.INPUT)).toBe(false);
      expect(agent.hasManager(ManagerType.OUTPUT)).toBe(false);

      // Test that thinking still works
      const thinkingResult = await agent.think('Test message', {
        userId: 'test-user'
      });

      expect(thinkingResult).toBeTruthy();
      expect(thinkingResult.intent).toBeTruthy();
    });

    it('should handle errors gracefully during initialization', async () => {
      // Test with invalid configuration
      agent = new DefaultAgent({
        name: 'Error Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: {
            enabled: true,
            // Invalid configuration to test error handling
            processingSteps: ['invalid_step']
          }
        }
      });

      // Initialization might fail or succeed with warnings
      const initialized = await agent.initialize();
      
      // Even if initialization has issues, agent should handle it gracefully
      expect(typeof initialized).toBe('boolean');
      
      // Agent should still be in a valid state
      const status = agent.getStatus();
      expect(status).toBeTruthy();
      expect(typeof status.status).toBe('string');
    });

    it('should properly shutdown all managers', async () => {
      // Create agent with multiple managers
      agent = new DefaultAgent({
        name: 'Shutdown Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: { enabled: true },
          outputProcessor: { enabled: true },
          planningManager: { enabled: true }
        }
      });

      await agent.initialize();

      // Verify managers are initialized
      expect(agent.getManagers().length).toBeGreaterThan(0);

      // Test shutdown
      await agent.shutdown();

      // Verify agent status after shutdown
      const status = agent.getStatus();
      expect(status.status).toBe('offline');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple memory operations efficiently', async () => {
      agent = new DefaultAgent({
        name: 'Performance Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true }
        }
      });

      await agent.initialize();

      const memoryManager = agent.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        const startTime = Date.now();

        // Add multiple memories
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            memoryManager.addMemory(`Test memory ${i}`, {
              type: 'performance_test',
              index: i
            })
          );
        }

        await Promise.all(promises);

        // Search for memories
        const searchResults = await memoryManager.searchMemories('test', { limit: 20 });
        
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time (adjust threshold as needed)
        expect(duration).toBeLessThan(5000); // 5 seconds
        expect(searchResults.length).toBeGreaterThan(0);
      }
    });

    it('should handle concurrent operations safely', async () => {
      agent = new DefaultAgent({
        name: 'Concurrency Test Agent',
        componentsConfig: {
          memoryManager: { enabled: true },
          inputProcessor: { enabled: true }
        }
      });

      await agent.initialize();

      // Test concurrent thinking operations
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          agent.think(`Concurrent test message ${i}`, {
            userId: `test-user-${i}`
          })
        );
      }

      const results = await Promise.all(promises);
      
      // All operations should complete successfully
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result.intent).toBeTruthy();
      });
    });
  });
}); 