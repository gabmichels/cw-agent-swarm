/**
 * Thinking Integration Service
 * 
 * Provides backward compatibility and convenience methods for existing thinking tool calls
 * while seamlessly integrating with the unified foundation system.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID identifiers for business logic
 * - NO string literals - use centralized constants
 * - Dependency injection throughout
 * - Preserve existing API surface
 * - Interface-first design
 */

import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { UnifiedThinkingToolSystem } from './UnifiedThinkingToolSystem';
import { ExecutionContext, ToolResult, ToolParameters } from '../../foundation/types/FoundationTypes';
import { ToolCapability } from '../../foundation/enums/ToolEnums';
import { THINKING_TOOL_NAMES } from '../../../../constants/tool-names';
import { AppError } from '../../../errors/base';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';

/**
 * Thinking Integration Service
 * 
 * Provides convenient access to thinking tools while maintaining backward compatibility
 * with existing code that expects the previous thinking tool interface.
 */
export class ThinkingIntegrationService {
  private thinkingSystem: UnifiedThinkingToolSystem;

  constructor(
    foundation: IUnifiedToolFoundation,
    private readonly logger: IStructuredLogger
  ) {
    this.thinkingSystem = new UnifiedThinkingToolSystem(foundation, logger);
  }

  /**
   * Initialize the thinking integration service
   */
  async initialize(): Promise<boolean> {
    try {
      return await this.thinkingSystem.initialize();
    } catch (error) {
      this.logger.error('Failed to initialize thinking integration service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Failed to initialize thinking integration service',
        'THINKING_INTEGRATION_INIT_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Search the web for information
   */
  async searchWeb(params: {
    query: string;
    limit?: number;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.WEB_SEARCH,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Web search execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Web search execution failed',
        'WEB_SEARCH_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Perform semantic search across knowledge base
   */
  async searchSemantic(params: {
    query: string;
    context?: string;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.SEMANTIC_SEARCH,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Semantic search execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Semantic search execution failed',
        'SEMANTIC_SEARCH_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Analyze content for insights
   */
  async analyzeContent(params: {
    content: string;
    analysisType?: string;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.CONTENT_ANALYSIS,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Content analysis execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Content analysis execution failed',
        'CONTENT_ANALYSIS_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Apply reasoning to a problem
   */
  async applyReasoning(params: {
    problem: string;
    context?: string;
    reasoningType?: string;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.REASONING_ENGINE,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Reasoning engine execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Reasoning engine execution failed',
        'REASONING_ENGINE_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Chat with LLM
   */
  async chatWithLLM(params: {
    message: string;
    model?: string;
    temperature?: number;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.LLM_CHAT,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('LLM chat execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'LLM chat execution failed',
        'LLM_CHAT_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Orchestrate a workflow
   */
  async orchestrateWorkflow(params: {
    workflow: Record<string, unknown>;
    context?: Record<string, unknown>;
  }, context?: ExecutionContext): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Execute through foundation
      return await this.thinkingSystem.foundation.executeTool(
        THINKING_TOOL_NAMES.WORKFLOW_ORCHESTRATION,
        params,
        context || this.createDefaultContext()
      );

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      this.logger.error('Workflow orchestration execution failed', {
        params,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Workflow orchestration execution failed',
        'WORKFLOW_ORCHESTRATION_EXECUTION_FAILED',
        {
          params,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Execute a tool chain for a specific goal
   */
  async executeToolChain(
    goal: string,
    availableTools: string[],
    context?: ExecutionContext
  ): Promise<ToolResult> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // For now, orchestrate using workflow orchestration tool
      return await this.orchestrateWorkflow({
        workflow: {
          goal,
          availableTools,
          steps: [] // This would be populated by a planning system
        }
      }, context);

    } catch (error) {
      this.logger.error('Tool chain execution failed', {
        goal,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Tool chain execution failed',
        'TOOL_CHAIN_EXECUTION_FAILED',
        {
          goal,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Discover tools by capability
   */
  async discoverToolsByCapability(
    capability: ToolCapability,
    context?: ExecutionContext
  ): Promise<{
    tools: string[];
    total: number;
  }> {
    try {
      if (!this.thinkingSystem.isInitialized) {
        await this.thinkingSystem.initialize();
      }

      // Use foundation discovery
      const tools = await this.thinkingSystem.foundation.discoverTools({
        capabilities: [capability]
      });

      return {
        tools: tools.map(tool => tool.name),
        total: tools.length
      };

    } catch (error) {
      this.logger.error('Tool discovery by capability failed', {
        capability,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Tool discovery by capability failed',
        'TOOL_DISCOVERY_FAILED',
        {
          capability,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    registeredTools: number;
    issues: string[];
  }> {
    try {
      return await this.thinkingSystem.getSystemHealth();
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        'Health check failed',
        'HEALTH_CHECK_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get all registered thinking tools
   */
  getRegisteredTools(): string[] {
    return this.thinkingSystem.getRegisteredTools();
  }

  /**
   * Check if the service is initialized
   */
  get isInitialized(): boolean {
    return this.thinkingSystem.isInitialized;
  }

  /**
   * Get a tool by name (deprecated - use foundation directly)
   */
  getToolByName(name: string): string | undefined {
    const tools = this.thinkingSystem.getRegisteredTools();
    return tools.find(tool => tool === name);
  }

  /**
   * Create default execution context
   */
  private createDefaultContext(): ExecutionContext {
    return {
      agentId: 'thinking-integration-service',
      userId: 'system',
      sessionId: `thinking-${Date.now()}`,
      traceId: `thinking-trace-${Date.now()}`,
      permissions: ['thinking:*'],
      capabilities: [
        ToolCapability.REASONING,
        ToolCapability.SEARCH,
        ToolCapability.SEMANTIC_ANALYSIS,
        ToolCapability.CONTENT_GENERATION,
        ToolCapability.WORKFLOW_ORCHESTRATION
      ],
      metadata: {
        source: 'thinking-integration-service',
        timestamp: new Date().toISOString()
      }
    };
  }
} 