/**
 * Implementation of tool executor for handling tool execution
 */
import { IToolExecutor } from '../interfaces/tool-executor.interface';
import { Tool, ToolExecutionOptions, ToolExecutionResult } from '../types';
import { StructuredId, IdGenerator } from '../../../utils/ulid';

/**
 * Structure to track ongoing executions
 */
interface ExecutionTracker {
  startTime: number;
  toolId: string;
  args: Record<string, unknown>;
  timeoutId?: NodeJS.Timeout;
  promise?: Promise<ToolExecutionResult>;
  cancel?: () => void;
}

export class ToolExecutor implements IToolExecutor {
  /**
   * Map of ongoing executions by ID
   */
  private activeExecutions: Map<string, ExecutionTracker> = new Map();
  
  /**
   * Execute a tool with the given arguments
   * @param tool Tool to execute
   * @param args Arguments for the tool execution
   * @param options Optional execution options
   * @returns Result of the tool execution
   */
  async executeTool(
    tool: Tool,
    args: Record<string, unknown>,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    // Validate arguments if the tool has a schema
    if (tool.schema) {
      const validation = this.validateArguments(tool, args);
      if (!validation.valid) {
        return this.createErrorResult(
          tool.id, 
          'INVALID_ARGUMENTS',
          `Invalid arguments: ${validation.errors?.join(', ')}`
        );
      }
    }
    
    // Generate execution ID
    const executionId = this.generateExecutionId(tool.id);
    
    // Create execution tracker
    const tracker: ExecutionTracker = {
      startTime: Date.now(),
      toolId: tool.id,
      args,
    };
    
    // Create cancellable execution
    try {
      // Set up timeout if specified
      if (options?.timeout) {
        const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) => {
          const timeoutId = setTimeout(() => {
            // Remove from active executions
            this.activeExecutions.delete(executionId.toString());
            reject(new Error(`Tool execution timed out after ${options.timeout}ms`));
          }, options.timeout);
          
          tracker.timeoutId = timeoutId;
        });
        
        // Create cancellable execution promise
        const executionPromise = this.executeWithTracking(tool, args, executionId, options);
        
        // Store the promise in the tracker
        tracker.promise = executionPromise;
        
        // Register the execution
        this.activeExecutions.set(executionId.toString(), tracker);
        
        // Race the execution against the timeout
        return Promise.race([executionPromise, timeoutPromise])
          .finally(() => {
            // Clear the timeout
            if (tracker.timeoutId) {
              clearTimeout(tracker.timeoutId);
            }
            
            // Remove from active executions
            this.activeExecutions.delete(executionId.toString());
          });
      } else {
        // No timeout, just execute normally
        const executionPromise = this.executeWithTracking(tool, args, executionId, options);
        
        // Store the promise in the tracker
        tracker.promise = executionPromise;
        
        // Register the execution
        this.activeExecutions.set(executionId.toString(), tracker);
        
        // Execute and clean up
        return executionPromise.finally(() => {
          this.activeExecutions.delete(executionId.toString());
        });
      }
    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createErrorResult(tool.id, 'EXECUTION_ERROR', errorMessage);
    }
  }
  
  /**
   * Validate arguments against the tool's schema
   * @param tool Tool to validate arguments for
   * @param args Arguments to validate
   * @returns Whether the arguments are valid, and validation errors if any
   */
  validateArguments(
    tool: Tool,
    args: Record<string, unknown>
  ): {
    valid: boolean;
    errors?: string[];
  } {
    // If no schema, consider it valid
    if (!tool.schema) {
      return { valid: true };
    }
    
    // For demonstration, perform basic validation
    // In a real implementation, this would use JSON Schema or similar
    const errors: string[] = [];
    
    // Check for required fields (assuming schema has a 'required' array)
    const required = tool.schema.required as string[] || [];
    for (const field of required) {
      if (!(field in args)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check for unknown fields (assuming schema has a 'properties' object)
    const properties = tool.schema.properties as Record<string, unknown> || {};
    for (const field of Object.keys(args)) {
      if (!(field in properties)) {
        errors.push(`Unknown field: ${field}`);
      }
    }
    
    // Could add type validation here as well
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Retry a failed tool execution
   * @param tool Tool to retry
   * @param args Arguments for the tool execution
   * @param previousResult Previous failed result
   * @param options Optional execution options
   * @returns Result of the retry execution
   */
  async retryExecution(
    tool: Tool,
    args: Record<string, unknown>,
    previousResult: ToolExecutionResult,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    // Implement retry logic with backoff if specified
    const retryConfig = options?.retry;
    if (retryConfig && retryConfig.maxAttempts > 0) {
      let currentAttempt = 1;
      let lastError = previousResult.error?.message || 'Unknown error';
      
      while (currentAttempt <= retryConfig.maxAttempts) {
        try {
          // Wait for the delay if specified and not the first attempt
          if (retryConfig.delayMs && currentAttempt > 1) {
            await new Promise(resolve => setTimeout(resolve, retryConfig.delayMs));
          }
          
          // Try to execute the tool again
          return await this.executeTool(tool, args, {
            ...options,
            timeout: options.timeout, // Maintain original timeout
            retry: undefined // Prevent infinite retry loops
          });
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          currentAttempt++;
        }
      }
      
      // If we get here, all retry attempts failed
      return this.createErrorResult(
        tool.id,
        'MAX_RETRIES_EXCEEDED',
        `Failed after ${retryConfig.maxAttempts} attempts. Last error: ${lastError}`
      );
    } else {
      // No retry strategy, just execute once
      return this.executeTool(tool, args, options);
    }
  }
  
  /**
   * Cancel an ongoing tool execution if possible
   * @param executionId ID of the execution to cancel
   * @returns Whether the execution was successfully canceled
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false; // No such execution
    }
    
    // Clear timeout if exists
    if (execution.timeoutId) {
      clearTimeout(execution.timeoutId);
    }
    
    // Call cancel function if exists
    if (execution.cancel) {
      execution.cancel();
    }
    
    // Remove from active executions
    this.activeExecutions.delete(executionId);
    
    return true;
  }
  
  /**
   * Check if a tool execution is still in progress
   * @param executionId ID of the execution to check
   * @returns Whether the execution is still in progress
   */
  isExecutionInProgress(executionId: string): boolean {
    return this.activeExecutions.has(executionId);
  }
  
  /**
   * Execute a tool with tracking and handle errors
   * @param tool Tool to execute
   * @param args Arguments for the tool execution
   * @param executionId ID for the execution
   * @param options Optional execution options
   * @returns Result of the tool execution
   */
  private async executeWithTracking(
    tool: Tool,
    args: Record<string, unknown>,
    executionId: StructuredId,
    options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    let success = false;
    let data: unknown = null;
    let error: { message: string; code: string; details?: unknown } | undefined;
    
    try {
      // Execute the tool
      const result = await tool.execute(args);
      
      // Handle the result
      success = result.success;
      data = result.data;
      error = result.error;
      
      return {
        id: executionId,
        toolId: tool.id,
        success,
        data,
        error,
        metrics: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime
        }
      };
    } catch (err) {
      // Handle any unhandled errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      return this.createErrorResult(tool.id, 'UNHANDLED_ERROR', errorMessage, executionId, startTime);
    }
  }
  
  /**
   * Create an error result
   * @param toolId ID of the tool
   * @param code Error code
   * @param message Error message
   * @param executionId Optional execution ID
   * @param startTime Optional start time
   * @returns Error result
   */
  private createErrorResult(
    toolId: string,
    code: string,
    message: string,
    executionId?: StructuredId,
    startTime?: number
  ): ToolExecutionResult {
    const start = startTime || Date.now();
    const end = Date.now();
    return {
      id: executionId || this.generateExecutionId(toolId),
      toolId,
      success: false,
      error: {
        code,
        message,
      },
      metrics: {
        startTime: start,
        endTime: end,
        durationMs: end - start
      }
    };
  }
  
  /**
   * Generate a structured ID for an execution
   * @param toolId ID of the tool being executed
   * @returns Structured ID
   */
  private generateExecutionId(toolId: string): StructuredId {
    // Use the IdGenerator class from utils/ulid
    return IdGenerator.generate(`EXEC_${toolId}`);
  }
} 