import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { AutonomySystem } from '../../../lib/shared/types/agent';
import { planTask, PlanResult } from '../../../server/agents/planner';
import { executePlan } from '../../../server/agents/executor';

// Define interfaces for plan and execution results
export interface PlanWithSteps {
  description: string;
  steps: { action: string; description: string }[];
}

export interface ExecutionStep {
  step: string;
  success: boolean;
  output: string;
}

export interface ExecutionWithSteps {
  success: boolean;
  summary: string;
  steps: ExecutionStep[];
}

// Type for ExecutionResult from executePlan function
export interface ExecutionResult {
  success: boolean;
  output: string;
  stepResults: {
    step: string;
    success: boolean;
    output: string;
  }[];
  error?: string;
}

export interface PlanningManagerOptions {
  agentId: string;
  memory: ChloeMemory;
  model: ChatOpenAI;
  taskLogger: TaskLogger;
  autonomySystem?: AutonomySystem;
  notifyFunction?: (message: string) => void;
}

/**
 * Manages planning and execution for the Chloe agent
 */
export class PlanningManager {
  private agentId: string;
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private taskLogger: TaskLogger;
  private autonomySystem?: AutonomySystem;
  private notifyFunction?: (message: string) => void;
  private initialized: boolean = false;

  constructor(options: PlanningManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.taskLogger;
    this.autonomySystem = options.autonomySystem;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Initialize the planning system
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing planning system...');
      this.initialized = true;
      console.log('Planning system initialized successfully');
    } catch (error) {
      console.error('Error initializing planning system:', error);
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
      
      this.taskLogger.logAction('Planning task', { task });
      
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
      console.error('Error planning task:', error);
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
      if (!this.initialized) {
        await this.initialize();
      }
      
      this.taskLogger.logAction('Executing plan', { planDescription: plan.description });
      
      // Convert PlanWithSteps to string[] for executePlan
      const planSteps = plan.steps.map(step => step.description);
      
      // Generate context from the plan description
      const context = `Executing plan: ${plan.description}\n\nThis plan has ${planSteps.length} steps.`;
      
      // Execute the plan
      const result = await executePlan(
        planSteps,
        context,
        {
          memory: this.memory,
          stopOnFailure: false
        }
      );
      
      // Log each step execution
      if (result.stepResults) {
        result.stepResults.forEach((step, index) => {
          this.taskLogger.logAction(`Completed step ${index + 1}`, { 
            step: step.step,
            success: step.success,
            output: step.output.substring(0, 100) + (step.output.length > 100 ? '...' : '')
          });
        });
      }
      
      // Notify about the execution if notification function is available
      if (this.notifyFunction) {
        const successText = result.success ? 'Successfully' : 'Failed to';
        this.notifyFunction(`${successText} executed plan: ${plan.description}. ${result.output.substring(0, 200)}`);
      }
      
      return result;
    } catch (error) {
      console.error('Error executing plan:', error);
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
      console.error('Error in plan and execute:', error);
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
      
      this.taskLogger.logAction('Running daily tasks');
      
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
        this.notifyFunction(`${statusMessage} daily tasks. ${executionResult.output.substring(0, 200)}`);
      }
      
      // Log the execution result
      this.taskLogger.logAction('Completed daily tasks', {
        success: executionResult.success,
        output: executionResult.output
      });
      
      // Store results in memory
      await this.memory.addMemory(
        `Daily tasks execution: ${executionResult.output}`,
        'daily_tasks',
        executionResult.success ? 'medium' : 'high',
        'system'
      );
    } catch (error) {
      console.error('Error running daily tasks:', error);
      
      if (this.notifyFunction) {
        this.notifyFunction(`Error running daily tasks: ${error}`);
      }
      
      // Log the error
      this.taskLogger.logAction('Error in daily tasks', {
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
} 