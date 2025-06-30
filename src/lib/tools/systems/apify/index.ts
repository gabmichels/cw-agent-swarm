/**
 * Unified Apify Tool System - Exports
 * 
 * Centralized exports for the unified Apify tool system integration.
 * Provides access to all Apify functionality through the unified foundation.
 * 
 * Following @IMPLEMENTATION_GUIDELINES.md principles:
 * - Clean interface exports
 * - Centralized access point
 * - Preserve backward compatibility
 */

// Core system components
export { UnifiedApifyToolSystem } from './UnifiedApifyToolSystem';
export { ApifyIntegrationService } from './ApifyIntegrationService';

// Re-export types from the foundation for convenience
export type {
  ToolParameters,
  ExecutionContext,
  ToolResult,
  UnifiedToolDefinition
} from '../../foundation/types/FoundationTypes';

// Re-export Apify-specific interfaces
export type {
  IApifyManager,
  ApifyToolInput,
  ApifyToolResult,
  ApifyActorMetadata
} from '../../../../agents/shared/tools/integrations/apify/ApifyManager.interface';

// Re-export tool constants
export { APIFY_TOOL_NAMES } from '../../../../constants/tool-names'; 