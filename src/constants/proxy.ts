/**
 * Constants related to proxy.ts chat handling
 */

/**
 * Content patterns to identify internal messages
 */
export const INTERNAL_MESSAGE_PATTERNS = {
  // Performance review patterns
  PERFORMANCE_REVIEW: 'Performance Review:',
  SUCCESS_RATE: 'Success Rate:',
  TASK_COMPLETION: 'Task Completion:',
  USER_SATISFACTION: 'User Satisfaction:',
  
  // Reflection patterns
  REFLECTION_PREFIX: 'Reflection on',
  THOUGHT_PREFIX: 'THOUGHT:',
  THOUGHT_PREFIX_LC: 'Thought:',
  REFLECTION_PREFIX_UC: 'REFLECTION:',
  REFLECTION_PREFIX_LC: 'Reflection:',
  MESSAGE_PREFIX: 'MESSAGE:',
  
  // Timestamp pattern (often indicates internal messages)
  TIMESTAMP_PREFIX: '[20',
  
  // Other markers
  INTERNAL_REFLECTION: 'INTERNAL REFLECTION (NOT CHAT):',
  
  // Important thought patterns
  IMPORTANT_THOUGHT_PREFIX: '!IMPORTANT! THOUGHT:',
  IMPORTANT_THOUGHT_PREFIX_LC: '!important! thought:',
  IMPORTANT_THOUGHT: '!IMPORTANT!',

  // Markdown file content patterns
  MARKDOWN_HEADER_PREFIX: '# ',
  MARKDOWN_SUBHEADER_PREFIX: '## ',
  YAML_FRONTMATTER_START: '---',
};

/**
 * User roles
 */
export const USER_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  AGENT: 'agent',
  CHLOE: 'chloe',
};

/**
 * Message source types
 */
export const MESSAGE_SOURCES = {
  USER: 'user',
  SYSTEM: 'system',
  INTERNAL: 'internal',
  CHLOE: 'chloe',
};

/**
 * Internal message types that should be filtered from chat
 */
export const INTERNAL_MESSAGE_TYPES = [
  'thought',
  'reflection',
  'system',
  'tool_log',
  'memory_log',
  'performance_review',
];

/**
 * Metadata keys for message filtering
 */
export const METADATA_KEYS = {
  NOT_FOR_CHAT: 'notForChat',
  IS_INTERNAL_MESSAGE: 'isInternalMessage',
  IS_INTERNAL_REFLECTION: 'isInternalReflection',
  SUBTYPE: 'subtype',
  SOURCE: 'source',
  MESSAGE_TYPE: 'messageType',
  USER_ID: 'userId',
  ROLE: 'role',
  IMPORTANCE: 'importance',
  ATTACHMENTS: 'attachments',
  IS_FOR_CHAT: 'isForChat',
};

/**
 * UI and debugging constants
 */
export const DEBUG_CONSTANTS = {
  DEV_SHOW_INTERNAL_MESSAGES_KEY: 'DEV_SHOW_INTERNAL_MESSAGES',
  DEFAULT_USER_ID: 'gab',
}; 