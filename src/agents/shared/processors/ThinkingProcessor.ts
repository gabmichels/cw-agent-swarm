/**
 * ThinkingProcessor.ts - Coordinates thinking and reasoning processes
 * 
 * This component is responsible for:
 * - Thought process coordination
 * - Reasoning chain management
 * - Decision-making support
 * - Cognitive load balancing
 */

import { AgentBase } from '../base/AgentBase.interface';
import { MessageProcessingOptions } from '../base/AgentBase.interface';
import { createLogger } from '../../../lib/logging/winston-logger';

/**
 * Thinking step in a reasoning chain
 */
export interface ThinkingStep {
  id: string;
  type: ThinkingStepType;
  content: string;
  confidence: number;
  timestamp: Date;
  duration?: number;
  dependencies: string[];
  metadata: Record<string, unknown>;
}

/**
 * Types of thinking steps
 */
export enum ThinkingStepType {
  ANALYSIS = 'analysis',
  SYNTHESIS = 'synthesis',
  EVALUATION = 'evaluation',
  DECISION = 'decision',
  REFLECTION = 'reflection',
  HYPOTHESIS = 'hypothesis',
  VALIDATION = 'validation',
  CONCLUSION = 'conclusion'
}

/**
 * Reasoning chain containing multiple thinking steps
 */
export interface ReasoningChain {
  id: string;
  topic: string;
  steps: ThinkingStep[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed' | 'paused';
  confidence: number;
  complexity: number;
  metadata: Record<string, unknown>;
}

/**
 * Thinking context for processing
 */
export interface ThinkingContext {
  input: string;
  options: MessageProcessingOptions;
  previousChains: ReasoningChain[];
  availableKnowledge: string[];
  constraints: ThinkingConstraints;
  goals: string[];
}

/**
 * Constraints for thinking process
 */
export interface ThinkingConstraints {
  maxSteps: number;
  maxDuration: number;
  minConfidence: number;
  allowedStepTypes: ThinkingStepType[];
  requireValidation: boolean;
  enableParallelThinking: boolean;
}

/**
 * Thinking result
 */
export interface ThinkingResult {
  success: boolean;
  reasoningChain: ReasoningChain;
  finalConclusion: string;
  confidence: number;
  alternativeConclusions: string[];
  cognitiveLoad: number;
  processingTime: number;
  warnings: string[];
  errors: string[];
  
  /**
   * Classification of request type for smart routing
   */
  requestType?: {
    type: 'PURE_LLM_TASK' | 'EXTERNAL_TOOL_TASK' | 'SCHEDULED_TASK';
    confidence: number;
    reasoning: string;
    requiredTools?: string[];
    suggestedSchedule?: {
      scheduledFor?: Date;
      recurring?: boolean;
      intervalExpression?: string;
    };
  };
}

/**
 * Cognitive load metrics
 */
export interface CognitiveLoadMetrics {
  currentLoad: number;
  maxLoad: number;
  activeChains: number;
  averageComplexity: number;
  memoryUsage: number;
  processingEfficiency: number;
}

/**
 * Thinking strategy configuration
 */
export interface ThinkingStrategy {
  name: string;
  enabled: boolean;
  priority: number;
  applicableTypes: string[];
  execute: (context: ThinkingContext) => Promise<ReasoningChain>;
  validate?: (chain: ReasoningChain) => boolean;
}

/**
 * Thinking processing configuration
 */
export interface ThinkingProcessingConfig {
  enableReasoningChains: boolean;
  enableCognitiveLoadBalancing: boolean;
  enableParallelProcessing: boolean;
  maxConcurrentChains: number;
  defaultStrategy: string;
  cognitiveLoadThreshold: number;
  enableThoughtCaching: boolean;
  enableReflection: boolean;
  constraints: ThinkingConstraints;
}

/**
 * Error class for thinking processing errors
 */
export class ThinkingProcessingError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code = 'THINKING_PROCESSING_ERROR', context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ThinkingProcessingError';
    this.code = code;
    this.context = context;
  }
}

/**
 * ThinkingProcessor class - Coordinates thinking and reasoning processes
 */
export class ThinkingProcessor {
  private logger: ReturnType<typeof createLogger>;
  private agent: AgentBase;
  private config: ThinkingProcessingConfig;
  private strategies: Map<string, ThinkingStrategy> = new Map();
  private activeChains: Map<string, ReasoningChain> = new Map();
  private completedChains: ReasoningChain[] = [];
  private cognitiveLoadMetrics: CognitiveLoadMetrics;
  private thoughtCache: Map<string, ReasoningChain> = new Map();

  constructor(agent: AgentBase, config: Partial<ThinkingProcessingConfig> = {}) {
    this.agent = agent;
    this.logger = createLogger({
      moduleId: 'thinking-processor',
    });
    
    // Set default configuration
    this.config = {
      enableReasoningChains: true,
      enableCognitiveLoadBalancing: true,
      enableParallelProcessing: false,
      maxConcurrentChains: 3,
      defaultStrategy: 'sequential_analysis',
      cognitiveLoadThreshold: 80,
      enableThoughtCaching: true,
      enableReflection: true,
      constraints: {
        maxSteps: 10,
        maxDuration: 60000, // 1 minute
        minConfidence: 0.6,
        allowedStepTypes: Object.values(ThinkingStepType),
        requireValidation: true,
        enableParallelThinking: false
      },
      ...config
    };

    // Initialize cognitive load metrics
    this.cognitiveLoadMetrics = {
      currentLoad: 0,
      maxLoad: 100,
      activeChains: 0,
      averageComplexity: 0,
      memoryUsage: 0,
      processingEfficiency: 100
    };

    // Initialize default thinking strategies
    this.initializeDefaultStrategies();
  }

  /**
   * Process thinking for given input and context
   */
  async processThinking(
    input: string,
    options: MessageProcessingOptions = {}
  ): Promise<ThinkingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting thinking process');
      
      // Check cognitive load
      if (this.cognitiveLoadMetrics.currentLoad > this.config.cognitiveLoadThreshold) {
        if (this.config.enableCognitiveLoadBalancing) {
          await this.balanceCognitiveLoad();
        } else {
          throw new ThinkingProcessingError(
            'Cognitive load threshold exceeded',
            'COGNITIVE_OVERLOAD'
          );
        }
      }

      // Create thinking context
      const context = this.createThinkingContext(input, options);
      
      // Check cache if enabled
      if (this.config.enableThoughtCaching) {
        const cachedResult = this.checkThoughtCache(context);
        if (cachedResult) {
          this.logger.info('Using cached thinking result');
          return this.createThinkingResult(cachedResult, startTime, true);
        }
      }

      // Select appropriate thinking strategy
      const strategy = this.selectThinkingStrategy(context);
      
      // Execute thinking process
      const reasoningChain = await this.executeThinkingStrategy(strategy, context);
      
      // Validate reasoning chain
      if (this.config.constraints.requireValidation) {
        const validationResult = await this.validateReasoningChain(reasoningChain);
        if (!validationResult.valid) {
          throw new ThinkingProcessingError(
            `Reasoning chain validation failed: ${validationResult.errors.join(', ')}`,
            'VALIDATION_FAILED',
            { validationResult }
          );
        }
      }

      // Perform reflection if enabled
      if (this.config.enableReflection) {
        await this.performReflection(reasoningChain);
      }

      // Cache result if enabled
      if (this.config.enableThoughtCaching) {
        this.cacheThoughtResult(context, reasoningChain);
      }

      // Update cognitive load metrics
      this.updateCognitiveLoadMetrics(reasoningChain);
      
      // Add to completed chains if status is completed
      if (reasoningChain.status === 'completed') {
        this.completedChains.push(reasoningChain);
      }
      
      const result = this.createThinkingResult(reasoningChain, startTime, false);
      
      this.logger.info(`Thinking process completed successfully in ${result.processingTime}ms`);
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Error during thinking process:', { error: error instanceof Error ? error.message : String(error) });
      
      return {
        success: false,
        reasoningChain: this.createEmptyReasoningChain(input),
        finalConclusion: `Thinking process failed: ${(error as Error).message}`,
        confidence: 0,
        alternativeConclusions: [],
        cognitiveLoad: this.cognitiveLoadMetrics.currentLoad,
        processingTime,
        warnings: [],
        errors: [(error as Error).message]
      };
    }
  }

  /**
   * Create thinking context
   */
  private createThinkingContext(
    input: string,
    options: MessageProcessingOptions
  ): ThinkingContext {
    return {
      input,
      options,
      previousChains: this.getRelevantPreviousChains(input),
      availableKnowledge: this.extractAvailableKnowledge(input, options),
      constraints: this.config.constraints,
      goals: this.extractGoals(input, options)
    };
  }

  /**
   * Select appropriate thinking strategy
   */
  private selectThinkingStrategy(context: ThinkingContext): ThinkingStrategy {
    const inputType = (context.options as any).type || 'general';
    
    // Find strategies applicable to the input type
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.enabled)
      .filter(strategy => 
        strategy.applicableTypes.includes(inputType) || 
        strategy.applicableTypes.includes('*')
      )
      .sort((a, b) => b.priority - a.priority);
    
    if (applicableStrategies.length === 0) {
      // Fallback to default strategy
      const defaultStrategy = this.strategies.get(this.config.defaultStrategy);
      if (!defaultStrategy) {
        throw new ThinkingProcessingError(
          'No applicable thinking strategy found',
          'NO_STRATEGY_AVAILABLE'
        );
      }
      return defaultStrategy;
    }
    
    return applicableStrategies[0];
  }

  /**
   * Execute thinking strategy
   */
  private async executeThinkingStrategy(
    strategy: ThinkingStrategy,
    context: ThinkingContext
  ): Promise<ReasoningChain> {
    this.logger.info(`Executing thinking strategy: ${strategy.name}`);
    
    let reasoningChain: ReasoningChain;
    
    try {
      reasoningChain = await strategy.execute(context);
      
      // Add to active chains
      this.activeChains.set(reasoningChain.id, reasoningChain);
      
      // Validate strategy result
      if (strategy.validate && !strategy.validate(reasoningChain)) {
        throw new ThinkingProcessingError(
          `Strategy ${strategy.name} produced invalid reasoning chain`,
          'INVALID_STRATEGY_RESULT'
        );
      }
      
      return reasoningChain;
      
    } catch (error) {
      this.logger.error(`Strategy ${strategy.name} execution failed:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      // Remove from active chains when done (if reasoningChain was created)
      if (reasoningChain!) {
        this.activeChains.delete(reasoningChain.id);
      }
    }
  }

  /**
   * Validate reasoning chain
   */
  private async validateReasoningChain(
    chain: ReasoningChain
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if chain has steps
    if (chain.steps.length === 0) {
      errors.push('Reasoning chain has no steps');
    }
    
    // Check step dependencies
    for (const step of chain.steps) {
      for (const depId of step.dependencies) {
        const depStep = chain.steps.find(s => s.id === depId);
        if (!depStep) {
          errors.push(`Step ${step.id} depends on non-existent step ${depId}`);
        }
      }
    }
    
    // Check confidence levels
    const lowConfidenceSteps = chain.steps.filter(s => s.confidence < this.config.constraints.minConfidence);
    if (lowConfidenceSteps.length > 0) {
      warnings.push(`${lowConfidenceSteps.length} steps have low confidence`);
    }
    
    // Check for logical flow
    const hasConclusion = chain.steps.some(s => s.type === ThinkingStepType.CONCLUSION);
    if (!hasConclusion) {
      warnings.push('Reasoning chain lacks a conclusion step');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform reflection on reasoning chain
   */
  private async performReflection(chain: ReasoningChain): Promise<void> {
    try {
      this.logger.info(`Performing reflection on reasoning chain ${chain.id}`);
      
      // Create reflection step
      const reflectionStep: ThinkingStep = {
        id: `reflection_${Date.now()}`,
        type: ThinkingStepType.REFLECTION,
        content: this.generateReflectionContent(chain),
        confidence: this.calculateReflectionConfidence(chain),
        timestamp: new Date(),
        dependencies: chain.steps.map(s => s.id),
        metadata: {
          reflectionType: 'post_reasoning',
          originalChainId: chain.id
        }
      };
      
      // Add reflection step to chain
      chain.steps.push(reflectionStep);
      
      // Update chain confidence based on reflection
      chain.confidence = this.recalculateChainConfidence(chain);
      
    } catch (error) {
      this.logger.warn('Reflection process failed:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Generate reflection content
   */
  private generateReflectionContent(chain: ReasoningChain): string {
    const stepTypes = chain.steps.map(s => s.type);
    const avgConfidence = chain.steps.reduce((sum, s) => sum + s.confidence, 0) / chain.steps.length;
    
    let reflection = `Reflection on reasoning chain for "${chain.topic}":\n`;
    reflection += `- Used ${chain.steps.length} thinking steps\n`;
    reflection += `- Step types: ${Array.from(new Set(stepTypes)).join(', ')}\n`;
    reflection += `- Average confidence: ${avgConfidence.toFixed(2)}\n`;
    
    // Identify potential improvements
    if (avgConfidence < 0.7) {
      reflection += `- Low average confidence suggests uncertainty in reasoning\n`;
    }
    
    if (!stepTypes.includes(ThinkingStepType.VALIDATION)) {
      reflection += `- Consider adding validation steps for stronger reasoning\n`;
    }
    
    return reflection;
  }

  /**
   * Calculate reflection confidence
   */
  private calculateReflectionConfidence(chain: ReasoningChain): number {
    const factors = [
      chain.steps.length >= 3 ? 0.2 : 0.1, // Sufficient steps
      chain.confidence > 0.7 ? 0.3 : 0.1, // High chain confidence
      chain.steps.some(s => s.type === ThinkingStepType.VALIDATION) ? 0.2 : 0.0, // Has validation
      chain.steps.some(s => s.type === ThinkingStepType.CONCLUSION) ? 0.2 : 0.0, // Has conclusion
      0.1 // Base confidence
    ];
    
    return Math.min(1.0, factors.reduce((sum, factor) => sum + factor, 0));
  }

  /**
   * Recalculate chain confidence
   */
  private recalculateChainConfidence(chain: ReasoningChain): number {
    if (chain.steps.length === 0) return 0;
    
    const stepConfidences = chain.steps.map(s => s.confidence);
    const avgConfidence = stepConfidences.reduce((sum, conf) => sum + conf, 0) / stepConfidences.length;
    
    // Apply bonuses for good reasoning structure
    let bonus = 0;
    if (chain.steps.some(s => s.type === ThinkingStepType.VALIDATION)) bonus += 0.1;
    if (chain.steps.some(s => s.type === ThinkingStepType.REFLECTION)) bonus += 0.05;
    if (chain.steps.some(s => s.type === ThinkingStepType.CONCLUSION)) bonus += 0.1;
    
    return Math.min(1.0, avgConfidence + bonus);
  }

  /**
   * Balance cognitive load
   */
  private async balanceCognitiveLoad(): Promise<void> {
    this.logger.info('Balancing cognitive load');
    
    // Pause low-priority chains
    const chainsToBalance = Array.from(this.activeChains.values())
      .sort((a, b) => a.complexity - b.complexity);
    
    for (const chain of chainsToBalance) {
      if (this.cognitiveLoadMetrics.currentLoad <= this.config.cognitiveLoadThreshold) {
        break;
      }
      
      chain.status = 'paused';
      this.cognitiveLoadMetrics.currentLoad -= chain.complexity * 10;
      this.logger.info(`Paused reasoning chain ${chain.id} to reduce cognitive load`);
    }
    
    // Clear old completed chains from memory
    if (this.completedChains.length > 100) {
      this.completedChains = this.completedChains.slice(-50);
      this.logger.info('Cleared old completed chains to free memory');
    }
  }

  /**
   * Update cognitive load metrics
   */
  private updateCognitiveLoadMetrics(chain: ReasoningChain): void {
    this.cognitiveLoadMetrics.activeChains = this.activeChains.size;
    
    const allChains = Array.from(this.activeChains.values()).concat(this.completedChains);
    if (allChains.length > 0) {
      this.cognitiveLoadMetrics.averageComplexity = 
        allChains.reduce((sum, c) => sum + c.complexity, 0) / allChains.length;
    }
    
    // Estimate current load based on active chains
    this.cognitiveLoadMetrics.currentLoad = 
      Array.from(this.activeChains.values())
        .reduce((load, c) => load + (c.complexity * 10), 0);
    
    // Update memory usage (simplified)
    this.cognitiveLoadMetrics.memoryUsage = 
      (this.activeChains.size + this.completedChains.length) * 5;
  }

  /**
   * Check thought cache for existing result
   */
  private checkThoughtCache(context: ThinkingContext): ReasoningChain | null {
    const cacheKey = this.generateCacheKey(context);
    return this.thoughtCache.get(cacheKey) || null;
  }

  /**
   * Cache thought result
   */
  private cacheThoughtResult(context: ThinkingContext, chain: ReasoningChain): void {
    const cacheKey = this.generateCacheKey(context);
    this.thoughtCache.set(cacheKey, chain);
    
    // Limit cache size
    if (this.thoughtCache.size > 1000) {
      const firstKey = this.thoughtCache.keys().next().value;
      if (firstKey) {
        this.thoughtCache.delete(firstKey);
      }
    }
  }

  /**
   * Generate cache key for thinking context
   */
  private generateCacheKey(context: ThinkingContext): string {
    const keyData = {
      input: context.input.substring(0, 100), // Limit input length for key
      type: context.options.type || 'general',
      goals: context.goals.slice(0, 3) // Limit goals for key
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Get relevant previous chains
   */
  private getRelevantPreviousChains(input: string): ReasoningChain[] {
    // Simple relevance based on topic similarity
    return this.completedChains
      .filter(chain => chain.topic.toLowerCase().includes(input.toLowerCase().substring(0, 20)))
      .slice(-5); // Last 5 relevant chains
  }

  /**
   * Extract available knowledge
   */
  private extractAvailableKnowledge(input: string, options: MessageProcessingOptions): string[] {
    const knowledge: string[] = [];
    
    // Extract from options metadata
    if ((options.metadata as any)?.knowledge) {
      knowledge.push(...((options.metadata as any).knowledge as string[]));
    }
    
    // Extract from previous chains
    const relevantChains = this.getRelevantPreviousChains(input);
    for (const chain of relevantChains) {
      knowledge.push(chain.topic);
    }
    
    return knowledge;
  }

  /**
   * Extract goals from input and options
   */
  private extractGoals(input: string, options: MessageProcessingOptions): string[] {
    const goals: string[] = [];
    
    // Extract from options
    if ((options.metadata as any)?.goals) {
      goals.push(...((options.metadata as any).goals as string[]));
    }
    
    // Simple goal extraction from input
    if (input.toLowerCase().includes('help')) {
      goals.push('provide_assistance');
    }
    if (input.toLowerCase().includes('explain')) {
      goals.push('provide_explanation');
    }
    if (input.toLowerCase().includes('solve')) {
      goals.push('solve_problem');
    }
    
    return goals.length > 0 ? goals : ['general_response'];
  }

  /**
   * Create thinking result
   */
  private createThinkingResult(
    chain: ReasoningChain,
    startTime: number,
    fromCache: boolean
  ): ThinkingResult {
    const processingTime = Date.now() - startTime;
    
    // Extract final conclusion
    const conclusionStep = chain.steps.find(s => s.type === ThinkingStepType.CONCLUSION);
    const finalConclusion = conclusionStep?.content || 
      chain.steps[chain.steps.length - 1]?.content || 
      'No conclusion reached';
    
    // Generate alternative conclusions
    const alternativeConclusions = chain.steps
      .filter(s => s.type === ThinkingStepType.HYPOTHESIS || s.type === ThinkingStepType.DECISION)
      .map(s => s.content)
      .slice(0, 3);
    
    return {
      success: true,
      reasoningChain: chain,
      finalConclusion,
      confidence: chain.confidence,
      alternativeConclusions,
      cognitiveLoad: this.cognitiveLoadMetrics.currentLoad,
      processingTime,
      warnings: fromCache ? ['Result retrieved from cache'] : [],
      errors: [],
      requestType: {
        type: 'PURE_LLM_TASK',
        confidence: 1.0,
        reasoning: 'This is a pure LLM task',
        requiredTools: [],
        suggestedSchedule: {
          scheduledFor: new Date(),
          recurring: false,
          intervalExpression: 'PT1H'
        }
      }
    };
  }

  /**
   * Create empty reasoning chain for error cases
   */
  private createEmptyReasoningChain(input: string): ReasoningChain {
    return {
      id: `error_${Date.now()}`,
      topic: input ? input.substring(0, 50) : 'Invalid input',
      steps: [],
      startTime: new Date(),
      status: 'failed',
      confidence: 0,
      complexity: 0,
      metadata: { error: true }
    };
  }

  /**
   * Initialize default thinking strategies
   */
  private initializeDefaultStrategies(): void {
    // Sequential analysis strategy
    this.addStrategy({
      name: 'sequential_analysis',
      enabled: true,
      priority: 80,
      applicableTypes: ['*'],
      execute: async (context: ThinkingContext) => {
        const chain: ReasoningChain = {
          id: `seq_${Date.now()}`,
          topic: context.input.substring(0, 50),
          steps: [],
          startTime: new Date(),
          status: 'active',
          confidence: 0,
          complexity: 3,
          metadata: { strategy: 'sequential_analysis' }
        };
        
        // Analysis step
        chain.steps.push({
          id: `step_${Date.now()}_1`,
          type: ThinkingStepType.ANALYSIS,
          content: `Analyzing input: ${context.input}`,
          confidence: 0.8,
          timestamp: new Date(),
          dependencies: [],
          metadata: {}
        });
        
        // Synthesis step
        chain.steps.push({
          id: `step_${Date.now()}_2`,
          type: ThinkingStepType.SYNTHESIS,
          content: `Synthesizing information and forming response approach`,
          confidence: 0.7,
          timestamp: new Date(),
          dependencies: [chain.steps[0].id],
          metadata: {}
        });
        
        // Conclusion step
        chain.steps.push({
          id: `step_${Date.now()}_3`,
          type: ThinkingStepType.CONCLUSION,
          content: `Based on analysis, providing structured response to: ${context.input}`,
          confidence: 0.75,
          timestamp: new Date(),
          dependencies: [chain.steps[1].id],
          metadata: {}
        });
        
        chain.status = 'completed';
        chain.endTime = new Date();
        chain.confidence = this.recalculateChainConfidence(chain);
        
        return chain;
      }
    });

    // Problem-solving strategy
    this.addStrategy({
      name: 'problem_solving',
      enabled: true,
      priority: 90,
      applicableTypes: ['problem', 'question', 'help'],
      execute: async (context: ThinkingContext) => {
        const chain: ReasoningChain = {
          id: `prob_${Date.now()}`,
          topic: context.input.substring(0, 50),
          steps: [],
          startTime: new Date(),
          status: 'active',
          confidence: 0,
          complexity: 5,
          metadata: { strategy: 'problem_solving' }
        };
        
        // Problem identification
        chain.steps.push({
          id: `step_${Date.now()}_1`,
          type: ThinkingStepType.ANALYSIS,
          content: `Identifying core problem in: ${context.input}`,
          confidence: 0.8,
          timestamp: new Date(),
          dependencies: [],
          metadata: { phase: 'identification' }
        });
        
        // Hypothesis generation
        chain.steps.push({
          id: `step_${Date.now()}_2`,
          type: ThinkingStepType.HYPOTHESIS,
          content: `Generating potential solutions and approaches`,
          confidence: 0.7,
          timestamp: new Date(),
          dependencies: [chain.steps[0].id],
          metadata: { phase: 'hypothesis' }
        });
        
        // Evaluation
        chain.steps.push({
          id: `step_${Date.now()}_3`,
          type: ThinkingStepType.EVALUATION,
          content: `Evaluating proposed solutions for feasibility and effectiveness`,
          confidence: 0.75,
          timestamp: new Date(),
          dependencies: [chain.steps[1].id],
          metadata: { phase: 'evaluation' }
        });
        
        // Decision
        chain.steps.push({
          id: `step_${Date.now()}_4`,
          type: ThinkingStepType.DECISION,
          content: `Selecting best approach based on evaluation`,
          confidence: 0.8,
          timestamp: new Date(),
          dependencies: [chain.steps[2].id],
          metadata: { phase: 'decision' }
        });
        
        // Conclusion
        chain.steps.push({
          id: `step_${Date.now()}_5`,
          type: ThinkingStepType.CONCLUSION,
          content: `Providing solution with implementation guidance`,
          confidence: 0.85,
          timestamp: new Date(),
          dependencies: [chain.steps[3].id],
          metadata: { phase: 'conclusion' }
        });
        
        chain.status = 'completed';
        chain.endTime = new Date();
        chain.confidence = this.recalculateChainConfidence(chain);
        
        return chain;
      }
    });
  }

  /**
   * Add custom thinking strategy
   */
  addStrategy(strategy: ThinkingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.info(`Added thinking strategy: ${strategy.name}`);
  }

  /**
   * Remove thinking strategy
   */
  removeStrategy(name: string): boolean {
    const removed = this.strategies.delete(name);
    if (removed) {
      this.logger.info(`Removed thinking strategy: ${name}`);
    }
    return removed;
  }

  /**
   * Get cognitive load metrics
   */
  getCognitiveLoadMetrics(): CognitiveLoadMetrics {
    return { ...this.cognitiveLoadMetrics };
  }

  /**
   * Get active reasoning chains
   */
  getActiveChains(): ReasoningChain[] {
    return Array.from(this.activeChains.values());
  }

  /**
   * Get completed reasoning chains
   */
  getCompletedChains(): ReasoningChain[] {
    return [...this.completedChains];
  }

  /**
   * Get current configuration
   */
  getConfig(): ThinkingProcessingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ThinkingProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Thinking processing configuration updated');
  }

  /**
   * Clear thought cache
   */
  clearCache(): void {
    this.thoughtCache.clear();
    this.logger.info('Thought cache cleared');
  }

  /**
   * Get available strategies
   */
  getStrategies(): ThinkingStrategy[] {
    return Array.from(this.strategies.values());
  }
} 