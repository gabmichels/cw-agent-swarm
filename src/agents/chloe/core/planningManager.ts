import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
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
import { ImportanceLevel, MemorySource, MemoryType } from '../../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config';
import { ChloeAgent } from '../core/agent';
import { ChloeScheduler } from '../scheduler/chloeScheduler';
import { BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { MemoryEntry } from '../memory';
import { logger } from '../../../lib/logging';
import { createDocumentMetadata, createTaskMetadata } from '../../../server/memory/services/helpers/metadata-helpers';
import { createUserId, createAgentId } from '../../../types/structured-id';
import { DocumentSource, TaskPriority, TaskStatus } from '../../../types/metadata';

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
      
      // Get enhanced context from markdown-derived memories
      const memoryContext = await this.getRelevantMemoriesForPlanning(task);
      
      // Build the enhanced prompt with memory context
      const enhancedPrompt = `
# Task to Plan
${task}

${memoryContext}

# Planning Instructions
Please create a concise, actionable plan to accomplish this task.
`;
      
      // Generate a plan using the planning system
      const planResult = await planTask(enhancedPrompt, {
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
      
      // Store task in memory
      await this.memory.addMemory(
        JSON.stringify({
          type: 'task',
          goalPrompt: task,
          planDescription: formattedPlan.description,
          steps: formattedPlan.steps.map(step => step.description)
        }),
        MemoryType.TASK,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        JSON.stringify({ taskId: new Date().getTime().toString() }),
        ['task', 'plan'],
        createTaskMetadata(
          `Task plan: ${task.substring(0, 50)}...`,
          TaskStatus.PENDING,
          TaskPriority.HIGH,
          createAgentId(this.agentId),
          {
            description: formattedPlan.description,
            importance: ImportanceLevel.HIGH,
            tags: ['task', 'plan'],
          }
        )
      );
      
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
      
      // Store task execution result in memory
      await this.memory.addMemory(
        `Task execution ${result.success ? 'succeeded' : 'failed'}: ${plan.description.substring(0, 150)}...\n${result.message}`,
        MemoryType.TASK,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        JSON.stringify({ taskId: new Date().getTime().toString() }),
        ['task', 'execution', result.success ? 'success' : 'failure'],
        createTaskMetadata(
          `Task execution: ${plan.description.substring(0, 50)}...`,
          result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          TaskPriority.HIGH,
          createAgentId(this.agentId),
          {
            description: `Execution of: ${plan.description}`,
            importance: ImportanceLevel.HIGH,
            tags: ['task', 'execution', result.success ? 'success' : 'failure'],
          }
        )
      );
      
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
      // First plan the task using enhanced context
      const plan = await this.planWithEnhancedContext(task);
      
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
      
      // Generate a plan for daily tasks with enhanced context
      const dailyTaskPlan = await this.planWithEnhancedContext(
        "Create a plan for today's key marketing activities. Include content review, trend analysis, and engagement strategies."
      );
      
      if (this.notifyFunction) {
        this.notifyFunction(`Daily tasks plan created with enhanced knowledge context: ${dailyTaskPlan.description}`);
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
        MemoryType.TASK,
        executionResult.success ? ImportanceLevel.MEDIUM : ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        undefined,
        ['daily_tasks', 'execution_result', executionResult.success ? 'success' : 'failure'],
        createTaskMetadata(
          'Daily tasks execution',
          executionResult.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          TaskPriority.MEDIUM,
          createAgentId(this.agentId),
          {
            description: `Execution result: ${executionResult.message.substring(0, 100)}...`,
            importance: executionResult.success ? ImportanceLevel.MEDIUM : ImportanceLevel.HIGH,
            tags: ['daily_tasks', 'execution_result', executionResult.success ? 'success' : 'failure'],
            completedDate: executionResult.success ? new Date().toISOString() : undefined
          }
        )
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
      // First plan the task based on the goal prompt with enhanced context
      const plan = await this.planWithEnhancedContext(options.goalPrompt);
      
      // Then execute the plan
      const result = await this.executePlan(plan);
      
      // Convert ExecutionResult to PlanAndExecuteResult
      const planAndExecuteResult: PlanAndExecuteResult = {
        success: result.success,
        message: result.message,
        plan: {
          goal: options.goalPrompt,
          steps: result.stepResults?.map(step => {
            return {
              id: String(Math.random()).substring(2, 10),
              description: step.step,
              status: step.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
              tool: undefined,
              params: undefined
            } as PlanStep;
          }) || [],
          reasoning: "Plan execution from planning manager with enhanced memory context"
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

  /**
   * Get relevant context for planning
   */
  private async getRelevantMemoriesForPlanning(goal: string): Promise<string> {
    // Get relevant memories from different categories
    const strategicMemories = await this.memory.getRelevantMemories(
      goal, 
      5, 
      [StandardMemoryType.DOCUMENT]
    );

    const domainMemories = await this.memory.getRelevantMemories(
      goal, 
      5, 
      [StandardMemoryType.DOCUMENT]
    );

    const personalMemories = await this.memory.getRelevantMemories(
      goal, 
      3, 
      [StandardMemoryType.DOCUMENT]
    );

    const relevantThoughts = await this.memory.getRelevantMemories(
      goal, 
      3, 
      [StandardMemoryType.THOUGHT]
    );

    // Format memories for inclusion in the planning context
    let context = '## Available Knowledge\n\n';
    
    if (strategicMemories.length > 0) {
      context += '### Strategic Knowledge\n';
      strategicMemories.forEach(memory => {
        context += `- **${memory.category || 'Strategy'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (domainMemories.length > 0) {
      context += '### Domain Knowledge\n';
      domainMemories.forEach(memory => {
        context += `- **${memory.category || 'Knowledge'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (personalMemories.length > 0) {
      context += '### Persona Information\n';
      personalMemories.forEach(memory => {
        context += `- **${memory.category || 'Persona'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (relevantThoughts.length > 0) {
      context += '### Previous Relevant Thoughts\n';
      relevantThoughts.forEach(memory => {
        context += `- ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    return context;
  }

  /**
   * Extract relevant content from memory for planning
   */
  private extractContentForPlanning(content: string): string {
    // If content is formatted like "TYPE [timestamp]: actual content"
    // Extract only the actual content part
    const match = content.match(/^(?:.*?\[.*?\]:)?\s*(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return content;
  }

  /**
   * Parse a plan string into a structured PlanWithSteps object
   * This method handles the plan format returned by the LLM
   */
  private parsePlan(planString: string): PlanWithSteps {
    try {
      // Extract plan name and steps
      const lines = planString.split('\n').filter(line => line.trim() !== '');
      
      // First non-empty line is the plan name
      const planName = lines[0].replace(/^(#|\d+\.|\*)\s*/, '').trim();
      
      // Remaining lines are steps - look for numbered lines or bullet points
      const stepRegex = /^(\d+\.|\*|\-)\s*(.+)$/;
      const steps = [];
      
      for (let i = 1; i < lines.length; i++) {
        const match = lines[i].match(stepRegex);
        if (match) {
          const stepText = match[2].trim();
          steps.push({
            action: stepText,
            description: stepText
          });
        }
      }
      
      return {
        description: planName,
        steps: steps.length > 0 ? steps : [{ action: 'Review plan', description: 'Plan needs review' }]
      };
    } catch (error) {
      this.logAction('Error parsing plan', { error: String(error) });
      // Return a fallback plan
      return {
        description: 'Error parsing plan',
        steps: [{ action: 'Review plan', description: 'Plan could not be parsed' }]
      };
    }
  }

  /**
   * Get relevant context for planning with enhanced memory retrieval by type
   */
  private async getEnhancedMemoriesForPlanning(goal: string): Promise<string> {
    // Get relevant memories with enhanced metadata
    const strategicInfo = await this.memory.getRelevantMemoriesByType(
      goal,
      [StandardMemoryType.DOCUMENT],
      5
    );

    const domainInfo = await this.memory.getRelevantMemoriesByType(
      goal,
      [StandardMemoryType.DOCUMENT],
      5
    );

    const personalInfo = await this.memory.getRelevantMemoriesByType(
      goal,
      [StandardMemoryType.DOCUMENT],
      3
    );

    const thoughtInfo = await this.memory.getRelevantMemoriesByType(
      goal,
      [StandardMemoryType.THOUGHT],
      3
    );

    // Format memories for inclusion in the planning context with enhanced metadata
    let context = '## Available Knowledge\n\n';
    
    if (strategicInfo.entries.length > 0) {
      context += '### Strategic Knowledge\n';
      if (strategicInfo.sourceFiles.length > 0) {
        context += `Source files: ${strategicInfo.sourceFiles.join(', ')}\n\n`;
      }
      
      strategicInfo.entries.forEach(memory => {
        context += `- **${memory.category || 'Strategy'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (domainInfo.entries.length > 0) {
      context += '### Domain Knowledge\n';
      if (domainInfo.sourceFiles.length > 0) {
        context += `Source files: ${domainInfo.sourceFiles.join(', ')}\n\n`;
      }
      
      domainInfo.entries.forEach(memory => {
        context += `- **${memory.category || 'Knowledge'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (personalInfo.entries.length > 0) {
      context += '### Persona Information\n';
      if (personalInfo.sourceFiles.length > 0) {
        context += `Source files: ${personalInfo.sourceFiles.join(', ')}\n\n`;
      }
      
      personalInfo.entries.forEach(memory => {
        context += `- **${memory.category || 'Persona'}**: ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    if (thoughtInfo.entries.length > 0) {
      context += '### Previous Relevant Thoughts\n';
      thoughtInfo.entries.forEach(memory => {
        context += `- ${this.extractContentForPlanning(memory.content)}\n`;
      });
      context += '\n';
    }
    
    return context;
  }

  /**
   * Generate a plan for a given goal
   */
  async plan(goal: string, options: {
    memory?: ChloeMemory;
    maxSteps?: number;
    includeReasoning?: boolean;
    userId?: string;
    debug?: boolean;
    signal?: AbortSignal;
  } = {}): Promise<PlanWithSteps> {
    this.taskLogger?.logAction('Planning', { goal });
    
    try {
      // Get relevant memory context
      const memoryContext = await this.getRelevantMemoriesForPlanning(goal);
      
      // Build the prompt with memory context
      const prompt = `
# Goal
${goal}

${memoryContext}

# Planning Instructions
1. Break down the goal into clear, logical steps
2. For each step, identify required inputs and expected outputs
3. Consider dependencies between steps
4. Include information gathering steps when necessary
5. Provide clear success criteria for each step
6. Keep the plan concise but comprehensive

# Format Requirements
1. Provide a high-level plan name (1 line)
2. Include 3-7 steps (practical number for execution)
3. Each step should be actionable and verifiable

Your task is to create an optimal plan to achieve the above goal. The plan will be executed step by step.
`;
      
      // Log the prompt if requested
      if (options.debug) {
        console.log('Planning prompt:', prompt);
      }
      
      // Call the LLM to generate the plan
      const planResult = await planTask(prompt, {
        memory: this.memory,
        maxSteps: options.maxSteps || 10,
        includeReasoning: options.includeReasoning || true
      });
      
      // Parse the generated plan into steps
      if (!planResult || !planResult.plan) {
        throw new Error('Plan generation failed: No plan returned');
      }
      
      // Parse the generated plan into steps
      const parsedPlan = this.parsePlan(planResult.plan.join('\n'));
      
      // Store the plan in memory
      await this.memory.addMemory(
        JSON.stringify(parsedPlan),
        StandardMemoryType.DOCUMENT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        JSON.stringify({ taskId: new Date().getTime().toString() }),
        ['plan', 'task']
      );
      
      // Log the created plan
      this.taskLogger?.logAction('Plan created', { 
        goal,
        planName: parsedPlan.description,
        steps: parsedPlan.steps.length
      });
      
      return parsedPlan;
    } catch (error) {
      this.taskLogger?.logAction('Planning failed', { 
        goal,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Enhanced plan method that uses structured markdown memories
   */
  async planWithEnhancedContext(goal: string, options: {
    memory?: ChloeMemory;
    maxSteps?: number;
    includeReasoning?: boolean;
    userId?: string;
    debug?: boolean;
    signal?: AbortSignal;
  } = {}): Promise<PlanWithSteps> {
    this.taskLogger?.logAction('Planning with enhanced context', { goal });
    
    try {
      // Get enhanced relevant memory context using the new method
      const memoryContext = await this.getEnhancedMemoriesForPlanning(goal);
      
      // Build the prompt with enhanced memory context
      const prompt = `
# Goal
${goal}

${memoryContext}

# Planning Instructions
1. Break down the goal into clear, logical steps
2. For each step, identify required inputs and expected outputs
3. Consider dependencies between steps
4. Include information gathering steps when necessary
5. Provide clear success criteria for each step
6. Keep the plan concise but comprehensive

# Format Requirements
1. Provide a high-level plan name (1 line)
2. Include 3-7 steps (practical number for execution)
3. Each step should be actionable and verifiable

Your task is to create an optimal plan to achieve the above goal. The plan will be executed step by step.
`;
      
      // Log the prompt if requested
      if (options.debug) {
        console.log('Planning prompt with enhanced context:', prompt);
      }
      
      // Call the LLM to generate the plan
      const planResult = await planTask(prompt, {
        memory: this.memory,
        maxSteps: options.maxSteps || 10,
        includeReasoning: options.includeReasoning || true
      });
      
      // Parse the generated plan into steps
      if (!planResult || !planResult.plan) {
        throw new Error('Plan generation failed: No plan returned');
      }
      
      // Parse the generated plan into steps
      const parsedPlan = this.parsePlan(planResult.plan.join('\n'));
      
      // Store the plan in memory
      await this.memory.addMemory(
        JSON.stringify(parsedPlan),
        StandardMemoryType.DOCUMENT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        JSON.stringify({ taskId: new Date().getTime().toString() }),
        ['plan', 'task']
      );
      
      // Log the created plan
      this.taskLogger?.logAction('Enhanced plan created', { 
        goal,
        planName: parsedPlan.description,
        steps: parsedPlan.steps.length
      });
      
      return parsedPlan;
    } catch (error) {
      this.taskLogger?.logAction('Enhanced planning failed', { 
        goal,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gets the scheduler instance if available
   */
  getScheduler(): ChloeScheduler | null {
    const mockAgent = {
      initialize: async () => {},
      getModel: () => null,
      getMemory: () => null,
      getTaskLogger: () => null,
      notify: (message: string) => {},
      planAndExecute: async (goal: string, options: any) => ({ success: true }),
      runDailyTasks: async () => {},
      runWeeklyReflection: async () => "Weekly reflection",
      getReflectionManager: () => null,
      getPlanningManager: () => null,
      getKnowledgeGapsManager: () => null,
      getToolManager: () => null,
      getScheduler: () => null
    } as unknown as ChloeAgent;
    
    const scheduler = new ChloeScheduler(mockAgent);
    return scheduler;
  }
} 