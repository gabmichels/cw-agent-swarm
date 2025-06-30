/**
 * WorkspaceToolExecutorBridge.ts - Bridges workspace tools with thinking system
 * 
 * This service connects real workspace tool executors to the thinking system's ToolService,
 * replacing fallback executors with actual workspace tool execution.
 */

import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import {
  CALENDAR_TOOL_NAMES,
  CONNECTION_TOOL_NAMES,
  EMAIL_TOOL_NAMES,
  FILE_TOOL_NAMES,
  SPREADSHEET_TOOL_NAMES
} from '../../../constants/tool-names';
import { createLogger } from '../../../lib/logging/winston-logger';
import { WorkspaceAgentTools } from '../../workspace/tools/WorkspaceAgentTools';
import { ToolService } from './ToolService';

export interface WorkspaceToolExecutorBridgeConfig {
  /** Whether to enable debug logging */
  enableDebugLogging?: boolean;
  /** Maximum execution timeout in milliseconds */
  maxExecutionTimeMs?: number;
  /** Whether to validate tool parameters before execution */
  validateParameters?: boolean;
}

/**
 * Bridge service that connects workspace tools to the thinking system
 */
export class WorkspaceToolExecutorBridge {
  private readonly logger: ReturnType<typeof createLogger>;
  private readonly workspaceTools: WorkspaceAgentTools;
  private readonly registeredAgents: Set<string> = new Set();
  private readonly config: Required<WorkspaceToolExecutorBridgeConfig>;

  constructor(config: WorkspaceToolExecutorBridgeConfig = {}) {
    this.logger = createLogger({
      moduleId: 'workspace-tool-executor-bridge'
    });

    this.config = {
      enableDebugLogging: config.enableDebugLogging ?? true,
      maxExecutionTimeMs: config.maxExecutionTimeMs ?? 30000,
      validateParameters: config.validateParameters ?? true
    };

    this.workspaceTools = new WorkspaceAgentTools();
  }

  /**
   * Register workspace tool executors for an agent with the thinking system
   */
  async registerWorkspaceExecutors(
    agent: AgentBase,
    toolService: ToolService
  ): Promise<void> {
    const agentId = agent.getAgentId();

    if (this.registeredAgents.has(agentId)) {
      this.logger.debug('Workspace executors already registered for agent', { agentId });
      return;
    }

    try {
      this.logger.info('Registering workspace tool executors for thinking system', {
        agentId,
        config: this.config
      });

      // Get available workspace tools for this agent
      const availableTools = await this.workspaceTools.getAvailableTools(agentId);

      if (availableTools.length === 0) {
        this.logger.warn('No workspace tools available for agent', { agentId });
        return;
      }

      // Register each workspace tool executor
      let registeredCount = 0;
      for (const tool of availableTools) {
        try {
          const toolName = tool.name.toLowerCase().replace(/\s+/g, '_');

          // Create executor wrapper that handles the workspace tool execution
          const executor = this.createWorkspaceToolExecutor(tool, agentId);

          // Register the executor with the thinking system's ToolService
          toolService.registerExecutor(toolName, executor);

          registeredCount++;

          if (this.config.enableDebugLogging) {
            this.logger.debug('Registered workspace tool executor', {
              agentId,
              toolName,
              originalName: tool.name,
              description: tool.description
            });
          }
        } catch (error) {
          this.logger.warn('Failed to register workspace tool executor', {
            agentId,
            toolName: tool.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Also register common workspace tools by their standard names
      await this.registerStandardWorkspaceExecutors(agentId, toolService, availableTools);

      this.registeredAgents.add(agentId);

      this.logger.info('✅ Workspace tool executors registered successfully', {
        agentId,
        toolCount: registeredCount,
        availableToolCount: availableTools.length
      });

    } catch (error) {
      this.logger.error('Failed to register workspace tool executors', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Register standard workspace tool executors using constant names
   */
  private async registerStandardWorkspaceExecutors(
    agentId: string,
    toolService: ToolService,
    availableTools: any[]
  ): Promise<void> {
    const toolMap = new Map<string, any>();

    // Create a map of available tools by various name patterns
    for (const tool of availableTools) {
      const normalizedName = tool.name.toLowerCase().replace(/\s+/g, '_');
      toolMap.set(normalizedName, tool);
      toolMap.set(tool.name.toLowerCase(), tool);
      toolMap.set(tool.name, tool);
    }

    // Register email tools
    await this.registerToolExecutorsByCategory(
      'Email',
      EMAIL_TOOL_NAMES,
      toolMap,
      agentId,
      toolService
    );

    // Register calendar tools
    await this.registerToolExecutorsByCategory(
      'Calendar',
      CALENDAR_TOOL_NAMES,
      toolMap,
      agentId,
      toolService
    );

    // Register spreadsheet tools
    await this.registerToolExecutorsByCategory(
      'Spreadsheet',
      SPREADSHEET_TOOL_NAMES,
      toolMap,
      agentId,
      toolService
    );

    // Register file tools
    await this.registerToolExecutorsByCategory(
      'File',
      FILE_TOOL_NAMES,
      toolMap,
      agentId,
      toolService
    );

    // Register connection tools
    await this.registerToolExecutorsByCategory(
      'Connection',
      CONNECTION_TOOL_NAMES,
      toolMap,
      agentId,
      toolService
    );
  }

  /**
   * Register tool executors for a specific category
   */
  private async registerToolExecutorsByCategory(
    categoryName: string,
    toolNames: Record<string, string>,
    toolMap: Map<string, any>,
    agentId: string,
    toolService: ToolService
  ): Promise<void> {
    let registeredCount = 0;

    for (const [constantName, toolName] of Object.entries(toolNames)) {
      // Try to find the tool in various name formats
      const possibleNames = [
        toolName,
        toolName.replace(/_/g, ' '),
        toolName.replace(/_/g, ' ').toLowerCase(),
        toolName.toLowerCase(),
        toolName.toUpperCase(),
        // Also try with "Smart" prefix for email tools - NO STRING LITERALS
        toolName.startsWith(EMAIL_TOOL_NAMES.SEND_EMAIL) ? EMAIL_TOOL_NAMES.SMART_SEND_EMAIL : null,
        toolName.startsWith(EMAIL_TOOL_NAMES.SEND_EMAIL) ? 'Smart Send Email' : null
      ].filter(Boolean);

      let foundTool: any = null;
      for (const possibleName of possibleNames) {
        if (toolMap.has(possibleName!)) {
          foundTool = toolMap.get(possibleName!);
          break;
        }
      }

      if (foundTool) {
        try {
          const executor = this.createWorkspaceToolExecutor(foundTool, agentId);
          toolService.registerExecutor(toolName, executor);
          registeredCount++;

          if (this.config.enableDebugLogging) {
            this.logger.debug(`Registered ${categoryName} tool executor`, {
              agentId,
              constantName,
              toolName,
              foundToolName: foundTool.name
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to register ${categoryName} tool executor`, {
            agentId,
            constantName,
            toolName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      } else {
        if (this.config.enableDebugLogging) {
          this.logger.debug(`${categoryName} tool not found`, {
            agentId,
            constantName,
            toolName,
            possibleNames
          });
        }
      }
    }

    if (registeredCount > 0) {
      this.logger.info(`✅ Registered ${categoryName} tool executors`, {
        agentId,
        category: categoryName,
        registeredCount
      });
    }
  }

  /**
   * Create a workspace tool executor wrapper
   */
  private createWorkspaceToolExecutor(
    tool: any,
    agentId: string
  ): (params: Record<string, unknown>) => Promise<unknown> {
    return async (params: Record<string, unknown>): Promise<unknown> => {
      const startTime = Date.now();
      const executionId = `${agentId}_${tool.name}_${startTime}`;

      try {
        if (this.config.enableDebugLogging) {
          this.logger.debug('🔧 Executing workspace tool', {
            agentId,
            toolName: tool.name,
            executionId,
            parameters: params
          });
        }

        // Validate parameters if enabled
        if (this.config.validateParameters && tool.parameters) {
          this.validateToolParameters(tool, params);
        }

        // Create execution context
        const context = {
          agentId,
          userId: agentId, // Use agentId as userId for now
          sessionId: executionId,
          executionId
        };

        // Execute the workspace tool with timeout
        const result = await Promise.race([
          tool.execute(params, context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tool execution timeout')), this.config.maxExecutionTimeMs)
          )
        ]);

        const duration = Date.now() - startTime;

        this.logger.info('✅ Workspace tool executed successfully', {
          agentId,
          toolName: tool.name,
          executionId,
          duration,
          hasResult: !!result
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        this.logger.error('❌ Workspace tool execution failed', {
          agentId,
          toolName: tool.name,
          executionId,
          duration,
          error: error instanceof Error ? error.message : String(error),
          parameters: params
        });

        // Re-throw the error so the thinking system can handle it appropriately
        throw error;
      }
    };
  }

  /**
   * Validate tool parameters against tool schema
   */
  private validateToolParameters(tool: any, params: Record<string, unknown>): void {
    if (!tool.parameters || !tool.parameters.properties) {
      return; // No validation schema available
    }

    const schema = tool.parameters;
    const required = schema.required || [];

    // Check required parameters
    for (const requiredParam of required) {
      if (!(requiredParam in params)) {
        throw new Error(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Basic type validation
    for (const [paramName, value] of Object.entries(params)) {
      const paramSchema = schema.properties[paramName];
      if (!paramSchema) {
        continue; // Allow unknown parameters
      }

      if (paramSchema.type && value !== null && value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== paramSchema.type) {
          this.logger.warn('Parameter type mismatch', {
            parameter: paramName,
            expected: paramSchema.type,
            actual: actualType,
            value
          });
        }
      }
    }
  }

  /**
   * Check if workspace executors are registered for an agent
   */
  isRegistered(agentId: string): boolean {
    return this.registeredAgents.has(agentId);
  }

  /**
   * Get list of registered agent IDs
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.registeredAgents);
  }

  /**
   * Unregister workspace executors for an agent
   */
  unregisterWorkspaceExecutors(agentId: string): void {
    this.registeredAgents.delete(agentId);
    this.logger.info('Unregistered workspace executors for agent', { agentId });
  }
} 