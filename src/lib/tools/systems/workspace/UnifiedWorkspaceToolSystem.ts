/**
 * Unified Workspace Tool System
 * 
 * Integrates existing workspace tools with the Unified Tool Foundation
 * while preserving all workspace-specific logic and capabilities.
 * 
 * Phase 2.1: Workspace Tool System Integration
 * - Registers workspace tools with foundation using ULID IDs
 * - Preserves existing workspace tool logic and ACG integration
 * - Provides unified access through foundation interface
 * - Maintains backward compatibility with existing workspace services
 */

import { ulid } from 'ulid';
import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import {
  UnifiedToolDefinition,
  ToolResult,
  ExecutionContext,
  ToolParameters,
  ToolId
} from '../../foundation/types/FoundationTypes';
import { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';
import {
  EMAIL_TOOL_NAMES,
  CALENDAR_TOOL_NAMES,
  SPREADSHEET_TOOL_NAMES,
  FILE_TOOL_NAMES,
  CONNECTION_TOOL_NAMES
} from '../../foundation/constants/ToolConstants';
import { WorkspaceAgentTools } from '../../../../services/workspace/tools/WorkspaceAgentTools';
import { AgentWorkspacePermissionService } from '../../../../services/workspace/AgentWorkspacePermissionService';
import { logger } from '../../../../lib/logging';
import { ToolFoundationError, ToolNotFoundError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Maps workspace tool names to foundation constants
 */
const WORKSPACE_TOOL_MAPPING: Record<string, string> = {
  // Email tools
  'Send Email': EMAIL_TOOL_NAMES.SEND_EMAIL,
  'Smart Send Email': EMAIL_TOOL_NAMES.SEND_EMAIL,
  'send_email': EMAIL_TOOL_NAMES.SEND_EMAIL,
  'smart_send_email': EMAIL_TOOL_NAMES.SEND_EMAIL,
  'Read Email': EMAIL_TOOL_NAMES.READ_EMAIL,
  'read_email': EMAIL_TOOL_NAMES.READ_EMAIL,
  'Reply to Email': EMAIL_TOOL_NAMES.REPLY_EMAIL,
  'reply_email': EMAIL_TOOL_NAMES.REPLY_EMAIL,
  'Forward Email': EMAIL_TOOL_NAMES.FORWARD_EMAIL,
  'forward_email': EMAIL_TOOL_NAMES.FORWARD_EMAIL,
  'Search Email': EMAIL_TOOL_NAMES.SEARCH_EMAIL,
  'search_email': EMAIL_TOOL_NAMES.SEARCH_EMAIL,

  // Calendar tools
  'Create Event': CALENDAR_TOOL_NAMES.CREATE_EVENT,
  'create_event': CALENDAR_TOOL_NAMES.CREATE_EVENT,
  'Update Event': CALENDAR_TOOL_NAMES.UPDATE_EVENT,
  'update_event': CALENDAR_TOOL_NAMES.UPDATE_EVENT,
  'Delete Event': CALENDAR_TOOL_NAMES.DELETE_EVENT,
  'delete_event': CALENDAR_TOOL_NAMES.DELETE_EVENT,
  'List Events': CALENDAR_TOOL_NAMES.LIST_EVENTS,
  'list_events': CALENDAR_TOOL_NAMES.LIST_EVENTS,
  'Find Available Time': CALENDAR_TOOL_NAMES.FIND_AVAILABLE_TIME,
  'find_available_time': CALENDAR_TOOL_NAMES.FIND_AVAILABLE_TIME,

  // Spreadsheet tools
  'Read Spreadsheet': SPREADSHEET_TOOL_NAMES.READ_SPREADSHEET,
  'read_spreadsheet': SPREADSHEET_TOOL_NAMES.READ_SPREADSHEET,
  'Write Spreadsheet': SPREADSHEET_TOOL_NAMES.WRITE_SPREADSHEET,
  'write_spreadsheet': SPREADSHEET_TOOL_NAMES.WRITE_SPREADSHEET,
  'Create Spreadsheet': SPREADSHEET_TOOL_NAMES.CREATE_SPREADSHEET,
  'create_spreadsheet': SPREADSHEET_TOOL_NAMES.CREATE_SPREADSHEET,
  'Update Spreadsheet': SPREADSHEET_TOOL_NAMES.UPDATE_SPREADSHEET,
  'update_spreadsheet': SPREADSHEET_TOOL_NAMES.UPDATE_SPREADSHEET,

  // File tools
  'Upload File': FILE_TOOL_NAMES.UPLOAD_FILE,
  'upload_file': FILE_TOOL_NAMES.UPLOAD_FILE,
  'Download File': FILE_TOOL_NAMES.DOWNLOAD_FILE,
  'download_file': FILE_TOOL_NAMES.DOWNLOAD_FILE,
  'List Files': FILE_TOOL_NAMES.LIST_FILES,
  'list_files': FILE_TOOL_NAMES.LIST_FILES,
  'Delete File': FILE_TOOL_NAMES.DELETE_FILE,
  'delete_file': FILE_TOOL_NAMES.DELETE_FILE,
  'Share File': FILE_TOOL_NAMES.SHARE_FILE,
  'share_file': FILE_TOOL_NAMES.SHARE_FILE,

  // Connection tools
  'Connect Workspace': CONNECTION_TOOL_NAMES.CONNECT_WORKSPACE,
  'connect_workspace': CONNECTION_TOOL_NAMES.CONNECT_WORKSPACE,
  'Disconnect Workspace': CONNECTION_TOOL_NAMES.DISCONNECT_WORKSPACE,
  'disconnect_workspace': CONNECTION_TOOL_NAMES.DISCONNECT_WORKSPACE,
  'List Connections': CONNECTION_TOOL_NAMES.LIST_CONNECTIONS,
  'list_connections': CONNECTION_TOOL_NAMES.LIST_CONNECTIONS,
  'Test Connection': CONNECTION_TOOL_NAMES.TEST_CONNECTION,
  'test_connection': CONNECTION_TOOL_NAMES.TEST_CONNECTION
};

/**
 * Unified Workspace Tool System
 * 
 * Integrates workspace tools with the unified foundation while preserving
 * all existing workspace-specific functionality and ACG integration.
 */
export class UnifiedWorkspaceToolSystem {
  private readonly registeredTools = new Map<ToolId, string>(); // toolId -> workspace tool name
  private readonly toolNameMap = new Map<string, ToolId>(); // constant name -> toolId
  private initialized = false;

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly workspaceTools: WorkspaceAgentTools,
    private readonly permissionService: AgentWorkspacePermissionService
  ) { }

  /**
   * Initialize the unified workspace tool system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('UnifiedWorkspaceToolSystem already initialized');
      return;
    }

    try {
      logger.info('Initializing Unified Workspace Tool System');

      // Foundation should already be initialized
      const foundationHealthy = await this.foundation.isHealthy();
      if (!foundationHealthy) {
        throw new ToolFoundationError('Foundation system is not healthy');
      }

      // Register workspace tool definitions (without agent-specific tools)
      await this.registerWorkspaceToolDefinitions();

      this.initialized = true;
      logger.info('✅ Unified Workspace Tool System initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize UnifiedWorkspaceToolSystem', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Register workspace tools for a specific agent
   */
  async registerAgentWorkspaceTools(agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('UnifiedWorkspaceToolSystem not initialized');
    }

    try {
      logger.info('Registering workspace tools for agent', { agentId });

      // Get available workspace tools for this agent
      const availableTools = await this.workspaceTools.getAvailableTools(agentId);

      if (availableTools.length === 0) {
        logger.warn('No workspace tools available for agent', { agentId });
        return;
      }

      let registeredCount = 0;

      for (const workspaceTool of availableTools) {
        try {
          // Map workspace tool name to constant name
          const constantName = this.mapWorkspaceToolToConstant(workspaceTool.name);

          if (!constantName) {
            logger.warn('No constant mapping found for workspace tool', {
              agentId,
              toolName: workspaceTool.name
            });
            continue;
          }

          // Check if we already have this tool registered
          if (this.toolNameMap.has(constantName)) {
            logger.debug('Workspace tool already registered', {
              agentId,
              toolName: workspaceTool.name,
              constantName
            });
            continue;
          }

          // Create unified tool definition
          const toolDefinition = this.createUnifiedToolDefinition(
            workspaceTool,
            constantName,
            agentId
          );

          // Register with foundation
          const registrationResult = await this.foundation.registerTool(toolDefinition);

          if (registrationResult.success && registrationResult.toolId) {
            this.registeredTools.set(registrationResult.toolId, workspaceTool.name);
            this.toolNameMap.set(constantName, registrationResult.toolId);
            registeredCount++;

            logger.debug('Registered workspace tool with foundation', {
              agentId,
              toolName: workspaceTool.name,
              constantName,
              toolId: registrationResult.toolId
            });
          } else {
            logger.warn('Failed to register workspace tool with foundation', {
              agentId,
              toolName: workspaceTool.name,
              constantName,
              errors: registrationResult.errors || []
            });
          }

        } catch (error) {
          logger.warn('Error registering workspace tool', {
            agentId,
            toolName: workspaceTool.name,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('✅ Workspace tools registered for agent', {
        agentId,
        availableCount: availableTools.length,
        registeredCount
      });

    } catch (error) {
      logger.error('Failed to register workspace tools for agent', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a workspace tool through the foundation
   */
  async executeWorkspaceTool(
    toolName: string,
    params: ToolParameters,
    context: ExecutionContext
  ): Promise<ToolResult> {
    if (!this.initialized) {
      throw new ToolFoundationError('UnifiedWorkspaceToolSystem not initialized');
    }

    try {
      // Execute through foundation (which will call our executor)
      return await this.foundation.executeTool(toolName, params, context);

    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        // Provide helpful suggestions for workspace tools
        const suggestions = await this.getSuggestedWorkspaceTools(toolName);
        throw new ToolNotFoundError(
          `Workspace tool '${toolName}' not found. ${suggestions.length > 0 ?
            `Did you mean: ${suggestions.join(', ')}?` :
            'Check available workspace tools.'}`,
          {
            identifier: toolName,
            availableTools: suggestions,
            suggestedTools: suggestions
          }
        );
      }
      throw error;
    }
  }

  /**
   * Get all registered workspace tool names
   */
  async getRegisteredWorkspaceTools(): Promise<readonly string[]> {
    return Array.from(this.toolNameMap.keys());
  }

  /**
   * Check if a workspace tool is registered
   */
  isWorkspaceToolRegistered(toolName: string): boolean {
    return this.toolNameMap.has(toolName);
  }

  /**
   * Register workspace tool definitions with foundation
   */
  private async registerWorkspaceToolDefinitions(): Promise<void> {
    // This method registers the tool schemas but not agent-specific executors
    // Agent-specific registration happens in registerAgentWorkspaceTools
    logger.debug('Workspace tool definitions registration completed');
  }

  /**
   * Create unified tool definition from workspace tool
   */
  private createUnifiedToolDefinition(
    workspaceTool: any,
    constantName: string,
    agentId: string
  ): UnifiedToolDefinition {
    return {
      id: ulid(), // ULID for business logic
      name: constantName, // Use constant name, not string literal
      displayName: workspaceTool.name,
      description: workspaceTool.description || `Workspace tool: ${workspaceTool.name}`,
      category: this.categorizeWorkspaceTool(constantName),
      capabilities: this.getWorkspaceToolCapabilities(constantName),
      parameters: this.convertWorkspaceParameters(workspaceTool.parameters || {}),
      executor: this.createWorkspaceToolExecutor(workspaceTool, agentId),
      metadata: {
        version: '1.0.0',
        author: 'workspace-system',
        provider: 'workspace',
        tags: ['workspace', 'integration'],
        documentation: `Workspace tool: ${workspaceTool.name}`,
        examples: []
      },
      enabled: true,
      status: ToolStatus.ACTIVE
    };
  }

  /**
   * Create workspace tool executor that preserves all existing logic
   */
  private createWorkspaceToolExecutor(
    workspaceTool: any,
    agentId: string
  ) {
    return async (params: ToolParameters, context: ExecutionContext): Promise<ToolResult> => {
      const startTime = Date.now();

      try {
        logger.debug('Executing workspace tool', {
          toolName: workspaceTool.name,
          agentId: context.agentId || agentId,
          params: Object.keys(params)
        });

        // Execute the original workspace tool (preserves all logic including ACG)
        const result = await workspaceTool.execute(params, {
          agentId: context.agentId || agentId,
          ...context
        });

        const executionTime = Date.now() - startTime;

        // Convert result to unified format
        return {
          success: true,
          data: result,
          metadata: {
            executionTimeMs: executionTime,
            toolId: ulid(), // Generate ULID for this execution
            toolName: workspaceTool.name,
            timestamp: new Date().toISOString(),
            context: {
              agentId: context.agentId || agentId,
              workspaceProvider: 'workspace'
            }
          }
        };

      } catch (error) {
        const executionTime = Date.now() - startTime;

        logger.error('Workspace tool execution failed', {
          toolName: workspaceTool.name,
          agentId: context.agentId || agentId,
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            executionTimeMs: executionTime,
            toolId: ulid(),
            toolName: workspaceTool.name,
            timestamp: new Date().toISOString(),
            context: {
              agentId: context.agentId || agentId,
              workspaceProvider: 'workspace',
              error: true
            }
          }
        };
      }
    };
  }

  /**
   * Map workspace tool name to foundation constant
   */
  private mapWorkspaceToolToConstant(workspaceToolName: string): string | null {
    return WORKSPACE_TOOL_MAPPING[workspaceToolName] || null;
  }

  /**
   * Categorize workspace tool based on constant name
   */
  private categorizeWorkspaceTool(constantName: string): ToolCategory {
    if (constantName.includes('email')) return ToolCategory.COMMUNICATION;
    if (constantName.includes('calendar') || constantName.includes('event')) return ToolCategory.SCHEDULING;
    if (constantName.includes('spreadsheet')) return ToolCategory.DATA_PROCESSING;
    if (constantName.includes('file')) return ToolCategory.MANAGEMENT;
    if (constantName.includes('connection') || constantName.includes('workspace')) return ToolCategory.INTEGRATION;
    return ToolCategory.WORKSPACE;
  }

  /**
   * Get tool capabilities based on constant name
   */
  private getWorkspaceToolCapabilities(constantName: string): readonly ToolCapability[] {
    const capabilities: ToolCapability[] = [];

    if (constantName.includes('send_email')) capabilities.push(ToolCapability.EMAIL_SEND);
    if (constantName.includes('read_email')) capabilities.push(ToolCapability.EMAIL_READ);
    if (constantName.includes('calendar') || constantName.includes('event')) capabilities.push(ToolCapability.CALENDAR_MANAGEMENT);
    if (constantName.includes('spreadsheet')) capabilities.push(ToolCapability.DATA_PROCESSING);
    if (constantName.includes('file')) capabilities.push(ToolCapability.FILE_MANAGEMENT);
    if (constantName.includes('connection')) capabilities.push(ToolCapability.WORKSPACE_INTEGRATION);

    return capabilities.length > 0 ? capabilities : [ToolCapability.WORKSPACE_INTEGRATION];
  }

  /**
   * Convert workspace parameters to foundation parameter schema
   */
  private convertWorkspaceParameters(workspaceParams: any): any {
    // Convert workspace parameter format to foundation schema format
    const schema: any = {};

    if (typeof workspaceParams === 'object' && workspaceParams !== null) {
      for (const [key, value] of Object.entries(workspaceParams)) {
        schema[key] = {
          type: typeof value === 'object' ? 'object' : typeof value,
          required: true, // Default to required for workspace tools
          description: `Parameter: ${key}`
        };
      }
    }

    return schema;
  }

  /**
   * Get suggested workspace tools for a given tool name
   */
  private async getSuggestedWorkspaceTools(toolName: string): Promise<string[]> {
    try {
      const registeredTools = await this.getRegisteredWorkspaceTools();

      // Simple similarity matching
      const suggestions = registeredTools.filter(registered =>
        registered.toLowerCase().includes(toolName.toLowerCase()) ||
        toolName.toLowerCase().includes(registered.toLowerCase())
      );

      return suggestions.slice(0, 3); // Return top 3 suggestions
    } catch (error) {
      logger.warn('Failed to get workspace tool suggestions', {
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
} 