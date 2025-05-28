/**
 * ActionExecutor.ts - Individual action execution logic
 * 
 * This component handles the execution of individual plan actions with proper
 * error handling, retry logic, and tool integration.
 */

import { ulid } from 'ulid';
import { 
  ActionExecutor as IActionExecutor,
  ActionExecutionResult,
  ActionExecutionOptions,
  ExecutionContext,
  ExecutionStatus,
  ExecutionError,
  ExecutionMetrics,
  ToolExecutionResult
} from '../interfaces/ExecutionInterfaces';
import { PlanAction } from '../../../../../../agents/shared/base/managers/PlanningManager.interface';
import { ToolManager } from '../../../../../../agents/shared/base/managers/ToolManager.interface';
import { ManagerType } from '../../../../../../agents/shared/base/managers/ManagerType';
import { AgentBase } from '../../../../../../agents/shared/base/AgentBase.interface';
import { createLogger } from '@/lib/logging/winston-logger';

/**
 * Configuration for action execution
 */
export interface ActionExecutorConfig {
  /** Default timeout for action execution (ms) */
  defaultTimeoutMs: number;
  
  /** Default maximum retry attempts */
  defaultMaxRetries: number;
  
  /** Default retry delay (ms) */
  defaultRetryDelayMs: number;
  
  /** Whether to use fallback tools by default */
  defaultUseFallbacks: boolean;
  
  /** Maximum concurrent tool executions */
  maxConcurrentTools: number;
  
  /** Enable detailed metrics collection */
  enableMetrics: boolean;
  
  /** Enable execution logging */
  enableLogging: boolean;
}

/**
 * Default configuration for action execution
 */
const DEFAULT_CONFIG: ActionExecutorConfig = {
  defaultTimeoutMs: 30000, // 30 seconds
  defaultMaxRetries: 3,
  defaultRetryDelayMs: 1000, // 1 second
  defaultUseFallbacks: true,
  maxConcurrentTools: 5,
  enableMetrics: true,
  enableLogging: true
};

/**
 * Action execution error
 */
export class ActionExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly actionId: string,
    public readonly recoverable: boolean = true,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ActionExecutionError';
  }
}

/**
 * Implementation of ActionExecutor interface
 */
export class ActionExecutor implements IActionExecutor {
  private readonly logger = createLogger({ moduleId: 'action-executor' });
  private readonly config: ActionExecutorConfig;
  private readonly activeExecutions = new Map<string, AbortController>();
  private readonly agent?: AgentBase;

  constructor(config: Partial<ActionExecutorConfig> = {}, agent?: AgentBase) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.agent = agent;
    
    if (this.config.enableLogging) {
      this.logger.info('ActionExecutor initialized', { config: this.config });
    }
  }

  /**
   * Execute a single action
   */
  async executeAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions = {}
  ): Promise<ActionExecutionResult> {
    const executionId = ulid();
    const startTime = Date.now();
    
    // Merge options with defaults
    const execOptions = this.mergeOptions(options);
    
    // Create abort controller for timeout handling
    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);
    
    try {
      if (this.config.enableLogging) {
        this.logger.info('Starting action execution', {
          executionId,
          actionId: action.id,
          actionType: action.type,
          options: execOptions
        });
      }

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        abortController.abort();
      }, execOptions.timeoutMs!);

      let result: ActionExecutionResult;
      
      try {
        // Execute action with retry logic
        result = await this.executeWithRetry(
          action,
          context,
          execOptions,
          abortController.signal
        );
      } finally {
        clearTimeout(timeoutHandle);
      }

      // Calculate execution metrics
      const executionTime = Date.now() - startTime;
      result.metrics = {
        ...result.metrics,
        executionTime,
        queueTime: 0 // TODO: Implement queue time tracking
      };

      if (this.config.enableLogging) {
        this.logger.info('Action execution completed', {
          executionId,
          actionId: action.id,
          success: result.success,
          executionTime
        });
      }

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      if (this.config.enableLogging) {
        this.logger.error('Action execution failed', {
          executionId,
          actionId: action.id,
          error: error instanceof Error ? error.message : String(error),
          executionTime
        });
      }

      return this.createErrorResult(action, error, executionTime);
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute multiple actions concurrently
   */
  async executeActionsConcurrently(
    actions: PlanAction[],
    context: ExecutionContext,
    options: ActionExecutionOptions = {}
  ): Promise<ActionExecutionResult[]> {
    if (this.config.enableLogging) {
      this.logger.info('Starting concurrent action execution', {
        actionCount: actions.length,
        maxConcurrent: this.config.maxConcurrentTools
      });
    }

    // Limit concurrency
    const chunks = this.chunkActions(actions, this.config.maxConcurrentTools);
    const results: ActionExecutionResult[] = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(action => 
        this.executeAction(action, context, options)
      );
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute actions sequentially
   */
  async executeActionsSequentially(
    actions: PlanAction[],
    context: ExecutionContext,
    options: ActionExecutionOptions = {}
  ): Promise<ActionExecutionResult[]> {
    if (this.config.enableLogging) {
      this.logger.info('Starting sequential action execution', {
        actionCount: actions.length
      });
    }

    const results: ActionExecutionResult[] = [];

    for (const action of actions) {
      const result = await this.executeAction(action, context, options);
      results.push(result);
      
      // Update shared data with action result
      if (result.success && result.output) {
        context.sharedData[`action_${action.id}_result`] = result.output;
      }
    }

    return results;
  }

  /**
   * Execute action with retry logic
   */
  private async executeWithRetry(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    let lastError: Error | null = null;
    const maxRetries = options.maxRetries || this.config.defaultMaxRetries;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw new ActionExecutionError(
          'Action execution aborted',
          'EXECUTION_ABORTED',
          action.id,
          false
        );
      }

      try {
        return await this.executeActionInternal(action, context, options, signal);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = options.retryDelayMs || this.config.defaultRetryDelayMs;
          
          if (this.config.enableLogging) {
            this.logger.warn('Action execution failed, retrying', {
              actionId: action.id,
              attempt: attempt + 1,
              maxRetries,
              delay,
              error: lastError.message
            });
          }

          await this.sleep(delay);
        }
      }
    }

    throw lastError || new ActionExecutionError(
      'Action execution failed after all retries',
      'MAX_RETRIES_EXCEEDED',
      action.id
    );
  }

  /**
   * Internal action execution logic
   */
  private async executeActionInternal(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    
    switch (action.type) {
      case 'tool_execution':
        return await this.executeToolAction(action, context, options, signal);
      
      case 'llm_query':
        return await this.executeLLMAction(action, context, options, signal);
      
      case 'analysis':
        return await this.executeAnalysisAction(action, context, options, signal);
      
      case 'research':
        return await this.executeResearchAction(action, context, options, signal);
      
      default:
        return await this.executeGenericAction(action, context, options, signal);
    }
  }

  /**
   * Execute tool-based action
   */
  private async executeToolAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    const toolManager = this.getToolManager(context);
    
    if (!toolManager) {
      throw new ActionExecutionError(
        'Tool manager not available',
        'TOOL_MANAGER_UNAVAILABLE',
        action.id,
        false
      );
    }

    const toolName = action.parameters?.toolName as string;
    const toolParams = action.parameters?.toolParams || {};

    if (!toolName) {
      throw new ActionExecutionError(
        'Tool name not specified',
        'TOOL_NAME_MISSING',
        action.id,
        false
      );
    }

    const startTime = Date.now();
    
    try {
      const toolResult = await toolManager.executeTool(toolName, toolParams);
      const executionTime = Date.now() - startTime;

      const toolExecutionResult: ToolExecutionResult = {
        toolName,
        success: toolResult.success,
        output: (toolResult as any).data,
        error: toolResult.error ? {
          message: toolResult.error.message || String(toolResult.error),
          code: 'TOOL_EXECUTION_ERROR',
          recoverable: true
        } : undefined,
        executionTime,
        resourceUsage: {
          apiCalls: 1,
          tokensUsed: 0 // TODO: Extract from tool result if available
        }
      };

      return {
        actionId: action.id,
        success: toolResult.success,
        output: (toolResult as any).data,
        metrics: {
          executionTime,
          queueTime: 0,
          apiCalls: 1
        },
        toolResults: [toolExecutionResult],
        metadata: {
          toolName,
          toolParams,
          executedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new ActionExecutionError(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'TOOL_EXECUTION_FAILED',
        action.id,
        true,
        { toolName, toolParams }
      );
    }
  }

  /**
   * Execute LLM-based action
   */
  private async executeLLMAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    const agent = this.getAgent(context);
    
    if (!agent || !('getLLMResponse' in agent)) {
      throw new ActionExecutionError(
        'LLM capability not available',
        'LLM_UNAVAILABLE',
        action.id,
        false
      );
    }

    const prompt = this.buildLLMPrompt(action, context);
    const startTime = Date.now();

    try {
      const llmResponse = await (agent as any).getLLMResponse(prompt, {
        temperature: 0.3,
        maxTokens: 1000
      });

      const executionTime = Date.now() - startTime;

      return {
        actionId: action.id,
        success: true,
        output: llmResponse.content,
        metrics: {
          executionTime,
          queueTime: 0,
          tokensUsed: llmResponse.usage?.total_tokens || 0,
          apiCalls: 1
        },
        metadata: {
          prompt: prompt.substring(0, 200) + '...',
          llmModel: llmResponse.model || 'unknown',
          executedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      throw new ActionExecutionError(
        `LLM execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'LLM_EXECUTION_FAILED',
        action.id,
        true,
        { prompt: prompt.substring(0, 200) }
      );
    }
  }

  /**
   * Execute analysis action
   */
  private async executeAnalysisAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    // Get previous tool results for analysis
    const toolResults = this.getToolResultsFromContext(context);
    const analysisPrompt = this.buildAnalysisPrompt(action, toolResults);
    
    // Execute as LLM action with analysis-specific prompt
    const modifiedAction = {
      ...action,
      parameters: {
        ...action.parameters,
        prompt: analysisPrompt
      }
    };

    return await this.executeLLMAction(modifiedAction, context, options, signal);
  }

  /**
   * Execute research action
   */
  private async executeResearchAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    // Get available research data
    const researchData = this.getResearchDataFromContext(context);
    const researchPrompt = this.buildResearchPrompt(action, researchData);
    
    // Execute as LLM action with research-specific prompt
    const modifiedAction = {
      ...action,
      parameters: {
        ...action.parameters,
        prompt: researchPrompt
      }
    };

    return await this.executeLLMAction(modifiedAction, context, options, signal);
  }

  /**
   * Execute generic action
   */
  private async executeGenericAction(
    action: PlanAction,
    context: ExecutionContext,
    options: ActionExecutionOptions,
    signal: AbortSignal
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();
    
    // For generic actions, provide a basic execution result
    const executionTime = Date.now() - startTime;

    return {
      actionId: action.id,
      success: true,
      output: `Executed ${action.type} action: ${action.description}`,
      metrics: {
        executionTime,
        queueTime: 0
      },
      metadata: {
        actionType: action.type,
        executedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Build LLM prompt for action
   */
  private buildLLMPrompt(action: PlanAction, context: ExecutionContext): string {
    const basePrompt = action.description;
    const contextData = this.getRelevantContextData(context);
    
    if (Object.keys(contextData).length === 0) {
      return basePrompt;
    }

    return `${basePrompt}

Available Context Data:
${JSON.stringify(contextData, null, 2)}

Please complete the task using the available context data.`;
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(action: PlanAction, toolResults: ToolExecutionResult[]): string {
    return `You are an expert analyst. Analyze the following data and provide comprehensive insights.

TASK: ${action.description}

DATA TO ANALYZE:
${toolResults.map((result, index) => `
Source ${index + 1}: ${result.toolName}
Status: ${result.success ? 'Success' : 'Failed'}
${result.success ? `Data: ${JSON.stringify(result.output, null, 2)}` : `Error: ${result.error?.message}`}
`).join('\n')}

Provide a detailed analysis with specific insights, patterns, and actionable recommendations.`;
  }

  /**
   * Build research prompt
   */
  private buildResearchPrompt(action: PlanAction, researchData: Record<string, unknown>): string {
    return `You are a research specialist. Create a comprehensive research report based on the available data.

RESEARCH OBJECTIVE: ${action.description}

AVAILABLE RESEARCH DATA:
${JSON.stringify(researchData, null, 2)}

Create a thorough research report with findings, analysis, and conclusions.`;
  }

  /**
   * Get tool manager from context
   */
  private getToolManager(context: ExecutionContext): ToolManager | null {
    // First try to get from agent reference
    if (this.agent) {
      return this.agent.getManager(ManagerType.TOOL) as ToolManager;
    }
    
    // Fallback to context agent
    const agent = this.getAgent(context);
    return agent?.getManager(ManagerType.TOOL) || null;
  }

  /**
   * Get agent from context
   */
  private getAgent(context: ExecutionContext): any {
    // The agent should be available through the execution context
    // This is a simplified implementation - in practice, the agent reference
    // would be passed through the context or stored in the executor
    return (context as any).agent || null;
  }

  /**
   * Get tool results from context
   */
  private getToolResultsFromContext(context: ExecutionContext): ToolExecutionResult[] {
    const results: ToolExecutionResult[] = [];
    
    for (const [key, value] of Object.entries(context.sharedData)) {
      if (key.includes('tool_result') && value) {
        results.push(value as ToolExecutionResult);
      }
    }
    
    return results;
  }

  /**
   * Get research data from context
   */
  private getResearchDataFromContext(context: ExecutionContext): Record<string, unknown> {
    const researchData: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context.sharedData)) {
      if (key.includes('research') || key.includes('data') || key.includes('result')) {
        researchData[key] = value;
      }
    }
    
    return researchData;
  }

  /**
   * Get relevant context data
   */
  private getRelevantContextData(context: ExecutionContext): Record<string, unknown> {
    // Filter out internal execution data and return only relevant context
    const relevantData: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context.sharedData)) {
      if (!key.startsWith('_internal_') && value !== null && value !== undefined) {
        relevantData[key] = value;
      }
    }
    
    return relevantData;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    action: PlanAction,
    error: unknown,
    executionTime: number
  ): ActionExecutionResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      actionId: action.id,
      success: false,
      output: undefined,
      metrics: {
        executionTime,
        queueTime: 0
      },
      metadata: {
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        executedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Merge execution options with defaults
   */
  private mergeOptions(options: ActionExecutionOptions): Required<ActionExecutionOptions> {
    return {
      timeoutMs: options.timeoutMs || this.config.defaultTimeoutMs,
      maxRetries: options.maxRetries || this.config.defaultMaxRetries,
      retryDelayMs: options.retryDelayMs || this.config.defaultRetryDelayMs,
      useFallbacks: options.useFallbacks ?? this.config.defaultUseFallbacks,
      context: options.context || {},
      resourceConstraints: options.resourceConstraints || {}
    };
  }

  /**
   * Chunk actions for concurrent execution
   */
  private chunkActions(actions: PlanAction[], chunkSize: number): PlanAction[][] {
    const chunks: PlanAction[][] = [];
    
    for (let i = 0; i < actions.length; i += chunkSize) {
      chunks.push(actions.slice(i, i + chunkSize));
    }
    
    return chunks;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): ActionExecutorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(newConfig: Partial<ActionExecutorConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (this.config.enableLogging) {
      this.logger.info('ActionExecutor configuration updated', { config: this.config });
    }
  }

  /**
   * Cancel all active executions
   */
  cancelAllExecutions(): void {
    for (const [executionId, controller] of this.activeExecutions) {
      controller.abort();
      
      if (this.config.enableLogging) {
        this.logger.info('Cancelled action execution', { executionId });
      }
    }
    
    this.activeExecutions.clear();
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    activeExecutions: number;
    config: ActionExecutorConfig;
  } {
    return {
      healthy: true,
      activeExecutions: this.activeExecutions.size,
      config: this.config
    };
  }
} 