import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory, ChloeMemoryType } from '../memory';
import { TaskLogger } from '../task-logger';
import { 
  AutonomySystem, 
  PlanAndExecuteOptions, 
  PlanAndExecuteResult, 
  PlanWithSteps as AgentPlanWithSteps, 
  IManager,
  PlanStep
} from '../../../lib/shared/types/agentTypes';
import { planTask, PlanResult } from '../../../server/agents/planner';
import { executePlan } from '../../../server/agents/executor';

// Define interfaces for plan and execution results
export interface PlanWithSteps {
  description: string;
  steps: { action: string; description: string }[];
}

// Original format from server
interface ServerExecutionResult {
  success: boolean;
  output: string;
  stepResults: {
    step: string;
    success: boolean;
    output: string;
  }[];
  error?: string;
}

// Our consistent interface
export interface ExecutionResult {
  success: boolean;
  message: string;
  completedSteps: number;
  totalSteps: number;
  error?: string;
  plan?: PlanWithSteps;
  output?: string; // For backward compatibility
  stepResults?: Array<{
    step: string;
    success: boolean;
    output: string;
  }>; // For backward compatibility
}

export interface PlanningManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  autonomySystem?: AutonomySystem;
  notifyFunction?: (message: string) => Promise<void>;
}

/**
 * Planning manager for the Chloe agent
 */
export class PlanningManager implements IManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private initialized: boolean = false;
  private autonomySystem?: AutonomySystem;
  private notifyFunction?: (message: string) => Promise<void>;
  
  constructor(options: PlanningManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
    this.autonomySystem = options.autonomySystem;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Get the agent ID this manager belongs to
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    this.taskLogger.logAction(`PlanningManager: ${action}`, metadata);
  }

  /**
   * Initialize the planning system
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing planning system');
      this.initialized = true;
      this.logAction('Planning system initialized successfully');
    } catch (error) {
      this.logAction('Error initializing planning system', { error: String(error) });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down planning system');
      
      // Add cleanup logic here if needed
      
      this.logAction('Planning system shutdown complete');
    } catch (error) {
      this.logAction('Error during planning system shutdown', { error: String(error) });
      throw error;
    }
  }

  /**
   * Plan a task and generate steps
   * @param task The task to plan
   * @returns A structured plan with steps
   */
  async planTask(task: string): Promise<PlanWithSteps> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logAction('Planning task', { task });
      
      // Get relevant context from memory
      const memoryContext = await this.memory.getRelevantMemories(task, 5);
      
      // Generate a plan using the planning system
      const planResult = await planTask(task, {
        memory: this.memory,
        maxSteps: 10,
        includeReasoning: true
      });
      
      // Convert PlanResult to PlanWithSteps
      const formattedPlan: PlanWithSteps = {
        description: `Plan for: ${task}`,
        steps: planResult.plan.map(step => ({
          action: step,
          description: step
        }))
      };
      
      return formattedPlan;
    } catch (error) {
      this.logAction('Error planning task', { error: String(error) });
      throw error;
    }
  }

  /**
   * Execute a plan with the given steps
   * @param plan The plan to execute
   * @returns Execution result with step outputs
   */
  async executePlan(plan: PlanWithSteps): Promise<ExecutionResult> {
    try {
      this.logAction('Executing plan', { description: plan.description });
      
      // Convert to the format expected by the executor
      const planSteps = plan.steps.map(step => step.action);
      
      // Execute the plan using the server execution function
      const serverResult = await executePlan(
        planSteps,
        this.agentId
      ) as ServerExecutionResult;
      
      // Convert to our consistent format
      const result: ExecutionResult = {
        success: serverResult.success,
        message: serverResult.output,
        output: serverResult.output, // For backward compatibility
        completedSteps: serverResult.stepResults.filter(step => step.success).length,
        totalSteps: serverResult.stepResults.length,
        error: serverResult.error,
        stepResults: serverResult.stepResults // For backward compatibility
      };

      // Log the execution result
      this.logAction('Completed plan execution', {
        success: result.success,
        stepsCompleted: result.completedSteps,
        totalSteps: result.totalSteps
      });
      
      // Notify about the execution if notification function is available
      if (this.notifyFunction) {
        const successText = result.success ? 'Successfully' : 'Failed to';
        this.notifyFunction(`${successText} executed plan: ${plan.description}. ${result.message.substring(0, 200)}`);
      }
      
      return result;
    } catch (error) {
      this.logAction('Error executing plan', { error: String(error) });
      throw error;
    }
  }

  /**
   * Plan and execute a task in one operation
   * @param task The task to plan and execute
   * @returns Execution result
   */
  async planAndExecuteTask(task: string): Promise<ExecutionResult> {
    try {
      // First plan the task
      const plan = await this.planTask(task);
      
      // Then execute the plan
      const result = await this.executePlan(plan);
      
      return result;
    } catch (error) {
      this.logAction('Error in plan and execute', { error: String(error) });
      throw error;
    }
  }

  /**
   * Run daily tasks as part of the autonomy system
   */
  async runDailyTasks(): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.logAction('Running daily tasks');
      
      // Generate a plan for daily tasks
      const dailyTaskPlan = await this.planTask(
        "Create a plan for today's key marketing activities. Include content review, trend analysis, and engagement strategies."
      );
      
      if (this.notifyFunction) {
        this.notifyFunction(`Daily tasks plan created: ${dailyTaskPlan.description}`);
      }
      
      // Execute the plan
      const executionResult = await this.executePlan(dailyTaskPlan);
      
      if (this.notifyFunction) {
        const statusMessage = executionResult.success ? 'Successfully executed' : 'Failed to execute';
        this.notifyFunction(`${statusMessage} daily tasks. ${executionResult.message.substring(0, 200)}`);
      }
      
      // Log the execution result
      this.logAction('Completed daily tasks', {
        success: executionResult.success,
        output: executionResult.message
      });
      
      // Store results in memory
      await this.memory.addMemory(
        `Daily tasks execution: ${executionResult.message}`,
        'task' as ChloeMemoryType,
        executionResult.success ? 'medium' : 'high',
        'system'
      );
    } catch (error) {
      this.logAction('Error running daily tasks', { error: String(error) });
      
      if (this.notifyFunction) {
        this.notifyFunction(`Error running daily tasks: ${error}`);
      }
      
      // Log the error
      this.logAction('Error in daily tasks', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if the planning system is initialized
   * @returns Whether the planning system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Adapter method for executing plans with the format expected by the agent
   * @param options Options for plan execution
   * @returns The execution result in the format expected by the agent
   */
  async planAndExecuteWithOptions(options: PlanAndExecuteOptions): Promise<PlanAndExecuteResult> {
    try {
      // First plan the task based on the goal prompt
      const plan = await this.planTask(options.goalPrompt);
      
      // Then execute the plan
      const result = await this.executePlan(plan);
      
      // Convert ExecutionResult to PlanAndExecuteResult
      const planAndExecuteResult: PlanAndExecuteResult = {
        success: result.success,
        message: result.message,
        plan: {
          goal: options.goalPrompt,
          steps: result.stepResults?.map(step => ({
            id: String(Math.random()).substring(2, 10),
            description: step.step,
            status: step.success ? 'completed' : 'failed'
          })) || [],
          reasoning: "Plan execution from planning manager"
        },
        error: result.error
      };
      
      return planAndExecuteResult;
    } catch (error) {
      this.logAction('Error in plan and execute with options', { error: String(error) });
      return {
        success: false,
        message: `Error executing plan: ${error}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 