import { PlanningTask, SubGoal } from "../graph/nodes/types";
import { ChloeMemory } from "../memory";

/**
 * Represents a time estimate for a task with confidence level and optional notes.
 */
export interface TimeEstimate {
  durationHours: number;
  confidence: number; // e.g., 0.8
  estimationNotes?: string;
}

// Task type to complexity mappings (base hours)
const TASK_TYPE_COMPLEXITY: Record<string, number> = {
  research: 2.5,
  writing: 1.5,
  outreach: 1.0,
  analysis: 2.0,
  planning: 1.0,
  meeting: 1.0,
  design: 2.0,
  development: 3.0,
  review: 1.0,
  default: 1.5
};

// Complexity multipliers based on priority
const PRIORITY_MULTIPLIERS: Record<number, number> = {
  1: 1.5,  // Highest priority - typically more complex
  2: 1.3,
  3: 1.0,  // Medium priority - baseline
  4: 0.8,
  5: 0.7   // Lowest priority - typically simpler
};

/**
 * Estimates the duration of a task based on its type, complexity, and past similar tasks.
 * 
 * @param task The planning task to estimate time for
 * @param memory Optional memory instance to check past task durations
 * @returns A time estimate with duration and confidence
 */
export async function estimateTaskDuration(
  task: PlanningTask,
  memory?: ChloeMemory
): Promise<TimeEstimate> {
  // Extract task type from goal or metadata
  const taskType = task.type || detectTaskTypeFromGoal(task.goal);
  
  // Base estimation using task type
  const baseHours = TASK_TYPE_COMPLEXITY[taskType] || TASK_TYPE_COMPLEXITY.default;
  
  // Calculate complexity based on subgoal count and structure
  let complexityMultiplier = calculateComplexityMultiplier(task.subGoals);
  
  // Apply strategic priority modifier
  const isStrategic = task.isStrategic === true;
  const priorityModifier = isStrategic ? 1.2 : 1.0;
  
  // Calculate initial estimation
  let estimatedHours = baseHours * complexityMultiplier * priorityModifier;
  
  // Get confidence level based on available data
  let confidence = 0.7; // Default moderate confidence
  let estimationNotes = `Based on task type: ${taskType}`;
  
  // If memory is available, check for similar past tasks
  if (memory) {
    try {
      const similarTasks = await findSimilarPastTasks(task, memory);
      
      if (similarTasks.length > 0) {
        // Adjust estimation based on past similar tasks
        const pastDurations = similarTasks.map(t => t.duration || 0);
        const avgPastDuration = pastDurations.reduce((sum, d) => sum + d, 0) / pastDurations.length;
        
        if (avgPastDuration > 0) {
          // Blend historical data with heuristic estimate (70% history, 30% heuristic)
          estimatedHours = (avgPastDuration * 0.7) + (estimatedHours * 0.3);
          confidence = Math.min(0.9, confidence + 0.15); // Increase confidence, max 0.9
          estimationNotes += `, adjusted with data from ${similarTasks.length} similar past tasks`;
        }
      }
    } catch (error) {
      console.error("Error finding similar past tasks:", error);
      // Continue with original estimate
    }
  }
  
  // Round to 1 decimal place
  estimatedHours = Math.round(estimatedHours * 10) / 10;
  
  return {
    durationHours: estimatedHours,
    confidence,
    estimationNotes
  };
}

/**
 * Calculate complexity multiplier based on subgoal structure
 */
function calculateComplexityMultiplier(subGoals: SubGoal[]): number {
  // Get total number of subgoals including children
  const allSubGoals = countAllSubGoals(subGoals);
  
  // Base multiplier on subgoal count
  if (allSubGoals <= 3) return 0.8;
  if (allSubGoals <= 5) return 1.0;
  if (allSubGoals <= 8) return 1.3;
  if (allSubGoals <= 12) return 1.6;
  return 2.0; // Very complex task
}

/**
 * Count all subgoals including children
 */
function countAllSubGoals(subGoals: SubGoal[]): number {
  let count = subGoals.length;
  
  // Add children count recursively
  for (const subGoal of subGoals) {
    if (subGoal.children && subGoal.children.length > 0) {
      count += countAllSubGoals(subGoal.children);
    }
  }
  
  return count;
}

/**
 * Detect task type from the goal text
 */
function detectTaskTypeFromGoal(goal: string): string {
  const lowerGoal = goal.toLowerCase();
  
  if (lowerGoal.includes('research') || lowerGoal.includes('investigate') || lowerGoal.includes('study')) {
    return 'research';
  } else if (lowerGoal.includes('write') || lowerGoal.includes('draft') || lowerGoal.includes('create content')) {
    return 'writing';
  } else if (lowerGoal.includes('email') || lowerGoal.includes('contact') || lowerGoal.includes('reach out')) {
    return 'outreach';
  } else if (lowerGoal.includes('analyze') || lowerGoal.includes('evaluate') || lowerGoal.includes('assess')) {
    return 'analysis';
  } else if (lowerGoal.includes('plan') || lowerGoal.includes('strategy') || lowerGoal.includes('roadmap')) {
    return 'planning';
  } else if (lowerGoal.includes('meet') || lowerGoal.includes('call') || lowerGoal.includes('conference')) {
    return 'meeting';
  } else if (lowerGoal.includes('design') || lowerGoal.includes('mockup') || lowerGoal.includes('visual')) {
    return 'design';
  } else if (lowerGoal.includes('develop') || lowerGoal.includes('code') || lowerGoal.includes('implement')) {
    return 'development';
  } else if (lowerGoal.includes('review') || lowerGoal.includes('feedback') || lowerGoal.includes('evaluate')) {
    return 'review';
  }
  
  return 'default';
}

/**
 * Find similar past tasks from memory
 */
async function findSimilarPastTasks(task: PlanningTask, memory: ChloeMemory): Promise<any[]> {
  // This is a simplified implementation
  // In a real system, you would use semantic search or filtering based on task properties
  
  try {
    const memoryResults = await memory.getRelevantMemories(
      `task duration ${task.goal} ${task.type || ''}`,
      5
    );
    
    return memoryResults.map(memory => {
      // Extract duration from memory if possible
      const durationMatch = memory.content.match(/completed in (\d+\.?\d*) hours/i);
      const duration = durationMatch ? parseFloat(durationMatch[1]) : null;
      
      return {
        content: memory.content,
        duration
      };
    }).filter(task => task.duration !== null);
  } catch (error) {
    console.error("Error searching memory for similar tasks:", error);
    return [];
  }
} 