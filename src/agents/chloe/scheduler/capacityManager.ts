import { ChloeScheduler } from "./chloeScheduler";
import { ChloeMemory } from "../memory";
import { TaskLogger } from "../task-logger";
import { PlanningTask } from "../graph/nodes/types";
import { TimeEstimate } from "../planning/timeEstimator";
import { ImportanceLevel, MemorySource } from "../../../constants/memory";
import { MemoryType } from "../../../server/memory/config/types";

/**
 * Represents Chloe's daily capacity and workload status
 */
export interface DailyCapacity {
  totalHours: number;
  allocatedHours: number;
  remainingHours: number;
  overload: boolean;
}

// Define a scheduled task interface based on what we've seen in the codebase
interface ScheduledTask {
  id: string;
  goalPrompt: string;
  scheduledFor?: string | Date;
  priority?: number;
  metadata?: {
    timeEstimate?: TimeEstimate;
    cannotDefer?: boolean;
    [key: string]: any;
  };
  tags?: string[];
}

// Default number of working hours per day
const DEFAULT_DAILY_HOURS = 8;

/**
 * Calculates Chloe's current capacity based on scheduled tasks
 * 
 * @param scheduler The scheduler containing today's tasks
 * @param memory Optional memory to log capacity information
 * @returns Current capacity status with overload flag
 */
export async function calculateChloeCapacity(
  scheduler: ChloeScheduler,
  memory?: ChloeMemory,
  taskLogger?: TaskLogger
): Promise<DailyCapacity> {
  // Get today's date at midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Tomorrow at midnight
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Get all scheduled tasks - assume we need to implement this functionality
  // since it doesn't exist on ChloeScheduler
  const allTasks: ScheduledTask[] = []; // We'll have to implement this function
  
  // Filter for today's tasks that have time estimates
  const todaysTasks = allTasks.filter((task: ScheduledTask) => {
    // If task has a scheduled date, check if it's today
    if (task.scheduledFor) {
      const taskDate = new Date(task.scheduledFor);
      return taskDate >= today && taskDate < tomorrow;
    }
    return false;
  });
  
  // Calculate total allocated hours from time estimates
  let allocatedHours = 0;
  
  todaysTasks.forEach((task: ScheduledTask) => {
    if (task.metadata?.timeEstimate) {
      const estimate = task.metadata.timeEstimate as TimeEstimate;
      allocatedHours += estimate.durationHours;
    } else {
      // Default time if no estimate available (1 hour)
      allocatedHours += 1;
    }
  });
  
  // Round to one decimal place
  allocatedHours = Math.round(allocatedHours * 10) / 10;
  
  // Calculate remaining hours
  const remainingHours = Math.max(0, DEFAULT_DAILY_HOURS - allocatedHours);
  
  // Determine if we're overloaded
  const overload = allocatedHours > DEFAULT_DAILY_HOURS;
  
  // Log this capacity information
  if (taskLogger) {
    taskLogger.logAction("Capacity calculated", {
      date: today.toISOString().split('T')[0],
      totalHours: DEFAULT_DAILY_HOURS,
      allocatedHours,
      remainingHours,
      taskCount: todaysTasks.length,
      overload
    });
  }
  
  // Store capacity data in memory if available
  if (memory) {
    await memory.addMemory(
      `Daily capacity for ${today.toISOString().split('T')[0]}: ${allocatedHours}/${DEFAULT_DAILY_HOURS} hours allocated. ${overload ? 'OVERLOADED' : 'Within capacity'}.`,
      MemoryType.CAPACITY_CHECK,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      undefined,
      ["capacity", "scheduler", "workload"]
    );
  }
  
  return {
    totalHours: DEFAULT_DAILY_HOURS,
    allocatedHours,
    remainingHours,
    overload
  };
}

/**
 * Defers lowest priority tasks to the next day when capacity is exceeded
 * 
 * @param scheduler The scheduler containing today's tasks
 * @param memory Optional memory to record deferral decisions
 * @param taskLogger Optional logger for tracking actions
 * @returns Information about deferred tasks
 */
export async function deferOverflowTasks(
  scheduler: ChloeScheduler,
  memory?: ChloeMemory,
  taskLogger?: TaskLogger
): Promise<{deferredTasks: number, deferredHours: number}> {
  // First calculate capacity
  const capacity = await calculateChloeCapacity(scheduler, memory, taskLogger);
  
  // If not overloaded, no need to defer
  if (!capacity.overload) {
    return { deferredTasks: 0, deferredHours: 0 };
  }
  
  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Tomorrow at midnight
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Get all scheduled tasks - assume we need to implement this functionality
  const allTasks: ScheduledTask[] = []; // We'll have to implement this function
  
  // Filter for today's tasks
  const todaysTasks = allTasks.filter((task: ScheduledTask) => {
    if (task.scheduledFor) {
      const taskDate = new Date(task.scheduledFor);
      return taskDate >= today && taskDate < tomorrow;
    }
    return false;
  });
  
  // Sort by priority (lowest priority and confidence first)
  const sortedTasks = [...todaysTasks].sort((a, b) => {
    // First by priority (higher priority number = lower priority)
    const priorityA = a.priority || 3;
    const priorityB = b.priority || 3;
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher number (lower priority) first
    }
    
    // Then by confidence (lower confidence first)
    const confidenceA = a.metadata?.timeEstimate?.confidence || 0.5;
    const confidenceB = b.metadata?.timeEstimate?.confidence || 0.5;
    
    return confidenceA - confidenceB;
  });
  
  // How many hours need to be deferred
  const hoursToDefer = capacity.allocatedHours - capacity.totalHours;
  
  let deferredHours = 0;
  const deferredTaskIds: string[] = [];
  
  // Defer tasks until we're back under capacity
  for (const task of sortedTasks) {
    // Skip urgent tasks (priority 1)
    if (task.priority === 1) continue;
    
    // Skip tasks marked as cannot-defer
    if (task.metadata?.cannotDefer === true) continue;
    
    // Get the task's time estimate
    const estimate = task.metadata?.timeEstimate as TimeEstimate;
    const taskHours = estimate ? estimate.durationHours : 1;
    
    // Defer this task
    const taskDate = new Date(task.scheduledFor!);
    
    // Schedule for tomorrow
    const newDate = new Date(taskDate);
    newDate.setDate(newDate.getDate() + 1);
    
    // Update the task's scheduled date - we need to implement this functionality
    // since it doesn't exist on ChloeScheduler
    const updated = true; // Placeholder for scheduler.updateTaskSchedule(task.id, newDate);
    
    if (updated) {
      deferredHours += taskHours;
      deferredTaskIds.push(task.id);
      
      // Log the deferral
      if (taskLogger) {
        taskLogger.logAction("Task deferred", {
          taskId: task.id,
          goalPrompt: task.goalPrompt,
          hours: taskHours,
          oldDate: taskDate.toISOString(),
          newDate: newDate.toISOString(),
          priority: task.priority || 3,
        });
      }
    }
    
    // Check if we've deferred enough hours
    if (deferredHours >= hoursToDefer) {
      break;
    }
  }
  
  // Record in memory
  if (memory && deferredTaskIds.length > 0) {
    await memory.addMemory(
      `Deferred ${deferredTaskIds.length} tasks (${deferredHours.toFixed(1)} hours) due to capacity overload on ${today.toISOString().split('T')[0]}.`,
      MemoryType.SCHEDULING_ADJUSTMENT,
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      undefined,
      ["capacity", "scheduler", "task_deferral"]
    );
  }
  
  return {
    deferredTasks: deferredTaskIds.length,
    deferredHours
  };
} 