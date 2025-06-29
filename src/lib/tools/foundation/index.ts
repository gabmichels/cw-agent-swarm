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
  ValidationResult
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
  ToolRegistrationError
} from './errors/ToolFoundationErrors';

// Foundation Implementation
export { UnifiedToolFoundation } from './services/unified-tool-foundation';
export { UnifiedToolRegistry } from './services/unified-tool-registry';
export { UnifiedToolExecutor } from './services/unified-tool-executor';
export { ToolDiscoveryService } from './services/tool-discovery-service';
export { ToolValidationService } from './services/tool-validation-service';

// Constants and Enums
export { ToolCategory, ToolCapability, ToolStatus } from './enums/ToolEnums';

// Utilities
export { createToolId, validateToolId, isValidToolId } from './utils/ToolIdUtils';
export { createExecutionContext, validateExecutionContext } from './utils/ExecutionContextUtils'; 