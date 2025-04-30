import { ChloeAgent } from './core/agent';
import { ChloeGraph, PlanningState, createChloeGraph, SubGoal } from './graph';
import { createChloeTools } from './tools/index';
import type { ChloeMemory } from './memory';
import type { SimpleTool } from '../../lib/shared/types/agent';
import { ChatOpenAI } from '@langchain/openai';
import { TaskLogger } from './task-logger';
import { ImportanceLevel, MemorySource, ChloeMemoryType } from '../../constants/memory';

/**
 * Options for the plan and execute functionality
 */
export interface PlanAndExecuteOptions {
  goalPrompt: string;
  autonomyMode?: boolean;
  requireApproval?: boolean;
  tags?: string[];
}

/**
 * Type definition for the tools object returned by createChloeTools
 */
export interface ChloeTools {
  searchMemory: SimpleTool;
  summarizeRecentActivity: SimpleTool;
  proposeContentIdeas: SimpleTool;
  reflectOnPerformance: SimpleTool;
  notifyDiscord: SimpleTool;
  codaDocument: SimpleTool;
  marketScan: SimpleTool;
  intentRouter: SimpleTool;
  // Allow string indexing
  [key: string]: SimpleTool;
}

/**
 * Type for tool function bindings
 */
export type ToolFunctionBinding = (input: string) => Promise<string>;

/**
 * Extend the ChloeAgent interface to add the methods we need
 */
declare module './core/agent' {
  interface ChloeAgent {
    getModel(): ChatOpenAI | null;
    getChloeMemory(): ChloeMemory | null;
    getTaskLogger(): TaskLogger | null;
  }
}

/**
 * Extension method for the ChloeAgent class to add planning and execution capabilities
 */
export async function planAndExecute(
  this: ChloeAgent,
  options: PlanAndExecuteOptions
): Promise<PlanningState> {
  try {
    // Get required dependencies
    const model = this.getModel();
    const memory = this.getChloeMemory();
    const taskLogger = this.getTaskLogger();
    
    if (!this.isInitialized()) {
      throw new Error('Agent not initialized');
    }
    
    if (!model || !memory || !taskLogger) {
      throw new Error('Required dependencies not available');
    }
    
    // Create a new session for tracking this execution
    taskLogger.createSession(`Plan and Execute: ${options.goalPrompt.substring(0, 30)}...`, 
      [...(options.tags || []), 'plan-execute']
    );
    
    // Log the start of execution
    taskLogger.logAction('Started planning and execution', {
      goal: options.goalPrompt,
      autonomyMode: options.autonomyMode,
      requireApproval: options.requireApproval,
      timestamp: new Date().toISOString()
    });
    
    // Create tool instances with proper typing
    const tools = createChloeTools(memory, model);
    
    // Create a map of tool bindings, checking that each tool exists
    const toolBindings: Record<string, ToolFunctionBinding> = {};
    
    // Helper function to safely bind tool methods
    const safeBindTool = (toolKey: string, internalName: string) => {
      if (tools[toolKey] && typeof tools[toolKey]._call === 'function') {
        toolBindings[internalName] = tools[toolKey]._call.bind(tools[toolKey]);
      } else {
        // Provide a fallback that returns an error message
        toolBindings[internalName] = async () => `Tool ${String(toolKey)} is not available`;
      }
    };
    
    // Bind all available tools
    safeBindTool('searchMemory', 'search_memory');
    safeBindTool('summarizeRecentActivity', 'summarize_recent_activity');
    safeBindTool('proposeContentIdeas', 'propose_content_ideas');
    safeBindTool('reflectOnPerformance', 'reflect_on_performance');
    safeBindTool('notifyDiscord', 'notify_discord');
    safeBindTool('marketScan', 'market_scan');
    safeBindTool('intentRouter', 'intent_router');
    safeBindTool('codaDocument', 'coda_document');
    
    // Create the graph
    const graph = createChloeGraph({
      model,
      memory,
      taskLogger,
      tools: toolBindings
    });
    
    // Add plan to memory
    await memory.addMemory(
      `Goal: ${options.goalPrompt}`,
      ChloeMemoryType.PLAN,
      ImportanceLevel.HIGH,
      MemorySource.AGENT,
      'Plan and execute workflow',
      ['plan', 'goal']
    );
    
    // Execute the graph
    const result = await graph.execute(options.goalPrompt);
    
    // Log the completion
    taskLogger.logAction('Completed planning and execution', {
      goal: options.goalPrompt,
      finalResult: result.finalResult,
      completedTasks: result.task?.subGoals.filter((t: SubGoal) => t.status === 'completed').length || 0,
      failedTasks: result.task?.subGoals.filter((t: SubGoal) => t.status === 'failed').length || 0,
      timestamp: new Date().toISOString()
    });
    
    // Store the execution result in memory
    if (result.finalResult) {
      await memory.addMemory(
        result.finalResult,
        ChloeMemoryType.EXECUTION_RESULT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        `Goal: ${options.goalPrompt}`,
        ['execution', 'result']
      );
    }
    
    // Optionally notify about completion
    if (result.finalResult && options.autonomyMode) {
      try {
        // Access notifyDiscord tool properly using an index signature
        const notifyDiscord = tools['notifyDiscord'];
        if (notifyDiscord && typeof notifyDiscord._call === 'function') {
          await notifyDiscord._call.bind(notifyDiscord)(
            `📊 Completed autonomous execution for goal: "${options.goalPrompt}"\n\n` +
            `Summary: ${result.finalResult.substring(0, 1500)}...`
          );
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        taskLogger.logAction('Failed to send Discord notification', { error: errorMessage });
      }
    }
    
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log the error
    this.getTaskLogger()?.logAction('Error in plan and execute', {
      goal: options.goalPrompt,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    // Return a basic state with the error
    return {
      goal: options.goalPrompt,
      messages: [],
      executionTrace: [{
        step: `Error: ${errorMessage}`,
        startTime: new Date(),
        status: 'error',
        details: { error: errorMessage }
      }],
      error: errorMessage
    };
  }
}

/**
 * Attaches the planAndExecute method to the ChloeAgent prototype
 */
export function attachPlanAndExecute(): void {
  // Add the method to the prototype to make it available on all instances
  Object.defineProperty(ChloeAgent.prototype, 'planAndExecute', {
    value: planAndExecute,
    writable: false,
    configurable: true
  });
}

// Automatically attach the method
attachPlanAndExecute(); 