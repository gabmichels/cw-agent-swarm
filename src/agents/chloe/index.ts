/**
 * Main exports for the Chloe agent package
 */

// Re-exports for the Chloe agent package
export * from './agent';
export { ChloeMemory } from './memory';
export { MemoryTagger } from './memory-tagger';
export { Persona } from './persona';
export { PersonaLoader } from './persona-loader';
export { TaskLogger } from './task-logger';
export type { TaskLoggerOptions, TaskLogEntry, TaskSession } from './task-logger';

// Re-export types
export type { MemoryEntry, ChloeMemoryOptions } from './memory';
export type { PersonaOptions } from './persona';

// That's it - don't try to re-export types that don't exist 