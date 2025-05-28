/**
 * PeriodicReflectionScheduler.ts
 * 
 * Manages periodic reflection schedules with CRUD operations, execution tracking, and analytics.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  PeriodicReflectionConfig,
  ReflectionSchedule,
  ScheduleFrequency,
  ScheduleListOptions,
  ScheduleExecutionResult,
  ReflectionSchedulerStats,
  SchedulerError
} from '../interfaces/EnhancedReflectionInterfaces';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface PeriodicReflectionSchedulerConfig {
  maxSchedules?: number;
  enableAutoStart?: boolean;
  defaultInterval?: number; // milliseconds
  enableLogging?: boolean;
  checkInterval?: number; // milliseconds for checking due schedules
}

// ============================================================================
// Internal Types
// ============================================================================

interface ScheduleValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

// ============================================================================
// Implementation
// ============================================================================

export class PeriodicReflectionScheduler {
  private readonly config: Required<PeriodicReflectionSchedulerConfig>;
  private readonly schedules: Map<string, ReflectionSchedule> = new Map();
  private isSchedulerRunning = false;
  private schedulerInterval?: NodeJS.Timeout;
  
  // Statistics tracking
  private stats = {
    totalCreated: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    totalExecutionTime: 0,
    lastOperationTime: new Date()
  };

  constructor(config: PeriodicReflectionSchedulerConfig = {}) {
    this.config = {
      maxSchedules: config.maxSchedules ?? 1000,
      enableAutoStart: config.enableAutoStart ?? false,
      defaultInterval: config.defaultInterval ?? 86400000, // 24 hours
      enableLogging: config.enableLogging ?? false,
      checkInterval: config.checkInterval ?? 60000 // 1 minute
    };

    if (this.config.enableAutoStart) {
      this.start();
    }
  }

  // ============================================================================
  // Schedule CRUD Operations
  // ============================================================================

  async createSchedule(config: PeriodicReflectionConfig): Promise<ReflectionSchedule> {
    // Validate schedule configuration
    const validation = this.validateScheduleConfig(config);
    if (!validation.isValid) {
      throw new SchedulerError(
        `Schedule validation failed: ${validation.errors.join(', ')}`,
        'SCHEDULE_VALIDATION_FAILED',
        { config, errors: validation.errors },
        true,
        validation.suggestions
      );
    }

    // Check schedule limit
    if (this.schedules.size >= this.config.maxSchedules) {
      throw new SchedulerError(
        `Maximum number of schedules reached (${this.config.maxSchedules})`,
        'MAX_SCHEDULES_EXCEEDED',
        { maxSchedules: this.config.maxSchedules, currentCount: this.schedules.size },
        true,
        ['Delete unused schedules', 'Increase maxSchedules configuration']
      );
    }

    // Create new schedule with generated ID and timestamps
    const now = new Date();
    const nextExecution = config.nextExecution ?? new Date(now.getTime() + config.interval);
    
    const newSchedule: ReflectionSchedule = {
      ...config,
      id: ulid(),
      createdAt: now,
      updatedAt: now,
      nextExecution,
      executionCount: 0,
      successCount: 0
    };

    // Store schedule
    this.schedules.set(newSchedule.id, newSchedule);
    
    // Update statistics
    this.stats.totalCreated++;
    this.stats.lastOperationTime = now;

    if (this.config.enableLogging) {
      console.log(`Created schedule: ${newSchedule.name} (${newSchedule.id})`);
    }

    return { ...newSchedule };
  }

  async getSchedule(scheduleId: string): Promise<ReflectionSchedule | null> {
    if (!scheduleId || typeof scheduleId !== 'string') {
      return null;
    }

    const schedule = this.schedules.get(scheduleId);
    return schedule ? { ...schedule } : null;
  }

  async updateSchedule(
    scheduleId: string, 
    updates: Partial<Omit<ReflectionSchedule, 'id' | 'createdAt'>>
  ): Promise<ReflectionSchedule> {
    const existingSchedule = this.schedules.get(scheduleId);
    if (!existingSchedule) {
      throw new SchedulerError(
        `Schedule not found: ${scheduleId}`,
        'SCHEDULE_NOT_FOUND',
        { scheduleId },
        true,
        ['Check the schedule ID', 'Verify the schedule exists']
      );
    }

    // Create updated schedule data (excluding immutable fields)
    const { id, createdAt, ...allowedUpdates } = updates as any;
    const updatedScheduleData = {
      ...existingSchedule,
      ...allowedUpdates,
      updatedAt: new Date()
    };

    // Recalculate next execution if interval or frequency changed
    if (updates.interval !== undefined || updates.frequency !== undefined) {
      const interval = updates.interval ?? existingSchedule.interval;
      updatedScheduleData.nextExecution = new Date(Date.now() + interval);
    }

    // Validate updated schedule data
    const validation = this.validateScheduleConfig(updatedScheduleData);
    if (!validation.isValid) {
      throw new SchedulerError(
        `Schedule update validation failed: ${validation.errors.join(', ')}`,
        'SCHEDULE_VALIDATION_FAILED',
        { scheduleId, updates, errors: validation.errors },
        true,
        validation.suggestions
      );
    }

    // Update schedule
    this.schedules.set(scheduleId, updatedScheduleData);
    
    // Update statistics
    this.stats.totalUpdated++;
    this.stats.lastOperationTime = new Date();

    if (this.config.enableLogging) {
      console.log(`Updated schedule: ${updatedScheduleData.name} (${scheduleId})`);
    }

    return { ...updatedScheduleData };
  }

  async listSchedules(options: ScheduleListOptions = {}): Promise<ReflectionSchedule[]> {
    let schedules = Array.from(this.schedules.values());

    // Apply filters
    if (options.enabled !== undefined) {
      schedules = schedules.filter(schedule => schedule.enabled === options.enabled);
    }

    if (options.frequency && options.frequency.length > 0) {
      schedules = schedules.filter(schedule => options.frequency!.includes(schedule.frequency));
    }

    if (options.reflectionType && options.reflectionType.length > 0) {
      schedules = schedules.filter(schedule => options.reflectionType!.includes(schedule.reflectionType));
    }

    // Apply sorting
    if (options.sortBy) {
      schedules.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (options.sortBy) {
          case 'createdAt':
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case 'nextExecution':
            aValue = a.nextExecution.getTime();
            bValue = b.nextExecution.getTime();
            break;
          case 'frequency':
            aValue = this.getFrequencyWeight(a.frequency);
            bValue = this.getFrequencyWeight(b.frequency);
            break;
          default:
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
        }

        const direction = options.sortDirection === 'desc' ? -1 : 1;
        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? schedules.length;
    const paginatedSchedules = schedules.slice(offset, offset + limit);

    return paginatedSchedules.map(schedule => ({ ...schedule }));
  }

  async deleteSchedule(scheduleId: string): Promise<boolean> {
    const deleted = this.schedules.delete(scheduleId);
    
    if (deleted) {
      // Update statistics
      this.stats.totalDeleted++;
      this.stats.lastOperationTime = new Date();

      if (this.config.enableLogging) {
        console.log(`Deleted schedule: ${scheduleId}`);
      }
    }

    return deleted;
  }

  // ============================================================================
  // Scheduler Control
  // ============================================================================

  async start(): Promise<void> {
    if (this.isSchedulerRunning) {
      return; // Already running
    }

    this.isSchedulerRunning = true;
    
    // Start the scheduler interval
    this.schedulerInterval = setInterval(async () => {
      await this.checkAndExecuteDueSchedules();
    }, this.config.checkInterval);

    if (this.config.enableLogging) {
      console.log('Periodic reflection scheduler started');
    }
  }

  async stop(): Promise<void> {
    if (!this.isSchedulerRunning) {
      return; // Already stopped
    }

    this.isSchedulerRunning = false;
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }

    if (this.config.enableLogging) {
      console.log('Periodic reflection scheduler stopped');
    }
  }

  isRunning(): boolean {
    return this.isSchedulerRunning;
  }

  // ============================================================================
  // Execution Management
  // ============================================================================

  async getDueSchedules(): Promise<ReflectionSchedule[]> {
    const now = new Date();
    const dueSchedules = Array.from(this.schedules.values())
      .filter(schedule => 
        schedule.enabled && 
        schedule.nextExecution.getTime() <= now.getTime()
      )
      .sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime());

    return dueSchedules.map(schedule => ({ ...schedule }));
  }

  async recordExecution(result: ScheduleExecutionResult): Promise<void> {
    const schedule = this.schedules.get(result.scheduleId);
    if (!schedule) {
      throw new SchedulerError(
        `Schedule not found for execution result: ${result.scheduleId}`,
        'SCHEDULE_NOT_FOUND',
        { scheduleId: result.scheduleId, result },
        true,
        ['Check the schedule ID', 'Verify the schedule exists']
      );
    }

    // Update schedule execution tracking
    const updatedSchedule = {
      ...schedule,
      lastExecution: result.executedAt,
      executionCount: schedule.executionCount + 1,
      successCount: schedule.successCount + (result.success ? 1 : 0),
      nextExecution: new Date(result.executedAt.getTime() + schedule.interval),
      updatedAt: new Date()
    };

    this.schedules.set(result.scheduleId, updatedSchedule);

    // Update global statistics
    this.stats.totalExecutions++;
    if (result.success) {
      this.stats.successfulExecutions++;
    }
    this.stats.totalExecutionTime += result.duration;
    this.stats.lastOperationTime = new Date();

    if (this.config.enableLogging) {
      const status = result.success ? 'SUCCESS' : 'FAILED';
      console.log(`Execution recorded for ${schedule.name}: ${status} (${result.duration}ms)`);
    }
  }

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  getStats(): ReflectionSchedulerStats {
    const schedules = Array.from(this.schedules.values());
    
    // Calculate frequency distribution
    const schedulesByFrequency: Record<ScheduleFrequency, number> = {
      [ScheduleFrequency.HOURLY]: 0,
      [ScheduleFrequency.DAILY]: 0,
      [ScheduleFrequency.WEEKLY]: 0,
      [ScheduleFrequency.MONTHLY]: 0,
      [ScheduleFrequency.CUSTOM]: 0
    };

    // Calculate type distribution
    const schedulesByType: Record<string, number> = {};

    for (const schedule of schedules) {
      schedulesByFrequency[schedule.frequency]++;
      
      if (!schedulesByType[schedule.reflectionType]) {
        schedulesByType[schedule.reflectionType] = 0;
      }
      schedulesByType[schedule.reflectionType]++;
    }

    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.enabled).length,
      disabledSchedules: schedules.filter(s => !s.enabled).length,
      schedulesByFrequency,
      schedulesByType,
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      averageExecutionTime: this.stats.totalExecutions > 0 
        ? this.stats.totalExecutionTime / this.stats.totalExecutions 
        : 0
    };
  }

  async clear(): Promise<void> {
    // Stop scheduler if running
    await this.stop();
    
    // Clear all schedules
    this.schedules.clear();
    
    // Reset statistics
    this.stats = {
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      totalExecutionTime: 0,
      lastOperationTime: new Date()
    };

    if (this.config.enableLogging) {
      console.log('Scheduler cleared');
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async checkAndExecuteDueSchedules(): Promise<void> {
    try {
      const dueSchedules = await this.getDueSchedules();
      
      if (dueSchedules.length > 0 && this.config.enableLogging) {
        console.log(`Found ${dueSchedules.length} due schedule(s)`);
      }

      // In a real implementation, this would trigger actual reflection execution
      // For now, we just simulate the execution
      for (const schedule of dueSchedules) {
        await this.simulateExecution(schedule);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error checking due schedules:', error);
      }
    }
  }

  private async simulateExecution(schedule: ReflectionSchedule): Promise<void> {
    const startTime = Date.now();
    const success = Math.random() > 0.1; // 90% success rate for simulation
    const duration = 1000 + Math.random() * 2000; // 1-3 seconds

    const result: ScheduleExecutionResult = {
      scheduleId: schedule.id,
      executedAt: new Date(),
      success,
      duration,
      reflectionId: success ? ulid() : undefined,
      error: success ? undefined : 'Simulated execution failure',
      insights: success ? ['Simulated insight 1', 'Simulated insight 2'] : undefined
    };

    await this.recordExecution(result);
  }

  private validateScheduleConfig(config: PeriodicReflectionConfig): ScheduleValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Validate name
    if (!config.name || config.name.trim().length === 0) {
      errors.push('Schedule name is required');
      suggestions.push('Provide a valid schedule name');
    }

    // Validate description
    if (!config.description || config.description.trim().length === 0) {
      errors.push('Schedule description is required');
      suggestions.push('Provide a meaningful schedule description');
    }

    // Validate interval
    if (config.interval <= 0) {
      errors.push('Interval must be positive');
      suggestions.push('Set interval to a positive number of milliseconds');
    }

    // Validate frequency
    if (!Object.values(ScheduleFrequency).includes(config.frequency)) {
      errors.push('Invalid frequency value');
      suggestions.push('Use a valid ScheduleFrequency enum value');
    }

    // Validate reflection type
    if (!config.reflectionType || config.reflectionType.trim().length === 0) {
      errors.push('Reflection type is required');
      suggestions.push('Specify the type of reflection to perform');
    }

    // Validate trigger conditions
    if (!config.triggerConditions || config.triggerConditions.length === 0) {
      errors.push('At least one trigger condition is required');
      suggestions.push('Define trigger conditions for the schedule');
    }

    // Validate analysis depth
    if (!['basic', 'detailed', 'comprehensive'].includes(config.analysisDepth)) {
      errors.push('Invalid analysis depth');
      suggestions.push('Use basic, detailed, or comprehensive for analysis depth');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  private getFrequencyWeight(frequency: ScheduleFrequency): number {
    switch (frequency) {
      case ScheduleFrequency.HOURLY: return 1;
      case ScheduleFrequency.DAILY: return 2;
      case ScheduleFrequency.WEEKLY: return 3;
      case ScheduleFrequency.MONTHLY: return 4;
      case ScheduleFrequency.CUSTOM: return 5;
      default: return 3;
    }
  }
} 