/**
 * Central metadata type definitions
 * 
 * This module provides standardized type definitions for all metadata
 * used across the memory system. All components must use these types
 * when creating or consuming metadata.
 */

import { MessageRole as ImportedMessageRole } from '../agents/shared/types/MessageTypes';
import { ImportanceLevel } from '../constants/memory';
import { EntityIdentifier } from './entity-identifier';

// Re-export MessageRole for use by other modules
export { ImportedMessageRole as MessageRole };

/**
 * Message attachment interface
 */
export interface MessageAttachment {
  type: string;
  url?: string;
  data?: string;
  filename?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Authentication context for metadata
 */
export interface AuthContext {
  sessionId: string;
  authMethod: 'oauth' | 'jwt' | 'api-key' | 'internal';
  permissions: string[];
  expiresAt?: string;    // ISO date string
  issuedAt: string;      // ISO date string
}

/**
 * Tenant context for multi-tenant deployments
 */
export interface TenantContext {
  tenantId: string;
  dataPolicies: {
    retention: number; // Days
    encryption: boolean;
    classificationLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

/**
 * Performance directives for metadata fields
 */
export interface PerformanceDirectives {
  indexPriority: 'high' | 'medium' | 'low' | 'none';
  cacheTTL?: number; // Seconds
  partitionKey?: string; // Field to use for data partitioning
  denyList?: string[]; // Fields that should not be indexed
}

/**
 * Causal relationship between memories
 */
export interface CausalRelationship {
  memoryId: string;
  description?: string;
  timestamp: string;
}

/**
 * Core metadata types for standardized message and thought handling
 */

// Base metadata interface that all specific metadata types extend
export interface BaseMetadata {
  // Schema version (required)
  schemaVersion: string;

  // Source information
  source?: string;

  // Temporal fields
  timestamp?: string | number;

  // Importance info - Both fields consistently defined
  importance?: ImportanceLevel;
  importance_score?: number; // Numeric importance score from 0-1
  critical?: boolean;

  // Usage tracking
  usage_count?: number;
  last_used?: string;

  // Tags
  tags?: string[];
  tag_confidence?: number;

  // Deletion marking
  is_deleted?: boolean;
  deletion_time?: string;

  // Authentication and tenant context
  authContext?: AuthContext;
  tenant?: TenantContext;
  performanceDirectives?: PerformanceDirectives;

  // Causal relationships
  led_to?: CausalRelationship[];
  caused_by?: CausalRelationship;

  // Version info
  current?: boolean;
  previous_version_id?: string;
  editor_type?: 'human' | 'agent' | 'system';
  editor_id?: string;
}


// Factory function type definitions
export type MessageMetadataFactory = (partialMetadata: Partial<MessageMetadata>) => MessageMetadata;
export type ThoughtMetadataFactory = (partialMetadata: Partial<CognitiveProcessMetadata>) => CognitiveProcessMetadata;
export type MessageReplyContextFactory = (
  messageId: string,
  content: string,
  senderRole: ImportedMessageRole,
  options?: Partial<MessageReplyContext>
) => MessageReplyContext;

// Common metadata sources
export enum MetadataSource {
  AGENT = 'agent',
  USER = 'user',
  SYSTEM = 'system',
  MEMORY = 'memory',
  CHAT = 'chat',
}

// Message type classifications
export enum MessageType {
  CHAT = 'chat',
  THOUGHT = 'thought',
  SYSTEM = 'system',
  INTERNAL = 'internal',
}

/**
 * Thread information interface
 * Every user-agent interaction forms a thread
 */
export interface ThreadInfo {
  id: string;         // Unique thread identifier
  position: number;   // Position in thread (0-based)
  parentId?: string;  // Optional reference to parent message
}

/**
 * Message priority levels for agent-to-agent communication
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Reply context interface for message threading and context preservation
 */
export interface MessageReplyContext {
  messageId: string;          // ULID of the message being replied to
  content: string;                  // Content of the original message
  senderRole: ImportedMessageRole;  // Role of the original message sender
  senderAgentId?: string;     // ULID of agent if sender was an agent
  senderUserId?: string;      // ULID of user if sender was a user
  timestamp: string;                // ISO timestamp of original message
  importance: ImportanceLevel;      // Importance level for LLM prioritization
  threadId?: string;                // Thread context for conversation flow
}

/**
 * Message metadata interface with strong typing
 */
export interface MessageMetadata extends BaseMetadata {
  // Core message fields
  role: ImportedMessageRole;
  userId: EntityIdentifier; // Changed back to EntityIdentifier object
  agentId: EntityIdentifier; // Changed back to EntityIdentifier object  
  chatId: EntityIdentifier; // Changed back to EntityIdentifier object
  messageType?: string;

  // Thread information (required, not optional)
  thread: ThreadInfo;

  // Reply context for message threading
  replyTo?: MessageReplyContext;

  // Attachments
  attachments?: MessageAttachment[];

  // Source tracking
  source?: string;
  category?: string;

  // Bookmark functionality
  isBookmark?: boolean;
  bookmarkedAt?: string; // ISO date string when bookmarked

  // Enhanced fields for multi-agent communication
  senderAgentId?: EntityIdentifier; // Changed back to EntityIdentifier object
  receiverAgentId?: EntityIdentifier; // Changed back to EntityIdentifier object
  communicationType?: 'request' | 'response' | 'notification' | 'broadcast';
  priority?: MessagePriority;
  requiresResponse?: boolean;
  responseDeadline?: string; // ISO date string
  conversationContext?: {
    taskId?: string;
    purpose: string;
    sharedContext: Record<string, unknown>;
  };

  /**
   * Content summary for message retrieval optimization
   * Generated automatically from message content
   */
  contentSummary?: string;
}

/**
 * Cognitive process type enum
 */
export enum CognitiveProcessType {
  THOUGHT = 'thought',
  REFLECTION = 'reflection',
  INSIGHT = 'insight',
  PLANNING = 'planning',
  EVALUATION = 'evaluation',
  DECISION = 'decision'
}

/**
 * Cognitive process metadata base interface
 * Common fields for all cognitive processes (thoughts, reflections, insights)
 */
export interface CognitiveProcessMetadata extends BaseMetadata {
  // Core fields
  processType: CognitiveProcessType;
  agentId: EntityIdentifier; // EntityIdentifier object for consistency with MessageMetadata

  // Context and relationships
  contextId?: string;     // Task, conversation, or other context ID
  relatedTo?: string[];   // IDs of related memories
  influences?: string[];  // IDs of memories this process influenced
  influencedBy?: string[]; // IDs of memories that influenced this process

  // Cognitive importance (consistently defined as in BaseMetadata)
  // importance?: ImportanceLevel;            // Already in BaseMetadata
  // importance_score?: number;               // Already in BaseMetadata

  // Summary for better cognitive memory retrieval
  contentSummary?: string; // Brief summary of the content

  // Source and category
  source?: string;
  category?: string;
}

/**
 * Thought metadata interface
 */
export interface ThoughtMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.THOUGHT;
  intention?: string;     // Purpose of the thought
  confidenceScore?: number; // Confidence level (0-1)

  // Contextual relevance for search enhancement
  topics?: string[];      // Key topics this thought relates to
}

/**
 * Reflection metadata interface
 */
export interface ReflectionMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.REFLECTION;
  reflectionType?: 'experience' | 'behavior' | 'strategy' | 'performance';
  timeScope?: 'immediate' | 'short-term' | 'long-term';

  // Reflection-specific importance
  reflectionDepth?: number;  // How deep this reflection goes (1-10)
}

/**
 * Insight metadata interface
 */
export interface InsightMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.INSIGHT;
  insightType?: 'pattern' | 'implication' | 'prediction' | 'opportunity';
  applicationContext?: string[];  // Contexts where this insight applies
  validityPeriod?: {
    from?: string;  // ISO date string
    to?: string;    // ISO date string
  };

  // Insight-specific importance indicators
  noveltyScore?: number;    // How novel this insight is (0-1)
  applicabilityScore?: number; // How applicable this insight is (0-1)
}

/**
 * Planning metadata interface
 */
export interface PlanningMetadata extends CognitiveProcessMetadata {
  processType: CognitiveProcessType.PLANNING;
  planType?: 'task' | 'strategy' | 'contingency';
  estimatedSteps?: number;
  dependsOn?: string[];  // IDs of prerequisites

  // Planning-specific importance indicators
  complexityScore?: number;   // Complexity of this plan (0-1)
  urgencyScore?: number;      // Urgency of this plan (0-1)
}

/**
 * Agent status enum
 */
export enum AgentStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance'
}

/**
 * Agent metadata interface with proper typing
 * Updated to match actual usage patterns and follow implementation guidelines
 */
export interface AgentMetadata extends BaseMetadata {
  // Agent-specific identification
  agentId: string; // ULID
  name: string;
  description: string;

  // Agent state
  status: AgentStatus;
  lastActive?: string;  // ISO date string

  // Agent configuration
  version: string;
  isPublic: boolean;

  // Categorization
  domain: string[];
  specialization: string[];

  // Performance tracking
  performanceMetrics: {
    successRate: number;        // 0-1
    averageResponseTime: number; // milliseconds
    taskCompletionRate: number; // 0-1
  };

  // Relationships
  chatIds?: string[];
  teamIds?: string[];
  createdBy?: string; // ULID

  // Content summary for agent retrieval optimization
  contentSummary?: string;

  // Capabilities (added to match template usage)
  capabilities?: unknown[]; // Agent capabilities array

  // Temporal fields (added to match actual usage)
  createdAt?: Date;
  updatedAt?: Date;

  // Organizational and categorization properties (mode-aware)
  // Universal properties (both modes)
  category?: string; // For personal mode: "Finance", "Health", "Productivity"

  // Organizational properties (organizational mode only)
  department?: {
    id: string; // ULID - Prisma department ID
    name: string; // "Marketing", "Engineering", etc.
    code: string; // "MKT", "ENG", etc.
  }; // For organizational mode: actual departments with relational data
  subDepartment?: string; // Verticals/domains within department (e.g., "Drivers" within "Engineering")
  team?: string; // Small units/pods within subdepartment (e.g., "Backend Team" within "Drivers")
  position?: string; // Job title/role (organizational mode only)
  reportingTo?: string; // ULID of manager agent (organizational mode only)
  managedAgents?: string[]; // ULIDs of direct reports (organizational mode only)
  organizationLevel?: number; // Hierarchy depth, 0 = top level (organizational mode only)

  // Template metadata (for spawned agents)
  metadata?: {
    templateId?: string; // ULID of template used to create this agent
    spawnedAt?: Date;
    configVersion?: string;
    [key: string]: unknown; // Allow additional metadata
  };
}

/**
 * Document source enum
 */
export enum DocumentSource {
  FILE = 'file',
  WEB = 'web',
  API = 'api',
  USER = 'user',
  AGENT = 'agent',
  TOOL = 'tool',
  SYSTEM = 'system'
}

/**
 * Document metadata interface
 */
export interface DocumentMetadata extends BaseMetadata {
  // Document info
  title?: string;
  source: DocumentSource;
  contentType?: string;
  fileType?: string;
  url?: string;

  // Owner info
  userId?: string; // ULID
  agentId?: string; // ULID

  // Chunking info for large documents
  chunkIndex?: number;
  totalChunks?: number;
  parentDocumentId?: string;

  // File-specific metadata
  fileSize?: number;
  fileName?: string;
  lastModified?: string;

  // Web-specific metadata
  siteName?: string;
  author?: string;
  publishDate?: string;

  // Document-specific importance and retrieval enhancements
  contentSummary?: string;    // Brief summary of document contents for better retrieval
  keyTerms?: string[];        // Extracted key terms for better semantic search
  retrievalCount?: number;    // Number of times this document has been retrieved
  lastRetrieved?: string;     // Last time this document was retrieved

  // Domain-specific categorization
  domain?: string;            // Domain this document belongs to
  subDomain?: string;         // Sub-domain categorization

  // Related documents
  relatedDocuments?: string[]; // IDs of related documents
}

/**
 * File metadata interface for file processing and relevance scoring
 */
export interface FileMetadata extends BaseMetadata {
  // File identification
  fileName: string;
  filePath?: string;
  fileType: string;
  mimeType?: string;

  // File properties
  fileSize: number;           // Size in bytes
  createdAt: string | Date;   // Creation timestamp
  lastModified?: string | Date; // Last modification timestamp

  // Content analysis
  contentSnippets: string[];  // Text snippets from the file
  keyTerms?: string[];        // Extracted key terms
  contentSummary?: string;    // Brief summary of file contents

  // Processing metadata
  processingStatus?: 'pending' | 'processed' | 'failed';
  indexedAt?: string;         // When file was indexed
  lastScanned?: string;       // Last time file was scanned

  // User feedback and scoring
  userFeedback?: {
    upvotes: number;
    downvotes: number;
    relevanceScore?: number;
    lastFeedbackAt?: string;
  };

  // File relationships
  relatedFiles?: string[];    // IDs of related files
  duplicateOf?: string;       // ID if this is a duplicate

  // Domain-specific categorization
  domain?: string;
  subDomain?: string;

  // Access and usage tracking
  accessCount?: number;
  lastAccessed?: string;

  // File-specific tags for organization
  tags?: string[];
}

/**
 * Social media metadata interface
 */
export interface SocialMediaMetadata extends BaseMetadata {
  // Social media specific fields
  memoryType?: string;
  url?: string;
  author?: string;
  topic?: string;
  engagement?: Record<string, any>;
  sentiment?: any;
  category?: string;
}

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

/**
 * Task priority enum
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Task metadata interface
 */
export interface TaskMetadata extends BaseMetadata {
  // Task information
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;

  // Assignment
  assignedTo?: string; // ULID
  createdBy: string; // ULID

  // Timing
  dueDate?: string;  // ISO date string
  startDate?: string; // ISO date string
  completedDate?: string; // ISO date string

  // Relationships
  parentTaskId?: string;
  subtaskIds?: string[];
  dependsOn?: string[];
  blockedBy?: string[];

  /**
   * Content summary for task retrieval optimization
   * Generated automatically from task content or description
   */
  contentSummary?: string;
}

/**
 * Metadata field enum for consistent access
 * Use this to ensure consistent field access across the codebase
 */
export enum MetadataField {
  // Schema version
  SCHEMA_VERSION = 'schemaVersion',

  // Common fields
  IMPORTANCE = 'importance',
  IMPORTANCE_SCORE = 'importance_score',
  TAGS = 'tags',
  IS_DELETED = 'is_deleted',
  DELETION_TIME = 'deletion_time',
  TIMESTAMP = 'timestamp',

  // Authentication and tenant fields
  AUTH_CONTEXT = 'authContext',
  TENANT = 'tenant',
  PERFORMANCE_DIRECTIVES = 'performanceDirectives',

  // Message-specific fields
  ROLE = 'role',
  USER_ID = 'userId',
  AGENT_ID = 'agentId',
  CHAT_ID = 'chatId',
  MESSAGE_ID = 'messageId',
  MESSAGE_TYPE = 'messageType',
  SOURCE = 'source',
  CATEGORY = 'category',
  ATTACHMENTS = 'attachments',

  // Bookmark fields
  IS_BOOKMARK = 'isBookmark',
  BOOKMARKED_AT = 'bookmarkedAt',

  // Thread fields
  THREAD = 'thread',

  // Reply context field
  REPLY_TO = 'replyTo',

  // Multi-agent communication fields
  SENDER_AGENT_ID = 'senderAgentId',
  RECEIVER_AGENT_ID = 'receiverAgentId',
  COMMUNICATION_TYPE = 'communicationType',
  PRIORITY = 'priority',
  REQUIRES_RESPONSE = 'requiresResponse',
  RESPONSE_DEADLINE = 'responseDeadline',
  CONVERSATION_CONTEXT = 'conversationContext',

  // Cognitive process fields
  PROCESS_TYPE = 'processType',
  CONTEXT_ID = 'contextId',
  RELATED_TO = 'relatedTo',
  INFLUENCES = 'influences',
  INFLUENCED_BY = 'influencedBy',
  INTENTION = 'intention',
  CONFIDENCE_SCORE = 'confidenceScore',
  REFLECTION_TYPE = 'reflectionType',
  TIME_SCOPE = 'timeScope',
  INSIGHT_TYPE = 'insightType',
  APPLICATION_CONTEXT = 'applicationContext',
  VALIDITY_PERIOD = 'validityPeriod',
  PLAN_TYPE = 'planType',
  ESTIMATED_STEPS = 'estimatedSteps',
  DEPENDS_ON = 'dependsOn',

  // Document fields
  TITLE = 'title',
  CONTENT_TYPE = 'contentType',
  FILE_TYPE = 'fileType',
  URL = 'url',
  CHUNK_INDEX = 'chunkIndex',
  TOTAL_CHUNKS = 'totalChunks',
  PARENT_DOCUMENT_ID = 'parentDocumentId',
  FILE_SIZE = 'fileSize',
  FILE_NAME = 'fileName',
  LAST_MODIFIED = 'lastModified',
  SITE_NAME = 'siteName',
  AUTHOR = 'author',
  PUBLISH_DATE = 'publishDate',

  // Task fields
  STATUS = 'status',
  ASSIGNED_TO = 'assignedTo',
  CREATED_BY = 'createdBy',
  DUE_DATE = 'dueDate',
  START_DATE = 'startDate',
  COMPLETED_DATE = 'completedDate',
  PARENT_TASK_ID = 'parentTaskId',
  SUBTASK_IDS = 'subtaskIds',
  BLOCKED_BY = 'blockedBy',

  // Agent-specific fields
  AGENT_NAME = 'name',
  AGENT_DESCRIPTION = 'description',
  AGENT_LAST_ACTIVE = 'lastActive',
  AGENT_VERSION = 'version',
  AGENT_IS_PUBLIC = 'isPublic',
  AGENT_DOMAIN = 'domain',
  AGENT_SPECIALIZATION = 'specialization',
  AGENT_PERFORMANCE_METRICS = 'performanceMetrics',
  AGENT_CHAT_IDS = 'chatIds',
  AGENT_TEAM_IDS = 'teamIds',
  AGENT_CONTENT_SUMMARY = 'contentSummary'
}

/**
 * Edit types for memory version history
 */
export type EditType = 'create' | 'update' | 'delete';

/**
 * Editor types for memory version history
 */
export type EditorType = 'agent' | 'system' | 'human';

/**
 * Memory edit metadata for tracking the history and version control of memories
 */
export interface MemoryEditMetadata extends BaseMetadata {
  // Link to the original memory being edited
  original_memory_id: string;
  original_type: string;
  original_timestamp: string;

  // Edit information
  edit_type: EditType;
  editor_type: EditorType;
  editor_id?: string;
  diff_summary?: string;

  // Version tracking
  current: boolean;
  previous_version_id?: string;

  // Special flag to prevent recursion
  _skip_logging?: boolean;
}

/**
 * Memory emotion type for cognitive memory
 */
export type MemoryEmotion = 'neutral' | 'positive' | 'negative' | 'surprise' | 'fear' | 'joy' | 'sadness' | 'anger';

/**
 * Cognitive memory specific metadata
 * Extends BaseMetadata with memory decay and emotional context fields
 */
export interface CognitiveMemoryMetadata extends BaseMetadata {
  // Decay and retrieval tracking
  decayFactor?: number;
  retrievalCount?: number;
  lastRetrieved?: string;

  // Emotional context
  emotions?: MemoryEmotion[];

  // Episodic memory fields
  episodeId?: string;
  sequence?: number;
  criticalityLevel?: 'critical' | null;
} 