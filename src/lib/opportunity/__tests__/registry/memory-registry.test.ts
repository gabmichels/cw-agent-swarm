import { describe, test, expect, beforeEach } from 'vitest';
import { MemoryOpportunityRegistry } from '../../registry/MemoryOpportunityRegistry';
import { 
  OpportunitySource, 
  OpportunityStatus, 
  OpportunityType, 
  TimeSensitivity, 
  OpportunityPriority,
  OpportunityResult,
  OpportunityCreationOptions
} from '../../models/opportunity.model';
import { OpportunityRegistryError } from '../../errors/OpportunityError';

describe('MemoryOpportunityRegistry', () => {
  let registry: MemoryOpportunityRegistry;
  
  // Helper function to create a minimal valid trigger
  const createTrigger = (type: string, source: OpportunitySource, confidence: number = 0.8) => ({
    type,
    source,
    confidence,
    timestamp: new Date(),
    content: 'Test content',
    context: {}
  });
  
  // Create default context for tests
  const defaultContext = {
    agentId: 'test-agent',
    source: 'test',
    metadata: {},
    recentMemories: [],
    relevantKnowledge: []
  };
  
  // Helper to create opportunity with required fields
  const createOpportunityOptions = (
    overrides: Partial<OpportunityCreationOptions> = {}
  ): OpportunityCreationOptions => ({
    title: 'Test Opportunity',
    description: 'This is a test',
    type: OpportunityType.USER_ASSISTANCE,
    source: OpportunitySource.USER_INTERACTION,
    context: defaultContext,
    trigger: createTrigger('test', OpportunitySource.USER_INTERACTION),
    ...overrides
  });
  
  beforeEach(async () => {
    registry = new MemoryOpportunityRegistry();
    await registry.initialize();
  });
  
  test('should initialize successfully', async () => {
    const registry = new MemoryOpportunityRegistry();
    const result = await registry.initialize();
    expect(result).toBe(true);
  });
  
  test('should throw error if not initialized', async () => {
    const registry = new MemoryOpportunityRegistry();
    await expect(registry.createOpportunity(
      createOpportunityOptions()
    )).rejects.toBeInstanceOf(OpportunityRegistryError);
  });
  
  test('should create an opportunity', async () => {
    const opportunity = await registry.createOpportunity(
      createOpportunityOptions()
    );
    
    expect(opportunity).toBeDefined();
    expect(opportunity.id).toBeDefined();
    expect(opportunity.title).toBe('Test Opportunity');
    expect(opportunity.status).toBe(OpportunityStatus.DETECTED);
    expect(opportunity.detectedAt).toBeInstanceOf(Date);
  });
  
  test('should get opportunity by ID', async () => {
    const created = await registry.createOpportunity(
      createOpportunityOptions()
    );
    
    const retrieved = await registry.getOpportunityById(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.title).toBe('Test Opportunity');
  });
  
  test('should return null for non-existent opportunity ID', async () => {
    const result = await registry.getOpportunityById('non-existent-id');
    expect(result).toBeNull();
  });
  
  test('should update an opportunity', async () => {
    const created = await registry.createOpportunity(
      createOpportunityOptions()
    );
    
    await new Promise(resolve => setTimeout(resolve, 5));
    
    const updated = await registry.updateOpportunity(created.id, {
      title: 'Updated Title',
      priority: OpportunityPriority.HIGH
    });
    
    expect(updated).toBeDefined();
    expect(updated?.title).toBe('Updated Title');
    expect(updated?.priority).toBe(OpportunityPriority.HIGH);
    expect(updated?.updatedAt).toBeInstanceOf(Date);
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });
  
  test('should update opportunity status', async () => {
    const created = await registry.createOpportunity(
      createOpportunityOptions()
    );
    
    const processingStartTime = new Date();
    
    const updated = await registry.updateOpportunityStatus(
      created.id,
      OpportunityStatus.IN_PROGRESS,
      { processingStartTime } // Using Record<string, unknown>
    );
    
    expect(updated).toBeDefined();
    expect(updated?.status).toBe(OpportunityStatus.IN_PROGRESS);
    expect(updated?.result).toBeDefined();
  });
  
  test('should delete an opportunity', async () => {
    const created = await registry.createOpportunity(
      createOpportunityOptions()
    );
    
    const deleteResult = await registry.deleteOpportunity(created.id);
    expect(deleteResult).toBe(true);
    
    const retrieveResult = await registry.getOpportunityById(created.id);
    expect(retrieveResult).toBeNull();
  });
  
  test('should return false when deleting non-existent opportunity', async () => {
    const result = await registry.deleteOpportunity('non-existent-id');
    expect(result).toBe(false);
  });
  
  test('should find opportunities by filter', async () => {
    // Create test opportunities
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'High Priority Task',
        description: 'This is high priority',
        type: OpportunityType.TASK_OPTIMIZATION,
        priority: OpportunityPriority.HIGH,
        trigger: createTrigger('test', OpportunitySource.USER_INTERACTION, 0.8)
      })
    );
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Low Priority Task',
        description: 'This is low priority',
        type: OpportunityType.TASK_OPTIMIZATION,
        priority: OpportunityPriority.LOW,
        trigger: createTrigger('test', OpportunitySource.USER_INTERACTION, 0.6)
      })
    );
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Error Prevention',
        description: 'Prevent an error',
        type: OpportunityType.ERROR_PREVENTION,
        source: OpportunitySource.MEMORY_PATTERN,
        priority: OpportunityPriority.CRITICAL,
        trigger: createTrigger('pattern', OpportunitySource.MEMORY_PATTERN, 0.9)
      })
    );
    
    // Find by type
    const taskOpportunities = await registry.findOpportunities({
      types: [OpportunityType.TASK_OPTIMIZATION]
    });
    
    expect(taskOpportunities.length).toBe(2);
    expect(taskOpportunities[0].type).toBe(OpportunityType.TASK_OPTIMIZATION);
    expect(taskOpportunities[1].type).toBe(OpportunityType.TASK_OPTIMIZATION);
    
    // Find by priority
    const highPriorityOpportunities = await registry.findOpportunities({
      priorities: [OpportunityPriority.HIGH, OpportunityPriority.CRITICAL]
    });
    
    expect(highPriorityOpportunities.length).toBe(2);
    expect(highPriorityOpportunities.some(o => o.priority === OpportunityPriority.HIGH)).toBe(true);
    expect(highPriorityOpportunities.some(o => o.priority === OpportunityPriority.CRITICAL)).toBe(true);
    
    // Find by source
    const memoryPatternOpportunities = await registry.findOpportunities({
      sources: [OpportunitySource.MEMORY_PATTERN]
    });
    
    expect(memoryPatternOpportunities.length).toBe(1);
    expect(memoryPatternOpportunities[0].source).toBe(OpportunitySource.MEMORY_PATTERN);
    
    // Find by search text
    const errorOpportunities = await registry.findOpportunities({
      searchText: 'error'
    });
    
    expect(errorOpportunities.length).toBe(1);
    expect(errorOpportunities[0].title).toBe('Error Prevention');
    
    // Apply ordering
    const orderedByPriority = await registry.findOpportunities(
      {},
      { field: 'priority', direction: 'desc' }
    );
    
    expect(orderedByPriority.length).toBe(3);
    expect(orderedByPriority[0].priority).toBe(OpportunityPriority.CRITICAL);
    
    // Apply limit and offset
    const limitedResults = await registry.findOpportunities(
      {},
      { field: 'priority', direction: 'desc' },
      1
    );
    
    expect(limitedResults.length).toBe(1);
    expect(limitedResults[0].priority).toBe(OpportunityPriority.CRITICAL);
    
    const offsetResults = await registry.findOpportunities(
      {},
      { field: 'priority', direction: 'desc' },
      2,
      1
    );
    
    expect(offsetResults.length).toBe(2);
    expect(offsetResults[0].priority).toBe(OpportunityPriority.HIGH);
  });
  
  test('should find opportunities for an agent', async () => {
    // Create test opportunities for different agents
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Agent1 Opportunity',
        description: 'This is for agent1',
        context: {
          ...defaultContext,
          agentId: 'agent1'
        }
      })
    );
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Agent2 Opportunity',
        description: 'This is for agent2',
        context: {
          ...defaultContext,
          agentId: 'agent2'
        }
      })
    );
    
    // Find by agent ID
    const agent1Opportunities = await registry.findOpportunitiesForAgent('agent1');
    expect(agent1Opportunities.length).toBe(1);
    expect(agent1Opportunities[0].title).toBe('Agent1 Opportunity');
    expect(agent1Opportunities[0].context.agentId).toBe('agent1');
    
    const agent2Opportunities = await registry.findOpportunitiesForAgent('agent2');
    expect(agent2Opportunities.length).toBe(1);
    expect(agent2Opportunities[0].title).toBe('Agent2 Opportunity');
    expect(agent2Opportunities[0].context.agentId).toBe('agent2');
    
    // Find with additional filter
    const agent1FilteredOpportunities = await registry.findOpportunitiesForAgent(
      'agent1',
      { types: [OpportunityType.USER_ASSISTANCE] }
    );
    
    expect(agent1FilteredOpportunities.length).toBe(1);
    expect(agent1FilteredOpportunities[0].context.agentId).toBe('agent1');
  });
  
  test('should count opportunities', async () => {
    // Create test opportunities
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Opportunity 1',
        type: OpportunityType.USER_ASSISTANCE,
      })
    );
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Opportunity 2',
        type: OpportunityType.ERROR_PREVENTION,
        source: OpportunitySource.MEMORY_PATTERN,
        trigger: createTrigger('pattern', OpportunitySource.MEMORY_PATTERN)
      })
    );
    
    // Count all opportunities
    const totalCount = await registry.countOpportunities();
    expect(totalCount).toBeGreaterThanOrEqual(2);
    
    // Count with filter
    const userAssistanceCount = await registry.countOpportunities({
      types: [OpportunityType.USER_ASSISTANCE]
    });
    
    expect(userAssistanceCount).toBe(1);
  });
  
  test('should clear expired opportunities', async () => {
    // Create an opportunity with a past validUntil date
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Expired Opportunity',
        description: 'This is expired',
        validUntil: pastDate
      })
    );
    
    // Create an opportunity with a future validUntil date
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
    
    await registry.createOpportunity(
      createOpportunityOptions({
        title: 'Valid Opportunity',
        description: 'This is still valid',
        validUntil: futureDate
      })
    );
    
    // Clear expired opportunities
    const clearedCount = await registry.clearExpiredOpportunities();
    expect(clearedCount).toBeGreaterThanOrEqual(1);
    
    // Verify expired opportunity is now marked as expired
    const opportunities = await registry.findOpportunities({
      statuses: [OpportunityStatus.EXPIRED]
    });
    
    expect(opportunities.length).toBeGreaterThanOrEqual(1);
    expect(opportunities.some(o => o.title === 'Expired Opportunity')).toBe(true);
  });
  
  test('should return health status', async () => {
    const health = await registry.getHealth();
    
    expect(health.isHealthy).toBe(true);
    expect(health.lastCheck).toBeInstanceOf(Date);
    expect(health.details).toBeDefined();
    expect(health.details?.opportunityCount).toBeDefined();
  });
}); 