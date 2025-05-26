/**
 * ThinkingProcessor.test.ts - Unit tests for ThinkingProcessor
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ThinkingProcessor } from '../ThinkingProcessor';
import type { AgentBase, MessageProcessingOptions } from '../../base/AgentBase.interface';

// Mock dependencies
const mockAgent = {
  id: 'test-agent-123',
  name: 'Test Agent',
  type: 'default',
  status: 'active',
  capabilities: [],
  managers: new Map(),
  getManager: vi.fn()
} as unknown as AgentBase;

// Helper function to create mock processing options
const createMockOptions = (metadata: Record<string, unknown> = {}): MessageProcessingOptions => ({
  priority: 'normal' as const,
  timeout: 30000,
  retryAttempts: 3,
  metadata
});

describe('ThinkingProcessor', () => {
  let processor: ThinkingProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new ThinkingProcessor(mockAgent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create processor instance', () => {
      expect(processor).toBeInstanceOf(ThinkingProcessor);
    });

    it('should have required methods', () => {
      expect(typeof processor.processThinking).toBe('function');
      expect(typeof processor.getCognitiveLoadMetrics).toBe('function');
      expect(typeof processor.getConfig).toBe('function');
      expect(typeof processor.updateConfig).toBe('function');
      expect(typeof processor.addStrategy).toBe('function');
      expect(typeof processor.getStrategies).toBe('function');
    });

    it('should return default cognitive load metrics initially', () => {
      const metrics = processor.getCognitiveLoadMetrics();
      
      expect(metrics).toHaveProperty('currentLoad');
      expect(metrics).toHaveProperty('maxLoad');
      expect(metrics).toHaveProperty('activeChains');
      expect(metrics).toHaveProperty('averageComplexity');
      expect(metrics.currentLoad).toBe(0);
    });

    it('should return default configuration', () => {
      const config = processor.getConfig();
      
      expect(config).toHaveProperty('enableReasoningChains');
      expect(config).toHaveProperty('enableCognitiveLoadBalancing');
      expect(config).toHaveProperty('maxConcurrentChains');
      expect(config.enableReasoningChains).toBe(true);
    });
  });

  describe('Thinking Processing', () => {
    it('should process thinking input successfully', async () => {
      const input = 'What is the best approach to solve this problem?';
      const options = createMockOptions();

      const result = await processor.processThinking(input, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reasoningChain');
      expect(result).toHaveProperty('finalConclusion');
      expect(result).toHaveProperty('confidence');
      expect(result.reasoningChain).toHaveProperty('steps');
      expect(Array.isArray(result.reasoningChain.steps)).toBe(true);
    });

    it('should handle empty input gracefully', async () => {
      const input = '';
      const options = createMockOptions();

      const result = await processor.processThinking(input, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('warnings');
    });

    it('should process complex reasoning scenarios', async () => {
      const complexInput = 'Analyze the trade-offs between multiple competing solutions with conflicting constraints and uncertain outcomes.';
      const options = createMockOptions({
        complexity: 'high',
        requireDeepAnalysis: true
      });

      const result = await processor.processThinking(complexInput, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reasoningChain');
      expect(result.reasoningChain).toHaveProperty('steps');
      expect(Array.isArray(result.reasoningChain.steps)).toBe(true);
    });

    it('should generate appropriate confidence scores', async () => {
      const input = 'Simple reasoning task';
      const options = createMockOptions();

      const result = await processor.processThinking(input, options);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.confidence).toBe('number');
    });

    it('should handle thinking with metadata', async () => {
      const input = 'Critical decision needed';
      const metadata = { priority: 'high', urgency: 'critical' };
      const options = createMockOptions(metadata);

      const result = await processor.processThinking(input, options);

      expect(result).toHaveProperty('reasoningChain');
      expect(result.reasoningChain).toHaveProperty('metadata');
    });
  });

  describe('Configuration Management', () => {
    it('should use provided configuration', () => {
      const config = {
        maxConcurrentChains: 5,
        enableReasoningChains: false,
        enableCognitiveLoadBalancing: false
      };

      const customProcessor = new ThinkingProcessor(mockAgent, config);

      expect(customProcessor.getConfig()).toEqual(expect.objectContaining(config));
    });

    it('should update configuration', () => {
      const newConfig = {
        maxConcurrentChains: 10,
        enableReasoningChains: false
      };

      processor.updateConfig(newConfig);

      expect(processor.getConfig()).toEqual(expect.objectContaining(newConfig));
    });

    it('should merge configuration updates', () => {
      const initialConfig = processor.getConfig();
      const update = { maxConcurrentChains: 15 };

      processor.updateConfig(update);

      const finalConfig = processor.getConfig();
      expect(finalConfig.maxConcurrentChains).toBe(15);
      expect(finalConfig.enableReasoningChains).toBe(initialConfig.enableReasoningChains);
    });
  });

  describe('Cognitive Load Management', () => {
    it('should track cognitive load metrics', async () => {
      await processor.processThinking('First thinking task');
      await processor.processThinking('Second thinking task');

      const metrics = processor.getCognitiveLoadMetrics();

      expect(metrics).toHaveProperty('currentLoad');
      expect(metrics).toHaveProperty('activeChains');
      expect(metrics).toHaveProperty('averageComplexity');
      expect(metrics).toHaveProperty('processingEfficiency');
    });

    it('should manage concurrent reasoning chains', async () => {
      const inputs = [
        'Task 1: Analyze problem A',
        'Task 2: Evaluate solution B', 
        'Task 3: Compare options C and D'
      ];

      const promises = inputs.map(input => processor.processThinking(input));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('reasoningChain');
      });
    });
  });

  describe('Strategy Management', () => {
    it('should allow adding custom thinking strategies', () => {
      const strategy = {
        name: 'test-strategy',
        enabled: true,
        priority: 1,
        applicableTypes: ['analysis'],
        execute: async (context: any) => ({
          id: 'test-chain',
          topic: 'test',
          steps: [],
          startTime: new Date(),
          status: 'completed' as const,
          confidence: 0.8,
          complexity: 1,
          metadata: {}
        })
      };

      expect(() => processor.addStrategy(strategy)).not.toThrow();
    });

    it('should list available strategies', () => {
      const strategies = processor.getStrategies();

      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should remove strategies', () => {
      const initialStrategies = processor.getStrategies();
      const strategyToRemove = initialStrategies[0];

      if (strategyToRemove) {
        const removed = processor.removeStrategy(strategyToRemove.name);
        expect(removed).toBe(true);

        const updatedStrategies = processor.getStrategies();
        expect(updatedStrategies.length).toBe(initialStrategies.length - 1);
      }
    });
  });

  describe('Chain Management', () => {
    it('should track active reasoning chains', async () => {
      const input = 'Long running analysis task';
      
      // Start processing but don't wait for completion
      const processingPromise = processor.processThinking(input);
      
      // Check active chains (might be 0 if processing is very fast)
      const activeChains = processor.getActiveChains();
      expect(Array.isArray(activeChains)).toBe(true);
      
      // Wait for completion
      await processingPromise;
    });

    it('should track completed reasoning chains', async () => {
      await processor.processThinking('Completed task 1');
      await processor.processThinking('Completed task 2');

      const completedChains = processor.getCompletedChains();
      expect(Array.isArray(completedChains)).toBe(true);
      expect(completedChains.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined input gracefully', async () => {
      const result1 = await processor.processThinking(null as unknown as string);
      const result2 = await processor.processThinking(undefined as unknown as string);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.errors.length).toBeGreaterThan(0);
    });

    it('should handle very long input', async () => {
      const longInput = 'x'.repeat(10000);
      
      const result = await processor.processThinking(longInput);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reasoningChain');
    });

    it('should handle special characters in input', async () => {
      const specialInput = '🤔 Complex thinking with émojis and spëcial chars: @#$%^&*()';

      const result = await processor.processThinking(specialInput);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reasoningChain');
    });

    it('should handle malformed options gracefully', async () => {
      const input = 'Test input';
      const malformedOptions = {
        invalidProperty: 'invalid'
      } as unknown as MessageProcessingOptions;

      const result = await processor.processThinking(input, malformedOptions);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('reasoningChain');
    });
  });

  describe('Cache Management', () => {
    it('should support cache operations', () => {
      expect(typeof processor.clearCache).toBe('function');
      
      // Should not throw when clearing cache
      expect(() => processor.clearCache()).not.toThrow();
    });

    it('should handle repeated identical inputs efficiently', async () => {
      const input = 'Repeated thinking task';
      
      const result1 = await processor.processThinking(input);
      const result2 = await processor.processThinking(input);

      expect(result1).toHaveProperty('success');
      expect(result2).toHaveProperty('success');
      expect(result1.finalConclusion).toBe(result2.finalConclusion);
    });
  });
});