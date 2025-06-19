import { MemoryManager } from '../../agents/shared/base/managers/MemoryManager.interface';
import { getLLM } from '../../lib/core/llm';
import { AgentExecutorOptions } from '../../lib/shared/types/agentTypes';
import { ImportanceLevel } from '@/server/memory/config/types';
import { MemoryType } from '../../server/memory/config/types';
import { getMemoryServices } from '../memory/services';
import { MemoryEntry } from '../../agents/shared/base/managers/MemoryManager.interface';
import { SearchResult } from '../memory/services/search/types';
import { BaseMemorySchema } from '../memory/models/base-schema';

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

/**
 * Execute a plan with the given steps
 * @param plan Array of plan steps to execute
 * @param context Context information for plan execution
 * @param options Additional options for execution
 * @returns Execution result with outputs for each step
 */
export async function executePlan(
  plan: string[],
  context: string,
  options: {
    memory?: MemoryManager;
    stopOnFailure?: boolean;
  } = {}
): Promise<ExecutionResult> {
  const stopOnFailure = options.stopOnFailure !== false;
  console.log(`Executing plan with ${plan.length} steps`);
  
  // Initialize result object
  const result: ExecutionResult = {
    success: false,
    output: '',
    stepResults: []
  };
  
  try {
    // Get relevant high importance memories
    let memories: MemoryEntry[] = [];
    if (options.memory) {
      memories = await options.memory.getRecentMemories(3);
    }
    
    // Format memories for context
    const memoryContext = memories.length > 0 
      ? '\n\nImportant context from memory:\n' + memories
          .map(memory => `IMPORTANT MEMORY: ${memory.content}`)
          .join('\n')
      : '';
    
    // Execute each step in sequence
    let allStepsSuccessful = true;
    let executionContext = context;
    
    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      console.log(`Executing step ${i + 1}: ${step}`);
      
      // Create execution prompt for this step
      const promptTemplate = `You are an AI assistant executing a specific step in a plan. Focus only on the current step.

CONTEXT:
${executionContext}

${memoryContext ? `RELEVANT MEMORIES:\n${memoryContext}\n\n` : ''}

PLAN:
${plan.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

CURRENT STEP (${i + 1}): ${step}

Execute this step and provide the output. Be thorough but concise.
If you need more information to complete the step, state what information is missing.
If the step cannot be completed, explain why.

Your response should follow this format:
\`\`\`
EXECUTION: [Your execution of the current step]
RESULT: [The outcome or output of executing this step]
SUCCESS: [YES or NO]
\`\`\``;
      
      // Execute the step
      const llm = getLLM({
        temperature: 0.3,
        modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14'
      });
      
      // Use direct LLM call instead of a prompt template chain
      const response = await llm.invoke(promptTemplate);
      const executionText = response.content.toString();
      
      // Parse the response
      const executionSection = executionText.match(/EXECUTION:([\s\S]*?)(?:RESULT:|$)/i)?.[1]?.trim() || '';
      const resultSection = executionText.match(/RESULT:([\s\S]*?)(?:SUCCESS:|$)/i)?.[1]?.trim() || '';
      const successSection = executionText.match(/SUCCESS:([\s\S]*?)$/i)?.[1]?.trim() || '';
      
      const stepSuccess = successSection.toLowerCase().includes('yes');
      
      // Store the result for this step
      const stepResult = {
        step,
        success: stepSuccess,
        output: `${executionSection}\n\n${resultSection}`
      };
      
      result.stepResults.push(stepResult);
      
      // Update execution context with this step's result
      executionContext += `\n\nStep ${i + 1} (${step}) result: ${resultSection}`;
      
      // If a step fails and we're configured to stop on failure, halt execution
      if (!stepSuccess && stopOnFailure) {
        console.log(`Step ${i + 1} failed, stopping execution`);
        allStepsSuccessful = false;
        break;
      }
    }
    
    // Determine overall success and compile output
    result.success = allStepsSuccessful;
    result.output = result.stepResults
      .map((stepResult, idx) => `Step ${idx + 1}: ${stepResult.output}`)
      .join('\n\n');
    
    return result;
  } catch (error) {
    console.error('Error executing plan:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error during plan execution';
    return result;
  }
}

export async function executeTask(task: string, options: AgentExecutorOptions): Promise<string> {
  try {
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    // Search for high importance memories
    const memories: SearchResult<BaseMemorySchema>[] = await searchService.search('', {
      types: [MemoryType.TASK, MemoryType.THOUGHT],
      filter: {
        must: [
          {
            key: 'importance',
            match: {
              value: ImportanceLevel.HIGH
            }
          }
        ]
      },
      limit: 3
    });
    
    // Format memories for context
    const memoryContext = memories.length > 0
      ? '\n\nRelevant memories:\n' + memories
          .map(memory => `RELEVANT MEMORY: ${memory.point.payload.text}`)
          .join('\n')
      : '';

    // Execute task with memory context
    return `Executed task: ${task}\nContext:\n${memoryContext}`;
  } catch (error) {
    console.error('Error executing task:', error);
    throw error;
  }
} 