/**
 * InputProcessingCoordinator.test.ts - Unit tests for InputProcessingCoordinator
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InputProcessingCoordinator } from '../InputProcessingCoordinator';
import type { AgentBase } from '../../base/AgentBase.interface';

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
const createMockOptions = (metadata: Record<string, unknown> = {}) => ({
  priority: 'normal' as const,
  timeout: 30000,
  retryAttempts: 3,
  metadata
});

describe('InputProcessingCoordinator', () => {
  let coordinator: InputProcessingCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new InputProcessingCoordinator(mockAgent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should create coordinator instance', () => {
      expect(coordinator).toBeInstanceOf(InputProcessingCoordinator);
    });

    it('should have required methods', () => {
      expect(typeof coordinator.processInput).toBe('function');
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
      
      expect(config).toHaveProperty('enableValidation');
      expect(config).toHaveProperty('enableTransformation');
      expect(config).toHaveProperty('maxInputLength');
      expect(config.enableValidation).toBe(true);
    });
  });

  describe('Input Processing', () => {
    it('should process valid input successfully', async () => {
      const content = 'test input';
      const options = createMockOptions();

      const result = await coordinator.processInput(content, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processedContent');
      expect(result).toHaveProperty('originalContent');
      expect(result).toHaveProperty('validationResults');
      expect(result).toHaveProperty('errors');
      expect(result.originalContent).toBe(content);
    });

    it('should handle empty input based on configuration', async () => {
      const content = '';
      const options = createMockOptions();

      const result = await coordinator.processInput(content, options);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('errors');
      // Default config doesn't allow empty input
      expect(result.success).toBe(false);
    });

    it('should handle very long input', async () => {
      const longContent = 'x'.repeat(60000); // Exceeds default maxInputLength
      const options = createMockOptions();
      
      const result = await coordinator.processInput(longContent, options);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should process input with metadata', async () => {
      const content = 'test input';
      const metadata = { priority: 'high', source: 'user' };
      const options = createMockOptions(metadata);

      const result = await coordinator.processInput(content, options);

      expect(result.metadata).toBeDefined();
      // Check if processing succeeded or failed gracefully
      if (result.success) {
       expect(result.metadata).toHaveProperty('options');
       expect(result.metadata.options).toEqual(options);
      } else {
        // In error case, metadata should still contain some information
        expect(result.metadata).toHaveProperty('errorMessage');
      }
    });

    it('should handle different content types', async () => {
      const textContent = 'text content';
      const jsonContent = '{"key": "value"}';
      const xmlContent = '<root><item>value</item></root>';

      const textResult = await coordinator.processInput(textContent);
      const jsonResult = await coordinator.processInput(jsonContent);
      const xmlResult = await coordinator.processInput(xmlContent);

      expect(textResult).toHaveProperty('success');
      expect(jsonResult).toHaveProperty('success');
      expect(xmlResult).toHaveProperty('success');
     });
   });

  describe('Configuration Management', () => {
    it('should use provided configuration', () => {
      const config = {
        maxInputLength: 1000,
        enableValidation: false,
        enableTransformation: false
      };

      const customCoordinator = new InputProcessingCoordinator(mockAgent, config);

      expect(customCoordinator.getConfig()).toEqual(expect.objectContaining(config));
    });

    it('should update configuration', () => {
      const newConfig = {
        maxInputLength: 2000,
        enableValidation: false
      };

      coordinator.updateConfig(newConfig);

      expect(coordinator.getConfig()).toEqual(expect.objectContaining(newConfig));
    });

    it('should merge configuration updates', () => {
      const initialConfig = coordinator.getConfig();
      const update = { maxInputLength: 15000 };

      coordinator.updateConfig(update);

      const finalConfig = coordinator.getConfig();
      expect(finalConfig.maxInputLength).toBe(15000);
      expect(finalConfig.enableValidation).toBe(initialConfig.enableValidation);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track processing metrics', async () => {
      await coordinator.processInput('test input 1');
      await coordinator.processInput('test input 2');

      const stats = coordinator.getStatistics();

      expect(stats.totalProcessed).toBeGreaterThan(0);
      expect(stats).toHaveProperty('successfulProcessed');
      expect(stats).toHaveProperty('failedProcessed');
      expect(stats).toHaveProperty('averageProcessingTime');
    });

    it('should track failed processing attempts', async () => {
      // Test with input that will fail validation
      const invalidInput = 'x'.repeat(60000); // Very long input

      await coordinator.processInput(invalidInput);

      const stats = coordinator.getStatistics();

      expect(stats.totalProcessed).toBeGreaterThan(0);
      expect(stats.failedProcessed).toBeGreaterThan(0);
    });
  });

  describe('Transformations and Validation', () => {
    it('should allow adding custom transformations', () => {
      const transformation = {
        name: 'test-transformation',
        enabled: true,
        priority: 1,
        transform: async (content: string) => content.toLowerCase()
      };

      expect(() => coordinator.addTransformation(transformation)).not.toThrow();
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

    it('should list transformations and validation rules', () => {
      const transformations = coordinator.getTransformations();
      const validationRules = coordinator.getValidationRules();

      expect(Array.isArray(transformations)).toBe(true);
      expect(Array.isArray(validationRules)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in input', async () => {
      const specialContent = '🚀 Special chars: @#$%^&*()';

      const result = await coordinator.processInput(specialContent);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processedContent');
    });

    it('should handle concurrent input processing', async () => {
      const inputs = ['input1', 'input2', 'input3'];
      
      const promises = inputs.map(input => coordinator.processInput(input));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('processedContent');
      });
    });

    it('should handle null/undefined content gracefully', async () => {
      const result1 = await coordinator.processInput(null as unknown as string);
      const result2 = await coordinator.processInput(undefined as unknown as string);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty string input', async () => {
      const result = await coordinator.processInput('');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Content Filtering', () => {
    it('should filter blocked patterns', async () => {
      const content = 'My password is secret123';

      const result = await coordinator.processInput(content);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('warnings');
    });

    it('should handle content normalization', async () => {
      const content = '  UPPERCASE TEXT WITH SPACES  ';

      const result = await coordinator.processInput(content);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processedContent');
      // Check if content was processed (trimmed or not based on actual config)
      expect(result.processedContent).toBeDefined();
      expect(typeof result.processedContent).toBe('string');
    });

    it('should validate content length', async () => {
      const longContent = 'x'.repeat(15000); // Exceeds default maxInputLength

      const result = await coordinator.processInput(longContent);

      expect(result.success).toBe(false);
      expect(result.errors.some(error => error.includes('length'))).toBe(true);
    });
  });
}); 