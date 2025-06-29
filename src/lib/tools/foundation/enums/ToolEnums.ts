/**
 * Unified Tool Foundation - Enum Definitions
 * 
 * Centralized enums for tool categories, capabilities, and status values
 * to ensure consistency across all specialized tool systems.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Centralized constants (no string literals)
 * - Strict typing throughout
 * - Comprehensive coverage of all tool systems
 */

/**
 * Tool categories for organizing tools by domain
 */
export enum ToolCategory {
  // Core system tools
  CORE = 'core',

  // Workspace tools
  WORKSPACE = 'workspace',
  EMAIL = 'email',
  CALENDAR = 'calendar',
  SPREADSHEET = 'spreadsheet',
  FILE = 'file',

  // Social media tools
  SOCIAL_MEDIA = 'social_media',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  FACEBOOK = 'facebook',
  INSTAGRAM = 'instagram',
  TIKTOK = 'tiktok',

  // Web scraping and data tools
  WEB_SCRAPING = 'web_scraping',
  APIFY = 'apify',
  DATA_EXTRACTION = 'data_extraction',

  // Workflow and automation tools
  WORKFLOW = 'workflow',
  N8N = 'n8n',
  ZAPIER = 'zapier',
  AUTOMATION = 'automation',

  // AI and LLM tools
  AI = 'ai',
  LLM = 'llm',
  THINKING = 'thinking',
  REASONING = 'reasoning',

  // Agent management tools
  AGENT = 'agent',
  MANAGEMENT = 'management',
  MONITORING = 'monitoring',

  // Approval and workflow tools
  APPROVAL = 'approval',
  WORKFLOW_APPROVAL = 'workflow_approval',

  // Cost and analytics tools
  COST_TRACKING = 'cost_tracking',
  ANALYTICS = 'analytics',
  METRICS = 'metrics',

  // Utility tools
  UTILITY = 'utility',
  FORMATTING = 'formatting',
  VALIDATION = 'validation',

  // Integration tools
  INTEGRATION = 'integration',
  API = 'api',
  WEBHOOK = 'webhook',

  // New categories
  COMMUNICATION = 'communication',
  DATA_PROCESSING = 'data_processing',
  FILE_MANAGEMENT = 'file_management',
  SCHEDULING = 'scheduling',
  CONTENT_CREATION = 'content_creation',
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  SECURITY = 'security'
}

/**
 * Tool capabilities for fine-grained tool classification
 */
export enum ToolCapability {
  // Email capabilities
  EMAIL_SEND = 'email_send',
  EMAIL_READ = 'email_read',
  EMAIL_SEARCH = 'email_search',
  EMAIL_ANALYZE = 'email_analyze',
  EMAIL_REPLY = 'email_reply',
  EMAIL_FORWARD = 'email_forward',

  // Calendar capabilities
  CALENDAR_READ = 'calendar_read',
  CALENDAR_CREATE = 'calendar_create',
  CALENDAR_UPDATE = 'calendar_update',
  CALENDAR_DELETE = 'calendar_delete',
  CALENDAR_FIND_AVAILABILITY = 'calendar_find_availability',

  // Spreadsheet capabilities
  SPREADSHEET_READ = 'spreadsheet_read',
  SPREADSHEET_WRITE = 'spreadsheet_write',
  SPREADSHEET_ANALYZE = 'spreadsheet_analyze',
  SPREADSHEET_CREATE = 'spreadsheet_create',

  // File capabilities
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  FILE_SEARCH = 'file_search',
  FILE_SHARE = 'file_share',
  FILE_DELETE = 'file_delete',

  // Social media capabilities
  SOCIAL_POST = 'social_post',
  SOCIAL_READ = 'social_read',
  SOCIAL_ANALYZE = 'social_analyze',
  SOCIAL_ENGAGE = 'social_engage',
  SOCIAL_SCHEDULE = 'social_schedule',

  // Web scraping capabilities
  WEB_SCRAPE = 'web_scrape',
  DATA_EXTRACT = 'data_extract',
  CONTENT_PARSE = 'content_parse',
  DYNAMIC_SCRAPE = 'dynamic_scrape',

  // Workflow capabilities
  WORKFLOW_EXECUTE = 'workflow_execute',
  WORKFLOW_CREATE = 'workflow_create',
  WORKFLOW_MONITOR = 'workflow_monitor',
  WORKFLOW_TRIGGER = 'workflow_trigger',

  // AI and LLM capabilities
  LLM_CHAT = 'llm_chat',
  LLM_ANALYZE = 'llm_analyze',
  LLM_GENERATE = 'llm_generate',
  LLM_REASON = 'llm_reason',
  LLM_SUMMARIZE = 'llm_summarize',

  // Agent capabilities
  AGENT_MANAGE = 'agent_manage',
  AGENT_MONITOR = 'agent_monitor',
  AGENT_COORDINATE = 'agent_coordinate',

  // Approval capabilities
  APPROVAL_REQUEST = 'approval_request',
  APPROVAL_PROCESS = 'approval_process',
  APPROVAL_NOTIFY = 'approval_notify',

  // Cost and analytics capabilities
  COST_TRACK = 'cost_track',
  METRICS_COLLECT = 'metrics_collect',
  ANALYTICS_GENERATE = 'analytics_generate',

  // Utility capabilities
  TEXT_PROCESS = 'text_process',
  DATA_VALIDATE = 'data_validate',
  FORMAT_CONVERT = 'format_convert',

  // Integration capabilities
  API_CALL = 'api_call',
  WEBHOOK_HANDLE = 'webhook_handle',
  DATA_SYNC = 'data_sync',

  // New capabilities
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  SCHEDULE = 'schedule',
  MONITOR = 'monitor',
  INTEGRATE = 'integrate',
  TRANSFORM = 'transform',
  VALIDATE = 'validate',
  BACKUP = 'backup',
  RESTORE = 'restore',
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  COMPRESS = 'compress',
  DECOMPRESS = 'decompress',
  FILTER = 'filter',
  SORT = 'sort',
  MERGE = 'merge',
  SPLIT = 'split',
  CONVERT = 'convert',
  CONTENT_CREATION = 'content_creation',
  SCHEDULING = 'scheduling',
  ANALYTICS = 'analytics',
  MEDIA_PROCESSING = 'media_processing',
  WORKFLOW_MANAGEMENT = 'workflow_management',
  MULTI_PLATFORM = 'multi_platform',
  SOCIAL_MEDIA_INTEGRATION = 'social_media_integration',
  CALENDAR_MANAGEMENT = 'calendar_management',
  DATA_PROCESSING = 'data_processing',
  FILE_MANAGEMENT = 'file_management',
  WORKSPACE_INTEGRATION = 'workspace_integration'
}

/**
 * Tool status for lifecycle management
 */
export enum ToolStatus {
  // Active states
  ACTIVE = 'active',
  ENABLED = 'enabled',
  READY = 'ready',

  // Inactive states
  DISABLED = 'disabled',
  DEPRECATED = 'deprecated',
  MAINTENANCE = 'maintenance',

  // Error states
  ERROR = 'error',
  FAILED = 'failed',
  UNAVAILABLE = 'unavailable',

  // Development states
  DRAFT = 'draft',
  TESTING = 'testing',
  BETA = 'beta',

  // Unknown state
  UNKNOWN = 'unknown',

  // New states
  AVAILABLE = 'available',
  NOT_FOUND = 'not_found',
  PENDING = 'pending'
}

/**
 * Tool execution priority levels
 */
export enum ToolPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Tool access levels for security
 */
export enum ToolAccessLevel {
  PUBLIC = 'public',
  PRIVATE = 'private',
  RESTRICTED = 'restricted',
  ADMIN_ONLY = 'admin_only'
}

/**
 * Tool execution modes
 */
export enum ToolExecutionMode {
  SYNCHRONOUS = 'synchronous',
  ASYNCHRONOUS = 'asynchronous',
  BACKGROUND = 'background',
  SCHEDULED = 'scheduled'
}

/**
 * Tool discovery methods
 */
export enum ToolDiscoveryMethod {
  EXACT_MATCH = 'exact_match',
  FUZZY_MATCH = 'fuzzy_match',
  SEMANTIC_SEARCH = 'semantic_search',
  CAPABILITY_MATCH = 'capability_match',
  CATEGORY_MATCH = 'category_match'
} 