/**
 * Autonomous Scheduler for Chloe
 * 
 * A system that allows Chloe to schedule and execute her own tasks
 * without human triggering. Integrates with the existing scheduler system.
 */

import { ChloeAgent } from '../core/agent';
import { ChloeScheduler } from '../scheduler';
import { MemoryEntry, ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { OpportunityDetector, DetectedOpportunity, TimeSensitivity } from './opportunityDetector';
import { StrategicToolPlanner } from '../strategy/strategicPlanner';
import { calculateChloeCapacity } from '../scheduler/capacityManager';

// Types for the autonomous scheduler
export interface ScheduledAutonomousTask {
  id: string;
  title: string;
  description: string;
  goalPrompt: string;
  scheduledTime: Date;
  estimatedDuration: number; // in minutes
  priority: 'high' | 'medium' | 'low';
  opportunityId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'deferred' | 'scheduled';
  tags: string[];
  createdAt: Date;
  completedAt?: Date;
  metrics?: {
    successRate?: number;
    executionTime?: number;
    outcomeQuality?: number; // 0-1 score
    [key: string]: any;
  };
}

export interface TaskSchedulingOptions {
  priorityOverride?: 'high' | 'medium' | 'low';
  scheduleImmediate?: boolean;
  deduplicationEnabled?: boolean;
  humanApprovalRequired?: boolean;
  tags?: string[];
}

/**
 * Main class for autonomously scheduling and executing tasks
 */
export class AutonomousScheduler {
  private agent: ChloeAgent;
  private scheduler: ChloeScheduler | null = null;
  private memory: ChloeMemory | null = null;
  private opportunityDetector: OpportunityDetector | null = null;
  private strategicPlanner: StrategicToolPlanner | null = null;
  private tasks: Map<string, ScheduledAutonomousTask> = new Map();
  private isEnabled: boolean = false;
  private taskCheckInterval: NodeJS.Timeout | null = null;
  private humanApprovalRequired: boolean = true; // Default to requiring approval
  private successRateThreshold: number = 0.7; // Min success rate to maintain autonomy
  private executionHistory: {
    successCount: number;
    failureCount: number;
    totalTasksCreated: number;
    totalTasksCompleted: number;
  } = {
    successCount: 0,
    failureCount: 0,
    totalTasksCreated: 0,
    totalTasksCompleted: 0,
  };

  constructor(agent: ChloeAgent) {
    this.agent = agent;
    this.memory = agent.getMemory ? agent.getMemory() : null;
    
    // Initialize scheduler reference
    if ('scheduler' in agent && agent.scheduler) {
      this.scheduler = agent.scheduler as ChloeScheduler;
    }
    
    console.log('AutonomousScheduler initialized');
  }

  /**
   * Connect to the opportunity detector
   */
  public connectOpportunityDetector(detector: OpportunityDetector): void {
    this.opportunityDetector = detector;
    console.log('Connected to OpportunityDetector');
  }

  /**
   * Set the strategic planner for task evaluation
   */
  public setStrategicPlanner(planner: StrategicToolPlanner): void {
    this.strategicPlanner = planner;
    
    // Also connect it to the opportunity detector if available
    if (this.opportunityDetector) {
      this.opportunityDetector.setStrategicPlanner(planner);
    }
  }

  /**
   * Enable or disable autonomous scheduling
   */
  public enable(enabled: boolean = true): void {
    if (this.isEnabled === enabled) return;
    
    this.isEnabled = enabled;
    
    if (enabled) {
      // Start the periodic task check
      this.taskCheckInterval = setInterval(() => {
        this.checkOpportunitiesAndSchedule();
      }, 15 * 60 * 1000); // Check every 15 minutes
      
      console.log('Autonomous scheduling enabled');
      this.logActivity('Autonomous scheduling enabled');
    } else {
      // Stop the task check
      if (this.taskCheckInterval) {
        clearInterval(this.taskCheckInterval);
        this.taskCheckInterval = null;
      }
      
      console.log('Autonomous scheduling disabled');
      this.logActivity('Autonomous scheduling disabled');
    }
  }

  /**
   * Check if autonomous scheduling is enabled
   */
  public isAutonomousEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Set whether human approval is required for autonomous tasks
   */
  public setHumanApprovalRequired(required: boolean): void {
    this.humanApprovalRequired = required;
    this.logActivity(`Human approval requirement ${required ? 'enabled' : 'disabled'}`);
  }

  /**
   * Main method to check for new opportunities and schedule tasks
   */
  public async checkOpportunitiesAndSchedule(): Promise<ScheduledAutonomousTask[]> {
    if (!this.isEnabled || !this.opportunityDetector) return [];
    
    try {
      // Check for new opportunities
      const newOpportunities = await this.opportunityDetector.checkOpportunities();
      
      if (newOpportunities.length === 0) return [];
      
      console.log(`Found ${newOpportunities.length} new opportunities to evaluate`);
      
      // Filter for high-confidence opportunities
      const viableOpportunities = newOpportunities.filter(
        opp => opp.metadata.confidence >= 0.7 && !opp.actionTaken
      );
      
      if (viableOpportunities.length === 0) return [];
      
      console.log(`${viableOpportunities.length} opportunities meet confidence threshold`);
      
      // Check current capacity
      const availableCapacity = await this.checkAvailableCapacity();
      
      if (availableCapacity <= 0) {
        console.log('No available capacity for new autonomous tasks');
        return [];
      }
      
      // Schedule tasks for viable opportunities
      const scheduledTasks: ScheduledAutonomousTask[] = [];
      let capacityUsed = 0;
      
      for (const opportunity of viableOpportunities) {
        // Skip if we've used up available capacity
        if (capacityUsed >= availableCapacity) break;
        
        // Calculate estimated duration
        const estimatedDuration = opportunity.metadata.resourceNeeded?.estimatedMinutes || 60;
        
        // Skip if this task would exceed remaining capacity
        if (capacityUsed + (estimatedDuration / 60) > availableCapacity) continue;
        
        // Schedule the task
        const task = await this.createTaskFromOpportunity(opportunity);
        
        if (task) {
          scheduledTasks.push(task);
          capacityUsed += estimatedDuration / 60;
          
          // Mark opportunity as actioned
          this.opportunityDetector.markOpportunityActioned(opportunity.id, true);
        }
      }
      
      if (scheduledTasks.length > 0) {
        console.log(`Scheduled ${scheduledTasks.length} autonomous tasks`);
        this.logActivity(`Autonomously scheduled ${scheduledTasks.length} tasks`);
      }
      
      return scheduledTasks;
    } catch (error) {
      console.error('Error in autonomous scheduling:', error);
      this.logActivity('Error in autonomous scheduling: ' + String(error));
      return [];
    }
  }

  /**
   * Create a task from a detected opportunity
   */
  private async createTaskFromOpportunity(
    opportunity: DetectedOpportunity
  ): Promise<ScheduledAutonomousTask | null> {
    try {
      if (!this.scheduler) return null;
      
      // Convert opportunity to a task
      const taskId = `auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      
      // Determine priority based on time sensitivity
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (opportunity.metadata.timeSensitivity === TimeSensitivity.IMMEDIATE || 
          opportunity.metadata.timeSensitivity === TimeSensitivity.URGENT) {
        priority = 'high';
      } else if (opportunity.metadata.timeSensitivity === TimeSensitivity.LONG_TERM) {
        priority = 'low';
      }
      
      // Create a goal prompt based on the opportunity
      const goalPrompt = `${opportunity.title}
      
Context: ${opportunity.description}
      
Complete this task by analyzing the situation and taking appropriate actions. 
The task was autonomously scheduled based on the detected opportunity.`;
      
      // Calculate the scheduled time based on priority
      const scheduledTime = this.calculateScheduledTime(opportunity);
      
      // Create the scheduled task
      const task: ScheduledAutonomousTask = {
        id: taskId,
        title: opportunity.title,
        description: opportunity.description,
        goalPrompt,
        scheduledTime,
        estimatedDuration: opportunity.metadata.resourceNeeded?.estimatedMinutes || 60,
        priority,
        opportunityId: opportunity.id,
        status: this.humanApprovalRequired ? 'pending' : 'scheduled',
        tags: ['autonomous', 'self-initiated', ...opportunity.tags],
        createdAt: new Date()
      };
      
      // Add to our internal task list
      this.tasks.set(taskId, task);
      this.executionHistory.totalTasksCreated++;
      
      // Schedule with the main scheduler
      const cronExpression = this.dateToCronExpression(scheduledTime);
      
      // Add to the real scheduler
      if (this.scheduler.scheduleTask) {
        this.scheduler.scheduleTask(
          taskId,
          cronExpression,
          goalPrompt,
          task.tags
        );
        
        console.log(`Scheduled autonomous task: ${task.title} for ${scheduledTime}`);
      }
      
      // Record in memory
      await this.recordTaskInMemory(task);
      
      // Notify about the new task if approved
      if (!this.humanApprovalRequired) {
        this.agent.notify(`🤖 Autonomously scheduled task: ${task.title} for ${scheduledTime.toLocaleString()}`);
      }
      
      return task;
    } catch (error) {
      console.error('Error creating task from opportunity:', error);
      return null;
    }
  }

  /**
   * Calculate the best time to schedule a task based on its priority
   */
  private calculateScheduledTime(opportunity: DetectedOpportunity): Date {
    const now = new Date();
    
    // Schedule based on time sensitivity
    switch (opportunity.metadata.timeSensitivity) {
      case TimeSensitivity.IMMEDIATE:
        // Within the next hour
        return new Date(now.getTime() + 30 * 60 * 1000);
        
      case TimeSensitivity.URGENT:
        // Within the next 4 hours
        return new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
      case TimeSensitivity.IMPORTANT:
        // Within the next day
        return new Date(now.getTime() + 8 * 60 * 60 * 1000);
        
      case TimeSensitivity.STANDARD:
        // Within the next 2-3 days
        return new Date(now.getTime() + 36 * 60 * 60 * 1000);
        
      case TimeSensitivity.LONG_TERM:
        // Within the next week
        return new Date(now.getTime() + 72 * 60 * 60 * 1000);
        
      default:
        // Default to 24 hours from now
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Convert a Date to a cron expression
   */
  private dateToCronExpression(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1; // Months are 0-indexed in JS
    const dayOfWeek = date.getDay();
    
    // Format: min hour dayOfMonth month dayOfWeek
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  /**
   * Record a task in Chloe's memory
   */
  private async recordTaskInMemory(task: ScheduledAutonomousTask): Promise<void> {
    if (!this.memory) return;
    
    const memoryContent = `
Autonomous Task Scheduled:
Title: ${task.title}
Description: ${task.description}
Scheduled Time: ${task.scheduledTime.toISOString()}
Estimated Duration: ${task.estimatedDuration} minutes
Priority: ${task.priority}
Status: ${task.status}
`;

    await this.memory.addMemory(
      memoryContent,
      'autonomous_task',
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      `Autonomously scheduled task: ${task.title}`,
      ['scheduled_task', 'autonomous', ...task.tags]
    );
  }

  /**
   * Log autonomous activity to memory
   */
  private async logActivity(activity: string): Promise<void> {
    if (!this.memory) return;
    
    await this.memory.addMemory(
      activity,
      'autonomous_log',
      ImportanceLevel.LOW,
      MemorySource.SYSTEM,
      `Autonomous scheduler activity: ${activity.substring(0, 30)}...`,
      ['autonomous', 'log', 'scheduler']
    );
  }

  /**
   * Check available capacity for autonomous tasks
   */
  private async checkAvailableCapacity(): Promise<number> {
    if (!this.scheduler) return 0;
    
    try {
      // Manual check for capacity without using the capacity manager
      // This avoids typing issues when the ChloeScheduler implementation changes
      const scheduledTasks = this.scheduler.getScheduledTasks ? this.scheduler.getScheduledTasks() : [];
      
      // Basic capacity calculation (simplified for compatibility)
      const totalHours = 8; // Assume 8 hour workday
      const allocatedHours = scheduledTasks.length * 0.5; // Assume 30 min per task
      
      // Reserve 50% of free capacity for human-directed tasks
      const remainingHours = Math.max(0, (totalHours - allocatedHours) * 0.5);
      
      return remainingHours;
    } catch (error) {
      console.error('Error checking capacity:', error);
      return 0; // Conservative default
    }
  }

  /**
   * Get all currently scheduled autonomous tasks
   */
  public getTasks(filter?: {
    status?: ScheduledAutonomousTask['status'] | ScheduledAutonomousTask['status'][];
    priority?: 'high' | 'medium' | 'low';
    tags?: string[];
  }): ScheduledAutonomousTask[] {
    let tasks = Array.from(this.tasks.values());
    
    // Apply filters if provided
    if (filter) {
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          tasks = tasks.filter(t => filter.status!.includes(t.status));
        } else {
          tasks = tasks.filter(t => t.status === filter.status);
        }
      }
      
      if (filter.priority) {
        tasks = tasks.filter(t => t.priority === filter.priority);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        tasks = tasks.filter(t => 
          filter.tags!.some(tag => t.tags.includes(tag))
        );
      }
    }
    
    return tasks;
  }

  /**
   * Update a task's status
   */
  public updateTaskStatus(
    taskId: string, 
    status: ScheduledAutonomousTask['status'], 
    metrics?: ScheduledAutonomousTask['metrics']
  ): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task) return false;
    
    // Update status
    task.status = status;
    
    // If completing or failing, update completion time and metrics
    if (status === 'completed' || status === 'failed') {
      task.completedAt = new Date();
      
      if (metrics) {
        task.metrics = { ...task.metrics, ...metrics };
      }
      
      // Update execution history
      this.executionHistory.totalTasksCompleted++;
      
      if (status === 'completed') {
        this.executionHistory.successCount++;
      } else {
        this.executionHistory.failureCount++;
      }
      
      // Auto-adjust confidence thresholds based on performance
      this.adjustConfidenceThresholds();
    }
    
    this.tasks.set(taskId, task);
    
    return true;
  }

  /**
   * Approve a pending autonomous task
   */
  public approveTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task || task.status !== 'pending') return false;
    
    // Update status
    task.status = 'in_progress';
    this.tasks.set(taskId, task);
    
    console.log(`Approved autonomous task: ${task.title}`);
    this.logActivity(`Task approved: ${task.title}`);
    
    return true;
  }

  /**
   * Reject a pending autonomous task
   */
  public rejectTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    
    if (!task || task.status !== 'pending') return false;
    
    // Update status
    task.status = 'deferred';
    this.tasks.set(taskId, task);
    
    console.log(`Rejected autonomous task: ${task.title}`);
    this.logActivity(`Task rejected: ${task.title}`);
    
    return true;
  }

  /**
   * Calculate success metrics for autonomous tasks
   */
  public getPerformanceMetrics(): {
    successRate: number;
    completionRate: number;
    totalTasksCreated: number;
    totalTasksCompleted: number;
  } {
    const { successCount, failureCount, totalTasksCreated, totalTasksCompleted } = this.executionHistory;
    
    const totalCompleted = successCount + failureCount;
    const successRate = totalCompleted > 0 ? successCount / totalCompleted : 0;
    const completionRate = totalTasksCreated > 0 ? totalTasksCompleted / totalTasksCreated : 0;
    
    return {
      successRate,
      completionRate,
      totalTasksCreated,
      totalTasksCompleted
    };
  }

  /**
   * Auto-adjust confidence thresholds based on performance
   */
  private adjustConfidenceThresholds(): void {
    const { successRate } = this.getPerformanceMetrics();
    
    // If success rate is below threshold, increase requirement for task creation
    if (successRate < this.successRateThreshold) {
      // Consider disabling autonomy if success rate is very low
      if (successRate < 0.3 && this.executionHistory.totalTasksCompleted > 10) {
        this.enable(false);
        this.agent.notify('🛑 Autonomous scheduling has been disabled due to low success rate.');
        this.logActivity('Autonomous scheduling auto-disabled due to low success rate');
        return;
      }
    }
  }

  /**
   * Request human approval for pending tasks
   */
  public async requestHumanApproval(): Promise<void> {
    const pendingTasks = this.getTasks({ status: 'pending' });
    
    if (pendingTasks.length === 0) return;
    
    // Notify about pending tasks
    this.agent.notify(`🤖 ${pendingTasks.length} autonomous tasks awaiting approval. Please review them.`);
    
    // Create a consolidated memory entry about pending tasks
    if (this.memory) {
      const taskSummary = pendingTasks.map(task => 
        `- ${task.title} (${task.priority} priority, scheduled for ${task.scheduledTime.toLocaleString()})`
      ).join('\n');
      
      await this.memory.addMemory(
        `Pending autonomous tasks awaiting approval:\n${taskSummary}`,
        'approval_request',
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `${pendingTasks.length} tasks awaiting approval`,
        ['autonomous', 'approval', 'pending']
      );
    }
  }
} 