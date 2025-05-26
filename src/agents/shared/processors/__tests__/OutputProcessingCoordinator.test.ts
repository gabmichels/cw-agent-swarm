/**
 * OutputProcessingCoordinator.test.ts - Unit tests for OutputProcessingCoordinator
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OutputProcessingCoordinator } from '../OutputProcessingCoordinator';
import type { AgentBase, AgentResponse } from '../../base/AgentBase.interface';

// Mock dependencies
const mockAgent = {
  id: 'test-agent-123',
  name: 'Test Agent',
  type: 'default',
  status: 'active',
  capabilities: [],
  managers: new Map()
} as unknown as AgentBase;

// Helper function to create mock AgentResponse
const createMockResponse = (content: string, metadata: Record<string, unknown> = {}): AgentResponse => ({
  content,
  memories: [],
  thoughts: [],
  metadata
});

describe('OutputProcessingCoordinator', () => {
  let coordinator: OutputProcessingCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new OutputProcessingCoordinator(mockAgent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create coordinator instance', () => {
      expect(coordinator).toBeInstanceOf(OutputProcessingCoordinator);
    });

    it('should have required methods', () => {
      expect(typeof coordinator.processOutput).toBe('function');
      expect(typeof coordinator.getStatistics).toBe('function');
      expect(typeof coordinator.getConfig).toBe('function');
      expect(typeof coordinator.updateConfig).toBe('function');
    });

    it('should return default statistics initially', () => {
      const stats = coordinator.getStatistics();
      
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successfulProcessed');
      expect(stats).toHaveProperty('failedProcessed');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats.totalProcessed).toBe(0);
    });

    it('should return default configuration', () => {
      const config = coordinator.getConfig();
      
      expect(config).toHaveProperty('enableFormatting');
      expect(config).toHaveProperty('enableValidation');
      expect(config).toHaveProperty('maxOutputLength');
      expect(config.enableFormatting).toBe(true);
    });
  });

  describe('Output Processing', () => {
    it('should process valid output successfully', async () => {
      const response = createMockResponse('test output');

      const result = await coordinator.processOutput(response);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processedContent');
      expect(result).toHaveProperty('originalContent');
      expect(result).toHaveProperty('validationResults');
      expect(result).toHaveProperty('errors');
      expect(result.originalContent).toBe(response.content);
    });

    it('should handle empty output based on configuration', async () => {
      const response = createMockResponse('');

      const result = await coordinator.processOutput(response);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      // Default config doesn't allow empty output
      expect(result.success).toBe(false);
    });

    it('should handle very long output', async () => {
      const longContent = 'x'.repeat(60000); // Exceeds default maxOutputLength
      const response = createMockResponse(longContent);
      
      const result = await coordinator.processOutput(response);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should process output with metadata', async () => {
      const metadata = { format: 'json', priority: 'high' };
      const response = createMockResponse('test output', metadata);

      const result = await coordinator.processOutput(response);

      expect(result.metadata).toHaveProperty('originalMetadata');
      expect(result.metadata.originalMetadata).toEqual(metadata);
    });
  });

  describe('Configuration Management', () => {
    it('should use provided configuration', () => {
      const config = {
        maxOutputLength: 1000,
        enableFormatting: false,
        enableValidation: false
      };

      const customCoordinator = new OutputProcessingCoordinator(mockAgent, config);

      expect(customCoordinator.getConfig()).toEqual(expect.objectContaining(config));
    });

    it('should update configuration', () => {
      const newConfig = {
        maxOutputLength: 2000,
        enableValidation: false
      };

      coordinator.updateConfig(newConfig);

      expect(coordinator.getConfig()).toEqual(expect.objectContaining(newConfig));
    });

    it('should merge configuration updates', () => {
      const initialConfig = coordinator.getConfig();
      const update = { maxOutputLength: 15000 };

      coordinator.updateConfig(update);

      const finalConfig = coordinator.getConfig();
      expect(finalConfig.maxOutputLength).toBe(15000);
      expect(finalConfig.enableFormatting).toBe(initialConfig.enableFormatting);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track processing metrics', async () => {
      await coordinator.processOutput(createMockResponse('test output 1'));
      await coordinator.processOutput(createMockResponse('test output 2'));

      const stats = coordinator.getStatistics();

      expect(stats.totalProcessed).toBeGreaterThan(0);
      expect(stats).toHaveProperty('successfulProcessed');
      expect(stats).toHaveProperty('failedProcessed');
      expect(stats).toHaveProperty('averageProcessingTime');
    });

    it('should track failed processing attempts', async () => {
      // Test with output that will fail validation
      const invalidOutput = 'x'.repeat(60000); // Very long output
      const response = createMockResponse(invalidOutput);

      await coordinator.processOutput(response);

      const stats = coordinator.getStatistics();

      expect(stats.totalProcessed).toBeGreaterThan(0);
      expect(stats.failedProcessed).toBeGreaterThan(0);
    });
  });

  describe('Formatting and Validation Rules', () => {
    it('should allow adding custom formatters', () => {
      const formatter = {
        name: 'test-formatter',
        enabled: true,
        priority: 1,
        supportedTypes: ['text'],
        format: async (content: string) => content.toUpperCase()
      };

      expect(() => coordinator.addFormatter(formatter)).not.toThrow();
    });

    it('should allow adding custom validation rules', () => {
      const rule = {
        name: 'test-rule',
        enabled: true,
        priority: 1,
        required: false,
        validate: async (content: string) => ({
          ruleName: 'test-rule',
          passed: content.length > 0,
          message: 'Content must not be empty',
          severity: 'error' as const
        })
      };

      expect(() => coordinator.addValidationRule(rule)).not.toThrow();
    });

    it('should list formatters and validation rules', () => {
      const formatters = coordinator.getFormatters();
      const validationRules = coordinator.getValidationRules();

      expect(Array.isArray(formatters)).toBe(true);
      expect(Array.isArray(validationRules)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in output', async () => {
      const specialContent = '🚀 Special chars: @#$%^&*()';
      const response = createMockResponse(specialContent);

      const result = await coordinator.processOutput(response);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processedContent');
    });

    it('should handle concurrent output processing', async () => {
      const responses = [
        createMockResponse('output1'),
        createMockResponse('output2'),
        createMockResponse('output3')
      ];
      
      const promises = responses.map(response => coordinator.processOutput(response));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('processedContent');
      });
    });

    it('should handle null/undefined content gracefully', async () => {
      const response1 = createMockResponse(null as unknown as string);
      const response2 = createMockResponse(undefined as unknown as string);

      const result1 = await coordinator.processOutput(response1);
      const result2 = await coordinator.processOutput(response2);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.errors.length).toBeGreaterThan(0);
    });
  });
}); 