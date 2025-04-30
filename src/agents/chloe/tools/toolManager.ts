/**
 * Tool Manager for Chloe
 * 
 * Manages tool registration, execution, and failure handling
 */

import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { logger } from '../../../lib/logging';
import { wrapToolsWithSmartCapabilities, findBestToolForTask, createToolCombination } from './toolWrapper';
import { getToolLearner } from './toolLearning';
import { getToolPerformanceTracker } from './toolPerformanceTracker';

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
 * Main tool management class that handles tool registration, selection,
 * and execution with our performance tracking and learning capabilities.
 * This replaces the previous intentRouter.ts functionality with a more
 * modern approach leveraging LangChain's agent planning capabilities.
 */
export class ToolManager {
  private tools: Map<string, BaseTool> = new Map();
  private taskTypeMap: Map<string, string[]> = new Map();
  private wrappedTools: Map<string, BaseTool> = new Map();
  private memory: ChloeMemory;
  
  constructor(memory: ChloeMemory) {
    this.memory = memory;
  }
  
  /**
   * Register a tool with the manager
   * @param tool The tool to register
   * @param taskTypes Array of task types this tool can handle
   */
  public registerTool(tool: BaseTool, taskTypes: string[] = ['general']): void {
    try {
      // Store in our registry
      this.tools.set(tool.name, tool);
      
      // Update task type mappings
      taskTypes.forEach(taskType => {
        const tools = this.taskTypeMap.get(taskType) || [];
        if (!tools.includes(tool.name)) {
          tools.push(tool.name);
          this.taskTypeMap.set(taskType, tools);
        }
      });
      
      // Create smart wrapped version
      const wrappedTool = wrapToolsWithSmartCapabilities([tool], taskTypes[0])[0];
      this.wrappedTools.set(tool.name, wrappedTool);
      
      logger.info(`Registered tool: ${tool.name} for task types: ${taskTypes.join(', ')}`);
    } catch (error) {
      logger.error(`Failed to register tool ${tool.name}:`, error);
    }
  }
  
  /**
   * Get all registered tools (wrapped with smart capabilities)
   * @returns Array of all registered tools
   */
  public getAllTools(): BaseTool[] {
    return Array.from(this.wrappedTools.values());
  }
  
  /**
   * Get tools that can handle a specific task type
   * @param taskType The task type
   * @returns Array of tools for that task
   */
  public getToolsForTaskType(taskType: string): BaseTool[] {
    try {
      const toolNames = this.taskTypeMap.get(taskType) || [];
      
      // If no specific tools for this task type, fall back to general tools
      if (toolNames.length === 0 && taskType !== 'general') {
        return this.getToolsForTaskType('general');
      }
      
      return toolNames
        .map(name => this.wrappedTools.get(name))
        .filter(Boolean) as BaseTool[];
    } catch (error) {
      logger.error(`Error getting tools for task type ${taskType}:`, error);
      return [];
    }
  }
  
  /**
   * Find the best tool for a specific task
   * @param taskType The task type
   * @param contextTags Optional context tags
   * @returns The best tool or null if none available
   */
  public getBestToolForTask(taskType: string, contextTags: string[] = []): BaseTool | null {
    try {
      const tools = this.getToolsForTaskType(taskType);
      if (tools.length === 0) {
        return null;
      }
      
      return findBestToolForTask(tools, taskType, contextTags);
    } catch (error) {
      logger.error(`Error finding best tool for task ${taskType}:`, error);
      return null;
    }
  }
  
  /**
   * Create a tool combination for a specific task
   * @param taskType The task type
   * @param toolNames Array of tool names to combine
   * @returns Combined tool
   */
  public createToolCombination(taskType: string, toolNames: string[]): BaseTool | null {
    try {
      const tools = toolNames
        .map(name => this.wrappedTools.get(name))
        .filter(Boolean) as BaseTool[];
      
      if (tools.length < 2) {
        throw new Error(`Need at least 2 tools to create a combination, got ${tools.length}`);
      }
      
      return createToolCombination(tools, taskType);
    } catch (error) {
      logger.error(`Error creating tool combination:`, error);
      return null;
    }
  }
  
  /**
   * Get tool combination suggestions for a task type
   * @param taskType The task type
   * @returns Array of tool combination options
   */
  public getToolCombinationSuggestions(taskType: string): BaseTool[] {
    try {
      const toolLearner = getToolLearner();
      const combos = toolLearner.suggestToolCombos(taskType);
      
      // Convert each combo string (comma-separated tool names) to a tool combination
      return combos
        .map(comboString => {
          const toolNames = comboString.split(',');
          return this.createToolCombination(taskType, toolNames);
        })
        .filter(Boolean) as BaseTool[];
    } catch (error) {
      logger.error(`Error getting tool combination suggestions:`, error);
      return [];
    }
  }
  
  /**
   * Get tools sorted by performance
   * @returns Array of tools sorted by performance
   */
  public getToolsSortedByPerformance(): BaseTool[] {
    try {
      const performanceTracker = getToolPerformanceTracker();
      const records = performanceTracker.getAllPerformanceRecords();
      
      // Sort by success rate and minimum trials
      const sortedRecords = records
        .filter(record => record.totalRuns >= 5) // Require minimum trials
        .sort((a, b) => b.successRate - a.successRate);
      
      // Map back to tools
      return sortedRecords
        .map(record => this.wrappedTools.get(record.toolName))
        .filter(Boolean) as BaseTool[];
    } catch (error) {
      logger.error(`Error getting sorted tools:`, error);
      return [];
    }
  }
  
  /**
   * Execute a tool with performance tracking
   * @param toolName Name of the tool to execute
   * @param params Parameters for the tool
   * @param taskType Optional task type
   * @param contextTags Optional context tags
   * @returns Result of tool execution
   */
  public async executeTool(
    toolName: string,
    params: Record<string, any>,
    taskType: string = 'general',
    contextTags: string[] = []
  ): Promise<any> {
    try {
      const tool = this.wrappedTools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Log the execution request
      logger.info(`Executing tool ${toolName} for task type ${taskType}`);
      
      return await tool.execute(params);
    } catch (error) {
      logger.error(`Error executing tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `Failed to execute tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * Execute a tool with standardized error handling and retries
   */
  async executeToolWithStandardErrorHandling(
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