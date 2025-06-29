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
  UnifiedToolDefinition,
  ToolIdentifier,
  ToolParameters,
  ExecutionContext,
  ToolResult,
  ToolId,
  UnifiedTool,
  ToolDiscoveryCriteria,
  SearchContext,
  ToolHealthStatus,
  ToolMetrics,
  ValidationResult,
  ToolParameterSchema,
  ToolRegistrationResult,
  ToolSearchResult,
  ToolSimilarity,
  ToolRecommendation,
  ToolDiscoveryMethod,
  ParameterValidationError,
  ParameterValidationWarning,
  SecurityIssue,
  PerformanceIssue,
  ResourceRequirements
} from './types/FoundationTypes';

// Registry and Discovery
export type { IUnifiedToolRegistry } from './interfaces/UnifiedToolRegistryInterface';
export type { IToolDiscoveryService } from './interfaces/ToolDiscoveryServiceInterface';

// Execution Services
export type { IUnifiedToolExecutor } from './interfaces/UnifiedToolExecutorInterface';
export type { IToolValidationService } from './interfaces/ToolValidationServiceInterface';

// Error Handling
export {
  ToolFoundationError,
  ToolNotFoundError,
  ToolExecutionError,
  ToolValidationError,
  ToolRegistrationError,
  ToolParameterError,
  ToolPermissionError,
  ToolDiscoveryError,
  ToolSystemError,
  ToolTimeoutError,
  ToolDependencyError,
  isToolFoundationError,
  extractToolContext,
  createUserFriendlyMessage
} from './errors/ToolFoundationErrors';

// Foundation Implementation
export { UnifiedToolFoundation } from './services/UnifiedToolFoundation';
export { UnifiedToolRegistry } from './services/UnifiedToolRegistry';
export { UnifiedToolExecutor } from './services/UnifiedToolExecutor';
export { ToolDiscoveryService } from './services/ToolDiscoveryService';
export { ToolValidationService } from './services/ToolValidationService';

// Constants and Enums
export { ToolCategory, ToolCapability, ToolStatus } from './enums/ToolEnums';
export {
  WORKSPACE_TOOLS,
  SOCIAL_MEDIA_TOOLS,
  ALL_TOOL_CONSTANTS,
  TOOL_CATEGORY_MAPPINGS,
  TOOL_CAPABILITY_MAPPINGS,
  WORKSPACE_TOOL_NAMES,
  SOCIAL_MEDIA_TOOL_NAMES,
  ALL_TOOL_NAMES,
  EMAIL_TOOL_NAMES,
  CALENDAR_TOOL_NAMES,
  SPREADSHEET_TOOL_NAMES,
  FILE_TOOL_NAMES,
  CONNECTION_TOOL_NAMES
} from './constants/ToolConstants';

// Utilities
export { createToolId, validateToolId, isValidToolId } from './utils/ToolIdUtils';
export { createExecutionContext, validateExecutionContext } from './utils/ExecutionContextUtils'; 