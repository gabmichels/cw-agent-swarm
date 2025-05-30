/**
 * DefaultKnowledgePrioritization Tests
 * 
 * Tests for the DefaultKnowledgePrioritization implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultKnowledgePrioritization } from '../DefaultKnowledgePrioritization';
import {
  KnowledgePriorityLevel,
  KnowledgeRelevanceCategory,
  PriorityFactor
} from '../interfaces/KnowledgePrioritization.interface';
import { v4 as uuidv4 } from 'uuid';

describe('DefaultKnowledgePrioritization', () => {
  let prioritization: DefaultKnowledgePrioritization;
  
  beforeEach(async () => {
    prioritization = new DefaultKnowledgePrioritization();
    await prioritization.initialize();
  });
  
  afterEach(async () => {
    await prioritization.shutdown();
  });

  it('should initialize and register default model', async () => {
    const models = await prioritization.getScoringModels();
    expect(models.length).toBeGreaterThan(0);
    
    const defaultModel = await prioritization.getScoringModel('default');
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.name).toBe('default');
  });

  it('should register custom scoring model', async () => {
    const modelId = await prioritization.registerScoringModel({
      name: 'custom-model',
      description: 'A custom scoring model',
      factorWeights: {
        [PriorityFactor.IMPORTANCE]: 1.0,
        [PriorityFactor.DOMAIN_RELEVANCE]: 0.9
      },
      categoryAdjustments: {
        [KnowledgeRelevanceCategory.CORE]: 0.5
      },
      version: '1.0.0'
    });
    
    expect(modelId).toBe('custom-model');
    
    const model = await prioritization.getScoringModel(modelId);
    expect(model).toBeDefined();
    expect(model?.name).toBe('custom-model');
    expect(model?.factorWeights[PriorityFactor.IMPORTANCE]).toBe(1.0);
  });

  it('should prioritize knowledge items', async () => {
    const testItemId = uuidv4();
    
    const result = await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [testItemId]
    });
    
    expect(result).toBeDefined();
    expect(result.prioritizedItems.length).toBe(1);
    expect(result.prioritizedItems[0].knowledgeItemId).toBe(testItemId);
    expect(result.stats).toBeDefined();
    expect(result.stats.itemsProcessed).toBe(1);
  });

  it('should get priority info for a knowledge item', async () => {
    const testItemId = uuidv4();
    
    // First, prioritize the item
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [testItemId]
    });
    
    // Then get its priority info
    const priorityInfo = await prioritization.getKnowledgePriority(testItemId);
    
    expect(priorityInfo).toBeDefined();
    expect(priorityInfo?.knowledgeItemId).toBe(testItemId);
    expect(priorityInfo?.priorityScore).toBeGreaterThanOrEqual(0);
    expect(priorityInfo?.priorityScore).toBeLessThanOrEqual(100);
  });

  it('should adjust priority for a knowledge item', async () => {
    const testItemId = uuidv4();
    
    // First, prioritize the item
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [testItemId]
    });
    
    // Get original priority
    const originalPriority = await prioritization.getKnowledgePriority(testItemId);
    expect(originalPriority).toBeDefined();
    
    // Adjust the priority
    const adjustedPriority = await prioritization.adjustPriority(
      testItemId,
      10, // Increase by 10 points
      'Test adjustment'
    );
    
    expect(adjustedPriority).toBeDefined();
    expect(adjustedPriority.priorityScore).toBe(
      Math.min(100, originalPriority!.priorityScore + 10)
    );
    expect(adjustedPriority.metadata).toHaveProperty('manualAdjustment', 10);
    expect(adjustedPriority.metadata).toHaveProperty('adjustmentReason', 'Test adjustment');
  });

  it('should set relevance category for a knowledge item', async () => {
    const testItemId = uuidv4();
    
    // First, prioritize the item
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [testItemId]
    });
    
    // Set relevance category
    const result = await prioritization.setRelevanceCategory(
      testItemId,
      KnowledgeRelevanceCategory.CORE,
      'This is core knowledge'
    );
    
    expect(result).toBe(true);
    
    // Get updated priority
    const updatedPriority = await prioritization.getKnowledgePriority(testItemId);
    expect(updatedPriority?.relevanceCategory).toBe(KnowledgeRelevanceCategory.CORE);
    expect(updatedPriority?.metadata).toHaveProperty('categoryChangeReason', 'This is core knowledge');
  });

  it('should get top priority items', async () => {
    // Create several items with different priorities
    const itemId = uuidv4(); // Create a single item we'll prioritize highest
    const otherIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4()]; // Other items
    
    // First prioritize all items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: [itemId, ...otherIds]
    });
    
    // Dramatically increase the priority of our test item to ensure it's included
    await prioritization.adjustPriority(itemId, 100, 'Make highest priority');
    
    // Get top 3 items
    const topItems = await prioritization.getTopPriorityItems(3);
    
    // Basic functionality checks
    expect(topItems).toBeDefined();
    expect(topItems.length).toBe(3);
    
    // Only verify that our high-priority item is included in the results
    const topItemIds = topItems.map(item => item.knowledgeItemId);
    expect(topItemIds).toContain(itemId);
  });

  it('should schedule and cancel prioritization jobs', async () => {
    const jobId = await prioritization.schedulePrioritization(
      '0 0 * * *', // Midnight every day (cron syntax)
      { knowledgeItemIds: [uuidv4()] }
    );
    
    expect(jobId).toBeDefined();
    
    const cancelResult = await prioritization.cancelScheduledPrioritization(jobId);
    expect(cancelResult).toBe(true);
    
    // Canceling a non-existent job should return false
    const invalidResult = await prioritization.cancelScheduledPrioritization('invalid-id');
    expect(invalidResult).toBe(false);
  });

  it('should generate priority statistics', async () => {
    // Create several items with different categories and levels
    const itemIds = [uuidv4(), uuidv4(), uuidv4()];
    
    // Prioritize all items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: itemIds
    });
    
    // Adjust categories and priorities
    await prioritization.setRelevanceCategory(itemIds[0], KnowledgeRelevanceCategory.CORE);
    await prioritization.setRelevanceCategory(itemIds[1], KnowledgeRelevanceCategory.SUPPORTING);
    await prioritization.setRelevanceCategory(itemIds[2], KnowledgeRelevanceCategory.CONTEXTUAL);
    
    await prioritization.adjustPriority(itemIds[0], 90, 'Make critical');
    await prioritization.adjustPriority(itemIds[1], 60, 'Make high');
    await prioritization.adjustPriority(itemIds[2], 30, 'Make medium');
    
    // Get stats
    const stats = await prioritization.getPriorityStats();
    
    expect(stats).toBeDefined();
    expect(stats.totalItems).toBe(3);
    expect(stats.levelCounts[KnowledgePriorityLevel.CRITICAL]).toBeGreaterThan(0);
    expect(stats.categoryCounts[KnowledgeRelevanceCategory.CORE]).toBe(1);
    expect(stats.categoryCounts[KnowledgeRelevanceCategory.SUPPORTING]).toBe(1);
    expect(stats.categoryCounts[KnowledgeRelevanceCategory.CONTEXTUAL]).toBe(1);
    expect(stats.topPriorityItems.length).toBeGreaterThan(0);
    expect(stats.topPriorityItems[0].knowledgeItemId).toBe(itemIds[0]);
  });

  it('should generate priority reports in different formats', async () => {
    // Create a few items
    const itemIds = [uuidv4(), uuidv4()];
    
    // Prioritize all items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: itemIds
    });
    
    // Get reports in different formats
    const jsonReport = await prioritization.generatePriorityReport('json');
    const markdownReport = await prioritization.generatePriorityReport('markdown');
    const textReport = await prioritization.generatePriorityReport('text');
    
    // Verify JSON report
    expect(jsonReport).toContain('"stats"');
    expect(jsonReport).toContain('"priorities"');
    expect(() => JSON.parse(jsonReport)).not.toThrow();
    
    // Verify markdown report
    expect(markdownReport).toContain('# Knowledge Priority Report');
    expect(markdownReport).toContain('## Summary');
    
    // Verify text report
    expect(textReport).toContain('Knowledge Priority Report');
    expect(textReport).toContain('Summary:');
  });

  it('should clear all priority data', async () => {
    // Create a few items
    const itemIds = [uuidv4(), uuidv4()];
    
    // Prioritize all items
    await prioritization.prioritizeKnowledge({
      knowledgeItemIds: itemIds
    });
    
    // Verify items exist
    const beforeStats = await prioritization.getPriorityStats();
    expect(beforeStats.totalItems).toBe(2);
    
    // Clear all data
    const clearResult = await prioritization.clear();
    expect(clearResult).toBe(true);
    
    // Verify no items exist
    const afterStats = await prioritization.getPriorityStats();
    expect(afterStats.totalItems).toBe(0);
  });
}); 