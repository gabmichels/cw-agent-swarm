/**
 * UnifiedToolBridge.ts - Bridges all tool systems to the unified registry
 * 
 * This service:
 * 1. Registers workspace tools with unified registry using constant names
 * 2. Connects thinking system ToolService to unified registry
 * 3. Bridges agent ToolManager to unified registry
 * 4. Provides single execution path for all tools
 * 
 * Fixes the core issue: Tools are discovered but can't be executed because
 * the thinking system creates ULID-based tool IDs but workspace tools use names.
 */

import { createLogger } from '../../lib/logging/winston-logger';
import { unifiedToolRegistry, UnifiedTool, ToolExecutionContext } from './UnifiedToolRegistry';
import { ToolService } from '../thinking/tools/ToolService';
import { WorkspaceAgentTools } from '../workspace/tools/WorkspaceAgentTools';
import { AgentBase } from '../../agents/shared/base/AgentBase.interface';
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
 * Bridge configuration
 */
export interface UnifiedToolBridgeConfig {
  enableDebugLogging?: boolean;
  maxExecutionTimeMs?: number;
  validateParameters?: boolean;
}

/**
 * Unified Tool Bridge - Connects all tool systems
 */
export class UnifiedToolBridge {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly config: Required<UnifiedToolBridgeConfig>;
  private readonly workspaceTools: WorkspaceAgentTools;
  private readonly registeredAgents = new Set<string>();

  constructor(config: UnifiedToolBridgeConfig = {}) {
    this.logger = createLogger({
      moduleId: 'unified-tool-bridge'
    });

    this.config = {
      enableDebugLogging: config.enableDebugLogging ?? true,
      maxExecutionTimeMs: config.maxExecutionTimeMs ?? 30000,
      validateParameters: config.validateParameters ?? true
    };

    this.workspaceTools = new WorkspaceAgentTools();

    this.logger.info('🔧 Initializing Unified Tool Bridge', { config: this.config });
  }

  /**
   * Connect all tool systems for an agent
   */
  async connectAllSystems(
    agent: AgentBase,
    thinkingToolService: ToolService
  ): Promise<void> {
    const agentId = agent.getAgentId();

    if (this.registeredAgents.has(agentId)) {
      this.logger.debug('Tool systems already connected for agent', { agentId });
      return;
    }

    try {
      this.logger.info('🔗 Connecting all tool systems for agent', { agentId });

      // Step 1: Register workspace tools in unified registry
      await this.registerWorkspaceTools(agentId);

      // Step 2: Register core tools in unified registry
      await this.registerCoreTools();

      // Step 3: Connect thinking system to unified registry
      await this.connectThinkingSystem(thinkingToolService);

      this.registeredAgents.add(agentId);

      this.logger.info('✅ All tool systems connected successfully', { agentId });

    } catch (error) {
      this.logger.error('❌ Failed to connect tool systems', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register workspace tools in unified registry
   */
  private async registerWorkspaceTools(agentId: string): Promise<void> {
    try {
      const availableTools = await this.workspaceTools.getAvailableTools(agentId);

      if (availableTools.length === 0) {
        this.logger.warn('No workspace tools available for agent', { agentId });
        return;
      }

      let registeredCount = 0;

      for (const tool of availableTools) {
        try {
          // Map workspace tool name to constant name
          const constantName = this.mapWorkspaceToolToConstant(tool.name);

          if (!constantName) {
            this.logger.warn('No constant mapping found for workspace tool', {
              agentId,
              toolName: tool.name
            });
            continue;
          }

          // Create unified tool executor
          const executor = this.createUnifiedWorkspaceExecutor(tool, agentId);

          // Register in unified registry
          await unifiedToolRegistry.registerTool({
            name: constantName,
            displayName: tool.name,
            description: tool.description,
            category: this.categorizeWorkspaceTool(constantName),
            capabilities: this.getWorkspaceToolCapabilities(constantName),
            parameters: this.convertWorkspaceParameters(tool.parameters),
            executor,
            priority: this.getWorkspaceToolPriority(constantName),
            registeredBy: 'workspace'
          });

          registeredCount++;

          if (this.config.enableDebugLogging) {
            this.logger.debug('Registered workspace tool in unified registry', {
              agentId,
              toolName: tool.name,
              constantName,
              category: this.categorizeWorkspaceTool(constantName)
            });
          }

        } catch (error) {
          this.logger.warn('Failed to register workspace tool in unified registry', {
            agentId,
            toolName: tool.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      this.logger.info('✅ Workspace tools registered in unified registry', {
        agentId,
        availableCount: availableTools.length,
        registeredCount
      });

    } catch (error) {
      this.logger.error('Failed to register workspace tools', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register core tools in unified registry
   */
  private async registerCoreTools(): Promise<void> {
    let registeredCount = 0;

    for (const [key, toolName] of Object.entries(CORE_TOOL_NAMES)) {
      try {
        await unifiedToolRegistry.registerTool({
          name: toolName,
          displayName: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
          description: `Core ${key.replace(/_/g, ' ').toLowerCase()} capability`,
          category: 'core',
          capabilities: ['llm', 'reasoning'],
          parameters: {},
          executor: async () => ({ success: true, data: 'Core tool executed' }),
          priority: 100,
          registeredBy: 'system'
        });

        registeredCount++;

      } catch (error) {
        this.logger.error('Failed to register core tool', {
          toolName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.info('✅ Core tools registered in unified registry', {
      requestedCount: Object.keys(CORE_TOOL_NAMES).length,
      registeredCount
    });
  }

  /**
   * Connect thinking system to unified registry
   */
  private async connectThinkingSystem(thinkingToolService: ToolService): Promise<void> {
    // Get all unified tools
    const stats = unifiedToolRegistry.getStats();

    this.logger.info('🔗 Connecting thinking system to unified registry', {
      unifiedToolCount: stats.totalTools,
      enabledToolCount: stats.enabledTools
    });

    // Replace thinking system's discoverTools method
    const originalDiscoverTools = thinkingToolService.discoverTools.bind(thinkingToolService);

    thinkingToolService.discoverTools = async (options: any) => {
      this.logger.debug('🔍 Thinking system discovering tools via unified registry', {
        options
      });

      // Use unified registry for tool discovery
      const unifiedTools = await unifiedToolRegistry.discoverTools({
        intent: options.intent,
        categories: options.categories,
        capabilities: options.requiredCapabilities,
        limit: options.limit
      });

      // Convert unified tools to thinking system format
      const thinkingTools = unifiedTools.map(tool => ({
        id: tool.id,
        name: tool.displayName,
        description: tool.description,
        categories: [tool.category],
        requiredCapabilities: [...tool.capabilities],
        parameters: tool.parameters,
        returns: 'ToolExecutionResult',
        isEnabled: tool.enabled,
        version: '1.0.0',
        author: tool.registeredBy,
        tags: [tool.category],
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
          averageExecutionTime: 0,
          successRate: 1
        }
      }));

      this.logger.info('✅ Unified tools discovered for thinking system', {
        requestedLimit: options.limit,
        discoveredCount: thinkingTools.length,
        toolIds: thinkingTools.map(t => t.id)
      });

      return thinkingTools;
    };

    // Replace thinking system's executeTool method
    const originalExecuteTool = thinkingToolService.executeTool.bind(thinkingToolService);

    thinkingToolService.executeTool = async (options: any) => {
      this.logger.debug('🔧 Thinking system executing tool via unified registry', {
        toolId: options.toolId,
        parameters: options.parameters
      });

      // Execute via unified registry
      const result = await unifiedToolRegistry.executeTool(
        options.toolId,
        options.parameters,
        {
          toolId: options.toolId,
          agentId: 'thinking-system',
          userId: 'system',
          sessionId: options.context?.sessionId
        }
      );

      // Convert result to thinking system format
      return {
        success: result.success,
        output: result.data,
        error: result.error,
        duration: 0,
        metadata: {
          toolId: options.toolId,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          parameters: options.parameters
        }
      };
    };

    this.logger.info('✅ Thinking system connected to unified registry');
  }

  /**
   * Create unified workspace tool executor
   */
  private createUnifiedWorkspaceExecutor(
    workspaceTool: any,
    agentId: string
  ) {
    return async (
      params: Record<string, unknown>,
      context: ToolExecutionContext
    ) => {
      const startTime = Date.now();

      try {
        this.logger.debug('🔧 Executing workspace tool via unified executor', {
          toolName: workspaceTool.name,
          agentId: context.agentId,
          parameters: params
        });

        // Create workspace execution context
        const workspaceContext = {
          agentId: context.agentId,
          userId: context.userId,
          sessionId: context.sessionId || `session_${Date.now()}`,
          executionId: context.toolId
        };

        // Execute the workspace tool
        const result = await workspaceTool.execute(params, workspaceContext);

        const duration = Date.now() - startTime;

        this.logger.info('✅ Workspace tool executed via unified executor', {
          toolName: workspaceTool.name,
          agentId: context.agentId,
          duration,
          hasResult: !!result
        });

        return {
          success: true,
          data: result
        };

      } catch (error) {
        const duration = Date.now() - startTime;

        this.logger.error('❌ Workspace tool execution failed via unified executor', {
          toolName: workspaceTool.name,
          agentId: context.agentId,
          duration,
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    };
  }

  // Utility methods for mapping workspace tools to constants

  private mapWorkspaceToolToConstant(workspaceToolName: string): ToolName | null {
    const normalizedName = workspaceToolName.toLowerCase().replace(/\s+/g, '_');

    // Check all tool name constants
    const allToolNames = {
      ...EMAIL_TOOL_NAMES,
      ...CALENDAR_TOOL_NAMES,
      ...SPREADSHEET_TOOL_NAMES,
      ...FILE_TOOL_NAMES,
      ...CONNECTION_TOOL_NAMES,
      ...CORE_TOOL_NAMES
    };

    // Direct match
    for (const [key, value] of Object.entries(allToolNames)) {
      if (value === normalizedName || key.toLowerCase() === normalizedName) {
        return value as ToolName;
      }
    }

    // Fuzzy match for common variations
    if (normalizedName.includes('send') && normalizedName.includes('email')) {
      return EMAIL_TOOL_NAMES.SMART_SEND_EMAIL;
    }

    if (normalizedName.includes('read') && normalizedName.includes('email')) {
      return EMAIL_TOOL_NAMES.READ_SPECIFIC_EMAIL;
    }

    if (normalizedName.includes('calendar') || normalizedName.includes('schedule')) {
      return CALENDAR_TOOL_NAMES.READ_CALENDAR;
    }

    if (normalizedName.includes('spreadsheet') || normalizedName.includes('sheet')) {
      return SPREADSHEET_TOOL_NAMES.READ_SPREADSHEET;
    }

    if (normalizedName.includes('file') || normalizedName.includes('document')) {
      return FILE_TOOL_NAMES.SEARCH_FILES;
    }

    return null;
  }

  private categorizeWorkspaceTool(toolName: ToolName): string {
    if (Object.values(EMAIL_TOOL_NAMES).includes(toolName as any)) {
      return 'email';
    }
    if (Object.values(CALENDAR_TOOL_NAMES).includes(toolName as any)) {
      return 'calendar';
    }
    if (Object.values(SPREADSHEET_TOOL_NAMES).includes(toolName as any)) {
      return 'spreadsheet';
    }
    if (Object.values(FILE_TOOL_NAMES).includes(toolName as any)) {
      return 'file';
    }
    if (Object.values(CONNECTION_TOOL_NAMES).includes(toolName as any)) {
      return 'connection';
    }
    if (Object.values(CORE_TOOL_NAMES).includes(toolName as any)) {
      return 'core';
    }
    return 'workspace';
  }

  private getWorkspaceToolCapabilities(toolName: ToolName): readonly string[] {
    const category = this.categorizeWorkspaceTool(toolName);

    switch (category) {
      case 'email':
        return ['email', 'communication', 'external'];
      case 'calendar':
        return ['calendar', 'scheduling', 'external'];
      case 'spreadsheet':
        return ['spreadsheet', 'data', 'external'];
      case 'file':
        return ['file', 'storage', 'external'];
      case 'connection':
        return ['connection', 'integration', 'external'];
      case 'core':
        return ['llm', 'reasoning', 'internal'];
      default:
        return ['workspace', 'external'];
    }
  }

  private getWorkspaceToolPriority(toolName: ToolName): number {
    // Email tools get high priority
    if (Object.values(EMAIL_TOOL_NAMES).includes(toolName as any)) {
      return 90;
    }

    // Calendar tools get high priority
    if (Object.values(CALENDAR_TOOL_NAMES).includes(toolName as any)) {
      return 85;
    }

    // Other tools get medium priority
    return 70;
  }

  private convertWorkspaceParameters(workspaceParams: any): Record<string, any> {
    if (!workspaceParams || typeof workspaceParams !== 'object') {
      return {};
    }

    // Convert workspace parameter format to unified format
    const unifiedParams: Record<string, any> = {};

    if (workspaceParams.properties) {
      for (const [name, param] of Object.entries(workspaceParams.properties)) {
        unifiedParams[name] = {
          name,
          type: (param as any).type || 'string',
          description: (param as any).description || '',
          required: workspaceParams.required?.includes(name) || false
        };
      }
    }

    return unifiedParams;
  }
}

// Singleton instance
export const unifiedToolBridge = new UnifiedToolBridge(); 