/**
 * Tool Manager for Chloe
 * 
 * Manages tool registration, execution, and failure handling
 */

import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';

/**
 * Standard tool execution result structure
 */
export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
  toolName: string;
  executionTime?: number;
  retryCount?: number;
  fallbackUsed?: boolean;
  fallbackToolName?: string;
}

/**
 * Options for tool execution
 */
export interface ToolExecutionOptions {
  allowRetry?: boolean;
  maxRetries?: number;
  fallbackTools?: string[];
  logToMemory?: boolean;
  taskId?: string;
}

/**
 * Tool Manager for handling tool registration, execution and failure handling
 */
export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private memory: ChloeMemory;
  
  constructor(memory: ChloeMemory) {
    this.memory = memory;
  }
  
  /**
   * Register a tool with the manager
   */
  registerTool(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already exists and will be overwritten`);
    }
    
    this.tools.set(tool.name, tool);
    console.log(`Registered tool: ${tool.name}`);
  }
  
  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Get all registered tools
   */
  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Execute a tool with standardized error handling and retries
   */
  async executeTool(
    toolName: string, 
    params: Record<string, any>,
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.getTool(toolName);
    
    // Default options
    const {
      allowRetry = true,
      maxRetries = 1,
      fallbackTools = [],
      logToMemory = true,
      taskId
    } = options;
    
    let retryCount = 0;
    let fallbackUsed = false;
    let fallbackToolName: string | undefined;
    
    // Check if tool exists
    if (!tool) {
      const result: ToolResult = {
        success: false,
        output: null,
        error: `Tool '${toolName}' not found`,
        toolName,
        executionTime: Date.now() - startTime,
        retryCount,
        fallbackUsed,
        fallbackToolName
      };
      
      // Log the tool failure to memory
      if (logToMemory) {
        await this.logToolFailureToMemory(result, params, taskId);
      }
      
      return result;
    }
    
    // Try primary tool execution with retries
    while (retryCount <= (allowRetry ? maxRetries : 0)) {
      try {
        // Execute the tool
        const output = await tool.execute(params);
        
        // If successful, return the result
        if (output.success) {
          return {
            success: true,
            output: output.response || output.data,
            toolName,
            executionTime: Date.now() - startTime,
            retryCount,
            fallbackUsed,
            fallbackToolName
          };
        }
        
        // If tool execution returned failed status
        if (retryCount < maxRetries && allowRetry) {
          console.log(`Tool '${toolName}' failed. Retrying (${retryCount + 1}/${maxRetries})...`);
          retryCount++;
          continue; // Retry
        }
        
        // If we have fallback tools, try them
        if (fallbackTools.length > 0) {
          for (const fbToolName of fallbackTools) {
            const fallbackTool = this.getTool(fbToolName);
            
            if (!fallbackTool) {
              console.log(`Fallback tool '${fbToolName}' not found. Skipping...`);
              continue;
            }
            
            console.log(`Attempting fallback tool '${fbToolName}'...`);
            try {
              const fallbackOutput = await fallbackTool.execute(params);
              
              if (fallbackOutput.success) {
                fallbackUsed = true;
                fallbackToolName = fbToolName;
                
                // Log fallback success
                const result: ToolResult = {
                  success: true,
                  output: fallbackOutput.response || fallbackOutput.data,
                  toolName,
                  executionTime: Date.now() - startTime,
                  retryCount,
                  fallbackUsed,
                  fallbackToolName
                };
                
                // Log the tool fallback to memory
                if (logToMemory) {
                  await this.logToolFallbackToMemory(result, params, taskId);
                }
                
                return result;
              }
            } catch (fallbackError) {
              console.error(`Fallback tool '${fbToolName}' execution error:`, fallbackError);
              // Continue to the next fallback
            }
          }
        }
        
        // If we reached here, both primary tool and fallbacks failed
        const result: ToolResult = {
          success: false,
          output: null,
          error: output.error || `Tool '${toolName}' execution failed after ${retryCount} retries`,
          toolName,
          executionTime: Date.now() - startTime,
          retryCount,
          fallbackUsed,
          fallbackToolName
        };
        
        // Log the tool failure to memory
        if (logToMemory) {
          await this.logToolFailureToMemory(result, params, taskId);
        }
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Tool '${toolName}' execution error:`, errorMsg);
        
        // If we can retry, do so
        if (retryCount < maxRetries && allowRetry) {
          console.log(`Retrying tool '${toolName}' (${retryCount + 1}/${maxRetries})...`);
          retryCount++;
          continue;
        }
        
        // Try fallbacks if available
        if (fallbackTools.length > 0) {
          for (const fbToolName of fallbackTools) {
            const fallbackTool = this.getTool(fbToolName);
            
            if (!fallbackTool) {
              console.log(`Fallback tool '${fbToolName}' not found. Skipping...`);
              continue;
            }
            
            console.log(`Attempting fallback tool '${fbToolName}'...`);
            try {
              const fallbackOutput = await fallbackTool.execute(params);
              
              if (fallbackOutput.success) {
                fallbackUsed = true;
                fallbackToolName = fbToolName;
                
                // Log fallback success
                const result: ToolResult = {
                  success: true,
                  output: fallbackOutput.response || fallbackOutput.data,
                  toolName,
                  executionTime: Date.now() - startTime,
                  retryCount,
                  fallbackUsed,
                  fallbackToolName
                };
                
                // Log the tool fallback to memory
                if (logToMemory) {
                  await this.logToolFallbackToMemory(result, params, taskId);
                }
                
                return result;
              }
            } catch (fallbackError) {
              console.error(`Fallback tool '${fbToolName}' execution error:`, fallbackError);
              // Continue to the next fallback
            }
          }
        }
        
        // All attempts failed
        const result: ToolResult = {
          success: false,
          output: null,
          error: errorMsg,
          toolName,
          executionTime: Date.now() - startTime,
          retryCount,
          fallbackUsed,
          fallbackToolName
        };
        
        // Log the tool failure to memory
        if (logToMemory) {
          await this.logToolFailureToMemory(result, params, taskId);
        }
        
        return result;
      }
    }
    
    // This should never happen but typescript requires it
    return {
      success: false,
      output: null,
      error: `Unexpected execution path for tool '${toolName}'`,
      toolName,
      executionTime: Date.now() - startTime,
      retryCount,
      fallbackUsed,
      fallbackToolName
    };
  }
  
  /**
   * Log tool failure to memory
   */
  private async logToolFailureToMemory(
    result: ToolResult, 
    params: Record<string, any>,
    taskId?: string
  ): Promise<void> {
    try {
      const content = `TOOL_FAILURE
Tool: ${result.toolName}
Error: ${result.error || 'Unknown error'}
Parameters: ${JSON.stringify(params, null, 2)}
Retry Count: ${result.retryCount || 0}
Fallback Attempted: ${result.fallbackUsed ? 'Yes' : 'No'}
${result.fallbackToolName ? `Fallback Tool: ${result.fallbackToolName}` : ''}
Execution Time: ${result.executionTime || 0}ms
${taskId ? `Task ID: ${taskId}` : ''}
      `;
      
      await this.memory.addMemory(
        content,
        'tool_failure',
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Tool execution failure: ${result.toolName}`,
        ['tool', 'error', 'failure', result.toolName]
      );
    } catch (error) {
      console.error('Failed to log tool failure to memory:', error);
    }
  }
  
  /**
   * Log tool fallback success to memory
   */
  private async logToolFallbackToMemory(
    result: ToolResult, 
    params: Record<string, any>,
    taskId?: string
  ): Promise<void> {
    try {
      const content = `TOOL_FALLBACK_USED
Primary Tool: ${result.toolName}
Fallback Tool: ${result.fallbackToolName}
Parameters: ${JSON.stringify(params, null, 2)}
Retry Count: ${result.retryCount || 0}
Execution Time: ${result.executionTime || 0}ms
${taskId ? `Task ID: ${taskId}` : ''}
      `;
      
      await this.memory.addMemory(
        content,
        'tool_fallback',
        ImportanceLevel.MEDIUM,
        MemorySource.SYSTEM,
        `Tool fallback success: ${result.toolName} → ${result.fallbackToolName}`,
        ['tool', 'fallback', 'recovery', result.toolName, result.fallbackToolName || '']
      );
    } catch (error) {
      console.error('Failed to log tool fallback to memory:', error);
    }
  }
} 