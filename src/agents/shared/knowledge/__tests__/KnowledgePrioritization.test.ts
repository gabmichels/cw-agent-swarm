/**
 * KnowledgePrioritization Interface Tests
 * 
 * Tests to verify the KnowledgePrioritization interface contract.
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
} from '../interfaces/KnowledgePrioritization.interface';

/**
 * Mock implementation of KnowledgePrioritization for testing
 */
class MockKnowledgePrioritization implements KnowledgePrioritization {
  private initialized = false;
  private knowledgePriorities: Map<string, KnowledgePriorityInfo> = new Map();
  private scoringModels: Map<string, PriorityScoringModel> = new Map();
  private scheduledJobs: Map<string, { schedule: string; options: PrioritizationOptions }> = new Map();

  /**
   * Initialize the mock prioritization system
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    // Register default scoring model
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
    
    this.initialized = true;
    return true;
  }

  /**
   * Register a scoring model
   */
  async registerScoringModel(model: Omit<PriorityScoringModel, 'id'>): Promise<string> {
    const id = model.name.toLowerCase().replace(/\s+/g, '_');
    
    const scoringModel: PriorityScoringModel = {
      ...model,
      name: model.name
    };
    
    this.scoringModels.set(id, scoringModel);
    return id;
  }

  /**
   * Get all scoring models
   */
  async getScoringModels(): Promise<PriorityScoringModel[]> {
    return Array.from(this.scoringModels.values());
  }

  /**
   * Get a scoring model by name or ID
   */
  async getScoringModel(nameOrId: string): Promise<PriorityScoringModel | null> {
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
    const startTime = Date.now();
    const knowledgeItemIds = options.knowledgeItemIds || [];
    
    // Create mock priorities for the specified items
    const priorities: KnowledgePriorityInfo[] = [];
    const changedCount = 0;
    
    // For testing purposes, create a mock item if none specified
    if (knowledgeItemIds.length === 0) {
      const mockItemId = uuidv4();
      
      const mockPriority = this.createMockPriority(mockItemId);
      this.knowledgePriorities.set(mockItemId, mockPriority);
      priorities.push(mockPriority);
    } else {
      // For each specified item, create or update priority
      for (const itemId of knowledgeItemIds) {
        const existing = this.knowledgePriorities.get(itemId);
        
        if (existing && !options.options?.forceRecalculation) {
          priorities.push(existing);
        } else {
          const newPriority = this.createMockPriority(itemId);
          this.knowledgePriorities.set(itemId, newPriority);
          priorities.push(newPriority);
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
  private createMockPriority(knowledgeItemId: string): KnowledgePriorityInfo {
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
      explanation: 'Mock priority for testing purposes',
      lastCalculated: now,
      updatedAt: now,
      nextRecalculation: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day in future
    };
  }

  /**
   * Get priority info for a knowledge item
   */
  async getKnowledgePriority(knowledgeItemId: string): Promise<KnowledgePriorityInfo | null> {
    return this.knowledgePriorities.get(knowledgeItemId) || null;
  }

  /**
   * Get priority info for multiple knowledge items
   */
  async getKnowledgePriorities(knowledgeItemIds: string[]): Promise<Map<string, KnowledgePriorityInfo>> {
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
    const priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      return false;
    }
    
    // Update the category
    priority.relevanceCategory = category;
    priority.updatedAt = new Date();
    
    if (reason) {
      priority.metadata = {
        ...priority.metadata,
        categoryChangeReason: reason,
        categoryLastUpdated: new Date().toISOString()
      };
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
    let priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      // Create a new priority if it doesn't exist
      priority = this.createMockPriority(knowledgeItemId);
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
    const jobId = uuidv4();
    
    this.scheduledJobs.set(jobId, {
      schedule,
      options
    });
    
    return jobId;
  }

  /**
   * Cancel a scheduled prioritization job
   */
  async cancelScheduledPrioritization(jobId: string): Promise<boolean> {
    return this.scheduledJobs.delete(jobId);
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
    this.knowledgePriorities.clear();
    this.scheduledJobs.clear();
    return true;
  }

  /**
   * Shutdown the knowledge prioritization system
   */
  async shutdown(): Promise<boolean> {
    await this.clear();
    this.initialized = false;
    return true;
  }
}

describe('KnowledgePrioritization Interface', () => {
  let prioritization: KnowledgePrioritization;
  
  beforeEach(async () => {
    prioritization = new MockKnowledgePrioritization();
    await prioritization.initialize();
  });
  
  test('should register and retrieve scoring models', async () => {
    const modelId = await prioritization.registerScoringModel({
      name: 'Test Model',
      description: 'A test scoring model',
      factorWeights: {
        [PriorityFactor.IMPORTANCE]: 1.0,
        [PriorityFactor.RECENCY]: 0.8
      },
      categoryAdjustments: {
        [KnowledgeRelevanceCategory.CORE]: 0.5
      },
      version: '1.0.0'
    });
    
    expect(modelId).toBeDefined();
    
    const models = await prioritization.getScoringModels();
    expect(models.length).toBeGreaterThan(0);
    
    const retrievedModel = await prioritization.getScoringModel(modelId);
    expect(retrievedModel).toBeDefined();
    expect(retrievedModel?.name).toBe('Test Model');
  });
  
  test('should prioritize knowledge items', async () => {
    const result = await prioritization.prioritizeKnowledge({});
    
    expect(result).toBeDefined();
    expect(result.prioritizedItems.length).toBeGreaterThan(0);
    expect(result.stats).toBeDefined();
    expect(result.timestamp).toBeDefined();
  });
  
  test('should get and manipulate priority info', async () => {
    // First prioritize to create a mock item
    const result = await prioritization.prioritizeKnowledge({});
    const itemId = result.prioritizedItems[0].knowledgeItemId;
    
    // Test getting priority
    const priority = await prioritization.getKnowledgePriority(itemId);
    expect(priority).toBeDefined();
    expect(priority?.knowledgeItemId).toBe(itemId);
    
    // Test adjusting priority
    const adjusted = await prioritization.adjustPriority(
      itemId,
      10,
      'Test adjustment'
    );
    
    expect(adjusted).toBeDefined();
    expect(adjusted.priorityScore).toBeGreaterThan(priority!.priorityScore);
    
    // Test setting relevance category
    const categoryResult = await prioritization.setRelevanceCategory(
      itemId,
      KnowledgeRelevanceCategory.CORE,
      'This is core knowledge'
    );
    
    expect(categoryResult).toBe(true);
    
    const updatedPriority = await prioritization.getKnowledgePriority(itemId);
    expect(updatedPriority?.relevanceCategory).toBe(KnowledgeRelevanceCategory.CORE);
  });
  
  test('should get top priority items', async () => {
    // Create several mock items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [uuidv4(), uuidv4(), uuidv4(), uuidv4(), uuidv4()]
    });
    
    const topItems = await prioritization.getTopPriorityItems(3);
    expect(topItems).toBeDefined();
    expect(topItems.length).toBeLessThanOrEqual(3);
    
    // Items should be sorted by score (descending)
    for (let i = 1; i < topItems.length; i++) {
      expect(topItems[i-1].priorityScore).toBeGreaterThanOrEqual(topItems[i].priorityScore);
    }
  });
  
  test('should schedule and cancel prioritization jobs', async () => {
    const jobId = await prioritization.schedulePrioritization(
      '0 0 * * *',
      { knowledgeItemIds: [uuidv4()] }
    );
    
    expect(jobId).toBeDefined();
    
    const cancelResult = await prioritization.cancelScheduledPrioritization(jobId);
    expect(cancelResult).toBe(true);
  });
  
  test('should generate priority statistics', async () => {
    // Create several mock items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [uuidv4(), uuidv4(), uuidv4()]
    });
    
    const stats = await prioritization.getPriorityStats();
    expect(stats).toBeDefined();
    expect(stats.totalItems).toBeGreaterThan(0);
    expect(stats.topPriorityItems).toBeDefined();
  });
  
  test('should generate priority reports', async () => {
    // Create several mock items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [uuidv4(), uuidv4()]
    });
    
    const jsonReport = await prioritization.generatePriorityReport('json');
    expect(jsonReport).toContain('"stats"');
    
    const markdownReport = await prioritization.generatePriorityReport('markdown');
    expect(markdownReport).toContain('# Knowledge Priority Report');
    
    const textReport = await prioritization.generatePriorityReport('text');
    expect(textReport).toContain('Knowledge Priority Report');
  });
  
  test('should clear priority data', async () => {
    // Create mock items
    await prioritization.prioritizeKnowledge({});
    
    const clearResult = await prioritization.clear();
    expect(clearResult).toBe(true);
    
    const stats = await prioritization.getPriorityStats();
    expect(stats.totalItems).toBe(0);
  });
}); 