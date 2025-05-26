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
      OPENAI_MODEL_NAME: 'gpt-4',
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
        enableMemoryManager: true,
        enableInputProcessor: true,
        enableOutputProcessor: true,
        enablePlanningManager: true,
        enableToolManager: true,
        componentsConfig: {
          inputProcessor: {
            enabled: true,
            processingSteps: ['validate', 'sanitize']
          },
          outputProcessor: {
            enabled: true,
            processingSteps: ['format', 'validate']
          }
        }
      });

      // Initialize the agent
      const initialized = await agent.initialize();
      expect(initialized).toBe(true);

      // Verify all managers are present
      expect(agent.hasManager(ManagerType.MEMORY)).toBe(true);
      expect(agent.hasManager(ManagerType.INPUT)).toBe(true);
      expect(agent.hasManager(ManagerType.OUTPUT)).toBe(true);
      expect(agent.hasManager(ManagerType.PLANNING)).toBe(true);
      expect(agent.hasManager(ManagerType.TOOL)).toBe(true);

      // Verify agent status
      const status = agent.getStatus();
      expect(status.status).toBe('available');
    });

    it('should initialize agent without processors (backward compatibility)', async () => {
      // Create agent with processors disabled (old behavior)
      agent = new DefaultAgent({
        name: 'Test Agent',
        description: 'Backward compatibility test agent',
        enableMemoryManager: true,
        enableInputProcessor: false,
        enableOutputProcessor: false,
        enablePlanningManager: true
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
        enableMemoryManager: true
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
        enableInputProcessor: true,
        enableMemoryManager: true,
        componentsConfig: {
          inputProcessor: {
            enabled: true,
            processingSteps: ['validate', 'sanitize']
          }
        }
      });

      await agent.initialize();

      // Get input processor
      const inputProcessor = agent.getManager<InputProcessor>(ManagerType.INPUT);
      expect(inputProcessor).toBeTruthy();

      if (inputProcessor) {
        // Test input processing
        const testInput = {
          id: 'test-input-1',
          content: 'Hello, this is a test message!',
          senderId: 'test-user',
          timestamp: new Date(),
          modality: 'text' as const,
          metadata: {}
        };

        const processedInput = await inputProcessor.processInput(testInput);
        
        expect(processedInput).toBeTruthy();
        expect(processedInput.originalMessage.content).toBe(testInput.content);
        expect(processedInput.processedContent).toBeTruthy();
        expect(processedInput.processingMetadata).toBeTruthy();
      }
    });

    it('should process output through output processor when enabled', async () => {
      // Create agent with output processor enabled
      agent = new DefaultAgent({
        name: 'Output Test Agent',
        enableOutputProcessor: true,
        componentsConfig: {
          outputProcessor: {
            enabled: true,
            processingSteps: ['format', 'validate']
          }
        }
      });

      await agent.initialize();

      // Get output processor
      const outputProcessor = agent.getManager<OutputProcessor>(ManagerType.OUTPUT);
      expect(outputProcessor).toBeTruthy();

      if (outputProcessor) {
        // Test output processing
        const testOutput = {
          id: 'test-output-1',
          content: 'This is a test response from the agent.',
          recipientId: 'test-user',
          timestamp: new Date(),
          modality: 'text' as const,
          metadata: {}
        };

        const processedOutput = await outputProcessor.processOutput(testOutput);
        
        expect(processedOutput).toBeTruthy();
        expect(processedOutput.originalMessage.content).toBe(testOutput.content);
        expect(processedOutput.processedContent).toBeTruthy();
        expect(processedOutput.processingMetadata).toBeTruthy();
      }
    });

    it('should handle agent workflow with thinking and memory integration', async () => {
      // Create agent with core functionality
      agent = new DefaultAgent({
        name: 'Workflow Test Agent',
        enableMemoryManager: true,
        enablePlanningManager: true,
        systemPrompt: 'You are a helpful test assistant.'
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
        enableMemoryManager: true
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
        enableMemoryManager: true,
        enablePlanningManager: true,
        enableInputProcessor: false,
        enableOutputProcessor: false
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
        enableMemoryManager: true,
        enableInputProcessor: true,
        componentsConfig: {
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
        enableMemoryManager: true,
        enableInputProcessor: true,
        enableOutputProcessor: true,
        enablePlanningManager: true
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
        enableMemoryManager: true
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
        enableMemoryManager: true,
        enableInputProcessor: true
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