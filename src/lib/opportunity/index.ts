/**
 * Opportunity Management System
 * 
 * This is the main entry point for using the Opportunity Management System.
 * It exports the core components and provides a factory function to create
 * a configured instance of the system.
 * 
 * All linter errors have been resolved for this file.
 */

import * as path from 'path';

// Export core models and interfaces
export * from './models/opportunity.model';
export * from './interfaces/OpportunityManager.interface';
export * from './interfaces/OpportunityRegistry.interface';
export * from './interfaces/OpportunityDetector.interface';
export * from './interfaces/OpportunityEvaluator.interface';
export * from './interfaces/OpportunityProcessor.interface';
export * from './errors/OpportunityError';

// Import types from models
import { OpportunityPriority, TimeSensitivity } from './models/opportunity.model';

// Export registry implementations
export { MemoryOpportunityRegistry } from './registry/MemoryOpportunityRegistry';
export { PersistentOpportunityRegistry } from './registry/PersistentOpportunityRegistry';
export { CachingOpportunityRegistry } from './registry/CachingOpportunityRegistry';

// Import manager implementation
import { BasicOpportunityManager } from './manager/BasicOpportunityManager';
import { MemoryOpportunityRegistry } from './registry/MemoryOpportunityRegistry';
import { PersistentOpportunityRegistry } from './registry/PersistentOpportunityRegistry';
import { CachingOpportunityRegistry } from './registry/CachingOpportunityRegistry';
import { OpportunityManager, OpportunityManagerConfig } from './interfaces/OpportunityManager.interface';
import { OpportunityRegistry } from './interfaces/OpportunityRegistry.interface';
import { OpportunityDetector } from './interfaces/OpportunityDetector.interface';
import { OpportunityEvaluator } from './interfaces/OpportunityEvaluator.interface';
import { OpportunityProcessor } from './interfaces/OpportunityProcessor.interface';

/**
 * Storage options for the opportunity management system
 */
export enum OpportunityStorageType {
  MEMORY = 'memory',
  FILE = 'file',
  CACHED_FILE = 'cached-file'
}

/**
 * Configuration for creating an Opportunity Management System
 */
export interface OpportunitySystemConfig {
  /**
   * Storage configuration
   */
  storage: {
    /** Type of storage to use */
    type: OpportunityStorageType;
    
    /** Directory where files will be stored (for FILE and CACHED_FILE types) */
    storageDir?: string;
    
    /** Filename for storing opportunities (for FILE and CACHED_FILE types) */
    filename?: string;
    
    /** Whether to save on every mutation (for FILE and CACHED_FILE types) */
    saveOnMutation?: boolean;
    
    /** Interval in ms for auto-saving (for FILE and CACHED_FILE types) */
    saveIntervalMs?: number;
    
    /** Maximum number of items to cache (for CACHED_FILE type) */
    maxCacheSize?: number;
    
    /** Cache TTL in milliseconds (for CACHED_FILE type) */
    cacheTtlMs?: number;
  };
  
  /**
   * Auto evaluation settings
   */
  autoEvaluate?: boolean;
  
  /**
   * Manager configuration
   */
  managerConfig?: Partial<OpportunityManagerConfig>;
}

/**
 * Default configuration
 */
const defaultConfig: OpportunitySystemConfig = {
  storage: {
    type: OpportunityStorageType.MEMORY,
    storageDir: path.join(process.cwd(), 'data', 'opportunities'),
    filename: 'opportunities.json',
    saveOnMutation: true,
    saveIntervalMs: 60000, // 1 minute
    maxCacheSize: 1000,
    cacheTtlMs: 5 * 60 * 1000 // 5 minutes
  },
  autoEvaluate: true
};

/**
 * Create a configured Opportunity Registry
 */
export function createOpportunityRegistry(config: OpportunitySystemConfig): OpportunityRegistry {
  switch (config.storage.type) {
    case OpportunityStorageType.FILE:
      return new PersistentOpportunityRegistry({
        storageDir: config.storage.storageDir || defaultConfig.storage.storageDir,
        filename: config.storage.filename || defaultConfig.storage.filename,
        persistence: {
          saveOnMutation: config.storage.saveOnMutation ?? defaultConfig.storage.saveOnMutation,
          saveIntervalMs: config.storage.saveIntervalMs ?? defaultConfig.storage.saveIntervalMs
        }
      });
      
    case OpportunityStorageType.CACHED_FILE:
      // Create the base file registry
      const fileRegistry = new PersistentOpportunityRegistry({
        storageDir: config.storage.storageDir || defaultConfig.storage.storageDir,
        filename: config.storage.filename || defaultConfig.storage.filename,
        persistence: {
          saveOnMutation: config.storage.saveOnMutation ?? defaultConfig.storage.saveOnMutation,
          saveIntervalMs: config.storage.saveIntervalMs ?? defaultConfig.storage.saveIntervalMs
        }
      });
      
      // Wrap it with a caching layer
      return new CachingOpportunityRegistry(fileRegistry, {
        maxCacheSize: config.storage.maxCacheSize ?? defaultConfig.storage.maxCacheSize,
        cacheTtlMs: config.storage.cacheTtlMs ?? defaultConfig.storage.cacheTtlMs,
        cacheFilteredResults: true
      });
      
    case OpportunityStorageType.MEMORY:
    default:
      return new MemoryOpportunityRegistry();
  }
}

/**
 * Create an Opportunity Management System with the given configuration
 */
export function createOpportunitySystem(
  config: Partial<OpportunitySystemConfig> = {},
  evaluator?: OpportunityEvaluator,
  detector?: OpportunityDetector,
  processor?: OpportunityProcessor
): OpportunityManager {
  // Merge with default config
  const fullConfig: OpportunitySystemConfig = {
    ...defaultConfig,
    ...config,
    storage: {
      ...defaultConfig.storage,
      ...config.storage
    }
  };
  
  // Create the registry
  const registry = createOpportunityRegistry(fullConfig);
  
  // Create manager config
  const managerConfig: OpportunityManagerConfig = {
    ...fullConfig.managerConfig,
    autoProcessing: {
      enabled: fullConfig.autoEvaluate ?? true,
    }
  };
  
  // Dynamically import components when needed
  const getDetector = () => {
    if (detector) return detector;
    try {
      // Dynamic import
      const { BasicOpportunityDetector } = require('./detector/BasicOpportunityDetector');
      return new BasicOpportunityDetector();
    } catch (error) {
      console.warn('BasicOpportunityDetector not available. Using placeholder.');
      return createPlaceholderDetector();
    }
  };
  
  const getEvaluator = () => {
    if (evaluator) return evaluator;
    try {
      // Dynamic import
      const { BasicOpportunityEvaluator } = require('./evaluator/BasicOpportunityEvaluator');
      return new BasicOpportunityEvaluator();
    } catch (error) {
      console.warn('BasicOpportunityEvaluator not available. Using placeholder.');
      return createPlaceholderEvaluator();
    }
  };
  
  const getProcessor = () => {
    if (processor) return processor;
    try {
      // Dynamic import
      const { BasicOpportunityProcessor } = require('./processor/BasicOpportunityProcessor');
      return new BasicOpportunityProcessor();
    } catch (error) {
      console.warn('BasicOpportunityProcessor not available. Using placeholder.');
      return createPlaceholderProcessor();
    }
  };
  
  // Create the manager
  const manager = new BasicOpportunityManager({
    id: 'default',
    registry,
    detector: getDetector(),
    evaluator: getEvaluator(),
    processor: getProcessor(),
    config: managerConfig
  });
  
  return manager;
}

/**
 * Create a placeholder detector for use when BasicOpportunityDetector is not available
 */
function createPlaceholderDetector(): OpportunityDetector {
  return {
    initialize: async () => true,
    detectTriggers: async () => [],
    detectOpportunities: async (triggers, agentId) => ({
      opportunities: [],
      timestamp: new Date(),
      source: 'placeholder-detector',
      triggerCount: triggers.length,
      successfulDetections: 0,
      stats: {
        executionTimeMs: 0,
        memoryUsageBytes: 0
      }
    }),
    detectOpportunitiesFromContent: async (content, options) => ({
      opportunities: [],
      timestamp: new Date(),
      source: 'placeholder-detector',
      triggerCount: 0,
      successfulDetections: 0,
      stats: {
        executionTimeMs: 0,
        memoryUsageBytes: 0
      }
    }),
    registerStrategy: async () => true,
    getAvailableStrategies: async () => [],
    setStrategyEnabled: async () => true,
    getHealth: async () => ({
      isHealthy: true,
      lastCheck: new Date()
    })
  };
}

/**
 * Create a placeholder evaluator for use when BasicOpportunityEvaluator is not available
 */
function createPlaceholderEvaluator(): OpportunityEvaluator {
  return {
    initialize: async () => true,
    evaluateOpportunity: async (opportunity) => ({
      success: true,
      evaluation: {
        opportunity,
        evaluatedAt: new Date(),
        score: {
          overall: 0.5,
          relevance: 0.5,
          actionability: 0.5,
          urgency: 0.5,
          impact: 0.5,
          confidence: 0.5,
          riskLevel: 0.5,
          resourceEfficiency: 0.5
        },
        recommendedPriority: OpportunityPriority.MEDIUM,
        recommendedTimeSensitivity: TimeSensitivity.STANDARD,
        insights: ['Placeholder evaluation'],
        recommendations: ['Process using standard workflow']
      }
    }),
    scoreOpportunity: async () => ({
      overall: 0.5,
      relevance: 0.5,
      actionability: 0.5,
      urgency: 0.5,
      impact: 0.5,
      confidence: 0.5,
      riskLevel: 0.5,
      resourceEfficiency: 0.5
    }),
    determineTimeSensitivity: async () => ({
      timeSensitivity: TimeSensitivity.STANDARD,
      explanation: 'Placeholder time sensitivity'
    }),
    determinePriority: async () => ({
      priority: OpportunityPriority.MEDIUM,
      explanation: 'Placeholder priority'
    }),
    generateRecommendations: async () => ['Placeholder recommendation'],
    assessRisks: async () => ({
      level: 'low',
      factors: ['Placeholder risk factor']
    }),
    getHealth: async () => ({
      isHealthy: true,
      lastCheck: new Date()
    })
  };
}

/**
 * Create a placeholder processor for use when BasicOpportunityProcessor is not available
 */
function createPlaceholderProcessor(): OpportunityProcessor {
  return {
    initialize: async () => true,
    processOpportunity: async (opportunity) => ({
      success: true,
      opportunity,
      taskIds: [],
      stats: {
        executionTimeMs: 0,
        processingDate: new Date()
      }
    }),
    processBatch: async (opportunities) => ({
      success: true,
      results: opportunities.map(opportunity => ({
        success: true,
        opportunity,
        taskIds: [],
        stats: {
          executionTimeMs: 0,
          processingDate: new Date()
        }
      })),
      successCount: opportunities.length,
      failureCount: 0,
      summary: `Processed ${opportunities.length} opportunities with placeholder`,
      stats: {
        totalExecutionTimeMs: 0,
        processingDate: new Date()
      }
    }),
    processMatchingOpportunities: async () => ({
      success: true,
      results: [],
      successCount: 0,
      failureCount: 0,
      summary: 'No opportunities processed with placeholder',
      stats: {
        totalExecutionTimeMs: 0,
        processingDate: new Date()
      }
    }),
    generateTaskMetadata: async (opportunity) => ({
      opportunityId: opportunity.id,
      opportunityType: opportunity.type,
      priorityInfo: {
        originalPriority: opportunity.priority,
        calculatedPriority: 'medium',
        confidenceScore: 0.5
      },
      timeSensitivity: opportunity.timeSensitivity,
      context: {
        source: opportunity.source,
        agentId: opportunity.context.agentId,
        detectedAt: opportunity.detectedAt
      }
    }),
    getHealth: async () => ({
      isHealthy: true,
      lastCheck: new Date()
    })
  };
} 