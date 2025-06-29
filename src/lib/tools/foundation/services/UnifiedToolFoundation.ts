/**
 * Unified Tool Foundation - Core Implementation
 * 
 * Main implementation of the unified tool foundation that provides a single
 * entry point for all tool operations across specialized systems while
 * maintaining their domain expertise and performance characteristics.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID identifiers for business logic
 * - Dependency injection throughout
 * - Comprehensive error handling
 * - Performance optimization
 * - Interface-first design
 */

import { IUnifiedToolFoundation } from '../interfaces/UnifiedToolFoundationInterface';
import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import { IUnifiedToolExecutor } from '../interfaces/UnifiedToolExecutorInterface';
import { IToolDiscoveryService } from '../interfaces/ToolDiscoveryServiceInterface';
import { IToolValidationService } from '../interfaces/ToolValidationServiceInterface';
import {
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolId,
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolHealthStatus,
  ToolMetrics,
  ValidationResult,
  ToolSearchResult,
  ToolExecutionStats,
  ToolRegistrationResult
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../enums/ToolEnums';
import {
  ToolFoundationError,
  ToolNotFoundError,
  ToolExecutionError,
  ToolValidationError,
  ToolSystemError
} from '../errors/ToolFoundationErrors';
import { createToolId } from '../utils/ToolIdUtils';
import { IStructuredLogger } from '../../../logging/interfaces/IStructuredLogger';

/**
 * Main unified tool foundation implementation
 * 
 * Orchestrates all foundation services to provide a unified interface
 * for tool management across all specialized systems.
 */
export class UnifiedToolFoundation implements IUnifiedToolFoundation {
  private initialized = false;
  private readonly foundationId: ToolId;

  constructor(
    private readonly registry: IUnifiedToolRegistry,
    private readonly executor: IUnifiedToolExecutor,
    private readonly discoveryService: IToolDiscoveryService,
    private readonly validationService: IToolValidationService,
    private readonly logger: IStructuredLogger
  ) {
    this.foundationId = createToolId();
  }

  // ==================== Tool Registration ====================

  async registerTool(definition: UnifiedToolDefinition): Promise<ToolRegistrationResult> {
    try {
      this.logger.info('Registering tool in unified foundation', {
        toolId: definition.id,
        toolName: definition.name,
        foundationId: this.foundationId
      });

      // Validate tool definition first
      const validation = await this.validationService.validateToolDefinition(definition);
      if (!validation.isValid) {
        return {
          success: false,
          toolId: definition.id as ToolId,
          registeredAt: new Date(),
          errors: [`Tool definition validation failed: ${validation.errors.join(', ')}`]
        };
      }

      // Register in registry
      const result = await this.registry.registerTool(definition);

      if (result.success) {
        this.logger.info('Tool registered successfully in unified foundation', {
          toolId: definition.id,
          toolName: definition.name,
          foundationId: this.foundationId
        });
      }

      return result;

    } catch (error) {
      this.logger.error('Tool registration failed in unified foundation', {
        toolName: definition.name,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        toolId: definition.id as ToolId,
        registeredAt: new Date(),
        errors: [`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async unregisterTool(identifier: ToolIdentifier): Promise<boolean> {
    try {
      this.logger.info('Unregistering tool from unified foundation', {
        identifier,
        foundationId: this.foundationId
      });

      const result = await this.registry.unregisterTool(identifier);

      if (result) {
        this.logger.info('Tool unregistered successfully from unified foundation', {
          identifier,
          foundationId: this.foundationId
        });
      }

      return result;

    } catch (error) {
      this.logger.error('Tool unregistration failed in unified foundation', {
        identifier,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async updateTool(identifier: ToolIdentifier, updates: Partial<UnifiedToolDefinition>): Promise<boolean> {
    try {
      this.logger.info('Updating tool in unified foundation', {
        identifier,
        updates: Object.keys(updates),
        foundationId: this.foundationId
      });

      const result = await this.registry.updateTool(identifier, updates);

      if (result) {
        this.logger.info('Tool updated successfully in unified foundation', {
          identifier,
          foundationId: this.foundationId
        });
      }

      return result;

    } catch (error) {
      this.logger.error('Tool update failed in unified foundation', {
        identifier,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  // ==================== Tool Retrieval ====================

  async findTool(identifier: ToolIdentifier): Promise<UnifiedTool | null> {
    try {
      const tool = await this.registry.getTool(identifier);

      if (tool) {
        this.logger.debug('Tool found in unified foundation', {
          toolId: tool.id,
          toolName: tool.name,
          identifier,
          foundationId: this.foundationId
        });
      } else {
        this.logger.debug('Tool not found in unified foundation', {
          identifier,
          foundationId: this.foundationId
        });
      }

      return tool;

    } catch (error) {
      this.logger.error('Tool lookup failed in unified foundation', {
        identifier,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return null;
    }
  }

  async getTools(identifiers: readonly ToolIdentifier[]): Promise<readonly UnifiedTool[]> {
    try {
      this.logger.debug('Getting multiple tools from unified foundation', {
        identifierCount: identifiers.length,
        foundationId: this.foundationId
      });

      const tools = await this.registry.getTools(identifiers);

      this.logger.debug('Retrieved multiple tools from unified foundation', {
        requestedCount: identifiers.length,
        foundCount: tools.length,
        foundationId: this.foundationId
      });

      return tools;

    } catch (error) {
      this.logger.error('Multiple tool lookup failed in unified foundation', {
        identifierCount: identifiers.length,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async getAllTools(includeDisabled = false): Promise<readonly UnifiedTool[]> {
    try {
      const tools = await this.registry.getAllTools(includeDisabled);

      this.logger.debug('Retrieved all tools from unified foundation', {
        toolCount: tools.length,
        includeDisabled,
        foundationId: this.foundationId
      });

      return tools;

    } catch (error) {
      this.logger.error('Get all tools failed in unified foundation', {
        includeDisabled,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  // ==================== Tool Execution ====================

  async executeTool(
    identifier: ToolIdentifier,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    try {
      this.logger.info('Executing tool through unified foundation', {
        identifier,
        foundationId: this.foundationId,
        traceId: context.traceId
      });

      // Find the tool
      const tool = await this.findTool(identifier);
      if (!tool) {
        // Get suggestions for better error message
        const allToolNames = await this.registry.getAllToolNames();
        const suggestions = await this.discoveryService.findSimilarTools(identifier, 'semantic', 3);

        throw new ToolNotFoundError(
          `Tool '${identifier}' not found in unified foundation`,
          {
            identifier,
            availableTools: allToolNames,
            suggestedTools: suggestions.map(result => result.tool.name)
          }
        );
      }

      // Execute through unified executor (NO FALLBACKS)
      const result = await this.executor.execute(tool, params, context);

      this.logger.info('Tool execution completed through unified foundation', {
        toolId: tool.id,
        toolName: tool.name,
        success: result.success,
        foundationId: this.foundationId,
        traceId: context.traceId
      });

      return result;

    } catch (error) {
      this.logger.error('Tool execution failed through unified foundation', {
        identifier,
        foundationId: this.foundationId,
        traceId: context.traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Re-throw the error (NO FALLBACK EXECUTORS)
      throw error;
    }
  }

  async executeTools(
    executions: readonly {
      identifier: ToolIdentifier;
      params: ToolParameters;
    }[],
    context: ExecutionContext,
    parallel = false
  ): Promise<readonly ToolResult[]> {
    try {
      this.logger.info('Executing multiple tools through unified foundation', {
        executionCount: executions.length,
        parallel,
        foundationId: this.foundationId,
        traceId: context.traceId
      });

      // Resolve all tool identifiers to tools
      const toolExecutions: Array<{ tool: UnifiedTool; params: ToolParameters }> = [];

      for (const execution of executions) {
        const tool = await this.findTool(execution.identifier);
        if (!tool) {
          throw new ToolNotFoundError(
            `Tool '${execution.identifier}' not found for batch execution`,
            {
              identifier: execution.identifier,
              availableTools: await this.registry.getAllToolNames()
            }
          );
        }
        toolExecutions.push({ tool, params: execution.params });
      }

      // Execute through unified executor
      const results = parallel
        ? await this.executor.executeParallel(toolExecutions, context)
        : await this.executor.executeSequence(toolExecutions, context);

      this.logger.info('Multiple tool execution completed through unified foundation', {
        executionCount: executions.length,
        successCount: results.filter(r => r.success).length,
        parallel,
        foundationId: this.foundationId,
        traceId: context.traceId
      });

      return results;

    } catch (error) {
      this.logger.error('Multiple tool execution failed through unified foundation', {
        executionCount: executions.length,
        parallel,
        foundationId: this.foundationId,
        traceId: context.traceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  // ==================== Tool Discovery ====================

  async discoverTools(criteria: ToolDiscoveryCriteria): Promise<readonly UnifiedTool[]> {
    try {
      this.logger.debug('Discovering tools through unified foundation', {
        criteria: JSON.stringify(criteria),
        foundationId: this.foundationId
      });

      const tools = await this.registry.findTools(criteria);

      this.logger.debug('Tool discovery completed through unified foundation', {
        foundCount: tools.length,
        foundationId: this.foundationId
      });

      return tools;

    } catch (error) {
      this.logger.error('Tool discovery failed through unified foundation', {
        criteria: JSON.stringify(criteria),
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async searchTools(
    query: string,
    context?: SearchContext,
    limit = 10
  ): Promise<readonly ToolSearchResult[]> {
    try {
      this.logger.debug('Searching tools through unified foundation', {
        query,
        limit,
        foundationId: this.foundationId
      });

      const results = await this.discoveryService.searchTools(query, context, limit);

      this.logger.debug('Tool search completed through unified foundation', {
        query,
        resultCount: results.length,
        foundationId: this.foundationId
      });

      return results;

    } catch (error) {
      this.logger.error('Tool search failed through unified foundation', {
        query,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async findToolsByCapability(
    capabilities: readonly ToolCapability[],
    matchAll = false
  ): Promise<readonly UnifiedTool[]> {
    try {
      this.logger.debug('Finding tools by capability through unified foundation', {
        capabilities,
        matchAll,
        foundationId: this.foundationId
      });

      const tools = await this.registry.findToolsByCapabilities(capabilities, matchAll);

      this.logger.debug('Tool capability search completed through unified foundation', {
        capabilities,
        foundCount: tools.length,
        foundationId: this.foundationId
      });

      return tools;

    } catch (error) {
      this.logger.error('Tool capability search failed through unified foundation', {
        capabilities,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async findToolsByCategory(categories: readonly ToolCategory[]): Promise<readonly UnifiedTool[]> {
    try {
      this.logger.debug('Finding tools by category through unified foundation', {
        categories,
        foundationId: this.foundationId
      });

      const tools = await this.registry.findToolsByCategory(categories);

      this.logger.debug('Tool category search completed through unified foundation', {
        categories,
        foundCount: tools.length,
        foundationId: this.foundationId
      });

      return tools;

    } catch (error) {
      this.logger.error('Tool category search failed through unified foundation', {
        categories,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async recommendTools(
    context: SearchContext,
    previousTools?: readonly ToolId[],
    limit = 5
  ): Promise<readonly {
    readonly tool: UnifiedTool;
    readonly relevanceScore: number;
    readonly reason: string;
  }[]> {
    try {
      this.logger.debug('Getting tool recommendations through unified foundation', {
        limit,
        foundationId: this.foundationId
      });

      const recommendations = await this.discoveryService.getToolRecommendations(
        context,
        previousTools,
        limit
      );

      this.logger.debug('Tool recommendations completed through unified foundation', {
        recommendationCount: recommendations.length,
        foundationId: this.foundationId
      });

      return recommendations;

    } catch (error) {
      this.logger.error('Tool recommendations failed through unified foundation', {
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  // ==================== Tool Validation ====================

  async validateTool(definition: UnifiedToolDefinition): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating tool through unified foundation', {
        toolId: definition.id,
        toolName: definition.name,
        foundationId: this.foundationId
      });

      // For now, just validate the tool definition structure
      const isValid = !!(definition.id && definition.name && definition.description);
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!definition.id) errors.push('Tool ID is required');
      if (!definition.name) errors.push('Tool name is required');
      if (!definition.description) errors.push('Tool description is required');

      this.logger.debug('Tool validation completed through unified foundation', {
        toolId: definition.id,
        toolName: definition.name,
        isValid,
        foundationId: this.foundationId
      });

      return {
        isValid,
        errors,
        warnings
      };

    } catch (error) {
      this.logger.error('Tool validation failed through unified foundation', {
        toolId: definition.id,
        toolName: definition.name,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  async validateParameters(
    tool: UnifiedTool,
    params: ToolParameters
  ): Promise<ValidationResult> {
    try {
      this.logger.debug('Validating parameters through unified foundation', {
        toolId: tool.id,
        toolName: tool.name,
        foundationId: this.foundationId
      });

      const result = await this.validationService.validateParameters(
        params,
        tool.parameters || { type: 'object', properties: {}, required: [] },
        tool.name
      );

      this.logger.debug('Parameter validation completed through unified foundation', {
        toolId: tool.id,
        toolName: tool.name,
        valid: result.valid,
        foundationId: this.foundationId
      });

      return {
        isValid: result.valid,
        errors: result.errors.map((e: any) => typeof e === 'string' ? e : e.error || JSON.stringify(e)),
        warnings: result.warnings.map((w: any) => typeof w === 'string' ? w : w.warning || JSON.stringify(w))
      };

    } catch (error) {
      this.logger.error('Parameter validation failed through unified foundation', {
        toolId: tool.id,
        toolName: tool.name,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        isValid: false,
        errors: [`Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  // ==================== Health and Metrics ====================

  async getToolHealth(identifier: ToolIdentifier): Promise<ToolHealthStatus> {
    try {
      const tool = await this.findTool(identifier);
      if (!tool) {
        return {
          toolId: identifier as ToolId,
          isHealthy: false,
          status: 'unknown',
          lastChecked: new Date(),
          lastHealthCheck: new Date(),
          errors: [`Tool '${identifier}' not found`]
        };
      }

      // Get execution stats for health assessment
      const stats = await this.executor.getToolExecutionStats(tool.id);

      const issues: string[] = [];
      let healthy = true;

      // Check if tool is enabled
      if (!tool.enabled) {
        issues.push('Tool is disabled');
        healthy = false;
      }

      // Check error rate
      if (stats.executionCount > 0 && stats.successRate < 0.8) {
        issues.push(`Low success rate: ${(stats.successRate * 100).toFixed(1)}%`);
        healthy = false;
      }

      // Check if tool has been executed recently (if it has execution history)
      if (stats.executionCount > 0 && stats.lastExecutedAt) {
        const lastExecution = new Date(stats.lastExecutedAt);
        const daysSinceLastExecution = (Date.now() - lastExecution.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastExecution > 30) {
          issues.push(`No executions in ${Math.floor(daysSinceLastExecution)} days`);
        }
      }

      return {
        toolId: tool.id,
        isHealthy: healthy,
        status: healthy ? 'healthy' : 'unhealthy',
        lastChecked: new Date(),
        lastHealthCheck: new Date(),
        errors: issues,
        metrics: {
          responseTime: stats.averageExecutionTime,
          successRate: stats.successRate,
          errorRate: 1 - stats.successRate
        }
      };

    } catch (error) {
      this.logger.error('Tool health check failed through unified foundation', {
        identifier,
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        toolId: identifier as ToolId,
        isHealthy: false,
        status: 'unhealthy',
        lastChecked: new Date(),
        lastHealthCheck: new Date(),
        errors: [`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async getFoundationMetrics(): Promise<ToolMetrics> {
    try {
      this.logger.debug('Getting foundation metrics', {
        foundationId: this.foundationId
      });

      const [registryHealth, executorStats, executorHealth] = await Promise.all([
        this.registry.getRegistryHealth(),
        this.executor.getExecutionStats(),
        this.executor.getHealthStatus()
      ]);

      const metrics: ToolMetrics = {
        toolId: this.foundationId,
        executionCount: executorStats.totalExecutions || 0,
        successCount: executorStats.successfulExecutions || 0,
        errorCount: executorStats.failedExecutions || 0,
        failureCount: executorStats.failedExecutions || 0,
        averageExecutionTime: executorStats.averageExecutionTime || 0,
        minExecutionTime: 0, // Would need to track this
        maxExecutionTime: 0, // Would need to track this
        totalExecutionTime: (executorStats.totalExecutions || 0) * (executorStats.averageExecutionTime || 0),
        lastExecuted: new Date(),
        errorRate: executorStats.totalExecutions > 0 ? (executorStats.failedExecutions || 0) / executorStats.totalExecutions : 0,
        successRate: executorStats.totalExecutions > 0 ? (executorStats.successfulExecutions || 0) / executorStats.totalExecutions : 1
      };

      this.logger.debug('Foundation metrics retrieved', {
        foundationId: this.foundationId,
        executionCount: metrics.executionCount,
        successRate: metrics.successRate
      });

      return metrics;

    } catch (error) {
      this.logger.error('Foundation metrics retrieval failed', {
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ToolSystemError(
        'Failed to retrieve foundation metrics',
        {
          operation: 'metrics_retrieval',
          component: 'unified_foundation',
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  // ==================== System Management ====================

  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        return true;
      }

      this.logger.info('Initializing Unified Tool Foundation', {
        foundationId: this.foundationId
      });

      // Initialize all services
      const initResults = await Promise.all([
        this.registry.initialize(),
        this.executor.initialize(),
        this.discoveryService.initialize(),
        this.validationService.initialize()
      ]);

      const allInitialized = initResults.every(result => result);

      if (allInitialized) {
        this.initialized = true;
        this.logger.info('Unified Tool Foundation initialized successfully', {
          foundationId: this.foundationId
        });
      } else {
        this.logger.error('Unified Tool Foundation initialization failed', {
          foundationId: this.foundationId,
          initResults
        });
      }

      return allInitialized;

    } catch (error) {
      this.logger.error('Unified Tool Foundation initialization error', {
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async shutdown(): Promise<boolean> {
    try {
      this.logger.info('Shutting down Unified Tool Foundation', {
        foundationId: this.foundationId
      });

      // Shutdown all services
      const shutdownResults = await Promise.all([
        this.executor.shutdown(true), // Wait for active executions
        this.discoveryService.shutdown(),
        this.validationService.shutdown(),
        this.registry.shutdown()
      ]);

      const allShutdown = shutdownResults.every(result => result);

      if (allShutdown) {
        this.initialized = false;
        this.logger.info('Unified Tool Foundation shutdown complete', {
          foundationId: this.foundationId
        });
      } else {
        this.logger.error('Unified Tool Foundation shutdown failed', {
          foundationId: this.foundationId,
          shutdownResults
        });
      }

      return allShutdown;

    } catch (error) {
      this.logger.error('Unified Tool Foundation shutdown error', {
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false;
      }

      const [registryHealthy, executorHealthy, discoveryHealthy, validationHealthy] = await Promise.all([
        this.registry.getRegistryHealth().then(h => h.healthy),
        this.executor.isHealthy(),
        this.discoveryService.isHealthy(),
        this.validationService.isHealthy()
      ]);

      return registryHealthy && executorHealthy && discoveryHealthy && validationHealthy;

    } catch (error) {
      this.logger.error('Foundation health check failed', {
        foundationId: this.foundationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  // ==================== Getters ====================

  get isInitialized(): boolean {
    return this.initialized;
  }

  get id(): ToolId {
    return this.foundationId;
  }

  // ==================== Missing Interface Methods ====================

  async getAllToolNames(): Promise<readonly string[]> {
    return this.registry.getAllToolNames();
  }

  async findSimilarTools(identifier: ToolIdentifier, limit = 5): Promise<readonly UnifiedTool[]> {
    return this.discoveryService.findSimilarTools(identifier, 'semantic', limit)
      .then(similarities => similarities.map(s => s.tool));
  }

  async executeToolChain(
    executions: readonly { identifier: ToolIdentifier; params: ToolParameters }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]> {
    const tools: { tool: UnifiedTool; params: ToolParameters }[] = [];

    // Resolve all tools first
    for (const execution of executions) {
      const tool = await this.findTool(execution.identifier);
      if (!tool) {
        throw new ToolNotFoundError(
          `Tool '${execution.identifier}' not found for chain execution`,
          {
            identifier: execution.identifier,
            availableTools: await this.getAllToolNames(),
            suggestedTools: []
          }
        );
      }
      tools.push({ tool, params: execution.params });
    }

    return this.executor.executeSequence(tools, context);
  }

  async executeToolsParallel(
    executions: readonly { identifier: ToolIdentifier; params: ToolParameters }[],
    context: ExecutionContext
  ): Promise<readonly ToolResult[]> {
    const tools: { tool: UnifiedTool; params: ToolParameters }[] = [];

    // Resolve all tools first
    for (const execution of executions) {
      const tool = await this.findTool(execution.identifier);
      if (!tool) {
        throw new ToolNotFoundError(
          `Tool '${execution.identifier}' not found for parallel execution`,
          {
            identifier: execution.identifier,
            availableTools: await this.getAllToolNames(),
            suggestedTools: []
          }
        );
      }
      tools.push({ tool, params: execution.params });
    }

    return this.executor.executeParallel(tools, context);
  }

  async getToolMetrics(toolId: ToolId): Promise<ToolMetrics> {
    const stats = await this.executor.getToolExecutionStats(toolId);
    return {
      toolId,
      executionCount: stats.executionCount,
      successCount: stats.successCount,
      errorCount: stats.failureCount,
      failureCount: stats.failureCount,
      averageExecutionTime: stats.averageExecutionTime,
      minExecutionTime: 0, // Would need to track this
      maxExecutionTime: 0, // Would need to track this
      totalExecutionTime: stats.executionCount * stats.averageExecutionTime,
      lastExecuted: stats.lastExecutedAt ? new Date(stats.lastExecutedAt) : undefined,
      errorRate: stats.executionCount > 0 ? stats.failureCount / stats.executionCount : 0,
      successRate: stats.successRate
    };
  }

  async setToolEnabled(identifier: ToolIdentifier, enabled: boolean): Promise<boolean> {
    return this.registry.setToolEnabled(identifier, enabled);
  }

  async getExecutionStats(): Promise<ToolExecutionStats> {
    const executorStats = await this.executor.getExecutionStats();
    const registryHealth = await this.registry.getRegistryHealth();

    // Enhance topTools with tool names
    const enhancedTopTools = await Promise.all(
      executorStats.topTools.map(async (topTool) => {
        const tool = await this.findTool(topTool.toolId);
        return {
          toolId: topTool.toolId,
          name: tool?.name || 'Unknown Tool',
          executionCount: topTool.executionCount
        };
      })
    );

    return {
      totalTools: registryHealth.totalTools,
      enabledTools: registryHealth.enabledTools,
      totalExecutions: executorStats.totalExecutions,
      successfulExecutions: executorStats.successfulExecutions,
      failedExecutions: executorStats.failedExecutions,
      averageExecutionTime: executorStats.averageExecutionTime,
      topTools: enhancedTopTools
    };
  }

  async getSystemHealth(): Promise<{
    readonly healthy: boolean;
    readonly totalTools: number;
    readonly enabledTools: number;
    readonly unhealthyTools: number;
    readonly issues: readonly string[];
  }> {
    const registryHealth = await this.registry.getRegistryHealth();
    const executorHealth = await this.executor.getHealthStatus();

    return {
      healthy: registryHealth.healthy && executorHealth.healthy,
      totalTools: registryHealth.totalTools,
      enabledTools: registryHealth.enabledTools,
      unhealthyTools: registryHealth.errorTools,
      issues: [
        ...registryHealth.issues,
        ...executorHealth.issues
      ]
    };
  }
} 