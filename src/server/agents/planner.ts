import { MemoryManager } from '../../agents/shared/base/managers/MemoryManager.interface';
import { getLLM } from '../../lib/core/llm';
import { AgentPlannerOptions } from '../../lib/shared/types/agentTypes';
import { MemoryType } from '../../server/memory/config/types';
import { getMemoryServices } from '../memory/services';
import { MemoryEntry } from '../../agents/shared/base/managers/MemoryManager.interface';
import { SearchResult } from '../memory/services/search/types';
import { BaseMemorySchema } from '../memory/models/base-schema';

export interface PlanResult {
  plan: string[];
  reasoning: string;
  estimatedSteps: number;
}

/**
 * Generate a plan for a given task using the LLM
 * @param task The task description to plan for
 * @param options Optional parameters for planning
 * @returns A plan result with steps, reasoning and estimated step count
 */
export async function planTask(
  task: string,
  options: {
    memory?: MemoryManager;
    maxSteps?: number;
    includeReasoning?: boolean;
  } = {}
): Promise<PlanResult> {
  const maxSteps = options.maxSteps || 5;
  const includeReasoning = options.includeReasoning !== false;
  
  console.log(`Planning task: ${task}`);
  
  try {
    // Get memory services
    const { searchService } = await getMemoryServices();
    
    // Search for relevant memories
    const memories: SearchResult<BaseMemorySchema>[] = await searchService.search(task, {
      types: [MemoryType.TASK, MemoryType.THOUGHT],
      limit: 3
    });
    
    // Format memories for context
    const memoryContext = memories.length > 0
      ? '\n\nRelevant memories:\n' + memories
          .map(memory => `RELEVANT MEMORY: ${memory.point.payload.text}`)
          .join('\n')
      : '';
    
    // Get relevant memories if memory system is provided
    let relevantContext = '';
    if (options.memory) {
      const relevantMemories = await options.memory.searchMemories(task, { limit: 3 });
      if (relevantMemories && relevantMemories.length > 0) {
        relevantContext = `\nRelevant context from memory:\n${relevantMemories.map(memory => memory.content).join('\n')}`;
      }
    }
    
    // Create planning prompt as a simple string
    const systemPrompt = `You are an expert task planner. Given a task description, break it down into clear, sequential steps.
      
Rules:
1. Generate no more than ${maxSteps} steps
2. Each step should be specific and actionable
3. Start each step with a verb
4. Consider dependencies between steps
5. Focus on high-level steps, not minor details${includeReasoning ? '\n6. Include your reasoning for this plan structure' : ''}

Output format:
\`\`\`
PLAN:
1. [First step]
2. [Second step]
...

${includeReasoning ? 'REASONING:\n[Your reasoning for this plan structure]' : ''}
\`\`\`

TASK: ${task}${memoryContext}${relevantContext}`;

    // Get the LLM
    const llm = getLLM({
      temperature: 0.2, // Lower temperature for planning
      modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14'
    });
    
    // Generate the plan using direct LLM call
    const response = await llm.invoke(systemPrompt);
    const planText = response.content.toString();
    
    // Parse the response
    const planSection = planText.match(/PLAN:([\s\S]*?)(?:REASONING:|$)/i)?.[1]?.trim() || '';
    const reasoningSection = planText.match(/REASONING:([\s\S]*?)$/i)?.[1]?.trim() || '';
    
    // Extract the plan steps
    const steps = planSection
      .split('\n')
      .map((step: string) => step.trim())
      .filter((step: string) => /^\d+\./.test(step))
      .map((step: string) => step.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    
    return {
      plan: steps,
      reasoning: reasoningSection,
      estimatedSteps: steps.length
    };
  } catch (error) {
    console.error('Error generating plan:', error);
    return {
      plan: [`Error: Failed to generate plan for task "${task}"`],
      reasoning: 'An error occurred during plan generation',
      estimatedSteps: 1
    };
  }
} 