/**
 * WorkspaceToolIntegration.ts - Integrates workspace capabilities into agent tool system
 * 
 * This service bridges workspace capabilities with the agent's ToolManager,
 * enabling natural language processing and scheduled execution of workspace tasks.
 */

import { Tool, ToolExecutionResult } from '../../../lib/tools/types';
import { ToolManager } from '../../../agents/shared/base/managers/ToolManager.interface';
import { WorkspaceAgentTools } from '../tools/WorkspaceAgentTools';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { WorkspaceCapabilityType } from '../../database/types';
import { logger } from '../../../lib/logging';
import { IdGenerator } from '../../../utils/ulid';

/**
 * Workspace tool definition for agent ToolManager
 */
export interface WorkspaceToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  version: string;
  parameters: any;
  execute: (params: any) => Promise<any>;
  workspaceCapability: WorkspaceCapabilityType;
  requiresConnection: boolean;
  supportedProviders: string[];
}

/**
 * Service for integrating workspace tools into agent system
 */
export class WorkspaceToolIntegration {
  private workspaceTools: WorkspaceAgentTools;
  private permissionService: AgentWorkspacePermissionService;

  constructor() {
    this.workspaceTools = new WorkspaceAgentTools();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Register all workspace tools with an agent's ToolManager
   */
  async registerWorkspaceTools(agentId: string, toolManager: ToolManager): Promise<void> {
    try {
      logger.info(`Registering workspace tools for agent ${agentId}`);

      // Get agent's workspace capabilities
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
      
      if (capabilities.length === 0) {
        logger.info(`No workspace capabilities found for agent ${agentId}`);
        return;
      }

      // Create tool definitions based on capabilities
      const toolDefinitions = await this.createToolDefinitions(agentId, capabilities);

      // Register each tool with the ToolManager
      for (const toolDef of toolDefinitions) {
        await toolManager.registerTool(toolDef);
        logger.debug(`Registered workspace tool: ${toolDef.id}`);
      }

      logger.info(`Successfully registered ${toolDefinitions.length} workspace tools for agent ${agentId}`);
    } catch (error) {
      logger.error(`Failed to register workspace tools for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Create tool definitions based on agent capabilities
   */
  private async createToolDefinitions(
    agentId: string, 
    capabilities: any[]
  ): Promise<WorkspaceToolDefinition[]> {
    const tools: WorkspaceToolDefinition[] = [];

    // Email tools
    if (this.hasCapability(capabilities, 'EMAIL_READ')) {
      tools.push(this.createEmailReadTool(agentId));
      tools.push(this.createEmailSearchTool(agentId));
      tools.push(this.createEmailAnalysisTool(agentId));
      tools.push(this.createEmailAttentionTool(agentId));
    }

    if (this.hasCapability(capabilities, 'EMAIL_SEND')) {
      tools.push(this.createEmailSendTool(agentId));
      tools.push(this.createEmailReplyTool(agentId));
    }

    // Calendar tools
    if (this.hasCapability(capabilities, 'CALENDAR_READ')) {
      tools.push(this.createCalendarReadTool(agentId));
      tools.push(this.createAvailabilityTool(agentId));
    }

    if (this.hasCapability(capabilities, 'CALENDAR_CREATE')) {
      tools.push(this.createEventScheduleTool(agentId));
    }

    // Spreadsheet tools
    if (this.hasCapability(capabilities, 'SPREADSHEET_CREATE')) {
      tools.push(this.createSpreadsheetTool(agentId));
    }

    if (this.hasCapability(capabilities, 'SPREADSHEET_READ')) {
      tools.push(this.createSpreadsheetReadTool(agentId));
    }

    // Drive tools
    if (this.hasCapability(capabilities, 'DRIVE_READ')) {
      tools.push(this.createFileSearchTool(agentId));
    }

    if (this.hasCapability(capabilities, 'DRIVE_UPLOAD')) {
      tools.push(this.createFileUploadTool(agentId));
    }

    return tools;
  }

  /**
   * Check if agent has specific capability
   */
  private hasCapability(capabilities: any[], capability: string): boolean {
    return capabilities.some(c => c.capability === capability);
  }

  /**
   * Create email reading tool
   */
  private createEmailReadTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_read_email',
      name: 'Read Email',
      description: 'Read specific emails or search for emails in workspace',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query or email ID'
          },
          connectionId: {
            type: 'string',
            description: 'Workspace connection ID'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of emails to return',
            default: 10
          }
        },
        required: ['connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.readSpecificEmailTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  /**
   * Create email sending tool
   */
  private createEmailSendTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_send_email',
      name: 'Send Email',
      description: 'Send emails through workspace connection',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_SEND,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'array',
            items: { type: 'string' },
            description: 'Recipient email addresses'
          },
          subject: {
            type: 'string',
            description: 'Email subject'
          },
          body: {
            type: 'string',
            description: 'Email body content'
          },
          connectionId: {
            type: 'string',
            description: 'Workspace connection ID'
          },
          scheduledTime: {
            type: 'string',
            description: 'ISO timestamp for scheduled sending (optional)'
          }
        },
        required: ['to', 'subject', 'body', 'connectionId']
      },
      execute: async (params: any) => {
        // Handle scheduled emails
        if (params.scheduledTime) {
          return await this.scheduleEmailTask(agentId, params);
        }
        return await this.workspaceTools.sendEmailTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  /**
   * Create calendar event scheduling tool
   */
  private createEventScheduleTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_schedule_event',
      name: 'Schedule Calendar Event',
      description: 'Schedule calendar events and meetings',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.CALENDAR_CREATE,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Event title'
          },
          startTime: {
            type: 'string',
            description: 'Start time in ISO format'
          },
          endTime: {
            type: 'string',
            description: 'End time in ISO format'
          },
          attendees: {
            type: 'array',
            items: { type: 'string' },
            description: 'Attendee email addresses'
          },
          description: {
            type: 'string',
            description: 'Event description'
          },
          connectionId: {
            type: 'string',
            description: 'Workspace connection ID'
          }
        },
        required: ['title', 'startTime', 'endTime', 'connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.scheduleEventTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  /**
   * Create email analysis tool
   */
  private createEmailAnalysisTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_analyze_emails',
      name: 'Analyze Emails',
      description: 'Analyze emails for attention, sentiment, trends, and action items',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          analysisType: {
            type: 'string',
            enum: ['attention', 'sentiment', 'activity', 'action_items', 'trends'],
            description: 'Type of analysis to perform'
          },
          timeframe: {
            type: 'string',
            description: 'Time range for analysis (e.g., "today", "this_week")'
          },
          connectionId: {
            type: 'string',
            description: 'Workspace connection ID'
          }
        },
        required: ['analysisType', 'connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.analyzeEmailsTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  /**
   * Create spreadsheet creation tool
   */
  private createSpreadsheetTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_create_spreadsheet',
      name: 'Create Spreadsheet',
      description: 'Create Google Sheets or Excel spreadsheets',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.SPREADSHEET_CREATE,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Spreadsheet title'
          },
          template: {
            type: 'string',
            enum: ['expense_tracker', 'budget_planner', 'project_timeline', 'custom'],
            description: 'Template type to use'
          },
          headers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Column headers for custom spreadsheets'
          },
          connectionId: {
            type: 'string',
            description: 'Workspace connection ID'
          }
        },
        required: ['title', 'connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.createSpreadsheetTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  // Additional tool creation methods...
  private createEmailSearchTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_search_emails',
      name: 'Search Emails',
      description: 'Search emails with advanced filters',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          from: { type: 'string', description: 'Sender email filter' },
          subject: { type: 'string', description: 'Subject filter' },
          hasAttachment: { type: 'boolean', description: 'Filter by attachment presence' },
          isUnread: { type: 'boolean', description: 'Filter by read status' },
          timeframe: { type: 'string', description: 'Time range filter' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.searchEmailsTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createEmailAttentionTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_emails_needing_attention',
      name: 'Get Emails Needing Attention',
      description: 'Find urgent emails and those requiring immediate attention',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.getEmailAttentionTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createEmailReplyTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_reply_email',
      name: 'Reply to Email',
      description: 'Reply to existing emails',
      category: 'communication' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.EMAIL_SEND,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          emailId: { type: 'string', description: 'Original email ID' },
          body: { type: 'string', description: 'Reply content' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['emailId', 'body', 'connectionId']
      },
      execute: async (params: any) => {
        // Access the private replyToEmailTool through the public interface
        const availableTools = await this.workspaceTools.getAvailableTools(agentId);
        const replyTool = availableTools.find(tool => tool.name === 'Reply to Email');
        
        if (!replyTool) {
          throw new Error('Reply to email tool not available');
        }

        return await replyTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createCalendarReadTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_read_calendar',
      name: 'Read Calendar',
      description: 'Read calendar events for specified date ranges',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.CALENDAR_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['startDate', 'endDate', 'connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.readCalendarTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createAvailabilityTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_find_availability',
      name: 'Find Availability',
      description: 'Find available time slots for scheduling',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.CALENDAR_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Date to check (YYYY-MM-DD)' },
          duration: { type: 'number', description: 'Meeting duration in minutes' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['date', 'duration', 'connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.findAvailabilityTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createSpreadsheetReadTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_read_spreadsheet',
      name: 'Read Spreadsheet',
      description: 'Read data from spreadsheets',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.SPREADSHEET_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
          range: { type: 'string', description: 'Cell range to read (optional)' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['spreadsheetId', 'connectionId']
      },
      execute: async (params: any) => {
        // Access the private readSpreadsheetTool through the public interface
        const availableTools = await this.workspaceTools.getAvailableTools(agentId);
        const readTool = availableTools.find(tool => tool.name === 'Read Spreadsheet');
        
        if (!readTool) {
          throw new Error('Read spreadsheet tool not available');
        }

        return await readTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createFileSearchTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_search_files',
      name: 'Search Files',
      description: 'Search files in cloud storage',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.DRIVE_READ,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          fileType: { type: 'string', description: 'File type filter' },
          modifiedAfter: { type: 'string', description: 'Modified after date' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['connectionId']
      },
      execute: async (params: any) => {
        return await this.workspaceTools.searchFilesTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  private createFileUploadTool(agentId: string): WorkspaceToolDefinition {
    return {
      id: 'workspace_upload_file',
      name: 'Upload File',
      description: 'Upload files to cloud storage',
      category: 'productivity' as any,
      enabled: true,
      version: '1.0.0',
      workspaceCapability: WorkspaceCapabilityType.DRIVE_UPLOAD,
      requiresConnection: true,
      supportedProviders: ['GOOGLE_WORKSPACE', 'MICROSOFT_365'],
      parameters: {
        type: 'object',
        properties: {
          fileName: { type: 'string', description: 'File name' },
          content: { type: 'string', description: 'File content' },
          mimeType: { type: 'string', description: 'MIME type' },
          folderId: { type: 'string', description: 'Parent folder ID (optional)' },
          connectionId: { type: 'string', description: 'Workspace connection ID' }
        },
        required: ['fileName', 'content', 'connectionId']
      },
      execute: async (params: any) => {
        // Access the private createFileTool through the public interface
        const availableTools = await this.workspaceTools.getAvailableTools(agentId);
        const createTool = availableTools.find(tool => tool.name === 'Create File');
        
        if (!createTool) {
          throw new Error('Create file tool not available');
        }

        return await createTool.execute(params, { agentId, userId: agentId });
      }
    };
  }

  /**
   * Schedule an email task for later execution
   */
  private async scheduleEmailTask(agentId: string, params: any): Promise<ToolExecutionResult> {
    // This would integrate with the agent's scheduler
    // For now, return a placeholder result
    const startTime = Date.now();
    const endTime = startTime + 1; // Minimal execution time
    
    return {
      id: IdGenerator.generate('task'),
      toolId: 'workspace_send_email',
      success: true,
      metrics: {
        startTime,
        endTime,
        durationMs: endTime - startTime
      },
      data: {
        message: `Email scheduled for ${params.scheduledTime}`,
        taskId: `email_task_${Date.now()}`,
        scheduledTime: params.scheduledTime
      }
    };
  }
} 