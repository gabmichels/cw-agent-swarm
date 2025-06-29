/**
 * UnifiedToolRegistry.ts - Single source of truth for all tool systems
 * 
 * Fixes the tool discovery mess by consolidating:
 * - Thinking System ToolService (ULID-based IDs)
 * - Workspace Tool System (descriptive names) 
 * - Agent ToolManager (agent-specific tools)
 * - String literal constants (centralized naming)
 */

import { ulid } from 'ulid';
import { createLogger } from '../../lib/logging/winston-logger';
import {
  EMAIL_TOOL_NAMES,
  CALENDAR_TOOL_NAMES,
  SPREADSHEET_TOOL_NAMES,
  FILE_TOOL_NAMES,
  CONNECTION_TOOL_NAMES,
  CORE_TOOL_NAMES,
  type ToolName
} from '../../constants/tool-names';

/**
 * Unified tool definition that works across all systems
 */
export interface UnifiedTool {
  readonly id: string;                    // ULID for thinking system
  readonly name: ToolName;               // Constant name for workspace system
  readonly displayName: string;          // Human-readable name
  readonly description: string;
  readonly category: string;
  readonly capabilities: readonly string[];
  readonly parameters: Record<string, ToolParameter>;
  readonly executor: ToolExecutor;
  readonly priority: number;
  readonly enabled: boolean;
  readonly registeredBy: string;
}

export interface ToolParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  readonly description: string;
  readonly required: boolean;
}

export type ToolExecutor = (
  params: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

export interface ToolExecutionContext {
  readonly toolId: string;
  readonly agentId: string;
  readonly userId: string;
  readonly sessionId?: string;
}

export interface ToolExecutionResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Unified Tool Registry - Single source of truth for all tools
 */
export class UnifiedToolRegistry {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly tools = new Map<string, UnifiedTool>(); // Key: tool.id (ULID)
  private readonly nameIndex = new Map<ToolName, string>(); // Key: tool.name, Value: tool.id
  private readonly categoryIndex = new Map<string, Set<string>>(); // Key: category, Value: Set<tool.id>
  private readonly agentTools = new Map<string, Set<string>>(); // Key: agentId, Value: Set<tool.id>

  constructor() {
    this.logger = createLogger({
      moduleId: 'unified-tool-registry'
    });

    this.logger.info('🔧 Initializing Unified Tool Registry');
  }

  /**
   * Register a tool in the unified registry
   */
  async registerTool(request: {
    name: ToolName;
    displayName: string;
    description: string;
    category: string;
    capabilities: readonly string[];
    parameters?: Record<string, ToolParameter>;
    executor: ToolExecutor;
    priority?: number;
    enabled?: boolean;
    registeredBy: string;
  }): Promise<UnifiedTool> {
    // Check for existing tool with same name
    if (this.nameIndex.has(request.name)) {
      const existingId = this.nameIndex.get(request.name)!;
      const existingTool = this.tools.get(existingId)!;

      this.logger.warn('Tool with same name already exists, updating', {
        name: request.name,
        existingId,
        existingRegisteredBy: existingTool.registeredBy,
        newRegisteredBy: request.registeredBy
      });

      // Update existing tool
      return this.updateTool(existingId, request);
    }

    // Create new tool
    const toolId = `tool_${ulid()}`;
    const tool: UnifiedTool = {
      id: toolId,
      name: request.name,
      displayName: request.displayName,
      description: request.description,
      category: request.category,
      capabilities: Object.freeze([...request.capabilities]),
      parameters: Object.freeze({ ...request.parameters || {} }),
      executor: request.executor,
      priority: request.priority ?? 50,
      enabled: request.enabled ?? true,
      registeredBy: request.registeredBy
    };

    // Store in primary map
    this.tools.set(toolId, tool);

    // Update indexes
    this.nameIndex.set(request.name, toolId);

    if (!this.categoryIndex.has(tool.category)) {
      this.categoryIndex.set(tool.category, new Set());
    }
    this.categoryIndex.get(tool.category)!.add(toolId);

    this.logger.info('✅ Tool registered successfully', {
      toolId,
      name: tool.name,
      displayName: tool.displayName,
      category: tool.category,
      registeredBy: tool.registeredBy
    });

    return tool;
  }

  /**
   * Register tools for a specific agent
   */
  async registerAgentTools(agentId: string, toolIds: readonly string[]): Promise<void> {
    if (!this.agentTools.has(agentId)) {
      this.agentTools.set(agentId, new Set());
    }

    const agentToolSet = this.agentTools.get(agentId)!;
    let registeredCount = 0;

    for (const toolId of toolIds) {
      if (this.tools.has(toolId)) {
        agentToolSet.add(toolId);
        registeredCount++;
      } else {
        this.logger.warn('Attempted to register non-existent tool for agent', {
          agentId,
          toolId
        });
      }
    }

    this.logger.info('Agent tools registered', {
      agentId,
      requestedCount: toolIds.length,
      registeredCount,
      totalAgentTools: agentToolSet.size
    });
  }

  /**
   * Find a single tool by various criteria
   */
  findTool(options: {
    byId?: string;
    byName?: ToolName;
    byCategory?: string;
    enabledOnly?: boolean;
    agentId?: string;
  }): UnifiedTool | null {
    // Find by ID (fastest)
    if (options.byId) {
      const tool = this.tools.get(options.byId);
      return this.filterTool(tool, options);
    }

    // Find by name (second fastest)
    if (options.byName) {
      const toolId = this.nameIndex.get(options.byName);
      if (toolId) {
        const tool = this.tools.get(toolId);
        return this.filterTool(tool, options);
      }
    }

    // Find by category (slower)
    if (options.byCategory) {
      const candidateIds = this.categoryIndex.get(options.byCategory);
      if (candidateIds) {
        for (const toolId of candidateIds) {
          const tool = this.tools.get(toolId);
          const filteredTool = this.filterTool(tool, options);
          if (filteredTool) {
            return filteredTool;
          }
        }
      }
    }

    return null;
  }

  /**
   * Discover tools based on criteria
   */
  async discoverTools(options: {
    intent?: string;
    categories?: readonly string[];
    capabilities?: readonly string[];
    agentId?: string;
    limit?: number;
  }): Promise<readonly UnifiedTool[]> {
    let candidates: UnifiedTool[] = [];

    // Start with all tools or filter by agent
    if (options.agentId && this.agentTools.has(options.agentId)) {
      const agentToolIds = this.agentTools.get(options.agentId)!;
      candidates = Array.from(agentToolIds)
        .map(id => this.tools.get(id))
        .filter((tool): tool is UnifiedTool => tool !== undefined);
    } else {
      candidates = Array.from(this.tools.values());
    }

    // Filter by categories
    if (options.categories && options.categories.length > 0) {
      candidates = candidates.filter(tool =>
        options.categories!.includes(tool.category)
      );
    }

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      candidates = candidates.filter(tool =>
        options.capabilities!.some(cap => tool.capabilities.includes(cap))
      );
    }

    // Filter enabled only
    candidates = candidates.filter(tool => tool.enabled);

    // Sort by priority (higher first)
    candidates.sort((a, b) => b.priority - a.priority);

    // Apply limit
    if (options.limit && options.limit < candidates.length) {
      candidates = candidates.slice(0, options.limit);
    }

    return Object.freeze(candidates);
  }

  /**
   * Execute a tool by ID or name
   */
  async executeTool(
    toolIdentifier: string | ToolName,
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Find the tool
    const tool = typeof toolIdentifier === 'string' && toolIdentifier.startsWith('tool_')
      ? this.findTool({ byId: toolIdentifier })
      : this.findTool({ byName: toolIdentifier as ToolName });

    if (!tool) {
      this.logger.error('Tool not found', { toolIdentifier });
      return {
        success: false,
        error: `Tool not found: ${toolIdentifier}`
      };
    }

    if (!tool.enabled) {
      return {
        success: false,
        error: `Tool is disabled: ${tool.name}`
      };
    }

    const startTime = Date.now();

    try {
      this.logger.debug('🔧 Executing unified tool', {
        toolId: tool.id,
        toolName: tool.name,
        agentId: context.agentId,
        parameters: params
      });

      // Execute the tool
      const result = await tool.executor(params, {
        ...context,
        toolId: tool.id
      });

      const duration = Date.now() - startTime;

      this.logger.info('✅ Unified tool executed successfully', {
        toolId: tool.id,
        toolName: tool.name,
        agentId: context.agentId,
        duration,
        success: result.success
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('❌ Unified tool execution failed', {
        toolId: tool.id,
        toolName: tool.name,
        agentId: context.agentId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get all tools available to an agent
   */
  getAgentTools(agentId: string): readonly UnifiedTool[] {
    const agentToolIds = this.agentTools.get(agentId);
    if (!agentToolIds) {
      return Object.freeze([]);
    }

    return Object.freeze(
      Array.from(agentToolIds)
        .map(id => this.tools.get(id))
        .filter((tool): tool is UnifiedTool => tool !== undefined)
    );
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalTools: number;
    enabledTools: number;
    categories: Record<string, number>;
    registrants: Record<string, number>;
    agents: number;
  } {
    const tools = Array.from(this.tools.values());
    const enabledTools = tools.filter(t => t.enabled);

    const categories: Record<string, number> = {};
    const registrants: Record<string, number> = {};

    for (const tool of tools) {
      categories[tool.category] = (categories[tool.category] || 0) + 1;
      registrants[tool.registeredBy] = (registrants[tool.registeredBy] || 0) + 1;
    }

    return {
      totalTools: tools.length,
      enabledTools: enabledTools.length,
      categories,
      registrants,
      agents: this.agentTools.size
    };
  }

  // Private methods

  private async updateTool(toolId: string, request: any): Promise<UnifiedTool> {
    const existingTool = this.tools.get(toolId)!;

    const updatedTool: UnifiedTool = {
      ...existingTool,
      displayName: request.displayName,
      description: request.description,
      category: request.category,
      capabilities: Object.freeze([...request.capabilities]),
      parameters: Object.freeze({ ...request.parameters || {} }),
      executor: request.executor,
      priority: request.priority ?? existingTool.priority,
      enabled: request.enabled ?? existingTool.enabled,
      registeredBy: request.registeredBy
    };

    this.tools.set(toolId, updatedTool);

    this.logger.info('Tool updated successfully', {
      toolId,
      name: updatedTool.name,
      registeredBy: updatedTool.registeredBy
    });

    return updatedTool;
  }

  private filterTool(tool: UnifiedTool | undefined, options: any): UnifiedTool | null {
    if (!tool) return null;

    if (options.enabledOnly && !tool.enabled) return null;

    if (options.agentId) {
      const agentTools = this.agentTools.get(options.agentId);
      if (!agentTools || !agentTools.has(tool.id)) return null;
    }

    return tool;
  }
}

// Singleton instance
export const unifiedToolRegistry = new UnifiedToolRegistry(); 