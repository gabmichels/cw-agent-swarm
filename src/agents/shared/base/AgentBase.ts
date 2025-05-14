/**
 * AgentBase.ts - Main export point for the AgentBase interface
 * 
 * This file serves as the central export point for the AgentBase interface
 * and related types required across the codebase.
 */

// Export the core AgentBase interface
export type { AgentBase } from './AgentBase.interface';

// Export all types from the types file
export * from './types';

// Export the BaseManager and related types
export * from './managers/BaseManager';

// Export the AbstractAgentBase implementation
export { AbstractAgentBase } from './AbstractAgentBase'; 