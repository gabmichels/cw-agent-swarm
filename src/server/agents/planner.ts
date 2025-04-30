import { ChloeMemory } from '../../agents/chloe/memory';
import { getLLM } from '../../lib/core/llm';

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
    memory?: ChloeMemory;
    maxSteps?: number;
    includeReasoning?: boolean;
  } = {}
): Promise<PlanResult> {
  const maxSteps = options.maxSteps || 5;
  const includeReasoning = options.includeReasoning !== false;
  
  console.log(`Planning task: ${task}`);
  
  try {
    // Get relevant memories if memory system is provided
    let relevantContext = '';
    if (options.memory) {
      const memories = await options.memory.getRelevantMemories(task, 3);
      if (memories && memories.length > 0) {
        relevantContext = `\nRelevant context from memory:\n${memories.join('\n')}`;
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

TASK: ${task}${relevantContext}`;

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