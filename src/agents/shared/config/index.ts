/**
 * Agent Configuration System
 * 
 * This module exports all configuration schemas and utilities for agent managers
 * to provide a centralized access point for the configuration system.
 */

// Export memory manager configuration
export {
  MemoryManagerConfigSchema,
  MemoryManagerPresets,
  createMemoryManagerConfig
} from '../memory/config/MemoryManagerConfigSchema';

// Export planning manager configuration
export {
  PlanningManagerConfigSchema,
  PlanningManagerPresets,
  createPlanningManagerConfig
} from '../planning/config/PlanningManagerConfigSchema';

// Export tool manager configuration
export {
  ToolManagerConfigSchema,
  ToolManagerPresets,
  createToolManagerConfig
} from '../tools/config/ToolManagerConfigSchema';

// Export knowledge manager configuration
export {
  KnowledgeManagerConfigSchema,
  KnowledgeManagerPresets,
  createKnowledgeManagerConfig
} from '../knowledge/config/KnowledgeManagerConfigSchema';

// Export scheduler manager configuration
export {
  SchedulerManagerConfigSchema,
  SchedulerManagerPresets,
  createSchedulerManagerConfig
} from '../scheduler/config/SchedulerManagerConfigSchema';

// Export reflection manager configuration
export {
  ReflectionManagerConfigSchema,
  ReflectionManagerPresets,
  createReflectionManagerConfig
} from '../reflection/config/ReflectionManagerConfigSchema';

// Export input processor configuration
export {
  InputProcessorConfigSchema,
  InputProcessorPresets,
  createInputProcessorConfig
} from '../input/config/InputProcessorConfigSchema';

// Export output processor configuration
export {
  OutputProcessorConfigSchema,
  OutputProcessorPresets,
  createOutputProcessorConfig
} from '../output/config/OutputProcessorConfigSchema';

// Export factory and validation utilities from the core configuration system
export {
  createConfigFactory,
  ConfigDefaultsProvider
} from '../../../lib/config/factory';

// Export migration utilities
export {
  ConfigMigrationManager,
  MigrationError
} from '../../../lib/config/migration';

// Export validation utilities
export {
  validateConfig,
  validateValue,
  validateString,
  validateNumber,
  validateBoolean,
  validateArray,
  validateObject,
  validateEnum,
  validateCrossProperties
} from '../../../lib/config/validators';

// Export agent configuration orchestration
export { AgentConfigOrchestrator } from './AgentConfigOrchestrator';
export type { 
  ConfigDependency,
  ConfigVerificationResult,
  AgentConfigSchema
} from './AgentConfigOrchestrator';

// Export common configuration dependencies
export {
  CommonConfigDependencies,
  getDependenciesForManagerTypes,
  getAllDependenciesForManager,
  getOutgoingDependenciesForManager,
  getIncomingDependenciesForManager
} from './CommonConfigDependencies';

// Re-export configuration types
export type {
  ConfigSchema,
  ConfigPropertySchema,
  ConfigValidator,
  DefaultsProvider,
  ValidationOptions,
  ValidationResult,
  UpdateStrategy,
  PresetProvider,
  CrossPropertyValidation,
  ConfigMigration,
  MigrationFunction,
  MigrationManager,
  VersionedConfigSchema
} from '../../../lib/config/types'; 