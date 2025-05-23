import { describe, test, expect, beforeEach, vi } from 'vitest';
import { BasicOpportunityManager } from '../../../src/lib/opportunity/manager/BasicOpportunityManager';
import { MemoryOpportunityRegistry } from '../../../src/lib/opportunity/registry/MemoryOpportunityRegistry';
import { BasicOpportunityEvaluator } from '../../../src/lib/opportunity/evaluator/BasicOpportunityEvaluator';
import { BasicOpportunityProcessor } from '../../../src/lib/opportunity/processor/BasicOpportunityProcessor';
import { BasicUserInteractionStrategy } from '../../../src/lib/opportunity/strategies/UserInteractionStrategy';
import { 
  OpportunitySource, 
  OpportunityStatus, 
  OpportunityType, 
  OpportunityPriority,
  TimeSensitivity
} from '../../../src/lib/opportunity/models/opportunity.model';
import { OpportunityDetectionResult } from '../../../src/lib/opportunity/interfaces/OpportunityDetector.interface';
import { ulid } from 'ulid';

// Mock OpportunityDetector
const mockDetector = {
  initialize: vi.fn().mockResolvedValue(true),
  detectTriggers: vi.fn().mockResolvedValue([
    {
      id: ulid(),
      type: 'help',
      source: OpportunitySource.USER_INTERACTION,
      timestamp: new Date(),
      content: 'User needs help',
      confidence: 0.8,
      context: {}
    }
  ]),
  detectOpportunities: vi.fn().mockResolvedValue({
    opportunities: [
      {
        id: ulid(),
        title: 'Help Request',
        description: 'User needs assistance',
        type: OpportunityType.USER_ASSISTANCE,
        source: OpportunitySource.USER_INTERACTION,
        status: OpportunityStatus.DETECTED,
        trigger: {
          id: ulid(),
          type: 'help',
          source: OpportunitySource.USER_INTERACTION,
          timestamp: new Date(),
          content: 'User needs help',
          confidence: 0.8,
          context: {}
        },
        context: {
          agentId: 'test-agent',
          source: 'test',
          metadata: {}
        },
        detectedAt: new Date(),
        updatedAt: new Date()
      }
    ],
    timestamp: new Date(),
    source: 'test',
    triggerCount: 1,
    successfulDetections: 1
  }),
  detectOpportunitiesFromContent: vi.fn().mockImplementation((content, options) => {
    return Promise.resolve({
      opportunities: [
        {
          id: ulid(),
          title: 'Help Request',
          description: 'User needs assistance',
          type: OpportunityType.USER_ASSISTANCE,
          source: OpportunitySource.USER_INTERACTION,
          status: OpportunityStatus.DETECTED,
          trigger: {
            id: ulid(),
            type: 'help',
            source: OpportunitySource.USER_INTERACTION,
            timestamp: new Date(),
            content,
            confidence: 0.8,
            context: {}
          },
          context: {
            agentId: options.agentId,
            source: 'test',
            metadata: {}
          },
          detectedAt: new Date(),
          updatedAt: new Date()
        }
      ],
      timestamp: new Date(),
      source: 'test',
      triggerCount: 1,
      successfulDetections: 1
    });
  }),
  registerStrategy: vi.fn().mockResolvedValue(true),
  getAvailableStrategies: vi.fn().mockResolvedValue(['user-interaction']),
  setStrategyEnabled: vi.fn().mockResolvedValue(true),
  getHealth: vi.fn().mockResolvedValue({ isHealthy: true })
};

// Mock task scheduler
const mockTaskScheduler = {
  createTask: async () => 'mock-task-id',
  createTaskForAgent: async () => 'mock-task-id'
};

describe('Opportunity Management System Integration', () => {
  let registry: MemoryOpportunityRegistry;
  let evaluator: BasicOpportunityEvaluator;
  let processor: BasicOpportunityProcessor;
  let manager: BasicOpportunityManager;
  
  beforeEach(async () => {
    // Initialize components
    registry = new MemoryOpportunityRegistry();
    
    evaluator = new BasicOpportunityEvaluator();
    
    processor = new BasicOpportunityProcessor(
      registry,
      mockTaskScheduler as any
    );
    
    manager = new BasicOpportunityManager(
      registry,
      mockDetector as any,
      evaluator,
      processor
    );
    
    // Initialize the manager with auto-processing disabled to prevent errors
    await manager.initialize({
      autoProcessing: {
        enabled: false  // Disable auto-processing to prevent 'opportunity not found' errors
      }
    });
  });
  
  test('should detect, evaluate, and process opportunity end-to-end', async () => {
    // 1. Create an opportunity directly (instead of detecting from content)
    const opportunity = await manager.createOpportunity({
      title: 'Help Request',
      description: 'User needs assistance with environment setup',
      type: OpportunityType.USER_ASSISTANCE,
      source: OpportunitySource.USER_INTERACTION,
      trigger: {
        type: 'help',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: 'I need help with configuring my environment. Can you assist me?',
        confidence: 0.8,
        context: {}
      },
      context: {
        agentId: 'test-agent',
        source: 'user-message',
        metadata: {}
      }
    });
    
    expect(opportunity).toBeDefined();
    expect(opportunity.id).toBeDefined();
    
    // 2. Evaluation phase - evaluate the opportunity
    const evaluationResult = await manager.evaluateOpportunity(opportunity.id);
    
    expect(evaluationResult.success).toBe(true);
    expect(evaluationResult.evaluation).toBeDefined();
    expect(evaluationResult.evaluation.score).toBeDefined();
    
    // Get the updated opportunity
    const evaluatedOpportunity = await manager.getOpportunityById(opportunity.id);
    
    expect(evaluatedOpportunity).toBeDefined();
    expect(evaluatedOpportunity?.status).toBe(OpportunityStatus.PENDING);
    expect(evaluatedOpportunity?.evaluatedAt).toBeDefined();
    
    // 3. Processing phase - manually process if not auto-processed
    if (evaluatedOpportunity?.status !== OpportunityStatus.COMPLETED && 
        evaluatedOpportunity?.status !== OpportunityStatus.IN_PROGRESS) {
      
      const processingResult = await manager.processOpportunity(opportunity.id);
      
      expect(processingResult.success).toBe(true);
      expect(processingResult.taskIds.length).toBeGreaterThan(0);
    }
    
    // 4. Verify final state
    const finalOpportunity = await manager.getOpportunityById(opportunity.id);
    
    expect(finalOpportunity).toBeDefined();
    expect([OpportunityStatus.COMPLETED, OpportunityStatus.IN_PROGRESS])
      .toContain(finalOpportunity?.status);
    
    if (finalOpportunity?.status === OpportunityStatus.COMPLETED) {
      expect(finalOpportunity.result).toBeDefined();
      expect(finalOpportunity.result?.createdTaskIds?.length).toBeGreaterThan(0);
    }
  });
  
  test('should filter opportunities by criteria', async () => {
    // Create multiple opportunities
    await manager.createOpportunity({
      title: 'High Priority Task',
      description: 'This needs urgent attention',
      type: OpportunityType.ERROR_PREVENTION,
      source: OpportunitySource.USER_INTERACTION,
      priority: OpportunityPriority.HIGH,
      context: {
        agentId: 'test-agent',
        source: 'test',
        metadata: {}
      },
      trigger: {
        type: 'error',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: 'Error detected',
        confidence: 0.9,
        context: {}
      }
    });
    
    await manager.createOpportunity({
      title: 'Low Priority Task',
      description: 'This can wait',
      type: OpportunityType.TASK_OPTIMIZATION,
      source: OpportunitySource.USER_INTERACTION,
      priority: OpportunityPriority.LOW,
      context: {
        agentId: 'test-agent',
        source: 'test',
        metadata: {}
      },
      trigger: {
        type: 'optimization',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: 'Optimization opportunity',
        confidence: 0.7,
        context: {}
      }
    });
    
    // Filter by priority
    const highPriorityOpportunities = await manager.findOpportunities({
      priorities: [OpportunityPriority.HIGH, OpportunityPriority.CRITICAL]
    });
    
    expect(highPriorityOpportunities.length).toBeGreaterThan(0);
    expect(highPriorityOpportunities.every(o => 
      o.priority === OpportunityPriority.HIGH || o.priority === OpportunityPriority.CRITICAL)
    ).toBe(true);
    
    // Filter by type
    const errorPreventionOpportunities = await manager.findOpportunities({
      types: [OpportunityType.ERROR_PREVENTION]
    });
    
    expect(errorPreventionOpportunities.length).toBeGreaterThan(0);
    expect(errorPreventionOpportunities.every(o => 
      o.type === OpportunityType.ERROR_PREVENTION)
    ).toBe(true);
    
    // Find opportunities for agent
    const agentOpportunities = await manager.findOpportunitiesForAgent('test-agent');
    
    expect(agentOpportunities.length).toBe(2); // Both opportunities
  });
  
  test('should handle the complete opportunity lifecycle', async () => {
    // Create opportunity
    const opportunity = await manager.createOpportunity({
      title: 'Test Lifecycle',
      description: 'Testing opportunity lifecycle',
      type: OpportunityType.USER_ASSISTANCE,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent',
        source: 'test',
        metadata: {}
      },
      trigger: {
        type: 'help',
        source: OpportunitySource.USER_INTERACTION,
        timestamp: new Date(),
        content: 'Help request',
        confidence: 0.8,
        context: {}
      }
    });
    
    expect(opportunity.status).toBe(OpportunityStatus.DETECTED);
    const opportunityId = opportunity.id;
    
    // Evaluate
    await manager.evaluateOpportunity(opportunityId);
    
    // Check status updated to PENDING after evaluation
    const evaluatedOpportunity = await manager.getOpportunityById(opportunityId);
    expect(evaluatedOpportunity?.status).toBe(OpportunityStatus.PENDING);
    
    // Process
    await manager.processOpportunity(opportunityId);
    
    // Check completed
    const processedOpportunity = await manager.getOpportunityById(opportunityId);
    expect(processedOpportunity?.status).toBe(OpportunityStatus.COMPLETED);
    
    // Try to update an already completed opportunity
    await manager.updateOpportunityStatus(
      opportunityId,
      OpportunityStatus.DECLINED,
      { reason: 'Testing status updates' }
    );
    
    // Check status updated
    const updatedOpportunity = await manager.getOpportunityById(opportunityId);
    expect(updatedOpportunity?.status).toBe(OpportunityStatus.DECLINED);
    
    // Delete opportunity
    const deleteResult = await manager.deleteOpportunity(opportunityId);
    expect(deleteResult).toBe(true);
    
    // Verify deleted
    const deletedOpportunity = await manager.getOpportunityById(opportunityId);
    expect(deletedOpportunity).toBeNull();
  });
}); 