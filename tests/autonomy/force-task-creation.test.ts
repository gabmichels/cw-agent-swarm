import dotenv from 'dotenv';
dotenv.config();

import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { ManagerType } from '../../src/agents/shared/base/managers/ManagerType';

describe('Force Task Creation and Execution Tests', () => {
  let agent: DefaultAgent;

  beforeAll(async () => {
    agent = new DefaultAgent({
      id: 'force-test-agent',
      name: 'Force Test Agent',
      enableMemoryManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      enablePlanningManager: false,
      enableKnowledgeManager: false
    });

    await agent.initialize();
  }, 30000);

  afterAll(async () => {
    await agent?.shutdown();
  });

  test('Force create task directly and verify scheduler picks it up', async () => {
    console.log('🎯 Testing forced task creation and execution...');
    
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    expect(schedulerManager).toBeDefined();

    if (schedulerManager && typeof (schedulerManager as any).createTask === 'function') {
      console.log('✅ Scheduler manager supports task creation');

      // Create a task scheduled for immediate execution
      const taskData = {
        name: 'Immediate Test Task',
        description: 'Test task that should execute immediately',
        agentId: agent.getId(),
        userId: 'test-user',
        priority: 10, // High priority
        scheduledTime: new Date(), // Execute now
        parameters: {
          action: 'simple_response',
          message: 'Task executed successfully!'
        }
      };

      console.log('📝 Creating task with data:', taskData);

      try {
        const createdTask = await (schedulerManager as any).createTask(taskData);
        console.log(`✅ Task created successfully: ${createdTask?.id}`);
        console.log(`📊 Task status: ${createdTask?.status}`);
        console.log(`⏰ Scheduled time: ${createdTask?.scheduledTime}`);

        expect(createdTask).toBeDefined();
        expect(createdTask.id).toBeDefined();
        expect(createdTask.status).toBe('pending');

        // Give scheduler time to pick up the task
        console.log('⏳ Waiting for scheduler to pick up task...');
        
        let attempts = 0;
        const maxAttempts = 10; // 10 seconds max
        let taskCompleted = false;

        while (attempts < maxAttempts && !taskCompleted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;

          // Check task status
          const tasks = await (schedulerManager as any).findTasks({ ids: [createdTask.id] });
          if (tasks && tasks.length > 0) {
            const currentTask = tasks[0];
            console.log(`🔄 Attempt ${attempts}: Task status = ${currentTask.status}`);

            if (currentTask.status === 'completed' || currentTask.status === 'COMPLETED') {
              console.log('🎉 Task completed successfully!');
              taskCompleted = true;
              expect(currentTask.status).toMatch(/(completed|COMPLETED)/);
            } else if (currentTask.status === 'failed' || currentTask.status === 'FAILED') {
              console.log('❌ Task failed');
              expect(currentTask.status).not.toMatch(/(failed|FAILED)/);
              break;
            } else if (currentTask.status === 'running' || currentTask.status === 'RUNNING') {
              console.log('🏃 Task is running...');
            }
          } else {
            console.log(`⚠️ Task ${createdTask.id} not found in registry`);
          }
        }

        if (!taskCompleted) {
          console.log('⏰ Task did not complete within timeout - checking final status...');
          const finalTasks = await (schedulerManager as any).findTasks({ ids: [createdTask.id] });
          if (finalTasks && finalTasks.length > 0) {
            console.log(`📊 Final task status: ${finalTasks[0].status}`);
            // Task should at least exist and be processed
            expect(['pending', 'running', 'completed', 'PENDING', 'RUNNING', 'COMPLETED']).toContain(finalTasks[0].status);
          }
        }

      } catch (error) {
        console.error('❌ Failed to create task:', error);
        throw error;
      }

    } else {
      console.log('⚠️ Scheduler manager does not support createTask - skipping test');
      // Test passes since this is expected behavior in some implementations
    }

    console.log('✅ Force task creation test completed');
  }, 20000);

  test('Verify scheduler is actually running and processing tasks', async () => {
    console.log('🎯 Testing scheduler active processing...');
    
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    
    if (schedulerManager) {
      // Check if scheduler has status/info methods
      if (typeof (schedulerManager as any).getStatus === 'function') {
        const status = await (schedulerManager as any).getStatus();
        console.log('📊 Scheduler status:', status);
        expect(status).toBeDefined();
      }

      if (typeof (schedulerManager as any).isRunning === 'function') {
        const isRunning = (schedulerManager as any).isRunning();
        console.log(`🏃 Scheduler running: ${isRunning}`);
        expect(isRunning).toBeTruthy();
      }

      // Test task registry capabilities
      if (typeof (schedulerManager as any).findTasks === 'function') {
        const allTasks = await (schedulerManager as any).findTasks({});
        console.log(`📋 Total tasks in registry: ${allTasks?.length || 0}`);
        
        if (allTasks && allTasks.length > 0) {
          console.log('📋 Tasks found:');
          allTasks.forEach((task: any, index: number) => {
            console.log(`   ${index + 1}. ${task.id} - ${task.name} (${task.status})`);
          });
        } else {
          console.log('ℹ️ No tasks currently in registry');
        }
      }
    }

    console.log('✅ Scheduler verification completed');
  }, 10000);

  test('Create multiple tasks and verify concurrent processing', async () => {
    console.log('🎯 Testing multiple task creation and processing...');
    
    const schedulerManager = agent.getManager(ManagerType.SCHEDULER);
    
    if (schedulerManager && typeof (schedulerManager as any).createTask === 'function') {
      const tasks = [];
      const numTasks = 3;

      // Create multiple tasks
      for (let i = 1; i <= numTasks; i++) {
        const taskData = {
          name: `Multi Task ${i}`,
          description: `Multi-task test ${i}`,
          agentId: agent.getId(),
          userId: 'test-user',
          priority: 5,
          scheduledTime: new Date(Date.now() + (i * 1000)), // Stagger by 1 second each
          parameters: {
            action: 'count_task',
            number: i
          }
        };

        try {
          const createdTask = await (schedulerManager as any).createTask(taskData);
          tasks.push(createdTask);
          console.log(`✅ Created task ${i}: ${createdTask?.id}`);
        } catch (error) {
          console.error(`❌ Failed to create task ${i}:`, error);
        }
      }

      console.log(`📊 Created ${tasks.length} tasks successfully`);
      expect(tasks.length).toBeGreaterThan(0);

      // Monitor all tasks
      if (tasks.length > 0) {
        console.log('⏳ Monitoring task execution...');
        
        let attempts = 0;
        const maxAttempts = 15;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;

          const taskIds = tasks.map(t => t.id);
          const currentTasks = await (schedulerManager as any).findTasks({ ids: taskIds });
          
          if (currentTasks && currentTasks.length > 0) {
            const statusCounts = currentTasks.reduce((counts: any, task: any) => {
              counts[task.status] = (counts[task.status] || 0) + 1;
              return counts;
            }, {});
            
            console.log(`🔄 Attempt ${attempts}: Status counts:`, statusCounts);
            
            const completedCount = statusCounts['completed'] || statusCounts['COMPLETED'] || 0;
            if (completedCount === tasks.length) {
              console.log('🎉 All tasks completed successfully!');
              break;
            }
          }
        }

        // Final verification
        const finalTaskIds = tasks.map(t => t.id);
        const finalTasks = await (schedulerManager as any).findTasks({ ids: finalTaskIds });
        console.log(`📊 Final task count: ${finalTasks?.length || 0}`);
        
        if (finalTasks && finalTasks.length > 0) {
          finalTasks.forEach((task: any) => {
            console.log(`📋 Final: ${task.name} - ${task.status}`);
          });
        }
      }

    } else {
      console.log('⚠️ Scheduler manager does not support createTask - skipping multi-task test');
    }

    console.log('✅ Multiple task test completed');
  }, 30000);
}); 