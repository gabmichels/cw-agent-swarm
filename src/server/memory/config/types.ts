/**
 * Core types for memory system
 */

/**
 * Supported memory types - standardized enum for use throughout the system
 */
export enum MemoryType {
  // Base memory types
  MESSAGE = 'message',
  THOUGHT = 'thought',
  DOCUMENT = 'document',
  TASK = 'task',
  MEMORY_EDIT = 'memory_edit',
  
  // Extended types for agent capabilities
  KNOWLEDGE_GAP = 'knowledge_gap',
  KNOWLEDGE_GAP_RESOLUTION = 'knowledge_gap_resolution',
  TASK_COMPLETION = 'task_completion',
  TOOL_FAILURE = 'tool_failure', 
  TOOL_FALLBACK = 'tool_fallback',
  REFLECTION = 'reflection',
  CORRECTION = 'correction',
  CORRECTION_DETAIL = 'correction_detail',
  INSIGHT = 'insight',
  SCHEDULED_TASK_RESULT = 'scheduled_task_result',
  MAINTENANCE_LOG = 'maintenance_log',
  KNOWLEDGE_INSIGHT = 'knowledge_insight',
  ERROR_LOG = 'error_log',
  DAILY_CYCLE_LOG = 'daily_cycle_log',
  WEEKLY_CYCLE_LOG = 'weekly_cycle_log',
  EXECUTION_OUTCOME = 'execution_outcome',
  FEEDBACK_INSIGHT = 'feedback_insight',
  BEHAVIOR_ADJUSTMENT = 'behavior_adjustment',
  LESSON = 'lesson',
  PERFORMANCE_SCORE = 'performance_score',
  STRATEGY_ADJUSTMENT = 'strategy_adjustment',
  STRATEGIC_INSIGHTS = 'strategic_insights',
  BEHAVIOR_MODIFIERS = 'behavior_modifiers',
  TASK_OUTCOME = 'task_outcome',
  GRAPH_INSIGHTS = 'graph_insights',
  SELF_IMPROVEMENT_LOG = 'self_improvement_log',
  AUTONOMOUS_TASK = 'autonomous_task',
  AUTONOMOUS_LOG = 'autonomous_log',
  APPROVAL_REQUEST = 'approval_request',
  DETECTED_OPPORTUNITY = 'detected_opportunity',
  TASK_EXECUTION_DATA = 'task_execution_data',
  PARAMETER_ADAPTATION = 'parameter_adaptation',
  PARAMETER_ADAPTATION_ATTEMPT = 'parameter_adaptation_attempt',
  TOOL_RESILIENCE = 'tool_resilience',
  CAPACITY_CHECK = 'capacity_check',
  SCHEDULING_ADJUSTMENT = 'scheduling_adjustment',
  
  // Additional types from ChloeMemoryType that weren't in AgentMemoryType
  CHAT = 'chat',
  SYSTEM_PROMPT = 'system_prompt',
  IMAGE = 'image',
  PERSONA = 'persona',
  STRATEGY = 'strategy',
  VISION = 'vision',
  ANALYSIS = 'analysis',
  FEEDBACK = 'feedback',
  USER_MESSAGE = 'user_message',
  AGENT_MESSAGE = 'agent_message',
  FILE = 'file',
  CODE = 'code',
  REFERENCE = 'reference',
  AGENDA = 'agenda',
  GOAL = 'goal',
  CONTEXT = 'context',
  USER_CONTEXT = 'user_context',
  USER_PROFILE = 'user_profile',
  WORKSPACE = 'workspace',
  INBOX = 'inbox',
  OTHER = 'other'
}

/**
 * Importance levels for memory items
 */
export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Filter condition type for memory queries
 */
export interface MemoryCondition {
  key: string;
  match?: {
    value: any;
    in?: any[];
  };
  range?: {
    gt?: any;
    gte?: any;
    lt?: any;
    lte?: any;
  };
}

/**
 * Standard filter for memory queries
 */
export interface MemoryFilter {
  [key: string]: any;
  must?: MemoryCondition[];
  should?: MemoryCondition[];
  must_not?: MemoryCondition[];
}

/**
 * Sort options for memory queries
 */
export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Schema for a memory collection
 */
export interface CollectionConfig<T> {
  name: string;         // Collection name in database
  schema: T;            // Schema type for this collection
  indices: string[];    // Fields to be indexed
  defaults: Partial<T>; // Default values for schema
}

/**
 * Result validation interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Memory error codes
 */
export enum MemoryErrorCode {
  NOT_FOUND = 'MEMORY_NOT_FOUND',
  VALIDATION_ERROR = 'MEMORY_VALIDATION_ERROR',
  DATABASE_ERROR = 'MEMORY_DATABASE_ERROR',
  EMBEDDING_ERROR = 'MEMORY_EMBEDDING_ERROR',
  INITIALIZATION_ERROR = 'MEMORY_INITIALIZATION_ERROR',
  CONFIGURATION_ERROR = 'MEMORY_CONFIGURATION_ERROR',
  OPERATION_ERROR = 'MEMORY_OPERATION_ERROR',
}

/**
 * Memory-specific error class
 */
export class MemoryError extends Error {
  constructor(
    message: string, 
    public code: MemoryErrorCode,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MemoryError';
  }
}

// Extended memory source enum that includes additional sources
export enum ExtendedMemorySource {
  USER = 'user',
  ASSISTANT = 'assistant',
  CHLOE = 'chloe',
  SYSTEM = 'system',
  TOOL = 'tool',
  WEB = 'web',
  EXTERNAL = 'external',
  FILE = 'file'
} 