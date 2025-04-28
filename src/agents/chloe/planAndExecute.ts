import { ChloeAgent } from './core/agent';
import { ChloeGraph, GraphState } from './graph/graph';
import { createChloeTools } from './tools/index';
import type { ChloeMemory } from './memory';
import type { SimpleTool } from '../../lib/shared/types/agent';

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
 * Extension method for the ChloeAgent class to add planning and execution capabilities
 */
export async function planAndExecute(
  this: ChloeAgent,
  options: PlanAndExecuteOptions
): Promise<GraphState> {
  try {
    // Log that we're starting the planning and execution process
    console.log(`Starting planning and execution for goal: ${options.goalPrompt}`);
    
    if (!this.isInitialized()) {
      throw new Error('Agent not initialized');
    }
    
    // Get required dependencies
    const model = this.getModel();
    const memory = this.getChloeMemory();
    const taskLogger = this.getTaskLogger();
    
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
    const toolBindings: Record<string, any> = {};
    
    // Helper function to safely bind tool methods
    const safeBindTool = (toolKey: string, internalName: string) => {
      if (tools[toolKey] && typeof tools[toolKey]._call === 'function') {
        toolBindings[internalName] = tools[toolKey]._call.bind(tools[toolKey]);
      } else {
        console.warn(`Tool ${String(toolKey)} not available or missing _call method`);
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
    const graph = new ChloeGraph(
      model,
      memory,
      taskLogger,
      toolBindings,
      {
        autonomyMode: options.autonomyMode,
        requireApproval: options.requireApproval
      }
    );
    
    // Add plan to memory
    await memory.addMemory(
      `Goal: ${options.goalPrompt}`,
      'plan',
      'high',
      'chloe',
      'Plan and execute workflow',
      ['plan', 'goal']
    );
    
    // Execute the graph
    const result = await graph.execute(options.goalPrompt);
    
    // Log the completion
    taskLogger.logAction('Completed planning and execution', {
      goal: options.goalPrompt,
      finalOutput: result.finalOutput,
      completedTasks: result.plan.filter(t => t.status === 'completed').length,
      failedTasks: result.plan.filter(t => t.status === 'failed').length,
      timestamp: new Date().toISOString()
    });
    
    // Store the execution result in memory
    if (result.finalOutput) {
      await memory.addMemory(
        result.finalOutput,
        'execution_result',
        'high',
        'chloe',
        `Goal: ${options.goalPrompt}`,
        ['execution', 'result']
      );
    }
    
    // Optionally notify about completion
    if (result.finalOutput && options.autonomyMode) {
      try {
        // Access notifyDiscord tool properly using an index signature
        const notifyDiscord = tools['notifyDiscord'];
        if (notifyDiscord && typeof notifyDiscord._call === 'function') {
          await notifyDiscord._call.bind(notifyDiscord)(
            `📊 Completed autonomous execution for goal: "${options.goalPrompt}"\n\n` +
            `Summary: ${result.finalOutput.substring(0, 1500)}...`
          );
        }
      } catch (e) {
        console.error('Failed to send Discord notification:', e);
      }
    }
    
    return result;
  } catch (error: unknown) {
    console.error('Error in plan and execute:', error);
    
    // Extract error message safely
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log the error
    this.getTaskLogger()?.logAction('Error in plan and execute', {
      goal: options.goalPrompt,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    // Return a basic state with the error
    return {
      input: options.goalPrompt,
      plan: [],
      currentTaskIndex: 0,
      toolOutputs: {},
      reflections: [],
      messages: [`Error: ${errorMessage}`],
      error: errorMessage
    };
  }
}

/**
 * Attaches the planAndExecute method to the ChloeAgent prototype
 */
export function attachPlanAndExecute(): void {
  // Add the method to the prototype to make it available on all instances
  (ChloeAgent.prototype as any).planAndExecute = planAndExecute;
}

// Automatically attach the method
attachPlanAndExecute(); 