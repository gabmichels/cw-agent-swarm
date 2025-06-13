/**
 * Workspace Scheduler Execution Tests
 * 
 * Tests that verify the scheduler properly executes workspace capability tasks
 * including email sending, calendar events, file operations, and spreadsheet creation.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WorkspaceSchedulerIntegration } from '../../src/services/workspace/integration/WorkspaceSchedulerIntegration';
import { WorkspaceCommandType } from '../../src/services/workspace/integration/WorkspaceNLPProcessor';
import { WorkspaceCapabilityType, AccessLevel } from '../../src/services/database/types';
import { AgentService } from '../../src/services/AgentService';
import { AgentWorkspacePermissionService } from '../../src/services/workspace/AgentWorkspacePermissionService';
import { createAgentId } from '../../src/utils/ulid';

describe('Workspace Scheduler Execution Tests', () => {
  let scheduler: WorkspaceSchedulerIntegration;
  let permissionService: AgentWorkspacePermissionService;
  let testAgentId: string;
  let testConnectionId: string;

  beforeAll(async () => {
    console.log('🔧 Setting up workspace scheduler execution tests...');
    
    // Initialize services
    scheduler = new WorkspaceSchedulerIntegration();
    permissionService = new AgentWorkspacePermissionService();
    
    // Get test connection
    const response = await fetch('http://localhost:3000/api/workspace/connections');
    const data = await response.json();
    const connection = data.connections.find((conn: any) => conn.email === 'gabriel.michels@gmail.com');
    
    if (!connection) {
      throw new Error('No test workspace connection found');
    }
    
    testConnectionId = connection.id;
    console.log(`✅ Using connection: ${connection.displayName} (${connection.email})`);
    
    // Create test agent
    const agent = await createTestAgentWithPermissions();
    testAgentId = agent.id;
    console.log(`✅ Test agent created: ${testAgentId}`);
  });

  afterAll(async () => {
    // Clean up test agent
    if (testAgentId) {
      try {
        await AgentService.deleteAgent(testAgentId);
        console.log(`✅ Test agent ${testAgentId} cleaned up`);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up test agent: ${error}`);
      }
    }
  });

  describe('📧 Email Task Scheduling & Execution', () => {
    test('should schedule and execute email sending task', async () => {
      const scheduledTime = new Date(Date.now() + 2000); // 2 seconds from now
      
      // Schedule email task
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.SEND_EMAIL,
          intent: 'Send test email',
          entities: {
            to: ['gab@crowd-wisdom.com'],
            subject: '[SCHEDULER-TEST] Email Task Execution',
            body: `This email was sent by the scheduler at ${new Date().toISOString()}`
          },
          confidence: 0.95
        },
        testConnectionId,
        scheduledTime,
        {
          description: 'Scheduled email test',
          maxRetries: 2
        }
      );

      expect(taskId).toBeTruthy();
      console.log(`📧 Email task scheduled: ${taskId}`);

      // Verify task is scheduled
      const scheduledTasks = scheduler.getScheduledTasks(testAgentId);
      expect(scheduledTasks.length).toBeGreaterThanOrEqual(1);
      
      const emailTask = scheduledTasks.find(t => t.id === taskId);
      expect(emailTask).toBeTruthy();
      expect(emailTask?.workspaceCommand.type).toBe(WorkspaceCommandType.SEND_EMAIL);

      // Wait for task to become due
      console.log('⏳ Waiting for task to become due...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if task is due
      const dueTasks = scheduler.getDueTasks();
      const dueEmailTask = dueTasks.find(task => task.id === taskId);
      expect(dueEmailTask).toBeTruthy();
      console.log(`✅ Email task is due: ${dueEmailTask?.id}`);

      // Execute the due task
      const result = await scheduler.executeScheduledTask(taskId);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      console.log(`✅ Email task executed successfully`);
      console.log(`📧 Email ID: ${result.data?.id || 'N/A'}`);
    });

    test('should handle email task failure gracefully', async () => {
      const scheduledTime = new Date(Date.now() + 1000);
      
      // Schedule email task with missing required fields to trigger failure
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.SEND_EMAIL,
          intent: 'Send test email with failure',
          entities: {
            // Missing 'to' field - this should cause a validation error
            subject: '[SCHEDULER-TEST] Failure Test',
            body: 'This should fail due to missing recipient'
          },
          confidence: 0.95
        },
        testConnectionId,
        scheduledTime,
        {
          description: 'Email failure test',
          maxRetries: 2
        }
      );

      // Wait for task to become due
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute the task (should fail)
      const result = await scheduler.executeScheduledTask(taskId);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      console.log(`❌ Email task failed as expected: ${result.error}`);

      // Verify the task is properly marked as failed
      const task = scheduler.getScheduledTasks(testAgentId).find(t => t.id === taskId);
      // Task should be disabled after permanent failure
      expect(task).toBeFalsy(); // Task should be removed from active tasks
      console.log(`✅ Task failure handling verified - task properly disabled`);
    });
  });

  describe('📅 Calendar Task Scheduling & Execution', () => {
    test('should schedule and execute calendar event creation', async () => {
      const scheduledTime = new Date(Date.now() + 2000);
      const eventStart = new Date(Date.now() + 3600000); // 1 hour from now
      const eventEnd = new Date(eventStart.getTime() + 1800000); // 30 minutes duration
      
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.SCHEDULE_EVENT,
          intent: 'Schedule test meeting',
          entities: {
            title: '[SCHEDULER-TEST] Automated Meeting Creation',
            startTime: eventStart.toISOString(),
            endTime: eventEnd.toISOString(),
            description: `Meeting created by scheduler at ${new Date().toISOString()}`,
            attendees: ['gab@crowd-wisdom.com']
          },
          confidence: 0.95
        },
        testConnectionId,
        scheduledTime,
        {
          description: 'Scheduled calendar event test',
          maxRetries: 2
        }
      );

      expect(taskId).toBeTruthy();
      console.log(`📅 Calendar task scheduled: ${taskId}`);

      // Wait for task to become due
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute the task
      const result = await scheduler.executeScheduledTask(taskId);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      console.log(`✅ Calendar event created successfully`);
      console.log(`📅 Event ID: ${result.data?.id || 'N/A'}`);

      // Clean up - delete the created event
      if (result.data?.id) {
        try {
          // Note: In a real implementation, we'd have a delete event capability
          console.log(`🗑️ Event cleanup would happen here for ID: ${result.data.id}`);
        } catch (error) {
          console.warn(`⚠️ Failed to clean up event: ${error}`);
        }
      }
    });
  });

  describe('💾 Drive Task Scheduling & Execution', () => {
    test('should schedule and execute file upload task', async () => {
      const scheduledTime = new Date(Date.now() + 2000);
      
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.UPLOAD_FILE,
          intent: 'Upload test file',
          entities: {
            fileName: `[SCHEDULER-TEST] Automated Upload - ${Date.now()}.txt`,
            content: `This file was uploaded by the scheduler at ${new Date().toISOString()}`,
            mimeType: 'text/plain'
          },
          confidence: 0.95
        },
        testConnectionId,
        scheduledTime,
        {
          description: 'Scheduled file upload test',
          maxRetries: 2
        }
      );

      expect(taskId).toBeTruthy();
      console.log(`💾 File upload task scheduled: ${taskId}`);

      // Wait for task to become due
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute the task
      const result = await scheduler.executeScheduledTask(taskId);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      console.log(`✅ File uploaded successfully`);
      console.log(`📄 File ID: ${result.data?.id || 'N/A'}`);
    });
  });

  describe('📊 Spreadsheet Task Scheduling & Execution', () => {
    test('should schedule and execute spreadsheet creation task', async () => {
      const scheduledTime = new Date(Date.now() + 2000);
      
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.CREATE_SPREADSHEET,
          intent: 'Create test spreadsheet',
          entities: {
            title: `[SCHEDULER-TEST] Automated Spreadsheet - ${new Date().toISOString()}`,
            headers: ['Date', 'Task', 'Status', 'Notes'],
            initialData: [
              ['2025-06-13', 'Scheduler Test', 'Completed', 'Created by automated scheduler']
            ]
          },
          confidence: 0.95
        },
        testConnectionId,
        scheduledTime,
        {
          description: 'Scheduled spreadsheet creation test',
          maxRetries: 2
        }
      );

      expect(taskId).toBeTruthy();
      console.log(`📊 Spreadsheet task scheduled: ${taskId}`);

      // Wait for task to become due
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute the task
      const result = await scheduler.executeScheduledTask(taskId);
      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      console.log(`✅ Spreadsheet created successfully`);
      console.log(`📊 Spreadsheet ID: ${result.data?.id || 'N/A'}`);
    });
  });

  describe('🔄 Scheduler Management', () => {
    test('should get all scheduled tasks for agent', async () => {
      // Schedule multiple tasks
      const tasks = await Promise.all([
        scheduler.scheduleWorkspaceTask(
          testAgentId,
          {
            type: WorkspaceCommandType.SEND_EMAIL,
            intent: 'Send email 1',
            entities: { to: ['test1@example.com'], subject: 'Test 1', body: 'Body 1' },
            confidence: 0.9
          },
          testConnectionId,
          new Date(Date.now() + 10000) // 10 seconds from now
        ),
        scheduler.scheduleWorkspaceTask(
          testAgentId,
          {
            type: WorkspaceCommandType.SCHEDULE_EVENT,
            intent: 'Schedule event 1',
            entities: { 
              title: 'Test Event', 
              startTime: new Date(Date.now() + 3600000).toISOString(),
              endTime: new Date(Date.now() + 5400000).toISOString()
            },
            confidence: 0.9
          },
          testConnectionId,
          new Date(Date.now() + 15000) // 15 seconds from now
        )
      ]);

      const scheduledTasks = scheduler.getScheduledTasks(testAgentId);
      expect(scheduledTasks.length).toBeGreaterThanOrEqual(2);
      
      const taskIds = scheduledTasks.map(t => t.id);
      expect(taskIds).toContain(tasks[0]);
      expect(taskIds).toContain(tasks[1]);
      
      console.log(`✅ Found ${scheduledTasks.length} scheduled tasks for agent`);
    });

    test('should cancel scheduled task', async () => {
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.SEND_EMAIL,
          intent: 'Send cancellable email',
          entities: { to: ['cancel@example.com'], subject: 'Cancel Test', body: 'This should be cancelled' },
          confidence: 0.9
        },
        testConnectionId,
        new Date(Date.now() + 30000) // 30 seconds from now
      );

      // Verify task exists
      let scheduledTasks = scheduler.getScheduledTasks(testAgentId);
      expect(scheduledTasks.some(t => t.id === taskId)).toBe(true);

      // Cancel the task
      const cancelled = scheduler.cancelScheduledTask(taskId);
      expect(cancelled).toBe(true);

      // Verify task is cancelled (disabled)
      scheduledTasks = scheduler.getScheduledTasks(testAgentId);
      expect(scheduledTasks.some(t => t.id === taskId)).toBe(false);
      
      console.log(`✅ Task ${taskId} cancelled successfully`);
    });

    test('should identify due tasks correctly', async () => {
      // Schedule a task that's already due
      const pastTime = new Date(Date.now() - 1000); // 1 second ago
      
      const taskId = await scheduler.scheduleWorkspaceTask(
        testAgentId,
        {
          type: WorkspaceCommandType.SEND_EMAIL,
          intent: 'Send overdue email',
          entities: { to: ['overdue@example.com'], subject: 'Overdue Test', body: 'This is overdue' },
          confidence: 0.9
        },
        testConnectionId,
        pastTime
      );

      // Check due tasks
      const dueTasks = scheduler.getDueTasks();
      const dueTask = dueTasks.find(t => t.id === taskId);
      
      expect(dueTask).toBeTruthy();
      expect(dueTask?.nextRun).toBeTruthy();
      expect(dueTask!.nextRun! <= new Date()).toBe(true);
      
      console.log(`✅ Due task identified correctly: ${taskId}`);
    });
  });

  async function createTestAgentWithPermissions(): Promise<any> {
    const agentId = createAgentId('workspace-scheduler-test').toString();
    
    const agent = await AgentService.registerAgent({
      id: agentId,
      name: 'Workspace Scheduler Test Agent',
      description: 'Agent for testing workspace scheduler execution',
      systemPrompt: 'You are a test agent for scheduler workspace integration.',
      capabilities: ['workspace_integration', 'scheduling'],
      metadata: {
        tags: ['test', 'workspace', 'scheduler'],
        domains: ['productivity', 'automation'],
        specializations: ['email', 'calendar', 'documents', 'scheduling']
      }
    });

    // Grant comprehensive workspace permissions
    const allCapabilities = [
      WorkspaceCapabilityType.EMAIL_READ,
      WorkspaceCapabilityType.EMAIL_SEND,
      WorkspaceCapabilityType.CALENDAR_READ,
      WorkspaceCapabilityType.CALENDAR_CREATE,
      WorkspaceCapabilityType.CALENDAR_EDIT,
      WorkspaceCapabilityType.CALENDAR_DELETE,
      WorkspaceCapabilityType.SPREADSHEET_READ,
      WorkspaceCapabilityType.SPREADSHEET_CREATE,
      WorkspaceCapabilityType.SPREADSHEET_EDIT,
      WorkspaceCapabilityType.DRIVE_READ,  
      WorkspaceCapabilityType.DRIVE_UPLOAD,
      WorkspaceCapabilityType.DRIVE_MANAGE
    ];

    for (const capability of allCapabilities) {
      await permissionService.grantPermission({
        agentId: agent.id,
        workspaceConnectionId: testConnectionId,
        capability,
        accessLevel: AccessLevel.WRITE,
        grantedBy: 'test-system',
        justification: 'Scheduler execution testing'
      });
    }

    return agent;
  }
});