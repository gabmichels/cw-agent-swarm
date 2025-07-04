import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { DatabaseService } from '../../database/DatabaseService';
import { IDatabaseProvider } from '../../database/IDatabaseProvider';
import { WorkspaceCapabilityType, WorkspaceConnection } from '../../database/types';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { UserEmailPreferencesService } from '../preferences/UserEmailPreferencesService';
import { handlePermissionError, withWorkspaceErrorHandling } from '../utils/WorkspaceErrorHandler';

// Email data types
export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  date: Date;
  isRead: boolean;
  isImportant: boolean;
  labels: string[];
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface EmailSearchCriteria {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  labels?: readonly string[];
  after?: Date;
  before?: Date;
  maxResults?: number;
  pageToken?: string;
  searchAllFolders?: boolean; // If true, search across all folders instead of just inbox
}

export interface SendEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
}

export interface ReplyEmailParams {
  originalEmailId: string;
  body: string;
  htmlBody?: string;
  includeOriginal?: boolean;
}

export interface ForwardEmailParams {
  originalEmailId: string;
  to: string[];
  cc?: string[];
  body?: string;
  htmlBody?: string;
}

export interface EmailAnalysisParams {
  timeframe?: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month';
  analysisType: 'attention' | 'sentiment' | 'activity' | 'action_items' | 'trends';
  includeRead?: boolean;
  maxEmails?: number;
}

export interface EmailAnalysisResult {
  summary: string;
  insights: string[];
  data: any;
  recommendations?: string[];
  urgentEmails?: EmailMessage[];
  actionItems?: ActionItem[];
}

export interface ActionItem {
  emailId: string;
  subject: string;
  from: string;
  actionType: 'reply_needed' | 'follow_up' | 'deadline' | 'meeting_request' | 'approval_needed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  description: string;
}

export interface EmailTrends {
  topSenders: { email: string; count: number; name?: string }[];
  emailVolume: { date: string; received: number; sent: number }[];
  responseTime: { average: number; median: number };
  categories: { category: string; count: number; percentage: number }[];
}

export interface AttentionAnalysis {
  needsAttention: EmailMessage[];
  urgentCount: number;
  unreadCount: number;
  overdueReplies: EmailMessage[];
  upcomingDeadlines: ActionItem[];
  summary: string;
}

export interface UserEmailImportanceCriteria {
  urgentKeywords?: string[];
  importantSenders?: string[];
  importantDomains?: string[];
  subjectPatterns?: string[];
  priorityLabels?: string[];
  customRules?: {
    rule: string;
    weight: number;
    description: string;
  }[];
}

export class EmailCapabilities {
  private db: IDatabaseProvider;
  private permissionService: AgentWorkspacePermissionService;
  private userEmailPreferencesService: UserEmailPreferencesService;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.permissionService = new AgentWorkspacePermissionService();
    this.userEmailPreferencesService = new UserEmailPreferencesService();
  }

  /**
   * Read a specific email by ID
   */
  async readSpecificEmail(emailId: string, connectionId: string, agentId: string): Promise<EmailMessage> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_READ,
      connectionId
    );

    handlePermissionError(validation);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    return await withWorkspaceErrorHandling(
      async () => {
        const gmail = await this.getGmailClient(connection);

        const response = await gmail.users.messages.get({
          userId: 'me',
          id: emailId,
          format: 'full'
        });

        return this.convertToEmailMessage(response.data);
      },
      {
        capability: WorkspaceCapabilityType.EMAIL_READ,
        agentId,
        connectionId,
        connectionName: `${connection.displayName} (${connection.email})`,
        provider: connection.provider
      }
    );
  }

  /**
   * Search for emails based on criteria
   */
  async searchEmails(criteria: EmailSearchCriteria, connectionId: string, agentId: string): Promise<EmailMessage[]> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_READ,
      connectionId
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const gmail = await this.getGmailClient(connection);

    try {
      const query = this.buildSearchQuery(criteria);
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: criteria.maxResults || 10
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map(msg =>
        gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full'
        })
      );

      const emailResponses = await Promise.all(emailPromises);
      return emailResponses.map(response => this.convertToEmailMessage(response.data));
    } catch (error) {
      throw new Error(`Failed to search emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find important emails that require attention
   */
  async findImportantEmails(criteria: {
    unread?: boolean;
    hasAttachments?: boolean;
    keywords?: string[];
    timeframe?: 'last_hour' | 'last_24_hours' | 'last_week' | 'last_month';
  }, connectionId: string, agentId: string): Promise<EmailMessage[]> {

    const searchCriteria: EmailSearchCriteria = {
      isUnread: criteria.unread,
      hasAttachment: criteria.hasAttachments,
      maxResults: 20
    };

    // Add timeframe filter
    if (criteria.timeframe) {
      const now = new Date();
      switch (criteria.timeframe) {
        case 'last_hour':
          searchCriteria.after = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'last_24_hours':
          searchCriteria.after = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last_week':
          searchCriteria.after = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_month':
          searchCriteria.after = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Add keyword search
    if (criteria.keywords && criteria.keywords.length > 0) {
      searchCriteria.query = criteria.keywords.join(' OR ');
    }

    return await this.searchEmails(searchCriteria, connectionId, agentId);
  }

  /**
   * Send a new email
   */
  async sendEmail(params: SendEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_SEND,
      connectionId
    );

    handlePermissionError(validation);

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    return await withWorkspaceErrorHandling(
      async () => {
        const gmail = await this.getGmailClient(connection);

        const emailContent = this.buildEmailContent(params, connection.email);
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: Buffer.from(emailContent).toString('base64url')
          }
        });

        // Get the sent message details
        const sentMessage = await gmail.users.messages.get({
          userId: 'me',
          id: response.data.id!,
          format: 'full'
        });

        return this.convertToEmailMessage(sentMessage.data);
      },
      {
        capability: WorkspaceCapabilityType.EMAIL_SEND,
        agentId,
        connectionId,
        connectionName: `${connection.displayName} (${connection.email})`,
        provider: connection.provider
      }
    );
  }

  /**
   * Reply to an email
   */
  async replyToEmail(params: ReplyEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_SEND,
      connectionId
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const gmail = await this.getGmailClient(connection);

    try {
      // Get original email details
      const originalEmail = await gmail.users.messages.get({
        userId: 'me',
        id: params.originalEmailId,
        format: 'full'
      });

      const replyContent = this.buildReplyContent(originalEmail.data, params);
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(replyContent).toString('base64url'),
          threadId: originalEmail.data.threadId
        }
      });

      // Get the sent reply details
      const sentReply = await gmail.users.messages.get({
        userId: 'me',
        id: response.data.id!,
        format: 'full'
      });

      return this.convertToEmailMessage(sentReply.data);
    } catch (error) {
      throw new Error(`Failed to reply to email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forward an email
   */
  async forwardEmail(params: ForwardEmailParams, connectionId: string, agentId: string): Promise<EmailMessage> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_SEND,
      connectionId
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const connection = await this.db.getWorkspaceConnection(connectionId);
    if (!connection) {
      throw new Error('Workspace connection not found');
    }

    const gmail = await this.getGmailClient(connection);

    try {
      // Get original email details
      const originalEmail = await gmail.users.messages.get({
        userId: 'me',
        id: params.originalEmailId,
        format: 'full'
      });

      const forwardContent = this.buildForwardContent(originalEmail.data, params);
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: Buffer.from(forwardContent).toString('base64url')
        }
      });

      // Get the sent forward details
      const sentForward = await gmail.users.messages.get({
        userId: 'me',
        id: response.data.id!,
        format: 'full'
      });

      return this.convertToEmailMessage(sentForward.data);
    } catch (error) {
      throw new Error(`Failed to forward email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze emails for insights and action items
   */
  async analyzeEmails(params: EmailAnalysisParams, connectionId: string, agentId: string): Promise<EmailAnalysisResult> {
    // Validate permissions
    const validation = await this.permissionService.validatePermissions(
      agentId,
      WorkspaceCapabilityType.EMAIL_READ,
      connectionId
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'Permission denied');
    }

    const timeRange = this.getTimeRange(params.timeframe || 'today');
    const emails = await this.searchEmails({
      after: timeRange.start,
      before: timeRange.end,
      isUnread: !params.includeRead,
      maxResults: params.maxEmails || 50
    }, connectionId, agentId);

    switch (params.analysisType) {
      case 'attention':
        return await this.analyzeAttentionNeeded(emails);
      case 'sentiment':
        return await this.analyzeSentiment(emails);
      case 'activity':
        return await this.analyzeActivity(emails, timeRange);
      case 'action_items':
        return await this.extractActionItems(emails);
      case 'trends':
        return await this.analyzeTrends(emails, timeRange);
      default:
        throw new Error(`Unsupported analysis type: ${params.analysisType}`);
    }
  }

  /**
   * Get emails that need immediate attention
   */
  async getEmailsNeedingAttention(connectionId: string, agentId: string, userId?: string): Promise<AttentionAnalysis> {
    // Load user's email importance preferences if userId is provided
    let userCriteria: UserEmailImportanceCriteria | undefined = undefined;
    if (userId) {
      const criteria = await this.userEmailPreferencesService.getUserImportanceCriteria(userId);
      userCriteria = criteria || undefined; // Convert null to undefined
    }

    // Search ALL unread emails across ALL folders (inbox + other folders)
    // When users ask about "important unread emails", they mean ALL unread emails everywhere
    // It's the user's responsibility to clean up old emails if needed
    const emails = await this.searchEmails({
      isUnread: true,  // Only unread emails
      maxResults: 100,  // Increase limit to capture more emails
      searchAllFolders: true // Search across all Gmail folders/labels, not just inbox
    }, connectionId, agentId);

    // First pass: Analyze emails for attention patterns using user preferences
    const initialUrgentEmails = emails.filter(email => this.isUrgent(email, userCriteria));
    const overdueReplies = emails.filter(email => this.isOverdueReply(email));

    console.log(`📧 BEFORE newsletter filtering: ${initialUrgentEmails.length} urgent emails, ${overdueReplies.length} overdue`);

    // Second pass: Apply newsletter/promotional filtering to downgrade automated content
    const urgentEmails = this.applyNewsletterFiltering(initialUrgentEmails);
    const filteredOverdueReplies = this.applyNewsletterFiltering(overdueReplies);

    console.log(`📧 AFTER newsletter filtering: ${urgentEmails.length} urgent emails, ${filteredOverdueReplies.length} overdue`);

    // ALL unread emails need attention by definition, but newsletters get lower priority in display
    const needsAttention = emails;

    const analysis: AttentionAnalysis = {
      needsAttention,
      urgentCount: urgentEmails.length,
      unreadCount: emails.length,
      overdueReplies: filteredOverdueReplies,
      upcomingDeadlines: await this.extractDeadlines(emails),
      summary: this.generateAttentionSummary(urgentEmails.length, emails.length, filteredOverdueReplies.length)
    };

    return analysis;
  }

  /**
   * Extract action items from emails
   */
  async getActionItems(timeframe: 'today' | 'this_week' = 'today', connectionId: string, agentId: string): Promise<ActionItem[]> {
    const result = await this.analyzeEmails({
      timeframe,
      analysisType: 'action_items',
      includeRead: true
    }, connectionId, agentId);

    return result.actionItems || [];
  }

  /**
   * Get email trends and statistics
   */
  async getEmailTrends(timeframe: 'this_week' | 'this_month' = 'this_week', connectionId: string, agentId: string): Promise<EmailTrends> {
    const result = await this.analyzeEmails({
      timeframe,
      analysisType: 'trends',
      includeRead: true,
      maxEmails: 200
    }, connectionId, agentId);

    return result.data as EmailTrends;
  }

  // Private helper methods
  private async getGmailClient(connection: WorkspaceConnection) {
    const oauth2Client = new OAuth2Client();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  private convertToEmailMessage(gmailMessage: any): EmailMessage {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: gmailMessage.id,
      threadId: gmailMessage.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To').split(',').map((email: string) => email.trim()).filter(Boolean),
      cc: getHeader('Cc').split(',').map((email: string) => email.trim()).filter(Boolean),
      body: this.extractTextBody(gmailMessage.payload),
      htmlBody: this.extractHtmlBody(gmailMessage.payload),
      attachments: this.extractAttachments(gmailMessage.payload),
      date: new Date(parseInt(gmailMessage.internalDate)),
      isRead: !gmailMessage.labelIds?.includes('UNREAD'),
      isImportant: gmailMessage.labelIds?.includes('IMPORTANT') || false,
      labels: gmailMessage.labelIds || []
    };
  }

  private buildSearchQuery(criteria: EmailSearchCriteria): string {
    const queryParts: string[] = [];

    // Control search scope - inbox only vs all folders
    if (!criteria.searchAllFolders && (!criteria.labels || criteria.labels.length === 0)) {
      // By default, search in INBOX only unless explicitly searching all folders
      // This prevents searching across promotional/social/update folders
      queryParts.push('in:inbox');
    }

    if (criteria.query) queryParts.push(criteria.query);
    if (criteria.from) queryParts.push(`from:${criteria.from}`);
    if (criteria.to) queryParts.push(`to:${criteria.to}`);
    if (criteria.subject) queryParts.push(`subject:${criteria.subject}`);
    if (criteria.hasAttachment) queryParts.push('has:attachment');
    if (criteria.isUnread) queryParts.push('is:unread');
    if (criteria.after) queryParts.push(`after:${criteria.after.toISOString().split('T')[0]}`);
    if (criteria.before) queryParts.push(`before:${criteria.before.toISOString().split('T')[0]}`);

    // Handle specific labels if provided
    if (criteria.labels && criteria.labels.length > 0) {
      const labelQueries = criteria.labels.map(label => `label:${label}`);
      queryParts.push(`(${labelQueries.join(' OR ')})`);
    }

    return queryParts.join(' ');
  }

  private buildEmailContent(params: SendEmailParams, fromEmail: string): string {
    const lines = [
      `From: ${fromEmail}`,
      `To: ${params.to.join(', ')}`,
      params.cc ? `Cc: ${params.cc.join(', ')}` : '',
      params.bcc ? `Bcc: ${params.bcc.join(', ')}` : '',
      `Subject: ${params.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36)}@gmail.com>`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      params.body
    ].filter(Boolean);

    return lines.join('\r\n');
  }

  private buildReplyContent(originalMessage: any, params: ReplyEmailParams): string {
    const headers = originalMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const lines = [
      `To: ${getHeader('From')}`,
      `Subject: Re: ${getHeader('Subject')}`,
      `In-Reply-To: ${getHeader('Message-ID')}`,
      `References: ${getHeader('References')} ${getHeader('Message-ID')}`.trim(),
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body
    ];

    if (params.includeOriginal) {
      lines.push('', '--- Original Message ---');
      lines.push(this.extractTextBody(originalMessage.payload));
    }

    return lines.join('\r\n');
  }

  private buildForwardContent(originalMessage: any, params: ForwardEmailParams): string {
    const headers = originalMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const lines = [
      `To: ${params.to.join(', ')}`,
      params.cc ? `Cc: ${params.cc.join(', ')}` : '',
      `Subject: Fwd: ${getHeader('Subject')}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      params.body || '',
      '',
      '--- Forwarded Message ---',
      `From: ${getHeader('From')}`,
      `Date: ${getHeader('Date')}`,
      `Subject: ${getHeader('Subject')}`,
      `To: ${getHeader('To')}`,
      '',
      this.extractTextBody(originalMessage.payload)
    ].filter(line => line !== undefined);

    return lines.join('\r\n');
  }

  private extractTextBody(payload: any): string {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }

      // If no text/plain found, try to extract text from HTML as fallback
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          const htmlContent = Buffer.from(part.body.data, 'base64').toString();
          // Basic HTML stripping for text fallback
          return htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }

    return '';
  }

  private extractHtmlBody(payload: any): string | undefined {
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    return undefined;
  }

  private extractAttachments(payload: any): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId
          });
        }
      }
    }

    return attachments;
  }

  private getTimeRange(timeframe: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (timeframe) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(now.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'last_week':
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
        lastWeekStart.setHours(0, 0, 0, 0);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        return { start: lastWeekStart, end: lastWeekEnd };
      case 'this_month':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  private async analyzeAttentionNeeded(emails: EmailMessage[]): Promise<EmailAnalysisResult> {
    const urgentEmails = emails.filter(email => this.isUrgent(email));
    const unreadEmails = emails.filter(email => !email.isRead);
    const overdueReplies = emails.filter(email => this.isOverdueReply(email));

    // Include ALL unread emails in needsAttention, not just urgent/overdue ones
    // This better matches user expectations when they ask about "important unread emails"
    const needsAttention = Array.from(new Set([...unreadEmails, ...urgentEmails, ...overdueReplies]));

    const analysis: AttentionAnalysis = {
      needsAttention,
      urgentCount: urgentEmails.length,
      unreadCount: unreadEmails.length,
      overdueReplies,
      upcomingDeadlines: await this.extractDeadlines(emails),
      summary: this.generateAttentionSummary(urgentEmails.length, unreadEmails.length, overdueReplies.length)
    };

    return {
      summary: analysis.summary,
      insights: [
        `${urgentEmails.length} urgent emails found`,
        `${unreadEmails.length} unread emails`,
        `${overdueReplies.length} emails may need replies`,
        `${analysis.upcomingDeadlines.length} upcoming deadlines`
      ],
      data: analysis,
      urgentEmails,
      recommendations: this.generateAttentionRecommendations(analysis)
    };
  }

  private async analyzeSentiment(emails: EmailMessage[]): Promise<EmailAnalysisResult> {
    const sentimentAnalysis = emails.map(email => ({
      email,
      sentiment: this.analyzeSentimentScore(email),
      urgency: this.analyzeUrgencyLevel(email)
    }));

    const negative = sentimentAnalysis.filter(s => s.sentiment < -0.3);
    const urgent = sentimentAnalysis.filter(s => s.urgency === 'high' || s.urgency === 'urgent');

    return {
      summary: `Analyzed ${emails.length} emails: ${negative.length} negative sentiment, ${urgent.length} urgent`,
      insights: [
        `${negative.length} emails with negative sentiment detected`,
        `${urgent.length} emails marked as urgent`,
        `Average sentiment score: ${(sentimentAnalysis.reduce((sum, s) => sum + s.sentiment, 0) / sentimentAnalysis.length).toFixed(2)}`
      ],
      data: sentimentAnalysis,
      urgentEmails: urgent.map(s => s.email),
      recommendations: [
        ...negative.length > 0 ? ['Review emails with negative sentiment for potential issues'] : [],
        ...urgent.length > 0 ? ['Prioritize responding to urgent emails'] : []
      ]
    };
  }

  private async analyzeActivity(emails: EmailMessage[], timeRange: { start: Date; end: Date }): Promise<EmailAnalysisResult> {
    const received = emails.length;
    const sent = 0; // Would need to query sent emails separately
    const replied = emails.filter(email => email.labels?.includes('\\Answered')).length;

    const hourlyDistribution = this.getHourlyDistribution(emails);
    const topSenders = this.getTopSenders(emails);

    return {
      summary: `Email activity: ${received} received, ${replied} replied to (${Math.round(replied / received * 100)}% response rate)`,
      insights: [
        `Peak email time: ${this.getPeakHour(hourlyDistribution)}:00`,
        `Most active sender: ${topSenders[0]?.name || 'N/A'} (${topSenders[0]?.count || 0} emails)`,
        `Response rate: ${Math.round(replied / received * 100)}%`
      ],
      data: {
        received,
        sent,
        replied,
        responseRate: replied / received,
        hourlyDistribution,
        topSenders
      }
    };
  }

  private async extractActionItems(emails: EmailMessage[]): Promise<EmailAnalysisResult> {
    const actionItems: ActionItem[] = [];

    for (const email of emails) {
      const items = this.extractActionItemsFromEmail(email);
      actionItems.push(...items);
    }

    // Sort by priority and due date
    actionItems.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      }
      return 0;
    });

    return {
      summary: `Found ${actionItems.length} action items across ${emails.length} emails`,
      insights: [
        `${actionItems.filter(a => a.priority === 'urgent').length} urgent actions`,
        `${actionItems.filter(a => a.actionType === 'reply_needed').length} replies needed`,
        `${actionItems.filter(a => a.actionType === 'deadline').length} upcoming deadlines`
      ],
      data: actionItems,
      actionItems,
      recommendations: [
        'Prioritize urgent action items first',
        'Set reminders for upcoming deadlines',
        'Block time for email responses'
      ]
    };
  }

  private async analyzeTrends(emails: EmailMessage[], timeRange: { start: Date; end: Date }): Promise<EmailAnalysisResult> {
    const trends: EmailTrends = {
      topSenders: this.getTopSenders(emails),
      emailVolume: this.getVolumeByDay(emails, timeRange),
      responseTime: this.calculateResponseTimes(emails),
      categories: this.categorizeEmails(emails)
    };

    return {
      summary: `Email trends: ${emails.length} emails, avg response time ${trends.responseTime.average}h`,
      insights: [
        `Top sender: ${trends.topSenders[0]?.name || 'N/A'} (${trends.topSenders[0]?.count || 0} emails)`,
        `Peak day: ${this.getPeakDay(trends.emailVolume)}`,
        `Most common category: ${trends.categories[0]?.category || 'N/A'} (${trends.categories[0]?.percentage || 0}%)`
      ],
      data: trends
    };
  }

  // Email analysis helper methods
  private isUrgent(email: EmailMessage, userCriteria?: UserEmailImportanceCriteria): boolean {
    const defaultUrgentKeywords = ['urgent', 'asap', 'emergency', 'critical', 'immediate'];
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    // Check system defaults first
    const hasSystemUrgency = defaultUrgentKeywords.some(keyword =>
      subject.includes(keyword) || body.includes(keyword)
    ) || email.isImportant;

    // If no user criteria provided, use system defaults only
    if (!userCriteria) {
      return hasSystemUrgency;
    }

    // Check user-defined urgent keywords
    if (userCriteria.urgentKeywords && userCriteria.urgentKeywords.length > 0) {
      const hasUserKeywords = userCriteria.urgentKeywords.some(keyword =>
        subject.includes(keyword.toLowerCase()) || body.includes(keyword.toLowerCase())
      );
      if (hasUserKeywords) return true;
    }

    // Check important senders
    if (userCriteria.importantSenders && userCriteria.importantSenders.length > 0) {
      const fromEmail = email.from.toLowerCase();
      const hasImportantSender = userCriteria.importantSenders.some(sender =>
        fromEmail.includes(sender.toLowerCase())
      );
      if (hasImportantSender) return true;
    }

    // Check important domains
    if (userCriteria.importantDomains && userCriteria.importantDomains.length > 0) {
      const fromEmail = email.from.toLowerCase();
      const hasImportantDomain = userCriteria.importantDomains.some(domain =>
        fromEmail.includes(`@${domain.toLowerCase()}`)
      );
      if (hasImportantDomain) return true;
    }

    // Check subject patterns (regex support)
    if (userCriteria.subjectPatterns && userCriteria.subjectPatterns.length > 0) {
      const hasSubjectPattern = userCriteria.subjectPatterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(subject);
        } catch {
          // If pattern is not valid regex, treat as plain text
          return subject.includes(pattern.toLowerCase());
        }
      });
      if (hasSubjectPattern) return true;
    }

    // Check priority labels
    if (userCriteria.priorityLabels && userCriteria.priorityLabels.length > 0) {
      const hasCustomLabel = userCriteria.priorityLabels.some(label =>
        email.labels.includes(label)
      );
      if (hasCustomLabel) return true;
    }

    // Check custom rules (future enhancement - could support complex logic)
    if (userCriteria.customRules && userCriteria.customRules.length > 0) {
      // For now, just check if rule text appears in email
      const hasCustomRule = userCriteria.customRules.some(rule => {
        const ruleText = rule.rule.toLowerCase();
        return subject.includes(ruleText) || body.includes(ruleText) || email.from.toLowerCase().includes(ruleText);
      });
      if (hasCustomRule) return true;
    }

    // Fall back to system defaults
    return hasSystemUrgency;
  }

  private isOverdueReply(email: EmailMessage): boolean {
    const daysSinceReceived = (Date.now() - email.date.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceReceived > 2 && !email.labels?.includes('\\Answered') && !email.isRead;
  }

  private async extractDeadlines(emails: EmailMessage[]): Promise<ActionItem[]> {
    const deadlines: ActionItem[] = [];
    const deadlinePatterns = [
      /by\s+(\w+day|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/gi,
      /due\s+(\w+day|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/gi,
      /deadline\s+(\w+day|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/gi
    ];

    for (const email of emails) {
      const text = `${email.subject} ${email.body}`;
      for (const pattern of deadlinePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          deadlines.push({
            emailId: email.id,
            subject: email.subject,
            from: email.from,
            actionType: 'deadline',
            priority: 'high',
            description: `Deadline mentioned: ${matches[0]}`
          });
        }
      }
    }

    return deadlines;
  }

  private generateAttentionSummary(urgent: number, unread: number, overdue: number): string {
    if (urgent === 0 && unread === 0 && overdue === 0) {
      return 'No emails need immediate attention';
    }

    // If there are unread emails, they should be mentioned as needing attention
    if (unread > 0) {
      const parts = [];
      if (urgent > 0) parts.push(`${urgent} urgent`);
      parts.push(`${unread} unread`);
      if (overdue > 0) parts.push(`${overdue} overdue replies`);

      return `${parts.join(', ')} emails need your attention`;
    }

    // Fallback for edge cases (urgent/overdue but no unread)
    const parts = [];
    if (urgent > 0) parts.push(`${urgent} urgent`);
    if (overdue > 0) parts.push(`${overdue} overdue replies`);

    return `${parts.join(', ')} emails need attention`;
  }

  private generateAttentionRecommendations(analysis: AttentionAnalysis): string[] {
    const recommendations = [];

    if (analysis.urgentCount > 0) {
      recommendations.push('Review and respond to urgent emails first');
    }
    if (analysis.overdueReplies.length > 0) {
      recommendations.push('Catch up on overdue email replies');
    }
    if (analysis.upcomingDeadlines.length > 0) {
      recommendations.push('Set reminders for upcoming deadlines');
    }
    if (analysis.unreadCount > 10) {
      recommendations.push('Consider batch processing unread emails');
    }

    return recommendations;
  }

  private analyzeSentimentScore(email: EmailMessage): number {
    // Simple sentiment analysis based on keywords
    const positiveWords = ['thank', 'great', 'excellent', 'good', 'pleased', 'happy'];
    const negativeWords = ['problem', 'issue', 'urgent', 'error', 'failed', 'wrong', 'disappointed'];

    const text = `${email.subject} ${email.body}`.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (text.includes(word)) score += 0.1;
    });

    negativeWords.forEach(word => {
      if (text.includes(word)) score -= 0.2;
    });

    return Math.max(-1, Math.min(1, score));
  }

  private analyzeUrgencyLevel(email: EmailMessage): 'low' | 'medium' | 'high' | 'urgent' {
    if (this.isUrgent(email)) return 'urgent';
    if (email.isImportant) return 'high';
    if (email.subject.includes('?') || email.body.includes('please')) return 'medium';
    return 'low';
  }

  private getHourlyDistribution(emails: EmailMessage[]): { hour: number; count: number }[] {
    const distribution = new Array(24).fill(0).map((_, hour) => ({ hour, count: 0 }));

    emails.forEach(email => {
      const hour = email.date.getHours();
      distribution[hour].count++;
    });

    return distribution;
  }

  private getTopSenders(emails: EmailMessage[]): { email: string; count: number; name?: string }[] {
    const senderCounts = new Map<string, number>();

    emails.forEach(email => {
      const sender = email.from;
      senderCounts.set(sender, (senderCounts.get(sender) || 0) + 1);
    });

    return Array.from(senderCounts.entries())
      .map(([email, count]) => ({ email, count, name: email.split('<')[0].trim() }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getPeakHour(distribution: { hour: number; count: number }[]): number {
    return distribution.reduce((peak, current) =>
      current.count > peak.count ? current : peak
    ).hour;
  }

  private getVolumeByDay(emails: EmailMessage[], timeRange: { start: Date; end: Date }): { date: string; received: number; sent: number }[] {
    const days = new Map<string, { received: number; sent: number }>();

    emails.forEach(email => {
      const dateKey = email.date.toISOString().split('T')[0];
      if (!days.has(dateKey)) {
        days.set(dateKey, { received: 0, sent: 0 });
      }
      days.get(dateKey)!.received++;
    });

    return Array.from(days.entries()).map(([date, counts]) => ({
      date,
      ...counts
    }));
  }

  private calculateResponseTimes(emails: EmailMessage[]): { average: number; median: number } {
    // This would need thread analysis to calculate actual response times
    // For now, return placeholder values
    return { average: 4.5, median: 2.0 };
  }

  private categorizeEmails(emails: EmailMessage[]): { category: string; count: number; percentage: number }[] {
    const categories = new Map<string, number>();

    emails.forEach(email => {
      const category = this.categorizeEmail(email);
      categories.set(category, (categories.get(category) || 0) + 1);
    });

    const total = emails.length;
    return Array.from(categories.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  private categorizeEmail(email: EmailMessage): string {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    if (subject.includes('meeting') || body.includes('meeting')) return 'Meetings';
    if (subject.includes('invoice') || body.includes('payment')) return 'Finance';
    if (subject.includes('project') || body.includes('deadline')) return 'Projects';
    if (subject.includes('newsletter') || subject.includes('unsubscribe')) return 'Newsletters';
    if (email.from.includes('noreply') || email.from.includes('no-reply')) return 'Automated';

    return 'General';
  }

  private getPeakDay(volumeData: { date: string; received: number; sent: number }[]): string {
    return volumeData.reduce((peak, current) =>
      current.received > peak.received ? current : peak
    ).date;
  }

  private extractActionItemsFromEmail(email: EmailMessage): ActionItem[] {
    const items: ActionItem[] = [];
    const text = `${email.subject} ${email.body}`.toLowerCase();

    // Check for reply needed
    if (text.includes('?') || text.includes('please respond') || text.includes('let me know')) {
      items.push({
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        actionType: 'reply_needed',
        priority: this.isUrgent(email) ? 'urgent' : 'medium',
        description: 'Email appears to require a response'
      });
    }

    // Check for meeting requests
    if (text.includes('meeting') || text.includes('schedule') || text.includes('calendar')) {
      items.push({
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        actionType: 'meeting_request',
        priority: 'medium',
        description: 'Meeting or scheduling request detected'
      });
    }

    // Check for approval needed
    if (text.includes('approve') || text.includes('approval') || text.includes('sign off')) {
      items.push({
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        actionType: 'approval_needed',
        priority: 'high',
        description: 'Approval or sign-off required'
      });
    }

    return items;
  }

  /**
   * Apply newsletter/promotional filtering to downgrade automated content
   * This is a second-pass filter that removes emails with newsletter characteristics from urgent lists
   */
  private applyNewsletterFiltering(emails: EmailMessage[]): EmailMessage[] {
    const filtered = emails.filter(email => !this.isNewsletterOrPromotional(email));

    if (filtered.length !== emails.length) {
      console.log(`Newsletter filtering: ${emails.length - filtered.length} newsletters removed from ${emails.length} emails`);
    }

    return filtered;
  }

  /**
   * Detect if an email is a newsletter, promotional content, or automated message
   * Uses multiple signals to identify non-actionable content
   */
  private isNewsletterOrPromotional(email: EmailMessage): boolean {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const htmlBody = (email.htmlBody || '').toLowerCase();
    const from = email.from.toLowerCase();

    // Debug specific emails we're interested in
    const isTargetEmail = subject.includes('messari') || subject.includes('revolut') || from.includes('messari') || from.includes('revolut');
    if (isTargetEmail) {
      console.log(`🔍 ANALYZING: "${email.subject}" from ${email.from}`);
      console.log(`   Text body length: ${body.length}, HTML body length: ${htmlBody.length}`);
      console.log(`   Text body preview: "${body.substring(0, 200)}..."`);
      console.log(`   HTML body preview: "${htmlBody.substring(0, 200)}..."`);
    }

    // Primary indicator: presence of "unsubscribe" in body content (check both text and HTML)
    const hasUnsubscribeInText = body.includes('unsubscribe');
    const hasUnsubscribeInHTML = htmlBody.includes('unsubscribe');

    if (hasUnsubscribeInText || hasUnsubscribeInHTML) {
      if (isTargetEmail) {
        console.log(`   ✅ UNSUBSCRIBE FOUND: text=${hasUnsubscribeInText}, html=${hasUnsubscribeInHTML}`);
      }
      return true;
    }

    // Secondary indicators for newsletter/promotional content
    const newsletterIndicators = [
      // Unsubscribe variations
      'click here to unsubscribe',
      'unsubscribe link',
      'opt out',
      'stop receiving',
      'manage preferences',
      'email preferences',

      // Newsletter-specific content
      'this email was sent to',
      'you are receiving this email because',
      'you subscribed to',
      'newsletter',
      'weekly digest',
      'daily digest',
      'monthly update',

      // Marketing/promotional indicators
      'promotional email',
      'marketing communication',
      'this is a promotional email',
      'advertisement',

      // Common newsletter footers
      'sent via',
      'powered by mailchimp',
      'constant contact',
      'sendgrid',
      'if you no longer wish to receive'
    ];

    // Check if email contains multiple newsletter indicators
    const indicatorCount = newsletterIndicators.filter(indicator =>
      body.includes(indicator) || htmlBody.includes(indicator) || subject.includes(indicator)
    ).length;

    if (indicatorCount >= 2) {
      return true;
    }

    // Check sender patterns that indicate automated/marketing emails
    const automatedSenderPatterns = [
      'noreply',
      'no-reply',
      'donotreply',
      'newsletter',
      'marketing',
      'notifications',
      'updates',
      'digest',
      'alerts@',
      'newsletter@',
      'news@'
    ];

    const hasAutomatedSender = automatedSenderPatterns.some(pattern =>
      from.includes(pattern)
    );

    // Check for Gmail promotional labels
    const hasPromotionalLabel = email.labels.includes('CATEGORY_PROMOTIONS') ||
      email.labels.includes('CATEGORY_UPDATES');

    // Combine signals: automated sender + promotional label = likely newsletter
    if (hasAutomatedSender && hasPromotionalLabel) {
      return true;
    }

    // Subject line patterns that indicate newsletters
    const newsletterSubjectPatterns = [
      /weekly\s+digest/i,
      /daily\s+(update|digest|brief)/i,
      /newsletter/i,
      /\[\w+\]\s+/i, // [Company] Subject format common in newsletters
      /issue\s+#?\d+/i, // Issue #123 format
      /vol\.\s+\d+/i, // Vol. 1 format
    ];

    const hasNewsletterSubject = newsletterSubjectPatterns.some(pattern =>
      pattern.test(subject)
    );

    if (hasNewsletterSubject) {
      if (isTargetEmail) {
        console.log(`   ✅ NEWSLETTER SUBJECT PATTERN FOUND`);
      }
      return true;
    }

    if (isTargetEmail) {
      console.log(`   ❌ NOT DETECTED AS NEWSLETTER - will remain in urgent list`);
    }

    return false;
  }
} 