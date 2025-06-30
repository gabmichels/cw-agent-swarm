import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceCapabilityType, WorkspaceProvider } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { CapabilityFactory } from '../capabilities/CapabilityFactory';
import { ICalendarCapabilities } from '../capabilities/interfaces/ICalendarCapabilities';
import { IDriveCapabilities } from '../capabilities/interfaces/IDriveCapabilities';
import { IEmailCapabilities } from '../capabilities/interfaces/IEmailCapabilities';
import { ISheetsCapabilities } from '../capabilities/interfaces/ISheetsCapabilities';
import { WorkspaceNLPProcessor } from '../integration/WorkspaceNLPProcessor';
import { SenderPreference, WorkspaceConnectionSelector } from '../providers/WorkspaceConnectionSelector';
import { WorkspaceConnectionsInfoTool } from './WorkspaceConnectionsInfoTool';

// Agent tool interface for LLM function calling
export interface AgentTool<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  execute: (params: TParams, context: AgentContext) => Promise<TResult>;
}

export interface AgentContext {
  agentId: string;
  userId: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

// Email tool parameters
export interface ReadEmailParams {
  emailId?: string;
  searchQuery?: string;
  connectionId: string;
}

export interface FindImportantEmailsParams {
  unread?: boolean;
  hasAttachments?: boolean;
  keywords?: string[];
  timeframe?: 'last_hour' | 'last_24_hours' | 'last_week' | 'last_month';
  connectionId: string;
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  connectionId: string;
}

// Smart email sending interface that includes sender preferences
export interface SmartSendEmailParams {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  originalMessage?: string; // The original user message for NLP processing
  senderPreference?: SenderPreference; // Explicit sender preference
}

export interface ReplyEmailParams {
  emailId: string;
  body: string;
  connectionId: string;
}

// Calendar tool parameters
export interface ReadCalendarParams {
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  connectionId: string;
}

export interface FindAvailabilityParams {
  date: string; // YYYY-MM-DD
  duration: number; // minutes
  workingHours?: {
    start: string; // HH:MM
    end: string; // HH:MM
  };
  connectionId: string;
}

export interface ScheduleEventParams {
  title: string;
  startTime: string; // ISO datetime string
  endTime: string; // ISO datetime string
  attendees?: string[];
  description?: string;
  location?: string;
  connectionId: string;
}

export interface SummarizeDayParams {
  date: string; // YYYY-MM-DD
  connectionId: string;
}

// Sheets tool parameters
export interface CreateSpreadsheetParams {
  title: string;
  sheets?: { title: string; headers?: string[] }[];
  connectionId: string;
}

export interface ReadSpreadsheetParams {
  spreadsheetId: string;
  range?: string;
  connectionId: string;
}

export interface UpdateSpreadsheetParams {
  spreadsheetId: string;
  range: string;
  values: any[][];
  connectionId: string;
}

export interface AnalyzeDataParams {
  spreadsheetId: string;
  sheetName?: string;
  analysisType: 'summary' | 'trends' | 'correlations' | 'pivot';
  connectionId: string;
}

// Drive tool parameters
export interface SearchFilesParams {
  name?: string;
  mimeType?: string;
  maxResults?: number;
  connectionId: string;
}

export interface CreateFileParams {
  name: string;
  content?: string;
  parentFolder?: string;
  connectionId: string;
}

export interface ShareFileParams {
  fileId: string;
  emails: string[];
  role: 'reader' | 'writer' | 'commenter';
  connectionId: string;
}

// Email analysis tool parameters
export interface AnalyzeEmailsParams {
  timeframe?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month';
  analysisType: 'attention' | 'sentiment' | 'activity' | 'action_items' | 'trends';
  includeRead?: boolean;
  maxEmails?: number;
  connectionId: string;
}

export interface GetEmailAttentionParams {
  connectionId: string;
}

export interface GetActionItemsParams {
  timeframe?: 'today' | 'this_week';
  connectionId: string;
}

export interface GetEmailTrendsParams {
  timeframe?: 'this_week' | 'this_month';
  connectionId: string;
}

/**
 * Workspace Agent Tools for LLM Integration
 * These tools enable natural language interaction with workspace capabilities
 */
export class WorkspaceAgentTools {
  private permissionService: AgentWorkspacePermissionService;
  private db: IDatabaseProvider;
  private connectionsInfoTool: WorkspaceConnectionsInfoTool;
  private connectionSelector: WorkspaceConnectionSelector;
  private nlpProcessor: WorkspaceNLPProcessor;

  constructor() {
    this.permissionService = new AgentWorkspacePermissionService();
    this.db = DatabaseService.getInstance();
    this.connectionsInfoTool = new WorkspaceConnectionsInfoTool();
    this.connectionSelector = new WorkspaceConnectionSelector();
    this.nlpProcessor = new WorkspaceNLPProcessor();
  }

  /**
   * Get provider-specific email capabilities
   */
  private async getEmailCapabilities(connectionId: string): Promise<IEmailCapabilities> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    // For Zoho, we need to get the provider instance
    if (connection.provider === WorkspaceProvider.ZOHO) {
      const { WorkspaceService } = await import('../WorkspaceService');
      const workspaceService = new WorkspaceService();
      const providerInstance = await workspaceService.getProviderInstance(connection.provider);
      return CapabilityFactory.createEmailCapabilities(connection.provider, connection.id, providerInstance);
    }

    return CapabilityFactory.createEmailCapabilities(connection.provider, connection.id);
  }

  /**
   * Get provider-specific calendar capabilities
   */
  private async getCalendarCapabilities(connectionId: string): Promise<ICalendarCapabilities> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    // For Zoho, we need to get the provider instance
    if (connection.provider === WorkspaceProvider.ZOHO) {
      const { WorkspaceService } = await import('../WorkspaceService');
      const workspaceService = new WorkspaceService();
      const providerInstance = await workspaceService.getProviderInstance(connection.provider);
      return CapabilityFactory.createCalendarCapabilities(connection.provider, connection.id, providerInstance);
    }

    return CapabilityFactory.createCalendarCapabilities(connection.provider, connection.id);
  }

  /**
   * Get provider-specific sheets capabilities
   */
  private async getSheetsCapabilities(connectionId: string): Promise<ISheetsCapabilities> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    // For Zoho, we need to get the provider instance
    if (connection.provider === WorkspaceProvider.ZOHO) {
      const { WorkspaceService } = await import('../WorkspaceService');
      const workspaceService = new WorkspaceService();
      const providerInstance = await workspaceService.getProviderInstance(connection.provider);
      return CapabilityFactory.createSheetsCapabilities(connection.provider, connection.id, providerInstance);
    }

    return CapabilityFactory.createSheetsCapabilities(connection.provider, connection.id);
  }

  /**
   * Get provider-specific drive capabilities
   */
  private async getDriveCapabilities(connectionId: string): Promise<IDriveCapabilities> {
    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    // For Zoho, we need to get the provider instance
    if (connection.provider === WorkspaceProvider.ZOHO) {
      const { WorkspaceService } = await import('../WorkspaceService');
      const workspaceService = new WorkspaceService();
      const providerInstance = await workspaceService.getProviderInstance(connection.provider);
      return CapabilityFactory.createDriveCapabilities(connection.provider, connection.id, providerInstance);
    }

    return CapabilityFactory.createDriveCapabilities(connection.provider, connection.id);
  }

  /**
   * Get all available workspace tools for an agent
   */
  async getAvailableTools(agentId: string): Promise<AgentTool[]> {
    const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);
    const tools: AgentTool[] = [];

    // Always add connection info tools - these are needed for the LLM to understand available options
    tools.push(this.connectionsInfoTool.getAvailableConnectionsTool);
    tools.push(this.connectionsInfoTool.getAllConnectionsTool);

    // Import approval service
    const { WorkspaceToolApprovalService } = await import('../../approval/WorkspaceToolApprovalService');
    const approvalService = new WorkspaceToolApprovalService();

    // Add email tools based on permissions
    const emailCapabilities = capabilities.filter(c => c.capability.includes('EMAIL'));
    if (emailCapabilities.some(c => c.capability === 'EMAIL_READ')) {
      tools.push(this.readSpecificEmailTool);
      tools.push(this.findImportantEmailsTool);
      tools.push(this.searchEmailsTool);
      tools.push(this.analyzeEmailsTool);
      tools.push(this.getEmailAttentionTool);
      tools.push(this.getActionItemsTool);
      tools.push(this.getEmailTrendsTool);
    }
    if (emailCapabilities.some(c => c.capability === 'EMAIL_SEND')) {
      // Update tool descriptions with approval information
      tools.push(await this.enhanceToolWithApprovalInfo(this.smartSendEmailTool, agentId, approvalService));
      tools.push(await this.enhanceToolWithApprovalInfo(this.sendEmailTool, agentId, approvalService));
      tools.push(await this.enhanceToolWithApprovalInfo(this.replyToEmailTool, agentId, approvalService));
      tools.push(await this.enhanceToolWithApprovalInfo(this.forwardEmailTool, agentId, approvalService));
    }

    // Add calendar tools based on permissions
    const calendarCapabilities = capabilities.filter(c => c.capability.includes('CALENDAR'));
    if (calendarCapabilities.some(c => c.capability === 'CALENDAR_READ')) {
      tools.push(this.readCalendarTool);
      tools.push(this.findAvailabilityTool);
      tools.push(this.summarizeDayTool);
      tools.push(this.findEventsTool);
    }
    if (calendarCapabilities.some(c => c.capability === 'CALENDAR_CREATE')) {
      tools.push(await this.enhanceToolWithApprovalInfo(this.scheduleEventTool, agentId, approvalService));
    }
    if (calendarCapabilities.some(c => c.capability === 'CALENDAR_EDIT')) {
      tools.push(await this.enhanceToolWithApprovalInfo(this.editEventTool, agentId, approvalService));
      tools.push(await this.enhanceToolWithApprovalInfo(this.deleteEventTool, agentId, approvalService));
    }

    // Add spreadsheet tools based on permissions
    const spreadsheetCapabilities = capabilities.filter(c => c.capability.includes('SPREADSHEET'));
    if (spreadsheetCapabilities.some(c => c.capability === 'SPREADSHEET_READ')) {
      tools.push(this.readSpreadsheetTool);
      tools.push(this.analyzeDataTool);
    }
    if (spreadsheetCapabilities.some(c => c.capability === 'SPREADSHEET_CREATE')) {
      tools.push(this.createSpreadsheetTool);
      tools.push(this.createExpenseTrackerTool);
    }
    if (spreadsheetCapabilities.some(c => c.capability === 'SPREADSHEET_EDIT')) {
      tools.push(this.updateSpreadsheetTool);
    }

    // Add drive tools based on permissions
    const driveCapabilities = capabilities.filter(c => c.capability.includes('DRIVE'));
    if (driveCapabilities.some(c => c.capability === 'DRIVE_READ')) {
      tools.push(this.searchFilesTool);
      tools.push(this.getFileTool);
    }
    if (driveCapabilities.some(c => c.capability === 'DRIVE_UPLOAD')) {
      tools.push(this.createFileTool);
    }
    if (driveCapabilities.some(c => c.capability === 'DRIVE_MANAGE')) {
      tools.push(this.shareFileTool);
    }

    return tools;
  }

  /**
   * Enhance a tool with approval information for the LLM
   */
  private async enhanceToolWithApprovalInfo(
    tool: AgentTool,
    agentId: string,
    approvalService: any
  ): Promise<AgentTool> {
    try {
      const needsApproval = await approvalService.requiresApproval(agentId, tool.name);

      if (needsApproval) {
        return {
          ...tool,
          description: `${tool.description}\n\n⚠️ IMPORTANT: This action requires user approval. After executing this tool, you MUST wait for explicit user confirmation before proceeding. Inform the user that approval is required and wait for their response.`
        };
      }

      return tool;
    } catch (error) {
      console.error(`Error checking approval for tool ${tool.name}:`, error);
      // Return original tool if approval check fails
      return tool;
    }
  }

  // Email Tools
  public readSpecificEmailTool: AgentTool<ReadEmailParams, any> = {
    name: "read_specific_email",
    description: "Read a specific email by ID or search for an email and read it",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "Specific email ID to read"
        },
        searchQuery: {
          type: "string",
          description: "Search query to find emails if no emailId provided"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: ReadEmailParams, context: AgentContext) => {
      // Validate permissions
      const validation = await this.permissionService.validatePermissions(
        context.agentId,
        'EMAIL_READ' as any,
        params.connectionId
      );

      if (!validation.isValid) {
        const error = validation.workspaceError;
        if (error) {
          const { formatWorkspaceErrorForAgent } = await import('../errors/WorkspacePermissionErrors');
          throw new Error(formatWorkspaceErrorForAgent(error));
        }
        throw new Error(validation.error || 'Permission denied');
      }

      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);

      if (params.emailId) {
        return await emailCapabilities.readSpecificEmail(params.emailId, params.connectionId, context.agentId);
      } else if (params.searchQuery) {
        const emails = await emailCapabilities.searchEmails({
          query: params.searchQuery,
          maxResults: 1
        }, params.connectionId, context.agentId);
        return emails.length > 0 ? emails[0] : null;
      } else {
        throw new Error('Either emailId or searchQuery must be provided');
      }
    }
  };

  public findImportantEmailsTool: AgentTool<FindImportantEmailsParams, any> = {
    name: "find_important_emails",
    description: "Find important emails that require attention, such as unread emails, emails with attachments, or emails from important contacts",
    parameters: {
      type: "object",
      properties: {
        unread: {
          type: "boolean",
          description: "Filter for unread emails only"
        },
        hasAttachments: {
          type: "boolean",
          description: "Filter for emails with attachments"
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to search for in important emails"
        },
        timeframe: {
          type: "string",
          enum: ["last_hour", "last_24_hours", "last_week", "last_month"],
          description: "Time range to search within"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: FindImportantEmailsParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.findImportantEmails({
        unread: params.unread,
        hasAttachments: params.hasAttachments,
        keywords: params.keywords,
        timeframe: params.timeframe
      }, params.connectionId, context.agentId);
    }
  };

  public searchEmailsTool: AgentTool<any, any> = {
    name: "search_emails",
    description: "Search for emails using various criteria like sender, subject, content, or date range",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "General search query"
        },
        from: {
          type: "string",
          description: "Filter by sender email address"
        },
        subject: {
          type: "string",
          description: "Filter by subject line"
        },
        hasAttachment: {
          type: "boolean",
          description: "Filter for emails with attachments"
        },
        isUnread: {
          type: "boolean",
          description: "Filter for unread emails"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return (default: 10)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.searchEmails({
        query: params.query,
        from: params.from,
        subject: params.subject,
        hasAttachment: params.hasAttachment,
        isUnread: params.isUnread,
        maxResults: params.maxResults || 10
      }, params.connectionId, context.agentId);
    }
  };

  public sendEmailTool: AgentTool<SendEmailParams, any> = {
    name: "send_email",
    description: "Send a new email to specified recipients. IMPORTANT: You must first use 'get_available_workspace_connections' with capability 'EMAIL_SEND' to check what email accounts are available, and either use the autoSelect connectionId or ask the user to choose if multiple options exist.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of recipients"
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses to CC (optional)"
        },
        subject: {
          type: "string",
          description: "Email subject line"
        },
        body: {
          type: "string",
          description: "Email body content"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use - get this from get_available_workspace_connections first"
        }
      },
      required: ["to", "subject", "body", "connectionId"]
    },
    execute: async (params: SendEmailParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.sendEmail({
        to: params.to,
        cc: params.cc,
        subject: params.subject,
        body: params.body
      }, params.connectionId, context.agentId);
    }
  };

  public smartSendEmailTool: AgentTool<SmartSendEmailParams, any> = {
    name: "smart_send_email",
    description: "Intelligently send an email with automatic sender account selection based on user preferences. This tool analyzes the user's message for sender preferences like 'from my Gmail', 'using work email', 'from personal account', etc. and automatically selects the appropriate email account. If no preference is detected or multiple accounts match, it will ask for clarification.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of recipients"
        },
        cc: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses to CC (optional)"
        },
        subject: {
          type: "string",
          description: "Email subject line"
        },
        body: {
          type: "string",
          description: "Email body content"
        },
        originalMessage: {
          type: "string",
          description: "The original user message to analyze for sender preferences (e.g., 'send this from my Gmail account')"
        }
      },
      required: ["to", "subject", "body", "originalMessage"]
    },
    execute: async (params: SmartSendEmailParams, context: AgentContext) => {
      try {
        // Extract sender preference from the original message using NLP
        let senderPreference: SenderPreference | undefined = params.senderPreference;

        if (!senderPreference && params.originalMessage) {
          // Parse the original message for workspace command including sender preference
          const workspaceCommand = await this.nlpProcessor.parseCommand(params.originalMessage);
          if (workspaceCommand?.entities?.senderPreference) {
            senderPreference = workspaceCommand.entities.senderPreference;
          }
        }

        // Use connection selector to find the best account
        const selectionResult = await this.connectionSelector.selectConnection({
          agentId: context.agentId,
          capability: WorkspaceCapabilityType.EMAIL_SEND,
          recipientEmails: params.to,
          senderPreference
        });

        // Handle different selection results
        if (!selectionResult.success) {
          if (selectionResult.requiresUserChoice && selectionResult.suggestedMessage) {
            // Return the clarification message to the user
            return {
              success: false,
              requiresUserChoice: true,
              message: selectionResult.suggestedMessage,
              availableConnections: selectionResult.availableConnections,
              error: selectionResult.error
            };
          } else {
            throw new Error(selectionResult.error || 'Failed to select email account');
          }
        }

        if (selectionResult.requiresUserChoice && selectionResult.suggestedMessage) {
          // Medium confidence - ask for confirmation
          return {
            success: false,
            requiresUserChoice: true,
            message: selectionResult.suggestedMessage,
            suggestedConnection: selectionResult.connection,
            availableConnections: selectionResult.availableConnections
          };
        }

        // High confidence selection - proceed with sending
        const emailCapabilities = await this.getEmailCapabilities(selectionResult.connectionId!);
        const result = await emailCapabilities.sendEmail({
          to: params.to,
          cc: params.cc,
          subject: params.subject,
          body: params.body
        }, selectionResult.connectionId!, context.agentId);

        return {
          success: true,
          result,
          selectedAccount: selectionResult.connection,
          reason: selectionResult.reason,
          message: `Email sent successfully from ${selectionResult.connection!.email}. ${selectionResult.reason}`
        };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error during smart email sending';
        return {
          success: false,
          error: errorMessage,
          message: `Failed to send email: ${errorMessage}`
        };
      }
    }
  };

  public replyToEmailTool: AgentTool<ReplyEmailParams, any> = {
    name: "reply_to_email",
    description: "Reply to an existing email",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "ID of the email to reply to"
        },
        body: {
          type: "string",
          description: "Reply message content"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["emailId", "body", "connectionId"]
    },
    execute: async (params: ReplyEmailParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.replyToEmail({
        originalEmailId: params.emailId,
        body: params.body
      }, params.connectionId, context.agentId);
    }
  };

  public forwardEmailTool: AgentTool<any, any> = {
    name: "forward_email",
    description: "Forward an existing email to other recipients",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "ID of the email to forward"
        },
        to: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses to forward to"
        },
        body: {
          type: "string",
          description: "Additional message to include with the forward (optional)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["emailId", "to", "connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.forwardEmail({
        originalEmailId: params.emailId,
        to: params.to,
        body: params.body
      }, params.connectionId, context.agentId);
    }
  };

  // Calendar Tools
  public readCalendarTool: AgentTool<ReadCalendarParams, any> = {
    name: "read_calendar",
    description: "Read calendar events for a specific date range",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID"
        }
      },
      required: ["startDate", "endDate", "connectionId"]
    },
    execute: async (params: ReadCalendarParams, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.readCalendar({
        start: new Date(params.startDate),
        end: new Date(params.endDate)
      }, params.connectionId, context.agentId);
    }
  };

  public findAvailabilityTool: AgentTool<FindAvailabilityParams, any> = {
    name: "find_availability",
    description: "Find available time slots for scheduling meetings",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date to check availability (YYYY-MM-DD)"
        },
        duration: {
          type: "number",
          description: "Duration of the meeting in minutes"
        },
        workingHours: {
          type: "object",
          properties: {
            start: { type: "string", description: "Start time (HH:MM)" },
            end: { type: "string", description: "End time (HH:MM)" }
          },
          description: "Working hours constraint (optional)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID"
        }
      },
      required: ["date", "duration", "connectionId"]
    },
    execute: async (params: FindAvailabilityParams, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.findAvailability(params, params.connectionId, context.agentId);
    }
  };

  public scheduleEventTool: AgentTool<ScheduleEventParams, any> = {
    name: "schedule_event",
    description: "Schedule a new calendar event with specified attendees",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Event title/subject"
        },
        startTime: {
          type: "string",
          description: "Event start time in ISO format"
        },
        endTime: {
          type: "string",
          description: "Event end time in ISO format"
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses of attendees (optional)"
        },
        description: {
          type: "string",
          description: "Event description (optional)"
        },
        location: {
          type: "string",
          description: "Event location (optional)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["title", "startTime", "endTime", "connectionId"]
    },
    execute: async (params: ScheduleEventParams, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.scheduleEvent({
        title: params.title,
        startTime: new Date(params.startTime),
        endTime: new Date(params.endTime),
        attendees: params.attendees,
        description: params.description,
        location: params.location
      }, params.connectionId, context.agentId);
    }
  };

  private summarizeDayTool: AgentTool<SummarizeDayParams, any> = {
    name: "summarize_day",
    description: "Generate a summary of calendar events for a specific day",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date to summarize (YYYY-MM-DD)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["date", "connectionId"]
    },
    execute: async (params: SummarizeDayParams, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.summarizeDay(params.date, params.connectionId, context.agentId);
    }
  };

  private findEventsTool: AgentTool<any, any> = {
    name: "find_events",
    description: "Search for calendar events using various criteria",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for event title or description"
        },
        attendee: {
          type: "string",
          description: "Filter by attendee email address"
        },
        location: {
          type: "string",
          description: "Filter by event location"
        },
        timeMin: {
          type: "string",
          description: "Start of time range (ISO format)"
        },
        timeMax: {
          type: "string",
          description: "End of time range (ISO format)"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results (default: 10)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.findEvents({
        query: params.query,
        attendee: params.attendee,
        location: params.location,
        timeMin: params.timeMin ? new Date(params.timeMin) : undefined,
        timeMax: params.timeMax ? new Date(params.timeMax) : undefined,
        maxResults: params.maxResults || 10
      }, params.connectionId, context.agentId);
    }
  };

  private editEventTool: AgentTool<any, any> = {
    name: "edit_event",
    description: "Edit an existing calendar event",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "ID of the event to edit"
        },
        title: {
          type: "string",
          description: "New event title (optional)"
        },
        startTime: {
          type: "string",
          description: "New start time in ISO format (optional)"
        },
        endTime: {
          type: "string",
          description: "New end time in ISO format (optional)"
        },
        description: {
          type: "string",
          description: "New event description (optional)"
        },
        location: {
          type: "string",
          description: "New event location (optional)"
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "New attendee list (optional)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["eventId", "connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const changes: any = {};
      if (params.title) changes.title = params.title;
      if (params.startTime) changes.startTime = new Date(params.startTime);
      if (params.endTime) changes.endTime = new Date(params.endTime);
      if (params.description !== undefined) changes.description = params.description;
      if (params.location !== undefined) changes.location = params.location;
      if (params.attendees) changes.attendees = params.attendees;

      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      return await calendarCapabilities.editCalendarEntry(params.eventId, changes, params.connectionId, context.agentId);
    }
  };

  private deleteEventTool: AgentTool<any, any> = {
    name: "delete_event",
    description: "Delete a calendar event",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          description: "ID of the event to delete"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["eventId", "connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const calendarCapabilities = await this.getCalendarCapabilities(params.connectionId);
      await calendarCapabilities.deleteCalendarEntry(params.eventId, params.connectionId, context.agentId);
      return { success: true, message: 'Event deleted successfully' };
    }
  };

  // Spreadsheet Tools
  public createSpreadsheetTool: AgentTool<CreateSpreadsheetParams, any> = {
    name: "create_spreadsheet",
    description: "Create a new spreadsheet with optional sheets and headers",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the spreadsheet"
        },
        sheets: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              headers: { type: "array", items: { type: "string" } }
            }
          },
          description: "Array of sheets to create with optional headers"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID"
        }
      },
      required: ["title", "connectionId"]
    },
    execute: async (params: CreateSpreadsheetParams, context: AgentContext) => {
      const sheetsCapabilities = await this.getSheetsCapabilities(params.connectionId);
      return await sheetsCapabilities.createSpreadsheet(params, params.connectionId, context.agentId);
    }
  };

  public readSpreadsheetTool: AgentTool<ReadSpreadsheetParams, any> = {
    name: "read_spreadsheet",
    description: "Read data from a Google Spreadsheet range",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: {
          type: "string",
          description: "Spreadsheet ID"
        },
        range: {
          type: "string",
          description: "Range to read (e.g., 'A1:C10' or 'Sheet1!A:Z')"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["spreadsheetId", "connectionId"]
    },
    execute: async (params: ReadSpreadsheetParams, context: AgentContext) => {
      const range = params.range || 'A:Z';
      const sheetsCapabilities = await this.getSheetsCapabilities(params.connectionId);
      return await sheetsCapabilities.readRange(params.spreadsheetId, range, params.connectionId, context.agentId);
    }
  };

  public updateSpreadsheetTool: AgentTool<UpdateSpreadsheetParams, any> = {
    name: "update_spreadsheet",
    description: "Update cells in a Google Spreadsheet",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: {
          type: "string",
          description: "Spreadsheet ID"
        },
        range: {
          type: "string",
          description: "Range to update (e.g., 'A1:C3')"
        },
        values: {
          type: "array",
          items: { type: "array" },
          description: "2D array of values to update"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["spreadsheetId", "range", "values", "connectionId"]
    },
    execute: async (params: UpdateSpreadsheetParams, context: AgentContext) => {
      const sheetsCapabilities = await this.getSheetsCapabilities(params.connectionId);
      return await sheetsCapabilities.updateCells({
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        values: params.values
      }, params.connectionId, context.agentId);
    }
  };

  private analyzeDataTool: AgentTool<AnalyzeDataParams, any> = {
    name: "analyze_spreadsheet_data",
    description: "Analyze data in a Google Spreadsheet to generate insights and summaries",
    parameters: {
      type: "object",
      properties: {
        spreadsheetId: {
          type: "string",
          description: "Spreadsheet ID"
        },
        sheetName: {
          type: "string",
          description: "Sheet name (optional)"
        },
        analysisType: {
          type: "string",
          enum: ["summary", "trends", "correlations", "pivot"],
          description: "Type of analysis to perform"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["spreadsheetId", "analysisType", "connectionId"]
    },
    execute: async (params: AnalyzeDataParams, context: AgentContext) => {
      const sheetsCapabilities = await this.getSheetsCapabilities(params.connectionId);
      return await sheetsCapabilities.analyzeData({
        spreadsheetId: params.spreadsheetId,
        sheetName: params.sheetName,
        analysisType: params.analysisType
      }, params.connectionId, context.agentId);
    }
  };

  private createExpenseTrackerTool: AgentTool<any, any> = {
    name: "create_expense_tracker",
    description: "Create a pre-configured expense tracking spreadsheet",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Expense tracker title"
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Expense categories (e.g., Food, Transport, Entertainment)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["title", "categories", "connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const sheetsCapabilities = await this.getSheetsCapabilities(params.connectionId);
      return await sheetsCapabilities.createExpenseTracker(
        params.title,
        params.categories,
        params.connectionId,
        context.agentId
      );
    }
  };

  // Drive Tools
  public searchFilesTool: AgentTool<SearchFilesParams, any> = {
    name: "search_files",
    description: "Search for files in the workspace drive",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "File name to search for"
        },
        mimeType: {
          type: "string",
          description: "MIME type filter (e.g., 'application/pdf')"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: SearchFilesParams, context: AgentContext) => {
      const driveCapabilities = await this.getDriveCapabilities(params.connectionId);
      return await driveCapabilities.searchFiles(params, params.connectionId, context.agentId);
    }
  };

  private getFileTool: AgentTool<any, any> = {
    name: "get_file",
    description: "Get detailed information about a specific file in Google Drive",
    parameters: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["fileId", "connectionId"]
    },
    execute: async (params: any, context: AgentContext) => {
      const driveCapabilities = await this.getDriveCapabilities(params.connectionId);
      return await driveCapabilities.getFile(params.fileId, params.connectionId, context.agentId);
    }
  };

  private createFileTool: AgentTool<CreateFileParams, any> = {
    name: "create_file",
    description: "Create a new file in Google Drive",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "File name"
        },
        content: {
          type: "string",
          description: "File content (optional)"
        },
        parentFolder: {
          type: "string",
          description: "Parent folder ID (optional)"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["name", "connectionId"]
    },
    execute: async (params: CreateFileParams, context: AgentContext) => {
      const driveCapabilities = await this.getDriveCapabilities(params.connectionId);
      return await driveCapabilities.createFile({
        name: params.name,
        content: params.content,
        parents: params.parentFolder ? [params.parentFolder] : undefined
      }, params.connectionId, context.agentId);
    }
  };

  public shareFileTool: AgentTool<ShareFileParams, any> = {
    name: "share_file",
    description: "Share a Google Drive file with other users",
    parameters: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "File ID to share"
        },
        emails: {
          type: "array",
          items: { type: "string" },
          description: "Email addresses to share with"
        },
        role: {
          type: "string",
          enum: ["reader", "writer", "commenter"],
          description: "Permission level"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["fileId", "emails", "role", "connectionId"]
    },
    execute: async (params: ShareFileParams, context: AgentContext) => {
      const driveCapabilities = await this.getDriveCapabilities(params.connectionId);
      return await driveCapabilities.shareFile({
        fileId: params.fileId,
        permissions: params.emails.map(email => ({
          type: 'user' as const,
          role: params.role,
          emailAddress: email
        }))
      }, params.connectionId, context.agentId);
    }
  };

  public uploadFileTool: AgentTool<CreateFileParams, any> = {
    name: "upload_file",
    description: "Upload a file to Google Drive",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the file to upload' },
        content: { type: 'string', description: 'Content of the file' },
        parentFolder: { type: 'string', description: 'ID of parent folder (optional)' },
        connectionId: { type: 'string', description: 'Workspace connection ID' }
      },
      required: ['name', 'connectionId']
    },
    execute: async (params: CreateFileParams, context: AgentContext) => {
      const validation = await this.permissionService.validatePermissions(
        context.agentId,
        'DRIVE_UPLOAD' as any,
        params.connectionId
      );

      if (!validation.isValid) {
        throw new Error(validation.error || 'Permission denied for file upload');
      }

      const driveCapabilities = await this.getDriveCapabilities(params.connectionId);
      return await driveCapabilities.createFile({
        name: params.name,
        content: params.content || '',
        parents: params.parentFolder ? [params.parentFolder] : undefined
      }, params.connectionId, context.agentId);
    }
  };

  // Email Analysis Tools
  public analyzeEmailsTool: AgentTool<AnalyzeEmailsParams, any> = {
    name: "analyze_emails",
    description: "Analyze emails for insights, sentiment, activity patterns, action items, or trends",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["today", "yesterday", "this_week", "last_week", "this_month"],
          description: "Time period to analyze"
        },
        analysisType: {
          type: "string",
          enum: ["attention", "sentiment", "activity", "action_items", "trends"],
          description: "Type of analysis to perform"
        },
        includeRead: {
          type: "boolean",
          description: "Whether to include read emails in analysis"
        },
        maxEmails: {
          type: "number",
          description: "Maximum number of emails to analyze"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["analysisType", "connectionId"]
    },
    execute: async (params: AnalyzeEmailsParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.analyzeEmails({
        timeframe: params.timeframe,
        analysisType: params.analysisType,
        includeRead: params.includeRead,
        maxEmails: params.maxEmails
      }, params.connectionId, context.agentId);
    }
  };

  public getEmailAttentionTool: AgentTool<GetEmailAttentionParams, any> = {
    name: "get_emails_needing_attention",
    description: "Get emails that need immediate attention - urgent, unread, or overdue replies",
    parameters: {
      type: "object",
      properties: {
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: GetEmailAttentionParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      const analysis = await emailCapabilities.getEmailsNeedingAttention(params.connectionId, context.agentId, context.userId);

      // Format the response to include detailed email information in a table-like structure
      // This will be displayed directly to the user, so make it comprehensive and helpful
      return this.formatEmailAttentionResponse(analysis);
    }
  };

  /**
   * Format email attention analysis into a comprehensive, user-friendly response
   */
  private formatEmailAttentionResponse(analysis: any): any {
    if (analysis.unreadCount === 0) {
      return {
        success: true,
        summary: "Good news! You have no unread emails that need your attention right now.",
        details: "Your inbox is all caught up.",
        unreadCount: 0,
        urgentCount: 0
      };
    }

    // Create detailed email information for the most important emails (top 10)
    const topEmails = analysis.needsAttention.slice(0, 10);

    let formattedResponse = `📧 **Email Attention Summary**\n\n`;
    formattedResponse += `📊 **Overview:** ${analysis.urgentCount} urgent, ${analysis.unreadCount} unread total`;
    if (analysis.overdueReplies.length > 0) {
      formattedResponse += `, ${analysis.overdueReplies.length} overdue replies`;
    }
    formattedResponse += `\n\n`;

    if (topEmails.length > 0) {
      formattedResponse += `🔥 **Top ${Math.min(topEmails.length, 10)} Emails Needing Attention:**\n\n`;

      // Create a proper table format for email details
      formattedResponse += `| Priority | Sender | Subject | Date | Preview |\n`;
      formattedResponse += `|----------|--------|---------|------|--------|\n`;

      topEmails.forEach((email: any, index: number) => {
        const priority = this.determineEmailPriority(email, analysis);
        const sender = this.extractSenderName(email.from);
        const dateStr = this.formatEmailDate(email.date);
        const subjectPreview = email.subject.length > 50 ?
          email.subject.substring(0, 50) + '...' :
          email.subject;

        // Create body preview for all emails (not just urgent)
        let bodyPreview = '';
        if (email.body) {
          bodyPreview = email.body.replace(/\n+/g, ' ').replace(/\|/g, '\\|').substring(0, 80);
          if (email.body.length > 80) bodyPreview += '...';
        }

        // Escape any pipe characters in the data to avoid breaking the table
        const escapedSender = sender.replace(/\|/g, '\\|');
        const escapedSubject = subjectPreview.replace(/\|/g, '\\|');
        const escapedPreview = bodyPreview.replace(/\|/g, '\\|');

        formattedResponse += `| ${priority} | ${escapedSender} | ${escapedSubject} | ${dateStr} | ${escapedPreview} |\n`;
      });

      formattedResponse += `\n`;
    }

    // Add actionable recommendations
    if (analysis.urgentCount > 0) {
      formattedResponse += `🎯 **Recommended Actions:**\n`;
      formattedResponse += `• Start with the ${analysis.urgentCount} urgent email${analysis.urgentCount > 1 ? 's' : ''}\n`;
      if (analysis.overdueReplies.length > 0) {
        formattedResponse += `• Address ${analysis.overdueReplies.length} overdue repl${analysis.overdueReplies.length > 1 ? 'ies' : 'y'}\n`;
      }
      if (analysis.unreadCount > 10) {
        formattedResponse += `• Consider batch processing for the remaining ${analysis.unreadCount - analysis.urgentCount} emails\n`;
      }
    }

    return {
      success: true,
      formattedSummary: formattedResponse,
      summary: analysis.summary, // Keep original summary for compatibility
      unreadCount: analysis.unreadCount,
      urgentCount: analysis.urgentCount,
      overdueCount: analysis.overdueReplies.length,
      emailDetails: topEmails.map((email: any) => ({
        subject: email.subject,
        from: this.extractSenderName(email.from),
        date: this.formatEmailDate(email.date),
        priority: this.determineEmailPriority(email, analysis),
        bodyPreview: email.body ? email.body.substring(0, 150) + '...' : ''
      }))
    };
  }

  /**
 * Determine email priority based on analysis
 */
  private determineEmailPriority(email: any, analysis: any): string {
    const isUrgent = analysis.urgentCount > 0 &&
      analysis.needsAttention.findIndex((e: any) => e.id === email.id) < analysis.urgentCount;
    const isOverdue = analysis.overdueReplies.some((e: any) => e.id === email.id);

    if (isUrgent && isOverdue) return '🔥 URGENT+OVERDUE';
    if (isUrgent) return '🔥 URGENT';
    if (isOverdue) return '⏰ OVERDUE';
    if (email.isImportant) return '⭐ IMPORTANT';
    return '📧 UNREAD';
  }

  /**
   * Extract sender name from email address
   */
  private extractSenderName(fromField: string): string {
    // Handle "Name <email@domain.com>" format
    const nameMatch = fromField.match(/^(.+?)\s*<.*>$/);
    if (nameMatch) {
      return nameMatch[1].trim().replace(/"/g, '');
    }

    // Handle plain email address
    const emailMatch = fromField.match(/([^@]+)@/);
    if (emailMatch) {
      return emailMatch[1].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return fromField.substring(0, 30); // Fallback
  }

  /**
   * Format email date for display
   */
  private formatEmailDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  public getActionItemsTool: AgentTool<GetActionItemsParams, any> = {
    name: "get_email_action_items",
    description: "Extract action items from emails - replies needed, deadlines, meetings, approvals",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["today", "this_week"],
          description: "Time period to extract action items from"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: GetActionItemsParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.getActionItems(params.timeframe || 'today', params.connectionId, context.agentId);
    }
  };

  public getEmailTrendsTool: AgentTool<GetEmailTrendsParams, any> = {
    name: "get_email_trends",
    description: "Get email trends and statistics - top senders, volume patterns, response times, categories",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["this_week", "this_month"],
          description: "Time period to analyze trends for"
        },
        connectionId: {
          type: "string",
          description: "Workspace connection ID to use"
        }
      },
      required: ["connectionId"]
    },
    execute: async (params: GetEmailTrendsParams, context: AgentContext) => {
      const emailCapabilities = await this.getEmailCapabilities(params.connectionId);
      return await emailCapabilities.getEmailTrends(params.timeframe || 'this_week', params.connectionId, context.agentId);
    }
  };
} 