/**
 * Agent Tools System - Index
 * 
 * Centralized exports for all agent tool system components
 * following the unified foundation integration pattern.
 * 
 * This provides:
 * - UnifiedAgentToolSystem for foundation integration
 * - AgentIntegrationService for backward compatibility
 * - Re-exports of foundation types and agent interfaces
 */

// Core agent tool system
export { UnifiedAgentToolSystem } from './UnifiedAgentToolSystem';
export { AgentIntegrationService } from './AgentIntegrationService';

// Re-export foundation types for convenience
export type {
  UnifiedToolDefinition,
  ExecutionContext,
  ToolResult,
  ToolParameters
} from '../../foundation/types/FoundationTypes';

// Re-export agent interfaces for convenience
export type {
  ToolManager,
  ToolManagerConfig
} from '../../../../agents/shared/base/managers/ToolManager.interface';

export type {
  AgentBase
} from '../../../../agents/shared/base/AgentBase.interface';

// Re-export foundation enums
export { ToolCategory, ToolCapability, ToolStatus } from '../../foundation/enums/ToolEnums';

// Re-export agent tool constants
export { AGENT_TOOLS } from '../../foundation/constants/ToolConstants'; 