/**
 * Base Agent framework
 * 
 * This file exports the core components of the base agent framework.
 */

// Export AgentBase from the existing implementation
export type { AgentBase } from '../../../agents/shared/base/AgentBase';

// Manager interfaces
export type { BaseManager, ManagerConfig } from './managers/BaseManager';
export { AbstractBaseManager } from './managers/BaseManager';

// Use the existing registry from the codebase
export { AgentRegistry } from '../../agents/registry';

// Export manager interfaces - enable these as they're implemented
// export type { MemoryManager, MemoryManagerConfig } from './managers/MemoryManager';
export type { KnowledgeManager, KnowledgeManagerConfig } from './managers/KnowledgeManager';
export type { SchedulerManager, SchedulerManagerConfig } from './managers/SchedulerManager';
export type { ReflectionManager, ReflectionManagerConfig } from './managers/ReflectionManager';
// export type { ToolManager, ToolManagerConfig } from './managers/ToolManager';
// export type { PlanningManager, PlanningManagerConfig } from './managers/PlanningManager';
export type { InputProcessor, InputProcessorConfig } from './managers/InputProcessor';
export type { OutputProcessor, OutputProcessorConfig } from './managers/OutputProcessor';

// TODO: Implement additional exports as components are developed 