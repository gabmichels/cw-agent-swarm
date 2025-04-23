import { ChloeAgent } from './agent';
import { ChloeGraph, GraphState } from './graph/graph';
import { createChloeTools } from './tools';

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
 * Extension method for the ChloeAgent class to add planning and execution capabilities
 */
export async function planAndExecute(
  this: ChloeAgent,
  options: PlanAndExecuteOptions
): Promise<GraphState> {
  try {
    // Log that we're starting the planning and execution process
    console.log(`Starting planning and execution for goal: ${options.goalPrompt}`);
    
    if (!this.initialized) {
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
    
    // Create tool instances
    const tools = createChloeTools(memory, model);
    
    // Create the graph
    const graph = new ChloeGraph(
      model,
      memory,
      taskLogger,
      {
        search_memory: tools.searchMemory._call.bind(tools.searchMemory),
        summarize_recent_activity: tools.summarizeRecentActivity._call.bind(tools.summarizeRecentActivity),
        propose_content_ideas: tools.proposeContentIdeas._call.bind(tools.proposeContentIdeas),
        reflect_on_performance: tools.reflectOnPerformance._call.bind(tools.reflectOnPerformance),
        notify_discord: tools.notifyDiscord._call.bind(tools.notifyDiscord)
      },
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
        await tools.notifyDiscord._call.bind(tools.notifyDiscord)(
          `📊 Completed autonomous execution for goal: "${options.goalPrompt}"\n\n` +
          `Summary: ${result.finalOutput.substring(0, 1500)}...`
        );
      } catch (e) {
        console.error('Failed to send Discord notification:', e);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error in plan and execute:', error);
    
    // Log the error
    this.getTaskLogger()?.logAction('Error in plan and execute', {
      goal: options.goalPrompt,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Return a basic state with the error
    return {
      input: options.goalPrompt,
      plan: [],
      currentTaskIndex: 0,
      toolOutputs: {},
      reflections: [],
      messages: [`Error: ${error.message}`],
      error: error.message
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