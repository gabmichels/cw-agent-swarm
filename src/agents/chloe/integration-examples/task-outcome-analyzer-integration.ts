/**
 * Integration example for TaskOutcomeAnalyzer
 * 
 * This file shows how to integrate the TaskOutcomeAnalyzer into Chloe's execution system
 * with minimal modifications to the core codebase.
 */

import { PlannedTask } from '../human-collaboration';
import { ExecutionTraceEntry } from '../graph/nodes/types';
import { onTaskStateChange } from '../hooks/taskCompletionHook';
import { ChloeMemory } from '../memory';
import { getLessonsForTask } from '../self-improvement/taskOutcomeIntegration';

/**
 * Example of using the task completion hook in an executor
 * 
 * This is a simplified example of how you would integrate the hook 
 * in the actual task execution system.
 */
async function exampleExecutorWithTaskOutcomeAnalysis(
  task: PlannedTask,
  memory: ChloeMemory
): Promise<void> {
  // Create an execution trace to track what happens during execution
  const executionTrace: ExecutionTraceEntry[] = [];
  
  try {
    console.log(`Starting execution of task: ${task.goal}`);
    
    // STEP 1: Before execution, get relevant lessons from past tasks
    const relevantLessons = await getLessonsForTask(task.goal, task.type, memory);
    if (relevantLessons.length > 0) {
      console.log("Applying lessons from previous tasks:");
      relevantLessons.forEach(lesson => console.log(`- ${lesson}`));
    }
    
    // STEP 2: Record the start of execution in the trace
    const startTime = new Date();
    executionTrace.push({
      step: "Starting task execution",
      startTime,
      endTime: startTime, // Will be updated later
      duration: 0, // Will be calculated later
      status: "success",
      details: {}
    });
    
    // STEP 3: Execute each sub-goal (simplified for this example)
    // In the real implementation, this would be a more complex process
    for (const subGoal of task.subGoals) {
      console.log(`Executing sub-goal: ${subGoal.description}`);
      
      const subGoalStartTime = new Date();
      
      // Simulate execution - in real code this would call the actual execution logic
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mark the sub-goal as complete
      subGoal.status = "complete";
      
      // Record this step in the execution trace
      const subGoalEndTime = new Date();
      executionTrace.push({
        step: `Executed sub-goal: ${subGoal.description}`,
        startTime: subGoalStartTime,
        endTime: subGoalEndTime,
        duration: subGoalEndTime.getTime() - subGoalStartTime.getTime(),
        status: "success",
        details: {
          subGoalId: subGoal.id,
          description: subGoal.description
        }
      });
    }
    
    // STEP 4: Mark the task as complete
    task.status = "complete";
    
    // Update the first trace entry with the full execution time
    const endTime = new Date();
    executionTrace[0].endTime = endTime;
    executionTrace[0].duration = endTime.getTime() - startTime.getTime();
    
    console.log(`Task execution completed: ${task.goal}`);
    
    // STEP 5: Call the task outcome analyzer hook
    // This is the key integration point - a single hook call at the end of execution
    await onTaskStateChange(task, executionTrace, memory);
    
  } catch (error) {
    console.error(`Error executing task: ${error instanceof Error ? error.message : String(error)}`);
    
    // Record the error in the execution trace
    executionTrace.push({
      step: `Error: ${error instanceof Error ? error.message : String(error)}`,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: "error",
      details: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
    
    // Mark the task as failed
    task.status = "failed";
    
    // Still call the outcome analyzer to analyze the failure
    await onTaskStateChange(task, executionTrace, memory);
  }
}

/**
 * Integration points in Chloe's architecture
 * 
 * This demonstrates the two integration points needed:
 * 1. At the end of task execution (shown above in exampleExecutorWithTaskOutcomeAnalysis)
 * 2. At the beginning of task planning (shown below)
 */
async function exampleTaskPlanningWithLessons(
  taskDescription: string,
  taskType: string,
  memory: ChloeMemory
): Promise<PlannedTask> {
  console.log(`Planning task: ${taskDescription}`);
  
  // INTEGRATION POINT: Get relevant lessons from past tasks to improve planning
  const relevantLessons = await getLessonsForTask(taskDescription, taskType, memory);
  
  if (relevantLessons.length > 0) {
    console.log("Applying lessons from previous similar tasks:");
    relevantLessons.forEach(lesson => console.log(`- ${lesson}`));
  }
  
  // Rest of task planning logic would go here...
  // This is just a simplified example
  
  return {
    goal: taskDescription,
    type: taskType,
    reasoning: "Generated based on user request",
    subGoals: [
      {
        id: "sg1",
        description: "Example sub-goal 1",
        status: "pending",
        priority: 1
      },
      {
        id: "sg2",
        description: "Example sub-goal 2",
        status: "pending",
        priority: 2
      }
    ],
    status: "planning"
  };
}

/**
 * Run a demonstration of the integration
 */
async function runIntegrationDemo() {
  // Initialize memory
  const memory = new ChloeMemory();
  await memory.initialize();
  
  // Example: Task planning with lessons
  console.log("\n=== PLANNING PHASE ===");
  const task = await exampleTaskPlanningWithLessons(
    "Create a social media campaign for product X",
    "marketing",
    memory
  );
  
  // Example: Task execution with outcome analysis
  console.log("\n=== EXECUTION PHASE ===");
  await exampleExecutorWithTaskOutcomeAnalysis(task, memory);
  
  console.log("\n=== DEMO COMPLETE ===");
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runIntegrationDemo()
    .then(() => console.log("Integration demo completed successfully"))
    .catch(error => console.error("Error in integration demo:", error));
}

export { 
  exampleExecutorWithTaskOutcomeAnalysis,
  exampleTaskPlanningWithLessons,
  runIntegrationDemo
}; 