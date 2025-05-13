/**
 * Knowledge Acquisition Interface Tests
 * 
 * This file contains tests for the KnowledgeAcquisition interface,
 * validating that implementations properly adhere to the contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { 
  KnowledgeAcquisition,
  KnowledgeSourceType, 
  KnowledgeAcquisitionStatus, 
  KnowledgeValidationLevel,
  KnowledgeConfidenceLevel,
  KnowledgeSource,
  KnowledgeAcquisitionTask,
  KnowledgeAcquisitionResult,
  KnowledgeIntegrationResult
} from '../interfaces/KnowledgeAcquisition.interface';

// Create mock implementation for testing
class MockKnowledgeAcquisition implements KnowledgeAcquisition {
  private tasks: Map<string, KnowledgeAcquisitionTask> = new Map();
  private sources: Map<string, KnowledgeSource> = new Map();
  private results: Map<string, KnowledgeAcquisitionResult> = new Map();
  private integrationResults: Map<string, KnowledgeIntegrationResult> = new Map();

  async createAcquisitionTask(
    description: string,
    options: any = {}
  ): Promise<KnowledgeAcquisitionTask> {
    const id = uuidv4();
    const now = new Date();
    
    const task: KnowledgeAcquisitionTask = {
      id,
      description,
      createdAt: now,
      status: KnowledgeAcquisitionStatus.PENDING,
      priority: options.priority || 0.5,
      knowledgeGapId: options.knowledgeGapId,
      deadline: options.deadline,
      sources: options.sources || [],
      acquisitionStrategy: options.acquisitionStrategy || {
        name: 'default',
        description: 'Default acquisition strategy',
        parameters: {}
      },
      validationRequirements: options.validationRequirements || {
        requiredLevel: KnowledgeValidationLevel.BASIC,
        methods: ['basic_validation'],
        minimumConfidence: 0.7
      }
    };
    
    this.tasks.set(id, task);
    return task;
  }

  async executeAcquisitionTask(taskId: string): Promise<KnowledgeAcquisitionResult> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Update task status
    task.status = KnowledgeAcquisitionStatus.IN_PROGRESS;
    this.tasks.set(taskId, task);
    
    // Create mock result
    const result: KnowledgeAcquisitionResult = {
      taskId,
      knowledgeEntries: [
        {
          content: 'Test knowledge content',
          title: 'Test knowledge',
          confidenceScore: 0.8,
          confidenceLevel: KnowledgeConfidenceLevel.HIGH,
          validationLevel: KnowledgeValidationLevel.BASIC,
          sources: task.sources.map(s => s.id),
          metadata: {
            createdAt: new Date()
          }
        }
      ],
      acquiredAt: new Date(),
      success: true,
      metrics: {
        acquisitionTimeMs: 1000,
        validationTimeMs: 500,
        sourcesProcessed: task.sources.length,
        entriesRejected: 0
      }
    };
    
    // Update task status and result
    task.status = KnowledgeAcquisitionStatus.ACQUIRED;
    task.result = result;
    this.tasks.set(taskId, task);
    
    // Store result
    this.results.set(taskId, result);
    
    return result;
  }

  async integrateAcquiredKnowledge(
    acquisitionResultId: string,
    options: any = {}
  ): Promise<KnowledgeIntegrationResult> {
    const result = this.results.get(acquisitionResultId);
    if (!result) {
      throw new Error(`Acquisition result not found: ${acquisitionResultId}`);
    }
    
    // Create mock integration result
    const integrationResult: KnowledgeIntegrationResult = {
      acquisitionResultId,
      integratedEntryIds: ['entry-1'],
      integratedAt: new Date(),
      impact: {
        knowledgeBaseImpact: 0.2,
        newRelationships: 3,
        modifiedRelationships: 1,
        conflictsResolved: 0,
        gapsClosed: 1
      },
      integrationMethod: options.integrationMethod || 'default',
      success: true
    };
    
    // Store integration result
    this.integrationResults.set(acquisitionResultId, integrationResult);
    
    // Update task status if we can find it
    const task = this.tasks.get(result.taskId);
    if (task) {
      task.status = KnowledgeAcquisitionStatus.INTEGRATED;
      this.tasks.set(task.id, task);
    }
    
    return integrationResult;
  }

  async getAcquisitionTask(taskId: string): Promise<KnowledgeAcquisitionTask | null> {
    return this.tasks.get(taskId) || null;
  }

  async findAcquisitionTasks(options: any = {}): Promise<KnowledgeAcquisitionTask[]> {
    let tasks = Array.from(this.tasks.values());
    
    // Apply filters based on options
    if (options.status) {
      tasks = tasks.filter(t => t.status === options.status);
    }
    
    if (options.knowledgeGapId) {
      tasks = tasks.filter(t => t.knowledgeGapId === options.knowledgeGapId);
    }
    
    if (options.priorityMin !== undefined) {
      tasks = tasks.filter(t => t.priority >= options.priorityMin);
    }
    
    if (options.priorityMax !== undefined) {
      tasks = tasks.filter(t => t.priority <= options.priorityMax);
    }
    
    // Apply limit
    if (options.limit && options.limit > 0) {
      tasks = tasks.slice(0, options.limit);
    }
    
    return tasks;
  }

  async cancelAcquisitionTask(taskId: string, reason: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    
    // Cannot cancel completed tasks
    if (
      task.status === KnowledgeAcquisitionStatus.INTEGRATED ||
      task.status === KnowledgeAcquisitionStatus.FAILED
    ) {
      return false;
    }
    
    // Update status
    task.status = KnowledgeAcquisitionStatus.FAILED;
    this.tasks.set(taskId, task);
    
    return true;
  }

  async updateAcquisitionTask(
    taskId: string,
    updates: Partial<KnowledgeAcquisitionTask>
  ): Promise<KnowledgeAcquisitionTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    
    // Apply updates
    const updatedTask = {
      ...task,
      ...updates,
      id: task.id, // Ensure ID cannot be changed
      createdAt: task.createdAt // Ensure creation date cannot be changed
    };
    
    this.tasks.set(taskId, updatedTask);
    return updatedTask;
  }

  async registerKnowledgeSource(
    source: Omit<KnowledgeSource, 'id'>
  ): Promise<KnowledgeSource> {
    const id = uuidv4();
    const newSource: KnowledgeSource = {
      ...source,
      id
    };
    
    this.sources.set(id, newSource);
    return newSource;
  }

  async getAcquisitionResult(taskId: string): Promise<KnowledgeAcquisitionResult | null> {
    return this.results.get(taskId) || null;
  }

  async getIntegrationResult(acquisitionResultId: string): Promise<KnowledgeIntegrationResult | null> {
    return this.integrationResults.get(acquisitionResultId) || null;
  }
}

describe('KnowledgeAcquisition Interface', () => {
  let acquisition: KnowledgeAcquisition;

  beforeEach(() => {
    // Create a fresh instance for each test
    acquisition = new MockKnowledgeAcquisition();
  });

  describe('Task Management', () => {
    it('should create an acquisition task', async () => {
      const description = 'Test acquisition task';
      const task = await acquisition.createAcquisitionTask(description);
      
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.description).toBe(description);
      expect(task.status).toBe(KnowledgeAcquisitionStatus.PENDING);
    });
    
    it('should create a task with custom options', async () => {
      const options = {
        priority: 0.8,
        knowledgeGapId: 'gap-123',
        validationRequirements: {
          requiredLevel: KnowledgeValidationLevel.MODERATE,
          methods: ['cross_reference'],
          minimumConfidence: 0.85
        }
      };
      
      const task = await acquisition.createAcquisitionTask('Custom task', options);
      
      expect(task.priority).toBe(0.8);
      expect(task.knowledgeGapId).toBe('gap-123');
      expect(task.validationRequirements.requiredLevel).toBe(KnowledgeValidationLevel.MODERATE);
    });
    
    it('should get a task by ID', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      const retrieved = await acquisition.getAcquisitionTask(task.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(task.id);
    });
    
    it('should return null for non-existent task', async () => {
      const retrieved = await acquisition.getAcquisitionTask('non-existent');
      expect(retrieved).toBeNull();
    });
    
    it('should find tasks by status', async () => {
      await acquisition.createAcquisitionTask('Task 1');
      await acquisition.createAcquisitionTask('Task 2');
      
      const tasks = await acquisition.findAcquisitionTasks({
        status: KnowledgeAcquisitionStatus.PENDING
      });
      
      expect(tasks).toHaveLength(2);
      expect(tasks[0].status).toBe(KnowledgeAcquisitionStatus.PENDING);
    });
    
    it('should cancel a task', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      const result = await acquisition.cancelAcquisitionTask(task.id, 'Testing');
      
      expect(result).toBe(true);
      
      const updated = await acquisition.getAcquisitionTask(task.id);
      expect(updated?.status).toBe(KnowledgeAcquisitionStatus.FAILED);
    });
    
    it('should update a task', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      const updates = {
        description: 'Updated description',
        priority: 0.9
      };
      
      const updated = await acquisition.updateAcquisitionTask(task.id, updates);
      
      expect(updated.description).toBe('Updated description');
      expect(updated.priority).toBe(0.9);
      expect(updated.id).toBe(task.id); // ID should not change
    });
  });

  describe('Source Management', () => {
    it('should register a knowledge source', async () => {
      const sourceData = {
        name: 'Test Source',
        type: KnowledgeSourceType.WEB,
        location: 'https://example.com',
        reliability: 0.7,
        metadata: {},
        accessedAt: new Date()
      };
      
      const source = await acquisition.registerKnowledgeSource(sourceData);
      
      expect(source).toBeDefined();
      expect(source.id).toBeDefined();
      expect(source.name).toBe('Test Source');
      expect(source.type).toBe(KnowledgeSourceType.WEB);
    });
  });

  describe('Knowledge Acquisition Process', () => {
    it('should execute an acquisition task', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      const result = await acquisition.executeAcquisitionTask(task.id);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
      expect(result.knowledgeEntries).toHaveLength(1);
      
      // Task status should be updated
      const updatedTask = await acquisition.getAcquisitionTask(task.id);
      expect(updatedTask?.status).toBe(KnowledgeAcquisitionStatus.ACQUIRED);
    });
    
    it('should retrieve acquisition results', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      await acquisition.executeAcquisitionTask(task.id);
      
      const result = await acquisition.getAcquisitionResult(task.id);
      
      expect(result).toBeDefined();
      expect(result?.taskId).toBe(task.id);
      expect(result?.knowledgeEntries).toHaveLength(1);
    });
    
    it('should integrate acquired knowledge', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      const acquisitionResult = await acquisition.executeAcquisitionTask(task.id);
      
      const integrationResult = await acquisition.integrateAcquiredKnowledge(task.id);
      
      expect(integrationResult).toBeDefined();
      expect(integrationResult.acquisitionResultId).toBe(task.id);
      expect(integrationResult.success).toBe(true);
      expect(integrationResult.impact).toBeDefined();
      
      // Task status should be updated
      const updatedTask = await acquisition.getAcquisitionTask(task.id);
      expect(updatedTask?.status).toBe(KnowledgeAcquisitionStatus.INTEGRATED);
    });
    
    it('should retrieve integration results', async () => {
      const task = await acquisition.createAcquisitionTask('Test task');
      await acquisition.executeAcquisitionTask(task.id);
      await acquisition.integrateAcquiredKnowledge(task.id);
      
      const result = await acquisition.getIntegrationResult(task.id);
      
      expect(result).toBeDefined();
      expect(result?.acquisitionResultId).toBe(task.id);
      expect(result?.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when executing non-existent task', async () => {
      await expect(acquisition.executeAcquisitionTask('non-existent'))
        .rejects.toThrow('Task not found');
    });
    
    it('should throw error when integrating non-existent result', async () => {
      await expect(acquisition.integrateAcquiredKnowledge('non-existent'))
        .rejects.toThrow('Acquisition result not found');
    });
    
    it('should throw error when updating non-existent task', async () => {
      await expect(acquisition.updateAcquisitionTask('non-existent', { priority: 0.9 }))
        .rejects.toThrow('Task not found');
    });
  });
}); 