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

// Agent Management Tool Constants
export const AGENT_TOOLS = {
  // Agent Registration
  REGISTER_AGENT: 'register_agent',
  UNREGISTER_AGENT: 'unregister_agent',
  UPDATE_AGENT: 'update_agent',
  GET_AGENT_INFO: 'get_agent_info',
  LIST_AGENTS: 'list_agents',

  // Agent Health
  CHECK_AGENT_HEALTH: 'check_agent_health',
  GET_AGENT_METRICS: 'get_agent_metrics',
  MONITOR_AGENT: 'monitor_agent',

  // Agent Communication
  SEND_MESSAGE_TO_AGENT: 'send_message_to_agent',
  BROADCAST_MESSAGE: 'broadcast_message',
  COORDINATE_AGENTS: 'coordinate_agents',

  // Tool Discovery
  DISCOVER_TOOLS_BY_CAPABILITY: 'discover_tools_by_capability',

  // Tool Execution
  EXECUTE_TOOL_CHAIN: 'execute_tool_chain',

  // Tool Management
  REGISTER_TOOL: 'register_tool',
  UNREGISTER_TOOL: 'unregister_tool',
  LIST_TOOLS: 'list_tools',
  EXECUTE_TOOL: 'execute_tool',

  // Agent Permissions
  GRANT_PERMISSION: 'grant_permission',
  REVOKE_PERMISSION: 'revoke_permission',
  CHECK_PERMISSION: 'check_permission',
  LIST_PERMISSIONS: 'list_permissions',

  // Agent Capabilities
  GET_AGENT_CAPABILITIES: 'get_agent_capabilities',
  ENABLE_CAPABILITY: 'enable_capability',
  DISABLE_CAPABILITY: 'disable_capability'
} as const;

// Tool Constant Arrays for iteration
export const WORKSPACE_TOOL_NAMES = Object.values(WORKSPACE_TOOLS);
export const SOCIAL_MEDIA_TOOL_NAMES = Object.values(SOCIAL_MEDIA_TOOLS);
export const AGENT_TOOL_NAMES = Object.values(AGENT_TOOLS);

// External Workflow Tool Constants
export const EXTERNAL_WORKFLOW_TOOLS = {
  // N8n Tools
  N8N_WORKFLOW_EXECUTE: 'n8n_workflow_execute',
  N8N_WORKFLOW_CREATE: 'n8n_workflow_create',
  N8N_WORKFLOW_LIST: 'n8n_workflow_list',
  N8N_WORKFLOW_STATUS: 'n8n_workflow_status',
  N8N_WORKFLOW_DELETE: 'n8n_workflow_delete',
  N8N_WORKFLOW_UPDATE: 'n8n_workflow_update',

  // Zapier Tools
  ZAPIER_ZAP_TRIGGER: 'zapier_zap_trigger',
  ZAPIER_ZAP_CREATE: 'zapier_zap_create',
  ZAPIER_ZAP_LIST: 'zapier_zap_list',
  ZAPIER_ZAP_STATUS: 'zapier_zap_status',
  ZAPIER_ZAP_DELETE: 'zapier_zap_delete',
  ZAPIER_ZAP_UPDATE: 'zapier_zap_update',

  // Generic Workflow Tools
  WORKFLOW_INTEGRATION: 'workflow_integration',
  WEBHOOK_TRIGGER: 'webhook_trigger',
  API_CALL: 'api_call',
  DATA_TRANSFORM: 'data_transform',
  WORKFLOW_ORCHESTRATE: 'workflow_orchestrate',
  WORKFLOW_MONITOR: 'workflow_monitor'
} as const;

export const EXTERNAL_WORKFLOW_TOOL_NAMES = Object.values(EXTERNAL_WORKFLOW_TOOLS);

// Cost Tracking Tool Constants
export const COST_TRACKING_TOOLS = {
  // Cost Recording Tools
  TRACK_API_COST: 'track_api_cost',
  TRACK_APIFY_COST: 'track_apify_cost',
  TRACK_OPENAI_COST: 'track_openai_cost',
  TRACK_WORKFLOW_COST: 'track_workflow_cost',
  TRACK_RESEARCH_COST: 'track_research_cost',

  // Cost Analysis Tools
  GET_COST_SUMMARY: 'get_cost_summary',
  ANALYZE_COST_TRENDS: 'analyze_cost_trends',
  GET_COST_BREAKDOWN: 'get_cost_breakdown',
  COMPARE_COSTS: 'compare_costs',

  // Cost Optimization Tools
  OPTIMIZE_COSTS: 'optimize_costs',
  GET_OPTIMIZATION_RECOMMENDATIONS: 'get_optimization_recommendations',
  ESTIMATE_COST: 'estimate_cost',
  CALCULATE_SAVINGS: 'calculate_savings',

  // Budget Management Tools
  CREATE_BUDGET: 'create_budget',
  UPDATE_BUDGET: 'update_budget',
  CHECK_BUDGET_STATUS: 'check_budget_status',
  GET_BUDGET_ALERTS: 'get_budget_alerts'
} as const;

// Tool Response Formatter Constants
export const TOOL_RESPONSE_FORMATTER_TOOLS = {
  // Response Formatting Tools
  FORMAT_TOOL_RESPONSE: 'format_tool_response',
  FORMAT_ERROR_RESPONSE: 'format_error_response',
  FORMAT_SUCCESS_RESPONSE: 'format_success_response',
  FORMAT_PARTIAL_RESPONSE: 'format_partial_response',

  // Style Adaptation Tools
  ADAPT_RESPONSE_STYLE: 'adapt_response_style',
  PERSONALIZE_RESPONSE: 'personalize_response',
  ADJUST_TONE: 'adjust_tone',
  APPLY_PERSONA: 'apply_persona',

  // Template Management Tools
  GET_RESPONSE_TEMPLATE: 'get_response_template',
  CREATE_RESPONSE_TEMPLATE: 'create_response_template',
  UPDATE_RESPONSE_TEMPLATE: 'update_response_template',
  DELETE_RESPONSE_TEMPLATE: 'delete_response_template',

  // Context-Aware Formatting Tools
  FORMAT_WITH_CONTEXT: 'format_with_context',
  ENHANCE_RESPONSE: 'enhance_response',
  VALIDATE_RESPONSE_QUALITY: 'validate_response_quality',
  GET_STYLE_RECOMMENDATIONS: 'get_style_recommendations'
} as const;

// Approval System Tool Constants
export const APPROVAL_SYSTEM_TOOLS = {
  // Approval Request Tools
  REQUEST_APPROVAL: 'request_approval',
  SUBMIT_FOR_APPROVAL: 'submit_for_approval',
  CHECK_APPROVAL_STATUS: 'check_approval_status',
  GET_APPROVAL_HISTORY: 'get_approval_history',

  // Approval Decision Tools
  APPROVE_TASK: 'approve_task',
  REJECT_TASK: 'reject_task',
  DELEGATE_APPROVAL: 'delegate_approval',
  ESCALATE_APPROVAL: 'escalate_approval',

  // Approval Configuration Tools
  CREATE_APPROVAL_RULE: 'create_approval_rule',
  UPDATE_APPROVAL_RULE: 'update_approval_rule',
  DELETE_APPROVAL_RULE: 'delete_approval_rule',
  GET_APPROVAL_RULES: 'get_approval_rules',

  // Approval Workflow Tools
  GET_PENDING_APPROVALS: 'get_pending_approvals',
  PROCESS_APPROVAL_DECISION: 'process_approval_decision',
  SEND_APPROVAL_NOTIFICATION: 'send_approval_notification',
  TRACK_APPROVAL_METRICS: 'track_approval_metrics'
} as const;

export const COST_TRACKING_TOOL_NAMES = Object.values(COST_TRACKING_TOOLS);
export const TOOL_RESPONSE_FORMATTER_TOOL_NAMES = Object.values(TOOL_RESPONSE_FORMATTER_TOOLS);
export const APPROVAL_SYSTEM_TOOL_NAMES = Object.values(APPROVAL_SYSTEM_TOOLS);

export const ALL_TOOL_NAMES = [
  ...WORKSPACE_TOOL_NAMES,
  ...SOCIAL_MEDIA_TOOL_NAMES,
  ...AGENT_TOOL_NAMES,
  ...EXTERNAL_WORKFLOW_TOOL_NAMES,
  ...COST_TRACKING_TOOL_NAMES,
  ...TOOL_RESPONSE_FORMATTER_TOOL_NAMES,
  ...APPROVAL_SYSTEM_TOOL_NAMES
]; 