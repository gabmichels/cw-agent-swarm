import { TaskLogger } from "../../task-logger";

// Define the interface for execution trace entries
export interface ExecutionTraceEntry {
  step: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'success' | 'error' | 'warning';
  details?: any;
}

// Define the state interface
export interface ExecutionState {
  executionTrace: ExecutionTraceEntry[];
  error?: string;
  result?: any;
  [key: string]: any;
}

/**
 * Execute a node in the task graph
 * @param taskFn The task function to execute
 * @param state The current execution state
 * @param taskLogger Logger instance for tracking execution
 * @returns Updated execution state
 */
export async function executeNode(
  taskFn: (state: ExecutionState) => Promise<any>,
  state: ExecutionState,
  taskLogger: TaskLogger
): Promise<ExecutionState> {
  // Record the start time for execution tracking
  const startTime = new Date();
  
  try {
    // Execute the task function
    taskLogger.logAction("Executing node", { timestamp: startTime.toISOString() });
    
    // Call the task function with the current state
    const result = await taskFn(state);
    
    // Calculate duration for success case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Log the successful execution
    taskLogger.logAction("Node execution completed", { 
      duration,
      timestamp: endTime.toISOString()
    });
    
    // Create a trace entry for this execution
    const successTraceEntry: ExecutionTraceEntry = {
      step: "Task execution",
      startTime,
      endTime,
      duration,
      status: 'success',
      details: { result }
    };
    
    // Return updated state with the result and trace
    return {
      ...state,
      result,
      executionTrace: [...state.executionTrace, successTraceEntry],
    };
  } catch (error) {
    // Calculate duration for error case
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    taskLogger.logAction("Error in execution", { error: errorMessage });
    
    const errorTraceEntry: ExecutionTraceEntry = {
      step: `Error in execution: ${errorMessage}`,
      startTime,
      endTime,
      duration,
      status: 'error',
      details: { error: errorMessage }
    };
    
    return {
      ...state,
      error: `Error in execution: ${errorMessage}`,
      executionTrace: [...state.executionTrace, errorTraceEntry],
    };
  } 
} 