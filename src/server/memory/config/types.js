"use strict";
/**
 * Core types for memory system
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorySource = exports.MemorySourceType = exports.ExtendedMemorySource = exports.MemoryError = exports.MemoryErrorCode = exports.ImportanceLevel = exports.MemoryType = void 0;
/**
 * Supported memory types - standardized enum for use throughout the system
 */
var MemoryType;
(function (MemoryType) {
    // Base memory types
    MemoryType["MESSAGE"] = "message";
    MemoryType["THOUGHT"] = "thought";
    MemoryType["DOCUMENT"] = "document";
    MemoryType["TASK"] = "task";
    MemoryType["MEMORY_EDIT"] = "memory_edit";
    // Extended types for agent capabilities
    MemoryType["KNOWLEDGE_GAP"] = "knowledge_gap";
    MemoryType["KNOWLEDGE_GAP_RESOLUTION"] = "knowledge_gap_resolution";
    MemoryType["TASK_COMPLETION"] = "task_completion";
    MemoryType["TOOL_FAILURE"] = "tool_failure";
    MemoryType["TOOL_FALLBACK"] = "tool_fallback";
    MemoryType["REFLECTION"] = "reflection";
    MemoryType["CORRECTION"] = "correction";
    MemoryType["CORRECTION_DETAIL"] = "correction_detail";
    MemoryType["INSIGHT"] = "insight";
    MemoryType["SCHEDULED_TASK_RESULT"] = "scheduled_task_result";
    MemoryType["MAINTENANCE_LOG"] = "maintenance_log";
    MemoryType["KNOWLEDGE_INSIGHT"] = "knowledge_insight";
    MemoryType["ERROR_LOG"] = "error_log";
    MemoryType["DAILY_CYCLE_LOG"] = "daily_cycle_log";
    MemoryType["WEEKLY_CYCLE_LOG"] = "weekly_cycle_log";
    MemoryType["EXECUTION_OUTCOME"] = "execution_outcome";
    MemoryType["FEEDBACK_INSIGHT"] = "feedback_insight";
    MemoryType["BEHAVIOR_ADJUSTMENT"] = "behavior_adjustment";
    MemoryType["LESSON"] = "lesson";
    MemoryType["PERFORMANCE_SCORE"] = "performance_score";
    MemoryType["STRATEGY_ADJUSTMENT"] = "strategy_adjustment";
    MemoryType["STRATEGIC_INSIGHTS"] = "strategic_insights";
    MemoryType["BEHAVIOR_MODIFIERS"] = "behavior_modifiers";
    MemoryType["TASK_OUTCOME"] = "task_outcome";
    MemoryType["GRAPH_INSIGHTS"] = "graph_insights";
    MemoryType["SELF_IMPROVEMENT_LOG"] = "self_improvement_log";
    MemoryType["AUTONOMOUS_TASK"] = "autonomous_task";
    MemoryType["AUTONOMOUS_LOG"] = "autonomous_log";
    MemoryType["APPROVAL_REQUEST"] = "approval_request";
    MemoryType["DETECTED_OPPORTUNITY"] = "detected_opportunity";
    MemoryType["TASK_EXECUTION_DATA"] = "task_execution_data";
    MemoryType["PARAMETER_ADAPTATION"] = "parameter_adaptation";
    MemoryType["PARAMETER_ADAPTATION_ATTEMPT"] = "parameter_adaptation_attempt";
    MemoryType["TOOL_RESILIENCE"] = "tool_resilience";
    MemoryType["CAPACITY_CHECK"] = "capacity_check";
    MemoryType["SCHEDULING_ADJUSTMENT"] = "scheduling_adjustment";
    // Tool routing and adaptation types
    MemoryType["TOOL_EXECUTION_METRICS"] = "tool_execution_metrics";
    // Agent communication and relationship types
    MemoryType["AGENT"] = "agent";
    MemoryType["AGENT_ACTIVITY"] = "agent_activity";
    MemoryType["AGENT_CAPABILITY"] = "agent_capability";
    MemoryType["CAPABILITY_DEFINITION"] = "capability_definition";
    MemoryType["CAPABILITY_USAGE"] = "capability_usage";
    MemoryType["CAPABILITY_METRICS"] = "capability_metrics";
    MemoryType["AGENT_RELATIONSHIP"] = "agent_relationship";
    // Conversation analytics types
    MemoryType["CONVERSATION_ANALYTICS"] = "conversation_analytics";
    MemoryType["CONVERSATION_INSIGHTS"] = "conversation_insights";
    // Additional types from ChloeMemoryType that weren't in AgentMemoryType
    MemoryType["CHAT"] = "chat";
    MemoryType["SYSTEM_PROMPT"] = "system_prompt";
    MemoryType["IMAGE"] = "image";
    MemoryType["PERSONA"] = "persona";
    MemoryType["STRATEGY"] = "strategy";
    MemoryType["VISION"] = "vision";
    MemoryType["ANALYSIS"] = "analysis";
    MemoryType["FEEDBACK"] = "feedback";
    MemoryType["USER_MESSAGE"] = "user_message";
    MemoryType["AGENT_MESSAGE"] = "agent_message";
    MemoryType["FILE"] = "file";
    MemoryType["CODE"] = "code";
    MemoryType["REFERENCE"] = "reference";
    MemoryType["AGENDA"] = "agenda";
    MemoryType["GOAL"] = "goal";
    MemoryType["CONTEXT"] = "context";
    MemoryType["USER_CONTEXT"] = "user_context";
    MemoryType["USER_PROFILE"] = "user_profile";
    MemoryType["WORKSPACE"] = "workspace";
    MemoryType["INBOX"] = "inbox";
    MemoryType["OTHER"] = "other";
})(MemoryType || (exports.MemoryType = MemoryType = {}));
/**
 * Importance levels for memory items
 */
var ImportanceLevel;
(function (ImportanceLevel) {
    ImportanceLevel["LOW"] = "low";
    ImportanceLevel["MEDIUM"] = "medium";
    ImportanceLevel["HIGH"] = "high";
    ImportanceLevel["CRITICAL"] = "critical";
})(ImportanceLevel || (exports.ImportanceLevel = ImportanceLevel = {}));
/**
 * Memory error codes
 */
var MemoryErrorCode;
(function (MemoryErrorCode) {
    MemoryErrorCode["NOT_FOUND"] = "MEMORY_NOT_FOUND";
    MemoryErrorCode["VALIDATION_ERROR"] = "MEMORY_VALIDATION_ERROR";
    MemoryErrorCode["DATABASE_ERROR"] = "MEMORY_DATABASE_ERROR";
    MemoryErrorCode["EMBEDDING_ERROR"] = "MEMORY_EMBEDDING_ERROR";
    MemoryErrorCode["INITIALIZATION_ERROR"] = "MEMORY_INITIALIZATION_ERROR";
    MemoryErrorCode["CONFIGURATION_ERROR"] = "MEMORY_CONFIGURATION_ERROR";
    MemoryErrorCode["OPERATION_ERROR"] = "MEMORY_OPERATION_ERROR";
})(MemoryErrorCode || (exports.MemoryErrorCode = MemoryErrorCode = {}));
/**
 * Memory-specific error class
 */
var MemoryError = /** @class */ (function (_super) {
    __extends(MemoryError, _super);
    function MemoryError(message, code, cause) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.cause = cause;
        _this.name = 'MemoryError';
        return _this;
    }
    return MemoryError;
}(Error));
exports.MemoryError = MemoryError;
// Extended memory source enum that includes additional sources
var ExtendedMemorySource;
(function (ExtendedMemorySource) {
    ExtendedMemorySource["USER"] = "user";
    ExtendedMemorySource["ASSISTANT"] = "assistant";
    ExtendedMemorySource["CHLOE"] = "chloe";
    ExtendedMemorySource["SYSTEM"] = "system";
    ExtendedMemorySource["TOOL"] = "tool";
    ExtendedMemorySource["WEB"] = "web";
    ExtendedMemorySource["EXTERNAL"] = "external";
    ExtendedMemorySource["FILE"] = "file";
})(ExtendedMemorySource || (exports.ExtendedMemorySource = ExtendedMemorySource = {}));
/**
 * Source categorization for memory entries
 */
var MemorySourceType;
(function (MemorySourceType) {
    MemorySourceType["USER"] = "user";
    MemorySourceType["AGENT"] = "agent";
    MemorySourceType["SYSTEM"] = "system";
    MemorySourceType["TOOL"] = "tool";
    MemorySourceType["INTEGRATION"] = "integration";
    MemorySourceType["EXTERNAL"] = "external";
    MemorySourceType["INFERENCE"] = "inference";
    MemorySourceType["ANALYSIS"] = "analysis";
    MemorySourceType["REFLECTION"] = "reflection";
    MemorySourceType["OTHER"] = "other";
    MemorySourceType["FILE"] = "FILE";
})(MemorySourceType || (exports.MemorySource = exports.MemorySourceType = MemorySourceType = {}));
