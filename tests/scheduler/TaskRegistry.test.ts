/**
 * TaskRegistry.test.ts
 * Unit tests for the MemoryTaskRegistry implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryTaskRegistry } from '../../src/lib/scheduler/implementations/registry/MemoryTaskRegistry';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

describe('MemoryTaskRegistry', () => {
  let registry: MemoryTaskRegistry;
  
  beforeEach(() => {
    registry = new MemoryTaskRegistry();
  });
  
  describe('storeTask', () => {
    it('should store a task and return it with an ID', async () => {
      const task: Task = {
        id: '',
        name: 'Test Task',
        status: TaskStatus.PENDING,
        priority: 5, // Medium priority (0-10)
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      const storedTask = await registry.storeTask(task);
      
      expect(storedTask.id).toBeTruthy();
      expect(storedTask.name).toBe(task.name);
      expect(storedTask.status).toBe(task.status);
    });
    
    it('should preserve an existing ID if provided', async () => {
      const task: Task = {
        id: 'custom-id-123',
        name: 'Task with Custom ID',
        status: TaskStatus.PENDING,
        priority: 5, // Medium priority
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      const storedTask = await registry.storeTask(task);
      
      expect(storedTask.id).toBe('custom-id-123');
    });
  });
  
  describe('getTaskById', () => {
    it('should retrieve a task by its ID', async () => {
      const task: Task = {
        id: '',
        name: 'Retrievable Task',
        status: TaskStatus.PENDING,
        priority: 8, // High priority
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      const storedTask = await registry.storeTask(task);
      const retrievedTask = await registry.getTaskById(storedTask.id);
      
      expect(retrievedTask).not.toBeNull();
      expect(retrievedTask?.id).toBe(storedTask.id);
      expect(retrievedTask?.name).toBe(task.name);
    });
    
    it('should return null for non-existent tasks', async () => {
      const retrievedTask = await registry.getTaskById('non-existent-id');
      expect(retrievedTask).toBeNull();
    });
  });
  
  describe('updateTask', () => {
    it('should update an existing task', async () => {
      // Store a task first
      const task: Task = {
        id: '',
        name: 'Original Name',
        status: TaskStatus.PENDING,
        priority: 5, // Medium priority
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      const storedTask = await registry.storeTask(task);
      
      // Update the task
      const updatedTask: Task = {
        ...storedTask,
        name: 'Updated Name',
        status: TaskStatus.RUNNING,
        priority: 8, // High priority
      };
      
      const result = await registry.updateTask(updatedTask);
      
      // Verify updates
      expect(result.id).toBe(storedTask.id);
      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe(TaskStatus.RUNNING);
      expect(result.priority).toBe(8);
      
      // Verify by retrieving again
      const retrievedTask = await registry.getTaskById(storedTask.id);
      expect(retrievedTask?.name).toBe('Updated Name');
    });
    
    it('should throw an error when updating non-existent task', async () => {
      const nonExistentTask: Task = {
        id: 'non-existent-id',
        name: 'Non-existent Task',
        status: TaskStatus.PENDING,
        priority: 5, // Medium priority
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      await expect(registry.updateTask(nonExistentTask)).rejects.toThrow();
    });
  });
  
  describe('deleteTask', () => {
    it('should delete an existing task', async () => {
      // Store a task first
      const task: Task = {
        id: '',
        name: 'Task to Delete',
        status: TaskStatus.PENDING,
        priority: 3, // Low priority
        scheduleType: TaskScheduleType.EXPLICIT,
        createdAt: new Date(),
        updatedAt: new Date(),
        handler: async () => {},
        scheduledTime: new Date(),
      };
      
      const storedTask = await registry.storeTask(task);
      
      // Delete the task
      const deleteResult = await registry.deleteTask(storedTask.id);
      expect(deleteResult).toBe(true);
      
      // Verify it's deleted
      const retrievedTask = await registry.getTaskById(storedTask.id);
      expect(retrievedTask).toBeNull();
    });
    
    it('should return false when deleting non-existent task', async () => {
      const deleteResult = await registry.deleteTask('non-existent-id');
      expect(deleteResult).toBe(false);
    });
  });
  
  describe('findTasks', () => {
    beforeEach(async () => {
      // Create a set of tasks for testing filters
      const tasks: Task[] = [
        {
          id: '',
          name: 'High Priority Task',
          status: TaskStatus.PENDING,
          priority: 8, // High priority
          scheduleType: TaskScheduleType.EXPLICIT,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
          scheduledTime: new Date(),
        },
        {
          id: '',
          name: 'Medium Priority Task',
          status: TaskStatus.RUNNING,
          priority: 5, // Medium priority
          scheduleType: TaskScheduleType.INTERVAL,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
          scheduledTime: new Date(),
          interval: {
            expression: '1 day',
            executionCount: 0
          }
        },
        {
          id: '',
          name: 'Low Priority Task',
          status: TaskStatus.COMPLETED,
          priority: 2, // Low priority
          scheduleType: TaskScheduleType.PRIORITY,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
        },
      ];
      
      for (const task of tasks) {
        await registry.storeTask(task);
      }
    });
    
    it('should find tasks by status', async () => {
      const pendingTasks = await registry.findTasks({ status: TaskStatus.PENDING });
      expect(pendingTasks.length).toBe(1);
      expect(pendingTasks[0].name).toBe('High Priority Task');
      
      const runningTasks = await registry.findTasks({ status: TaskStatus.RUNNING });
      expect(runningTasks.length).toBe(1);
      expect(runningTasks[0].name).toBe('Medium Priority Task');
      
      const completedTasks = await registry.findTasks({ status: TaskStatus.COMPLETED });
      expect(completedTasks.length).toBe(1);
      expect(completedTasks[0].name).toBe('Low Priority Task');
    });
    
    it('should find tasks by priority range', async () => {
      // High priority (exactly 8)
      const highPriorityTasks = await registry.findTasks({ 
        minPriority: 8, 
        maxPriority: 8 
      });
      expect(highPriorityTasks.length).toBe(1);
      expect(highPriorityTasks[0].name).toBe('High Priority Task');
      
      // Medium priority (exactly 5)
      const mediumPriorityTasks = await registry.findTasks({ 
        minPriority: 5,
        maxPriority: 5
      });
      expect(mediumPriorityTasks.length).toBe(1);
      expect(mediumPriorityTasks[0].name).toBe('Medium Priority Task');
      
      // Medium to high priorities (5-10)
      const mediumToHighTasks = await registry.findTasks({ 
        minPriority: 5
      });
      expect(mediumToHighTasks.length).toBe(2);
    });
    
    it('should find tasks by schedule type', async () => {
      const explicitTasks = await registry.findTasks({ scheduleType: TaskScheduleType.EXPLICIT });
      expect(explicitTasks.length).toBe(1);
      expect(explicitTasks[0].name).toBe('High Priority Task');
      
      const intervalTasks = await registry.findTasks({ scheduleType: TaskScheduleType.INTERVAL });
      expect(intervalTasks.length).toBe(1);
      expect(intervalTasks[0].name).toBe('Medium Priority Task');
    });
    
    it('should combine multiple filter criteria with AND logic', async () => {
      const tasks = await registry.findTasks({
        status: TaskStatus.PENDING,
        minPriority: 8,
        maxPriority: 10
      });
      
      expect(tasks.length).toBe(1);
      expect(tasks[0].name).toBe('High Priority Task');
      
      const noMatchTasks = await registry.findTasks({
        status: TaskStatus.PENDING,
        minPriority: 1,
        maxPriority: 3
      });
      
      expect(noMatchTasks.length).toBe(0);
    });
  });
  
  describe('countTasks', () => {
    beforeEach(async () => {
      // Create a set of tasks for testing counts
      const tasks: Task[] = [
        {
          id: '',
          name: 'Task 1',
          status: TaskStatus.PENDING,
          priority: 8, // High priority
          scheduleType: TaskScheduleType.EXPLICIT,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
          scheduledTime: new Date(),
        },
        {
          id: '',
          name: 'Task 2',
          status: TaskStatus.PENDING,
          priority: 5, // Medium priority
          scheduleType: TaskScheduleType.INTERVAL,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
          scheduledTime: new Date(),
          interval: {
            expression: '1 day',
            executionCount: 0
          }
        },
        {
          id: '',
          name: 'Task 3',
          status: TaskStatus.COMPLETED,
          priority: 2, // Low priority
          scheduleType: TaskScheduleType.PRIORITY,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
        },
      ];
      
      for (const task of tasks) {
        await registry.storeTask(task);
      }
    });
    
    it('should count tasks by status', async () => {
      const pendingCount = await registry.countTasks({ status: TaskStatus.PENDING });
      expect(pendingCount).toBe(2);
      
      const completedCount = await registry.countTasks({ status: TaskStatus.COMPLETED });
      expect(completedCount).toBe(1);
    });
    
    it('should count tasks by combined criteria', async () => {
      const pendingHighPriorityCount = await registry.countTasks({
        status: TaskStatus.PENDING,
        minPriority: 8
      });
      
      expect(pendingHighPriorityCount).toBe(1);
    });
  });
  
  describe('clearAllTasks', () => {
    it('should remove all tasks from the registry', async () => {
      // Add some tasks
      const tasks: Task[] = [
        {
          id: '',
          name: 'Task 1',
          status: TaskStatus.PENDING,
          priority: 8, // High priority
          scheduleType: TaskScheduleType.EXPLICIT,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
          scheduledTime: new Date(),
        },
        {
          id: '',
          name: 'Task 2',
          status: TaskStatus.COMPLETED,
          priority: 2, // Low priority
          scheduleType: TaskScheduleType.PRIORITY,
          createdAt: new Date(),
          updatedAt: new Date(),
          handler: async () => {},
        },
      ];
      
      for (const task of tasks) {
        await registry.storeTask(task);
      }
      
      // Verify tasks were added
      const initialCount = await registry.countTasks({});
      expect(initialCount).toBe(2);
      
      // Clear all tasks
      const clearResult = await registry.clearAllTasks();
      expect(clearResult).toBe(true);
      
      // Verify all tasks were removed
      const finalCount = await registry.countTasks({});
      expect(finalCount).toBe(0);
    });
  });
}); 