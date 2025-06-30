/**
 * Thinking System - Unified Tool Foundation Integration
 * 
 * Centralized exports for all thinking system components integrated
 * with the unified foundation layer.
 * 
 * This module provides:
 * - UnifiedThinkingToolSystem: Core system integration
 * - ThinkingIntegrationService: Backward compatibility layer
 * - All thinking-specific types and interfaces
 * - Re-exports of foundation types for convenience
 */

// Core thinking system components
export { UnifiedThinkingToolSystem, ThinkingCapability } from './UnifiedThinkingToolSystem';
export type { ThinkingExecutionContext } from './UnifiedThinkingToolSystem';
export { ThinkingIntegrationService } from './ThinkingIntegrationService';

// Re-export foundation types for convenience
export type {
  IUnifiedToolFoundation
} from '../../foundation/interfaces/UnifiedToolFoundationInterface';
export type {
  UnifiedToolDefinition,
  ToolResult,
  ExecutionContext,
  ToolParameters
} from '../../foundation/types/FoundationTypes';
export type {
  ToolCategory,
  ToolCapability,
  ToolStatus
} from '../../foundation/enums/ToolEnums';

// Re-export thinking tool constants
export { THINKING_TOOL_NAMES } from '../../../../constants/tool-names';

// Re-export existing thinking interfaces for backward compatibility
export type { ToolService } from '../../../../services/thinking/tools/ToolService';
export type { ToolChainManager } from '../../../../services/thinking/tools/ToolChainManager'; 