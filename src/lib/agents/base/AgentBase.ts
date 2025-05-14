/**
 * AgentBase.ts - Bridge export for the AgentBase interface
 * 
 * This file provides a bridge to the shared AgentBase interface to maintain
 * compatibility across the codebase after removing Chloe-specific code.
 */

// Re-export the AgentBase interface
export type { AgentBase } from '../../../agents/shared/base/AgentBase.interface';

// Re-export all types
export * from '../../../agents/shared/base/types';

// Re-export all manager-related types
export * from '../../../agents/shared/base/managers/BaseManager';

// Re-export the AbstractAgentBase implementation
export { AbstractAgentBase } from '../../../agents/shared/base/AbstractAgentBase'; 