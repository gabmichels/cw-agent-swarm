/**
 * Unified Tool Foundation - Core Exports
 * 
 * This module provides the unified foundation layer that consolidates
 * tool functionality across all specialized systems while preserving
 * their domain expertise.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - ULID for business logic, UUID for database layer
 * - Eliminate string literals with centralized constants
 * - Dependency injection throughout
 * - Interface-first design
 * - Structured error handling integration
 */

// Core Foundation Interface
export type { IUnifiedToolFoundation } from './interfaces/UnifiedToolFoundationInterface';

// Tool Definition and Management
export type {
  ExecutionContext, ParameterValidationError,
  ParameterValidationWarning, PerformanceIssue,
  ResourceRequirements, SearchContext, SecurityIssue, ToolDiscoveryCriteria, ToolDiscoveryMethod, ToolHealthStatus, ToolId, ToolIdentifier, ToolMetrics, ToolParameterSchema, ToolParameters, ToolRecommendation, ToolRegistrationResult, ToolResult, ToolSearchResult,
  ToolSimilarity, UnifiedTool, UnifiedToolDefinition, ValidationResult
} from './types/FoundationTypes';

// Registry and Discovery
export type { IToolDiscoveryService } from './interfaces/ToolDiscoveryServiceInterface';
export type { IUnifiedToolRegistry } from './interfaces/UnifiedToolRegistryInterface';

// Execution Services
export type { IToolValidationService } from './interfaces/ToolValidationServiceInterface';
export type { IUnifiedToolExecutor } from './interfaces/UnifiedToolExecutorInterface';

// Error Handling
export {
  ToolDependencyError, ToolDiscoveryError, ToolExecutionError, ToolFoundationError,
  ToolNotFoundError, ToolParameterError,
  ToolPermissionError, ToolRegistrationError, ToolSystemError,
  ToolTimeoutError, ToolValidationError, createUserFriendlyMessage, extractToolContext, isToolFoundationError
} from './errors/ToolFoundationErrors';

// Foundation Implementation
export { CrossSystemToolRouter } from './services/CrossSystemToolRouter';
export { IntelligentToolRouter } from './services/IntelligentToolRouter';
export { ToolCompositionEngine } from './services/ToolCompositionEngine';
export { ToolDiscoveryService } from './services/ToolDiscoveryService';
export { ToolValidationService } from './services/ToolValidationService';
export { UnifiedToolExecutor } from './services/UnifiedToolExecutor';
export { UnifiedToolFoundation } from './services/UnifiedToolFoundation';
export { UnifiedToolRegistry } from './services/UnifiedToolRegistry';

// Constants and Enums
export {
  AGENT_TOOLS, AGENT_TOOL_NAMES, ALL_TOOL_CONSTANTS, ALL_TOOL_NAMES, APPROVAL_SYSTEM_TOOLS, APPROVAL_SYSTEM_TOOL_NAMES, CALENDAR_TOOL_NAMES, CONNECTION_TOOL_NAMES, COST_TRACKING_TOOLS, COST_TRACKING_TOOL_NAMES, EMAIL_TOOL_NAMES, EXTERNAL_WORKFLOW_TOOLS, EXTERNAL_WORKFLOW_TOOL_NAMES, FILE_TOOL_NAMES, SOCIAL_MEDIA_TOOLS, SOCIAL_MEDIA_TOOL_NAMES, SPREADSHEET_TOOL_NAMES, TOOL_CAPABILITY_MAPPINGS, TOOL_CATEGORY_MAPPINGS, TOOL_RESPONSE_FORMATTER_TOOLS, TOOL_RESPONSE_FORMATTER_TOOL_NAMES, WORKSPACE_TOOLS, WORKSPACE_TOOL_NAMES
} from './constants/ToolConstants';
export { ToolCapability, ToolCategory, ToolStatus } from './enums/ToolEnums';

// Utilities
export { createExecutionContext, validateExecutionContext } from './utils/ExecutionContextUtils';
export { createToolId, isValidToolId, validateToolId } from './utils/ToolIdUtils';

// Export Phase 3.3 services
export { AdaptiveLearningService } from './services/AdaptiveLearningService';
