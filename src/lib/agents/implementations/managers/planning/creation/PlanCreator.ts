/**
 * PlanCreator.ts - Plan generation from goals
 * 
 * This component handles the creation of complete plans from goal descriptions,
 * including strategy selection, plan structure optimization, and resource analysis.
 */

import { ulid } from 'ulid';
import { 
  PlanCreator as IPlanCreator,
  PlanCreationConfig,
  ValidationResult,
  ValidationIssue
} from '../interfaces/PlanningInterfaces';
import { 
  Plan, 
  PlanCreationOptions,
  PlanCreationResult 
} from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { StepGenerator } from './StepGenerator';
import { createLogger } from '../../../../../logging/winston-logger';

/**
 * Configuration for plan creation
 */
export interface PlanCreatorConfig extends PlanCreationConfig {
  /** Enable LLM-based goal analysis */
  enableLLMAnalysis: boolean;
  
  /** Enable plan complexity analysis */
  enableComplexityAnalysis: boolean;
  
  /** Enable resource estimation */
  enableResourceEstimation: boolean;
  
  /** Enable plan logging */
  enableLogging: boolean;
  
  /** Default plan priority */
  defaultPriority: number;
  
  /** Maximum goal analysis time (ms) */
  goalAnalysisTimeoutMs: number;
}

/**
 * Default configuration for plan creation
 */
const DEFAULT_CONFIG: PlanCreatorConfig = {
  maxStepsPerPlan: 20,
  maxActionsPerStep: 10,
  confidenceThreshold: 0.7,
  enableOptimization: true,
  enableValidation: true,
  creationTimeoutMs: 60000, // 1 minute
  enableLLMAnalysis: true,
  enableComplexityAnalysis: true,
  enableResourceEstimation: true,
  enableLogging: true,
  defaultPriority: 5,
  goalAnalysisTimeoutMs: 30000 // 30 seconds
};

/**
 * Goal analysis result
 */
interface GoalAnalysis {
  /** Parsed goal components */
  components: GoalComponent[];
  
  /** Estimated complexity (1-10) */
  complexity: number;
  
  /** Required capabilities */
  requiredCapabilities: string[];
  
  /** Estimated duration (minutes) */
  estimatedDuration: number;
  
  /** Success criteria */
  successCriteria: string[];
  
  /** Potential risks */
  risks: string[];
}

/**
 * Individual goal component
 */
interface GoalComponent {
  /** Component type */
  type: 'objective' | 'constraint' | 'resource' | 'timeline';
  
  /** Component description */
  description: string;
  
  /** Importance (1-10) */
  importance: number;
  
  /** Whether this is mandatory */
  mandatory: boolean;
}

/**
 * Plan creation strategy
 */
interface PlanStrategy {
  /** Strategy name */
  name: string;
  
  /** Strategy description */
  description: string;
  
  /** Suitability score for the goal (0-1) */
  suitability: number;
  
  /** Expected confidence */
  expectedConfidence: number;
  
  /** Strategy parameters */
  parameters: Record<string, unknown>;
}

/**
 * Plan creation error
 */
export class PlanCreationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly goal: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PlanCreationError';
  }
}

/**
 * Implementation of PlanCreator interface
 */
export class PlanCreator implements IPlanCreator {
  private readonly logger = createLogger({ moduleId: 'plan-creator' });
  private readonly config: PlanCreatorConfig;
  private readonly stepGenerator: StepGenerator;

  constructor(
    config: Partial<PlanCreatorConfig> = {},
    stepGenerator?: StepGenerator
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stepGenerator = stepGenerator || new StepGenerator();
    
    if (this.config.enableLogging) {
      this.logger.info('PlanCreator initialized', { config: this.config });
    }
  }

  /**
   * Create a plan from a goal description
   */
  async createPlan(
    goal: string,
    options: Partial<PlanCreationOptions> = {}
  ): Promise<PlanCreationResult> {
    const creationId = ulid();
    const startTime = Date.now();

    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting plan creation', {
          creationId,
          goal: goal.substring(0, 100) + '...',
          options
        });
      }

      // Validate input
      if (!goal || goal.trim().length === 0) {
        throw new PlanCreationError(
          'Goal description cannot be empty',
          'INVALID_GOAL',
          goal,
          false
        );
      }

      // Analyze the goal
      const goalAnalysis = await this.analyzeGoal(goal, options);
      
      // Select creation strategy
      const strategy = await this.selectStrategy(goalAnalysis, options);
      
      // Generate plan structure
      const plan = await this.generatePlanStructure(goal, goalAnalysis, strategy, options);
      
      // Generate steps for the plan
      const stepResult = await this.stepGenerator.generateSteps(
        goal,
        {
          goalAnalysis,
          strategy,
          ...options.context
        },
        {
          qualityRequirements: {
            minConfidence: this.config.confidenceThreshold,
            requireValidation: this.config.enableValidation
          }
        }
      );

      // Update plan with generated steps
      plan.steps = stepResult.steps;
      plan.confidence = Math.min(plan.confidence, stepResult.confidence);

      // Validate plan if enabled
      if (this.config.enableValidation) {
        const validationResult = await this.validatePlan(plan);
        if (!validationResult.isValid || validationResult.score < this.config.confidenceThreshold || plan.confidence < this.config.confidenceThreshold) {
          throw new PlanCreationError(
            'Plan validation failed',
            'VALIDATION_FAILED',
            goal,
            true,
            { validationResult, planConfidence: plan.confidence, threshold: this.config.confidenceThreshold }
          );
        }
      }

      // Optimize plan if enabled
      if (this.config.enableOptimization) {
        await this.optimizePlan(plan, options);
      }

      const creationTime = Date.now() - startTime;

      if (this.config.enableLogging) {
        this.logger.info('Plan creation completed', {
          creationId,
          planId: plan.id,
          stepCount: plan.steps.length,
          confidence: plan.confidence,
          creationTime
        });
      }

      return {
        success: true,
        plan
      };

    } catch (error) {
      const creationTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Plan creation failed', {
          creationId,
          goal: goal.substring(0, 100) + '...',
          error: error instanceof Error ? error.message : String(error),
          creationTime
        });
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze the goal to understand its components and requirements
   */
  private async analyzeGoal(
    goal: string,
    options: Partial<PlanCreationOptions>
  ): Promise<GoalAnalysis> {
    if (this.config.enableLogging) {
      this.logger.debug('Analyzing goal', { goal: goal.substring(0, 100) + '...' });
    }

    // Parse goal components using pattern matching and NLP
    const components = this.parseGoalComponents(goal);
    
    // Estimate complexity based on goal structure and requirements
    const complexity = this.estimateComplexity(goal, components);
    
    // Identify required capabilities
    const requiredCapabilities = this.identifyRequiredCapabilities(goal, components);
    
    // Estimate duration
    const estimatedDuration = this.estimateDuration(goal, components, complexity);
    
    // Extract success criteria
    const successCriteria = this.extractSuccessCriteria(goal, components);
    
    // Identify potential risks
    const risks = this.identifyRisks(goal, components, complexity);

    return {
      components,
      complexity,
      requiredCapabilities,
      estimatedDuration,
      successCriteria,
      risks
    };
  }

  /**
   * Parse goal into components
   */
  private parseGoalComponents(goal: string): GoalComponent[] {
    const components: GoalComponent[] = [];
    
    // Extract objectives (main goals)
    const objectivePatterns = [
      /(?:create|build|develop|implement|design|make)\s+(.+?)(?:\s+and\s+|\.|$|,)/gi,
      /(?:achieve|accomplish|complete|finish)\s+(.+?)(?:\s+and\s+|\.|$|,)/gi,
      /(?:ensure|guarantee|verify)\s+(.+?)(?:\s+and\s+|\.|$|,)/gi
    ];

    for (const pattern of objectivePatterns) {
      const matches = Array.from(goal.matchAll(pattern));
      for (const match of matches) {
        components.push({
          type: 'objective',
          description: match[1].trim(),
          importance: 8,
          mandatory: true
        });
      }
    }

    // Handle compound objectives with "and"
    const andPattern = /\s+and\s+(?:implement|create|build|develop|design|make)\s+(.+?)(?:\.|$|,)/gi;
    const andMatches = Array.from(goal.matchAll(andPattern));
    for (const match of andMatches) {
      components.push({
        type: 'objective',
        description: match[1].trim(),
        importance: 8,
        mandatory: true
      });
    }

    // Extract constraints
    const constraintPatterns = [
      /(?:within|by|before)\s+(.+?)(?:\.|$|,)/gi,
      /(?:using|with|without)\s+(.+?)(?:\.|$|,)/gi,
      /(?:must|should|cannot|must not)\s+(.+?)(?:\.|$|,)/gi
    ];

    for (const pattern of constraintPatterns) {
      const matches = Array.from(goal.matchAll(pattern));
      for (const match of matches) {
        components.push({
          type: 'constraint',
          description: match[1].trim(),
          importance: 6,
          mandatory: true
        });
      }
    }

    // Extract resources
    const resourcePatterns = [
      /(?:use|utilize|leverage)\s+(.+?)(?:\.|$|,)/gi,
      /(?:with|using)\s+(.+?)(?:tool|system|platform|service)/gi
    ];

    for (const pattern of resourcePatterns) {
      const matches = Array.from(goal.matchAll(pattern));
      for (const match of matches) {
        components.push({
          type: 'resource',
          description: match[1].trim(),
          importance: 4,
          mandatory: false
        });
      }
    }

    // If no components found, create a default objective
    if (components.length === 0) {
      components.push({
        type: 'objective',
        description: goal,
        importance: 10,
        mandatory: true
      });
    }

    return components;
  }

  /**
   * Estimate goal complexity
   */
  private estimateComplexity(goal: string, components: GoalComponent[]): number {
    let complexity = 1;

    // Base complexity from goal length
    complexity += Math.min(goal.length / 100, 3);

    // Complexity from number of components
    complexity += components.length * 0.5;

    // Complexity from component types
    const objectiveCount = components.filter(c => c.type === 'objective').length;
    const constraintCount = components.filter(c => c.type === 'constraint').length;
    
    complexity += objectiveCount * 1.5;
    complexity += constraintCount * 1.0;

    // Complexity from keywords
    const complexityKeywords = [
      'integrate', 'optimize', 'analyze', 'complex', 'advanced',
      'multiple', 'various', 'comprehensive', 'detailed', 'sophisticated'
    ];

    for (const keyword of complexityKeywords) {
      if (goal.toLowerCase().includes(keyword)) {
        complexity += 1;
      }
    }

    return Math.min(Math.max(Math.round(complexity), 1), 10);
  }

  /**
   * Identify required capabilities
   */
  private identifyRequiredCapabilities(goal: string, components: GoalComponent[]): string[] {
    const capabilities = new Set<string>();

    // Capability keywords mapping
    const capabilityMap = {
      'web': ['web', 'website', 'browser', 'http', 'url', 'online'],
      'file': ['file', 'document', 'pdf', 'csv', 'json', 'text'],
      'data': ['data', 'database', 'sql', 'query', 'analyze'],
      'api': ['api', 'rest', 'endpoint', 'service', 'integration'],
      'llm': ['generate', 'write', 'create', 'analyze', 'summarize'],
      'search': ['search', 'find', 'lookup', 'discover', 'locate'],
      'communication': ['email', 'message', 'notify', 'send', 'contact']
    };

    const goalLower = goal.toLowerCase();
    
    for (const [capability, keywords] of Object.entries(capabilityMap)) {
      for (const keyword of keywords) {
        if (goalLower.includes(keyword)) {
          capabilities.add(capability);
          break;
        }
      }
    }

    // Default capability if none identified
    if (capabilities.size === 0) {
      capabilities.add('general');
    }

    return Array.from(capabilities);
  }

  /**
   * Estimate duration in minutes
   */
  private estimateDuration(goal: string, components: GoalComponent[], complexity: number): number {
    // Base duration from complexity
    let duration = complexity * 10;

    // Duration from component count
    duration += components.length * 5;

    // Duration from mandatory components
    const mandatoryCount = components.filter(c => c.mandatory).length;
    duration += mandatoryCount * 10;

    // Duration adjustments based on keywords
    const quickKeywords = ['simple', 'basic', 'quick', 'fast'];
    const slowKeywords = ['complex', 'detailed', 'comprehensive', 'thorough'];

    const goalLower = goal.toLowerCase();
    
    for (const keyword of quickKeywords) {
      if (goalLower.includes(keyword)) {
        duration *= 0.7;
        break;
      }
    }

    for (const keyword of slowKeywords) {
      if (goalLower.includes(keyword)) {
        duration *= 1.5;
        break;
      }
    }

    return Math.max(Math.round(duration), 5); // Minimum 5 minutes
  }

  /**
   * Extract success criteria
   */
  private extractSuccessCriteria(goal: string, components: GoalComponent[]): string[] {
    const criteria: string[] = [];

    // Extract explicit criteria
    const criteriaPatterns = [
      /(?:success|successful|complete|completed)\s+(?:when|if)\s+(.+?)(?:\.|$)/gi,
      /(?:result|outcome|output)\s+(?:should|must|will)\s+(.+?)(?:\.|$)/gi
    ];

    for (const pattern of criteriaPatterns) {
      const matches = Array.from(goal.matchAll(pattern));
      for (const match of matches) {
        criteria.push(match[1].trim());
      }
    }

    // Generate criteria from objectives
    const objectives = components.filter(c => c.type === 'objective');
    for (const objective of objectives) {
      criteria.push(`Successfully ${objective.description}`);
    }

    // Default criteria if none found
    if (criteria.length === 0) {
      criteria.push('Goal completed successfully');
      criteria.push('All requirements met');
    }

    return criteria;
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(goal: string, components: GoalComponent[], complexity: number): string[] {
    const risks: string[] = [];

    // Complexity-based risks
    if (complexity >= 8) {
      risks.push('High complexity may lead to longer execution time');
      risks.push('Multiple dependencies may cause coordination issues');
    }

    // Component-based risks
    const constraintCount = components.filter(c => c.type === 'constraint').length;
    if (constraintCount >= 3) {
      risks.push('Multiple constraints may conflict with each other');
    }

    // Keyword-based risks
    const riskKeywords = {
      'external': 'External dependencies may be unreliable',
      'real-time': 'Real-time requirements may be challenging to meet',
      'large': 'Large scale operations may require significant resources',
      'multiple': 'Multiple components increase coordination complexity'
    };

    const goalLower = goal.toLowerCase();
    for (const [keyword, risk] of Object.entries(riskKeywords)) {
      if (goalLower.includes(keyword)) {
        risks.push(risk);
      }
    }

    // Default risks
    if (risks.length === 0) {
      risks.push('Unexpected errors during execution');
      risks.push('Resource availability issues');
    }

    return risks;
  }

  /**
   * Select the best strategy for plan creation
   */
  private async selectStrategy(
    goalAnalysis: GoalAnalysis,
    options: Partial<PlanCreationOptions>
  ): Promise<PlanStrategy> {
    const strategies: PlanStrategy[] = [
      {
        name: 'sequential',
        description: 'Execute steps in sequence',
        suitability: goalAnalysis.complexity <= 5 ? 0.8 : 0.4,
        expectedConfidence: 0.8,
        parameters: { allowParallel: false }
      },
      {
        name: 'parallel',
        description: 'Execute independent steps in parallel',
        suitability: goalAnalysis.complexity >= 6 ? 0.9 : 0.5,
        expectedConfidence: 0.7,
        parameters: { allowParallel: true, maxParallel: 3 }
      },
      {
        name: 'adaptive',
        description: 'Adapt strategy based on execution results',
        suitability: goalAnalysis.complexity >= 7 ? 0.9 : 0.6,
        expectedConfidence: 0.6,
        parameters: { allowParallel: true, adaptive: true }
      },
      {
        name: 'conservative',
        description: 'Minimize risks with careful validation',
        suitability: goalAnalysis.risks.length >= 3 ? 0.9 : 0.5,
        expectedConfidence: 0.9,
        parameters: { allowParallel: false, extraValidation: true }
      }
    ];

    // Select strategy with highest suitability
    const selectedStrategy = strategies.reduce((best, current) => 
      current.suitability > best.suitability ? current : best
    );

    if (this.config.enableLogging) {
      this.logger.debug('Strategy selected', {
        strategy: selectedStrategy.name,
        suitability: selectedStrategy.suitability,
        complexity: goalAnalysis.complexity
      });
    }

    return selectedStrategy;
  }

  /**
   * Generate the basic plan structure
   */
  private async generatePlanStructure(
    goal: string,
    goalAnalysis: GoalAnalysis,
    strategy: PlanStrategy,
    options: Partial<PlanCreationOptions>
  ): Promise<Plan> {
    const plan: Plan = {
      id: ulid(),
      name: this.generatePlanName(goal),
      description: goal,
      goals: [goal],
      steps: [], // Will be populated by step generator
      status: 'pending',
      priority: options.priority || this.config.defaultPriority,
      confidence: strategy.expectedConfidence,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        version: '1.0.0',
        tags: this.generatePlanTags(goalAnalysis),
        estimatedDuration: goalAnalysis.estimatedDuration,
        complexity: goalAnalysis.complexity,
        strategy: strategy.name,
        requiredCapabilities: goalAnalysis.requiredCapabilities,
        successCriteria: goalAnalysis.successCriteria,
        risks: goalAnalysis.risks
      }
    };

    return plan;
  }

  /**
   * Generate a plan name from the goal
   */
  private generatePlanName(goal: string): string {
    // Extract key action words
    const actionWords = goal.match(/\b(?:create|build|develop|implement|design|make|achieve|complete|analyze|optimize|integrate)\b/gi);
    const firstAction = actionWords?.[0] || 'Execute';

    // Extract key nouns
    const words = goal.split(/\s+/).filter(word => word.length > 3);
    const keyWords = words.slice(0, 3).join(' ');

    return `${firstAction} ${keyWords}`.substring(0, 50);
  }

  /**
   * Generate plan tags
   */
  private generatePlanTags(goalAnalysis: GoalAnalysis): string[] {
    const tags = new Set<string>();

    // Add capability tags
    goalAnalysis.requiredCapabilities.forEach(cap => tags.add(cap));

    // Add complexity tag
    if (goalAnalysis.complexity <= 3) tags.add('simple');
    else if (goalAnalysis.complexity <= 6) tags.add('moderate');
    else tags.add('complex');

    // Add component type tags
    const hasObjectives = goalAnalysis.components.some(c => c.type === 'objective');
    const hasConstraints = goalAnalysis.components.some(c => c.type === 'constraint');
    
    if (hasObjectives) tags.add('goal-oriented');
    if (hasConstraints) tags.add('constrained');

    return Array.from(tags);
  }

  /**
   * Validate the generated plan
   */
  private async validatePlan(plan: Plan): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let score = 1.0;

    // Validate plan structure
    if (!plan.name || plan.name.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan name is required',
        location: { field: 'name' },
        suggestedFix: 'Provide a descriptive plan name'
      });
      score -= 0.2;
    }

    if (!plan.description || plan.description.trim().length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan description is required',
        location: { field: 'description' },
        suggestedFix: 'Provide a clear plan description'
      });
      score -= 0.2;
    }

    if (plan.goals.length === 0) {
      issues.push({
        severity: 'error',
        message: 'Plan must have at least one goal',
        location: { field: 'goals' },
        suggestedFix: 'Add at least one goal to the plan'
      });
      score -= 0.3;
    }

    // Validate confidence
    if (plan.confidence < this.config.confidenceThreshold) {
      issues.push({
        severity: 'warning',
        message: `Plan confidence (${plan.confidence}) is below threshold (${this.config.confidenceThreshold})`,
        location: { field: 'confidence' },
        suggestedFix: 'Review and improve plan quality'
      });
      score -= 0.1;
    }

    // Validate priority
    if (plan.priority < 1 || plan.priority > 10) {
      issues.push({
        severity: 'warning',
        message: 'Plan priority should be between 1 and 10',
        location: { field: 'priority' },
        suggestedFix: 'Set priority to a value between 1 and 10'
      });
      score -= 0.05;
    }

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(score, 0),
      issues,
      suggestions: issues.map(i => i.suggestedFix).filter(Boolean) as string[]
    };
  }

  /**
   * Optimize the plan structure and content
   */
  private async optimizePlan(plan: Plan, options: Partial<PlanCreationOptions>): Promise<void> {
    if (this.config.enableLogging) {
      this.logger.debug('Optimizing plan', { planId: plan.id });
    }

    // Optimize plan metadata
    if (plan.metadata) {
      // Ensure estimated duration is reasonable
      const currentDuration = plan.metadata.estimatedDuration as number;
      if (currentDuration && currentDuration > 480) { // More than 8 hours
        plan.metadata.estimatedDuration = Math.min(currentDuration, 480);
        
        if (this.config.enableLogging) {
          this.logger.debug('Adjusted plan duration', {
            planId: plan.id,
            originalDuration: currentDuration,
            adjustedDuration: plan.metadata.estimatedDuration
          });
        }
      }
    }

    // Optimize plan confidence based on complexity
    const complexity = plan.metadata?.complexity as number || 5;
    if (complexity >= 8 && plan.confidence > 0.8) {
      plan.confidence = Math.min(plan.confidence, 0.8);
    }
  }

  /**
   * Configure plan creation behavior
   */
  configure(config: Partial<PlanCreationConfig>): void {
    Object.assign(this.config, config);
    
    if (this.config.enableLogging) {
      this.logger.info('PlanCreator configuration updated', { config: this.config });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlanCreationConfig {
    return { ...this.config };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    config: PlanCreatorConfig;
  } {
    return {
      healthy: true,
      config: this.config
    };
  }
} 