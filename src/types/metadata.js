"use strict";
/**
 * Central metadata type definitions
 *
 * This module provides standardized type definitions for all metadata
 * used across the memory system. All components must use these types
 * when creating or consuming metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetadataField = exports.TaskPriority = exports.TaskStatus = exports.DocumentSource = exports.CognitiveProcessType = exports.MessagePriority = exports.MessageType = exports.MetadataSource = exports.MessageRole = void 0;
var MessageTypes_1 = require("../agents/shared/types/MessageTypes");
Object.defineProperty(exports, "MessageRole", { enumerable: true, get: function () { return MessageTypes_1.MessageRole; } });
// Common metadata sources
var MetadataSource;
(function (MetadataSource) {
    MetadataSource["AGENT"] = "agent";
    MetadataSource["USER"] = "user";
    MetadataSource["SYSTEM"] = "system";
    MetadataSource["MEMORY"] = "memory";
    MetadataSource["CHAT"] = "chat";
})(MetadataSource || (exports.MetadataSource = MetadataSource = {}));
// Message type classifications
var MessageType;
(function (MessageType) {
    MessageType["CHAT"] = "chat";
    MessageType["THOUGHT"] = "thought";
    MessageType["SYSTEM"] = "system";
    MessageType["INTERNAL"] = "internal";
})(MessageType || (exports.MessageType = MessageType = {}));
/**
 * Message priority levels for agent-to-agent communication
 */
var MessagePriority;
(function (MessagePriority) {
    MessagePriority["LOW"] = "low";
    MessagePriority["NORMAL"] = "normal";
    MessagePriority["HIGH"] = "high";
    MessagePriority["URGENT"] = "urgent";
})(MessagePriority || (exports.MessagePriority = MessagePriority = {}));
/**
 * Cognitive process type enum
 */
var CognitiveProcessType;
(function (CognitiveProcessType) {
    CognitiveProcessType["THOUGHT"] = "thought";
    CognitiveProcessType["REFLECTION"] = "reflection";
    CognitiveProcessType["INSIGHT"] = "insight";
    CognitiveProcessType["PLANNING"] = "planning";
    CognitiveProcessType["EVALUATION"] = "evaluation";
    CognitiveProcessType["DECISION"] = "decision";
})(CognitiveProcessType || (exports.CognitiveProcessType = CognitiveProcessType = {}));
/**
 * Document source enum
 */
var DocumentSource;
(function (DocumentSource) {
    DocumentSource["FILE"] = "file";
    DocumentSource["WEB"] = "web";
    DocumentSource["API"] = "api";
    DocumentSource["USER"] = "user";
    DocumentSource["AGENT"] = "agent";
    DocumentSource["TOOL"] = "tool";
    DocumentSource["SYSTEM"] = "system";
})(DocumentSource || (exports.DocumentSource = DocumentSource = {}));
/**
 * Task status enum
 */
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["PENDING"] = "pending";
    TaskStatus["IN_PROGRESS"] = "in_progress";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["CANCELLED"] = "cancelled";
    TaskStatus["FAILED"] = "failed";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
/**
 * Task priority enum
 */
var TaskPriority;
(function (TaskPriority) {
    TaskPriority["LOW"] = "low";
    TaskPriority["MEDIUM"] = "medium";
    TaskPriority["HIGH"] = "high";
    TaskPriority["URGENT"] = "urgent";
})(TaskPriority || (exports.TaskPriority = TaskPriority = {}));
/**
 * Metadata field enum for consistent access
 * Use this to ensure consistent field access across the codebase
 */
var MetadataField;
(function (MetadataField) {
    // Schema version
    MetadataField["SCHEMA_VERSION"] = "schemaVersion";
    // Common fields
    MetadataField["IMPORTANCE"] = "importance";
    MetadataField["IMPORTANCE_SCORE"] = "importance_score";
    MetadataField["TAGS"] = "tags";
    MetadataField["IS_DELETED"] = "is_deleted";
    MetadataField["DELETION_TIME"] = "deletion_time";
    // Authentication and tenant fields
    MetadataField["AUTH_CONTEXT"] = "authContext";
    MetadataField["TENANT"] = "tenant";
    MetadataField["PERFORMANCE_DIRECTIVES"] = "performanceDirectives";
    // Message-specific fields
    MetadataField["ROLE"] = "role";
    MetadataField["USER_ID"] = "userId";
    MetadataField["AGENT_ID"] = "agentId";
    MetadataField["CHAT_ID"] = "chatId";
    MetadataField["MESSAGE_TYPE"] = "messageType";
    MetadataField["SOURCE"] = "source";
    MetadataField["CATEGORY"] = "category";
    MetadataField["ATTACHMENTS"] = "attachments";
    // Thread fields
    MetadataField["THREAD"] = "thread";
    // Multi-agent communication fields
    MetadataField["SENDER_AGENT_ID"] = "senderAgentId";
    MetadataField["RECEIVER_AGENT_ID"] = "receiverAgentId";
    MetadataField["COMMUNICATION_TYPE"] = "communicationType";
    MetadataField["PRIORITY"] = "priority";
    MetadataField["REQUIRES_RESPONSE"] = "requiresResponse";
    MetadataField["RESPONSE_DEADLINE"] = "responseDeadline";
    MetadataField["CONVERSATION_CONTEXT"] = "conversationContext";
    // Cognitive process fields
    MetadataField["PROCESS_TYPE"] = "processType";
    MetadataField["CONTEXT_ID"] = "contextId";
    MetadataField["RELATED_TO"] = "relatedTo";
    MetadataField["INFLUENCES"] = "influences";
    MetadataField["INFLUENCED_BY"] = "influencedBy";
    MetadataField["INTENTION"] = "intention";
    MetadataField["CONFIDENCE_SCORE"] = "confidenceScore";
    MetadataField["REFLECTION_TYPE"] = "reflectionType";
    MetadataField["TIME_SCOPE"] = "timeScope";
    MetadataField["INSIGHT_TYPE"] = "insightType";
    MetadataField["APPLICATION_CONTEXT"] = "applicationContext";
    MetadataField["VALIDITY_PERIOD"] = "validityPeriod";
    MetadataField["PLAN_TYPE"] = "planType";
    MetadataField["ESTIMATED_STEPS"] = "estimatedSteps";
    MetadataField["DEPENDS_ON"] = "dependsOn";
    // Document fields
    MetadataField["TITLE"] = "title";
    MetadataField["CONTENT_TYPE"] = "contentType";
    MetadataField["FILE_TYPE"] = "fileType";
    MetadataField["URL"] = "url";
    MetadataField["CHUNK_INDEX"] = "chunkIndex";
    MetadataField["TOTAL_CHUNKS"] = "totalChunks";
    MetadataField["PARENT_DOCUMENT_ID"] = "parentDocumentId";
    MetadataField["FILE_SIZE"] = "fileSize";
    MetadataField["FILE_NAME"] = "fileName";
    MetadataField["LAST_MODIFIED"] = "lastModified";
    MetadataField["SITE_NAME"] = "siteName";
    MetadataField["AUTHOR"] = "author";
    MetadataField["PUBLISH_DATE"] = "publishDate";
    // Task fields
    MetadataField["STATUS"] = "status";
    MetadataField["ASSIGNED_TO"] = "assignedTo";
    MetadataField["CREATED_BY"] = "createdBy";
    MetadataField["DUE_DATE"] = "dueDate";
    MetadataField["START_DATE"] = "startDate";
    MetadataField["COMPLETED_DATE"] = "completedDate";
    MetadataField["PARENT_TASK_ID"] = "parentTaskId";
    MetadataField["SUBTASK_IDS"] = "subtaskIds";
    MetadataField["BLOCKED_BY"] = "blockedBy";
})(MetadataField || (exports.MetadataField = MetadataField = {}));
