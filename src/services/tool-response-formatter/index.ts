/**
 * Tool Response Formatter Service - Main Export
 * 
 * Unified export for all tool response formatting components and services.
 * Provides LLM-powered, persona-aware response formatting for tool executions.
 */

// Core services
export { LLMPersonaFormatter } from './LLMPersonaFormatter';
export { LLMToolResponseFormatter } from './LLMToolResponseFormatter';
export { PromptTemplateService } from './PromptTemplateService';
export type { PromptGenerationMetrics, PromptTemplateResult } from './PromptTemplateService';

// Response style and persona integration
export { PersonaIntegration } from './PersonaIntegration';
export type { PersonaIntegrationConfig } from './PersonaIntegration';
export { ResponseStyleVariations } from './ResponseStyleVariations';
export type { ResponsePattern, ResponseStyleConfig } from './ResponseStyleVariations';

// Prompt templates
export * from './prompt-templates';

// Type definitions
export * from './types';

/**
 * Note: Service instances should be created via dependency injection
 * in the main application. This module exports the classes and types
 * needed for proper DI configuration.
 */ 