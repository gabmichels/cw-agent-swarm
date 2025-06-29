/**
 * Tool Constants
 * 
 * Centralized constants for tool identification and management
 * following @IMPLEMENTATION_GUIDELINES.md principles of eliminating
 * string literals throughout the codebase.
 */

// Workspace Tool Constants
export const WORKSPACE_TOOLS = {
  // Email Tools
  GMAIL_SEND_EMAIL: 'gmail_send_email',
  GMAIL_READ_EMAIL: 'gmail_read_email',
  GMAIL_SEARCH_EMAIL: 'gmail_search_email',
  GMAIL_DELETE_EMAIL: 'gmail_delete_email',
  OUTLOOK_SEND_EMAIL: 'outlook_send_email',
  OUTLOOK_READ_EMAIL: 'outlook_read_email',

  // Calendar Tools
  GOOGLE_CALENDAR_CREATE_EVENT: 'google_calendar_create_event',
  GOOGLE_CALENDAR_READ_EVENT: 'google_calendar_read_event',
  GOOGLE_CALENDAR_UPDATE_EVENT: 'google_calendar_update_event',
  GOOGLE_CALENDAR_DELETE_EVENT: 'google_calendar_delete_event',
  OUTLOOK_CALENDAR_CREATE_EVENT: 'outlook_calendar_create_event',
  OUTLOOK_CALENDAR_READ_EVENT: 'outlook_calendar_read_event',

  // File Management Tools
  GOOGLE_DRIVE_UPLOAD_FILE: 'google_drive_upload_file',
  GOOGLE_DRIVE_DOWNLOAD_FILE: 'google_drive_download_file',
  GOOGLE_DRIVE_LIST_FILES: 'google_drive_list_files',
  GOOGLE_DRIVE_DELETE_FILE: 'google_drive_delete_file',
  ONEDRIVE_UPLOAD_FILE: 'onedrive_upload_file',
  ONEDRIVE_DOWNLOAD_FILE: 'onedrive_download_file',

  // Spreadsheet Tools
  GOOGLE_SHEETS_CREATE_SHEET: 'google_sheets_create_sheet',
  GOOGLE_SHEETS_READ_SHEET: 'google_sheets_read_sheet',
  GOOGLE_SHEETS_UPDATE_SHEET: 'google_sheets_update_sheet',
  GOOGLE_SHEETS_DELETE_SHEET: 'google_sheets_delete_sheet',
  EXCEL_CREATE_WORKBOOK: 'excel_create_workbook',
  EXCEL_READ_WORKBOOK: 'excel_read_workbook',

  // Connection Management
  WORKSPACE_CONNECT: 'workspace_connect',
  WORKSPACE_DISCONNECT: 'workspace_disconnect',
  WORKSPACE_STATUS: 'workspace_status'
} as const;

// Email Tool Names (for backward compatibility)
export const EMAIL_TOOL_NAMES = {
  GMAIL_SEND_EMAIL: 'gmail_send_email',
  GMAIL_READ_EMAIL: 'gmail_read_email',
  GMAIL_SEARCH_EMAIL: 'gmail_search_email',
  GMAIL_DELETE_EMAIL: 'gmail_delete_email',
  OUTLOOK_SEND_EMAIL: 'outlook_send_email',
  OUTLOOK_READ_EMAIL: 'outlook_read_email',
  SEND_EMAIL: 'send_email',
  READ_EMAIL: 'read_email',
  REPLY_EMAIL: 'reply_email',
  FORWARD_EMAIL: 'forward_email',
  SEARCH_EMAIL: 'search_email'
} as const;

// Calendar Tool Names
export const CALENDAR_TOOL_NAMES = {
  GOOGLE_CALENDAR_CREATE_EVENT: 'google_calendar_create_event',
  GOOGLE_CALENDAR_READ_EVENT: 'google_calendar_read_event',
  GOOGLE_CALENDAR_UPDATE_EVENT: 'google_calendar_update_event',
  GOOGLE_CALENDAR_DELETE_EVENT: 'google_calendar_delete_event',
  OUTLOOK_CALENDAR_CREATE_EVENT: 'outlook_calendar_create_event',
  OUTLOOK_CALENDAR_READ_EVENT: 'outlook_calendar_read_event',
  CREATE_EVENT: 'create_event',
  UPDATE_EVENT: 'update_event',
  DELETE_EVENT: 'delete_event',
  LIST_EVENTS: 'list_events',
  FIND_AVAILABLE_TIME: 'find_available_time'
} as const;

// Spreadsheet Tool Names
export const SPREADSHEET_TOOL_NAMES = {
  GOOGLE_SHEETS_CREATE_SHEET: 'google_sheets_create_sheet',
  GOOGLE_SHEETS_READ_SHEET: 'google_sheets_read_sheet',
  GOOGLE_SHEETS_UPDATE_SHEET: 'google_sheets_update_sheet',
  GOOGLE_SHEETS_DELETE_SHEET: 'google_sheets_delete_sheet',
  EXCEL_CREATE_WORKBOOK: 'excel_create_workbook',
  EXCEL_READ_WORKBOOK: 'excel_read_workbook',
  READ_SPREADSHEET: 'read_spreadsheet',
  WRITE_SPREADSHEET: 'write_spreadsheet',
  CREATE_SPREADSHEET: 'create_spreadsheet',
  UPDATE_SPREADSHEET: 'update_spreadsheet'
} as const;

// File Tool Names
export const FILE_TOOL_NAMES = {
  GOOGLE_DRIVE_UPLOAD_FILE: 'google_drive_upload_file',
  GOOGLE_DRIVE_DOWNLOAD_FILE: 'google_drive_download_file',
  GOOGLE_DRIVE_LIST_FILES: 'google_drive_list_files',
  GOOGLE_DRIVE_DELETE_FILE: 'google_drive_delete_file',
  ONEDRIVE_UPLOAD_FILE: 'onedrive_upload_file',
  ONEDRIVE_DOWNLOAD_FILE: 'onedrive_download_file',
  UPLOAD_FILE: 'upload_file',
  DOWNLOAD_FILE: 'download_file',
  LIST_FILES: 'list_files',
  DELETE_FILE: 'delete_file',
  SHARE_FILE: 'share_file'
} as const;

// Connection Tool Names
export const CONNECTION_TOOL_NAMES = {
  WORKSPACE_CONNECT: 'workspace_connect',
  WORKSPACE_DISCONNECT: 'workspace_disconnect',
  WORKSPACE_STATUS: 'workspace_status',
  CONNECT_WORKSPACE: 'connect_workspace',
  DISCONNECT_WORKSPACE: 'disconnect_workspace',
  LIST_CONNECTIONS: 'list_connections',
  TEST_CONNECTION: 'test_connection'
} as const;

// Social Media Tool Constants
export const SOCIAL_MEDIA_TOOLS = {
  // Twitter/X Tools
  TWITTER_POST_TWEET: 'twitter_post_tweet',
  TWITTER_READ_TWEET: 'twitter_read_tweet',
  TWITTER_DELETE_TWEET: 'twitter_delete_tweet',
  TWITTER_SCHEDULE_TWEET: 'twitter_schedule_tweet',

  // LinkedIn Tools
  LINKEDIN_POST_UPDATE: 'linkedin_post_update',
  LINKEDIN_READ_UPDATE: 'linkedin_read_update',
  LINKEDIN_DELETE_UPDATE: 'linkedin_delete_update',
  LINKEDIN_SCHEDULE_UPDATE: 'linkedin_schedule_update',

  // Instagram Tools
  INSTAGRAM_POST_PHOTO: 'instagram_post_photo',
  INSTAGRAM_POST_STORY: 'instagram_post_story',
  INSTAGRAM_READ_POST: 'instagram_read_post',

  // Facebook Tools
  FACEBOOK_POST_UPDATE: 'facebook_post_update',
  FACEBOOK_READ_UPDATE: 'facebook_read_update',
  FACEBOOK_DELETE_UPDATE: 'facebook_delete_update',

  // Analytics Tools
  SOCIAL_MEDIA_ANALYTICS: 'social_media_analytics',
  ENGAGEMENT_METRICS: 'engagement_metrics',

  // Content Management
  CONTENT_SCHEDULER: 'content_scheduler',
  CONTENT_CREATOR: 'content_creator',
  HASHTAG_GENERATOR: 'hashtag_generator'
} as const;

// Tool Category Mappings
export const TOOL_CATEGORY_MAPPINGS = {
  email: 'communication',
  calendar: 'scheduling',
  spreadsheet: 'data_processing',
  file: 'file_management',
  connection: 'workspace_integration',
  twitter: 'content_creation',
  linkedin: 'content_creation',
  instagram: 'content_creation',
  facebook: 'content_creation',
  analytics: 'analytics',
  content: 'content_creation'
} as const;

// Tool Capability Mappings
export const TOOL_CAPABILITY_MAPPINGS = {
  email: ['COMMUNICATION', 'READ', 'WRITE'],
  calendar: ['CALENDAR_MANAGEMENT', 'SCHEDULING', 'READ', 'WRITE'],
  spreadsheet: ['DATA_PROCESSING', 'READ', 'WRITE', 'TRANSFORM'],
  file: ['FILE_MANAGEMENT', 'READ', 'WRITE', 'BACKUP'],
  connection: ['WORKSPACE_INTEGRATION', 'INTEGRATE'],
  social: ['SOCIAL_MEDIA_INTEGRATION', 'CONTENT_CREATION', 'SCHEDULING'],
  analytics: ['ANALYTICS', 'DATA_PROCESSING', 'MONITOR']
} as const;

// All Tool Constants (combined)
export const ALL_TOOL_CONSTANTS = {
  ...WORKSPACE_TOOLS,
  ...SOCIAL_MEDIA_TOOLS
} as const;

// Tool Constant Arrays for iteration
export const WORKSPACE_TOOL_NAMES = Object.values(WORKSPACE_TOOLS);
export const SOCIAL_MEDIA_TOOL_NAMES = Object.values(SOCIAL_MEDIA_TOOLS);
export const ALL_TOOL_NAMES = Object.values(ALL_TOOL_CONSTANTS); 