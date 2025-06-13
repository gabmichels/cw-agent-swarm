/**
 * WorkspaceSchedulerIntegration.ts - Integrates workspace tasks with agent scheduler
 * 
 * This service enables scheduling of workspace operations like sending emails,
 * creating calendar events, and other workspace tasks at specific times.
 */

import { ScheduledTask } from '../../../lib/shared/types/agent';
import { WorkspaceCommand, WorkspaceCommandType } from './WorkspaceNLPProcessor';
import { WorkspaceAgentTools } from '../tools/WorkspaceAgentTools';
import { AgentWorkspacePermissionService } from '../AgentWorkspacePermissionService';
import { logger } from '../../../lib/logging';

/**
 * Workspace scheduled task definition
 */
export interface WorkspaceScheduledTask extends ScheduledTask {
  workspaceCommand: WorkspaceCommand;
  connectionId: string;
  agentId: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  shouldRetry?: boolean;
  nextRetryTime?: Date;
}

/**
 * Service for integrating workspace operations with agent scheduler
 */
export class WorkspaceSchedulerIntegration {
  private workspaceTools: WorkspaceAgentTools;
  private permissionService: AgentWorkspacePermissionService;
  private scheduledTasks: Map<string, WorkspaceScheduledTask> = new Map();

  constructor() {
    this.workspaceTools = new WorkspaceAgentTools();
    this.permissionService = new AgentWorkspacePermissionService();
  }

  /**
   * Schedule a workspace task for execution
   */
  async scheduleWorkspaceTask(
    agentId: string,
    command: WorkspaceCommand,
    connectionId: string,
    scheduledTime: Date,
    options?: {
      maxRetries?: number;
      retryDelayMs?: number;
      description?: string;
    }
  ): Promise<string> {
    try {
      // Validate agent has permission for this workspace operation
      const hasPermission = await this.validatePermission(agentId, command, connectionId);
      if (!hasPermission) {
        throw new Error(`Agent ${agentId} does not have permission for ${command.type}`);
      }

      // Create scheduled task
      const taskId = `workspace_${command.type}_${Date.now()}`;
      const task: WorkspaceScheduledTask = {
        id: taskId,
        name: `Workspace ${command.type}`,
        description: options?.description || `Execute ${command.intent}`,
        schedule: this.createCronFromDate(scheduledTime),
        lastRun: undefined,
        nextRun: scheduledTime,
        enabled: true,
        workspaceCommand: command,
        connectionId,
        agentId,
        retryCount: 0,
        maxRetries: options?.maxRetries || 3
      };

      // Store the task
      this.scheduledTasks.set(taskId, task);

      logger.info(`Scheduled workspace task ${taskId} for agent ${agentId}`, {
        commandType: command.type,
        scheduledTime: scheduledTime.toISOString(),
        connectionId
      });

      return taskId;
    } catch (error) {
      logger.error('Failed to schedule workspace task:', error);
      throw error;
    }
  }

  /**
   * Execute a scheduled workspace task
   */
  async executeScheduledTask(taskId: string): Promise<TaskExecutionResult> {
    try {
      const task = this.scheduledTasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      logger.info(`Executing workspace task ${taskId}`, {
        commandType: task.workspaceCommand.type,
        agentId: task.agentId
      });

      // Update task status
      task.lastRun = new Date();

      // Execute the workspace command
      const result = await this.executeWorkspaceCommand(task);

      if (result.success) {
        // Task completed successfully
        task.enabled = false; // Disable one-time tasks
        logger.info(`Workspace task ${taskId} completed successfully`);
      } else if (result.shouldRetry && task.retryCount! < task.maxRetries!) {
        // Schedule retry
        task.retryCount = (task.retryCount || 0) + 1;
        task.nextRun = result.nextRetryTime || new Date(Date.now() + 300000); // 5 min default
        logger.warn(`Workspace task ${taskId} failed, scheduling retry ${task.retryCount}/${task.maxRetries}`);
      } else {
        // Task failed permanently
        task.enabled = false;
        logger.error(`Workspace task ${taskId} failed permanently after ${task.retryCount} retries`);
      }

      return result;
    } catch (error) {
      logger.error(`Error executing workspace task ${taskId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: true,
        nextRetryTime: new Date(Date.now() + 300000) // 5 minutes
      };
    }
  }

  /**
   * Execute a workspace command
   */
  private async executeWorkspaceCommand(task: WorkspaceScheduledTask): Promise<TaskExecutionResult> {
    const { workspaceCommand, connectionId, agentId } = task;
    const { type, entities } = workspaceCommand;

    try {
      let result: any;

      switch (type) {
        case WorkspaceCommandType.SEND_EMAIL:
          result = await this.executeSendEmail(agentId, connectionId, entities);
          break;

        case WorkspaceCommandType.SCHEDULE_EVENT:
          result = await this.executeScheduleEvent(agentId, connectionId, entities);
          break;

        case WorkspaceCommandType.CREATE_SPREADSHEET:
          result = await this.executeCreateSpreadsheet(agentId, connectionId, entities);
          break;

        case WorkspaceCommandType.UPLOAD_FILE:
          result = await this.executeUploadFile(agentId, connectionId, entities);
          break;

        default:
          throw new Error(`Unsupported scheduled command type: ${type}`);
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        shouldRetry: this.shouldRetryError(error)
      };
    }
  }

  /**
   * Execute send email command
   */
  private async executeSendEmail(agentId: string, connectionId: string, entities: any): Promise<any> {
    const params = {
      to: entities.to || entities.recipients || [],
      subject: entities.subject || 'Scheduled Email',
      body: entities.body || 'This is a scheduled email.',
      connectionId
    };

    return await this.workspaceTools.sendEmailTool.execute(params, { agentId, userId: agentId });
  }

  /**
   * Execute schedule event command
   */
  private async executeScheduleEvent(agentId: string, connectionId: string, entities: any): Promise<any> {
    const params = {
      title: entities.title || 'Scheduled Event',
      startTime: entities.startTime,
      endTime: entities.endTime,
      attendees: entities.attendees || [],
      description: entities.description,
      connectionId
    };

    return await this.workspaceTools.scheduleEventTool.execute(params, { agentId, userId: agentId });
  }

  /**
   * Execute create spreadsheet command
   */
  private async executeCreateSpreadsheet(agentId: string, connectionId: string, entities: any): Promise<any> {
    const params = {
      title: entities.title || 'Scheduled Spreadsheet',
      template: entities.template || 'custom',
      headers: entities.categories || [],
      connectionId
    };

    return await this.workspaceTools.createSpreadsheetTool.execute(params, { agentId, userId: agentId });
  }

  /**
   * Execute upload file command
   */
  private async executeUploadFile(agentId: string, connectionId: string, entities: any): Promise<any> {
    const params = {
      name: entities.fileName || entities.name,
      content: entities.content,
      parentFolder: entities.folderId || entities.parentFolder,
      connectionId
    };

    // Access the createFileTool through the public interface
    const availableTools = await this.workspaceTools.getAvailableTools(agentId);
    const createFileTool = availableTools.find(tool => tool.name === 'create_file');
    
    if (!createFileTool) {
      throw new Error('Create file tool not available');
    }

    return await createFileTool.execute(params, { agentId, userId: agentId });
  }

  /**
   * Validate agent permission for workspace command
   */
  private async validatePermission(agentId: string, command: WorkspaceCommand, connectionId: string): Promise<boolean> {
    const capabilityMap = {
      [WorkspaceCommandType.SEND_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.READ_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.REPLY_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.FORWARD_EMAIL]: 'EMAIL_SEND',
      [WorkspaceCommandType.SEARCH_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.ANALYZE_EMAIL]: 'EMAIL_READ',
      [WorkspaceCommandType.CHECK_EMAIL_ATTENTION]: 'EMAIL_READ',
      [WorkspaceCommandType.GET_ACTION_ITEMS]: 'EMAIL_READ',
      [WorkspaceCommandType.GET_EMAIL_TRENDS]: 'EMAIL_READ',
      [WorkspaceCommandType.SCHEDULE_EVENT]: 'CALENDAR_CREATE',
      [WorkspaceCommandType.CHECK_CALENDAR]: 'CALENDAR_READ',
      [WorkspaceCommandType.FIND_AVAILABILITY]: 'CALENDAR_READ',
      [WorkspaceCommandType.EDIT_EVENT]: 'CALENDAR_EDIT',
      [WorkspaceCommandType.DELETE_EVENT]: 'CALENDAR_DELETE',
      [WorkspaceCommandType.CANCEL_EVENT]: 'CALENDAR_DELETE',
      [WorkspaceCommandType.FIND_EVENTS]: 'CALENDAR_READ',
      [WorkspaceCommandType.SUMMARIZE_DAY]: 'CALENDAR_READ',
      [WorkspaceCommandType.SEARCH_FILES]: 'DRIVE_READ',
      [WorkspaceCommandType.UPLOAD_FILE]: 'DRIVE_UPLOAD',
      [WorkspaceCommandType.SHARE_FILE]: 'DRIVE_SHARE',
      [WorkspaceCommandType.GET_FILE_DETAILS]: 'DRIVE_READ',
      [WorkspaceCommandType.CREATE_SPREADSHEET]: 'SPREADSHEET_CREATE',
      [WorkspaceCommandType.READ_SPREADSHEET]: 'SPREADSHEET_READ',
      [WorkspaceCommandType.UPDATE_SPREADSHEET]: 'SPREADSHEET_EDIT',
      [WorkspaceCommandType.ANALYZE_SPREADSHEET]: 'SPREADSHEET_READ',
      [WorkspaceCommandType.CREATE_EXPENSE_TRACKER]: 'SPREADSHEET_CREATE',
      [WorkspaceCommandType.UNKNOWN]: 'UNKNOWN'
    };

    const requiredCapability = capabilityMap[command.type];
    if (!requiredCapability) {
      return false;
    }

    try {
      const validation = await this.permissionService.validatePermissions(
        agentId,
        requiredCapability as any,
        connectionId
      );
      return validation.isValid;
    } catch (error) {
      logger.error('Permission validation failed:', error);
      return false;
    }
  }

  /**
   * Determine if an error should trigger a retry
   */
  private shouldRetryError(error: any): boolean {
    if (!error) return false;

    const retryableErrors = [
      'network error',
      'timeout',
      'rate limit',
      'temporary failure',
      'service unavailable',
      'connection error'
    ];

    const errorMessage = (error.message || error.toString()).toLowerCase();
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  /**
   * Create cron expression from date
   */
  private createCronFromDate(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Create a one-time cron expression
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Get all scheduled tasks for an agent
   */
  getScheduledTasks(agentId: string): WorkspaceScheduledTask[] {
    return Array.from(this.scheduledTasks.values())
      .filter(task => task.agentId === agentId && task.enabled);
  }

  /**
   * Cancel a scheduled task
   */
  cancelScheduledTask(taskId: string): boolean {
    const task = this.scheduledTasks.get(taskId);
    if (task) {
      task.enabled = false;
      logger.info(`Cancelled workspace task ${taskId}`);
      return true;
    }
    return false;
  }

  /**
   * Get due tasks that need execution
   */
  getDueTasks(): WorkspaceScheduledTask[] {
    const now = new Date();
    return Array.from(this.scheduledTasks.values())
      .filter(task => 
        task.enabled && 
        task.nextRun && 
        task.nextRun <= now
      );
  }

  /**
   * Process all due tasks
   */
  async processDueTasks(): Promise<void> {
    const dueTasks = this.getDueTasks();
    
    if (dueTasks.length === 0) {
      return;
    }

    logger.info(`Processing ${dueTasks.length} due workspace tasks`);

    for (const task of dueTasks) {
      try {
        await this.executeScheduledTask(task.id);
      } catch (error) {
        logger.error(`Failed to execute due task ${task.id}:`, error);
      }
    }
  }

  /**
   * Start background processing of due tasks
   */
  startTaskProcessor(intervalMs: number = 60000): NodeJS.Timeout {
    logger.info(`Starting workspace task processor with ${intervalMs}ms interval`);
    
    return setInterval(async () => {
      try {
        await this.processDueTasks();
      } catch (error) {
        logger.error('Error in workspace task processor:', error);
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const workspaceSchedulerIntegration = new WorkspaceSchedulerIntegration(); 