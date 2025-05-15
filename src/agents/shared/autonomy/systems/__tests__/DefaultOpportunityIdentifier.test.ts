/**
 * Tests for DefaultOpportunityIdentifier
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { DefaultOpportunityIdentifier } from '../DefaultOpportunityIdentifier';
import { OpportunityType, OpportunityPriority } from '../../interfaces/OpportunityIdentification.interface';
import { AgentBase } from '../../../base/AgentBase.interface';
import { ManagerType } from '../../../base/managers/ManagerType';
import { KnowledgeEntry } from '../../../base/managers/KnowledgeManager.interface';

describe('DefaultOpportunityIdentifier', () => {
  let mockAgent: AgentBase;
  let opportunityIdentifier: DefaultOpportunityIdentifier;

  // Create mock managers
  const mockMemoryManager = {
    getRecentMemories: vi.fn().mockResolvedValue([
      { id: 'mem1', content: 'Test memory content' }
    ])
  };

  // Create mock knowledge entry
  const mockKnowledgeEntry: KnowledgeEntry = {
    id: 'know1',
    title: 'Test Knowledge',
    content: 'Test knowledge content',
    source: 'test',
    timestamp: new Date()
  };

  const mockKnowledgeManager = {
    searchKnowledge: vi.fn().mockResolvedValue([
      { entry: mockKnowledgeEntry, relevance: 1.0 }
    ])
  };

  const mockReflectionManager = {
    reflect: vi.fn().mockResolvedValue({ success: true })
  };

  beforeEach(async () => {
    // Reset mock function calls and timers
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock agent
    mockAgent = {
      getAgentId: () => 'test-agent',
      getManager: (type: ManagerType) => {
        switch (type) {
          case ManagerType.MEMORY:
            return mockMemoryManager;
          case ManagerType.KNOWLEDGE:
            return mockKnowledgeManager;
          case ManagerType.REFLECTION:
            return mockReflectionManager;
          default:
            return null;
        }
      }
    } as unknown as AgentBase;

    opportunityIdentifier = new DefaultOpportunityIdentifier(mockAgent);
    // Initialize in beforeEach to ensure clean state
    await opportunityIdentifier.initialize();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should initialize successfully', async () => {
    // Create new instance to test initialization
    const newIdentifier = new DefaultOpportunityIdentifier(mockAgent);
    const result = await newIdentifier.initialize();
    expect(result).toBe(true);
  });

  test('should detect triggers in content', async () => {
    const content = 'The system is slow and inefficient, causing performance issues';
    const triggers = await opportunityIdentifier.detectTriggers(content);

    expect(triggers.length).toBeGreaterThan(0);
    expect(triggers[0].type).toBeDefined();
    expect(triggers[0].confidence).toBeGreaterThan(0);
    expect(triggers[0].context.content).toBe(content);
  });

  test('should identify opportunities from triggers', async () => {
    const content = 'User requested assistance with task optimization';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    const result = await opportunityIdentifier.identifyOpportunities(triggers);

    expect(result.opportunities.length).toBeGreaterThan(0);
    expect(result.opportunities[0].type).toBeDefined();
    expect(result.opportunities[0].priority).toBeDefined();
    expect(result.triggerCount).toBe(triggers.length);
  });

  test('should filter opportunities by type', async () => {
    const content = 'The system is slow and inefficient, needs performance optimization';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    await opportunityIdentifier.identifyOpportunities(triggers);

    const opportunities = await opportunityIdentifier.getOpportunities({
      type: OpportunityType.PERFORMANCE_OPTIMIZATION
    });

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0].type).toBe(OpportunityType.PERFORMANCE_OPTIMIZATION);
  });

  test('should update opportunity status', async () => {
    const content = 'Error occurred in task execution';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    const result = await opportunityIdentifier.identifyOpportunities(triggers);
    const opportunityId = result.opportunities[0].id;

    const updateResult = await opportunityIdentifier.updateOpportunityStatus(
      opportunityId,
      'completed',
      { success: true }
    );

    expect(updateResult).toBe(true);

    const opportunities = await opportunityIdentifier.getOpportunities({
      status: 'completed'
    });
    expect(opportunities[0].status).toBe('completed');
    expect(opportunities[0].result).toEqual({ success: true });
  });

  test('should clear expired opportunities', async () => {
    // Create some opportunities that will expire
    const content = 'Multiple tasks need optimization';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    await opportunityIdentifier.identifyOpportunities(triggers);

    // Fast forward time (mock)
    const futureDate = new Date(Date.now() + 25 * 60 * 60 * 1000); // 25 hours later
    vi.setSystemTime(futureDate);

    const clearedCount = await opportunityIdentifier.clearExpiredOpportunities();
    expect(clearedCount).toBeGreaterThan(0);
  });

  test('should handle high priority opportunities', async () => {
    const content = 'Critical error needs immediate attention';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    await opportunityIdentifier.identifyOpportunities(triggers);

    const highPriorityOpps = await opportunityIdentifier.getOpportunities({
      priority: OpportunityPriority.HIGH
    });

    expect(highPriorityOpps.length).toBeGreaterThan(0);
    expect(highPriorityOpps[0].priority).toBe(OpportunityPriority.HIGH);
  });

  test('should gather context from managers', async () => {
    const content = 'Need to optimize task performance';
    const triggers = await opportunityIdentifier.detectTriggers(content);
    const result = await opportunityIdentifier.identifyOpportunities(triggers);

    const opportunity = result.opportunities[0];
    expect(opportunity.context.recentMemories).toBeDefined();
    expect(opportunity.context.relevantKnowledge).toBeDefined();
    expect(mockMemoryManager.getRecentMemories).toHaveBeenCalled();
    expect(mockKnowledgeManager.searchKnowledge).toHaveBeenCalled();
  });

  test('should handle missing managers gracefully', async () => {
    const mockAgentWithoutManagers = {
      getAgentId: () => 'test-agent',
      getManager: () => null
    } as unknown as AgentBase;

    const identifier = new DefaultOpportunityIdentifier(mockAgentWithoutManagers);

    // We expect initialization to fail gracefully
    const initResult = await identifier.initialize();
    expect(initResult).toBe(false);
  });
});