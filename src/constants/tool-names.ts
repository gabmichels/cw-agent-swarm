/**
 * Tool Name Constants
 * 
 * Centralized constants for all tool names to avoid string literals
 * and ensure consistency across the system.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - NO string literals in tool systems
 * - Comprehensive coverage of all 17+ tool systems
 * - Organized by tool categories
 * - Used by unified foundation
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

// Social Media Tools
export const SOCIAL_MEDIA_TOOL_NAMES = {
  // Content Creation
  CREATE_TEXT_POST: 'create_text_post',
  CREATE_IMAGE_POST: 'create_image_post',
  CREATE_VIDEO_POST: 'create_video_post',
  CREATE_TIKTOK_VIDEO: 'create_tiktok_video',
  SCHEDULE_SOCIAL_POST: 'schedule_social_post',
  SCHEDULE_POST: 'schedule_post',

  // Analytics and Metrics
  GET_SOCIAL_MEDIA_ANALYTICS: 'get_social_media_analytics',
  GET_ENGAGEMENT_METRICS: 'get_engagement_metrics',
  GET_POST_METRICS: 'get_post_metrics',
  GET_ACCOUNT_ANALYTICS: 'get_account_analytics',
  ANALYZE_POST_PERFORMANCE: 'analyze_post_performance',
  GET_AUDIENCE_INSIGHTS: 'get_audience_insights',

  // Content Management
  MANAGE_COMMENTS: 'manage_comments',
  MODERATE_CONTENT: 'moderate_content',
  HANDLE_MENTIONS: 'handle_mentions',
  LIKE_POST: 'like_post',

  // Cross-Platform
  CROSS_PLATFORM_POST: 'cross_platform_post',
  PLATFORM_SPECIFIC_FORMATTING: 'platform_specific_formatting',

  // Approval System
  SOCIAL_MEDIA_APPROVAL: 'social_media_approval',
  REQUEST_APPROVAL: 'request_approval',
  APPROVE_CONTENT: 'approve_content',

  // TikTok Specific
  TIKTOK_VIDEO_CREATE: 'tiktok_video_create',
  TIKTOK_ANALYTICS_READ: 'tiktok_analytics_read',

  // Additional Tools
  OPTIMIZE_CONTENT: 'optimize_content',
  ANALYZE_CONTENT: 'analyze_content',
  GET_TRENDING_HASHTAGS: 'get_trending_hashtags',
  DELETE_POST: 'delete_post',
  GET_CONNECTIONS: 'get_connections',
} as const;

// Apify Tools
export const APIFY_TOOL_NAMES = {
  // Core Apify Tools
  APIFY_ACTOR_DISCOVERY: 'apify-actor-discovery',
  APIFY_SUGGEST_ACTORS: 'apify-suggest-actors',
  APIFY_DYNAMIC_RUN: 'apify-dynamic-run',
  APIFY_ACTOR_INFO: 'apify-actor-info',

  // Instagram Tools
  INSTAGRAM_POST_SCRAPER: 'instagram-post-scraper',
  INSTAGRAM_HASHTAG_SCRAPER: 'instagram-hashtag-scraper',
  INSTAGRAM_PROFILE_SCRAPER: 'instagram-profile-scraper',

  // Facebook Tools
  FACEBOOK_POSTS_SCRAPER: 'facebook-posts-scraper',
  FACEBOOK_PAGES_SCRAPER: 'facebook-pages-scraper',

  // YouTube Tools
  YOUTUBE_CHANNEL_SCRAPER: 'youtube-channel-scraper',
  YOUTUBE_VIDEO_SCRAPER: 'youtube-video-scraper',

  // LinkedIn Tools
  LINKEDIN_COMPANY_SCRAPER: 'linkedin-company-scraper',
  LINKEDIN_PROFILE_SCRAPER: 'linkedin-profile-scraper',
  LINKEDIN_JOBS_SCRAPER: 'linkedin-jobs-scraper',

  // Twitter Tools
  APIFY_TWITTER_SEARCH: 'apify-twitter-search',
  TWITTER_SCRAPER: 'twitter-scraper',

  // Reddit Tools
  APIFY_REDDIT_SEARCH: 'apify-reddit-search',
  REDDIT_SCRAPER: 'reddit-scraper',

  // Web Scraping Tools
  APIFY_WEBSITE_CRAWLER: 'apify-website-crawler',
  WEB_SCRAPER: 'web-scraper',
  CONTENT_EXTRACTOR: 'content-extractor',
} as const;

// Thinking System Tools
export const THINKING_TOOL_NAMES = {
  // Core Thinking Tools
  WEB_SEARCH: 'web_search',
  SEMANTIC_SEARCH: 'semantic_search',
  CONTENT_ANALYSIS: 'content_analysis',
  REASONING_ENGINE: 'reasoning_engine',
  WORKFLOW_ORCHESTRATION: 'workflow_orchestration',
  TOOL_RECOMMENDATION: 'tool_recommendation',
  CONTEXT_ANALYSIS: 'context_analysis',
  DECISION_TREE: 'decision_tree',

  // LLM Integration
  LLM_CHAT: 'llm_chat',
  LLM_COMPLETION: 'llm_completion',
  LLM_ANALYSIS: 'llm_analysis',
  LLM_SUMMARIZATION: 'llm_summarization',

  // Workflow Tools
  WORKFLOW_EXECUTE: 'workflow_execute',
  WORKFLOW_CREATE: 'workflow_create',
  WORKFLOW_MONITOR: 'workflow_monitor',
} as const;

// External Workflow Tools
export const EXTERNAL_WORKFLOW_TOOL_NAMES = {
  // N8n Tools
  N8N_WORKFLOW_EXECUTE: 'n8n_workflow_execute',
  N8N_WORKFLOW_CREATE: 'n8n_workflow_create',
  N8N_WORKFLOW_LIST: 'n8n_workflow_list',
  N8N_WORKFLOW_STATUS: 'n8n_workflow_status',

  // Zapier Tools
  ZAPIER_ZAP_TRIGGER: 'zapier_zap_trigger',
  ZAPIER_ZAP_CREATE: 'zapier_zap_create',
  ZAPIER_ZAP_LIST: 'zapier_zap_list',
  ZAPIER_ZAP_STATUS: 'zapier_zap_status',

  // Generic Workflow Tools
  WORKFLOW_INTEGRATION: 'workflow_integration',
  WEBHOOK_TRIGGER: 'webhook_trigger',
  API_CALL: 'api_call',
  DATA_TRANSFORM: 'data_transform',
} as const;

// Agent Management Tools
export const AGENT_TOOL_NAMES = {
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

  // Tool Management
  REGISTER_TOOL: 'register_tool',
  UNREGISTER_TOOL: 'unregister_tool',
  LIST_TOOLS: 'list_tools',
  EXECUTE_TOOL: 'execute_tool',
} as const;

// Approval System Tools
export const APPROVAL_TOOL_NAMES = {
  // Workspace Approval
  REQUEST_WORKSPACE_APPROVAL: 'request_workspace_approval',
  APPROVE_WORKSPACE_ACTION: 'approve_workspace_action',
  REJECT_WORKSPACE_ACTION: 'reject_workspace_action',
  GET_PENDING_APPROVALS: 'get_pending_approvals',

  // Social Media Approval
  REQUEST_SOCIAL_APPROVAL: 'request_social_approval',
  APPROVE_SOCIAL_CONTENT: 'approve_social_content',
  REJECT_SOCIAL_CONTENT: 'reject_social_content',

  // General Approval
  CREATE_APPROVAL_REQUEST: 'create_approval_request',
  PROCESS_APPROVAL: 'process_approval',
  GET_APPROVAL_STATUS: 'get_approval_status',
  NOTIFY_APPROVAL_DECISION: 'notify_approval_decision',
} as const;

// Cost Tracking Tools
export const COST_TRACKING_TOOL_NAMES = {
  // Cost Monitoring
  TRACK_API_COST: 'track_api_cost',
  GET_COST_SUMMARY: 'get_cost_summary',
  ANALYZE_COST_TRENDS: 'analyze_cost_trends',
  SET_COST_LIMITS: 'set_cost_limits',

  // Provider Costs
  TRACK_LLM_COST: 'track_llm_cost',
  TRACK_APIFY_COST: 'track_apify_cost',
  TRACK_SOCIAL_MEDIA_COST: 'track_social_media_cost',
  TRACK_WORKSPACE_COST: 'track_workspace_cost',

  // Cost Optimization
  OPTIMIZE_COSTS: 'optimize_costs',
  SUGGEST_COST_SAVINGS: 'suggest_cost_savings',
  GENERATE_COST_REPORT: 'generate_cost_report',
} as const;

// Tool Response Formatter Tools
export const FORMATTER_TOOL_NAMES = {
  // Response Formatting
  FORMAT_TOOL_RESPONSE: 'format_tool_response',
  FORMAT_ERROR_RESPONSE: 'format_error_response',
  FORMAT_SUCCESS_RESPONSE: 'format_success_response',

  // Template Management
  GET_RESPONSE_TEMPLATE: 'get_response_template',
  CREATE_RESPONSE_TEMPLATE: 'create_response_template',
  UPDATE_RESPONSE_TEMPLATE: 'update_response_template',

  // Context-Aware Formatting
  FORMAT_WITH_CONTEXT: 'format_with_context',
  ADAPT_RESPONSE_STYLE: 'adapt_response_style',
  PERSONALIZE_RESPONSE: 'personalize_response',
} as const;

// Core Tools
export const CORE_TOOL_NAMES = {
  GENERAL_LLM_CAPABILITIES: 'general_llm_capabilities',
  TEXT_PROCESSING: 'text_processing',
  ANALYSIS: 'analysis',
  REASONING: 'reasoning',
  SEND_MESSAGE: 'send_message',

  // Foundation Tools
  TOOL_DISCOVERY: 'tool_discovery',
  TOOL_VALIDATION: 'tool_validation',
  TOOL_EXECUTION: 'tool_execution',
  TOOL_HEALTH_CHECK: 'tool_health_check',
  TOOL_METRICS: 'tool_metrics',
} as const;

// All workspace tools combined
export const ALL_WORKSPACE_TOOL_NAMES = {
  ...EMAIL_TOOL_NAMES,
  ...CALENDAR_TOOL_NAMES,
  ...SPREADSHEET_TOOL_NAMES,
  ...FILE_TOOL_NAMES,
  ...CONNECTION_TOOL_NAMES,
} as const;

// All social media tools combined
export const ALL_SOCIAL_MEDIA_TOOL_NAMES = {
  ...SOCIAL_MEDIA_TOOL_NAMES,
} as const;

// All tool names combined
export const ALL_TOOL_NAMES = {
  ...CORE_TOOL_NAMES,
  ...ALL_WORKSPACE_TOOL_NAMES,
  ...ALL_SOCIAL_MEDIA_TOOL_NAMES,
  ...APIFY_TOOL_NAMES,
  ...THINKING_TOOL_NAMES,
  ...EXTERNAL_WORKFLOW_TOOL_NAMES,
  ...AGENT_TOOL_NAMES,
  ...APPROVAL_TOOL_NAMES,
  ...COST_TRACKING_TOOL_NAMES,
  ...FORMATTER_TOOL_NAMES,
} as const;

// Tool name arrays for easy iteration
export const EMAIL_TOOL_NAME_LIST = Object.values(EMAIL_TOOL_NAMES);
export const CALENDAR_TOOL_NAME_LIST = Object.values(CALENDAR_TOOL_NAMES);
export const SPREADSHEET_TOOL_NAME_LIST = Object.values(SPREADSHEET_TOOL_NAMES);
export const FILE_TOOL_NAME_LIST = Object.values(FILE_TOOL_NAMES);
export const CONNECTION_TOOL_NAME_LIST = Object.values(CONNECTION_TOOL_NAMES);
export const SOCIAL_MEDIA_TOOL_NAME_LIST = Object.values(SOCIAL_MEDIA_TOOL_NAMES);
export const APIFY_TOOL_NAME_LIST = Object.values(APIFY_TOOL_NAMES);
export const THINKING_TOOL_NAME_LIST = Object.values(THINKING_TOOL_NAMES);
export const EXTERNAL_WORKFLOW_TOOL_NAME_LIST = Object.values(EXTERNAL_WORKFLOW_TOOL_NAMES);
export const AGENT_TOOL_NAME_LIST = Object.values(AGENT_TOOL_NAMES);
export const APPROVAL_TOOL_NAME_LIST = Object.values(APPROVAL_TOOL_NAMES);
export const COST_TRACKING_TOOL_NAME_LIST = Object.values(COST_TRACKING_TOOL_NAMES);
export const FORMATTER_TOOL_NAME_LIST = Object.values(FORMATTER_TOOL_NAMES);
export const CORE_TOOL_NAME_LIST = Object.values(CORE_TOOL_NAMES);
export const ALL_WORKSPACE_TOOL_NAME_LIST = Object.values(ALL_WORKSPACE_TOOL_NAMES);
export const ALL_SOCIAL_MEDIA_TOOL_NAME_LIST = Object.values(ALL_SOCIAL_MEDIA_TOOL_NAMES);
export const ALL_TOOL_NAME_LIST = Object.values(ALL_TOOL_NAMES);

// Request type constants
export const REQUEST_TYPES = {
  PURE_LLM_TASK: 'PURE_LLM_TASK',
  EXTERNAL_TOOL_TASK: 'EXTERNAL_TOOL_TASK',
  SCHEDULED_TASK: 'SCHEDULED_TASK',
  WORKFLOW_TASK: 'WORKFLOW_TASK',
  APPROVAL_TASK: 'APPROVAL_TASK',
  CROSS_SYSTEM_TASK: 'CROSS_SYSTEM_TASK',
} as const;

// Tool categories (expanded)
export const TOOL_CATEGORIES = {
  // Core categories
  EMAIL: 'email',
  CALENDAR: 'calendar',
  SPREADSHEET: 'spreadsheet',
  FILE: 'file',
  CONNECTION: 'connection',
  CORE: 'core',
  WORKSPACE: 'workspace',

  // Social media categories
  SOCIAL_MEDIA: 'social_media',
  TWITTER: 'twitter',
  LINKEDIN: 'linkedin',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  TIKTOK: 'tiktok',

  // Web scraping categories
  WEB_SCRAPING: 'web_scraping',
  APIFY: 'apify',
  DATA_EXTRACTION: 'data_extraction',

  // Workflow categories
  WORKFLOW: 'workflow',
  N8N: 'n8n',
  ZAPIER: 'zapier',
  AUTOMATION: 'automation',

  // AI and reasoning categories
  AI: 'ai',
  LLM: 'llm',
  THINKING: 'thinking',
  REASONING: 'reasoning',

  // Agent management categories
  AGENT: 'agent',
  MANAGEMENT: 'management',
  MONITORING: 'monitoring',

  // Approval categories
  APPROVAL: 'approval',
  WORKFLOW_APPROVAL: 'workflow_approval',

  // Cost and analytics categories
  COST_TRACKING: 'cost_tracking',
  ANALYTICS: 'analytics',
  METRICS: 'metrics',

  // Utility categories
  UTILITY: 'utility',
  FORMATTING: 'formatting',
  VALIDATION: 'validation',

  // Integration categories
  INTEGRATION: 'integration',
  API: 'api',
  WEBHOOK: 'webhook',
} as const;

// Type definitions
export type EmailToolName = typeof EMAIL_TOOL_NAMES[keyof typeof EMAIL_TOOL_NAMES];
export type CalendarToolName = typeof CALENDAR_TOOL_NAMES[keyof typeof CALENDAR_TOOL_NAMES];
export type SpreadsheetToolName = typeof SPREADSHEET_TOOL_NAMES[keyof typeof SPREADSHEET_TOOL_NAMES];
export type FileToolName = typeof FILE_TOOL_NAMES[keyof typeof FILE_TOOL_NAMES];
export type ConnectionToolName = typeof CONNECTION_TOOL_NAMES[keyof typeof CONNECTION_TOOL_NAMES];
export type SocialMediaToolName = typeof SOCIAL_MEDIA_TOOL_NAMES[keyof typeof SOCIAL_MEDIA_TOOL_NAMES];
export type ApifyToolName = typeof APIFY_TOOL_NAMES[keyof typeof APIFY_TOOL_NAMES];
export type ThinkingToolName = typeof THINKING_TOOL_NAMES[keyof typeof THINKING_TOOL_NAMES];
export type ExternalWorkflowToolName = typeof EXTERNAL_WORKFLOW_TOOL_NAMES[keyof typeof EXTERNAL_WORKFLOW_TOOL_NAMES];
export type AgentToolName = typeof AGENT_TOOL_NAMES[keyof typeof AGENT_TOOL_NAMES];
export type ApprovalToolName = typeof APPROVAL_TOOL_NAMES[keyof typeof APPROVAL_TOOL_NAMES];
export type CostTrackingToolName = typeof COST_TRACKING_TOOL_NAMES[keyof typeof COST_TRACKING_TOOL_NAMES];
export type FormatterToolName = typeof FORMATTER_TOOL_NAMES[keyof typeof FORMATTER_TOOL_NAMES];
export type CoreToolName = typeof CORE_TOOL_NAMES[keyof typeof CORE_TOOL_NAMES];
export type WorkspaceToolName = typeof ALL_WORKSPACE_TOOL_NAMES[keyof typeof ALL_WORKSPACE_TOOL_NAMES];
export type AllSocialMediaToolName = typeof ALL_SOCIAL_MEDIA_TOOL_NAMES[keyof typeof ALL_SOCIAL_MEDIA_TOOL_NAMES];
export type ToolName = typeof ALL_TOOL_NAMES[keyof typeof ALL_TOOL_NAMES];
export type RequestType = typeof REQUEST_TYPES[keyof typeof REQUEST_TYPES];
export type ToolCategory = typeof TOOL_CATEGORIES[keyof typeof TOOL_CATEGORIES];

// Tool name validation helpers
export function isEmailToolName(name: string): name is EmailToolName {
  return EMAIL_TOOL_NAME_LIST.includes(name as EmailToolName);
}

export function isSocialMediaToolName(name: string): name is SocialMediaToolName {
  return SOCIAL_MEDIA_TOOL_NAME_LIST.includes(name as SocialMediaToolName);
}

export function isApifyToolName(name: string): name is ApifyToolName {
  return APIFY_TOOL_NAME_LIST.includes(name as ApifyToolName);
}

export function isValidToolName(name: string): name is ToolName {
  return ALL_TOOL_NAME_LIST.includes(name as ToolName);
}

// Tool category helpers
export function getToolCategory(toolName: string): ToolCategory | null {
  if (isEmailToolName(toolName)) return TOOL_CATEGORIES.EMAIL;
  if (EMAIL_TOOL_NAME_LIST.includes(toolName as EmailToolName)) return TOOL_CATEGORIES.EMAIL;
  if (CALENDAR_TOOL_NAME_LIST.includes(toolName as CalendarToolName)) return TOOL_CATEGORIES.CALENDAR;
  if (SPREADSHEET_TOOL_NAME_LIST.includes(toolName as SpreadsheetToolName)) return TOOL_CATEGORIES.SPREADSHEET;
  if (FILE_TOOL_NAME_LIST.includes(toolName as FileToolName)) return TOOL_CATEGORIES.FILE;
  if (CONNECTION_TOOL_NAME_LIST.includes(toolName as ConnectionToolName)) return TOOL_CATEGORIES.CONNECTION;
  if (SOCIAL_MEDIA_TOOL_NAME_LIST.includes(toolName as SocialMediaToolName)) return TOOL_CATEGORIES.SOCIAL_MEDIA;
  if (APIFY_TOOL_NAME_LIST.includes(toolName as ApifyToolName)) return TOOL_CATEGORIES.APIFY;
  if (THINKING_TOOL_NAME_LIST.includes(toolName as ThinkingToolName)) return TOOL_CATEGORIES.THINKING;
  if (EXTERNAL_WORKFLOW_TOOL_NAME_LIST.includes(toolName as ExternalWorkflowToolName)) return TOOL_CATEGORIES.WORKFLOW;
  if (AGENT_TOOL_NAME_LIST.includes(toolName as AgentToolName)) return TOOL_CATEGORIES.AGENT;
  if (APPROVAL_TOOL_NAME_LIST.includes(toolName as ApprovalToolName)) return TOOL_CATEGORIES.APPROVAL;
  if (COST_TRACKING_TOOL_NAME_LIST.includes(toolName as CostTrackingToolName)) return TOOL_CATEGORIES.COST_TRACKING;
  if (FORMATTER_TOOL_NAME_LIST.includes(toolName as FormatterToolName)) return TOOL_CATEGORIES.FORMATTING;
  if (CORE_TOOL_NAME_LIST.includes(toolName as CoreToolName)) return TOOL_CATEGORIES.CORE;

  return null;
}

// Statistics
export const TOOL_STATISTICS = {
  TOTAL_TOOLS: ALL_TOOL_NAME_LIST.length,
  EMAIL_TOOLS: EMAIL_TOOL_NAME_LIST.length,
  CALENDAR_TOOLS: CALENDAR_TOOL_NAME_LIST.length,
  SPREADSHEET_TOOLS: SPREADSHEET_TOOL_NAME_LIST.length,
  FILE_TOOLS: FILE_TOOL_NAME_LIST.length,
  CONNECTION_TOOLS: CONNECTION_TOOL_NAME_LIST.length,
  SOCIAL_MEDIA_TOOLS: SOCIAL_MEDIA_TOOL_NAME_LIST.length,
  APIFY_TOOLS: APIFY_TOOL_NAME_LIST.length,
  THINKING_TOOLS: THINKING_TOOL_NAME_LIST.length,
  EXTERNAL_WORKFLOW_TOOLS: EXTERNAL_WORKFLOW_TOOL_NAME_LIST.length,
  AGENT_TOOLS: AGENT_TOOL_NAME_LIST.length,
  APPROVAL_TOOLS: APPROVAL_TOOL_NAME_LIST.length,
  COST_TRACKING_TOOLS: COST_TRACKING_TOOL_NAME_LIST.length,
  FORMATTER_TOOLS: FORMATTER_TOOL_NAME_LIST.length,
  CORE_TOOLS: CORE_TOOL_NAME_LIST.length,
  WORKSPACE_TOOLS: ALL_WORKSPACE_TOOL_NAME_LIST.length,
} as const; 