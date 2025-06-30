/**
 * WorkspaceAgentIntegration.ts - Main integration service for workspace capabilities
 * 
 * This service orchestrates the integration of workspace capabilities into the agent system,
 * including tool registration, NLP processing, and scheduled task execution.
 */

import { AgentBase } from '../../../agents/shared/base/AgentBase.interface';
import { ManagerType } from '../../../agents/shared/base/managers/ManagerType';
import { ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import { logger } from '../../../lib/logging';
import { WorkspaceCapabilityType } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { WorkspaceAgentTools } from '../tools/WorkspaceAgentTools';
import { parseWorkspaceCommand, WorkspaceCommand, WorkspaceCommandType } from './WorkspaceNLPProcessor';
import { workspaceSchedulerIntegration } from './WorkspaceSchedulerIntegration';

/**
 * Integration result for workspace commands
 */
export interface WorkspaceIntegrationResult {
  success: boolean;
  data?: any;
  error?: string;
  scheduled?: boolean;
  taskId?: string;
  requiresUserChoice?: boolean;
  message?: string;
  availableConnections?: string[];
}

/**
 * Main service for integrating workspace capabilities with agents
 */
export class WorkspaceAgentIntegration {
  private workspaceTools: WorkspaceAgentTools;
  private permissionService: AgentWorkspacePermissionService;
  private integratedAgents: Set<string> = new Set();

  constructor() {
    this.workspaceTools = new WorkspaceAgentTools();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Initialize workspace integration for an agent
   */
  async initializeAgentWorkspace(agent: AgentBase): Promise<void> {
    try {
      const agentId = agent.getAgentId();

      if (this.integratedAgents.has(agentId)) {
        logger.debug(`Workspace already integrated for agent ${agentId}`);
        return;
      }

      logger.info(`Initializing workspace integration for agent ${agentId}`);

      // Get agent's workspace capabilities
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);

      logger.debug('Agent workspace capabilities retrieved', {
        agentId,
        capabilityCount: capabilities.length,
        capabilities: capabilities.map(c => ({
          capability: c.capability,
          provider: c.provider,
          connectionId: c.connectionId
        }))
      });

      if (capabilities.length === 0) {
        logger.info(`No workspace capabilities found for agent ${agentId}`);
        return;
      }

      // Get the agent's tool manager
      const toolManager = agent.getManager<ToolManager>(ManagerType.TOOL);
      if (!toolManager) {
        logger.warn(`Agent ${agentId} does not have a tool manager`);
        return;
      }

      // Register workspace tools
      await this.registerWorkspaceTools(agentId, toolManager, capabilities);

      // Mark as integrated
      this.integratedAgents.add(agentId);

      logger.info(`Workspace integration completed for agent ${agentId}`, {
        capabilityCount: capabilities.length
      });
    } catch (error) {
      logger.error(`Failed to initialize workspace for agent ${agent.getAgentId()}:`, error);
      throw error;
    }
  }

  /**
   * Process a pre-parsed workspace command directly (for ACG integration)
   */
  async processWorkspaceCommand(
    agentId: string,
    command: WorkspaceCommand,
    connectionId?: string
  ): Promise<WorkspaceIntegrationResult> {
    try {
      logger.debug('Processing pre-parsed workspace command', {
        agentId,
        commandType: command.type,
        confidence: command.confidence,
        hasScheduledTime: !!command.scheduledTime,
        hasWorkspaceAccountPreference: !!command.entities.workspaceAccountPreference
      });

      logger.info(`Processing workspace command for agent ${agentId}`, {
        commandType: command.type,
        confidence: command.confidence
      });

      // UNIFIED CONNECTION SELECTION LOGIC
      if (!connectionId) {
        // Always get a default connection for fallback
        const defaultConnectionId = await this.getDefaultConnectionId(agentId);
        if (!defaultConnectionId) {
          return {
            success: false,
            error: 'No workspace connection available'
          };
        }

        // If there's a workspace account preference, use unified smart selection for ALL command types
        if (command.entities.workspaceAccountPreference) {
          logger.debug('Using unified smart connection selection for workspace command', {
            agentId,
            commandType: command.type,
            workspaceAccountPreference: command.entities.workspaceAccountPreference
          });

          try {
            // Import WorkspaceConnectionSelector dynamically to avoid circular dependencies
            const { WorkspaceConnectionSelector } = await import('../providers/WorkspaceConnectionSelector');
            const connectionSelector = new WorkspaceConnectionSelector();

            // Map command type to appropriate capability
            const capability = this.getCapabilityForCommandType(command.type);
            if (!capability) {
              logger.warn('No capability mapping found for command type', {
                agentId,
                commandType: command.type
              });
              connectionId = defaultConnectionId;
            } else {
              // Use connection selector to find the best account
              const selectionResult = await connectionSelector.selectConnection({
                agentId,
                capability,
                recipientEmails: command.entities.attendees || command.entities.recipients || [],
                senderPreference: command.entities.workspaceAccountPreference
              });

              if (!selectionResult.success) {
                if (selectionResult.requiresUserChoice && selectionResult.suggestedMessage) {
                  // Return the clarification message to the user
                  return {
                    success: false,
                    requiresUserChoice: true,
                    message: selectionResult.suggestedMessage,
                    availableConnections: selectionResult.availableConnections?.map(c => c.id) || [],
                    error: selectionResult.error
                  };
                } else {
                  logger.warn('Smart connection selection failed, falling back to default', {
                    agentId,
                    commandType: command.type,
                    error: selectionResult.error
                  });
                  connectionId = defaultConnectionId;
                }
              } else {
                connectionId = selectionResult.connectionId!;
                logger.info('✅ Using smart-selected connection for workspace command', {
                  agentId,
                  commandType: command.type,
                  selectedConnection: selectionResult.connection?.email,
                  selectedProvider: selectionResult.connection?.provider,
                  reason: selectionResult.reason,
                  confidence: selectionResult.confidence
                });
              }
            }
          } catch (error) {
            logger.error('❌ Unified smart connection selection failed, falling back to default', {
              agentId,
              commandType: command.type,
              workspaceAccountPreference: command.entities.workspaceAccountPreference,
              error: error instanceof Error ? error.message : String(error)
            });
            connectionId = defaultConnectionId;
          }
        } else {
          // No workspace account preference - use default connection
          connectionId = defaultConnectionId;
        }
      }

      // Check if this is a scheduled command
      if (command.scheduledTime) {
        return await this.scheduleWorkspaceCommand(agentId, command, connectionId);
      }

      // Execute immediately
      return await this.executeWorkspaceCommand(agentId, command, connectionId);
    } catch (error) {
      logger.error(`Error processing workspace command for agent ${agentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process a user input for workspace commands
   */
  async processWorkspaceInput(
    agentId: string,
    input: string,
    connectionId?: string
  ): Promise<WorkspaceIntegrationResult> {
    try {
      logger.debug('Processing workspace input', {
        agentId,
        inputLength: input.length,
        inputPreview: input.substring(0, 100) + '...'
      });

      // Parse the input for workspace commands
      const command = await parseWorkspaceCommand(input);

      logger.debug('Workspace command parsing result', {
        agentId,
        hasCommand: !!command,
        commandType: command?.type || 'none',
        confidence: command?.confidence || 0
      });

      if (!command) {
        logger.debug('No workspace command detected - command parsing returned null', {
          agentId,
          inputPreview: input.substring(0, 100) + '...'
        });
        return {
          success: false,
          error: 'No workspace command detected'
        };
      }

      // Use the unified processWorkspaceCommand method
      return await this.processWorkspaceCommand(agentId, command, connectionId);
    } catch (error) {
      logger.error(`Error processing workspace input for agent ${agentId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a workspace command immediately
   */
  private async executeWorkspaceCommand(
    agentId: string,
    command: WorkspaceCommand,
    connectionId: string
  ): Promise<WorkspaceIntegrationResult> {
    try {
      // Validate permissions
      const hasPermission = await this.validateCommandPermission(agentId, command, connectionId);
      if (!hasPermission) {
        return {
          success: false,
          error: `Insufficient permissions for ${command.type}`
        };
      }

      // Execute the appropriate tool
      const result = await this.executeCommandTool(agentId, command, connectionId);

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  /**
   * Schedule a workspace command for later execution
   */
  private async scheduleWorkspaceCommand(
    agentId: string,
    command: WorkspaceCommand,
    connectionId: string
  ): Promise<WorkspaceIntegrationResult> {
    try {
      if (!command.scheduledTime) {
        throw new Error('No scheduled time provided');
      }

      const taskId = await workspaceSchedulerIntegration.scheduleWorkspaceTask(
        agentId,
        command,
        connectionId,
        command.scheduledTime,
        {
          description: `Scheduled ${command.intent}`,
          maxRetries: 3
        }
      );

      return {
        success: true,
        scheduled: true,
        taskId,
        data: {
          message: `Command scheduled for ${command.scheduledTime.toISOString()}`,
          taskId,
          commandType: command.type
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scheduling failed'
      };
    }
  }

  /**
   * Execute the appropriate tool for a command
   */
  private async executeCommandTool(
    agentId: string,
    command: WorkspaceCommand,
    connectionId: string
  ): Promise<any> {
    const { type, entities } = command;
    const context = { agentId, userId: agentId };

    logger.debug('Executing workspace command tool', {
      agentId,
      commandType: type,
      entities,
      connectionId
    });

    switch (type) {
      case WorkspaceCommandType.SEND_EMAIL:
        // Always use the connectionId that was intelligently selected above
        // No more per-tool smart selection logic needed
        const emailParams = {
          to: entities.recipients || [],
          subject: entities.subject || 'Email from Agent',
          body: entities.body || 'This email was sent by your agent.',
          connectionId
        };

        logger.debug('Sending email with unified connection selection', {
          agentId,
          emailParams,
          recipientsCount: emailParams.to.length
        });

        if (emailParams.to.length === 0) {
          logger.warn('No recipients found for email command', {
            agentId,
            originalEntities: entities,
            extractedRecipients: entities.recipients
          });
          throw new Error('No email recipients found. Please specify valid email addresses.');
        }

        try {
          const result = await this.workspaceTools.sendEmailTool.execute(emailParams, context);
          logger.info('✅ Email sent successfully', {
            agentId,
            recipients: emailParams.to,
            subject: emailParams.subject,
            result
          });
          return result;
        } catch (error) {
          logger.error('❌ Email sending failed', {
            agentId,
            emailParams,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          throw error;
        }

      case WorkspaceCommandType.READ_EMAIL:
        return await this.workspaceTools.readSpecificEmailTool.execute({
          searchQuery: entities.query,
          connectionId
        }, context);

      case WorkspaceCommandType.REPLY_EMAIL:
        // Find the original email first if needed
        let emailId = entities.emailId;
        if (!emailId && entities.sender) {
          // Search for the last email from the specified sender
          // NOTE: We don't use subject filtering here because ACG can generate subjects
          // that interfere with finding the original email
          const searchCriteria: any = {
            from: entities.sender,
            connectionId
          };

          console.log(`Searching for most recent email from ${entities.sender} (subject filtering disabled to avoid ACG interference)`);


          const searchResults = await this.workspaceTools.searchEmailsTool.execute(searchCriteria, context);
          if (searchResults && searchResults.length > 0) {
            // Filter to ensure we only have emails FROM the specified sender (not TO the sender)
            let filteredEmails = searchResults.filter((email: any) =>
              email.from && email.from.toLowerCase().includes(entities.sender.toLowerCase())
            );

            // Subject filtering is disabled to prevent ACG-generated subjects from interfering with email discovery

            const actualFromSenderEmails = filteredEmails;

            if (actualFromSenderEmails.length > 0) {
              // Sort by date to get the most recent
              const sortedEmails = actualFromSenderEmails.sort((a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              emailId = sortedEmails[0].id;

              console.log(`Found ${actualFromSenderEmails.length} emails from ${entities.sender}, using most recent:`, {
                id: sortedEmails[0].id,
                subject: sortedEmails[0].subject,
                from: sortedEmails[0].from,
                date: sortedEmails[0].date
              });
            } else {
              console.warn(`Search returned ${searchResults.length} results but none are actually FROM ${entities.sender}:`,
                searchResults.map((e: any) => ({ id: e.id, from: e.from, subject: e.subject }))
              );
            }
          }
        }

        if (!emailId) {
          if (entities.sender) {
            throw new Error(`I couldn't find the last email from ${entities.sender}. Could you check if this email address is correct, or try searching for emails from this sender first?`);
          } else {
            throw new Error(`I need more information to reply to an email. Could you specify which email you'd like me to reply to? For example: "reply to the last email from john@example.com" or provide the specific email you want to reply to.`);
          }
        }

        return await this.workspaceTools.replyToEmailTool.execute({
          emailId: emailId,
          body: entities.body || 'Reply sent by agent',
          connectionId
        }, context);

      case WorkspaceCommandType.SEARCH_EMAIL:
        return await this.workspaceTools.searchEmailsTool.execute({
          query: entities.keywords?.join(' '),
          from: entities.sender,
          subject: entities.subject,
          timeframe: entities.timeframe,
          connectionId
        }, context);

      case WorkspaceCommandType.CHECK_EMAIL_ATTENTION:
        return await this.workspaceTools.getEmailAttentionTool.execute({
          connectionId
        }, context);

      case WorkspaceCommandType.ANALYZE_EMAIL:
        return await this.workspaceTools.analyzeEmailsTool.execute({
          analysisType: 'attention',
          timeframe: entities.timeframe || 'today',
          connectionId
        }, context);

      case WorkspaceCommandType.GET_ACTION_ITEMS:
        return await this.workspaceTools.getActionItemsTool.execute({
          timeframe: entities.timeframe || 'today',
          connectionId
        }, context);

      case WorkspaceCommandType.GET_EMAIL_TRENDS:
        return await this.workspaceTools.getEmailTrendsTool.execute({
          timeframe: entities.timeframe || 'this_week',
          connectionId
        }, context);

      case WorkspaceCommandType.FORWARD_EMAIL:
        // Find the original email first if needed
        let forwardEmailId = entities.emailId;
        if (!forwardEmailId && entities.sender) {
          // Search for the last email from the specified sender
          // NOTE: Subject filtering disabled to prevent ACG interference
          const searchCriteria: any = {
            from: entities.sender,
            connectionId
          };

          console.log(`Searching for most recent email from ${entities.sender} to forward (subject filtering disabled)`);

          const searchResults = await this.workspaceTools.searchEmailsTool.execute(searchCriteria, context);
          if (searchResults && searchResults.length > 0) {
            // Filter to ensure we only have emails FROM the specified sender (not TO the sender)
            const actualFromSenderEmails = searchResults.filter((email: any) =>
              email.from && email.from.toLowerCase().includes(entities.sender.toLowerCase())
            );

            if (actualFromSenderEmails.length > 0) {
              // Sort by date to get the most recent
              const sortedEmails = actualFromSenderEmails.sort((a: any, b: any) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              forwardEmailId = sortedEmails[0].id;
            }
          }
        }

        if (!forwardEmailId) {
          if (entities.sender) {
            throw new Error(`I couldn't find the last email from ${entities.sender} to forward. Could you check if this email address is correct, or try searching for emails from this sender first?`);
          } else {
            throw new Error(`I need more information to forward an email. Could you specify which email you'd like me to forward? For example: "forward the last email from john@example.com to jane@company.com" or provide the specific email you want to forward.`);
          }
        }

        if (!entities.recipients || entities.recipients.length === 0) {
          throw new Error('No recipients specified for email forwarding');
        }

        return await this.workspaceTools.forwardEmailTool.execute({
          emailId: forwardEmailId,
          to: entities.recipients,
          body: entities.body || 'Forwarded by agent',
          connectionId
        }, context);

      case WorkspaceCommandType.SCHEDULE_EVENT:
        // Use the unified connection selection - no custom logic needed
        return await this.workspaceTools.scheduleEventTool.execute({
          title: entities.title || 'Agent Scheduled Event',
          startTime: entities.startTime,
          endTime: entities.endTime,
          attendees: entities.attendees || [],
          description: entities.description,
          connectionId
        }, context);

      case WorkspaceCommandType.CHECK_CALENDAR:
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return await this.workspaceTools.readCalendarTool.execute({
          startDate: today.toISOString().split('T')[0],
          endDate: tomorrow.toISOString().split('T')[0],
          connectionId
        }, context);

      case WorkspaceCommandType.FIND_AVAILABILITY:
        return await this.workspaceTools.findAvailabilityTool.execute({
          date: entities.date || new Date().toISOString().split('T')[0],
          duration: entities.duration || 30,
          connectionId
        }, context);

      case WorkspaceCommandType.SUMMARIZE_DAY:
        const dayStart = new Date();
        const dayEnd = new Date();
        dayEnd.setHours(23, 59, 59, 999);

        return await this.workspaceTools.readCalendarTool.execute({
          startDate: dayStart.toISOString().split('T')[0],
          endDate: dayEnd.toISOString().split('T')[0],
          connectionId
        }, context);

      case WorkspaceCommandType.CREATE_SPREADSHEET:
        return await this.workspaceTools.createSpreadsheetTool.execute({
          title: entities.title || 'Agent Created Spreadsheet',
          sheets: entities.categories ? [{ title: 'Sheet1', headers: entities.categories }] : undefined,
          connectionId
        }, context);

      case WorkspaceCommandType.READ_SPREADSHEET:
        return await this.workspaceTools.readSpreadsheetTool.execute({
          spreadsheetId: entities.spreadsheetId || 'default',
          range: entities.range || 'A1:Z100',
          connectionId
        }, context);

      case WorkspaceCommandType.UPDATE_SPREADSHEET:
        return await this.workspaceTools.updateSpreadsheetTool.execute({
          spreadsheetId: entities.spreadsheetId || 'default',
          range: entities.range || 'A1',
          values: entities.values || [['Updated by Agent']],
          connectionId
        }, context);

      case WorkspaceCommandType.SEARCH_FILES:
        return await this.workspaceTools.searchFilesTool.execute({
          name: entities.query,
          mimeType: entities.fileType,
          connectionId
        }, context);

      case WorkspaceCommandType.UPLOAD_FILE:
        return await this.workspaceTools.uploadFileTool.execute({
          name: entities.fileName || 'agent-upload.txt',
          content: entities.content || 'File uploaded by agent',
          parentFolder: entities.folderId,
          connectionId
        }, context);

      case WorkspaceCommandType.SHARE_FILE:
        return await this.workspaceTools.shareFileTool.execute({
          fileId: entities.fileId || 'default',
          emails: [entities.email],
          role: entities.role || 'reader',
          connectionId
        }, context);

      default:
        throw new Error(`Unsupported command type: ${type}`);
    }
  }

  /**
   * Register workspace tools with an agent's tool manager
   */
  private async registerWorkspaceTools(
    agentId: string,
    toolManager: ToolManager,
    capabilities: any[]
  ): Promise<void> {
    const availableTools = await this.workspaceTools.getAvailableTools(agentId);

    for (const tool of availableTools) {
      try {
        // Convert AgentTool to Tool format for ToolManager
        const toolForManager = {
          id: tool.name.toLowerCase().replace(/\s+/g, '_'),
          name: tool.name,
          description: tool.description,
          category: 'workspace' as any,
          enabled: true,
          experimental: false,
          version: '1.0.0',
          parameters: tool.parameters,
          execute: async (params: unknown, context?: unknown) => {
            return await tool.execute(params as any, context as any);
          }
        };

        await toolManager.registerTool(toolForManager);
        logger.debug(`Registered workspace tool: ${tool.name} for agent ${agentId}`);
      } catch (error) {
        logger.warn(`Failed to register tool ${tool.name}:`, error);
      }
    }

    logger.info(`Registered ${availableTools.length} workspace tools for agent ${agentId}`);
  }

  /**
   * Validate that an agent has permission for a command
   */
  private async validateCommandPermission(
    agentId: string,
    command: WorkspaceCommand,
    connectionId: string
  ): Promise<boolean> {
    const capabilityMap = {
      [WorkspaceCommandType.SEND_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.READ_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.REPLY_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.FORWARD_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.SEARCH_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.ANALYZE_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.CHECK_EMAIL_ATTENTION]: 'EMAIL_READ',
      [WorkspaceCommandType.GET_ACTION_ITEMS]: 'EMAIL_READ',
      [WorkspaceCommandType.GET_EMAIL_TRENDS]: 'EMAIL_READ',
      [WorkspaceCommandType.SCHEDULE_EVENT]: 'CALENDAR_CREATE',
      [WorkspaceCommandType.CHECK_CALENDAR]: 'CALENDAR_READ',
      [WorkspaceCommandType.FIND_AVAILABILITY]: 'CALENDAR_READ',
      [WorkspaceCommandType.EDIT_EVENT]: 'CALENDAR_EDIT',
      [WorkspaceCommandType.DELETE_EVENT]: 'CALENDAR_DELETE',
      [WorkspaceCommandType.FIND_EVENTS]: 'CALENDAR_READ',
      [WorkspaceCommandType.SUMMARIZE_DAY]: 'CALENDAR_READ',
      [WorkspaceCommandType.SEARCH_FILES]: 'DRIVE_READ',
      [WorkspaceCommandType.UPLOAD_FILE]: 'DRIVE_UPLOAD',
      [WorkspaceCommandType.SHARE_FILE]: 'DRIVE_MANAGE',
      [WorkspaceCommandType.GET_FILE_DETAILS]: 'DRIVE_READ',
      [WorkspaceCommandType.CREATE_SPREADSHEET]: 'SPREADSHEET_CREATE',
      [WorkspaceCommandType.READ_SPREADSHEET]: 'SPREADSHEET_READ',
      [WorkspaceCommandType.UPDATE_SPREADSHEET]: 'SPREADSHEET_EDIT',
      [WorkspaceCommandType.ANALYZE_SPREADSHEET]: 'SPREADSHEET_READ',
      [WorkspaceCommandType.CREATE_EXPENSE_TRACKER]: 'SPREADSHEET_CREATE',
      [WorkspaceCommandType.CANCEL_EVENT]: 'CALENDAR_DELETE',
      [WorkspaceCommandType.UNKNOWN]: 'UNKNOWN'
    };

    const requiredCapability = capabilityMap[command.type];
    if (!requiredCapability) {
      return false;
    }

    try {
      logger.debug('Validating workspace command permission', {
        agentId,
        commandType: command.type,
        requiredCapability,
        connectionId
      });

      const validation = await this.permissionService.validatePermissions(
        agentId,
        requiredCapability as any,
        connectionId
      );

      logger.debug('Permission validation result', {
        agentId,
        commandType: command.type,
        requiredCapability,
        connectionId,
        isValid: validation.isValid,
        error: validation.error
      });

      return validation.isValid;
    } catch (error) {
      logger.error('Permission validation failed:', error);
      return false;
    }
  }

  /**
   * Get the default workspace connection for an agent
   */
  private async getDefaultConnectionId(agentId: string): Promise<string | undefined> {
    try {
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
      if (capabilities.length > 0) {
        return capabilities[0].connectionId;
      }
    } catch (error) {
      logger.error('Failed to get default connection:', error);
    }
    return undefined;
  }

  /**
   * Check if an agent has workspace integration
   */
  isAgentIntegrated(agentId: string): boolean {
    return this.integratedAgents.has(agentId);
  }

  /**
   * Get workspace capabilities for an agent
   */
  async getAgentCapabilities(agentId: string): Promise<any[]> {
    return await this.permissionService.getAgentWorkspaceCapabilities(agentId);
  }

  /**
   * Remove workspace integration for an agent
   */
  removeAgentIntegration(agentId: string): void {
    this.integratedAgents.delete(agentId);
    logger.info(`Removed workspace integration for agent ${agentId}`);
  }

  /**
   * Get available workspace tools for an agent
   */
  async getAvailableTools(agentId: string): Promise<any[]> {
    try {
      return await this.workspaceTools.getAvailableTools(agentId);
    } catch (error) {
      logger.error('Failed to get available workspace tools:', error);
      return [];
    }
  }

  /**
   * Map workspace command type to appropriate capability
   */
  private getCapabilityForCommandType(commandType: string): WorkspaceCapabilityType | null {
    const capabilityMap: Record<string, WorkspaceCapabilityType> = {
      [WorkspaceCommandType.SEND_EMAIL]: WorkspaceCapabilityType.EMAIL_SEND,
      [WorkspaceCommandType.READ_EMAIL]: WorkspaceCapabilityType.EMAIL_READ,
      [WorkspaceCommandType.SEARCH_EMAIL]: WorkspaceCapabilityType.EMAIL_READ,
      [WorkspaceCommandType.CHECK_EMAIL_ATTENTION]: WorkspaceCapabilityType.EMAIL_READ,
      [WorkspaceCommandType.ANALYZE_EMAIL]: WorkspaceCapabilityType.EMAIL_READ,
      [WorkspaceCommandType.GET_ACTION_ITEMS]: WorkspaceCapabilityType.EMAIL_READ,
      [WorkspaceCommandType.SCHEDULE_EVENT]: WorkspaceCapabilityType.CALENDAR_CREATE,
      [WorkspaceCommandType.CHECK_CALENDAR]: WorkspaceCapabilityType.CALENDAR_READ,
      [WorkspaceCommandType.FIND_AVAILABILITY]: WorkspaceCapabilityType.CALENDAR_READ,
      [WorkspaceCommandType.SUMMARIZE_DAY]: WorkspaceCapabilityType.CALENDAR_READ,
      [WorkspaceCommandType.CREATE_SPREADSHEET]: WorkspaceCapabilityType.SPREADSHEET_CREATE,
      [WorkspaceCommandType.READ_SPREADSHEET]: WorkspaceCapabilityType.SPREADSHEET_READ,
      [WorkspaceCommandType.UPDATE_SPREADSHEET]: WorkspaceCapabilityType.SPREADSHEET_EDIT,
      [WorkspaceCommandType.SEARCH_FILES]: WorkspaceCapabilityType.DRIVE_READ,
      [WorkspaceCommandType.UPLOAD_FILE]: WorkspaceCapabilityType.DRIVE_UPLOAD,
      [WorkspaceCommandType.SHARE_FILE]: WorkspaceCapabilityType.DRIVE_MANAGE
    };

    return capabilityMap[commandType] || null;
  }
}

// Export singleton instance
export const workspaceAgentIntegration = new WorkspaceAgentIntegration(); 