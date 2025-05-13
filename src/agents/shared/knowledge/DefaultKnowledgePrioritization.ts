/**
 * DefaultKnowledgePrioritization
 * 
 * Default implementation of the KnowledgePrioritization interface.
 * This implementation provides a system for prioritizing knowledge items and managing relevance.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgePrioritization,
  KnowledgePriorityLevel,
  KnowledgeRelevanceCategory,
  PriorityFactor,
  PriorityScoringModel,
  KnowledgePriorityInfo,
  PrioritizationOptions,
  PrioritizationResult
} from './interfaces/KnowledgePrioritization.interface';
import { KnowledgeGraph } from './interfaces/KnowledgeGraph.interface';

/**
 * Options for initializing DefaultKnowledgePrioritization
 */
export interface DefaultKnowledgePrioritizationOptions {
  /** Knowledge graph instance for context */
  knowledgeGraph?: KnowledgeGraph;
  
  /** Default scoring model to use */
  defaultScoringModel?: PriorityScoringModel;
  
  /** Auto-recalculation interval in milliseconds */
  recalculationInterval?: number;
  
  /** Persistence options */
  persistence?: {
    enabled: boolean;
    storageLocation?: string;
    autoSaveInterval?: number;
  };
  
  /** Additional options */
  additionalOptions?: Record<string, unknown>;
}

/**
 * Error types for knowledge prioritization operations
 */
export class KnowledgePrioritizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgePrioritizationError';
  }
}

export class ModelNotFoundError extends KnowledgePrioritizationError {
  constructor(modelId: string) {
    super(`Scoring model with ID '${modelId}' not found`);
  }
}

export class PriorityNotFoundError extends KnowledgePrioritizationError {
  constructor(id: string) {
    super(`Priority with ID '${id}' not found`);
  }
}

export class NotInitializedError extends KnowledgePrioritizationError {
  constructor() {
    super('KnowledgePrioritization has not been initialized');
  }
}

/**
 * Default implementation of KnowledgePrioritization interface
 */
export class DefaultKnowledgePrioritization implements KnowledgePrioritization {
  private knowledgePriorities: Map<string, KnowledgePriorityInfo> = new Map();
  private scoringModels: Map<string, PriorityScoringModel> = new Map();
  private scheduledJobs: Map<string, { schedule: string; options: PrioritizationOptions; intervalId?: NodeJS.Timeout }> = new Map();
  private initialized: boolean = false;
  private knowledgeGraph?: KnowledgeGraph;
  private options: DefaultKnowledgePrioritizationOptions;
  private recalculationIntervalId?: NodeJS.Timeout;
  
  /**
   * Create a new DefaultKnowledgePrioritization instance
   */
  constructor(options: DefaultKnowledgePrioritizationOptions = {}) {
    this.options = {
      recalculationInterval: 24 * 60 * 60 * 1000, // 24 hours
      persistence: {
        enabled: false,
        autoSaveInterval: 60 * 60 * 1000 // 1 hour
      },
      ...options
    };
    
    this.knowledgeGraph = options.knowledgeGraph;
  }
  
  /**
   * Ensure the system is initialized
   * @throws {NotInitializedError} If not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NotInitializedError();
    }
  }
  
  /**
   * Initialize the knowledge prioritization system
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    // Register default scoring model if provided
    if (this.options.defaultScoringModel) {
      await this.registerScoringModel(this.options.defaultScoringModel);
    } else {
      // Create and register a standard default model
      await this.registerScoringModel({
        name: 'default',
        description: 'Default scoring model for knowledge prioritization',
        factorWeights: {
          [PriorityFactor.RECENCY]: 0.7,
          [PriorityFactor.FREQUENCY]: 0.6,
          [PriorityFactor.DOMAIN_RELEVANCE]: 0.9,
          [PriorityFactor.TASK_RELEVANCE]: 0.8,
          [PriorityFactor.GAP_FILLING]: 0.7,
          [PriorityFactor.USER_INTEREST]: 0.5,
          [PriorityFactor.CONFIDENCE]: 0.4,
          [PriorityFactor.IMPORTANCE]: 0.9
        },
        categoryAdjustments: {
          [KnowledgeRelevanceCategory.CORE]: 0.3,
          [KnowledgeRelevanceCategory.SUPPORTING]: 0.2,
          [KnowledgeRelevanceCategory.CONTEXTUAL]: 0.1,
          [KnowledgeRelevanceCategory.PERIPHERAL]: -0.1,
          [KnowledgeRelevanceCategory.TANGENTIAL]: -0.2
        },
        version: '1.0.0'
      });
    }
    
    // Initialize knowledge graph if provided
    if (this.knowledgeGraph) {
      await this.knowledgeGraph.initialize();
    }
    
    // If persistence is enabled, load existing data
    if (this.options.persistence?.enabled) {
      await this.loadFromStorage();
    }
    
    // Set up auto-save if enabled
    if (this.options.persistence?.enabled && this.options.persistence.autoSaveInterval) {
      setInterval(() => {
        this.saveToStorage().catch(err => {
          console.error('Error auto-saving knowledge priorities:', err);
        });
      }, this.options.persistence.autoSaveInterval);
    }
    
    // Set up auto-recalculation if interval is provided
    if (this.options.recalculationInterval) {
      this.recalculationIntervalId = setInterval(() => {
        this.recalculateAllPriorities().catch(err => {
          console.error('Error auto-recalculating priorities:', err);
        });
      }, this.options.recalculationInterval);
    }
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Load knowledge priorities and models from storage
   */
  private async loadFromStorage(): Promise<void> {
    // To be implemented
    // This would load knowledge priorities and models from the specified storage location
  }
  
  /**
   * Save knowledge priorities and models to storage
   */
  private async saveToStorage(): Promise<void> {
    // To be implemented
    // This would save knowledge priorities and models to the specified storage location
  }
  
  /**
   * Recalculate all priorities
   */
  private async recalculateAllPriorities(): Promise<void> {
    const knowledgeItemIds = Array.from(this.knowledgePriorities.keys());
    
    if (knowledgeItemIds.length > 0) {
      await this.prioritizeKnowledge({
        knowledgeItemIds,
        options: {
          forceRecalculation: true
        }
      });
    }
  }
  
  /**
   * Register a priority scoring model
   */
  async registerScoringModel(model: Omit<PriorityScoringModel, 'id'>): Promise<string> {
    // We can't call ensureInitialized here as the initialize method needs to register models
    // during initialization
    const id = model.name.toLowerCase().replace(/\s+/g, '_');
    
    const scoringModel: PriorityScoringModel = {
      ...model,
      name: model.name
    };
    
    this.scoringModels.set(id, scoringModel);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return id;
  }
  
  /**
   * Get all scoring models
   */
  async getScoringModels(): Promise<PriorityScoringModel[]> {
    this.ensureInitialized();
    return Array.from(this.scoringModels.values());
  }
  
  /**
   * Get a scoring model by name or ID
   */
  async getScoringModel(nameOrId: string): Promise<PriorityScoringModel | null> {
    this.ensureInitialized();
    
    // Try direct lookup by ID
    if (this.scoringModels.has(nameOrId)) {
      return this.scoringModels.get(nameOrId) || null;
    }
    
    // Try lookup by name
    const normalizedName = nameOrId.toLowerCase().replace(/\s+/g, '_');
    return this.scoringModels.get(normalizedName) || null;
  }
  
  /**
   * Prioritize knowledge items
   */
  async prioritizeKnowledge(options: PrioritizationOptions): Promise<PrioritizationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const knowledgeItemIds = options.knowledgeItemIds || [];
    let changedCount = 0;
    
    // Get the scoring model
    let scoringModel: PriorityScoringModel;
    
    if (options.scoringModel) {
      if (typeof options.scoringModel === 'string') {
        const model = await this.getScoringModel(options.scoringModel);
        if (!model) {
          throw new ModelNotFoundError(options.scoringModel);
        }
        scoringModel = model;
      } else {
        scoringModel = options.scoringModel;
      }
    } else {
      // Use default model
      const defaultModel = await this.getScoringModel('default');
      if (!defaultModel) {
        throw new Error('Default scoring model not found');
      }
      scoringModel = defaultModel;
    }
    
    // TODO: Implement actual priority calculation
    // In a full implementation, this would calculate priorities based on various factors
    // For now, we'll use a placeholder implementation
    
    // Update or create priorities for each item
    const priorities: KnowledgePriorityInfo[] = [];
    
    // For simplicity in this skeleton implementation, just create a random priority
    // for each item or for a mock item if none specified
    if (knowledgeItemIds.length === 0) {
      // For testing purposes, create a mock item
      const mockItemId = uuidv4();
      const priority = this.createMockPriority(mockItemId, scoringModel);
      
      this.knowledgePriorities.set(mockItemId, priority);
      priorities.push(priority);
      changedCount++;
    } else {
      for (const itemId of knowledgeItemIds) {
        const existing = this.knowledgePriorities.get(itemId);
        
        if (existing && !options.options?.forceRecalculation) {
          priorities.push(existing);
        } else {
          const priority = this.createMockPriority(itemId, scoringModel);
          
          this.knowledgePriorities.set(itemId, priority);
          priorities.push(priority);
          changedCount++;
        }
      }
    }
    
    // Calculate level distribution
    const levelDistribution: Record<KnowledgePriorityLevel, number> = {
      [KnowledgePriorityLevel.CRITICAL]: 0,
      [KnowledgePriorityLevel.HIGH]: 0,
      [KnowledgePriorityLevel.MEDIUM]: 0,
      [KnowledgePriorityLevel.LOW]: 0,
      [KnowledgePriorityLevel.BACKGROUND]: 0
    };
    
    priorities.forEach(p => {
      levelDistribution[p.priorityLevel] += 1;
    });
    
    // Calculate average score
    const totalScore = priorities.reduce((sum, p) => sum + p.priorityScore, 0);
    const avgScore = priorities.length > 0 ? totalScore / priorities.length : 0;
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      prioritizedItems: priorities,
      stats: {
        itemsProcessed: priorities.length,
        itemsChanged: changedCount,
        averageScore: avgScore,
        levelDistribution,
        processingTimeMs: processingTime
      },
      timestamp: new Date()
    };
  }
  
  /**
   * Helper to create a mock priority
   */
  private createMockPriority(knowledgeItemId: string, model: PriorityScoringModel): KnowledgePriorityInfo {
    // In a real implementation, this would calculate a meaningful score
    // For now, we're using random values for demonstration
    const score = Math.random() * 100;
    let level: KnowledgePriorityLevel;
    
    if (score >= 80) {
      level = KnowledgePriorityLevel.CRITICAL;
    } else if (score >= 60) {
      level = KnowledgePriorityLevel.HIGH;
    } else if (score >= 40) {
      level = KnowledgePriorityLevel.MEDIUM;
    } else if (score >= 20) {
      level = KnowledgePriorityLevel.LOW;
    } else {
      level = KnowledgePriorityLevel.BACKGROUND;
    }
    
    const now = new Date();
    
    return {
      id: uuidv4(),
      knowledgeItemId,
      priorityScore: score,
      priorityLevel: level,
      relevanceCategory: KnowledgeRelevanceCategory.SUPPORTING,
      factorScores: {
        [PriorityFactor.RECENCY]: Math.random(),
        [PriorityFactor.DOMAIN_RELEVANCE]: Math.random(),
        [PriorityFactor.IMPORTANCE]: Math.random()
      },
      explanation: 'Priority calculated based on scoring model',
      lastCalculated: now,
      updatedAt: now,
      nextRecalculation: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 1 day in future
    };
  }
  
  /**
   * Get priority info for a knowledge item
   */
  async getKnowledgePriority(knowledgeItemId: string): Promise<KnowledgePriorityInfo | null> {
    this.ensureInitialized();
    return this.knowledgePriorities.get(knowledgeItemId) || null;
  }
  
  /**
   * Get priority info for multiple knowledge items
   */
  async getKnowledgePriorities(knowledgeItemIds: string[]): Promise<Map<string, KnowledgePriorityInfo>> {
    this.ensureInitialized();
    
    const result = new Map<string, KnowledgePriorityInfo>();
    
    for (const id of knowledgeItemIds) {
      const priority = this.knowledgePriorities.get(id);
      if (priority) {
        result.set(id, priority);
      }
    }
    
    return result;
  }
  
  /**
   * Set knowledge item relevance category
   */
  async setRelevanceCategory(
    knowledgeItemId: string,
    category: KnowledgeRelevanceCategory,
    reason?: string
  ): Promise<boolean> {
    this.ensureInitialized();
    
    const priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      return false;
    }
    
    const now = new Date();
    
    // Update the category
    this.knowledgePriorities.set(knowledgeItemId, {
      ...priority,
      relevanceCategory: category,
      updatedAt: now,
      metadata: {
        ...priority.metadata,
        categoryChangeReason: reason,
        categoryLastUpdated: now.toISOString()
      }
    });
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Manually adjust priority for a knowledge item
   */
  async adjustPriority(
    knowledgeItemId: string,
    adjustment: number,
    reason: string,
    expiration?: Date
  ): Promise<KnowledgePriorityInfo> {
    this.ensureInitialized();
    
    let priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      // Create a new priority if it doesn't exist
      const defaultModel = await this.getScoringModel('default');
      if (!defaultModel) {
        throw new Error('Default scoring model not found');
      }
      
      priority = this.createMockPriority(knowledgeItemId, defaultModel);
    }
    
    // Apply the adjustment
    const newScore = Math.min(100, Math.max(0, priority.priorityScore + adjustment));
    
    // Determine new priority level
    let newLevel: KnowledgePriorityLevel;
    
    if (newScore >= 80) {
      newLevel = KnowledgePriorityLevel.CRITICAL;
    } else if (newScore >= 60) {
      newLevel = KnowledgePriorityLevel.HIGH;
    } else if (newScore >= 40) {
      newLevel = KnowledgePriorityLevel.MEDIUM;
    } else if (newScore >= 20) {
      newLevel = KnowledgePriorityLevel.LOW;
    } else {
      newLevel = KnowledgePriorityLevel.BACKGROUND;
    }
    
    const now = new Date();
    
    // Update the priority
    const updatedPriority: KnowledgePriorityInfo = {
      ...priority,
      priorityScore: newScore,
      priorityLevel: newLevel,
      lastCalculated: now,
      updatedAt: now,
      metadata: {
        ...priority.metadata,
        manualAdjustment: adjustment,
        adjustmentReason: reason,
        adjustmentDate: now.toISOString(),
        adjustmentExpiration: expiration?.toISOString()
      }
    };
    
    this.knowledgePriorities.set(knowledgeItemId, updatedPriority);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return updatedPriority;
  }
  
  /**
   * Get top priority knowledge items
   */
  async getTopPriorityItems(
    count: number = 10,
    filter?: {
      minScore?: number;
      categories?: KnowledgeRelevanceCategory[];
      levels?: KnowledgePriorityLevel[];
    }
  ): Promise<KnowledgePriorityInfo[]> {
    this.ensureInitialized();
    
    let items = Array.from(this.knowledgePriorities.values());
    
    // Apply filters
    if (filter) {
      if (filter.minScore !== undefined) {
        items = items.filter(item => item.priorityScore >= filter.minScore!);
      }
      
      if (filter.categories?.length) {
        items = items.filter(item => filter.categories!.includes(item.relevanceCategory));
      }
      
      if (filter.levels?.length) {
        items = items.filter(item => filter.levels!.includes(item.priorityLevel));
      }
    }
    
    // Sort by score (descending) and take the top N
    return items
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, count);
  }
  
  /**
   * Schedule a prioritization job
   */
  async schedulePrioritization(
    schedule: string,
    options: PrioritizationOptions
  ): Promise<string> {
    this.ensureInitialized();
    
    const jobId = uuidv4();
    
    // In a real implementation, this would use a cron-like scheduler
    // For this skeleton, we'll just store the job information
    this.scheduledJobs.set(jobId, {
      schedule,
      options
    });
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return jobId;
  }
  
  /**
   * Cancel a scheduled prioritization job
   */
  async cancelScheduledPrioritization(jobId: string): Promise<boolean> {
    this.ensureInitialized();
    
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      return false;
    }
    
    // Clear the interval if it exists
    if (job.intervalId) {
      clearInterval(job.intervalId);
    }
    
    const result = this.scheduledJobs.delete(jobId);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return result;
  }
  
  /**
   * Get knowledge priority statistics
   */
  async getPriorityStats(): Promise<{
    totalItems: number;
    averageScore: number;
    levelCounts: Record<KnowledgePriorityLevel, number>;
    categoryCounts: Record<KnowledgeRelevanceCategory, number>;
    topPriorityItems: Array<{ id: string; knowledgeItemId: string; score: number }>;
  }> {
    this.ensureInitialized();
    
    const items = Array.from(this.knowledgePriorities.values());
    
    // Initialize counters
    const levelCounts: Record<KnowledgePriorityLevel, number> = {
      [KnowledgePriorityLevel.CRITICAL]: 0,
      [KnowledgePriorityLevel.HIGH]: 0,
      [KnowledgePriorityLevel.MEDIUM]: 0,
      [KnowledgePriorityLevel.LOW]: 0,
      [KnowledgePriorityLevel.BACKGROUND]: 0
    };
    
    const categoryCounts: Record<KnowledgeRelevanceCategory, number> = {
      [KnowledgeRelevanceCategory.CORE]: 0,
      [KnowledgeRelevanceCategory.SUPPORTING]: 0,
      [KnowledgeRelevanceCategory.CONTEXTUAL]: 0,
      [KnowledgeRelevanceCategory.PERIPHERAL]: 0,
      [KnowledgeRelevanceCategory.TANGENTIAL]: 0
    };
    
    // Count by level and category
    for (const item of items) {
      levelCounts[item.priorityLevel]++;
      categoryCounts[item.relevanceCategory]++;
    }
    
    // Calculate average score
    const totalScore = items.reduce((sum, item) => sum + item.priorityScore, 0);
    const averageScore = items.length > 0 ? totalScore / items.length : 0;
    
    // Get top priority items
    const topItems = items
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        knowledgeItemId: item.knowledgeItemId,
        score: item.priorityScore
      }));
    
    return {
      totalItems: items.length,
      averageScore,
      levelCounts,
      categoryCounts,
      topPriorityItems: topItems
    };
  }
  
  /**
   * Generate a knowledge priority report
   */
  async generatePriorityReport(format: 'text' | 'markdown' | 'json'): Promise<string> {
    this.ensureInitialized();
    
    const stats = await this.getPriorityStats();
    
    if (format === 'json') {
      return JSON.stringify({
        stats,
        priorities: Array.from(this.knowledgePriorities.values())
      }, null, 2);
    }
    
    if (format === 'markdown') {
      return `# Knowledge Priority Report

## Summary
- Total Items: ${stats.totalItems}
- Average Score: ${stats.averageScore.toFixed(2)}

## Priority Levels
${Object.entries(stats.levelCounts)
  .map(([level, count]) => `- ${level}: ${count}`)
  .join('\n')}

## Relevance Categories
${Object.entries(stats.categoryCounts)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

## Top Priority Items
${stats.topPriorityItems
  .map((item, index) => `${index + 1}. Item ${item.knowledgeItemId.substring(0, 8)} (Score: ${item.score.toFixed(2)})`)
  .join('\n')}
`;
    }
    
    // Default to text format
    return `Knowledge Priority Report
==========================

Summary:
- Total Items: ${stats.totalItems}
- Average Score: ${stats.averageScore.toFixed(2)}

Priority Levels:
${Object.entries(stats.levelCounts)
  .map(([level, count]) => `- ${level}: ${count}`)
  .join('\n')}

Relevance Categories:
${Object.entries(stats.categoryCounts)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

Top Priority Items:
${stats.topPriorityItems
  .map((item, index) => `${index + 1}. Item ${item.knowledgeItemId.substring(0, 8)} (Score: ${item.score.toFixed(2)})`)
  .join('\n')}
`;
  }
  
  /**
   * Clear all priority data
   */
  async clear(): Promise<boolean> {
    this.ensureInitialized();
    
    this.knowledgePriorities.clear();
    
    // Clear scheduled jobs
    Array.from(this.scheduledJobs.values()).forEach(job => {
      if (job.intervalId) {
        clearInterval(job.intervalId);
      }
    });
    this.scheduledJobs.clear();
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Shutdown the knowledge prioritization system
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }
    
    // Clear recalculation interval if it exists
    if (this.recalculationIntervalId) {
      clearInterval(this.recalculationIntervalId);
      this.recalculationIntervalId = undefined;
    }
    
    // Clear scheduled jobs
    Array.from(this.scheduledJobs.values()).forEach(job => {
      if (job.intervalId) {
        clearInterval(job.intervalId);
      }
    });
    
    // Save data before shutdown if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    this.initialized = false;
    return true;
  }
} 