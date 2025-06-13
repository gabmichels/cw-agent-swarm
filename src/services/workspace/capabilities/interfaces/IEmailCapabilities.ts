import { 
  EmailMessage, 
  EmailSearchCriteria, 
  SendEmailParams, 
  ReplyEmailParams, 
  ForwardEmailParams,
  EmailAnalysisParams,
  EmailAnalysisResult,
  ActionItem,
  EmailTrends,
  AttentionAnalysis
} from '../EmailCapabilities';

/**
 * Abstract interface for email capabilities across all workspace providers
 * This ensures consistent functionality regardless of the underlying provider (Google, Microsoft, Zoho)
 */
export interface IEmailCapabilities {
  /**
   * Read a specific email by ID
   */
  readSpecificEmail(emailId: string, connectionId: string, agentId: string): Promise<EmailMessage>;

  /**
   * Search for emails based on criteria
   */
  searchEmails(criteria: EmailSearchCriteria, connectionId: string, agentId: string): Promise<EmailMessage[]>;

  /**
   * Find important emails that require attention
   */
  findImportantEmails(criteria: {
    unread?: boolean;
    hasAttachments?: boolean;
    keywords?: string[];
    timeframe?: 'last_hour' | 'last_24_hours' | 'last_week' | 'last_month';
  }, connectionId: string, agentId: string): Promise<EmailMessage[]>;

  /**
   * Send a new email
   */
  sendEmail(params: SendEmailParams, connectionId: string, agentId: string): Promise<EmailMessage>;

  /**
   * Reply to an existing email
   */
  replyToEmail(params: ReplyEmailParams, connectionId: string, agentId: string): Promise<EmailMessage>;

  /**
   * Forward an email
   */
  forwardEmail(params: ForwardEmailParams, connectionId: string, agentId: string): Promise<EmailMessage>;

  /**
   * Analyze emails for insights and action items
   */
  analyzeEmails(params: EmailAnalysisParams, connectionId: string, agentId: string): Promise<EmailAnalysisResult>;

  /**
   * Get emails that need immediate attention
   */
  getEmailsNeedingAttention(connectionId: string, agentId: string): Promise<AttentionAnalysis>;

  /**
   * Extract action items from emails
   */
  getActionItems(timeframe: 'today' | 'this_week', connectionId: string, agentId: string): Promise<ActionItem[]>;

  /**
   * Get email trends and statistics
   */
  getEmailTrends(timeframe: 'this_week' | 'this_month', connectionId: string, agentId: string): Promise<EmailTrends>;
} 