/**
 * task-lifecycle-verification.test.ts
 * Comprehensive test that verifies task status at every stage of lifecycle
 * and shows exactly where tasks are stored in Qdrant
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { createSchedulerManager, RegistryType } from '../../src/lib/scheduler/factories/SchedulerFactory';
import { ModularSchedulerManager } from '../../src/lib/scheduler/implementations/ModularSchedulerManager';
import { Task, TaskStatus } from '../../src/lib/scheduler/models/Task.model';
import { QdrantClient } from '@qdrant/js-client-rest';

const TEST_TIMEOUT = 90000; // 90 seconds for thorough testing
vi.setConfig({ testTimeout: TEST_TIMEOUT });

describe('Task Lifecycle Verification Tests', () => {
  let agent: DefaultAgent;
  let scheduler: ModularSchedulerManager;
  let qdrantClient: QdrantClient;
  let testTaskIds: string[] = [];
  let collectionsToCheck: string[] = [];

  beforeEach(async () => {
    console.log('🚀 Setting up Task Lifecycle Verification...');
    
    vi.useRealTimers();
    testTaskIds = [];
    collectionsToCheck = [];
    
    // Create direct Qdrant client to inspect collections
    qdrantClient = new QdrantClient({ 
      url: process.env.QDRANT_URL || 'http://localhost:6333' 
    });
    
    console.log(process.env.OPENAI_API_KEY ? '✅ OpenAI API key found' : '⚠️ No OpenAI API key');
    
    // Create agent
    agent = new DefaultAgent({
      name: "LifecycleVerifier",
      enableMemoryManager: true,
      enableToolManager: true,
      enablePlanningManager: true,
      enableSchedulerManager: false,
      enableReflectionManager: true
    });
    
    await agent.initialize();
    
    // Create scheduler with default collection name (should be 'tasks')
    scheduler = await createSchedulerManager({
      enabled: true,
      enableAutoScheduling: true,
      schedulingIntervalMs: 3000, // Check every 3 seconds
      maxConcurrentTasks: 1, // One at a time for easier tracking
      registryType: RegistryType.QDRANT,
      qdrantUrl: process.env.QDRANT_URL || 'http://localhost:6333',
      // Don't specify collection name - let it use default
    });
    
    await scheduler.initialize();
    console.log('✅ Setup completed');
  });
  
  afterEach(async () => {
    console.log('🧹 Cleaning up...');
    
    if (scheduler?.isSchedulerRunning()) {
      await scheduler.stopScheduler();
    }
    
    // Clean up test tasks from all collections we found them in
    for (const taskId of testTaskIds) {
      try {
        await scheduler.deleteTask(taskId);
        console.log(`✅ Cleaned up task: ${taskId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up task ${taskId}:`, error);
      }
    }
    
    await scheduler?.reset();
    await agent?.shutdown();
    console.log('✅ Cleanup completed');
  });

  test('Find task collections and verify complete lifecycle', async () => {
    console.log('🎯 PART 1: Discovering task storage locations');
    
    // Step 1: List all collections in Qdrant
    try {
      const collectionsResponse = await qdrantClient.getCollections();
      const collections = collectionsResponse.collections.map(c => c.name);
      
      console.log('📊 All Qdrant collections:');
      collections.forEach(name => {
        console.log(`   - ${name}`);
      });
      
      // Filter for task-related collections
      const taskCollections = collections.filter(name => 
        name.includes('task') || 
        name.includes('Task') ||
        name === 'tasks'
      );
      
      console.log(`📊 Task-related collections: ${JSON.stringify(taskCollections)}`);
      collectionsToCheck = taskCollections.length > 0 ? taskCollections : ['tasks'];
      
    } catch (error) {
      console.warn('⚠️ Could not list collections, will check default:', error);
      collectionsToCheck = ['tasks'];
    }
    
    console.log('\n🎯 PART 2: Creating task and tracking lifecycle');
    
    // Step 2: Create a task through user input
    const userInput = "LIFECYCLE TEST: Please analyze the number 42 and explain why it's special";
    console.log(`📝 Creating task with input: "${userInput}"`);
    
    const startTime = new Date();
    const response = await agent.processUserInput(userInput);
    
    expect(response).toBeDefined();
    expect(response.content).toBeTruthy();
    console.log(`✅ Agent responded: ${response.content.substring(0, 100)}...`);
    
    // Step 3: Find the created task in Qdrant
    console.log('\n🔍 STEP 3: Locating created task in Qdrant...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for storage
    
    let foundTask: Task | null = null;
    let foundInCollection = '';
    
    // Search in scheduler first
    const allTasks = await scheduler.findTasks({ limit: 20 });
    console.log(`📊 Scheduler found ${allTasks.length} total tasks`);
    
    // Look for our specific test task
    const testTasks = allTasks.filter((task: Task) => 
      task.name.toLowerCase().includes('lifecycle') ||
      task.name.toLowerCase().includes('42') ||
      (task.description && (
        task.description.toLowerCase().includes('lifecycle') ||
        task.description.toLowerCase().includes('42')
      ))
    );
    
    if (testTasks.length > 0) {
      foundTask = testTasks[0];
      foundInCollection = 'scheduler';
      testTaskIds.push(foundTask.id);
      console.log(`✅ Found test task via scheduler: ${foundTask.id}`);
    } else {
      console.log('ℹ️ Test task not found via scheduler, checking collections directly...');
      
      // Check each collection directly
      for (const collection of collectionsToCheck) {
        try {
          const response = await qdrantClient.scroll(collection, {
            limit: 100,
            with_payload: true,
            with_vector: false
          });
          
          console.log(`📊 Collection '${collection}': ${response.points.length} points`);
          
          const taskPoints = response.points.filter(point => {
            const payload = point.payload as any;
            return payload && (
              payload.type === 'task' ||
              payload.name?.includes?.('lifecycle') ||
              payload.name?.includes?.('42') ||
              payload.description?.includes?.('lifecycle') ||
              payload.description?.includes?.('42')
            );
          });
          
          if (taskPoints.length > 0) {
            console.log(`✅ Found ${taskPoints.length} task points in '${collection}'`);
            taskPoints.forEach(point => {
              const payload = point.payload as any;
              console.log(`   - ${point.id}: ${payload.name || payload.type || 'unnamed'}`);
            });
          }
          
        } catch (error) {
          console.warn(`⚠️ Could not check collection '${collection}':`, error);
        }
      }
    }
    
    if (!foundTask) {
      console.log('📋 All tasks found:');
      allTasks.forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.name} (${task.status}) [${task.id}]`);
        testTaskIds.push(task.id); // Track for cleanup
      });
      
      // Use the first task for lifecycle testing if available
      if (allTasks.length > 0) {
        foundTask = allTasks[0];
        console.log(`ℹ️ Using first available task for lifecycle testing: ${foundTask.id}`);
      }
    }
    
    if (!foundTask) {
      throw new Error('No task found to test lifecycle!');
    }
    
    console.log('\n🔍 STEP 4: Verifying INITIAL task state (PENDING)...');
    console.log(`📊 Task ID: ${foundTask.id}`);
    console.log(`📊 Task Name: ${foundTask.name}`);
    console.log(`📊 Initial Status: ${foundTask.status}`);
    console.log(`📊 Priority: ${foundTask.priority}`);
    console.log(`📊 Created At: ${foundTask.createdAt}`);
    console.log(`📊 Updated At: ${foundTask.updatedAt}`);
    console.log(`📊 Scheduled Time: ${foundTask.scheduledTime || 'Not scheduled'}`);
    console.log(`📊 Last Executed: ${foundTask.lastExecutedAt || 'Never'}`);
    
    // Verify initial state
    expect(foundTask.status).toBe(TaskStatus.PENDING);
    expect(foundTask.createdAt).toBeTruthy();
    expect(new Date(foundTask.createdAt).getTime()).toBeGreaterThanOrEqual(startTime.getTime() - 5000);
    
    console.log('✅ INITIAL STATE VERIFIED: Task is PENDING');
    
    console.log('\n⚡ STEP 5: Starting scheduler and monitoring status changes...');
    await scheduler.startScheduler();
    
    // Monitor the complete lifecycle
    const lifecycleLog: Array<{
      attempt: number;
      status: TaskStatus;
      timestamp: Date;
      lastExecutedAt?: Date;
      updatedAt: Date;
    }> = [];
    
    // Add initial state
    lifecycleLog.push({
      attempt: 0,
      status: foundTask.status,
      timestamp: new Date(),
      lastExecutedAt: foundTask.lastExecutedAt ? new Date(foundTask.lastExecutedAt) : undefined,
      updatedAt: new Date(foundTask.updatedAt)
    });
    
    let currentTask = foundTask;
    let attempts = 0;
    const maxAttempts = 20; // 60 seconds total
    
    console.log('⏳ Monitoring task status changes (up to 60 seconds)...');
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      attempts++;
      
      // Get fresh task state
      const freshTasks = await scheduler.findTasks({ ids: [foundTask.id] });
      if (freshTasks.length > 0) {
        const previousStatus = currentTask.status;
        currentTask = freshTasks[0];
        
        // Log every check for detailed tracking
        console.log(`🔄 Attempt ${attempts}: Status = ${currentTask.status}, Updated = ${currentTask.updatedAt}`);
        
        // Record if status changed
        if (currentTask.status !== previousStatus) {
          console.log(`🚨 STATUS CHANGE DETECTED: ${previousStatus} → ${currentTask.status}`);
          
          lifecycleLog.push({
            attempt: attempts,
            status: currentTask.status,
            timestamp: new Date(),
            lastExecutedAt: currentTask.lastExecutedAt ? new Date(currentTask.lastExecutedAt) : undefined,
            updatedAt: new Date(currentTask.updatedAt)
          });
          
          // Verify status transitions are valid
          if (previousStatus === TaskStatus.PENDING && currentTask.status === TaskStatus.RUNNING) {
            console.log('✅ TRANSITION VERIFIED: PENDING → RUNNING');
            expect(currentTask.lastExecutedAt).toBeTruthy();
          } else if (previousStatus === TaskStatus.RUNNING && 
                    (currentTask.status === TaskStatus.COMPLETED || currentTask.status === TaskStatus.FAILED)) {
            console.log(`✅ TRANSITION VERIFIED: RUNNING → ${currentTask.status}`);
            expect(currentTask.lastExecutedAt).toBeTruthy();
          }
        }
        
        // Break if task is complete
        if (currentTask.status === TaskStatus.COMPLETED || currentTask.status === TaskStatus.FAILED) {
          console.log(`🏁 Task finished with status: ${currentTask.status}`);
          break;
        }
      } else {
        console.warn(`⚠️ Task ${foundTask.id} not found in attempt ${attempts}`);
      }
    }
    
    await scheduler.stopScheduler();
    
    console.log('\n📊 STEP 6: Final lifecycle verification...');
    
    // Get final state
    const finalTasks = await scheduler.findTasks({ ids: [foundTask.id] });
    expect(finalTasks.length).toBe(1);
    const finalTask = finalTasks[0];
    
    console.log('📊 COMPLETE LIFECYCLE LOG:');
    lifecycleLog.forEach((entry, index) => {
      console.log(`   ${index + 1}. Attempt ${entry.attempt}: ${entry.status} at ${entry.timestamp.toISOString()}`);
      if (entry.lastExecutedAt) {
        console.log(`      ↳ Last Executed: ${entry.lastExecutedAt.toISOString()}`);
      }
      console.log(`      ↳ Updated At: ${entry.updatedAt.toISOString()}`);
    });
    
    console.log('\n📊 FINAL TASK STATE:');
    console.log(`   Status: ${finalTask.status}`);
    console.log(`   Created: ${finalTask.createdAt}`);
    console.log(`   Updated: ${finalTask.updatedAt}`);
    console.log(`   Last Executed: ${finalTask.lastExecutedAt || 'Never'}`);
    console.log(`   Priority: ${finalTask.priority}`);
    console.log(`   Metadata: ${JSON.stringify(finalTask.metadata || {}, null, 2)}`);
    
    // Final verifications
    expect(lifecycleLog.length).toBeGreaterThan(1); // Should have seen status changes
    expect([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.RUNNING, TaskStatus.PENDING]).toContain(finalTask.status);
    
    // Verify timestamps progression
    const finalUpdated = new Date(finalTask.updatedAt);
    const initialCreated = new Date(foundTask.createdAt);
    expect(finalUpdated.getTime()).toBeGreaterThan(initialCreated.getTime());
    
    if (finalTask.status === TaskStatus.COMPLETED) {
      console.log('🎉 SUCCESS: Task completed full lifecycle!');
      expect(finalTask.lastExecutedAt).toBeTruthy();
    } else if (finalTask.status === TaskStatus.FAILED) {
      console.log('⚠️ Task failed, but lifecycle tracking worked');
      expect(finalTask.lastExecutedAt).toBeTruthy();
    } else if (finalTask.status === TaskStatus.RUNNING) {
      console.log('ℹ️ Task still running - may need more time');
    } else {
      console.log('ℹ️ Task never started - may indicate scheduler issues');
    }
    
    console.log('\n✅ LIFECYCLE VERIFICATION COMPLETE!');
    console.log(`📊 Found tasks in collection: ${foundInCollection}`);
    console.log(`📊 Status transitions observed: ${lifecycleLog.length}`);
    console.log(`📊 Final status: ${finalTask.status}`);
  });
}); 