/**
 * Chloe's Resource Manager
 * 
 * System for dynamically allocating resources during task execution based on
 * priorities, deadlines, and system load.
 */

import { ChloeAgent } from '../core/agent';
import { ChloeMemory } from '../memory';
import { 
  ResourceRequirements,
  ResourceAllocation,
  SystemCapacity,
  TaskProgressReport,
  ResourceAdjustmentStrategy
} from './types';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Resource management options
 */
export interface ResourceManagerOptions {
  maxConcurrentTasks?: number;
  defaultTaskTimeout?: number;
  maxSystemLoad?: number;
  preemptionEnabled?: boolean;
}

/**
 * Task resource tracking options
 */
export interface TaskResourceOptions {
  taskId: string;
  title: string;
  requirements: ResourceRequirements;
  deadline?: Date;
  priority: ImportanceLevel;
  progressReportInterval?: number; // ms
}

/**
 * Resource Manager System
 */
export class ResourceManager {
  private agent: ChloeAgent;
  private memory: ChloeMemory | null;
  private initialized: boolean = false;
  private options: ResourceManagerOptions;
  private allocations: Map<string, ResourceAllocation> = new Map();
  private taskProgress: Map<string, TaskProgressReport> = new Map();
  private systemCapacity: SystemCapacity;
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(agent: ChloeAgent, options?: ResourceManagerOptions) {
    this.agent = agent;
    this.memory = agent.getMemory();
    this.options = {
      maxConcurrentTasks: 5,
      defaultTaskTimeout: 300000, // 5 minutes
      maxSystemLoad: 0.8, // 80% max
      preemptionEnabled: true,
      ...options
    };
    
    // Initialize system capacity (to be updated with actual values in initialize)
    this.systemCapacity = {
      totalCpu: 4, // Default to 4 cores
      totalMemory: 8192, // Default to 8GB
      availableCpu: 4,
      availableMemory: 8192,
      scheduledCapacity: 0
    };
  }

  /**
   * Initialize the resource manager
   */
  public async initialize(): Promise<boolean> {
    try {
      // Detect system resources
      await this.detectSystemResources();
      
      // Set up periodic system monitoring
      setInterval(() => this.monitorSystemResources(), 10000); // Every 10 seconds
      
      // Set up deadline monitoring
      setInterval(() => this.checkDeadlines(), 30000); // Every 30 seconds
      
      this.initialized = true;
      this.logToMemory('Resource Manager initialized successfully', 'system_log');
      return true;
    } catch (error) {
      console.error('Failed to initialize ResourceManager:', error);
      return false;
    }
  }

  /**
   * Detect available system resources
   */
  private async detectSystemResources(): Promise<void> {
    try {
      // In a real implementation, you would actually query system resources
      // For now, we'll use reasonable defaults
      
      // Use navigator.hardwareConcurrency if in browser
      let cpuCount = 4; // default
      
      if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
        cpuCount = navigator.hardwareConcurrency;
      } else if (typeof process !== 'undefined') {
        // Try to use node's os module if available
        try {
          const os = require('os');
          cpuCount = os.cpus().length;
        } catch (e) {
          // Fallback to default if os module is not available
          cpuCount = 4;
        }
      }
      
      // Estimate available memory (in MB)
      let memorySize = 8192; // Default to 8GB
      
      if (typeof process !== 'undefined') {
        try {
          const os = require('os');
          memorySize = Math.floor(os.totalmem() / (1024 * 1024));
        } catch (e) {
          // Fallback to default
          memorySize = 8192;
        }
      }
      
      // Update system capacity
      this.systemCapacity = {
        totalCpu: cpuCount,
        totalMemory: memorySize,
        availableCpu: cpuCount,
        availableMemory: memorySize,
        scheduledCapacity: 0
      };
      
      console.log(`Detected system resources: ${cpuCount} CPU cores, ${memorySize}MB memory`);
    } catch (error) {
      console.error('Error detecting system resources:', error);
      // Keep defaults
    }
  }

  /**
   * Monitor system resources
   */
  private async monitorSystemResources(): Promise<void> {
    try {
      // Calculate current resource usage
      const allocations = Array.from(this.allocations.values());
      const runningAllocations = allocations.filter(a => a.status === 'in_progress');
      
      // Calculate CPU usage
      const cpuUsage = runningAllocations.reduce((total, alloc) => total + alloc.allocatedCpu, 0);
      
      // Calculate memory usage
      const memoryUsage = runningAllocations.reduce((total, alloc) => total + alloc.allocatedMemory, 0);
      
      // Update available resources
      this.systemCapacity.availableCpu = Math.max(0, this.systemCapacity.totalCpu - cpuUsage);
      this.systemCapacity.availableMemory = Math.max(0, this.systemCapacity.totalMemory - memoryUsage);
      
      // Calculate scheduled capacity (as percentage)
      const cpuScheduledRatio = cpuUsage / this.systemCapacity.totalCpu;
      const memoryScheduledRatio = memoryUsage / this.systemCapacity.totalMemory;
      this.systemCapacity.scheduledCapacity = Math.max(cpuScheduledRatio, memoryScheduledRatio);
      
      // If system is overloaded, trigger resource reallocation
      if (this.systemCapacity.scheduledCapacity > this.options.maxSystemLoad!) {
        this.reallocateResources(ResourceAdjustmentStrategy.PREEMPTIVE);
      }
    } catch (error) {
      console.error('Error monitoring system resources:', error);
    }
  }

  /**
   * Check task deadlines
   */
  private async checkDeadlines(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all running allocations
      const allocations = Array.from(this.allocations.values())
        .filter(a => a.status === 'in_progress');
      
      // Sort allocations by priority (higher priority tasks first)
      const sortedByPriority = [...allocations]
        .sort((a, b) => {
          // Sort by estimated end time relative to deadline
          const aEndTime = new Date(a.startTime.getTime() + a.allocatedTime);
          const bEndTime = new Date(b.startTime.getTime() + b.allocatedTime);
          
          return aEndTime.getTime() - bEndTime.getTime();
        });
      
      // Check for tasks approaching deadlines
      const tasksAtRisk = sortedByPriority.filter(allocation => {
        const expectedEndTime = new Date(allocation.startTime.getTime() + allocation.allocatedTime);
        const timeRemaining = expectedEndTime.getTime() - now.getTime();
        
        // If task is at risk (less than 20% of allocated time remains)
        return timeRemaining < allocation.allocatedTime * 0.2;
      });
      
      if (tasksAtRisk.length > 0) {
        // Prioritize tasks at risk by boosting their resources
        this.reallocateResources(ResourceAdjustmentStrategy.DEADLINE_DRIVEN, tasksAtRisk);
      }
    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  }

  /**
   * Allocate resources for a task
   */
  public async allocateResources(options: TaskResourceOptions): Promise<ResourceAllocation | null> {
    if (!this.initialized) {
      throw new Error('ResourceManager not initialized');
    }
    
    try {
      const { taskId, title, requirements, deadline, priority, progressReportInterval } = options;
      
      // Check if task already has an allocation
      if (this.allocations.has(taskId)) {
        return this.allocations.get(taskId) || null;
      }
      
      // Check if we have enough available resources
      const canAllocateDirectly = 
        requirements.cpu <= this.systemCapacity.availableCpu &&
        requirements.memory <= this.systemCapacity.availableMemory;
      
      // If we can't allocate directly, check if we can preempt lower priority tasks
      if (!canAllocateDirectly && this.options.preemptionEnabled) {
        this.preemptTasks(requirements, priority);
      }
      
      // Recalculate available resources after potential preemption
      const nowAvailable = 
        requirements.cpu <= this.systemCapacity.availableCpu &&
        requirements.memory <= this.systemCapacity.availableMemory;
      
      if (!nowAvailable) {
        // Cannot allocate resources for this task
        console.warn(`Cannot allocate resources for task ${taskId}`);
        return null;
      }
      
      // Create the resource allocation
      const allocation: ResourceAllocation = {
        taskId,
        allocatedTime: requirements.estimatedTimeMs,
        allocatedCpu: requirements.cpu,
        allocatedMemory: requirements.memory,
        startTime: new Date(),
        status: 'scheduled',
        progress: 0
      };
      
      // Update system capacity
      this.systemCapacity.availableCpu -= requirements.cpu;
      this.systemCapacity.availableMemory -= requirements.memory;
      
      // Store the allocation
      this.allocations.set(taskId, allocation);
      
      // Initialize progress tracking
      const progress: TaskProgressReport = {
        taskId,
        timestamp: new Date(),
        percentComplete: 0,
        remainingTimeEstimate: requirements.estimatedTimeMs,
        statusMessage: 'Scheduled',
        milestones: []
      };
      
      this.taskProgress.set(taskId, progress);
      
      // Set up progress reporting interval if requested
      if (progressReportInterval && progressReportInterval > 0) {
        const interval = setInterval(() => {
          this.checkTaskProgress(taskId);
        }, progressReportInterval);
        
        this.progressIntervals.set(taskId, interval);
      }
      
      // Log the allocation to memory
      await this.logToMemory(
        `Resource allocation for task '${title}' (${taskId}): CPU: ${requirements.cpu}, Memory: ${requirements.memory}MB, Duration: ${Math.round(requirements.estimatedTimeMs / 1000)}s`,
        'resource_allocation'
      );
      
      return allocation;
    } catch (error) {
      console.error('Error allocating resources:', error);
      return null;
    }
  }

  /**
   * Preempt lower priority tasks to free up resources
   */
  private preemptTasks(
    requiredResources: ResourceRequirements, 
    newTaskPriority: ImportanceLevel
  ): void {
    const currentAllocations = Array.from(this.allocations.values())
      .filter(a => a.status === 'in_progress');
    
    // Define priority weights
    const priorityWeights: Record<ImportanceLevel, number> = {
      [ImportanceLevel.CRITICAL]: 100,
      [ImportanceLevel.VERY_HIGH]: 90,
      [ImportanceLevel.HIGH]: 80,
      [ImportanceLevel.MEDIUM]: 50,
      [ImportanceLevel.LOW]: 20,
      [ImportanceLevel.VERY_LOW]: 10
    };
    
    // Sort by priority (lower priority first)
    const candidatesForPreemption = currentAllocations
      .filter(allocation => {
        // Only consider preempting tasks with lower priority
        return priorityWeights[newTaskPriority] > 
               (priorityWeights[allocation.status as unknown as ImportanceLevel] || 0);
      })
      .sort((a, b) => {
        // Sort by priority (ascending, lower priority first)
        const aPriority = priorityWeights[a.status as unknown as ImportanceLevel] || 0;
        const bPriority = priorityWeights[b.status as unknown as ImportanceLevel] || 0;
        return aPriority - bPriority;
      });
    
    // Calculate how much we need to free
    let cpuNeeded = requiredResources.cpu - this.systemCapacity.availableCpu;
    let memoryNeeded = requiredResources.memory - this.systemCapacity.availableMemory;
    
    // Preempt tasks one by one until we have enough resources
    for (const allocation of candidatesForPreemption) {
      if (cpuNeeded <= 0 && memoryNeeded <= 0) {
        break; // We've freed up enough resources
      }
      
      // Preempt this task
      this.preemptTask(allocation.taskId, 'Higher priority task requires resources');
      
      // Update remaining needs
      cpuNeeded -= allocation.allocatedCpu;
      memoryNeeded -= allocation.allocatedMemory;
    }
  }

  /**
   * Preempt a specific task
   */
  private preemptTask(taskId: string, reason: string): void {
    const allocation = this.allocations.get(taskId);
    if (!allocation || allocation.status !== 'in_progress') {
      return;
    }
    
    // Update allocation status
    allocation.status = 'preempted';
    allocation.endTime = new Date();
    this.allocations.set(taskId, allocation);
    
    // Update system capacity
    this.systemCapacity.availableCpu += allocation.allocatedCpu;
    this.systemCapacity.availableMemory += allocation.allocatedMemory;
    
    // Update task progress
    const progress = this.taskProgress.get(taskId);
    if (progress) {
      progress.statusMessage = `Preempted: ${reason}`;
      progress.timestamp = new Date();
      this.taskProgress.set(taskId, progress);
    }
    
    // Clean up progress reporting interval
    if (this.progressIntervals.has(taskId)) {
      clearInterval(this.progressIntervals.get(taskId)!);
      this.progressIntervals.delete(taskId);
    }
    
    // Log the preemption
    this.logToMemory(
      `Task ${taskId} preempted: ${reason}. Resources freed: CPU: ${allocation.allocatedCpu}, Memory: ${allocation.allocatedMemory}MB`,
      'resource_preemption'
    );
  }

  /**
   * Start task execution
   */
  public startTaskExecution(taskId: string): boolean {
    const allocation = this.allocations.get(taskId);
    if (!allocation || allocation.status !== 'scheduled') {
      return false;
    }
    
    // Update allocation status
    allocation.status = 'in_progress';
    allocation.startTime = new Date(); // Reset start time to now
    this.allocations.set(taskId, allocation);
    
    // Update task progress
    const progress = this.taskProgress.get(taskId);
    if (progress) {
      progress.statusMessage = 'In progress';
      progress.timestamp = new Date();
      this.taskProgress.set(taskId, progress);
    }
    
    return true;
  }

  /**
   * Complete task execution
   */
  public completeTaskExecution(taskId: string, wasSuccessful: boolean = true): boolean {
    const allocation = this.allocations.get(taskId);
    if (!allocation || allocation.status !== 'in_progress') {
      return false;
    }
    
    // Update allocation status
    allocation.status = 'completed';
    allocation.endTime = new Date();
    allocation.progress = 1.0; // 100%
    this.allocations.set(taskId, allocation);
    
    // Update system capacity
    this.systemCapacity.availableCpu += allocation.allocatedCpu;
    this.systemCapacity.availableMemory += allocation.allocatedMemory;
    
    // Update task progress
    const progress = this.taskProgress.get(taskId);
    if (progress) {
      progress.percentComplete = 100;
      progress.remainingTimeEstimate = 0;
      progress.statusMessage = wasSuccessful ? 'Completed successfully' : 'Completed with errors';
      progress.timestamp = new Date();
      this.taskProgress.set(taskId, progress);
    }
    
    // Clean up progress reporting interval
    if (this.progressIntervals.has(taskId)) {
      clearInterval(this.progressIntervals.get(taskId)!);
      this.progressIntervals.delete(taskId);
    }
    
    // Calculate actual execution time
    const executionTimeMs = allocation.endTime.getTime() - allocation.startTime.getTime();
    
    // Log the completion
    this.logToMemory(
      `Task ${taskId} ${wasSuccessful ? 'completed successfully' : 'failed'}. ` +
      `Execution time: ${Math.round(executionTimeMs / 1000)}s. ` +
      `Resources released: CPU: ${allocation.allocatedCpu}, Memory: ${allocation.allocatedMemory}MB`,
      'resource_release'
    );
    
    // Trigger resource reallocation to handle waiting tasks
    this.reallocateResources(ResourceAdjustmentStrategy.REDISTRIBUTIVE);
    
    return true;
  }

  /**
   * Update task progress
   */
  public updateTaskProgress(
    taskId: string, 
    percentComplete: number, 
    statusMessage: string,
    completedMilestone?: string
  ): boolean {
    const allocation = this.allocations.get(taskId);
    const progress = this.taskProgress.get(taskId);
    
    if (!allocation || !progress || allocation.status !== 'in_progress') {
      return false;
    }
    
    // Update allocation progress
    allocation.progress = percentComplete / 100;
    this.allocations.set(taskId, allocation);
    
    // Calculate estimated remaining time
    const elapsedMs = new Date().getTime() - allocation.startTime.getTime();
    let remainingMs = 0;
    
    if (percentComplete > 0) {
      // Estimate based on progress
      remainingMs = (elapsedMs / percentComplete) * (100 - percentComplete);
    } else {
      // Fall back to original allocation
      remainingMs = allocation.allocatedTime - elapsedMs;
    }
    
    // Update progress report
    progress.percentComplete = percentComplete;
    progress.remainingTimeEstimate = Math.max(0, remainingMs);
    progress.statusMessage = statusMessage;
    progress.timestamp = new Date();
    
    // Add milestone if provided
    if (completedMilestone) {
      progress.milestones.push({
        name: completedMilestone,
        completed: true,
        timestamp: new Date()
      });
    }
    
    this.taskProgress.set(taskId, progress);
    
    // Check if task is ahead or behind schedule
    this.adjustAllocationIfNeeded(taskId, elapsedMs, remainingMs);
    
    return true;
  }

  /**
   * Check task progress and adjust if necessary
   */
  private checkTaskProgress(taskId: string): void {
    const allocation = this.allocations.get(taskId);
    const progress = this.taskProgress.get(taskId);
    
    if (!allocation || !progress || allocation.status !== 'in_progress') {
      return;
    }
    
    // Calculate elapsed time
    const elapsedMs = new Date().getTime() - allocation.startTime.getTime();
    
    // Calculate progress based on time (assuming linear progress)
    const progressPercent = Math.min(100, Math.round((elapsedMs / allocation.allocatedTime) * 100));
    
    // Update progress if not manually updated recently
    if (new Date().getTime() - progress.timestamp.getTime() > 30000) {
      // No updates in the last 30 seconds, use time-based estimate
      progress.percentComplete = progressPercent;
      progress.remainingTimeEstimate = Math.max(0, allocation.allocatedTime - elapsedMs);
      progress.timestamp = new Date();
      this.taskProgress.set(taskId, progress);
      
      // Update allocation progress
      allocation.progress = progressPercent / 100;
      this.allocations.set(taskId, allocation);
    }
    
    // Check if task is running longer than expected
    if (elapsedMs > allocation.allocatedTime * 1.5) {
      // Task is taking much longer than expected
      this.logToMemory(
        `Task ${taskId} is taking longer than expected. Elapsed: ${Math.round(elapsedMs / 1000)}s, ` +
        `Estimated: ${Math.round(allocation.allocatedTime / 1000)}s, Progress: ${progressPercent}%`,
        'resource_warning'
      );
    }
  }

  /**
   * Adjust allocation if task is ahead or behind schedule
   */
  private adjustAllocationIfNeeded(taskId: string, elapsedMs: number, remainingMs: number): void {
    const allocation = this.allocations.get(taskId);
    if (!allocation || allocation.status !== 'in_progress') {
      return;
    }
    
    // Calculate original total time
    const originalTotalMs = allocation.allocatedTime;
    
    // Calculate actual total time estimate based on progress
    const estimatedTotalMs = elapsedMs + remainingMs;
    
    // Check if task is significantly ahead or behind schedule
    const ratio = estimatedTotalMs / originalTotalMs;
    
    if (ratio < 0.7) {
      // Task is ahead of schedule
      this.handleTaskAheadOfSchedule(taskId, allocation, estimatedTotalMs);
    } else if (ratio > 1.3) {
      // Task is behind schedule
      this.handleTaskBehindSchedule(taskId, allocation, estimatedTotalMs);
    }
  }

  /**
   * Handle task that is ahead of schedule
   */
  private handleTaskAheadOfSchedule(
    taskId: string, 
    allocation: ResourceAllocation, 
    estimatedTotalMs: number
  ): void {
    // Update allocation time
    allocation.allocatedTime = estimatedTotalMs;
    this.allocations.set(taskId, allocation);
    
    // Log the adjustment
    this.logToMemory(
      `Task ${taskId} is ahead of schedule. Adjusting time allocation to ${Math.round(estimatedTotalMs / 1000)}s`,
      'resource_adjustment'
    );
    
    // Potentially release some resources if they are needed elsewhere
    if (this.systemCapacity.scheduledCapacity > this.options.maxSystemLoad!) {
      this.reallocateResources(ResourceAdjustmentStrategy.REDISTRIBUTIVE);
    }
  }

  /**
   * Handle task that is behind schedule
   */
  private handleTaskBehindSchedule(
    taskId: string, 
    allocation: ResourceAllocation, 
    estimatedTotalMs: number
  ): void {
    // Update allocation time
    allocation.allocatedTime = estimatedTotalMs;
    this.allocations.set(taskId, allocation);
    
    // Log the adjustment
    this.logToMemory(
      `Task ${taskId} is behind schedule. Adjusting time allocation to ${Math.round(estimatedTotalMs / 1000)}s`,
      'resource_adjustment'
    );
    
    // Check if we can allocate more resources to this task
    const canAllocateMoreCpu = this.systemCapacity.availableCpu > 0;
    const canAllocateMoreMemory = this.systemCapacity.availableMemory > 0;
    
    if (canAllocateMoreCpu || canAllocateMoreMemory) {
      // Boost resources if available
      if (canAllocateMoreCpu) {
        const additionalCpu = Math.min(this.systemCapacity.availableCpu, allocation.allocatedCpu * 0.5);
        allocation.allocatedCpu += additionalCpu;
        this.systemCapacity.availableCpu -= additionalCpu;
      }
      
      if (canAllocateMoreMemory) {
        const additionalMemory = Math.min(this.systemCapacity.availableMemory, allocation.allocatedMemory * 0.5);
        allocation.allocatedMemory += additionalMemory;
        this.systemCapacity.availableMemory -= additionalMemory;
      }
      
      this.allocations.set(taskId, allocation);
      
      this.logToMemory(
        `Boosted resources for slow task ${taskId}. New allocation: CPU: ${allocation.allocatedCpu}, Memory: ${allocation.allocatedMemory}MB`,
        'resource_boost'
      );
    } else if (this.options.preemptionEnabled) {
      // Consider preempting other tasks to boost this one
      this.reallocateResources(ResourceAdjustmentStrategy.PREEMPTIVE);
    }
  }

  /**
   * Reallocate resources using the specified strategy
   */
  private reallocateResources(
    strategy: ResourceAdjustmentStrategy,
    specificTasks: ResourceAllocation[] = []
  ): void {
    switch (strategy) {
      case ResourceAdjustmentStrategy.PREEMPTIVE:
        this.reallocatePreemptive(specificTasks);
        break;
      case ResourceAdjustmentStrategy.REDISTRIBUTIVE:
        this.reallocateRedistributive();
        break;
      case ResourceAdjustmentStrategy.GRADUAL:
        this.reallocateGradual();
        break;
      case ResourceAdjustmentStrategy.DEADLINE_DRIVEN:
        this.reallocateDeadlineDriven(specificTasks);
        break;
    }
  }

  /**
   * Preemptive reallocation - terminate lower priority tasks
   */
  private reallocatePreemptive(specificTasks: ResourceAllocation[] = []): void {
    // If specific tasks are provided, focus on them
    if (specificTasks.length > 0) {
      // These are high-priority tasks that need more resources
      // Find lower priority tasks to preempt
      const tasksToPreempt = Array.from(this.allocations.values())
        .filter(a => 
          a.status === 'in_progress' &&
          !specificTasks.some(t => t.taskId === a.taskId) &&
          a.progress !== undefined && a.progress < 0.75 // Don't preempt tasks that are almost done
        )
        .sort((a, b) => {
          // Sort by progress (descending, higher progress first)
          return (b.progress || 0) - (a.progress || 0);
        })
        .slice(0, Math.max(1, Math.ceil(specificTasks.length / 2)));
      
      // Preempt these tasks
      for (const task of tasksToPreempt) {
        this.preemptTask(task.taskId, 'High priority task needs resources');
      }
    } else {
      // General preemption - find lowest priority tasks
      const runningTasks = Array.from(this.allocations.values())
        .filter(a => a.status === 'in_progress')
        .sort((a, b) => {
          // Sort by priority (ascending, lower priority first)
          return (a.progress || 0) - (b.progress || 0);
        });
      
      // Preempt up to 20% of tasks
      const tasksToPreempt = runningTasks.slice(0, Math.max(1, Math.ceil(runningTasks.length * 0.2)));
      
      // Preempt these tasks
      for (const task of tasksToPreempt) {
        this.preemptTask(task.taskId, 'System overloaded, freeing resources');
      }
    }
  }

  /**
   * Redistributive reallocation - focus on reallocating freed resources
   */
  private reallocateRedistributive(): void {
    // Get all scheduled tasks not yet running
    const scheduledTasks = Array.from(this.allocations.values())
      .filter(a => a.status === 'scheduled')
      .sort((a, b) => {
        // Sort by scheduled time (ascending, oldest first)
        return a.startTime.getTime() - b.startTime.getTime();
      });
    
    // Attempt to start as many tasks as possible
    for (const task of scheduledTasks) {
      // Check if we have resources available
      if (task.allocatedCpu <= this.systemCapacity.availableCpu &&
          task.allocatedMemory <= this.systemCapacity.availableMemory) {
        // Start this task
        this.startTaskExecution(task.taskId);
      }
    }
  }

  /**
   * Gradual reallocation - small adjustments to all running tasks
   */
  private reallocateGradual(): void {
    // Get all running tasks
    const runningTasks = Array.from(this.allocations.values())
      .filter(a => a.status === 'in_progress');
    
    // Calculate total resources used
    const totalCpuUsed = runningTasks.reduce((sum, a) => sum + a.allocatedCpu, 0);
    const totalMemoryUsed = runningTasks.reduce((sum, a) => sum + a.allocatedMemory, 0);
    
    // Calculate target usage based on max system load
    const targetCpuUsage = this.systemCapacity.totalCpu * this.options.maxSystemLoad!;
    const targetMemoryUsage = this.systemCapacity.totalMemory * this.options.maxSystemLoad!;
    
    // Calculate adjustment ratio
    const cpuRatio = totalCpuUsed > 0 ? targetCpuUsage / totalCpuUsed : 1;
    const memoryRatio = totalMemoryUsed > 0 ? targetMemoryUsage / totalMemoryUsed : 1;
    
    // Only adjust if we need to reduce (ratio < 1)
    if (cpuRatio < 0.9 || memoryRatio < 0.9) {
      // Adjust each task gradually
      for (const task of runningTasks) {
        if (cpuRatio < 0.9) {
          const newCpu = task.allocatedCpu * cpuRatio;
          const cpuDiff = task.allocatedCpu - newCpu;
          
          task.allocatedCpu = newCpu;
          this.systemCapacity.availableCpu += cpuDiff;
        }
        
        if (memoryRatio < 0.9) {
          const newMemory = task.allocatedMemory * memoryRatio;
          const memoryDiff = task.allocatedMemory - newMemory;
          
          task.allocatedMemory = newMemory;
          this.systemCapacity.availableMemory += memoryDiff;
        }
        
        this.allocations.set(task.taskId, task);
      }
      
      this.logToMemory(
        `Gradual resource reduction applied to ${runningTasks.length} tasks. ` +
        `CPU ratio: ${cpuRatio.toFixed(2)}, Memory ratio: ${memoryRatio.toFixed(2)}`,
        'resource_adjustment'
      );
    }
  }

  /**
   * Deadline-driven reallocation - boost tasks with approaching deadlines
   */
  private reallocateDeadlineDriven(tasksAtRisk: ResourceAllocation[]): void {
    if (tasksAtRisk.length === 0) {
      return;
    }
    
    // Calculate total additional resources needed
    const additionalCpuNeeded = tasksAtRisk.reduce((sum, task) => sum + (task.allocatedCpu * 0.5), 0);
    const additionalMemoryNeeded = tasksAtRisk.reduce((sum, task) => sum + (task.allocatedMemory * 0.5), 0);
    
    // Check if we have enough available resources
    const canAllocateDirectly = 
      additionalCpuNeeded <= this.systemCapacity.availableCpu &&
      additionalMemoryNeeded <= this.systemCapacity.availableMemory;
    
    if (canAllocateDirectly) {
      // Boost each task
      for (const task of tasksAtRisk) {
        const additionalCpu = task.allocatedCpu * 0.5;
        const additionalMemory = task.allocatedMemory * 0.5;
        
        task.allocatedCpu += additionalCpu;
        task.allocatedMemory += additionalMemory;
        
        this.systemCapacity.availableCpu -= additionalCpu;
        this.systemCapacity.availableMemory -= additionalMemory;
        
        this.allocations.set(task.taskId, task);
        
        this.logToMemory(
          `Boosted resources for deadline-critical task ${task.taskId}. ` +
          `New allocation: CPU: ${task.allocatedCpu}, Memory: ${task.allocatedMemory}MB`,
          'resource_boost'
        );
      }
    } else if (this.options.preemptionEnabled) {
      // Need to free up resources first
      this.reallocatePreemptive(tasksAtRisk);
      
      // Then try again
      this.reallocateDeadlineDriven(tasksAtRisk);
    }
  }

  /**
   * Get system capacity
   */
  public getSystemCapacity(): SystemCapacity {
    return this.systemCapacity;
  }

  /**
   * Get all resource allocations
   */
  public getAllocations(filter?: { 
    status?: 'scheduled' | 'in_progress' | 'completed' | 'preempted';
    taskId?: string; 
  }): ResourceAllocation[] {
    let allocations = Array.from(this.allocations.values());
    
    if (filter) {
      if (filter.status) {
        allocations = allocations.filter(a => a.status === filter.status);
      }
      
      if (filter.taskId) {
        allocations = allocations.filter(a => a.taskId === filter.taskId);
      }
    }
    
    return allocations;
  }

  /**
   * Get task progress
   */
  public getTaskProgress(taskId: string): TaskProgressReport | null {
    return this.taskProgress.get(taskId) || null;
  }

  /**
   * Log to memory
   */
  private async logToMemory(message: string, category: string): Promise<void> {
    if (!this.memory) return;
    
    try {
      // Map category string to proper MemoryType
      let memoryType: MemoryType;
      
      switch (category) {
        case 'resource_preemption':
          memoryType = MemoryType.CAPACITY_CHECK;
          break;
        case 'resource_release':
          memoryType = MemoryType.CAPACITY_CHECK;
          break;
        case 'system_log':
          memoryType = MemoryType.MAINTENANCE_LOG;
          break;
        default:
          memoryType = MemoryType.THOUGHT;
      }
      
      await this.memory.addMemory(
        message,
        memoryType,
        ImportanceLevel.LOW,
        MemorySource.SYSTEM,
        undefined,
        ['resource_manager', 'system_log']
      );
    } catch (error) {
      console.error('Failed to log to memory:', error);
    }
  }

  /**
   * Shutdown and cleanup
   */
  public shutdown(): void {
    // Clear all intervals
    const intervals = Array.from(this.progressIntervals.values());
    for (const interval of intervals) {
      clearInterval(interval);
    }
    
    this.progressIntervals.clear();
  }
} 