/**
 * WorkspaceNLPProcessor.ts - Natural language processing for workspace commands
 * 
 * This processor handles parsing and interpreting natural language commands
 * related to workspace operations like email, calendar, files, and spreadsheets.
 */

import { parse } from 'chrono-node';
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
  async parseCommand(text: string): Promise<WorkspaceCommand | null> {
    const normalizedText = text.toLowerCase().trim();

    // Extract scheduled time first (now async)
    const scheduledTime = await this.extractScheduledTime(text);

    // Determine command type
    const commandType = this.determineCommandType(normalizedText);

    if (commandType === WorkspaceCommandType.UNKNOWN) {
      return null;
    }

    // Extract entities based on command type
    const entities = await this.extractEntities(normalizedText, commandType);

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
    // STRICT: Only patterns that explicitly mention "email" or clear email intent
    const patterns = [
      /send.*email/,
      /email.*to/,
      /write.*email/,
      /compose.*email/,
      /draft.*email/,
      /mail.*to/,
      // Only patterns that explicitly contain "email" keyword
      /email.*from.*my/,
      /email.*via.*gmail/,
      /email.*via.*outlook/,
      /email.*using.*gmail/,
      /email.*using.*outlook/,
      /send.*this.*email/,
      /send.*it.*via.*email/,
      /send.*an.*email/,
      /email.*with.*gmail/,
      /email.*with.*outlook/,
      /email.*through.*gmail/,
      /email.*through.*outlook/
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
  private async extractEntities(text: string, commandType: WorkspaceCommandType): Promise<Record<string, any>> {
    const entities: Record<string, any> = {};

    switch (commandType) {
      case WorkspaceCommandType.SEND_EMAIL:
        entities.recipients = this.extractEmailAddresses(text);
        entities.subject = this.extractEmailSubject(text);
        entities.body = this.extractEmailBody(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);

        // Add debug logging for email extraction
        logger.debug('Email entity extraction results', {
          originalText: text,
          recipients: entities.recipients,
          subject: entities.subject,
          body: entities.body,
          workspaceAccountPreference: entities.workspaceAccountPreference,
          recipientsCount: entities.recipients?.length || 0
        });
        break;

      case WorkspaceCommandType.SCHEDULE_EVENT:
        entities.attendees = this.extractEmailAddresses(text);
        entities.title = await this.extractEventTitle(text);
        entities.duration = this.extractDuration(text);
        entities.location = this.extractLocation(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);

        // Extract event time (when the meeting should occur, not when to create it)
        const eventTime = this.extractEventTime(text);
        if (eventTime) {
          entities.startTime = eventTime.startTime?.toISOString();
          entities.endTime = eventTime.endTime?.toISOString();
          entities.description = entities.description || 'Scheduled meeting';
        }
        break;

      case WorkspaceCommandType.CHECK_CALENDAR:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.timeframe = this.extractTimeframe(text);
        break;

      case WorkspaceCommandType.FIND_AVAILABILITY:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.duration = this.extractDuration(text);
        entities.timeframe = this.extractTimeframe(text);
        break;

      case WorkspaceCommandType.EDIT_EVENT:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.title = await this.extractEventTitle(text);
        entities.location = this.extractLocation(text);
        entities.duration = this.extractDuration(text);
        break;

      case WorkspaceCommandType.DELETE_EVENT:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.title = await this.extractEventTitle(text);
        break;

      case WorkspaceCommandType.FIND_EVENTS:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.keywords = this.extractKeywords(text);
        entities.timeframe = this.extractTimeframe(text);
        break;

      case WorkspaceCommandType.SUMMARIZE_DAY:
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        entities.timeframe = this.extractTimeframe(text);
        break;

      case WorkspaceCommandType.READ_EMAIL:
        entities.sender = this.extractSender(text);
        entities.subject = this.extractEmailSubject(text);
        entities.keywords = this.extractKeywords(text);
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.REPLY_EMAIL:
        entities.sender = this.extractSender(text);
        entities.subject = this.extractEmailSubject(text);
        entities.body = this.extractEmailBody(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.FORWARD_EMAIL:
        entities.sender = this.extractSender(text);
        entities.recipients = this.extractEmailAddresses(text);
        entities.body = this.extractEmailBody(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.SEARCH_EMAIL:
        entities.sender = this.extractSender(text);
        entities.subject = this.extractEmailSubject(text);
        entities.keywords = this.extractKeywords(text);
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.ANALYZE_EMAIL:
        entities.keywords = this.extractKeywords(text);
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.CHECK_EMAIL_ATTENTION:
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.GET_ACTION_ITEMS:
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.GET_EMAIL_TRENDS:
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.CREATE_SPREADSHEET:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.template = this.extractSpreadsheetTemplate(text);
        entities.categories = this.extractCategories(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.READ_SPREADSHEET:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.UPDATE_SPREADSHEET:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.ANALYZE_SPREADSHEET:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.CREATE_EXPENSE_TRACKER:
        entities.title = this.extractSpreadsheetTitle(text);
        entities.categories = this.extractCategories(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.SEARCH_FILES:
        entities.query = this.extractFileQuery(text);
        entities.fileType = this.extractFileType(text);
        entities.timeframe = this.extractTimeframe(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.UPLOAD_FILE:
        entities.fileType = this.extractFileType(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.SHARE_FILE:
        entities.recipients = this.extractEmailAddresses(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;

      case WorkspaceCommandType.GET_FILE_DETAILS:
        entities.query = this.extractFileQuery(text);
        entities.workspaceAccountPreference = this.extractWorkspaceAccountPreference(text);
        break;
    }

    return entities;
  }

  /**
   * Extract scheduled time from text using LLM-based intent detection
   * ENHANCED: Use cheap LLM to avoid false time detection from context phrases
   */
  private async extractScheduledTime(text: string): Promise<Date | undefined> {
    try {
      // Use LLM to both detect intent AND extract the actual time
      const schedulingResult = await this.detectSchedulingIntentAndTimeWithLLM(text);

      if (!schedulingResult.hasIntent) {
        logger.debug('No scheduling intent detected by LLM, skipping time parsing', {
          textPreview: text.substring(0, 100) + '...'
        });
        return undefined;
      }

      // If LLM detected scheduling intent, use its extracted time
      if (schedulingResult.extractedTime) {
        // Optional: Cross-validate with chrono-node for additional confidence
        const chronoValidation = this.validateTimeWithChrono(text, schedulingResult.extractedTime);

        logger.debug('Using LLM-extracted time for scheduling', {
          originalText: text,
          llmExtractedTime: schedulingResult.extractedTime.toISOString(),
          confidence: schedulingResult.confidence,
          chronoValidation: chronoValidation
        });
        return schedulingResult.extractedTime;
      }

      // Fallback: if LLM says there's intent but couldn't extract time, try chrono-node as backup
      logger.debug('LLM detected scheduling intent but no time extracted, trying chrono-node fallback');
      const parsed = parse(text);
      if (parsed.length > 0) {
        const chronoTime = parsed[0].start.date();
        logger.debug('Chrono-node fallback time extraction', {
          originalText: text,
          chronoTime: chronoTime.toISOString(),
          llmConfirmedIntent: true
        });
        return chronoTime;
      }

      logger.warn('LLM detected scheduling intent but no time could be extracted', {
        text: text.substring(0, 100) + '...'
      });
      return undefined;

    } catch (error) {
      logger.debug('Failed to parse time from text:', error);
      return undefined;
    }
  }

  /**
   * Use cheap LLM to detect scheduling intent AND extract the actual time
   */
  private async detectSchedulingIntentAndTimeWithLLM(text: string): Promise<{
    hasIntent: boolean;
    extractedTime?: Date;
    confidence: number;
    reasoning?: string;
  }> {
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const currentTime = new Date().toISOString();
      const prompt = `Analyze this user request to determine if they want to DELAY/SCHEDULE the EXECUTION of an action.

Current time: ${currentTime}

User request: "${text}"

CRITICAL DISTINCTION:
- TASK SCHEDULING = User wants to delay WHEN THE ACTION IS PERFORMED
- EVENT CONTENT = User is specifying WHEN AN EVENT SHOULD OCCUR (not when to create it)

Examples of TASK SCHEDULING intent (delay action execution):
- "Send this email tomorrow at 3pm" → Intent: YES, Time: [tomorrow at 3pm] (send the email tomorrow)
- "Schedule this email for next Monday" → Intent: YES, Time: [next Monday] (send email on Monday)
- "Remind me to call John in 2 hours" → Intent: YES, Time: [2 hours from now] (create reminder in 2 hours)
- "Send the report at 9am tomorrow" → Intent: YES, Time: [9am tomorrow] (send report tomorrow)

Examples of NO TASK SCHEDULING intent (immediate action with event content):
- "Schedule a meeting for tomorrow at 1pm" → Intent: NO (create meeting NOW, meeting is tomorrow)
- "Create a calendar event for Friday at 2pm" → Intent: NO (create event NOW, event is Friday)
- "Set up a meeting for next Monday" → Intent: NO (set up NOW, meeting is Monday)
- "Book a call for this afternoon" → Intent: NO (book NOW, call is this afternoon)
- "Send an email about our discussion from yesterday" → Intent: NO (send NOW, discussion was yesterday)
- "Email him the document from last week" → Intent: NO (send NOW, document from last week)
- "Reply to the message I got this morning" → Intent: NO (reply NOW, message from this morning)

KEY RULE: If the user says "schedule/create/book a meeting/event/call" they want to CREATE it NOW, not delay the creation.
Only extract time if the user wants to DELAY the action itself.

Respond in JSON format:
{
  "hasIntent": true/false,
  "extractedTime": "ISO datetime string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      const response = await openai.chat.completions.create({
        model: process.env.CHEAP_LLM_MODEL || 'gpt-4o-mini', // Cheap model
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      const result = JSON.parse(content);

      // Parse the extracted time if provided
      let extractedTime: Date | undefined;
      if (result.extractedTime && result.extractedTime !== null) {
        try {
          extractedTime = new Date(result.extractedTime);
          // Validate the date is reasonable (not in the past by more than 1 minute, not more than 1 year in future)
          const now = new Date();
          const oneMinuteAgo = new Date(now.getTime() - 60000);
          const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

          if (extractedTime < oneMinuteAgo || extractedTime > oneYearFromNow) {
            logger.warn('LLM extracted time is outside reasonable range', {
              extractedTime: extractedTime.toISOString(),
              text: text.substring(0, 100) + '...'
            });
            extractedTime = undefined;
          }
        } catch (parseError) {
          logger.warn('Failed to parse LLM extracted time', {
            extractedTime: result.extractedTime,
            error: parseError instanceof Error ? parseError.message : String(parseError)
          });
          extractedTime = undefined;
        }
      }

      const finalResult = {
        hasIntent: Boolean(result.hasIntent),
        extractedTime,
        confidence: Math.max(0, Math.min(1, Number(result.confidence) || 0.5)),
        reasoning: result.reasoning || 'No reasoning provided'
      };

      logger.debug('LLM scheduling intent and time extraction', {
        text: text.substring(0, 100) + '...',
        hasIntent: finalResult.hasIntent,
        extractedTime: finalResult.extractedTime?.toISOString(),
        confidence: finalResult.confidence,
        reasoning: finalResult.reasoning
      });

      return finalResult;

    } catch (error) {
      logger.warn('LLM scheduling intent and time extraction failed, defaulting to no intent', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Fail safe: if LLM fails, assume no scheduling intent to avoid false scheduling
      return {
        hasIntent: false,
        confidence: 0,
        reasoning: 'LLM extraction failed'
      };
    }
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
      /re[:\s]+"([^"]+)"/i,
      // Add patterns for unquoted subjects - stop at common delimiters
      /subject\s+(.*?)(?:\s+and\s+body\s+|\s+body\s+|\s+using\s+|\s+from\s+|\s+with\s+|\s*$)/i,
      /with\s+the\s+subject\s+(.*?)(?:\s+and\s+body\s+|\s+body\s+|\s+using\s+|\s+from\s+|\s*$)/i
    ];

    for (const pattern of subjectPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim()) {
        // Clean up the extracted subject
        let subject = match[1].trim();
        // Remove common trailing phrases
        subject = subject.replace(/\s+(and\s+the\s+message|with\s+the\s+message|and\s+message).*$/i, '');
        // Remove surrounding quotes if present
        subject = subject.replace(/^['"`]+|['"`]+$/g, '');
        // Remove trailing punctuation that shouldn't be in subject
        subject = subject.replace(/[?!]*$/, '');
        return subject.trim();
      }
    }
    return undefined;
  }

  private extractEmailBody(text: string): string | undefined {
    const bodyPatterns = [
      /body[:\s]+"([^"]+)"/i,
      /message[:\s]+"([^"]+)"/i,
      /content[:\s]+"([^"]+)"/i,
      /saying[:\s]+"([^"]+)"/i,
      // Add patterns for unquoted body - improved to stop at word boundaries
      /and\s+the\s+message\s+['"`]?([^'"`?]+)['"`]?/i,
      /with\s+the\s+message\s+['"`]?([^'"`?]+)['"`]?/i,
      /message\s+['"`]?([^'"`?]+)['"`]?/i,
      // Fallback pattern that stops at end of sentence
      /and\s+the\s+message\s+(.*?)(?:[?!.]|$)/i
    ];

    for (const pattern of bodyPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].trim()) {
        let body = match[1].trim();
        // Remove surrounding quotes if present
        body = body.replace(/^['"`]+|['"`]+$/g, '');
        // Remove trailing question marks that came from the user's question format
        body = body.replace(/[?!.]+$/, '');
        // Clean up any trailing punctuation
        body = body.replace(/\s+$/, '');
        return body.trim();
      }
    }
    return undefined;
  }

  private async extractEventTitle(text: string): Promise<string | undefined> {
    // First try explicit quoted titles
    const explicitTitlePatterns = [
      /meeting\s+(?:about|for|on)\s+"([^"]+)"/i,
      /event\s+(?:about|for|on)\s+"([^"]+)"/i,
      /schedule\s+"([^"]+)"/i,
      /titled\s+"([^"]+)"/i
    ];

    for (const pattern of explicitTitlePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    // Use LLM to extract meeting title intelligently
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `Extract the most appropriate meeting title from this user request. Focus on the PURPOSE or TOPIC of the meeting, not the time/logistics.

User request: "${text}"

Rules:
- Extract the meeting purpose, topic, or subject
- Ignore temporal words (tomorrow, today, 1pm, etc.)
- Ignore logistics (using Gmail, with email, etc.)
- Keep it concise and professional
- If multiple topics mentioned, pick the main one
- If no clear topic, generate based on attendees or default

Examples:
"Schedule a meeting for tomorrow at 1pm with john@company.com about quarterly review" → "Quarterly Review"
"Set up a call with the marketing team to discuss the new campaign" → "New Campaign Discussion"
"Schedule a meeting for tomorrow at 1pm with gab@crowd-wisdom.com using my Gmail account. The meeting is a simple catchup about current marketing initiatives." → "Marketing Initiatives Catchup"
"Book a meeting with Sarah" → "Meeting with Sarah"

Return only the title, nothing else.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      const extractedTitle = completion.choices[0]?.message?.content?.trim();

      if (extractedTitle && extractedTitle.length > 0 && extractedTitle !== "null" && extractedTitle !== "undefined") {
        logger.debug('Extracted meeting title using LLM', {
          originalText: text,
          extractedTitle: extractedTitle
        });
        return extractedTitle;
      }
    } catch (error) {
      logger.debug('Failed to extract title using LLM, falling back to default:', error);
    }

    // Fallback: generate a default based on attendees
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const emailMatch = text.match(emailPattern);
    if (emailMatch) {
      const emailName = emailMatch[1].split('@')[0];
      return `Meeting with ${emailName}`;
    }

    // Last resort: simple default
    return 'Scheduled Meeting';
  }

  /**
   * Extract event time (when the meeting should occur, not when to create it)
   */
  private extractEventTime(text: string): {
    startTime?: Date;
    endTime?: Date;
  } | undefined {
    try {
      // Use chrono-node to parse the time mentioned in the context of the meeting
      const parsed = parse(text);

      if (parsed.length === 0) {
        return undefined;
      }

      // Take the first parsed time as the event start time
      const startTime = parsed[0].start.date();

      // Try to find end time from the same parse result or infer it
      let endTime: Date | undefined;

      if (parsed[0].end) {
        endTime = parsed[0].end.date();
      } else {
        // If no end time specified, default to 1 hour duration
        endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      }

      logger.debug('Extracted event time for calendar event', {
        originalText: text,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      return {
        startTime,
        endTime
      };
    } catch (error) {
      logger.debug('Failed to extract event time:', error);
      return undefined;
    }
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

  /**
   * Extract sender preference from text - comprehensive NLP for email account selection
   */
  /**
   * Extract workspace account preference for ANY workspace operation
   * This determines which workspace account to use for emails, calendars, files, documents, spreadsheets, etc.
   */
  private extractWorkspaceAccountPreference(text: string): {
    type?: 'provider' | 'category' | 'specific_email' | 'domain';
    value?: string;
    confidence?: number;
  } | undefined {
    const normalizedText = text.toLowerCase();

    // ENHANCED: Comprehensive workspace account preference patterns for ALL workspace operations
    // This includes patterns for emails, calendars, files, documents, spreadsheets, etc.
    // These patterns were removed from command classification to prevent contamination

    // 0. Enhanced workspace account preference patterns (high confidence)
    const workspaceAccountPatterns = [
      // Account preference patterns
      { pattern: /use.*my.*email/i, confidence: 0.8 },
      { pattern: /use.*my.*account/i, confidence: 0.8 },
      { pattern: /using.*my.*email/i, confidence: 0.8 },
      { pattern: /using.*my.*account/i, confidence: 0.8 },
      { pattern: /send.*from.*my/i, confidence: 0.85 },
      { pattern: /send.*via.*my/i, confidence: 0.8 },
      { pattern: /send.*with.*my/i, confidence: 0.8 },
      { pattern: /send.*through.*my/i, confidence: 0.8 },
      { pattern: /from.*my.*email/i, confidence: 0.85 },
      { pattern: /from.*my.*account/i, confidence: 0.85 },

      // Provider-specific preference patterns
      { pattern: /use.*gmail/i, provider: 'GOOGLE_WORKSPACE', confidence: 0.9 },
      { pattern: /use.*outlook/i, provider: 'MICROSOFT_365', confidence: 0.9 },
      { pattern: /use.*hotmail/i, provider: 'MICROSOFT_365', confidence: 0.9 },
      { pattern: /use.*zoho/i, provider: 'ZOHO', confidence: 0.9 },
      { pattern: /via.*gmail/i, provider: 'GOOGLE_WORKSPACE', confidence: 0.85 },
      { pattern: /via.*outlook/i, provider: 'MICROSOFT_365', confidence: 0.85 },
      { pattern: /via.*zoho/i, provider: 'ZOHO', confidence: 0.85 },
      { pattern: /through.*gmail/i, provider: 'GOOGLE_WORKSPACE', confidence: 0.85 },
      { pattern: /through.*outlook/i, provider: 'MICROSOFT_365', confidence: 0.85 },
      { pattern: /send.*with.*gmail/i, provider: 'GOOGLE_WORKSPACE', confidence: 0.85 },
      { pattern: /send.*using.*gmail/i, provider: 'GOOGLE_WORKSPACE', confidence: 0.85 },
      { pattern: /send.*using.*outlook/i, provider: 'MICROSOFT_365', confidence: 0.85 },

      // File and document operation patterns
      { pattern: /save.*to.*my/i, confidence: 0.8 },
      { pattern: /create.*in.*my/i, confidence: 0.8 },
      { pattern: /upload.*to.*my/i, confidence: 0.8 },
      { pattern: /store.*in.*my/i, confidence: 0.8 },
      { pattern: /search.*in.*my/i, confidence: 0.8 },
      { pattern: /find.*in.*my/i, confidence: 0.8 },
      { pattern: /open.*from.*my/i, confidence: 0.8 },
      { pattern: /read.*from.*my/i, confidence: 0.8 },
      { pattern: /access.*my/i, confidence: 0.8 },
      { pattern: /share.*from.*my/i, confidence: 0.8 },

      // Generic preference indicators
      { pattern: /make.*sure.*to.*use/i, confidence: 0.7 },
      { pattern: /please.*use/i, confidence: 0.7 },
      { pattern: /can.*you.*use/i, confidence: 0.7 },
      { pattern: /i.*want.*to.*use/i, confidence: 0.75 },

      // Account patterns for any workspace operation
      { pattern: /use.*@.*account/i, confidence: 0.8 },
      { pattern: /using.*@.*for/i, confidence: 0.8 },
      { pattern: /send.*from.*@/i, confidence: 0.85 },
      { pattern: /save.*to.*@/i, confidence: 0.8 },
      { pattern: /create.*with.*@/i, confidence: 0.8 }
    ];

    // Check enhanced workspace account preference patterns first
    for (const { pattern, provider, confidence } of workspaceAccountPatterns) {
      if (pattern.test(text)) {
        if (provider) {
          return {
            type: 'provider',
            value: provider,
            confidence: confidence
          };
        } else {
          // Extract the actual preference value from the matched text
          const match = text.match(pattern);
          if (match) {
            // Try to extract specific preference details using existing logic below
            break; // Continue to detailed extraction
          }
        }
      }
    }

    // 1. Specific email address mentioned (highest confidence)
    // FIXED: Only match emails when they're clearly the SENDER account, not attendees
    const explicitEmailPatterns = [
      /from\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+account/i,
      /send\s+from\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+account/i,
      /send\s+this\s+from\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /via\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+account/i,
      /use\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+account/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+for\s+this/i,
      /using\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s+account/i
      // REMOVED: Patterns that might match attendee emails
      // /using\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, 
      // /via\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      // /with\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      // /use\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
    ];

    for (const pattern of explicitEmailPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          type: 'specific_email',
          value: match[1],
          confidence: 0.95
        };
      }
    }

    // 2. Provider-specific keywords (high confidence)
    const providerPatterns = [
      // Microsoft/Outlook variations - comprehensive patterns
      {
        patterns: [
          'hotmail', 'outlook', 'microsoft email', 'ms365', 'microsoft 365', 'office 365',
          'microsoft account', 'outlook account', 'outlook.com', 'hotmail.com', 'live.com',
          'msft', 'microsoft mail', 'office365', 'o365', 'microsoft work', 'ms account',
          'windows mail', 'exchange', 'microsoft exchange', 'outlook online', 'office mail'
        ],
        provider: 'MICROSOFT_365'
      },
      // Google variations - comprehensive patterns
      {
        patterns: [
          'gmail', 'google email', 'google workspace', 'g suite', 'gsuite', 'gmail account',
          'google account', 'gmail.com', 'google mail', 'google apps', 'gapps', 'google for business',
          'google work', 'google business', 'google drive email', 'google cloud email', 'workspace email'
        ],
        provider: 'GOOGLE_WORKSPACE'
      },
      // Zoho variations - comprehensive patterns
      {
        patterns: [
          'zoho', 'zoho mail', 'zoho workspace', 'zoho account', 'zoho.com', 'zoho business',
          'zoho email', 'zoho suite', 'zoho office', 'zoho work'
        ],
        provider: 'ZOHO'
      }
    ];

    for (const { patterns, provider } of providerPatterns) {
      for (const pattern of patterns) {
        if (normalizedText.includes(pattern)) {
          return {
            type: 'provider',
            value: provider,
            confidence: 0.85
          };
        }
      }
    }

    // 3. Category-based preferences (medium confidence)
    const categoryPatterns = [
      // Non-work patterns (should be personal) - MUST come first to avoid "work" matching
      {
        patterns: [
          'non-work email', 'non work', 'non-business email', 'non business'
        ],
        category: 'personal'
      },
      // Work/business email - comprehensive patterns
      {
        patterns: [
          'work email', 'business email', 'office email', 'company email', 'corporate email',
          'work account', 'business account', 'corporate account', 'professional email',
          'job email', 'employer email', 'work mail', 'business mail', 'company mail',
          'official email', 'work address', 'business address', 'company address',
          'organization email', 'org email', 'enterprise email', 'workplace email'
        ],
        category: 'work'
      },
      // Personal email - comprehensive patterns  
      {
        patterns: [
          'personal email', 'private email', 'personal account', 'my personal', 'home email',
          'private account', 'personal mail', 'private mail', 'home mail', 'personal address',
          'private address', 'home address', 'individual email', 'own email', 'my own',
          'private personal', 'personal stuff'
        ],
        category: 'personal'
      },
      // School/education email - comprehensive patterns
      {
        patterns: [
          'school email', 'university email', 'edu email', 'student email', 'academic email',
          'college email', 'school account', 'university account', 'student account',
          'academic account', 'education email', 'educational email', 'campus email',
          'school mail', 'university mail', 'student mail', 'academic mail'
        ],
        category: 'education'
      },
      // Client/customer email - new category
      {
        patterns: [
          'client email', 'customer email', 'client account', 'customer account',
          'client mail', 'customer mail', 'client address', 'customer address'
        ],
        category: 'client'
      },
      // Main/primary email - new category
      {
        patterns: [
          'main email', 'primary email', 'main account', 'primary account',
          'default email', 'usual email', 'regular email', 'normal email',
          'primary mail', 'main mail', 'default mail'
        ],
        category: 'primary'
      }
    ];

    for (const { patterns, category } of categoryPatterns) {
      for (const pattern of patterns) {
        if (normalizedText.includes(pattern)) {
          return {
            type: 'category',
            value: category,
            confidence: 0.7
          };
        }
      }
    }

    // 4. Domain-based hints (medium confidence) - expanded patterns
    const domainPatterns = [
      /using.*my\s+(\w+)\s+account/i,
      /from.*my\s+(\w+)\s+email/i,
      /using.*my\s+(\w+)/i,
      /my\s+(\w+)\s+email/i,
      /my\s+(\w+)\s+account/i,
      /via\s+(\w+)/i,
      /through\s+(\w+)/i,
      /with\s+my\s+(\w+)/i,
      /send\s+with\s+(\w+)/i,
      /use\s+(\w+)\s+to\s+send/i,
      /(\w+)\s+email\s+account/i,
      /(\w+)\s+mail\s+account/i,
      /send\s+via\s+(\w+)/i,
      /send\s+through\s+(\w+)/i,
      /from\s+(\w+)\s+please/i,
      /using\s+(\w+)\s+please/i
    ];

    for (const pattern of domainPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const domain = match[1].toLowerCase();
        // Map common domains to providers
        if (['gmail', 'google'].includes(domain)) {
          return {
            type: 'provider',
            value: 'GOOGLE_WORKSPACE',
            confidence: 0.75
          };
        }
        if (['outlook', 'hotmail', 'microsoft'].includes(domain)) {
          return {
            type: 'provider',
            value: 'MICROSOFT_365',
            confidence: 0.75
          };
        }
        if (['zoho'].includes(domain)) {
          return {
            type: 'provider',
            value: 'ZOHO',
            confidence: 0.75
          };
        }
        // Generic domain hint
        return {
          type: 'domain',
          value: domain,
          confidence: 0.6
        };
      }
    }

    // 5. "From" keyword patterns (lower confidence) - expanded patterns
    const fromPatterns = [
      /from\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /using\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /use\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /send\s+from\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /my\s+([\w\s]+?)\s+email\s+account/i,
      /my\s+(work|personal|business|main|primary|default)\s+email/i,
      /with\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /via\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /through\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /send\s+with\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /please\s+use\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /make\s+sure\s+to\s+use\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /i\s+want\s+to\s+use\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /send\s+it\s+from\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i,
      /can\s+you\s+use\s+my\s+([\w\s]+?)(?:\s+account|\s+email|$)/i
    ];

    for (const pattern of fromPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const preference = match[1].trim().toLowerCase();

        // Check if it matches known categories
        if (['personal', 'private', 'home'].some(cat => preference.includes(cat))) {
          return {
            type: 'category',
            value: 'personal',
            confidence: 0.65
          };
        }
        if (['work', 'business', 'office', 'company', 'corporate'].some(cat => preference.includes(cat))) {
          return {
            type: 'category',
            value: 'work',
            confidence: 0.65
          };
        }

        // Generic preference
        return {
          type: 'category',
          value: preference,
          confidence: 0.5
        };
      }
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

  /**
   * Validate LLM-extracted time against chrono-node for additional confidence
   */
  private validateTimeWithChrono(text: string, llmExtractedTime: Date): {
    matches: boolean;
    chronoTime?: Date;
    timeDifferenceMinutes?: number;
    confidence: 'high' | 'medium' | 'low';
  } {
    try {
      const parsed = parse(text);
      if (parsed.length === 0) {
        return { matches: false, confidence: 'low' };
      }

      const chronoTime = parsed[0].start.date();
      const timeDifferenceMs = Math.abs(llmExtractedTime.getTime() - chronoTime.getTime());
      const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);

      // Consider times "matching" if they're within reasonable tolerance
      let matches = false;
      let confidence: 'high' | 'medium' | 'low' = 'low';

      if (timeDifferenceMinutes <= 1) {
        // Within 1 minute - exact match
        matches = true;
        confidence = 'high';
      } else if (timeDifferenceMinutes <= 60) {
        // Within 1 hour - good match (could be rounding differences)
        matches = true;
        confidence = 'medium';
      } else if (timeDifferenceMinutes <= 1440) {
        // Within 1 day - possible match (could be timezone or day boundary issues)
        matches = true;
        confidence = 'low';
      }

      return {
        matches,
        chronoTime,
        timeDifferenceMinutes,
        confidence
      };
    } catch (error) {
      return { matches: false, confidence: 'low' };
    }
  }
}

// Export singleton instance
export const workspaceNLPProcessor = new WorkspaceNLPProcessor();

/**
 * Convenience function for parsing workspace commands
 */
export async function parseWorkspaceCommand(text: string): Promise<WorkspaceCommand | null> {
  const processor = new WorkspaceNLPProcessor();
  return await processor.parseCommand(text);
} 