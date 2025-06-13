/**
 * WorkspaceNLPProcessor.ts - Natural language processing for workspace commands
 * 
 * This processor handles parsing and interpreting natural language commands
 * related to workspace operations like email, calendar, files, and spreadsheets.
 */

import { parse, ParsedResult } from 'chrono-node';
import { logger } from '../../../lib/logging';

/**
 * Types of workspace commands
 */
export enum WorkspaceCommandType {
  // Email commands
  SEND_EMAIL = 'send_email',
  READ_EMAIL = 'read_email',
  REPLY_EMAIL = 'reply_email',
  FORWARD_EMAIL = 'forward_email',
  SEARCH_EMAIL = 'search_email',
  ANALYZE_EMAIL = 'analyze_email',
  CHECK_EMAIL_ATTENTION = 'check_email_attention',
  GET_ACTION_ITEMS = 'get_action_items',
  GET_EMAIL_TRENDS = 'get_email_trends',
  
  // Calendar commands
  SCHEDULE_EVENT = 'schedule_event',
  CHECK_CALENDAR = 'check_calendar',
  FIND_AVAILABILITY = 'find_availability',
  EDIT_EVENT = 'edit_event',
  DELETE_EVENT = 'delete_event',
  CANCEL_EVENT = 'cancel_event',
  FIND_EVENTS = 'find_events',
  SUMMARIZE_DAY = 'summarize_day',
  
  // File commands
  SEARCH_FILES = 'search_files',
  UPLOAD_FILE = 'upload_file',
  SHARE_FILE = 'share_file',
  GET_FILE_DETAILS = 'get_file_details',
  
  // Spreadsheet commands
  CREATE_SPREADSHEET = 'create_spreadsheet',
  READ_SPREADSHEET = 'read_spreadsheet',
  UPDATE_SPREADSHEET = 'update_spreadsheet',
  ANALYZE_SPREADSHEET = 'analyze_spreadsheet',
  CREATE_EXPENSE_TRACKER = 'create_expense_tracker',
  
  // General
  UNKNOWN = 'unknown'
}

/**
 * Parsed workspace command structure
 */
export interface WorkspaceCommand {
  type: WorkspaceCommandType;
  intent: string;
  entities: Record<string, any>;
  scheduledTime?: Date;
  confidence: number;
  originalText: string;
}

/**
 * Natural language processor for workspace commands
 */
export class WorkspaceNLPProcessor {
  
  /**
   * Parse a natural language command into a structured workspace command
   */
  parseCommand(text: string): WorkspaceCommand | null {
    const normalizedText = text.toLowerCase().trim();
    
    // Extract scheduled time first
    const scheduledTime = this.extractScheduledTime(text);
    
    // Determine command type
    const commandType = this.determineCommandType(normalizedText);
    
    if (commandType === WorkspaceCommandType.UNKNOWN) {
      return null;
    }
    
    // Extract entities based on command type
    const entities = this.extractEntities(normalizedText, commandType);
    
    // Calculate confidence
    const confidence = this.calculateConfidence(normalizedText, commandType, entities);
    
    return {
      type: commandType,
      intent: this.getIntent(commandType),
      entities,
      scheduledTime,
      confidence,
      originalText: text
    };
  }
  
  /**
   * Determine the type of workspace command
   */
  private determineCommandType(text: string): WorkspaceCommandType {
    // Email patterns - order matters for specificity
    if (this.matchesEmailForward(text)) return WorkspaceCommandType.FORWARD_EMAIL;
    if (this.matchesGetEmailTrends(text)) return WorkspaceCommandType.GET_EMAIL_TRENDS;
    if (this.matchesGetActionItems(text)) return WorkspaceCommandType.GET_ACTION_ITEMS;
    if (this.matchesEmailAttention(text)) return WorkspaceCommandType.CHECK_EMAIL_ATTENTION;
    if (this.matchesEmailReply(text)) return WorkspaceCommandType.REPLY_EMAIL;
    if (this.matchesEmailSearch(text)) return WorkspaceCommandType.SEARCH_EMAIL;
    if (this.matchesEmailAnalysis(text)) return WorkspaceCommandType.ANALYZE_EMAIL;
    if (this.matchesEmailRead(text)) return WorkspaceCommandType.READ_EMAIL;
    if (this.matchesEmailSend(text)) return WorkspaceCommandType.SEND_EMAIL;
    
    // Calendar patterns - order matters for specificity
    if (this.matchesDeleteEvent(text)) return WorkspaceCommandType.DELETE_EVENT;
    if (this.matchesFindEvents(text)) return WorkspaceCommandType.FIND_EVENTS;
    if (this.matchesEditEvent(text)) return WorkspaceCommandType.EDIT_EVENT;
    if (this.matchesSummarizeDay(text)) return WorkspaceCommandType.SUMMARIZE_DAY;
    if (this.matchesFindAvailability(text)) return WorkspaceCommandType.FIND_AVAILABILITY;
    if (this.matchesCheckCalendar(text)) return WorkspaceCommandType.CHECK_CALENDAR;
    if (this.matchesScheduleEvent(text)) return WorkspaceCommandType.SCHEDULE_EVENT;
    
    // File patterns
    if (this.matchesShareFile(text)) return WorkspaceCommandType.SHARE_FILE;
    if (this.matchesGetFileDetails(text)) return WorkspaceCommandType.GET_FILE_DETAILS;
    if (this.matchesUploadFile(text)) return WorkspaceCommandType.UPLOAD_FILE;
    if (this.matchesSearchFiles(text)) return WorkspaceCommandType.SEARCH_FILES;
    
    // Spreadsheet patterns - order matters for specificity
    if (this.matchesCreateExpenseTracker(text)) return WorkspaceCommandType.CREATE_EXPENSE_TRACKER;
    if (this.matchesUpdateSpreadsheet(text)) return WorkspaceCommandType.UPDATE_SPREADSHEET;
    if (this.matchesAnalyzeSpreadsheet(text)) return WorkspaceCommandType.ANALYZE_SPREADSHEET;
    if (this.matchesReadSpreadsheet(text)) return WorkspaceCommandType.READ_SPREADSHEET;
    if (this.matchesCreateSpreadsheet(text)) return WorkspaceCommandType.CREATE_SPREADSHEET;
    
    return WorkspaceCommandType.UNKNOWN;
  }
  
  /**
   * Email command matchers
   */
  private matchesEmailSend(text: string): boolean {
    const patterns = [
      /send.*email/,
      /email.*to/,
      /write.*email/,
      /compose.*email/,
      /draft.*email/,
      /message.*to/,
      /mail.*to/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailRead(text: string): boolean {
    const patterns = [
      /^check.*my.*emails.*from/,
      /^read.*my.*emails/,
      /^show.*my.*emails/,
      /^get.*my.*emails/,
      /^view.*my.*emails/,
      /emails.*from.*today/,
      /emails.*from.*yesterday/,
      /recent.*emails/,
      /latest.*emails/,
      /new.*emails/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailReply(text: string): boolean {
    const patterns = [
      /reply.*to/,
      /respond.*to/,
      /answer.*email/,
      /reply.*email/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailForward(text: string): boolean {
    const patterns = [
      /^forward.*this.*email/,
      /^forward.*email.*to/,
      /^forward.*this.*to/,
      /forward.*to.*team/,
      /forward.*to.*group/,
      /pass.*along.*email/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailSearch(text: string): boolean {
    const patterns = [
      /search.*email/,
      /find.*email/,
      /look.*for.*email/,
      /emails.*from/,
      /emails.*about/,
      /emails.*containing/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailAnalysis(text: string): boolean {
    const patterns = [
      /analyze.*email/,
      /email.*analysis/,
      /email.*trends/,
      /email.*patterns/,
      /email.*sentiment/,
      /email.*insights/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesEmailAttention(text: string): boolean {
    const patterns = [
      /emails.*need.*attention/,
      /urgent.*email/,
      /important.*email/,
      /emails.*requiring/,
      /emails.*need.*response/,
      /overdue.*email/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Calendar command matchers
   */
  private matchesScheduleEvent(text: string): boolean {
    const patterns = [
      /schedule.*meeting/,
      /schedule.*event/,
      /book.*meeting/,
      /create.*meeting/,
      /set.*up.*meeting/,
      /arrange.*meeting/,
      /plan.*meeting/,
      /meeting.*with/,
      /calendar.*event/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesCheckCalendar(text: string): boolean {
    const patterns = [
      /^what.*on.*my.*calendar/,
      /^what.*on.*calendar.*today/,
      /check.*calendar/,
      /show.*calendar/,
      /calendar.*today/,
      /calendar.*tomorrow/,
      /my.*schedule.*today/,
      /my.*schedule.*tomorrow/,
      /what.*scheduled/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesFindAvailability(text: string): boolean {
    const patterns = [
      /when.*available/,
      /free.*time/,
      /availability/,
      /time.*for.*meeting/,
      /schedule.*time/,
      /find.*time/,
      /available.*for/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  /**
   * File command matchers
   */
  private matchesSearchFiles(text: string): boolean {
    const patterns = [
      /find.*file/,
      /search.*file/,
      /look.*for.*file/,
      /files.*containing/,
      /documents.*about/,
      /files.*from/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesUploadFile(text: string): boolean {
    const patterns = [
      /upload.*file/,
      /upload.*document/,
      /upload.*my/,
      /add.*file/,
      /put.*file/,
      /save.*file.*to/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Spreadsheet command matchers
   */
  private matchesCreateSpreadsheet(text: string): boolean {
    const patterns = [
      /^create.*budget.*spreadsheet/,
      /^create.*\w+.*spreadsheet/,
      /^new.*spreadsheet/,
      /^make.*spreadsheet/,
      /^build.*spreadsheet/,
      /^set.*up.*spreadsheet/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  private matchesReadSpreadsheet(text: string): boolean {
    const patterns = [
      /^read.*data.*from/,
      /^show.*data.*from/,
      /^get.*data.*from/,
      /^view.*spreadsheet/,
      /^open.*spreadsheet/,
      /data.*from.*sheet/,
      /read.*sheet/,
      /show.*sheet/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Extract entities from the command text
   */
  private extractEntities(text: string, commandType: WorkspaceCommandType): Record<string, any> {
    const entities: Record<string, any> = {};
    
    switch (commandType) {
      case WorkspaceCommandType.SEND_EMAIL:
        entities.recipients = this.extractEmailAddresses(text);
        entities.subject = this.extractEmailSubject(text);
        entities.body = this.extractEmailBody(text);
        break;
        
      case WorkspaceCommandType.SCHEDULE_EVENT:
        entities.attendees = this.extractEmailAddresses(text);
        entities.title = this.extractEventTitle(text);
        entities.duration = this.extractDuration(text);
        entities.location = this.extractLocation(text);
        break;
        
      case WorkspaceCommandType.SEARCH_EMAIL:
        entities.sender = this.extractSender(text);
        entities.subject = this.extractEmailSubject(text);
        entities.keywords = this.extractKeywords(text);
        entities.timeframe = this.extractTimeframe(text);
        break;
        
      case WorkspaceCommandType.CREATE_SPREADSHEET:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.template = this.extractSpreadsheetTemplate(text);
        entities.categories = this.extractCategories(text);
        break;
        
      case WorkspaceCommandType.SEARCH_FILES:
        entities.query = this.extractFileQuery(text);
        entities.fileType = this.extractFileType(text);
        entities.timeframe = this.extractTimeframe(text);
        break;
    }
    
    return entities;
  }
  
  /**
   * Extract scheduled time from text
   */
  private extractScheduledTime(text: string): Date | undefined {
    try {
      const parsed = parse(text);
      if (parsed.length > 0) {
        return parsed[0].start.date();
      }
    } catch (error) {
      logger.debug('Failed to parse time from text:', error);
    }
    return undefined;
  }
  
  /**
   * Entity extraction helpers
   */
  private extractEmailAddresses(text: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    return text.match(emailRegex) || [];
  }
  
  private extractEmailSubject(text: string): string | undefined {
    const subjectPatterns = [
      /subject[:\s]+"([^"]+)"/i,
      /about\s+"([^"]+)"/i,
      /regarding\s+"([^"]+)"/i,
      /re[:\s]+"([^"]+)"/i
    ];
    
    for (const pattern of subjectPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractEmailBody(text: string): string | undefined {
    const bodyPatterns = [
      /body[:\s]+"([^"]+)"/i,
      /message[:\s]+"([^"]+)"/i,
      /content[:\s]+"([^"]+)"/i,
      /saying[:\s]+"([^"]+)"/i
    ];
    
    for (const pattern of bodyPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractEventTitle(text: string): string | undefined {
    const titlePatterns = [
      /meeting\s+(?:about|for|on)\s+"([^"]+)"/i,
      /event\s+(?:about|for|on)\s+"([^"]+)"/i,
      /schedule\s+"([^"]+)"/i,
      /titled\s+"([^"]+)"/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractDuration(text: string): number | undefined {
    const durationPatterns = [
      /(\d+)\s*(?:hour|hr)s?/i,
      /(\d+)\s*(?:minute|min)s?/i,
      /(\d+)\s*h/i,
      /(\d+)\s*m/i
    ];
    
    for (const pattern of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        if (text.includes('hour') || text.includes('hr') || text.includes('h')) {
          return value * 60; // Convert to minutes
        }
        return value; // Already in minutes
      }
    }
    return undefined;
  }
  
  private extractLocation(text: string): string | undefined {
    const locationPatterns = [
      /(?:at|in|location)\s+"([^"]+)"/i,
      /room\s+(\w+)/i,
      /conference\s+room\s+(\w+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractSender(text: string): string | undefined {
    const senderPatterns = [
      /from\s+([^\s]+@[^\s]+)/i,
      /sender[:\s]+([^\s]+@[^\s]+)/i,
      /emails\s+from\s+([^\s]+)/i
    ];
    
    for (const pattern of senderPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractKeywords(text: string): string[] {
    const keywordPatterns = [
      /containing\s+"([^"]+)"/i,
      /about\s+"([^"]+)"/i,
      /keywords?\s+"([^"]+)"/i
    ];
    
    for (const pattern of keywordPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].split(/[,\s]+/);
    }
    return [];
  }
  
  private extractTimeframe(text: string): string | undefined {
    const timeframes = [
      'today', 'yesterday', 'tomorrow',
      'this week', 'last week', 'next week',
      'this month', 'last month', 'next month',
      'this year', 'last year'
    ];
    
    for (const timeframe of timeframes) {
      if (text.includes(timeframe)) return timeframe;
    }
    return undefined;
  }
  
  private extractSpreadsheetTitle(text: string): string | undefined {
    const titlePatterns = [
      /spreadsheet\s+(?:for|called|named)\s+"([^"]+)"/i,
      /create\s+"([^"]+)"\s+spreadsheet/i,
      /(?:expense|budget|project)\s+(?:tracker|planner|sheet)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    
    // Check for common spreadsheet types
    if (text.includes('expense')) return 'Expense Tracker';
    if (text.includes('budget')) return 'Budget Planner';
    if (text.includes('project')) return 'Project Timeline';
    
    return undefined;
  }
  
  private extractSpreadsheetTemplate(text: string): string | undefined {
    if (text.includes('expense')) return 'expense_tracker';
    if (text.includes('budget')) return 'budget_planner';
    if (text.includes('project')) return 'project_timeline';
    return 'custom';
  }
  
  private extractCategories(text: string): string[] {
    const categoryPatterns = [
      /categories?\s+"([^"]+)"/i,
      /columns?\s+"([^"]+)"/i,
      /headers?\s+"([^"]+)"/i
    ];
    
    for (const pattern of categoryPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].split(/[,\s]+/);
    }
    
    // Default categories for common templates
    if (text.includes('expense')) {
      return ['Date', 'Description', 'Category', 'Amount'];
    }
    if (text.includes('budget')) {
      return ['Category', 'Budgeted', 'Actual', 'Difference'];
    }
    
    return [];
  }
  
  private extractFileQuery(text: string): string | undefined {
    const queryPatterns = [
      /find\s+"([^"]+)"/i,
      /search\s+for\s+"([^"]+)"/i,
      /files?\s+(?:containing|about|named)\s+"([^"]+)"/i
    ];
    
    for (const pattern of queryPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }
  
  private extractFileType(text: string): string | undefined {
    const fileTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
    
    for (const type of fileTypes) {
      if (text.includes(type)) return type;
    }
    
    if (text.includes('document')) return 'doc';
    if (text.includes('spreadsheet')) return 'xlsx';
    if (text.includes('presentation')) return 'pptx';
    
    return undefined;
  }
  
  /**
   * Calculate confidence score for the parsed command
   */
  private calculateConfidence(text: string, commandType: WorkspaceCommandType, entities: Record<string, any>): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on specific patterns
    if (commandType !== WorkspaceCommandType.UNKNOWN) {
      confidence += 0.3;
    }
    
    // Increase confidence based on extracted entities
    const entityCount = Object.keys(entities).filter(key => entities[key] !== undefined).length;
    confidence += entityCount * 0.05;
    
    // Increase confidence for specific keywords
    const specificKeywords = ['email', 'calendar', 'meeting', 'spreadsheet', 'file'];
    const keywordMatches = specificKeywords.filter(keyword => text.includes(keyword)).length;
    confidence += keywordMatches * 0.1;
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Get intent description for command type
   */
  private getIntent(commandType: WorkspaceCommandType): string {
    const intents = {
      [WorkspaceCommandType.SEND_EMAIL]: 'Send an email message',
      [WorkspaceCommandType.READ_EMAIL]: 'Read email messages',
      [WorkspaceCommandType.REPLY_EMAIL]: 'Reply to an email',
      [WorkspaceCommandType.FORWARD_EMAIL]: 'Forward an email',
      [WorkspaceCommandType.SEARCH_EMAIL]: 'Search for emails',
      [WorkspaceCommandType.ANALYZE_EMAIL]: 'Analyze email patterns',
      [WorkspaceCommandType.CHECK_EMAIL_ATTENTION]: 'Check emails needing attention',
      [WorkspaceCommandType.GET_ACTION_ITEMS]: 'Get action items from emails',
      [WorkspaceCommandType.GET_EMAIL_TRENDS]: 'Get email trends and statistics',
      [WorkspaceCommandType.SCHEDULE_EVENT]: 'Schedule a calendar event',
      [WorkspaceCommandType.CHECK_CALENDAR]: 'Check calendar schedule',
      [WorkspaceCommandType.FIND_AVAILABILITY]: 'Find available time slots',
      [WorkspaceCommandType.EDIT_EVENT]: 'Edit or reschedule an event',
      [WorkspaceCommandType.DELETE_EVENT]: 'Delete or cancel an event',
      [WorkspaceCommandType.CANCEL_EVENT]: 'Cancel an event',
      [WorkspaceCommandType.FIND_EVENTS]: 'Find specific events',
      [WorkspaceCommandType.SUMMARIZE_DAY]: 'Summarize daily schedule',
      [WorkspaceCommandType.SEARCH_FILES]: 'Search for files',
      [WorkspaceCommandType.UPLOAD_FILE]: 'Upload a file',
      [WorkspaceCommandType.SHARE_FILE]: 'Share a file with others',
      [WorkspaceCommandType.GET_FILE_DETAILS]: 'Get file details and permissions',
      [WorkspaceCommandType.CREATE_SPREADSHEET]: 'Create a spreadsheet',
      [WorkspaceCommandType.READ_SPREADSHEET]: 'Read spreadsheet data',
      [WorkspaceCommandType.UPDATE_SPREADSHEET]: 'Update spreadsheet data',
      [WorkspaceCommandType.ANALYZE_SPREADSHEET]: 'Analyze spreadsheet data',
      [WorkspaceCommandType.CREATE_EXPENSE_TRACKER]: 'Create an expense tracker',
      [WorkspaceCommandType.UNKNOWN]: 'Unknown workspace command'
    };
    
    return intents[commandType] || 'Unknown command';
  }

  private matchesGetActionItems(text: string): boolean {
    const patterns = [
      /action.*items/,
      /what.*do.*i.*need.*to.*do/,
      /tasks.*from.*email/,
      /to.*do.*list/,
      /follow.*up.*items/,
      /what.*tasks/,
      /extract.*tasks/,
      /action.*required/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesGetEmailTrends(text: string): boolean {
    const patterns = [
      /^show.*me.*email.*trends/,
      /^email.*trends/,
      /^my.*email.*trends/,
      /email.*statistics/,
      /who.*emails.*me.*most/,
      /email.*volume/,
      /communication.*patterns/,
      /email.*analytics/,
      /email.*insights/,
      /email.*metrics/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesEditEvent(text: string): boolean {
    const patterns = [
      /edit.*meeting/,
      /edit.*event/,
      /change.*meeting/,
      /modify.*event/,
      /update.*meeting/,
      /reschedule/,
      /move.*meeting/,
      /change.*time/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesDeleteEvent(text: string): boolean {
    const patterns = [
      /^cancel.*my.*meeting/,
      /^cancel.*meeting.*with/,
      /^delete.*my.*meeting/,
      /^remove.*my.*meeting/,
      /^delete.*event/,
      /^remove.*event/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesFindEvents(text: string): boolean {
    const patterns = [
      /^find.*meetings.*with/,
      /^find.*events.*with/,
      /^search.*meetings.*with/,
      /^search.*events.*with/,
      /^look.*for.*meetings.*with/,
      /meetings.*with.*\w+/,
      /events.*with.*\w+/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesSummarizeDay(text: string): boolean {
    const patterns = [
      /summarize.*day/,
      /day.*summary/,
      /what.*today/,
      /today.*schedule/,
      /daily.*summary/,
      /overview.*today/,
      /what.*happening.*today/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesShareFile(text: string): boolean {
    const patterns = [
      /share.*file/,
      /share.*document/,
      /share.*with/,
      /give.*access/,
      /send.*file.*to/,
      /share.*folder/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesGetFileDetails(text: string): boolean {
    const patterns = [
      /file.*details/,
      /file.*info/,
      /file.*information/,
      /properties.*file/,
      /details.*about.*file/,
      /who.*has.*access/,
      /file.*permissions/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesUpdateSpreadsheet(text: string): boolean {
    const patterns = [
      /^update.*my.*\w+.*sheet/,
      /^update.*spreadsheet/,
      /^edit.*my.*\w+.*sheet/,
      /^modify.*sheet/,
      /^change.*data.*in/,
      /^add.*to.*sheet/,
      /^insert.*row/,
      /^update.*cell/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesAnalyzeSpreadsheet(text: string): boolean {
    const patterns = [
      /analyze.*data/,
      /analyze.*spreadsheet/,
      /data.*analysis/,
      /calculate.*total/,
      /sum.*up/,
      /statistics.*from/,
      /insights.*from.*data/,
      /trends.*in.*data/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesCreateExpenseTracker(text: string): boolean {
    const patterns = [
      /^create.*an.*expense.*tracker/,
      /^expense.*tracker$/,
      /^track.*my.*expenses/,
      /^new.*expense.*sheet/,
      /^budget.*tracker$/,
      /^spending.*tracker$/,
      /^financial.*tracker$/
    ];
    return patterns.some(pattern => pattern.test(text));
  }
}

// Export singleton instance
export const workspaceNLPProcessor = new WorkspaceNLPProcessor();

/**
 * Helper function to parse workspace commands
 */
export function parseWorkspaceCommand(text: string): WorkspaceCommand | null {
  return workspaceNLPProcessor.parseCommand(text);
} 