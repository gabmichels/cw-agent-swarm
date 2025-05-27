/**
 * StepGenerator.ts - Step decomposition and generation
 * 
 * This component handles the generation of plan steps from goals,
 * including dependency analysis, step optimization, and resource allocation.
 */

import { ulid } from 'ulid';
import { 
  StepGenerator as IStepGenerator,
  StepGenerationOptions,
  StepGenerationResult,
  ValidationResult,
  ValidationIssue
} from '../interfaces/PlanningInterfaces';
import { PlanStep } from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { ActionGenerator } from './ActionGenerator';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for step generation
 */
export interface StepGeneratorConfig {
  /** Maximum number of steps per plan */
  maxStepsPerPlan: number;
  
  /** Maximum depth for step decomposition */
  maxDecompositionDepth: number;
  
  /** Enable dependency analysis */
  enableDependencyAnalysis: boolean;
  
  /** Enable step optimization */
  enableOptimization: boolean;
  
  /** Enable step validation */
  enableValidation: boolean;
  
  /** Enable logging */
  enableLogging: boolean;
  
  /** Default step priority */
  defaultStepPriority: number;
  
  /** Step generation timeout (ms) */
  generationTimeoutMs: number;
}

/**
 * Default configuration for step generation
 */
const DEFAULT_CONFIG: StepGeneratorConfig = {
  maxStepsPerPlan: 20,
  maxDecompositionDepth: 3,
  enableDependencyAnalysis: true,
  enableOptimization: true,
  enableValidation: true,
  enableLogging: true,
  defaultStepPriority: 0.5,
  generationTimeoutMs: 30000 // 30 seconds
};

/**
 * Step template for common patterns
 */
interface StepTemplate {
  /** Template name */
  name: string;
  
  /** Template description */
  description: string;
  
  /** Step pattern */
  pattern: RegExp;
  
  /** Generated step names */
  stepNames: string[];
  
  /** Dependencies between steps */
  dependencies: Array<{ from: number; to: number }>;
  
  /** Estimated time per step (minutes) */
  estimatedTimes: number[];
}

/**
 * Step generation error
 */
export class StepGenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly goal: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'StepGenerationError';
  }
}

/**
 * Implementation of StepGenerator interface
 */
export class StepGenerator implements IStepGenerator {
  private readonly logger = createLogger({ moduleId: 'step-generator' });
  private readonly config: StepGeneratorConfig;
  private readonly actionGenerator: ActionGenerator;
  private readonly stepTemplates: StepTemplate[];

  constructor(
    config: Partial<StepGeneratorConfig> = {},
    actionGenerator?: ActionGenerator
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.actionGenerator = actionGenerator || new ActionGenerator();
    this.stepTemplates = this.initializeStepTemplates();
    
    if (this.config.enableLogging) {
      this.logger.info('StepGenerator initialized', { config: this.config });
    }
  }

  /**
   * Generate steps for a plan
   */
  async generateSteps(
    goal: string,
    context: Record<string, unknown> = {},
    options: StepGenerationOptions = {}
  ): Promise<StepGenerationResult> {
    const generationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting step generation', {
          generationId,
          goal: goal.substring(0, 100) + '...',
          context,
          options
        });
      }

      // Validate input
      if (!goal || goal.trim().length === 0) {
        throw new StepGenerationError(
          'Goal description cannot be empty',
          'INVALID_GOAL',
          goal,
          false
        );
      }

      // Analyze goal and decompose into steps
      const steps = await this.decomposeGoal(goal, context, options);
      
      // Analyze dependencies between steps
      if (this.config.enableDependencyAnalysis) {
        await this.analyzeDependencies(steps, context);
      }
      
      // Generate actions for each step
      await this.generateStepActions(steps, context, options);
      
      // Optimize step sequence if enabled
      if (this.config.enableOptimization) {
        await this.optimizeSteps(steps, options);
      }
      
      // Validate steps if enabled
      if (this.config.enableValidation) {
        const validationResults = await this.validateSteps(steps);
        if (validationResults.some(r => !r.isValid)) {
          throw new StepGenerationError(
            'Step validation failed',
            'VALIDATION_FAILED',
            goal,
            true,
            { validationResults }
          );
        }
      }

      // Calculate overall confidence and metrics
      const confidence = this.calculateOverallConfidence(steps);
      const estimatedTime = this.calculateTotalTime(steps);
      const resourceRequirements = this.analyzeResourceRequirements(steps);

      const generationTime = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.info('Step generation completed', {
          generationId,
          stepCount: steps.length,
          confidence,
          estimatedTime,
          generationTime
        });
      }

      return {
        steps,
        confidence,
        estimatedTime,
        resourceRequirements
      };

    } catch (error) {
      const generationTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Step generation failed', {
          generationId,
          goal: goal.substring(0, 100) + '...',
          error: error instanceof Error ? error.message : String(error),
          generationTime
        });
      }

      throw error;
    }
  }

  /**
   * Refine existing steps
   */
  async refineSteps(
    steps: PlanStep[],
    feedback?: string,
    options: StepGenerationOptions = {}
  ): Promise<StepGenerationResult> {
    if (this.config.enableLogging) {
      this.logger.info('Refining steps', {
        stepCount: steps.length,
        feedback: feedback?.substring(0, 100) + '...'
      });
    }

    // Apply feedback to improve steps
    const refinedSteps = await this.applyFeedback(steps, feedback);
    
    // Re-generate actions for refined steps
    await this.generateStepActions(refinedSteps, {}, options);
    
    // Re-analyze dependencies
    if (this.config.enableDependencyAnalysis) {
      await this.analyzeDependencies(refinedSteps, {});
    }
    
    // Re-optimize if enabled
    if (this.config.enableOptimization) {
      await this.optimizeSteps(refinedSteps, options);
    }

    const confidence = this.calculateOverallConfidence(refinedSteps);
    const estimatedTime = this.calculateTotalTime(refinedSteps);
    const resourceRequirements = this.analyzeResourceRequirements(refinedSteps);

    return {
      steps: refinedSteps,
      confidence,
      estimatedTime,
      resourceRequirements
    };
  }

  /**
   * Initialize step templates for common patterns
   */
  private initializeStepTemplates(): StepTemplate[] {
    return [
      {
        name: 'research_and_analyze',
        description: 'Research and analyze information',
        pattern: /(?:research|analyze|investigate|study|examine)/i,
        stepNames: [
          'Gather initial information',
          'Analyze collected data',
          'Identify key insights',
          'Document findings'
        ],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 3 }
        ],
        estimatedTimes: [15, 20, 15, 10]
      },
      {
        name: 'create_and_build',
        description: 'Create or build something',
        pattern: /(?:create|build|develop|implement|design|make)/i,
        stepNames: [
          'Plan and design',
          'Set up environment',
          'Implement core functionality',
          'Test and validate',
          'Finalize and document'
        ],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 3 },
          { from: 3, to: 4 }
        ],
        estimatedTimes: [20, 15, 30, 20, 15]
      },
      {
        name: 'process_and_transform',
        description: 'Process and transform data',
        pattern: /(?:process|transform|convert|migrate|import|export)/i,
        stepNames: [
          'Prepare source data',
          'Set up processing pipeline',
          'Execute transformation',
          'Validate results',
          'Store processed data'
        ],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 3 },
          { from: 3, to: 4 }
        ],
        estimatedTimes: [10, 15, 25, 15, 10]
      },
      {
        name: 'communicate_and_share',
        description: 'Communicate and share information',
        pattern: /(?:communicate|share|send|notify|report|present)/i,
        stepNames: [
          'Prepare content',
          'Format for audience',
          'Deliver communication',
          'Gather feedback'
        ],
        dependencies: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 2, to: 3 }
        ],
        estimatedTimes: [15, 10, 5, 10]
      }
    ];
  }

  /**
   * Decompose goal into steps
   */
  private async decomposeGoal(
    goal: string,
    context: Record<string, unknown>,
    options: StepGenerationOptions
  ): Promise<PlanStep[]> {
    // Find matching template
    const template = this.findMatchingTemplate(goal);
    
    if (template) {
      return this.generateStepsFromTemplate(goal, template, context);
    } else {
      return this.generateGenericSteps(goal, context, options);
    }
  }

  /**
   * Find matching step template
   */
  private findMatchingTemplate(goal: string): StepTemplate | null {
    for (const template of this.stepTemplates) {
      if (template.pattern.test(goal)) {
        return template;
      }
    }
    return null;
  }

  /**
   * Generate steps from template
   */
  private generateStepsFromTemplate(
    goal: string,
    template: StepTemplate,
    context: Record<string, unknown>
  ): PlanStep[] {
    const steps: PlanStep[] = [];
    
    // Respect maxStepsPerPlan configuration
    const maxSteps = Math.min(template.stepNames.length, this.config.maxStepsPerPlan);
    
    for (let i = 0; i < maxSteps; i++) {
      const stepName = template.stepNames[i];
      const estimatedTime = template.estimatedTimes[i];
      
      // Find dependencies for this step
      const dependencies = template.dependencies
        .filter(dep => dep.to === i && dep.from < maxSteps)
        .map(dep => `step-${dep.from}`);

      const step: PlanStep = {
        id: `step-${i}`,
        name: stepName,
        description: `${stepName} for: ${goal}`,
        priority: this.config.defaultStepPriority,
        dependencies,
        actions: [], // Will be populated later
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: estimatedTime
      };

      steps.push(step);
    }

    return steps;
  }

  /**
   * Generate generic steps when no template matches
   */
  private generateGenericSteps(
    goal: string,
    context: Record<string, unknown>,
    options: StepGenerationOptions
  ): PlanStep[] {
    const steps: PlanStep[] = [];
    
    // Analyze goal complexity to determine number of steps
    const complexity = this.analyzeGoalComplexity(goal);
    const stepCount = Math.min(Math.max(complexity, 2), this.config.maxStepsPerPlan);
    
    // Generate generic step structure
    const stepNames = this.generateGenericStepNames(goal, stepCount);
    
    for (let i = 0; i < stepCount; i++) {
      const step: PlanStep = {
        id: ulid(),
        name: stepNames[i],
        description: `${stepNames[i]} for: ${goal}`,
        priority: this.config.defaultStepPriority,
        dependencies: i > 0 ? [steps[i - 1].id] : [], // Sequential by default
        actions: [], // Will be populated later
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        estimatedTimeMinutes: 20 // Default estimate
      };

      steps.push(step);
    }

    return steps;
  }

  /**
   * Analyze goal complexity
   */
  private analyzeGoalComplexity(goal: string): number {
    let complexity = 2; // Minimum 2 steps

    // Complexity from goal length
    complexity += Math.floor(goal.length / 50);

    // Complexity from keywords
    const complexityKeywords = [
      'and', 'then', 'after', 'before', 'while', 'during',
      'multiple', 'various', 'several', 'different'
    ];

    for (const keyword of complexityKeywords) {
      if (goal.toLowerCase().includes(keyword)) {
        complexity += 1;
      }
    }

    return Math.min(complexity, 8); // Maximum 8 steps for generic
  }

  /**
   * Generate generic step names
   */
  private generateGenericStepNames(goal: string, stepCount: number): string[] {
    const names: string[] = [];
    
    if (stepCount >= 2) {
      names.push('Prepare and plan');
      names.push('Execute main task');
    }
    
    if (stepCount >= 3) {
      names.splice(1, 0, 'Gather requirements');
    }
    
    if (stepCount >= 4) {
      names.push('Validate and test');
    }
    
    if (stepCount >= 5) {
      names.splice(-1, 0, 'Review and refine');
    }
    
    if (stepCount >= 6) {
      names.push('Document and finalize');
    }
    
    if (stepCount >= 7) {
      names.splice(-2, 0, 'Optimize and improve');
    }
    
    if (stepCount >= 8) {
      names.splice(1, 0, 'Analyze requirements');
    }

    return names.slice(0, stepCount);
  }

  /**
   * Analyze dependencies between steps
   */
  private async analyzeDependencies(
    steps: PlanStep[],
    context: Record<string, unknown>
  ): Promise<void> {
    // For now, maintain existing dependencies
    // In a more advanced implementation, this would analyze step content
    // and automatically detect dependencies
    
    if (this.config.enableLogging) {
      this.logger.debug('Analyzing step dependencies', {
        stepCount: steps.length
      });
    }
  }

  /**
   * Generate actions for each step
   */
  private async generateStepActions(
    steps: PlanStep[],
    context: Record<string, unknown>,
    options: StepGenerationOptions
  ): Promise<void> {
    for (const step of steps) {
      try {
        const actionResult = await this.actionGenerator.generateActions(step, {
          stepContext: context,
          availableTools: context.availableTools as string[],
          resourceConstraints: options.availableResources
        });

        step.actions = actionResult.actions;
        
        // Update step estimated time based on actions
        if (actionResult.estimatedTime) {
          step.estimatedTimeMinutes = actionResult.estimatedTime;
        }

      } catch (error) {
        if (this.config.enableLogging) {
          this.logger.warn('Failed to generate actions for step', {
            stepId: step.id,
            stepName: step.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        
        // Re-throw error to propagate it up
        throw error;
      }
    }
  }

  /**
   * Optimize step sequence and structure
   */
  private async optimizeSteps(
    steps: PlanStep[],
    options: StepGenerationOptions
  ): Promise<void> {
    if (this.config.enableLogging) {
      this.logger.debug('Optimizing steps', { stepCount: steps.length });
    }

    // Optimize step order based on dependencies and priorities
    this.optimizeStepOrder(steps);
    
    // Optimize step priorities
    this.optimizeStepPriorities(steps);
    
    // Optimize estimated times
    this.optimizeEstimatedTimes(steps);
  }

  /**
   * Optimize step order
   */
  private optimizeStepOrder(steps: PlanStep[]): void {
    // Sort steps by dependency order and priority
    steps.sort((a, b) => {
      // Steps with no dependencies come first
      if (a.dependencies.length === 0 && b.dependencies.length > 0) return -1;
      if (b.dependencies.length === 0 && a.dependencies.length > 0) return 1;
      
      // Then by priority (higher priority first)
      return b.priority - a.priority;
    });
  }

  /**
   * Optimize step priorities
   */
  private optimizeStepPriorities(steps: PlanStep[]): void {
    // Adjust priorities based on dependencies and position
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      // Earlier steps get higher priority
      const positionBonus = (steps.length - i) / steps.length * 0.2;
      
      // Steps with more dependents get higher priority
      const dependentCount = steps.filter(s => s.dependencies.includes(step.id)).length;
      const dependencyBonus = dependentCount * 0.1;
      
      step.priority = Math.min(
        this.config.defaultStepPriority + positionBonus + dependencyBonus,
        1.0
      );
    }
  }

  /**
   * Optimize estimated times
   */
  private optimizeEstimatedTimes(steps: PlanStep[]): void {
    for (const step of steps) {
      // Adjust time based on action count
      const actionCount = step.actions.length;
      if (actionCount > 0) {
        const baseTime = step.estimatedTimeMinutes || 20;
        step.estimatedTimeMinutes = Math.max(baseTime + (actionCount - 1) * 5, 5);
      }
    }
  }

  /**
   * Validate generated steps
   */
  private async validateSteps(steps: PlanStep[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const step of steps) {
      const issues: ValidationIssue[] = [];
      let score = 1.0;

      // Validate step structure
      if (!step.name || step.name.trim().length === 0) {
        issues.push({
          severity: 'error',
          message: 'Step name is required',
          location: { stepId: step.id, field: 'name' },
          suggestedFix: 'Provide a descriptive step name'
        });
        score -= 0.3;
      }

      if (!step.description || step.description.trim().length === 0) {
        issues.push({
          severity: 'error',
          message: 'Step description is required',
          location: { stepId: step.id, field: 'description' },
          suggestedFix: 'Provide a clear step description'
        });
        score -= 0.3;
      }

      // Validate dependencies
      for (const depId of step.dependencies) {
        const dependencyExists = steps.some(s => s.id === depId);
        if (!dependencyExists) {
          issues.push({
            severity: 'error',
            message: `Dependency ${depId} not found`,
            location: { stepId: step.id, field: 'dependencies' },
            suggestedFix: 'Remove invalid dependency or add missing step'
          });
          score -= 0.2;
        }
      }

      // Validate priority
      if (step.priority < 0 || step.priority > 1) {
        issues.push({
          severity: 'error',
          message: 'Step priority should be between 0 and 1',
          location: { stepId: step.id, field: 'priority' },
          suggestedFix: 'Set priority to a value between 0 and 1'
        });
        score -= 0.3;
      }

      results.push({
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        score: Math.max(score, 0),
        issues,
        suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
      });
    }

    return results;
  }

  /**
   * Apply feedback to improve steps
   */
  private async applyFeedback(
    steps: PlanStep[],
    feedback?: string
  ): Promise<PlanStep[]> {
    if (!feedback) {
      return steps;
    }

    // Simple feedback processing - in a real implementation,
    // this would use NLP to understand and apply feedback
    const refinedSteps = steps.map(step => ({ ...step }));

    // Look for feedback about specific steps
    const feedbackLower = feedback.toLowerCase();
    
    if (feedbackLower.includes('too many steps')) {
      // Remove less important steps
      return refinedSteps.filter((_, index) => index % 2 === 0);
    }
    
    if (feedbackLower.includes('more detail')) {
      // Add more detailed descriptions
      refinedSteps.forEach(step => {
        step.description = `${step.description} (with detailed analysis and validation)`;
      });
    }

    return refinedSteps;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(steps: PlanStep[]): number {
    if (steps.length === 0) return 1.0; // Empty steps array is perfectly valid

    // Base confidence from step count
    let confidence = Math.min(steps.length / 5, 1) * 0.8;

    // Confidence from step completeness
    const stepsWithActions = steps.filter(s => s.actions.length > 0).length;
    confidence += (stepsWithActions / steps.length) * 0.2;

    return Math.min(confidence, 1);
  }

  /**
   * Calculate total estimated time
   */
  private calculateTotalTime(steps: PlanStep[]): number {
    return steps.reduce((total, step) => {
      return total + (step.estimatedTimeMinutes || 20);
    }, 0);
  }

  /**
   * Analyze resource requirements
   */
  private analyzeResourceRequirements(steps: PlanStep[]): Record<string, unknown> {
    const requirements: Record<string, unknown> = {
      totalSteps: steps.length,
      totalActions: steps.reduce((sum, step) => sum + step.actions.length, 0),
      requiredTools: new Set<string>(),
      estimatedDuration: this.calculateTotalTime(steps)
    };

    // Collect required tools
    const tools = new Set<string>();
    for (const step of steps) {
      if (step.requiredTools) {
        step.requiredTools.forEach(tool => tools.add(tool));
      }
    }
    requirements.requiredTools = Array.from(tools);

    return requirements;
  }

  /**
   * Configure step generation behavior
   */
  configure(config: Partial<StepGeneratorConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('StepGenerator configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): StepGeneratorConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    config: StepGeneratorConfig;
    templateCount: number;
  } {
    return {
      healthy: true,
      config: this.config,
      templateCount: this.stepTemplates.length
    };
  }
} 