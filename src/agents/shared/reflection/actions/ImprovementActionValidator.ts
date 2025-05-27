/**
 * Improvement Action Validator
 * 
 * Handles action data validation, business rule enforcement, constraint checking,
 * and quality assurance for improvement actions. Extracted from DefaultReflectionManager.
 */

import { 
  ActionValidator as IActionValidator,
  ImprovementAction,
  ValidationResult
} from '../interfaces/ReflectionInterfaces';

/**
 * Error class for validation errors
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Configuration for improvement action validation
 */
export interface ImprovementActionValidatorConfig {
  maxTitleLength?: number;
  maxDescriptionLength?: number;
  maxImplementationSteps?: number;
  minExpectedImpact?: number;
  maxExpectedImpact?: number;
  minDifficulty?: number;
  maxDifficulty?: number;
  requiredFields?: (keyof ImprovementAction)[];
  businessRules?: BusinessRule[];
}

/**
 * Business rule interface
 */
export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  validate: (action: Partial<ImprovementAction>) => Promise<ValidationResult>;
  severity: 'error' | 'warning' | 'info';
  category: string;
}

/**
 * Implementation of ImprovementActionValidator interface
 */
export class ImprovementActionValidator implements IActionValidator {
  private readonly config: Required<ImprovementActionValidatorConfig>;
  private readonly businessRules: Map<string, BusinessRule> = new Map();

  constructor(config: ImprovementActionValidatorConfig = {}) {
    this.config = {
      maxTitleLength: config.maxTitleLength || 100,
      maxDescriptionLength: config.maxDescriptionLength || 1000,
      maxImplementationSteps: config.maxImplementationSteps || 20,
      minExpectedImpact: config.minExpectedImpact || 0,
      maxExpectedImpact: config.maxExpectedImpact || 1,
      minDifficulty: config.minDifficulty || 0,
      maxDifficulty: config.maxDifficulty || 1,
      requiredFields: config.requiredFields || ['title', 'description', 'sourceInsightId'],
      businessRules: config.businessRules || []
    };

    // Register default business rules
    this.registerDefaultBusinessRules();

    // Register custom business rules
    this.config.businessRules.forEach(rule => {
      this.businessRules.set(rule.id, rule);
    });
  }

  /**
   * Validate a complete action
   */
  async validateAction(action: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic field validation
    const basicValidation = await this.validateBasicFields(action);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);
    suggestions.push(...basicValidation.suggestions);

    // Business rules validation
    const businessValidation = await this.checkBusinessRules(action);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);
    suggestions.push(...businessValidation.suggestions);

    // Implementation steps validation
    if (action.implementationSteps) {
      const stepsValidation = await this.validateImplementationSteps(action.implementationSteps);
      errors.push(...stepsValidation.errors);
      warnings.push(...stepsValidation.warnings);
      suggestions.push(...stepsValidation.suggestions);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate action updates (partial validation)
   */
  async validateActionUpdate(updates: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Only validate fields that are being updated
    if (updates.title !== undefined) {
      const titleValidation = this.validateTitle(updates.title);
      errors.push(...titleValidation.errors);
      warnings.push(...titleValidation.warnings);
    }

    if (updates.description !== undefined) {
      const descValidation = this.validateDescription(updates.description);
      errors.push(...descValidation.errors);
      warnings.push(...descValidation.warnings);
    }

    if (updates.expectedImpact !== undefined) {
      const impactValidation = this.validateExpectedImpact(updates.expectedImpact);
      errors.push(...impactValidation.errors);
      warnings.push(...impactValidation.warnings);
    }

    if (updates.difficulty !== undefined) {
      const difficultyValidation = this.validateDifficulty(updates.difficulty);
      errors.push(...difficultyValidation.errors);
      warnings.push(...difficultyValidation.warnings);
    }

    if (updates.status !== undefined) {
      const statusValidation = this.validateStatus(updates.status);
      errors.push(...statusValidation.errors);
    }

    if (updates.priority !== undefined) {
      const priorityValidation = this.validatePriority(updates.priority);
      errors.push(...priorityValidation.errors);
    }

    if (updates.targetArea !== undefined) {
      const targetAreaValidation = this.validateTargetArea(updates.targetArea);
      errors.push(...targetAreaValidation.errors);
    }

    if (updates.implementationSteps !== undefined) {
      const stepsValidation = await this.validateImplementationSteps(updates.implementationSteps);
      errors.push(...stepsValidation.errors);
      warnings.push(...stepsValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Check business rules
   */
  async checkBusinessRules(action: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    for (const rule of this.businessRules.values()) {
      try {
        const result = await rule.validate(action);
        
        if (!result.isValid) {
          switch (rule.severity) {
            case 'error':
              errors.push(...result.errors);
              break;
            case 'warning':
              warnings.push(...result.errors);
              break;
            case 'info':
              suggestions.push(...result.errors);
              break;
          }
        }
        
        warnings.push(...result.warnings);
        suggestions.push(...result.suggestions);
      } catch (error) {
        errors.push(`Business rule '${rule.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate implementation steps
   */
  async validateImplementationSteps(steps: ImprovementAction['implementationSteps']): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!Array.isArray(steps)) {
      errors.push('Implementation steps must be an array');
      return { isValid: false, errors, warnings, suggestions };
    }

    if (steps.length > this.config.maxImplementationSteps) {
      errors.push(`Too many implementation steps (${steps.length}), maximum allowed: ${this.config.maxImplementationSteps}`);
    }

    if (steps.length === 0) {
      warnings.push('No implementation steps provided - consider adding steps for better tracking');
    }

    steps.forEach((step, index) => {
      if (!step.description || step.description.trim().length === 0) {
        errors.push(`Implementation step ${index + 1} must have a description`);
      }

      if (step.description && step.description.length > 200) {
        warnings.push(`Implementation step ${index + 1} description is quite long (${step.description.length} chars)`);
      }

      const validStatuses = ['pending', 'completed', 'failed'];
      if (step.status && !validStatuses.includes(step.status)) {
        errors.push(`Invalid step status at index ${index + 1}: ${step.status}`);
      }
    });

    // Check for duplicate descriptions
    const descriptions = steps.map(s => s.description?.toLowerCase().trim()).filter(Boolean);
    const duplicates = descriptions.filter((desc, index) => descriptions.indexOf(desc) !== index);
    if (duplicates.length > 0) {
      warnings.push('Some implementation steps have similar descriptions - consider making them more specific');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Add a custom business rule
   */
  addBusinessRule(rule: BusinessRule): void {
    this.businessRules.set(rule.id, rule);
  }

  /**
   * Remove a business rule
   */
  removeBusinessRule(ruleId: string): boolean {
    return this.businessRules.delete(ruleId);
  }

  /**
   * Get all business rules
   */
  getBusinessRules(): BusinessRule[] {
    return Array.from(this.businessRules.values());
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): Record<string, unknown> {
    return {
      totalBusinessRules: this.businessRules.size,
      config: this.config,
      ruleCategories: this.getBusinessRulesByCategory()
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateBasicFields(action: Partial<ImprovementAction>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Required fields validation
    for (const field of this.config.requiredFields) {
      if (!action[field] || (typeof action[field] === 'string' && (action[field] as string).trim().length === 0)) {
        errors.push(`${field} is required`);
      }
    }

    // Field-specific validation
    if (action.title !== undefined) {
      const titleValidation = this.validateTitle(action.title);
      errors.push(...titleValidation.errors);
      warnings.push(...titleValidation.warnings);
    }

    if (action.description !== undefined) {
      const descValidation = this.validateDescription(action.description);
      errors.push(...descValidation.errors);
      warnings.push(...descValidation.warnings);
    }

    if (action.expectedImpact !== undefined) {
      const impactValidation = this.validateExpectedImpact(action.expectedImpact);
      errors.push(...impactValidation.errors);
      warnings.push(...impactValidation.warnings);
    }

    if (action.difficulty !== undefined) {
      const difficultyValidation = this.validateDifficulty(action.difficulty);
      errors.push(...difficultyValidation.errors);
      warnings.push(...difficultyValidation.warnings);
    }

    if (action.status !== undefined) {
      const statusValidation = this.validateStatus(action.status);
      errors.push(...statusValidation.errors);
    }

    if (action.priority !== undefined) {
      const priorityValidation = this.validatePriority(action.priority);
      errors.push(...priorityValidation.errors);
    }

    if (action.targetArea !== undefined) {
      const targetAreaValidation = this.validateTargetArea(action.targetArea);
      errors.push(...targetAreaValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private validateTitle(title: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!title || title.trim().length === 0) {
      errors.push('Title cannot be empty');
    } else if (title.length > this.config.maxTitleLength) {
      errors.push(`Title too long (${title.length} chars), maximum: ${this.config.maxTitleLength}`);
    } else if (title.length < 5) {
      warnings.push('Title is quite short - consider making it more descriptive');
    }

    return { errors, warnings };
  }

  private validateDescription(description: string): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!description || description.trim().length === 0) {
      errors.push('Description cannot be empty');
    } else if (description.length > this.config.maxDescriptionLength) {
      errors.push(`Description too long (${description.length} chars), maximum: ${this.config.maxDescriptionLength}`);
    } else if (description.length < 20) {
      warnings.push('Description is quite short - consider adding more details');
    }

    return { errors, warnings };
  }

  private validateExpectedImpact(impact: number): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (impact < this.config.minExpectedImpact || impact > this.config.maxExpectedImpact) {
      errors.push(`Expected impact must be between ${this.config.minExpectedImpact} and ${this.config.maxExpectedImpact}`);
    } else if (impact < 0.1) {
      warnings.push('Very low expected impact - consider if this action is worth pursuing');
    } else if (impact > 0.9) {
      warnings.push('Very high expected impact - ensure this is realistic');
    }

    return { errors, warnings };
  }

  private validateDifficulty(difficulty: number): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (difficulty < this.config.minDifficulty || difficulty > this.config.maxDifficulty) {
      errors.push(`Difficulty must be between ${this.config.minDifficulty} and ${this.config.maxDifficulty}`);
    } else if (difficulty > 0.9) {
      warnings.push('Very high difficulty - consider breaking into smaller actions');
    }

    return { errors, warnings };
  }

  private validateStatus(status: string): { errors: string[] } {
    const errors: string[] = [];
    const validStatuses = ['suggested', 'accepted', 'in_progress', 'completed', 'rejected'];
    
    if (!validStatuses.includes(status)) {
      errors.push(`Invalid status: ${status}. Valid values: ${validStatuses.join(', ')}`);
    }

    return { errors };
  }

  private validatePriority(priority: string): { errors: string[] } {
    const errors: string[] = [];
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    if (!validPriorities.includes(priority)) {
      errors.push(`Invalid priority: ${priority}. Valid values: ${validPriorities.join(', ')}`);
    }

    return { errors };
  }

  private validateTargetArea(targetArea: string): { errors: string[] } {
    const errors: string[] = [];
    const validTargetAreas = ['tools', 'planning', 'learning', 'knowledge', 'execution', 'interaction'];
    
    if (!validTargetAreas.includes(targetArea)) {
      errors.push(`Invalid target area: ${targetArea}. Valid values: ${validTargetAreas.join(', ')}`);
    }

    return { errors };
  }

  private registerDefaultBusinessRules(): void {
    // Rule: High impact actions should have detailed implementation steps
    this.businessRules.set('high-impact-detailed-steps', {
      id: 'high-impact-detailed-steps',
      name: 'High Impact Detailed Steps',
      description: 'High impact actions should have detailed implementation steps',
      severity: 'warning',
      category: 'quality',
      validate: async (action) => {
        const errors: string[] = [];
        
        if (action.expectedImpact && action.expectedImpact > 0.7) {
          if (!action.implementationSteps || action.implementationSteps.length < 3) {
            errors.push('High impact actions should have at least 3 implementation steps');
          }
        }
        
        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
          suggestions: []
        };
      }
    });

    // Rule: Critical priority actions should have low difficulty
    this.businessRules.set('critical-priority-difficulty', {
      id: 'critical-priority-difficulty',
      name: 'Critical Priority Difficulty',
      description: 'Critical priority actions should be relatively easy to implement',
      severity: 'warning',
      category: 'feasibility',
      validate: async (action) => {
        const errors: string[] = [];
        
        if (action.priority === 'critical' && action.difficulty && action.difficulty > 0.8) {
          errors.push('Critical priority actions should have lower difficulty for faster implementation');
        }
        
        return {
          isValid: errors.length === 0,
          errors,
          warnings: [],
          suggestions: []
        };
      }
    });

    // Rule: Actions should have balanced impact vs difficulty ratio
    this.businessRules.set('impact-difficulty-ratio', {
      id: 'impact-difficulty-ratio',
      name: 'Impact Difficulty Ratio',
      description: 'Actions should have a reasonable impact to difficulty ratio',
      severity: 'info',
      category: 'optimization',
      validate: async (action) => {
        const suggestions: string[] = [];
        
        if (action.expectedImpact && action.difficulty) {
          const ratio = action.expectedImpact / action.difficulty;
          if (ratio < 0.5) {
            suggestions.push('Consider if this action provides sufficient value for the effort required');
          }
        }
        
        return {
          isValid: true,
          errors: [],
          warnings: [],
          suggestions
        };
      }
    });
  }

  private getBusinessRulesByCategory(): Record<string, number> {
    const categories: Record<string, number> = {};
    
    for (const rule of this.businessRules.values()) {
      categories[rule.category] = (categories[rule.category] || 0) + 1;
    }
    
    return categories;
  }
} 