/**
 * Tool Composition Engine - Phase 3.2 Implementation
 * 
 * Automatically composes multi-tool workflows with dependency management,
 * parallel execution, and intelligent orchestration.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic tracking
 * - Structured error handling with context
 * - Pure function composition algorithms
 * - Immutable data structures
 * - Comprehensive logging and metrics
 * 
 * Phase 3.2 Features:
 * - Automatic tool composition and chaining
 * - Dependency resolution and parallel execution
 * - Workflow optimization and caching
 * - Reusable tool patterns and templates
 * - Dynamic workflow adaptation
 */

import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import { IToolDiscoveryService } from '../interfaces/ToolDiscoveryServiceInterface';
import { IUnifiedToolExecutor } from '../interfaces/UnifiedToolExecutorInterface';
import {
  UnifiedTool,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolIdentifier,
  SearchContext
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability } from '../enums/ToolEnums';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';
import { ToolExecutionError, ToolNotFoundError } from '../errors/ToolFoundationErrors';
import { ulid } from 'ulid';

/**
 * Tool composition step with dependency management
 */
export interface CompositionStep {
  readonly stepId: string;
  readonly tool: UnifiedTool;
  readonly parameters: ToolParameters;
  readonly dependsOn: readonly string[];
  readonly outputMapping?: Record<string, string>;
  readonly timeout?: number;
  readonly retryPolicy?: {
    readonly maxRetries: number;
    readonly backoffMs: number;
    readonly retryableErrors: readonly string[];
  };
  readonly parallelizable: boolean;
  readonly optional: boolean;
  readonly condition?: string; // Simple condition for conditional execution
}

/**
 * Complete composition plan with metadata
 */
export interface CompositionPlan {
  readonly compositionId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly CompositionStep[];
  readonly estimatedTotalTime: number;
  readonly complexity: 'low' | 'medium' | 'high';
  readonly successProbability: number;
  readonly resourceRequirements: {
    readonly cpu: 'low' | 'medium' | 'high';
    readonly memory: 'low' | 'medium' | 'high';
    readonly network: 'low' | 'medium' | 'high';
  };
  readonly tags: readonly string[];
  readonly template?: string; // Reference to reusable template
}

/**
 * Composition execution result
 */
export interface CompositionResult {
  readonly compositionId: string;
  readonly executionId: string;
  readonly success: boolean;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly results: readonly {
    readonly stepId: string;
    readonly result: ToolResult;
    readonly executionOrder: number;
  }[];
  readonly errors: readonly {
    readonly stepId: string;
    readonly error: string;
    readonly retryCount: number;
  }[];
  readonly totalExecutionTime: number;
  readonly parallelExecutions: number;
  readonly cacheHits: number;
}

/**
 * Reusable composition template
 */
export interface CompositionTemplate {
  readonly templateId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly steps: readonly {
    readonly tool: string; // Tool name
    readonly parameters: Record<string, any>; // Template parameters
    readonly dependsOn: readonly string[];
    readonly parallelizable: boolean;
    readonly optional: boolean;
  }[];
  readonly requiredCapabilities: readonly ToolCapability[];
  readonly estimatedTime: number;
  readonly complexity: 'low' | 'medium' | 'high';
  readonly tags: readonly string[];
}

/**
 * Tool pattern for common operations
 */
export interface ToolPattern {
  readonly patternId: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: string; // Intent pattern that triggers this
  readonly tools: readonly string[]; // Tool names in order
  readonly parameterMapping: Record<string, string>;
  readonly successCriteria: readonly string[];
  readonly fallbackPattern?: string; // Alternative pattern if this fails
}

/**
 * Tool Composition Engine Implementation
 */
export class ToolCompositionEngine {
  // Predefined composition templates
  private readonly compositionTemplates: readonly CompositionTemplate[] = [
    {
      templateId: 'social-media-research-post',
      name: 'Social Media Research & Post',
      description: 'Research topic, generate content, and post to social media',
      category: 'social-media',
      steps: [
        {
          tool: 'web_search',
          parameters: { query: '{{topic}}' },
          dependsOn: [],
          parallelizable: false,
          optional: false
        },
        {
          tool: 'content_analysis',
          parameters: { content: '{{step1.data}}' },
          dependsOn: ['step1'],
          parallelizable: false,
          optional: false
        },
        {
          tool: 'create_text_post',
          parameters: { content: '{{step2.summary}}', platform: '{{platform}}' },
          dependsOn: ['step2'],
          parallelizable: false,
          optional: false
        }
      ],
      requiredCapabilities: [ToolCapability.WEB_SEARCH, ToolCapability.CONTENT_ANALYSIS, ToolCapability.SOCIAL_MEDIA_POST],
      estimatedTime: 30000,
      complexity: 'medium',
      tags: ['social-media', 'research', 'content-creation']
    },
    {
      templateId: 'email-campaign-analytics',
      name: 'Email Campaign with Analytics',
      description: 'Send email campaign and analyze engagement metrics',
      category: 'email-marketing',
      steps: [
        {
          tool: 'send_email',
          parameters: { to: '{{recipients}}', subject: '{{subject}}', body: '{{body}}' },
          dependsOn: [],
          parallelizable: true,
          optional: false
        },
        {
          tool: 'track_email_metrics',
          parameters: { campaignId: '{{step1.campaignId}}' },
          dependsOn: ['step1'],
          parallelizable: false,
          optional: true
        },
        {
          tool: 'analyze_engagement',
          parameters: { metrics: '{{step2.data}}' },
          dependsOn: ['step2'],
          parallelizable: false,
          optional: true
        }
      ],
      requiredCapabilities: [ToolCapability.EMAIL_SEND, ToolCapability.ANALYTICS],
      estimatedTime: 45000,
      complexity: 'medium',
      tags: ['email', 'marketing', 'analytics']
    },
    {
      templateId: 'research-document-workflow',
      name: 'Research & Document Creation',
      description: 'Research topic, create structured document, and store in workspace',
      category: 'research',
      steps: [
        {
          tool: 'web_search',
          parameters: { query: '{{topic}}' },
          dependsOn: [],
          parallelizable: false,
          optional: false
        },
        {
          tool: 'semantic_search',
          parameters: { query: '{{topic}}', sources: '{{additional_sources}}' },
          dependsOn: [],
          parallelizable: true,
          optional: true
        },
        {
          tool: 'create_spreadsheet',
          parameters: { title: '{{title}}', data: '{{step1.data}}' },
          dependsOn: ['step1'],
          parallelizable: false,
          optional: false
        },
        {
          tool: 'share_file',
          parameters: { fileId: '{{step3.fileId}}', permissions: '{{permissions}}' },
          dependsOn: ['step3'],
          parallelizable: false,
          optional: true
        }
      ],
      requiredCapabilities: [ToolCapability.WEB_SEARCH, ToolCapability.DOCUMENT_CREATE, ToolCapability.FILE_SHARE],
      estimatedTime: 60000,
      complexity: 'high',
      tags: ['research', 'documentation', 'collaboration']
    }
  ];

  // Common tool patterns
  private readonly toolPatterns: readonly ToolPattern[] = [
    {
      patternId: 'send-email-pattern',
      name: 'Send Email Pattern',
      description: 'Send email with content generation if needed',
      trigger: 'send email',
      tools: ['smart_send_email'],
      parameterMapping: {
        'to': 'recipient',
        'subject': 'subject',
        'body': 'content'
      },
      successCriteria: ['email_sent'],
      fallbackPattern: 'basic-email-pattern'
    },
    {
      patternId: 'social-post-pattern',
      name: 'Social Media Post Pattern',
      description: 'Create and post content to social media',
      trigger: 'post to social media',
      tools: ['create_text_post', 'schedule_post'],
      parameterMapping: {
        'content': 'text',
        'platform': 'platform',
        'schedule': 'time'
      },
      successCriteria: ['post_created'],
      fallbackPattern: 'simple-post-pattern'
    },
    {
      patternId: 'research-pattern',
      name: 'Research Pattern',
      description: 'Comprehensive research with multiple sources',
      trigger: 'research',
      tools: ['web_search', 'semantic_search', 'content_analysis'],
      parameterMapping: {
        'topic': 'query',
        'sources': 'additional_sources'
      },
      successCriteria: ['research_complete'],
      fallbackPattern: 'basic-search-pattern'
    }
  ];

  // Execution state tracking
  private readonly activeCompositions = new Map<string, {
    plan: CompositionPlan;
    startTime: number;
    completedSteps: Set<string>;
    results: Map<string, ToolResult>;
    errors: Map<string, { error: string; retryCount: number }>;
  }>();

  // Performance metrics
  private readonly compositionMetrics = new Map<string, {
    executionCount: number;
    averageExecutionTime: number;
    successRate: number;
    lastExecuted: Date;
  }>();

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly discoveryService: IToolDiscoveryService,
    private readonly executor: IUnifiedToolExecutor,
    private readonly logger: IStructuredLogger
  ) { }

  /**
   * Automatically compose tools for a given workflow intent
   */
  async composeWorkflow(
    intent: string,
    parameters: ToolParameters,
    context: ExecutionContext,
    options?: {
      readonly useTemplates?: boolean;
      readonly maxSteps?: number;
      readonly optimization?: 'speed' | 'reliability' | 'cost';
      readonly allowParallel?: boolean;
    }
  ): Promise<CompositionPlan> {
    const compositionId = ulid();
    const effectiveOptions = {
      useTemplates: true,
      maxSteps: 10,
      optimization: 'balanced' as const,
      allowParallel: true,
      ...options
    };

    try {
      await this.logger.info('Starting workflow composition', {
        compositionId,
        intent,
        options: effectiveOptions
      });

      // Step 1: Check for matching templates
      if (effectiveOptions.useTemplates) {
        const matchingTemplate = this.findMatchingTemplate(intent, context);
        if (matchingTemplate) {
          const plan = await this.createPlanFromTemplate(matchingTemplate, parameters, context);
          await this.logger.info('Composition plan created from template', {
            compositionId,
            templateId: matchingTemplate.templateId,
            stepCount: plan.steps.length
          });
          return plan;
        }
      }

      // Step 2: Check for matching patterns
      const matchingPattern = this.findMatchingPattern(intent);
      if (matchingPattern) {
        const plan = await this.createPlanFromPattern(matchingPattern, parameters, context);
        await this.logger.info('Composition plan created from pattern', {
          compositionId,
          patternId: matchingPattern.patternId,
          stepCount: plan.steps.length
        });
        return plan;
      }

      // Step 3: Dynamic composition
      const plan = await this.createDynamicComposition(intent, parameters, context, effectiveOptions);
      await this.logger.info('Dynamic composition plan created', {
        compositionId,
        stepCount: plan.steps.length,
        complexity: plan.complexity
      });

      return plan;

    } catch (error) {
      await this.logger.error('Workflow composition failed', {
        compositionId,
        intent,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolExecutionError(
        `Failed to compose workflow for intent: ${intent}`,
        {
          toolId: compositionId,
          toolName: 'composition-engine',
          parameters: { intent },
          executionTimeMs: 0
        }
      );
    }
  }

  /**
   * Execute a composition plan with intelligent orchestration
   */
  async executeComposition(
    plan: CompositionPlan,
    context: ExecutionContext
  ): Promise<CompositionResult> {
    const executionId = ulid();
    const startTime = Date.now();

    try {
      await this.logger.info('Starting composition execution', {
        executionId,
        compositionId: plan.compositionId,
        stepCount: plan.steps.length
      });

      // Initialize execution state
      this.activeCompositions.set(executionId, {
        plan,
        startTime,
        completedSteps: new Set(),
        results: new Map(),
        errors: new Map()
      });

      // Execute steps with dependency resolution
      const executionResults = await this.executeStepsWithDependencies(plan.steps, context, executionId);

      // Calculate final results
      const totalExecutionTime = Date.now() - startTime;
      const completedSteps = executionResults.filter(r => r.result.success).length;
      const parallelExecutions = this.countParallelExecutions(plan.steps);
      const cacheHits = executionResults.filter(r => r.result.metadata?.context?.cached).length;

      const result: CompositionResult = {
        compositionId: plan.compositionId,
        executionId,
        success: completedSteps === plan.steps.length,
        completedSteps,
        totalSteps: plan.steps.length,
        results: executionResults,
        errors: Array.from(this.activeCompositions.get(executionId)?.errors.entries() || [])
          .map(([stepId, errorInfo]) => ({
            stepId,
            error: errorInfo.error,
            retryCount: errorInfo.retryCount
          })),
        totalExecutionTime,
        parallelExecutions,
        cacheHits
      };

      // Update metrics
      this.updateCompositionMetrics(plan.compositionId, result);

      // Clean up execution state
      this.activeCompositions.delete(executionId);

      await this.logger.info('Composition execution completed', {
        executionId,
        compositionId: plan.compositionId,
        success: result.success,
        completedSteps: result.completedSteps,
        totalExecutionTime
      });

      return result;

    } catch (error) {
      this.activeCompositions.delete(executionId);

      await this.logger.error('Composition execution failed', {
        executionId,
        compositionId: plan.compositionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolExecutionError(
        `Composition execution failed: ${plan.name}`,
        {
          toolId: plan.compositionId,
          toolName: 'composition-executor',
          parameters: { planId: plan.compositionId },
          executionTimeMs: Date.now() - startTime
        }
      );
    }
  }

  /**
   * Get available composition templates
   */
  getCompositionTemplates(category?: string): readonly CompositionTemplate[] {
    if (category) {
      return this.compositionTemplates.filter(template => template.category === category);
    }
    return this.compositionTemplates;
  }

  /**
   * Get available tool patterns
   */
  getToolPatterns(): readonly ToolPattern[] {
    return this.toolPatterns;
  }

  // Private helper methods

  private findMatchingTemplate(intent: string, context: ExecutionContext): CompositionTemplate | null {
    const intentLower = intent.toLowerCase();

    for (const template of this.compositionTemplates) {
      // Check if template tags match intent keywords
      const matchingTags = template.tags.filter(tag =>
        intentLower.includes(tag.toLowerCase())
      );

      if (matchingTags.length > 0) {
        // Check if required capabilities are available
        const hasRequiredCapabilities = template.requiredCapabilities.every(cap =>
          context.capabilities?.includes(cap)
        );

        if (hasRequiredCapabilities || !context.capabilities) {
          return template;
        }
      }
    }

    return null;
  }

  private findMatchingPattern(intent: string): ToolPattern | null {
    const intentLower = intent.toLowerCase();

    for (const pattern of this.toolPatterns) {
      if (intentLower.includes(pattern.trigger.toLowerCase())) {
        return pattern;
      }
    }

    return null;
  }

  private async createPlanFromTemplate(
    template: CompositionTemplate,
    parameters: ToolParameters,
    context: ExecutionContext
  ): Promise<CompositionPlan> {
    const compositionId = ulid();

    // Resolve tools from template
    const steps: CompositionStep[] = [];

    for (let i = 0; i < template.steps.length; i++) {
      const templateStep = template.steps[i];
      const tool = await this.registry.getTool(templateStep.tool);

      if (!tool) {
        throw new ToolNotFoundError(`Template tool not found: ${templateStep.tool}`, {
          identifier: templateStep.tool
        });
      }

      const stepId = `step${i + 1}`;
      steps.push({
        stepId,
        tool,
        parameters: this.resolveTemplateParameters(templateStep.parameters, parameters),
        dependsOn: templateStep.dependsOn,
        parallelizable: templateStep.parallelizable,
        optional: templateStep.optional,
        timeout: 30000,
        retryPolicy: {
          maxRetries: 2,
          backoffMs: 1000,
          retryableErrors: ['timeout', 'network']
        }
      });
    }

    return {
      compositionId,
      name: template.name,
      description: template.description,
      steps,
      estimatedTotalTime: template.estimatedTime,
      complexity: template.complexity,
      successProbability: this.calculateSuccessProbability(steps),
      resourceRequirements: this.calculateResourceRequirements(steps),
      tags: template.tags,
      template: template.templateId
    };
  }

  private async createPlanFromPattern(
    pattern: ToolPattern,
    parameters: ToolParameters,
    context: ExecutionContext
  ): Promise<CompositionPlan> {
    const compositionId = ulid();

    // Resolve tools from pattern
    const steps: CompositionStep[] = [];

    for (let i = 0; i < pattern.tools.length; i++) {
      const toolName = pattern.tools[i];
      const tool = await this.registry.getTool(toolName);

      if (!tool) {
        throw new ToolNotFoundError(`Pattern tool not found: ${toolName}`, {
          identifier: toolName
        });
      }

      const stepId = `step${i + 1}`;
      const mappedParameters = this.mapPatternParameters(pattern.parameterMapping, parameters);

      steps.push({
        stepId,
        tool,
        parameters: mappedParameters,
        dependsOn: i > 0 ? [`step${i}`] : [],
        parallelizable: false,
        optional: false,
        timeout: 30000,
        retryPolicy: {
          maxRetries: 2,
          backoffMs: 1000,
          retryableErrors: ['timeout', 'network']
        }
      });
    }

    return {
      compositionId,
      name: pattern.name,
      description: pattern.description,
      steps,
      estimatedTotalTime: steps.length * 15000, // Estimate 15s per step
      complexity: steps.length <= 2 ? 'low' : steps.length <= 4 ? 'medium' : 'high',
      successProbability: this.calculateSuccessProbability(steps),
      resourceRequirements: this.calculateResourceRequirements(steps),
      tags: [pattern.patternId]
    };
  }

  private async createDynamicComposition(
    intent: string,
    parameters: ToolParameters,
    context: ExecutionContext,
    options: any
  ): Promise<CompositionPlan> {
    const compositionId = ulid();

    // Discover relevant tools
    const relevantTools = await this.discoveryService.discoverTools({
      categories: [],
      capabilities: context.capabilities || [],
      intent,
      maxResults: options.maxSteps
    });

    if (relevantTools.length === 0) {
      throw new ToolNotFoundError(`No tools found for dynamic composition: ${intent}`, {
        identifier: intent,
        searchCriteria: { intent }
      });
    }

    // Create steps from discovered tools
    const steps: CompositionStep[] = relevantTools.slice(0, options.maxSteps).map((tool, index) => ({
      stepId: `step${index + 1}`,
      tool,
      parameters: this.extractRelevantParameters(tool, parameters),
      dependsOn: index > 0 ? [`step${index}`] : [],
      parallelizable: options.allowParallel && index > 1,
      optional: index > 2, // Make later steps optional
      timeout: 30000,
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1000,
        retryableErrors: ['timeout', 'network']
      }
    }));

    return {
      compositionId,
      name: `Dynamic Composition: ${intent}`,
      description: `Dynamically composed workflow for: ${intent}`,
      steps,
      estimatedTotalTime: this.calculateTotalExecutionTime(steps),
      complexity: this.calculateComplexity(steps),
      successProbability: this.calculateSuccessProbability(steps),
      resourceRequirements: this.calculateResourceRequirements(steps),
      tags: ['dynamic', 'auto-generated']
    };
  }

  private async executeStepsWithDependencies(
    steps: readonly CompositionStep[],
    context: ExecutionContext,
    executionId: string
  ): Promise<readonly { stepId: string; result: ToolResult; executionOrder: number }[]> {
    const results: { stepId: string; result: ToolResult; executionOrder: number }[] = [];
    const executionState = this.activeCompositions.get(executionId);

    if (!executionState) {
      throw new Error(`Execution state not found: ${executionId}`);
    }

    let executionOrder = 0;
    const pendingSteps = new Set(steps.map(s => s.stepId));

    while (pendingSteps.size > 0) {
      // Find steps that can be executed (dependencies met)
      const executableSteps = steps.filter(step =>
        pendingSteps.has(step.stepId) &&
        step.dependsOn.every(depId => executionState.completedSteps.has(depId))
      );

      if (executableSteps.length === 0) {
        // No more executable steps - check for circular dependencies
        throw new ToolExecutionError(
          `Circular dependency detected in composition steps`,
          {
            toolId: executionState.plan.compositionId,
            toolName: 'composition-engine',
            parameters: { pendingSteps: Array.from(pendingSteps) },
            executionTimeMs: 0
          }
        );
      }

      // Execute steps (potentially in parallel)
      const stepPromises = executableSteps.map(async (step) => {
        try {
          // Check condition if present
          if (step.condition && !this.evaluateCondition(step.condition, executionState.results)) {
            return {
              stepId: step.stepId,
              result: {
                success: true,
                data: null,
                metadata: {
                  executionTimeMs: 0,
                  toolId: step.tool.id,
                  toolName: step.tool.name,
                  timestamp: new Date().toISOString(),
                  context: { skipped: true }
                }
              },
              executionOrder: ++executionOrder
            };
          }

          // Execute step with retry policy
          const result = await this.executeStepWithRetry(step, executionState.results, context);

          // Store result
          executionState.results.set(step.stepId, result);
          executionState.completedSteps.add(step.stepId);

          return {
            stepId: step.stepId,
            result,
            executionOrder: ++executionOrder
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          if (step.optional) {
            // Optional step failed - continue
            await this.logger.warn('Optional step failed', {
              stepId: step.stepId,
              error: errorMessage
            });

            return {
              stepId: step.stepId,
              result: {
                success: false,
                data: null,
                error: `Optional step failed: ${errorMessage}`,
                metadata: {
                  executionTimeMs: 0,
                  toolId: step.tool.id,
                  toolName: step.tool.name,
                  timestamp: new Date().toISOString(),
                  context: { optional: true, failed: true }
                }
              },
              executionOrder: ++executionOrder
            };
          } else {
            // Required step failed - record error
            executionState.errors.set(step.stepId, {
              error: errorMessage,
              retryCount: 0
            });

            throw error;
          }
        }
      });

      // Wait for all executable steps to complete
      const stepResults = await Promise.all(stepPromises);
      results.push(...stepResults);

      // Remove completed steps from pending
      stepResults.forEach(result => {
        pendingSteps.delete(result.stepId);
      });
    }

    return results;
  }

  private async executeStepWithRetry(
    step: CompositionStep,
    previousResults: Map<string, ToolResult>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const maxRetries = step.retryPolicy?.maxRetries || 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Resolve parameters with previous step results
        const resolvedParameters = this.resolveStepParameters(step.parameters, previousResults);

        // Execute tool
        const result = await this.executor.execute(step.tool, resolvedParameters, context);

        if (result.success) {
          return result;
        } else if (attempt < maxRetries) {
          // Wait before retry
          await this.delay(step.retryPolicy?.backoffMs || 1000);
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Check if error is retryable
        const isRetryable = step.retryPolicy?.retryableErrors.some(retryableError =>
          lastError?.message.toLowerCase().includes(retryableError.toLowerCase())
        ) || false;

        if (!isRetryable || attempt >= maxRetries) {
          throw lastError;
        }

        // Wait before retry
        await this.delay(step.retryPolicy?.backoffMs || 1000);
      }
    }

    throw lastError || new Error('Step execution failed after retries');
  }

  // Helper methods

  private resolveTemplateParameters(
    templateParams: Record<string, any>,
    actualParams: ToolParameters
  ): ToolParameters {
    const resolved: ToolParameters = {};

    for (const [key, value] of Object.entries(templateParams)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const paramName = value.slice(2, -2);
        resolved[key] = actualParams[paramName] || value;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private mapPatternParameters(
    mapping: Record<string, string>,
    parameters: ToolParameters
  ): ToolParameters {
    const mapped: ToolParameters = {};

    for (const [toolParam, userParam] of Object.entries(mapping)) {
      if (parameters[userParam] !== undefined) {
        mapped[toolParam] = parameters[userParam];
      }
    }

    return mapped;
  }

  private extractRelevantParameters(tool: UnifiedTool, parameters: ToolParameters): ToolParameters {
    // Simple parameter extraction - could be enhanced with schema matching
    const relevant: ToolParameters = {};

    for (const [key, value] of Object.entries(parameters)) {
      // Include parameter if it might be relevant to the tool
      if (tool.parameters?.properties && Object.keys(tool.parameters.properties).includes(key)) {
        relevant[key] = value;
      }
    }

    return relevant;
  }

  private resolveStepParameters(
    parameters: ToolParameters,
    previousResults: Map<string, ToolResult>
  ): ToolParameters {
    const resolved: ToolParameters = {};

    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string' && value.includes('{{')) {
        // Simple template resolution
        let resolvedValue = value;
        for (const [stepId, result] of previousResults.entries()) {
          const placeholder = `{{${stepId}.data}}`;
          if (resolvedValue.includes(placeholder)) {
            resolvedValue = resolvedValue.replace(placeholder, JSON.stringify(result.data));
          }
        }
        resolved[key] = resolvedValue;
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private evaluateCondition(condition: string, results: Map<string, ToolResult>): boolean {
    // Simple condition evaluation - could be enhanced with expression parser
    return true; // Placeholder implementation
  }

  private calculateTotalExecutionTime(steps: readonly CompositionStep[]): number {
    return steps.reduce((total, step) => total + (step.timeout || 30000), 0);
  }

  private calculateComplexity(steps: readonly CompositionStep[]): 'low' | 'medium' | 'high' {
    const stepCount = steps.length;
    const parallelSteps = steps.filter(s => s.parallelizable).length;
    const dependencyCount = steps.reduce((count, step) => count + step.dependsOn.length, 0);

    if (stepCount <= 2 && dependencyCount <= 1) return 'low';
    if (stepCount <= 5 && dependencyCount <= 3 && parallelSteps <= 2) return 'medium';
    return 'high';
  }

  private calculateSuccessProbability(steps: readonly CompositionStep[]): number {
    const requiredSteps = steps.filter(s => !s.optional).length;
    const optionalSteps = steps.filter(s => s.optional).length;

    // Base probability decreases with more required steps
    const baseProbability = Math.max(0.5, 1 - (requiredSteps * 0.1));

    // Optional steps don't affect success probability as much
    const optionalPenalty = optionalSteps * 0.05;

    return Math.max(0.3, baseProbability - optionalPenalty);
  }

  private calculateResourceRequirements(steps: readonly CompositionStep[]): {
    readonly cpu: 'low' | 'medium' | 'high';
    readonly memory: 'low' | 'medium' | 'high';
    readonly network: 'low' | 'medium' | 'high';
  } {
    const stepCount = steps.length;
    const parallelSteps = steps.filter(s => s.parallelizable).length;

    return {
      cpu: stepCount <= 2 ? 'low' : stepCount <= 5 ? 'medium' : 'high',
      memory: (stepCount + parallelSteps) <= 3 ? 'low' : (stepCount + parallelSteps) <= 6 ? 'medium' : 'high',
      network: stepCount <= 2 ? 'low' : stepCount <= 4 ? 'medium' : 'high'
    };
  }

  private countParallelExecutions(steps: readonly CompositionStep[]): number {
    return steps.filter(s => s.parallelizable).length;
  }

  private updateCompositionMetrics(compositionId: string, result: CompositionResult): void {
    const current = this.compositionMetrics.get(compositionId) || {
      executionCount: 0,
      averageExecutionTime: 0,
      successRate: 0,
      lastExecuted: new Date()
    };

    const newExecutionCount = current.executionCount + 1;
    const newAverageTime = ((current.averageExecutionTime * current.executionCount) +
      result.totalExecutionTime) / newExecutionCount;
    const newSuccessRate = ((current.successRate * current.executionCount) +
      (result.success ? 1 : 0)) / newExecutionCount;

    this.compositionMetrics.set(compositionId, {
      executionCount: newExecutionCount,
      averageExecutionTime: newAverageTime,
      successRate: newSuccessRate,
      lastExecuted: new Date()
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public API methods for monitoring and management
   */

  async getCompositionMetrics(): Promise<readonly {
    compositionId: string;
    executionCount: number;
    averageExecutionTime: number;
    successRate: number;
    lastExecuted: Date;
  }[]> {
    return Array.from(this.compositionMetrics.entries()).map(([compositionId, metrics]) => ({
      compositionId,
      ...metrics
    }));
  }

  async getActiveCompositions(): Promise<readonly {
    executionId: string;
    compositionId: string;
    startTime: number;
    completedSteps: number;
    totalSteps: number;
  }[]> {
    return Array.from(this.activeCompositions.entries()).map(([executionId, state]) => ({
      executionId,
      compositionId: state.plan.compositionId,
      startTime: state.startTime,
      completedSteps: state.completedSteps.size,
      totalSteps: state.plan.steps.length
    }));
  }

  async cancelComposition(executionId: string): Promise<boolean> {
    const state = this.activeCompositions.get(executionId);
    if (state) {
      this.activeCompositions.delete(executionId);
      await this.logger.info('Composition cancelled', { executionId });
      return true;
    }
    return false;
  }
} 