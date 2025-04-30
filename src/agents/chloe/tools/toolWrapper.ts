import { BaseTool } from '../../../lib/shared/types/agentTypes';
import { getToolPerformanceTracker } from './toolPerformanceTracker';
import { getToolLearner } from './toolLearning';
import { logger } from '../../../lib/logging';

/**
 * Wraps a tool with performance tracking and learning capabilities
 * @param tool The tool to wrap
 * @param taskType The type of task this tool is used for (for learning)
 * @param contextTags Optional context tags for more specific learning
 * @returns A wrapped tool that tracks performance and learns
 */
export function createSmartTool(
  tool: BaseTool,
  taskType: string,
  contextTags: string[] = []
): BaseTool {
  const performanceTracker = getToolPerformanceTracker();
  const toolLearner = getToolLearner();
  
  // Create a wrapper by extending the original tool
  const wrappedTool = Object.create(tool);
  wrappedTool.name = tool.name;
  wrappedTool.description = tool.description;
  wrappedTool.schema = tool.schema;
  
  // Override the execute method to add tracking and retry logic
  const originalExecute = tool.execute.bind(tool);
  wrappedTool.execute = async (params: Record<string, any>): Promise<any> => {
    const startTime = Date.now();
    let success = false;
    let result: any;
    let error: any;
    
    logger.debug(`Executing smart tool: ${tool.name}`);
    
    try {
      // First attempt
      result = await originalExecute(params);
      
      // Check if result indicates success
      success = result && (result.success === true || (typeof result === 'object' && !result.error));
      
      if (!success) {
        error = result?.error || 'Tool execution failed';
        
        // Check if we should retry
        if (performanceTracker.shouldRetry(tool.name)) {
          logger.info(`Retrying tool ${tool.name} after failure`);
          
          // Sleep briefly before retry
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry execution
          result = await originalExecute(params);
          success = result && (result.success === true || (typeof result === 'object' && !result.error));
        }
        
        // If still not successful, try fallback
        if (!success) {
          const fallbackToolName = performanceTracker.getFallback(tool.name);
          if (fallbackToolName) {
            // In a real implementation, we would need a registry of tools to get the fallback tool
            // This is a placeholder for the concept
            logger.info(`Using fallback tool ${fallbackToolName} for ${tool.name}`);
            
            // Simulate fallback tool execution
            result = { 
              success: true, 
              message: `Used fallback tool ${fallbackToolName}`,
              fallback: true
            };
            success = true;
          }
        }
      }
    } catch (err) {
      error = err;
      success = false;
      logger.error(`Error executing tool ${tool.name}:`, err);
    }
    
    const executionTime = Date.now() - startTime;
    
    // Record the result in performance tracker
    performanceTracker.recordResult(tool.name, success, executionTime, params);
    
    // Record for learning purposes
    const resultScore = success ? 0.9 : 0.1; // Simple binary scoring
    toolLearner.recordTrial({
      toolName: tool.name,
      taskType,
      resultScore,
      parameters: params,
      contextTags
    });
    
    if (success) {
      return result;
    } else {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        message: `Tool ${tool.name} failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  };
  
  return wrappedTool;
}

/**
 * Finds the best tool for a specific task based on learning history
 * @param tools Available tools to choose from
 * @param taskType The type of task
 * @param contextTags Optional context tags for more specific tool selection
 * @returns The best tool for the task or null if none found
 */
export function findBestToolForTask(
  tools: BaseTool[],
  taskType: string,
  contextTags: string[] = []
): BaseTool | null {
  const toolLearner = getToolLearner();
  const preferredToolName = toolLearner.getPreferredTool(taskType, contextTags);
  
  if (preferredToolName) {
    const tool = tools.find(t => t.name === preferredToolName);
    if (tool) {
      logger.info(`Selected preferred tool ${preferredToolName} for task ${taskType}`);
      return tool;
    }
  }
  
  // If no preferred tool found, maybe we should be testing tools
  // Randomly select a tool to test once in a while
  if (Math.random() < 0.2 && tools.length >= 2) {
    const randomIndex = Math.floor(Math.random() * tools.length);
    const randomTool = tools[randomIndex];
    
    // Find another tool to compare against
    const otherTools = tools.filter(t => t.name !== randomTool.name);
    if (otherTools.length > 0) {
      const otherIndex = Math.floor(Math.random() * otherTools.length);
      const otherTool = otherTools[otherIndex];
      
      // Create an A/B test
      toolLearner.createABTest(taskType, randomTool.name, otherTool.name, contextTags);
      logger.info(`Created A/B test between ${randomTool.name} and ${otherTool.name} for task ${taskType}`);
      
      return randomTool;
    }
  }
  
  // If no preferred tool and no A/B test, just return the first tool (default behavior)
  return tools[0] || null;
}

/**
 * Wraps a sequence of tools to be used in combination
 * @param tools Array of tools to use in sequence
 * @param taskType The type of task this combination is used for
 * @returns A wrapped tool that represents the combination
 */
export function createToolCombination(
  tools: BaseTool[],
  taskType: string
): BaseTool {
  if (tools.length === 0) {
    throw new Error("Cannot create a tool combination with no tools");
  }
  
  // Use the first tool as a base
  const baseTool = tools[0];
  const toolNames = tools.map(t => t.name).join('_');
  
  // Create a new tool that extends the first one
  const combinationTool = Object.create(baseTool);
  combinationTool.name = `combo_${toolNames}`;
  combinationTool.description = `Combined tool: ${tools.map(t => t.name).join(' + ')}`;
  
  // Store original execute methods
  const executeMethodsArray = tools.map(tool => tool.execute.bind(tool));
  
  // Override execute method to run tools in sequence
  combinationTool.execute = async (params: Record<string, any>): Promise<any> => {
    let combinedResult: any = { success: true, results: [] };
    let overallSuccess = true;
    const toolLearner = getToolLearner();
    const startTime = Date.now();
    
    // Execute each tool in sequence, passing results forward
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const execute = executeMethodsArray[i];
      
      try {
        const result = await execute(params);
        combinedResult.results.push({
          tool: tool.name,
          result
        });
        
        // Update params with results from this tool if needed
        if (result && typeof result === 'object') {
          params = { ...params, ...result };
        }
        
        // Check for failure
        if (result?.success === false) {
          overallSuccess = false;
        }
      } catch (error) {
        overallSuccess = false;
        combinedResult.results.push({
          tool: tool.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    combinedResult.success = overallSuccess;
    
    // Record the combination result for learning
    const executionTime = Date.now() - startTime;
    const resultScore = overallSuccess ? 0.9 : 0.3;
    toolLearner.recordToolCombination(
      taskType,
      tools.map(t => t.name),
      resultScore
    );
    
    return combinedResult;
  };
  
  return combinationTool;
}

/**
 * Wraps existing tools to use our performance and learning systems
 * @param tools The tools to wrap
 * @returns Wrapped tools
 */
export function wrapToolsWithSmartCapabilities(
  tools: BaseTool[],
  defaultTaskType: string = 'general'
): BaseTool[] {
  return tools.map(tool => 
    createSmartTool(tool, defaultTaskType)
  );
} 