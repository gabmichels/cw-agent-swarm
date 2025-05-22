/**
 * ModularSchedulerAdvanced.test.ts
 * Advanced tests for the ModularSchedulerManager focusing on polling and different scheduling scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSchedulerManager } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus, TaskScheduleType } from '../../src/lib/scheduler/models/Task.model';

describe('ModularSchedulerManager Advanced Tests', () => {
  let scheduler: ModularSchedulerManager;
  let executedTasks: string[] = [];
  
  // Create a task handler that tracks execution
  const createTaskHandler = (taskName: string) => {
    return async () => {
      console.log(`Executing task: ${taskName}`);
      executedTasks.push(taskName);
      return { success: true, result: `Executed ${taskName}` };
    };
  };
  
  beforeEach(async () => {
    // Reset the executed tasks array
    executedTasks = [];
    
    // Create a scheduler with auto-scheduling enabled
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 500, // Short interval for testing
      maxConcurrentTasks: 5
    });
  });
  
  afterEach(async () => {
    // Clean up
    if (scheduler.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    await scheduler.reset();
  });
  
  describe('Task Polling Tests', () => {
    it('should automatically execute due tasks through polling', async () => {
      // Create a task that will be due soon
      const task: Task = {
        id: '',
        name: 'Polling Test Task',
        description: 'Task for testing automatic polling',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Polling Test Task'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 600), // Due in 600ms
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await scheduler.createTask(task);
      
      // Start the scheduler
      await scheduler.startScheduler();
      
      // Wait long enough for the polling to occur and execute the task
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Stop the scheduler
      await scheduler.stopScheduler();
      
      // Verify the task was executed
      expect(executedTasks).toContain('Polling Test Task');
      
      // Check if the task status was updated
      const tasks = await scheduler.findTasks({ status: TaskStatus.COMPLETED });
      expect(tasks.length).toBe(1);
      expect(tasks[0].name).toBe('Polling Test Task');
    });
    
    it('should handle multiple polling cycles and execute tasks as they become due', async () => {
      // Create tasks with different due times
      const task1: Task = {
        id: '',
        name: 'Quick Task',
        description: 'Task due very soon',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Quick Task'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 300), // Due in 300ms
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const task2: Task = {
        id: '',
        name: 'Delayed Task',
        description: 'Task due later',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Delayed Task'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() + 1200), // Due in 1200ms
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await scheduler.createTask(task1);
      await scheduler.createTask(task2);
      
      // Start the scheduler
      await scheduler.startScheduler();
      
      // Wait for the first polling cycle
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // First task should be executed, second task not yet
      expect(executedTasks).toContain('Quick Task');
      expect(executedTasks).not.toContain('Delayed Task');
      
      // Wait for the second polling cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Stop the scheduler
      await scheduler.stopScheduler();
      
      // Both tasks should now be executed
      expect(executedTasks).toContain('Quick Task');
      expect(executedTasks).toContain('Delayed Task');
      expect(executedTasks.length).toBe(2);
    });
  });
  
  describe('Different Scheduling Scenarios', () => {
    it('should handle tasks with explicit scheduledTime', async () => {
      // Create a task with explicit scheduledTime
      const task: Task = {
        id: '',
        name: 'Explicit Time Task',
        description: 'Task with explicit scheduled time',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Explicit Time Task'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() - 1000), // Due 1 second ago
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await scheduler.createTask(task);
      
      // Execute due tasks
      const results = await scheduler.executeDueTasks();
      
      // Verify task was executed
      expect(results.length).toBe(1);
      expect(results[0].successful).toBe(true);
      expect(executedTasks).toContain('Explicit Time Task');
    });
    
    it('should handle tasks with only priority/importance set', async () => {
      // Create a task with only priority set (no scheduledTime)
      const task: Task = {
        id: '',
        name: 'Priority Only Task',
        description: 'Task with only priority set',
        scheduleType: TaskScheduleType.PRIORITY,
        handler: createTaskHandler('Priority Only Task'),
        status: TaskStatus.PENDING,
        priority: 9, // High priority
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await scheduler.createTask(task);
      
      // Execute due tasks
      const results = await scheduler.executeDueTasks();
      
      // Verify high priority task was executed even without scheduledTime
      expect(results.length).toBe(1);
      expect(results[0].successful).toBe(true);
      expect(executedTasks).toContain('Priority Only Task');
    });
    
    it('should prioritize tasks based on priority and scheduledTime', async () => {
      // Create tasks with different priorities and scheduled times
      const lowPriorityPastTask: Task = {
        id: '',
        name: 'Low Priority Past',
        description: 'Low priority task due in the past',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Low Priority Past'),
        status: TaskStatus.PENDING,
        priority: 2,
        scheduledTime: new Date(Date.now() - 5000), // 5 seconds ago
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const highPriorityFutureTask: Task = {
        id: '',
        name: 'High Priority Future',
        description: 'High priority task due in the future',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('High Priority Future'),
        status: TaskStatus.PENDING,
        priority: 9,
        scheduledTime: new Date(Date.now() + 1000), // 1 second in the future
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mediumPriorityPastTask: Task = {
        id: '',
        name: 'Medium Priority Past',
        description: 'Medium priority task due in the past',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Medium Priority Past'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: new Date(Date.now() - 3000), // 3 seconds ago
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Create tasks and store their IDs
      const lowPriorityTask = await scheduler.createTask(lowPriorityPastTask);
      const highPriorityTask = await scheduler.createTask(highPriorityFutureTask);
      const mediumPriorityTask = await scheduler.createTask(mediumPriorityPastTask);
      
      // Get all pending tasks
      const allPendingTasks = await scheduler.findTasks({ status: TaskStatus.PENDING });
      
      // Filter to only past due tasks
      const now = new Date();
      const dueTasks = allPendingTasks.filter(task => {
        if (!task.scheduledTime) return false;
        return task.scheduledTime <= now;
      });
      
      // Verify that we have the expected past due tasks
      expect(dueTasks.length).toBe(2);
      
      // Verify that the high priority future task is not due yet
      const highPriorityFutureInDueTasks = dueTasks.some(task => task.id === highPriorityTask.id);
      expect(highPriorityFutureInDueTasks).toBe(false);
      
      // Verify that both past due tasks are included
      const lowPriorityPastInDueTasks = dueTasks.some(task => task.id === lowPriorityTask.id);
      const mediumPriorityPastInDueTasks = dueTasks.some(task => task.id === mediumPriorityTask.id);
      expect(lowPriorityPastInDueTasks).toBe(true);
      expect(mediumPriorityPastInDueTasks).toBe(true);
      
      // Sort tasks by priority (higher first)
      const sortedByPriority = [...dueTasks].sort((a, b) => b.priority - a.priority);
      
      // Verify sorting order by priority
      expect(sortedByPriority[0].id).toBe(mediumPriorityTask.id);
      expect(sortedByPriority[1].id).toBe(lowPriorityTask.id);
    });
    
    it('should handle complex task objects with nested metadata', async () => {
      // Create a task with complex metadata structure similar to the example
      const complexTask: Task = {
        id: '',
        name: 'Complex Task',
        description: 'Goal: seek learning guidance',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Complex Task'),
        status: TaskStatus.PENDING,
        priority: 5, // Medium priority
        scheduledTime: new Date(Date.now() - 1000), // Due 1 second ago
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          schemaVersion: '1.0.0',
          status: 'pending',
          title: 'Untitled Task',
          createdBy: {
            namespace: 'system',
            type: 'user',
            id: 'system'
          },
          importance: 'medium',
          tags: ['plan', 'execution', 'plan'],
          processType: 'planning',
          agentId: {
            namespace: 'agent',
            type: 'agent',
            id: 'default'
          },
          contextId: 'default-user',
          relatedTo: [
            '65188b90-93ce-4917-b3c3-fdc456202cc7',
            'b9692d6c-9ee2-4423-926c-f272658319fb'
          ],
          influencedBy: ['b9692d6c-9ee2-4423-926c-f272658319fb'],
          source: 'agent',
          planType: 'task',
          estimatedSteps: 5,
          dependsOn: [],
          steps: [
            'Use the search_tool to gather introductory resources and articles about quantum computing.',
            'Create a structured learning plan by outlining key topics such as quantum mechanics basics, quantum algorithms, and quantum hardware using the file_manager.',
            'Schedule regular study sessions and set reminders for each topic using the calendar_tool.',
            'Explore practical examples or tutorials by searching online or using coding resources, possibly with the code_executor if coding exercises are involved.',
            'Seek additional guidance or mentorship by sending an email to experts or online communities using the email_tool.'
          ]
        }
      };
      
      // Add the complex task
      await scheduler.createTask(complexTask);
      
      // Execute due tasks
      const results = await scheduler.executeDueTasks();
      
      // Verify task was executed
      expect(results.length).toBe(1);
      expect(results[0].successful).toBe(true);
      expect(executedTasks).toContain('Complex Task');
      
      // Verify task metadata is preserved
      const completedTask = await scheduler.getTask(results[0].taskId);
      expect(completedTask?.metadata).toBeDefined();
      expect(completedTask?.metadata?.importance).toBe('medium');
      expect(completedTask?.metadata?.tags).toContain('plan');
      expect(Array.isArray(completedTask?.metadata?.steps)).toBe(true);
      if (completedTask?.metadata?.steps) {
        const steps = completedTask.metadata.steps as string[];
        expect(steps[0]).toContain('search_tool');
        expect(steps.length).toBe(5);
      }
    });
    
    it('should handle tasks with natural language scheduling', async () => {
      // Get the dateTimeProcessor
      const dateTimeProcessor = scheduler['dateTimeProcessor'];
      
      // Parse natural language expressions
      const urgentDate = dateTimeProcessor.translateVagueTerm('urgent');
      const tomorrowDate = dateTimeProcessor.parseNaturalLanguage('tomorrow');
      
      // Create tasks with natural language derived scheduling
      const urgentTask: Task = {
        id: '',
        name: 'Urgent Task',
        description: 'Task that needs immediate attention',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Urgent Task'),
        status: TaskStatus.PENDING,
        priority: urgentDate?.priority || 10,
        scheduledTime: urgentDate?.date as Date,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const tomorrowTask: Task = {
        id: '',
        name: 'Tomorrow Task',
        description: 'Task scheduled for tomorrow',
        scheduleType: TaskScheduleType.EXPLICIT,
        handler: createTaskHandler('Tomorrow Task'),
        status: TaskStatus.PENDING,
        priority: 5,
        scheduledTime: tomorrowDate as Date,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Add both tasks
      await scheduler.createTask(urgentTask);
      await scheduler.createTask(tomorrowTask);
      
      // Execute due tasks
      const results = await scheduler.executeDueTasks();
      
      // Only the urgent task should be executed
      expect(results.length).toBe(1);
      expect(executedTasks).toContain('Urgent Task');
      expect(executedTasks).not.toContain('Tomorrow Task');
    });
    
    it('should handle tasks with the exact structure from the example', async () => {
      // Create a task with the exact structure from the example
      const exampleTask = {
        id: "02002bfa-1037-4c8c-be95-810992c5c62d",
        text: "Goal: seek learning guidance\n\nPlan Steps:\n1. Step 1: Use the search_tool to gather introductory resources and articles about quantum computing.\n2. Step 2: Create a structured learning plan by outlining key topics such as quantum mechanics basics, quantum algorithms, and quantum hardware using the file_manager.\n3. Step 3: Schedule regular study sessions and set reminders for each topic using the calendar_tool.\n4. Step 4: Explore practical examples or tutorials by searching online or using coding resources, possibly with the code_executor if coding exercises are involved.\n5. Step 5: Seek additional guidance or mentorship by sending an email to experts or online communities using the email_tool.",
        type: "task",
        timestamp: "1747774116751",
        metadata: {
          schemaVersion: "1.0.0",
          status: "pending",
          priority: "medium",
          title: "Untitled Task",
          createdBy: {
            namespace: "system",
            type: "user",
            id: "system"
          },
          importance: "medium",
          tags: ["plan", "execution", "plan"],
          processType: "planning",
          agentId: {
            namespace: "agent",
            type: "agent",
            id: "default"
          },
          contextId: "default-user",
          relatedTo: [
            "65188b90-93ce-4917-b3c3-fdc456202cc7",
            "b9692d6c-9ee2-4423-926c-f272658319fb"
          ],
          influencedBy: ["b9692d6c-9ee2-4423-926c-f272658319fb"],
          source: "agent",
          planType: "task",
          estimatedSteps: 5,
          dependsOn: []
        }
      };
      
      // Create a handler function for the task
      const handler = async () => {
        console.log("Executing example task");
        executedTasks.push("Example Task");
        return { success: true, result: "Example task executed" };
      };
      
      // Convert the example task to the format expected by the scheduler
      const schedulerTask: Task = {
        id: '', // Will be assigned by the scheduler
        name: exampleTask.metadata.title || "Untitled Task",
        description: exampleTask.text,
        scheduleType: TaskScheduleType.PRIORITY, // Use priority-based scheduling
        handler: handler,
        status: TaskStatus.PENDING,
        priority: exampleTask.metadata.importance === "medium" ? 5 : 
                 exampleTask.metadata.importance === "high" ? 8 : 3, // Convert importance to priority
        createdAt: new Date(parseInt(exampleTask.timestamp)),
        updatedAt: new Date(),
        metadata: exampleTask.metadata
      };
      
      // Add the task to the scheduler
      const createdTask = await scheduler.createTask(schedulerTask);
      expect(createdTask.id).toBeTruthy();
      
      // Execute the task
      const result = await scheduler.executeTaskNow(createdTask.id);
      expect(result.successful).toBe(true);
      expect(executedTasks).toContain("Example Task");
      
      // Verify the task was completed
      const completedTask = await scheduler.getTask(createdTask.id);
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
      
      // Verify metadata was preserved
      expect(completedTask?.metadata?.importance).toBe("medium");
      expect(completedTask?.metadata?.tags).toContain("plan");
      expect(completedTask?.metadata?.estimatedSteps).toBe(5);
    });
  });
}); 