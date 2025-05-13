/**
 * Common Configuration Dependencies
 * 
 * This module provides common configuration dependencies that can be registered
 * with the AgentConfigOrchestrator for consistent manager configuration.
 */

import { ConfigDependency } from './AgentConfigOrchestrator';

/**
 * Common dependencies between managers
 */
export const CommonConfigDependencies: ConfigDependency[] = [
  // Memory Manager -> Knowledge Manager
  {
    sourceManager: 'memory',
    sourceProperty: 'hybridSearch.enabled',
    targetManager: 'knowledge',
    targetProperty: 'vectorSearch.enabled',
    required: true
  },
  {
    sourceManager: 'memory',
    sourceProperty: 'hybridSearch.semanticWeight',
    targetManager: 'knowledge',
    targetProperty: 'vectorSearch.semanticWeight',
    required: false
  },
  
  // Memory Manager -> Planning Manager
  {
    sourceManager: 'memory',
    sourceProperty: 'maxHistoryItems',
    targetManager: 'planning',
    targetProperty: 'contextWindowSize',
    required: false,
    transform: (value) => {
      // Planning context window is typically smaller than memory history size
      const memorySize = typeof value === 'number' ? value : 100;
      return Math.min(50, Math.floor(memorySize / 2));
    }
  },
  
  // Planning Manager -> Tool Manager
  {
    sourceManager: 'planning',
    sourceProperty: 'planTimeout',
    targetManager: 'tool',
    targetProperty: 'executionTimeout',
    required: false,
    transform: (value) => {
      // Tool execution timeout is usually less than plan timeout
      const planTimeout = typeof value === 'number' ? value : 60000;
      return Math.floor(planTimeout * 0.8);
    }
  },
  
  // Input Processor -> Output Processor 
  {
    sourceManager: 'input-processor',
    sourceProperty: 'defaultLanguage',
    targetManager: 'output-processor',
    targetProperty: 'defaultLanguage',
    required: false
  },
  {
    sourceManager: 'input-processor',
    sourceProperty: 'contentFilteringLevel',
    targetManager: 'output-processor',
    targetProperty: 'contentModerationLevel',
    required: false,
    transform: (value) => {
      // Map input filtering levels to output moderation levels
      const mappings: Record<string, string> = {
        'none': 'none',
        'low': 'low',
        'medium': 'medium',
        'high': 'high'
      };
      return mappings[value as string] || 'medium';
    }
  },
  
  // MemoryManager -> ReflectionManager
  {
    sourceManager: 'memory',
    sourceProperty: 'maxHistoryItems',
    targetManager: 'reflection',
    targetProperty: 'maxHistoryItems',
    required: false,
    transform: (value) => {
      // Reflection history is typically smaller than memory history
      const memorySize = typeof value === 'number' ? value : 100;
      return Math.min(100, memorySize);
    }
  },

  // ReflectionManager -> Memory Manager
  {
    sourceManager: 'reflection',
    sourceProperty: 'persistReflections',
    targetManager: 'memory',
    targetProperty: 'persistMemories',
    required: false
  },

  // SchedulerManager -> Memory Manager Decay
  {
    sourceManager: 'scheduler',
    sourceProperty: 'timeHorizonDays',
    targetManager: 'memory',
    targetProperty: 'decayConfig.timeHorizonDays',
    required: false,
    transform: (value) => {
      // Memory decay time horizon should match scheduler time horizon
      return typeof value === 'number' ? value : 30;
    }
  },

  // SchedulerManager -> Planning Manager
  {
    sourceManager: 'scheduler',
    sourceProperty: 'maxParallelTasks',
    targetManager: 'planning',
    targetProperty: 'maxParallelPlanSteps',
    required: false,
    transform: (value) => {
      // Planning parallel steps should not exceed scheduler parallel tasks
      return typeof value === 'number' ? value : 3;
    }
  },

  // Tool Manager -> Planning Manager
  {
    sourceManager: 'tool',
    sourceProperty: 'availableTools',
    targetManager: 'planning',
    targetProperty: 'availableToolIds',
    required: false,
    transform: (value) => {
      // Extract tool IDs from available tools
      if (Array.isArray(value)) {
        return value.map(tool => typeof tool === 'object' && tool !== null ? 
          (tool as Record<string, unknown>).id || '' : '').filter(id => id !== '');
      }
      return [];
    }
  }
];

/**
 * Get dependencies for specific manager types
 * @param sourceType Source manager type
 * @param targetType Target manager type
 * @returns Dependencies between the specified manager types
 */
export function getDependenciesForManagerTypes(
  sourceType: string,
  targetType: string
): ConfigDependency[] {
  return CommonConfigDependencies.filter(
    dep => dep.sourceManager === sourceType && dep.targetManager === targetType
  );
}

/**
 * Get all dependencies for a specific manager type (both source and target)
 * @param managerType The manager type
 * @returns All dependencies involving the specified manager
 */
export function getAllDependenciesForManager(managerType: string): ConfigDependency[] {
  return CommonConfigDependencies.filter(
    dep => dep.sourceManager === managerType || dep.targetManager === managerType
  );
}

/**
 * Get dependencies where the specified manager is the source
 * @param managerType The manager type
 * @returns Dependencies where the manager is the source
 */
export function getOutgoingDependenciesForManager(managerType: string): ConfigDependency[] {
  return CommonConfigDependencies.filter(
    dep => dep.sourceManager === managerType
  );
}

/**
 * Get dependencies where the specified manager is the target
 * @param managerType The manager type
 * @returns Dependencies where the manager is the target
 */
export function getIncomingDependenciesForManager(managerType: string): ConfigDependency[] {
  return CommonConfigDependencies.filter(
    dep => dep.targetManager === managerType
  );
} 