/**
 * Tool Name Constants
 * 
 * Centralized constants for all tool names to avoid string literals
 * and ensure consistency across the system.
 */

// Email Tools
export const EMAIL_TOOL_NAMES = {
  SEND_EMAIL: 'send_email',
  SMART_SEND_EMAIL: 'smart_send_email',
  READ_SPECIFIC_EMAIL: 'read_specific_email',
  FIND_IMPORTANT_EMAILS: 'find_important_emails',
  SEARCH_EMAILS: 'search_emails',
  ANALYZE_EMAILS: 'analyze_emails',
  GET_EMAILS_NEEDING_ATTENTION: 'get_emails_needing_attention',
  GET_EMAIL_ACTION_ITEMS: 'get_email_action_items',
  GET_EMAIL_TRENDS: 'get_email_trends',
  REPLY_TO_EMAIL: 'reply_to_email',
  FORWARD_EMAIL: 'forward_email',
} as const;

// Calendar Tools
export const CALENDAR_TOOL_NAMES = {
  READ_CALENDAR: 'read_calendar',
  FIND_AVAILABILITY: 'find_availability',
  SUMMARIZE_DAY: 'summarize_day',
  FIND_EVENTS: 'find_events',
  SCHEDULE_EVENT: 'schedule_event',
  EDIT_EVENT: 'edit_event',
  DELETE_EVENT: 'delete_event',
} as const;

// Spreadsheet Tools
export const SPREADSHEET_TOOL_NAMES = {
  READ_SPREADSHEET: 'read_spreadsheet',
  ANALYZE_SPREADSHEET_DATA: 'analyze_spreadsheet_data',
  CREATE_SPREADSHEET: 'create_spreadsheet',
  UPDATE_SPREADSHEET: 'update_spreadsheet',
} as const;

// File Tools
export const FILE_TOOL_NAMES = {
  SEARCH_FILES: 'search_files',
  GET_FILE: 'get_file',
  CREATE_FILE: 'create_file',
  SHARE_FILE: 'share_file',
} as const;

// Connection Tools
export const CONNECTION_TOOL_NAMES = {
  GET_AVAILABLE_WORKSPACE_CONNECTIONS: 'get_available_workspace_connections',
  GET_ALL_WORKSPACE_CONNECTIONS: 'get_all_workspace_connections',
} as const;

// Core Tools
export const CORE_TOOL_NAMES = {
  GENERAL_LLM_CAPABILITIES: 'general_llm_capabilities',
  TEXT_PROCESSING: 'text_processing',
  ANALYSIS: 'analysis',
  REASONING: 'reasoning',
  SEND_MESSAGE: 'send_message',
} as const;

// All workspace tools combined
export const ALL_WORKSPACE_TOOL_NAMES = {
  ...EMAIL_TOOL_NAMES,
  ...CALENDAR_TOOL_NAMES,
  ...SPREADSHEET_TOOL_NAMES,
  ...FILE_TOOL_NAMES,
  ...CONNECTION_TOOL_NAMES,
} as const;

// All tool names combined
export const ALL_TOOL_NAMES = {
  ...CORE_TOOL_NAMES,
  ...ALL_WORKSPACE_TOOL_NAMES,
} as const;

// Tool name arrays for easy iteration
export const EMAIL_TOOL_NAME_LIST = Object.values(EMAIL_TOOL_NAMES);
export const CALENDAR_TOOL_NAME_LIST = Object.values(CALENDAR_TOOL_NAMES);
export const SPREADSHEET_TOOL_NAME_LIST = Object.values(SPREADSHEET_TOOL_NAMES);
export const FILE_TOOL_NAME_LIST = Object.values(FILE_TOOL_NAMES);
export const CONNECTION_TOOL_NAME_LIST = Object.values(CONNECTION_TOOL_NAMES);
export const CORE_TOOL_NAME_LIST = Object.values(CORE_TOOL_NAMES);
export const ALL_WORKSPACE_TOOL_NAME_LIST = Object.values(ALL_WORKSPACE_TOOL_NAMES);
export const ALL_TOOL_NAME_LIST = Object.values(ALL_TOOL_NAMES);

// Request type constants
export const REQUEST_TYPES = {
  PURE_LLM_TASK: 'PURE_LLM_TASK',
  EXTERNAL_TOOL_TASK: 'EXTERNAL_TOOL_TASK',
  SCHEDULED_TASK: 'SCHEDULED_TASK',
} as const;

// Tool categories
export const TOOL_CATEGORIES = {
  EMAIL: 'email',
  CALENDAR: 'calendar',
  SPREADSHEET: 'spreadsheet',
  FILE: 'file',
  CONNECTION: 'connection',
  CORE: 'core',
  WORKSPACE: 'workspace',
} as const;

export type EmailToolName = typeof EMAIL_TOOL_NAMES[keyof typeof EMAIL_TOOL_NAMES];
export type CalendarToolName = typeof CALENDAR_TOOL_NAMES[keyof typeof CALENDAR_TOOL_NAMES];
export type SpreadsheetToolName = typeof SPREADSHEET_TOOL_NAMES[keyof typeof SPREADSHEET_TOOL_NAMES];
export type FileToolName = typeof FILE_TOOL_NAMES[keyof typeof FILE_TOOL_NAMES];
export type ConnectionToolName = typeof CONNECTION_TOOL_NAMES[keyof typeof CONNECTION_TOOL_NAMES];
export type CoreToolName = typeof CORE_TOOL_NAMES[keyof typeof CORE_TOOL_NAMES];
export type WorkspaceToolName = typeof ALL_WORKSPACE_TOOL_NAMES[keyof typeof ALL_WORKSPACE_TOOL_NAMES];
export type ToolName = typeof ALL_TOOL_NAMES[keyof typeof ALL_TOOL_NAMES];
export type RequestType = typeof REQUEST_TYPES[keyof typeof REQUEST_TYPES];
export type ToolCategory = typeof TOOL_CATEGORIES[keyof typeof TOOL_CATEGORIES]; 