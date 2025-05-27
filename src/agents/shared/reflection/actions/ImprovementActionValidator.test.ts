/**
 * Unit tests for ImprovementActionValidator
 */

import { ImprovementActionValidator, ValidationError, BusinessRule } from './ImprovementActionValidator';
import { ImprovementAction } from '../interfaces/ReflectionInterfaces';

describe('ImprovementActionValidator', () => {
  let validator: ImprovementActionValidator;

  beforeEach(() => {
    validator = new ImprovementActionValidator();
  });

  describe('validateAction', () => {
    it('should validate a complete valid action', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Improve error handling',
        description: 'Add comprehensive error handling to the planning system with proper logging and recovery mechanisms',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.6,
        implementationSteps: [
          { description: 'Analyze current error patterns', status: 'pending' },
          { description: 'Design new error handling strategy', status: 'pending' },
          { description: 'Implement error recovery mechanisms', status: 'pending' }
        ]
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for missing required fields', async () => {
      const action: Partial<ImprovementAction> = {
        // Missing title, description, sourceInsightId
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.6
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('title is required');
      expect(result.errors).toContain('description is required');
      expect(result.errors).toContain('sourceInsightId is required');
    });

    it('should fail validation for invalid enum values', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Test action',
        description: 'Test description with sufficient length',
        sourceInsightId: 'insight-123',
        status: 'invalid-status' as any,
        priority: 'invalid-priority' as any,
        targetArea: 'invalid-area' as any,
        expectedImpact: 0.8,
        difficulty: 0.6
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid status'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid priority'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid target area'))).toBe(true);
    });

    it('should fail validation for out-of-range numeric values', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Test action',
        description: 'Test description with sufficient length',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 1.5, // Invalid range
        difficulty: -0.1 // Invalid range
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Expected impact must be between'))).toBe(true);
      expect(result.errors.some(e => e.includes('Difficulty must be between'))).toBe(true);
    });

    it('should generate warnings for edge cases', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Test', // Short title
        description: 'Short desc', // Short description
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.05, // Very low impact
        difficulty: 0.95 // Very high difficulty
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('Title is quite short'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Description is quite short'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Very low expected impact'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Very high difficulty'))).toBe(true);
    });
  });

  describe('validateActionUpdate', () => {
    it('should validate partial updates correctly', async () => {
      const updates: Partial<ImprovementAction> = {
        title: 'Updated title',
        expectedImpact: 0.9
      };

      const result = await validator.validateActionUpdate(updates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid update values', async () => {
      const updates: Partial<ImprovementAction> = {
        title: '', // Empty title
        expectedImpact: 2.0, // Invalid range
        status: 'invalid-status' as any
      };

      const result = await validator.validateActionUpdate(updates);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Title cannot be empty'))).toBe(true);
      expect(result.errors.some(e => e.includes('Expected impact must be between'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid status'))).toBe(true);
    });

    it('should not require fields that are not being updated', async () => {
      const updates: Partial<ImprovementAction> = {
        priority: 'low'
      };

      const result = await validator.validateActionUpdate(updates);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateImplementationSteps', () => {
    it('should validate valid implementation steps', async () => {
      const steps = [
        { description: 'Step 1: Analyze requirements', status: 'pending' as const },
        { description: 'Step 2: Design solution', status: 'pending' as const },
        { description: 'Step 3: Implement changes', status: 'pending' as const }
      ];

      const result = await validator.validateImplementationSteps(steps);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invalid step data', async () => {
      const steps = [
        { description: '', status: 'pending' as const }, // Empty description
        { description: 'Valid step', status: 'invalid-status' as any } // Invalid status
      ];

      const result = await validator.validateImplementationSteps(steps);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('must have a description'))).toBe(true);
      expect(result.errors.some(e => e.includes('Invalid step status'))).toBe(true);
    });

    it('should warn about long step descriptions', async () => {
      const longDescription = 'A'.repeat(250);
      const steps = [
        { description: longDescription, status: 'pending' as const }
      ];

      const result = await validator.validateImplementationSteps(steps);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('description is quite long'))).toBe(true);
    });

    it('should warn about duplicate step descriptions', async () => {
      const steps = [
        { description: 'Analyze requirements', status: 'pending' as const },
        { description: 'analyze requirements', status: 'pending' as const } // Similar description
      ];

      const result = await validator.validateImplementationSteps(steps);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('similar descriptions'))).toBe(true);
    });

    it('should fail validation for non-array input', async () => {
      const result = await validator.validateImplementationSteps('not-an-array' as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Implementation steps must be an array');
    });

    it('should warn about empty steps array', async () => {
      const result = await validator.validateImplementationSteps([]);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('No implementation steps provided'))).toBe(true);
    });
  });

  describe('business rules', () => {
    it('should apply default business rules', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'High impact action',
        description: 'This action has high expected impact but few implementation steps',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.9, // High impact
        difficulty: 0.3,
        implementationSteps: [
          { description: 'Single step', status: 'pending' }
        ] // Only one step for high impact action
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('should have at least 3 implementation steps'))).toBe(true);
    });

    it('should warn about critical priority with high difficulty', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Critical but difficult action',
        description: 'This action is critical priority but very difficult to implement',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'critical',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.9, // Very high difficulty for critical priority
        implementationSteps: []
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('should have lower difficulty'))).toBe(true);
    });

    it('should suggest reviewing low impact-to-difficulty ratio', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Low value action',
        description: 'This action has low impact relative to its difficulty',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'low',
        targetArea: 'planning',
        expectedImpact: 0.2, // Low impact
        difficulty: 0.8, // High difficulty
        implementationSteps: []
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.suggestions.some(s => s.includes('sufficient value for the effort'))).toBe(true);
    });
  });

  describe('custom business rules', () => {
    it('should allow adding custom business rules', async () => {
      const customRule: BusinessRule = {
        id: 'custom-rule',
        name: 'Custom Rule',
        description: 'A custom validation rule',
        severity: 'error',
        category: 'custom',
        validate: async (action) => {
          const errors: string[] = [];
          if (action.title && action.title.includes('forbidden')) {
            errors.push('Title cannot contain forbidden words');
          }
          return {
            isValid: errors.length === 0,
            errors,
            warnings: [],
            suggestions: []
          };
        }
      };

      validator.addBusinessRule(customRule);

      const action: Partial<ImprovementAction> = {
        title: 'This contains forbidden word',
        description: 'Test description with sufficient length',
        sourceInsightId: 'insight-123',
        status: 'suggested',
        priority: 'high',
        targetArea: 'planning',
        expectedImpact: 0.8,
        difficulty: 0.6
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title cannot contain forbidden words');
    });

    it('should allow removing business rules', async () => {
      const rules = validator.getBusinessRules();
      const initialCount = rules.length;

      const ruleToRemove = rules[0];
      const removed = validator.removeBusinessRule(ruleToRemove.id);

      expect(removed).toBe(true);
      expect(validator.getBusinessRules()).toHaveLength(initialCount - 1);
    });

    it('should return false when removing non-existent rule', async () => {
      const removed = validator.removeBusinessRule('non-existent-rule');
      expect(removed).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', async () => {
      const customValidator = new ImprovementActionValidator({
        maxTitleLength: 50,
        maxDescriptionLength: 200,
        maxImplementationSteps: 5,
        minExpectedImpact: 0.1,
        maxExpectedImpact: 0.9
      });

      const action: Partial<ImprovementAction> = {
        title: 'A'.repeat(60), // Exceeds custom max
        description: 'B'.repeat(250), // Exceeds custom max
        sourceInsightId: 'insight-123',
        expectedImpact: 0.95 // Exceeds custom max
      };

      const result = await customValidator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Title too long'))).toBe(true);
      expect(result.errors.some(e => e.includes('Description too long'))).toBe(true);
      expect(result.errors.some(e => e.includes('Expected impact must be between'))).toBe(true);
    });

    it('should use custom required fields', async () => {
      const customValidator = new ImprovementActionValidator({
        requiredFields: ['title', 'priority'] // Only title and priority required
      });

      const action: Partial<ImprovementAction> = {
        title: 'Test action',
        priority: 'high'
        // Missing description and sourceInsightId, but they're not required in custom config
      };

      const result = await customValidator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getValidationStats', () => {
    it('should return validation statistics', async () => {
      const stats = validator.getValidationStats();

      expect(stats).toHaveProperty('totalBusinessRules');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('ruleCategories');
      expect(typeof stats.totalBusinessRules).toBe('number');
      expect(stats.totalBusinessRules).toBeGreaterThan(0);
    });

    it('should categorize business rules correctly', async () => {
      const stats = validator.getValidationStats();
      const categories = stats.ruleCategories as Record<string, number>;

      expect(categories).toHaveProperty('quality');
      expect(categories).toHaveProperty('feasibility');
      expect(categories).toHaveProperty('optimization');
      expect(Object.values(categories).every(count => count > 0)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle business rule execution errors gracefully', async () => {
      const faultyRule: BusinessRule = {
        id: 'faulty-rule',
        name: 'Faulty Rule',
        description: 'A rule that throws an error',
        severity: 'error',
        category: 'test',
        validate: async () => {
          throw new Error('Rule execution failed');
        }
      };

      validator.addBusinessRule(faultyRule);

      const action: Partial<ImprovementAction> = {
        title: 'Test action',
        description: 'Test description with sufficient length',
        sourceInsightId: 'insight-123'
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Business rule \'Faulty Rule\' failed'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined and null values gracefully', async () => {
      const action: Partial<ImprovementAction> = {
        title: undefined,
        description: null as any,
        sourceInsightId: '',
        expectedImpact: undefined,
        difficulty: null as any
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle very long strings', async () => {
      const veryLongTitle = 'A'.repeat(1000);
      const veryLongDescription = 'B'.repeat(10000);

      const action: Partial<ImprovementAction> = {
        title: veryLongTitle,
        description: veryLongDescription,
        sourceInsightId: 'insight-123'
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Title too long'))).toBe(true);
      expect(result.errors.some(e => e.includes('Description too long'))).toBe(true);
    });

    it('should handle special characters in strings', async () => {
      const action: Partial<ImprovementAction> = {
        title: 'Test with émojis 🚀 and spëcial chars',
        description: 'Description with newlines\nand tabs\t and unicode: ñáéíóú',
        sourceInsightId: 'insight-123'
      };

      const result = await validator.validateAction(action);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
}); 