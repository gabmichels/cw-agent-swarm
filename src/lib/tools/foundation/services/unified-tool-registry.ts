/**
 * Unified Tool Registry - Implementation
 * 
 * Concrete implementation of the unified tool registry that manages
 * tool storage, retrieval, and discovery with comprehensive indexing
 * and performance optimization.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID identifiers for tool tracking
 * - Comprehensive indexing for fast lookups
 * - Structured error handling with context
 * - Performance-optimized operations
 * - Immutable data structures
 */

import { IUnifiedToolRegistry } from '../interfaces/UnifiedToolRegistryInterface';
import {
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolId,
  UnifiedTool,
  ToolDiscoveryCriteria,
  ToolRegistrationResult,
  ToolExecutionStats
} from '../types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../enums/ToolEnums';
import {
  ToolRegistrationError,
  ToolNotFoundError,
  ToolValidationError
} from '../errors/ToolFoundationErrors';
import { createToolId, isValidToolId } from '../utils/ToolIdUtils';
import { IStructuredLogger } from '../../../logging/structured-logger.interface';

/**
 * Concrete implementation of the unified tool registry
 */
export class UnifiedToolRegistry implements IUnifiedToolRegistry {
  private readonly tools = new Map<ToolId, UnifiedTool>();
  private readonly nameIndex = new Map<string, ToolId>();
  private readonly categoryIndex = new Map<ToolCategory, Set<ToolId>>();
  private readonly capabilityIndex = new Map<ToolCapability, Set<ToolId>>();
  private readonly providerIndex = new Map<string, Set<ToolId>>();
  private readonly tagIndex = new Map<string, Set<ToolId>>();
  private readonly statusIndex = new Map<ToolStatus, Set<ToolId>>();

  private readonly executionStats = new Map<ToolId, {
    executionCount: number;
    successCount: number;
    failureCount: number;
    totalExecutionTime: number;
    lastExecutedAt?: string;
  }>();

  private initialized = false;

  constructor(
    private readonly logger: IStructuredLogger
  ) { }

  // ==================== Tool Registration ====================

  async registerTool(definition: UnifiedToolDefinition): Promise<ToolRegistrationResult> {
    try {
      this.logger.info('Registering tool', {
        toolName: definition.name,
        toolId: definition.id,
        category: definition.category,
        provider: definition.metadata.provider
      });

      // Validate tool definition
      await this.validateToolDefinition(definition);

      // Check for duplicate name
      if (this.nameIndex.has(definition.name)) {
        const existingToolId = this.nameIndex.get(definition.name)!;
        throw new ToolRegistrationError(
          `Tool name '${definition.name}' is already registered`,
          {
            toolName: definition.name,
            reason: 'duplicate_name',
            existingToolId
          }
        );
      }

      // Check for duplicate ID
      if (this.tools.has(definition.id)) {
        throw new ToolRegistrationError(
          `Tool ID '${definition.id}' is already registered`,
          {
            toolName: definition.name,
            reason: 'duplicate_name',
            existingToolId: definition.id
          }
        );
      }

      // Create unified tool with registration metadata
      const unifiedTool: UnifiedTool = {
        ...definition,
        registeredAt: new Date().toISOString(),
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0
      };

      // Store tool
      this.tools.set(definition.id, unifiedTool);

      // Update indexes
      this.updateIndexes(unifiedTool, 'add');

      // Initialize execution stats
      this.executionStats.set(definition.id, {
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0
      });

      this.logger.info('Tool registered successfully', {
        toolId: definition.id,
        toolName: definition.name,
        enabled: definition.enabled
      });

      return {
        success: true,
        toolId: definition.id
      };

    } catch (error) {
      this.logger.error('Tool registration failed', {
        toolName: definition.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ToolRegistrationError) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: false,
        error: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async unregisterTool(identifier: ToolIdentifier): Promise<boolean> {
    try {
      const tool = await this.getTool(identifier);
      if (!tool) {
        return false;
      }

      this.logger.info('Unregistering tool', {
        toolId: tool.id,
        toolName: tool.name
      });

      // Remove from indexes
      this.updateIndexes(tool, 'remove');

      // Remove from main storage
      this.tools.delete(tool.id);

      // Remove execution stats
      this.executionStats.delete(tool.id);

      this.logger.info('Tool unregistered successfully', {
        toolId: tool.id,
        toolName: tool.name
      });

      return true;

    } catch (error) {
      this.logger.error('Tool unregistration failed', {
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async updateTool(identifier: ToolIdentifier, updates: Partial<UnifiedToolDefinition>): Promise<boolean> {
    try {
      const existingTool = await this.getTool(identifier);
      if (!existingTool) {
        return false;
      }

      this.logger.info('Updating tool', {
        toolId: existingTool.id,
        toolName: existingTool.name,
        updates: Object.keys(updates)
      });

      // Remove from old indexes
      this.updateIndexes(existingTool, 'remove');

      // Create updated tool
      const updatedTool: UnifiedTool = {
        ...existingTool,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Validate updated tool
      await this.validateToolDefinition(updatedTool);

      // Store updated tool
      this.tools.set(existingTool.id, updatedTool);

      // Update indexes
      this.updateIndexes(updatedTool, 'add');

      this.logger.info('Tool updated successfully', {
        toolId: existingTool.id,
        toolName: existingTool.name
      });

      return true;

    } catch (error) {
      this.logger.error('Tool update failed', {
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // ==================== Tool Retrieval ====================

  async getTool(identifier: ToolIdentifier): Promise<UnifiedTool | null> {
    // Try by ID first
    if (isValidToolId(identifier)) {
      return this.tools.get(identifier as ToolId) || null;
    }

    // Try by name
    if (typeof identifier === 'string') {
      const toolId = this.nameIndex.get(identifier);
      if (toolId) {
        return this.tools.get(toolId) || null;
      }
    }

    return null;
  }

  async getTools(identifiers: readonly ToolIdentifier[]): Promise<readonly UnifiedTool[]> {
    const tools: UnifiedTool[] = [];

    for (const identifier of identifiers) {
      const tool = await this.getTool(identifier);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  async getAllTools(includeDisabled = false): Promise<readonly UnifiedTool[]> {
    const tools = Array.from(this.tools.values());

    if (includeDisabled) {
      return tools;
    }

    return tools.filter(tool => tool.enabled);
  }

  async getAllToolNames(includeDisabled = false): Promise<readonly string[]> {
    const tools = await this.getAllTools(includeDisabled);
    return tools.map(tool => tool.name);
  }

  // ==================== Tool Discovery ====================

  async findTools(criteria: ToolDiscoveryCriteria): Promise<readonly UnifiedTool[]> {
    let candidateTools = Array.from(this.tools.values());

    // Filter by enabled status
    if (criteria.enabled !== undefined) {
      candidateTools = candidateTools.filter(tool => tool.enabled === criteria.enabled);
    }

    // Filter by status
    if (criteria.status) {
      candidateTools = candidateTools.filter(tool => tool.status === criteria.status);
    }

    // Filter by categories
    if (criteria.categories && criteria.categories.length > 0) {
      candidateTools = candidateTools.filter(tool =>
        criteria.categories!.includes(tool.category)
      );
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      candidateTools = candidateTools.filter(tool =>
        criteria.capabilities!.some(cap => tool.capabilities.includes(cap))
      );
    }

    // Filter by provider
    if (criteria.provider) {
      candidateTools = candidateTools.filter(tool =>
        tool.metadata.provider === criteria.provider
      );
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      candidateTools = candidateTools.filter(tool =>
        tool.metadata.tags?.some(tag => criteria.tags!.includes(tag))
      );
    }

    // Sort results
    if (criteria.sortBy) {
      candidateTools = this.sortTools(candidateTools, criteria.sortBy, criteria.sortOrder || 'asc');
    }

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || candidateTools.length;

    return candidateTools.slice(offset, offset + limit);
  }

  async findToolsByCategory(categories: readonly ToolCategory[], enabled = true): Promise<readonly UnifiedTool[]> {
    return this.findTools({
      categories,
      enabled
    });
  }

  async findToolsByCapabilities(
    capabilities: readonly ToolCapability[],
    matchAll = false,
    enabled = true
  ): Promise<readonly UnifiedTool[]> {
    const candidateTools = Array.from(this.tools.values()).filter(tool =>
      enabled ? tool.enabled : true
    );

    return candidateTools.filter(tool => {
      if (matchAll) {
        return capabilities.every(cap => tool.capabilities.includes(cap));
      } else {
        return capabilities.some(cap => tool.capabilities.includes(cap));
      }
    });
  }

  async findToolsByProvider(provider: string, enabled = true): Promise<readonly UnifiedTool[]> {
    return this.findTools({
      provider,
      enabled
    });
  }

  async findToolsByTags(
    tags: readonly string[],
    matchAll = false,
    enabled = true
  ): Promise<readonly UnifiedTool[]> {
    const candidateTools = Array.from(this.tools.values()).filter(tool =>
      enabled ? tool.enabled : true
    );

    return candidateTools.filter(tool => {
      if (!tool.metadata.tags || tool.metadata.tags.length === 0) {
        return false;
      }

      if (matchAll) {
        return tags.every(tag => tool.metadata.tags!.includes(tag));
      } else {
        return tags.some(tag => tool.metadata.tags!.includes(tag));
      }
    });
  }

  async findSimilarTools(identifier: ToolIdentifier, limit = 5): Promise<readonly UnifiedTool[]> {
    const referenceTool = await this.getTool(identifier);
    if (!referenceTool) {
      return [];
    }

    const allTools = Array.from(this.tools.values()).filter(tool =>
      tool.id !== referenceTool.id && tool.enabled
    );

    // Calculate similarity scores
    const toolsWithScores = allTools.map(tool => ({
      tool,
      score: this.calculateSimilarity(referenceTool, tool)
    }));

    // Sort by similarity score (descending)
    toolsWithScores.sort((a, b) => b.score - a.score);

    // Return top similar tools
    return toolsWithScores.slice(0, limit).map(item => item.tool);
  }

  // ==================== Tool Status Management ====================

  async setToolEnabled(identifier: ToolIdentifier, enabled: boolean): Promise<boolean> {
    const tool = await this.getTool(identifier);
    if (!tool) {
      return false;
    }

    const updatedTool: UnifiedTool = {
      ...tool,
      enabled,
      updatedAt: new Date().toISOString()
    };

    this.tools.set(tool.id, updatedTool);

    // Update indexes
    this.updateIndexes(tool, 'remove');
    this.updateIndexes(updatedTool, 'add');

    this.logger.info('Tool enabled status updated', {
      toolId: tool.id,
      toolName: tool.name,
      enabled
    });

    return true;
  }

  async setToolStatus(identifier: ToolIdentifier, status: ToolStatus): Promise<boolean> {
    const tool = await this.getTool(identifier);
    if (!tool) {
      return false;
    }

    // Remove from old status index
    const oldStatusSet = this.statusIndex.get(tool.status);
    if (oldStatusSet) {
      oldStatusSet.delete(tool.id);
    }

    const updatedTool: UnifiedTool = {
      ...tool,
      status,
      updatedAt: new Date().toISOString()
    };

    this.tools.set(tool.id, updatedTool);

    // Add to new status index
    if (!this.statusIndex.has(status)) {
      this.statusIndex.set(status, new Set());
    }
    this.statusIndex.get(status)!.add(tool.id);

    this.logger.info('Tool status updated', {
      toolId: tool.id,
      toolName: tool.name,
      oldStatus: tool.status,
      newStatus: status
    });

    return true;
  }

  async getToolsByStatus(status: ToolStatus): Promise<readonly UnifiedTool[]> {
    const toolIds = this.statusIndex.get(status);
    if (!toolIds) {
      return [];
    }

    const tools: UnifiedTool[] = [];
    for (const toolId of toolIds) {
      const tool = this.tools.get(toolId);
      if (tool) {
        tools.push(tool);
      }
    }

    return tools;
  }

  // ==================== Tool Metrics ====================

  async recordExecution(toolId: ToolId, success: boolean, executionTimeMs: number): Promise<void> {
    const stats = this.executionStats.get(toolId);
    if (!stats) {
      return;
    }

    // Update execution stats
    stats.executionCount++;
    stats.totalExecutionTime += executionTimeMs;
    stats.lastExecutedAt = new Date().toISOString();

    if (success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
    }

    // Update tool metrics
    const tool = this.tools.get(toolId);
    if (tool) {
      const updatedTool: UnifiedTool = {
        ...tool,
        executionCount: stats.executionCount,
        successRate: stats.executionCount > 0 ? stats.successCount / stats.executionCount : 0,
        averageExecutionTime: stats.executionCount > 0 ? stats.totalExecutionTime / stats.executionCount : 0,
        lastExecutedAt: stats.lastExecutedAt
      };

      this.tools.set(toolId, updatedTool);
    }
  }

  async updateLastExecution(toolId: ToolId, timestamp = new Date().toISOString()): Promise<void> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return;
    }

    const updatedTool: UnifiedTool = {
      ...tool,
      lastExecutedAt: timestamp
    };

    this.tools.set(toolId, updatedTool);

    const stats = this.executionStats.get(toolId);
    if (stats) {
      stats.lastExecutedAt = timestamp;
    }
  }

  async getExecutionStats(): Promise<ToolExecutionStats> {
    const allTools = Array.from(this.tools.values());
    const totalTools = allTools.length;
    const enabledTools = allTools.filter(tool => tool.enabled).length;

    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let totalExecutionTime = 0;

    const toolExecutions: Array<{ toolId: ToolId; name: string; executionCount: number }> = [];

    for (const [toolId, stats] of this.executionStats.entries()) {
      totalExecutions += stats.executionCount;
      successfulExecutions += stats.successCount;
      failedExecutions += stats.failureCount;
      totalExecutionTime += stats.totalExecutionTime;

      const tool = this.tools.get(toolId);
      if (tool && stats.executionCount > 0) {
        toolExecutions.push({
          toolId,
          name: tool.name,
          executionCount: stats.executionCount
        });
      }
    }

    // Sort by execution count and get top tools
    toolExecutions.sort((a, b) => b.executionCount - a.executionCount);
    const topTools = toolExecutions.slice(0, 10);

    return {
      totalTools,
      enabledTools,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      topTools
    };
  }

  // ==================== Registry Management ====================

  async exists(identifier: ToolIdentifier): Promise<boolean> {
    const tool = await this.getTool(identifier);
    return tool !== null;
  }

  async getToolCount(enabled?: boolean): Promise<number> {
    if (enabled === undefined) {
      return this.tools.size;
    }

    const tools = Array.from(this.tools.values());
    return tools.filter(tool => tool.enabled === enabled).length;
  }

  async getRegistryHealth(): Promise<{
    readonly healthy: boolean;
    readonly totalTools: number;
    readonly enabledTools: number;
    readonly disabledTools: number;
    readonly errorTools: number;
    readonly issues: readonly string[];
  }> {
    const allTools = Array.from(this.tools.values());
    const totalTools = allTools.length;
    const enabledTools = allTools.filter(tool => tool.enabled).length;
    const disabledTools = allTools.filter(tool => !tool.enabled).length;
    const errorTools = allTools.filter(tool => tool.status === ToolStatus.ERROR || tool.status === ToolStatus.FAILED).length;

    const issues: string[] = [];

    // Check for potential issues
    if (totalTools === 0) {
      issues.push('No tools registered in registry');
    }

    if (enabledTools === 0) {
      issues.push('No enabled tools available');
    }

    if (errorTools > 0) {
      issues.push(`${errorTools} tools in error state`);
    }

    // Check index consistency
    if (this.nameIndex.size !== totalTools) {
      issues.push('Name index inconsistency detected');
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      totalTools,
      enabledTools,
      disabledTools,
      errorTools,
      issues
    };
  }

  async clear(): Promise<boolean> {
    try {
      this.tools.clear();
      this.nameIndex.clear();
      this.categoryIndex.clear();
      this.capabilityIndex.clear();
      this.providerIndex.clear();
      this.tagIndex.clear();
      this.statusIndex.clear();
      this.executionStats.clear();

      this.logger.info('Registry cleared successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to clear registry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.initialized) {
        return true;
      }

      this.logger.info('Initializing Unified Tool Registry');

      // Registry is ready to use
      this.initialized = true;

      this.logger.info('Unified Tool Registry initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize registry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async shutdown(): Promise<boolean> {
    try {
      this.logger.info('Shutting down Unified Tool Registry');

      // Clear all data
      await this.clear();

      this.initialized = false;

      this.logger.info('Unified Tool Registry shutdown complete');
      return true;
    } catch (error) {
      this.logger.error('Failed to shutdown registry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // ==================== Private Helper Methods ====================

  private async validateToolDefinition(definition: UnifiedToolDefinition): Promise<void> {
    const errors: string[] = [];

    // Validate required fields
    if (!definition.id || !isValidToolId(definition.id)) {
      errors.push('Tool ID must be a valid ULID');
    }

    if (!definition.name || typeof definition.name !== 'string') {
      errors.push('Tool name is required and must be a string');
    }

    if (!definition.displayName || typeof definition.displayName !== 'string') {
      errors.push('Tool display name is required and must be a string');
    }

    if (!definition.description || typeof definition.description !== 'string') {
      errors.push('Tool description is required and must be a string');
    }

    if (!Object.values(ToolCategory).includes(definition.category)) {
      errors.push('Tool category must be a valid ToolCategory enum value');
    }

    if (!Array.isArray(definition.capabilities)) {
      errors.push('Tool capabilities must be an array');
    } else {
      for (const capability of definition.capabilities) {
        if (!Object.values(ToolCapability).includes(capability)) {
          errors.push(`Invalid capability: ${capability}`);
        }
      }
    }

    if (typeof definition.executor !== 'function') {
      errors.push('Tool executor must be a function');
    }

    if (!definition.metadata || typeof definition.metadata !== 'object') {
      errors.push('Tool metadata is required and must be an object');
    } else {
      if (!definition.metadata.version || typeof definition.metadata.version !== 'string') {
        errors.push('Tool metadata.version is required and must be a string');
      }
      if (!definition.metadata.author || typeof definition.metadata.author !== 'string') {
        errors.push('Tool metadata.author is required and must be a string');
      }
      if (!definition.metadata.provider || typeof definition.metadata.provider !== 'string') {
        errors.push('Tool metadata.provider is required and must be a string');
      }
    }

    if (errors.length > 0) {
      throw new ToolValidationError(
        'Tool definition validation failed',
        {
          toolId: definition.id,
          toolName: definition.name,
          validationErrors: errors
        }
      );
    }
  }

  private updateIndexes(tool: UnifiedTool, operation: 'add' | 'remove'): void {
    if (operation === 'add') {
      // Name index
      this.nameIndex.set(tool.name, tool.id);

      // Category index
      if (!this.categoryIndex.has(tool.category)) {
        this.categoryIndex.set(tool.category, new Set());
      }
      this.categoryIndex.get(tool.category)!.add(tool.id);

      // Capability index
      for (const capability of tool.capabilities) {
        if (!this.capabilityIndex.has(capability)) {
          this.capabilityIndex.set(capability, new Set());
        }
        this.capabilityIndex.get(capability)!.add(tool.id);
      }

      // Provider index
      if (!this.providerIndex.has(tool.metadata.provider)) {
        this.providerIndex.set(tool.metadata.provider, new Set());
      }
      this.providerIndex.get(tool.metadata.provider)!.add(tool.id);

      // Tag index
      if (tool.metadata.tags) {
        for (const tag of tool.metadata.tags) {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set());
          }
          this.tagIndex.get(tag)!.add(tool.id);
        }
      }

      // Status index
      if (!this.statusIndex.has(tool.status)) {
        this.statusIndex.set(tool.status, new Set());
      }
      this.statusIndex.get(tool.status)!.add(tool.id);

    } else {
      // Remove from all indexes
      this.nameIndex.delete(tool.name);

      this.categoryIndex.get(tool.category)?.delete(tool.id);

      for (const capability of tool.capabilities) {
        this.capabilityIndex.get(capability)?.delete(tool.id);
      }

      this.providerIndex.get(tool.metadata.provider)?.delete(tool.id);

      if (tool.metadata.tags) {
        for (const tag of tool.metadata.tags) {
          this.tagIndex.get(tag)?.delete(tool.id);
        }
      }

      this.statusIndex.get(tool.status)?.delete(tool.id);
    }
  }

  private sortTools(tools: UnifiedTool[], sortBy: string, sortOrder: 'asc' | 'desc'): UnifiedTool[] {
    return tools.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'successRate':
          comparison = a.successRate - b.successRate;
          break;
        case 'executionCount':
          comparison = a.executionCount - b.executionCount;
          break;
        case 'lastExecuted':
          const aTime = a.lastExecutedAt ? new Date(a.lastExecutedAt).getTime() : 0;
          const bTime = b.lastExecutedAt ? new Date(b.lastExecutedAt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private calculateSimilarity(tool1: UnifiedTool, tool2: UnifiedTool): number {
    let score = 0;
    let factors = 0;

    // Category similarity (40% weight)
    if (tool1.category === tool2.category) {
      score += 0.4;
    }
    factors++;

    // Capability similarity (30% weight)
    const commonCapabilities = tool1.capabilities.filter(cap => tool2.capabilities.includes(cap));
    const totalCapabilities = new Set([...tool1.capabilities, ...tool2.capabilities]).size;
    if (totalCapabilities > 0) {
      score += (commonCapabilities.length / totalCapabilities) * 0.3;
    }
    factors++;

    // Provider similarity (20% weight)
    if (tool1.metadata.provider === tool2.metadata.provider) {
      score += 0.2;
    }
    factors++;

    // Tag similarity (10% weight)
    if (tool1.metadata.tags && tool2.metadata.tags) {
      const commonTags = tool1.metadata.tags.filter(tag => tool2.metadata.tags!.includes(tag));
      const totalTags = new Set([...tool1.metadata.tags, ...tool2.metadata.tags]).size;
      if (totalTags > 0) {
        score += (commonTags.length / totalTags) * 0.1;
      }
    }
    factors++;

    return factors > 0 ? score : 0;
  }
} 