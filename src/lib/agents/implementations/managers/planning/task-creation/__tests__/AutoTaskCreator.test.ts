/**
 * AutoTaskCreator.test.ts - Unit tests for AutoTaskCreator component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoTaskCreator } from '../AutoTaskCreator';
import { TaskDetector } from '../TaskDetector';
import { PriorityAnalyzer } from '../PriorityAnalyzer';
import { SchedulingAnalyzer } from '../SchedulingAnalyzer';
import { 
  TaskCreationConfig,
  TaskCreationResult,
  TaskPriority 
} from '../../interfaces/TaskCreationInterfaces';
import { TaskStatus, TaskScheduleType } from '../../../../../../scheduler/models/Task.model';

// Mock the dependencies
vi.mock('../TaskDetector');
vi.mock('../PriorityAnalyzer');
vi.mock('../SchedulingAnalyzer');

describe('AutoTaskCreator', () => {
  let autoTaskCreator: AutoTaskCreator;
  let mockTaskDetector: any;
  let mockPriorityAnalyzer: any;
  let mockSchedulingAnalyzer: any;

  beforeEach(() => {
    // Create mock instances
    mockTaskDetector = {
      detectTaskIntent: vi.fn(),
      extractTaskInfo: vi.fn()
    } as any;

    mockPriorityAnalyzer = {
      analyzePriority: vi.fn(),
      detectUrgency: vi.fn()
    } as any;

    mockSchedulingAnalyzer = {
      analyzeScheduling: vi.fn(),
      parseTimeExpression: vi.fn()
    } as any;

    // Create AutoTaskCreator with mocked dependencies
    autoTaskCreator = new AutoTaskCreator(
      undefined, // Use default config
      mockTaskDetector,
      mockPriorityAnalyzer,
      mockSchedulingAnalyzer
    );
  });

  describe('createTasksFromInput', () => {
    it('should create a task when all conditions are met', async () => {
      const userInput = "Create a task to review the quarterly report by Friday";
      
      // Mock successful detection
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.8,
        indicators: [
          { type: 'explicit_request', text: 'Create a task', position: 0, confidence: 0.9 }
        ],
        reasoning: 'Explicit task creation request detected',
        taskInfo: {
          name: 'Review the quarterly report',
          description: userInput,
          priority: TaskPriority.NORMAL,
          scheduledTime: undefined,
          isUrgent: false,
          metadata: { originalInput: userInput }
        }
      });

      // Mock priority analysis
      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.HIGH,
        confidence: 0.7,
        factors: [
          { type: 'keyword', description: 'Important task detected', impact: 0.7, confidence: 0.7 }
        ],
        isUrgent: false
      });

      // Mock scheduling analysis
      const scheduledTime = new Date('2024-01-05T09:00:00');
      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        scheduledTime,
        confidence: 0.8,
        timeReferenceType: 'absolute',
        originalExpression: 'by Friday',
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].task).toBeDefined();
             expect(results[0].task?.name).toBe('Review the quarterly report');
       expect(results[0].task?.priority).toBe(TaskPriority.HIGH);
       expect(results[0].task?.scheduledTime).toEqual(scheduledTime);
       expect(results[0].task?.status).toBe(TaskStatus.PENDING);
       expect(results[0].metadata?.confidence).toBe(0.8);
    });

    it('should not create task when confidence is below threshold', async () => {
      const userInput = "Maybe I should do something later";
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: false,
        confidence: 0.2, // Below default threshold of 0.3
        indicators: [],
        reasoning: 'Low confidence in task creation intent'
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
             expect(results[0].error?.code).toBe('NO_TASK_INTENT');
       expect(results[0].error?.details?.confidence).toBe(0.2);
    });

    it('should not create task when task creation is disabled', async () => {
      const disabledCreator = new AutoTaskCreator({ enabled: false });
      const userInput = "Create a task to do something";

      const results = await disabledCreator.createTasksFromInput(userInput);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe('TASK_CREATION_DISABLED');
    });

    it('should handle errors gracefully', async () => {
      const userInput = "Create a task";
      
      mockTaskDetector.detectTaskIntent.mockRejectedValue(new Error('Detection failed'));

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe('TASK_CREATION_ERROR');
      expect(results[0].error?.message).toBe('Detection failed');
    });

    it('should create task with default scheduling when no time specified', async () => {
      const userInput = "Create a task to review document";
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.8,
        indicators: [],
        reasoning: 'Task creation detected',
        taskInfo: {
          name: 'Review document',
          description: userInput,
          priority: TaskPriority.NORMAL,
          scheduledTime: undefined,
          isUrgent: false,
          metadata: {}
        }
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.NORMAL,
        confidence: 0.5,
        factors: [],
        isUrgent: false
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        confidence: 0,
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results[0].success).toBe(true);
      expect(results[0].task?.scheduleType).toBe(TaskScheduleType.PRIORITY);
      expect(results[0].task?.scheduledTime).toBeUndefined();
    });

    it('should create task with explicit scheduling when time specified', async () => {
      const userInput = "Create a task for tomorrow at 2 PM";
      const scheduledTime = new Date('2024-01-04T14:00:00');
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.9,
        indicators: [],
        reasoning: 'Task creation with scheduling detected',
        taskInfo: {
          name: 'Task for tomorrow',
          description: userInput,
          priority: TaskPriority.NORMAL,
          scheduledTime,
          isUrgent: false,
          metadata: {}
        }
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.NORMAL,
        confidence: 0.5,
        factors: [],
        isUrgent: false
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        scheduledTime,
        confidence: 0.9,
        timeReferenceType: 'relative',
        originalExpression: 'tomorrow at 2 PM',
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results[0].success).toBe(true);
      expect(results[0].task?.scheduleType).toBe(TaskScheduleType.EXPLICIT);
      expect(results[0].task?.scheduledTime).toEqual(scheduledTime);
    });

    it('should include context in task metadata', async () => {
      const userInput = "Create a task";
      const context = {
        userId: 'user123',
        conversationHistory: ['Previous message'],
        timezone: 'America/New_York'
      };
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.8,
        indicators: [],
        reasoning: 'Task creation detected',
        taskInfo: {
          name: 'Task',
          description: userInput,
          priority: TaskPriority.NORMAL,
          scheduledTime: undefined,
          isUrgent: false,
          metadata: { originalInput: userInput }
        }
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.NORMAL,
        confidence: 0.5,
        factors: [],
        isUrgent: false
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        confidence: 0,
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput, context);

      expect(results[0].success).toBe(true);
             expect(results[0].task?.metadata?.context).toEqual(context);
       expect(results[0].task?.metadata?.createdBy).toBe('AutoTaskCreator');
    });

    it('should handle missing task info gracefully', async () => {
      const userInput = "Create a task";
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.8,
        indicators: [],
        reasoning: 'Task creation detected',
        taskInfo: undefined // Missing task info
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results[0].success).toBe(false);
      expect(results[0].error?.code).toBe('TASK_CREATION_ERROR');
      expect(results[0].error?.message).toContain('Task information not available');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      const newConfig: Partial<TaskCreationConfig> = {
        confidenceThreshold: 0.5,
        maxTasksPerInput: 5,
        defaultPriority: TaskPriority.HIGH
      };

      autoTaskCreator.configure(newConfig);
      const config = autoTaskCreator.getConfig();

      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.maxTasksPerInput).toBe(5);
      expect(config.defaultPriority).toBe(TaskPriority.HIGH);
    });

    it('should merge with existing configuration', () => {
      const originalConfig = autoTaskCreator.getConfig();
      
      autoTaskCreator.configure({ confidenceThreshold: 0.7 });
      const updatedConfig = autoTaskCreator.getConfig();

      expect(updatedConfig.confidenceThreshold).toBe(0.7);
      expect(updatedConfig.enabled).toBe(originalConfig.enabled); // Should remain unchanged
      expect(updatedConfig.maxTasksPerInput).toBe(originalConfig.maxTasksPerInput); // Should remain unchanged
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = autoTaskCreator.getConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.confidenceThreshold).toBe(0.3);
      expect(config.maxTasksPerInput).toBe(3);
      expect(config.defaultPriority).toBe(TaskPriority.NORMAL);
    });

    it('should return a copy of configuration', () => {
      const config1 = autoTaskCreator.getConfig();
      const config2 = autoTaskCreator.getConfig();

      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same content
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all components work', async () => {
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: false,
        confidence: 0,
        indicators: [],
        reasoning: 'Test'
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.NORMAL,
        confidence: 0.5,
        factors: [],
        isUrgent: false
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        confidence: 0,
        isRecurring: false
      });

      const health = await autoTaskCreator.getHealthStatus();

      expect(health.healthy).toBe(true);
      expect(health.components.config).toBe(true);
      expect(health.components.taskDetector).toBe(true);
      expect(health.components.priorityAnalyzer).toBe(true);
      expect(health.components.schedulingAnalyzer).toBe(true);
      expect(health.errors).toHaveLength(0);
    });

    it('should return unhealthy status when components fail', async () => {
      mockTaskDetector.detectTaskIntent.mockRejectedValue(new Error('Detector failed'));
      mockPriorityAnalyzer.analyzePriority.mockRejectedValue(new Error('Priority failed'));
      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        confidence: 0,
        isRecurring: false
      });

      const health = await autoTaskCreator.getHealthStatus();

      expect(health.healthy).toBe(false);
      expect(health.components.taskDetector).toBe(false);
      expect(health.components.priorityAnalyzer).toBe(false);
      expect(health.components.schedulingAnalyzer).toBe(true);
      expect(health.errors).toHaveLength(2);
      expect(health.errors[0]).toContain('TaskDetector failed');
      expect(health.errors[1]).toContain('PriorityAnalyzer failed');
    });

    it('should detect invalid configuration', async () => {
      const invalidCreator = new AutoTaskCreator({
        confidenceThreshold: 1.5, // Invalid - should be <= 1
        maxTasksPerInput: 0 // Invalid - should be >= 1
      });

      const health = await invalidCreator.getHealthStatus();

      expect(health.healthy).toBe(false);
      expect(health.components.config).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });
  });

  describe('configuration validation', () => {
    it('should accept valid configuration', () => {
      const validConfig: TaskCreationConfig = {
        enabled: true,
        confidenceThreshold: 0.5,
        maxTasksPerInput: 2,
        defaultPriority: TaskPriority.HIGH,
        taskIndicatorKeywords: ['create', 'schedule'],
        urgencyKeywords: ['urgent', 'asap'],
        schedulingKeywords: ['tomorrow', 'today']
      };

      expect(() => new AutoTaskCreator(validConfig)).not.toThrow();
    });

    it('should handle edge case configurations', () => {
      const edgeCaseConfigs = [
        { confidenceThreshold: 0 }, // Minimum valid threshold
        { confidenceThreshold: 1 }, // Maximum valid threshold
        { maxTasksPerInput: 1 }, // Minimum valid max tasks
        { defaultPriority: TaskPriority.LOWEST }, // Minimum priority
        { defaultPriority: TaskPriority.CRITICAL } // Maximum priority
      ];

      for (const config of edgeCaseConfigs) {
        expect(() => new AutoTaskCreator(config)).not.toThrow();
      }
    });
  });

  describe('task creation metadata', () => {
    it('should include comprehensive metadata in created tasks', async () => {
      const userInput = "Create urgent task";
      const context = { userId: 'test123' };
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.9,
        indicators: [
          { type: 'urgency_marker', text: 'urgent', position: 7, confidence: 0.9 }
        ],
        reasoning: 'Urgent task detected',
        taskInfo: {
          name: 'Urgent task',
          description: userInput,
          priority: TaskPriority.HIGH,
          scheduledTime: undefined,
          isUrgent: true,
          metadata: { keywords: ['urgent'] }
        }
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.HIGHEST,
        confidence: 0.9,
        factors: [
          { type: 'keyword', description: 'Urgent keyword detected', impact: 0.9, confidence: 0.9 }
        ],
        isUrgent: true
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        confidence: 0,
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput, context);

      expect(results[0].success).toBe(true);
      const task = results[0].task!;
      
             expect(task.metadata?.createdBy).toBe('AutoTaskCreator');
       expect(task.metadata?.confidence).toBe(0.9);
       expect(task.metadata?.detectionIndicators).toHaveLength(1);
       expect(task.metadata?.priorityFactors).toHaveLength(1);
             expect(task.metadata?.originalInput).toBe(userInput);
       expect(task.metadata?.context).toEqual(context);
       expect(task.metadata?.isUrgent).toBe(true);
       expect(task.metadata?.createdAt).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex task creation with all features', async () => {
      const userInput = "URGENT: Create a high-priority task to review the Q4 budget report by tomorrow at 2 PM";
      const scheduledTime = new Date('2024-01-04T14:00:00');
      
      mockTaskDetector.detectTaskIntent.mockResolvedValue({
        shouldCreateTask: true,
        confidence: 0.95,
        indicators: [
          { type: 'explicit_request', text: 'Create a task', position: 8, confidence: 0.9 },
          { type: 'urgency_marker', text: 'URGENT', position: 0, confidence: 0.9 },
          { type: 'time_reference', text: 'tomorrow at 2 PM', position: 65, confidence: 0.8 }
        ],
        reasoning: 'Multiple strong indicators for task creation',
        taskInfo: {
          name: 'Review the Q4 budget report',
          description: userInput,
          priority: TaskPriority.HIGH,
          scheduledTime,
          isUrgent: true,
          metadata: { keywords: ['Q4', 'budget', 'report'] }
        }
      });

      mockPriorityAnalyzer.analyzePriority.mockResolvedValue({
        priority: TaskPriority.CRITICAL,
        confidence: 0.95,
        factors: [
          { type: 'keyword', description: 'URGENT keyword detected', impact: 0.9, confidence: 0.9 },
          { type: 'keyword', description: 'high-priority keyword detected', impact: 0.8, confidence: 0.8 }
        ],
        isUrgent: true
      });

      mockSchedulingAnalyzer.analyzeScheduling.mockResolvedValue({
        scheduledTime,
        confidence: 0.9,
        timeReferenceType: 'relative',
        originalExpression: 'tomorrow at 2 PM',
        isRecurring: false
      });

      const results = await autoTaskCreator.createTasksFromInput(userInput);

      expect(results[0].success).toBe(true);
      const task = results[0].task!;
      
      expect(task.name).toBe('Review the Q4 budget report');
      expect(task.priority).toBe(TaskPriority.CRITICAL);
      expect(task.scheduledTime).toEqual(scheduledTime);
      expect(task.scheduleType).toBe(TaskScheduleType.EXPLICIT);
             expect(task.metadata?.isUrgent).toBe(true);
       expect(results[0].metadata?.confidence).toBe(0.95);
    });
  });
}); 