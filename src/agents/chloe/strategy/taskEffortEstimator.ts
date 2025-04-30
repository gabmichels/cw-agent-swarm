/**
 * Task Effort Estimator for Chloe
 * 
 * Provides functionality to estimate effort, urgency, and deadlines
 * for tasks based on their nature, goals, and strategic importance.
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { PlanningTask, SubGoal } from '../graph/nodes/types';
import { ChloeMemory } from '../memory';
import { formatPriorityLevel } from './strategicPlanner';

/**
 * Interface for effort and time estimation metadata
 */
export interface EffortMetadata {
  estimatedEffort: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  suggestedDeadline?: string; // Optional ISO date
  estimatedHours?: number; // Optional estimated hours to complete
  confidenceScore?: number; // 0-1 confidence in the estimation
  reasoningForEstimate?: string; // Explanation for the estimates
}

/**
 * Options for effort estimation
 */
export interface EffortEstimationOptions {
  model?: ChatOpenAI;
  memory?: ChloeMemory;
  useHeuristics?: boolean; // If true, use simple rules before falling back to LLM
  considerWorkload?: boolean; // If true, factor in current workload when estimating
}

/**
 * Task type to effort mapping for heuristic approach
 */
const TASK_TYPE_EFFORT_MAP: Record<string, { effort: 'low' | 'medium' | 'high', hours: number }> = {
  'social_post': { effort: 'low', hours: 1 },
  'email_newsletter': { effort: 'medium', hours: 3 },
  'blog_post': { effort: 'medium', hours: 4 },
  'market_research': { effort: 'high', hours: 8 },
  'campaign_design': { effort: 'high', hours: 12 },
  'content_strategy': { effort: 'high', hours: 10 },
  'analytics_report': { effort: 'medium', hours: 5 },
  'competitor_analysis': { effort: 'high', hours: 8 },
  'audience_research': { effort: 'medium', hours: 6 },
  'outreach': { effort: 'medium', hours: 4 },
  'presentation': { effort: 'medium', hours: 5 },
  'meeting': { effort: 'low', hours: 1 },
  'planning': { effort: 'medium', hours: 3 },
};

/**
 * Keywords that indicate higher effort requirements
 */
const HIGH_EFFORT_KEYWORDS = [
  'comprehensive', 'detailed', 'in-depth', 'complex', 'extensive',
  'thorough', 'elaborate', 'multifaceted', 'strategic', 'research'
];

/**
 * Keywords that indicate higher urgency
 */
const HIGH_URGENCY_KEYWORDS = [
  'urgent', 'critical', 'immediate', 'asap', 'deadline', 'timely',
  'pressing', 'priority', 'emergency', 'today', 'now', 'crucial'
];

/**
 * Estimates the effort, urgency, and deadline for a task
 * 
 * @param task The task to estimate effort for
 * @param options Options for estimation
 * @returns EffortMetadata object with estimations
 */
export async function estimateEffortAndUrgency(
  task: PlanningTask,
  options: EffortEstimationOptions = {}
): Promise<EffortMetadata> {
  // If using heuristics and we can determine effort that way, do so
  if (options.useHeuristics !== false) {
    const heuristicResult = applyHeuristics(task);
    if (heuristicResult) {
      return heuristicResult;
    }
  }
  
  // Otherwise use LLM-based estimation
  return llmBasedEstimation(task, options);
}

/**
 * Apply simple heuristics to estimate effort and urgency
 * 
 * @param task The task to estimate
 * @returns EffortMetadata if heuristics could be applied, otherwise null
 */
function applyHeuristics(task: PlanningTask): EffortMetadata | null {
  const goal = task.goal.toLowerCase();
  const subGoalCount = task.subGoals?.length || 0;
  const hasNestedSubGoals = task.subGoals?.some(sg => sg.children && sg.children.length > 0) || false;
  
  // Get task type if available
  const taskType = (task as any).type?.toLowerCase();
  
  // Check if we have a predefined effort for this task type
  if (taskType && TASK_TYPE_EFFORT_MAP[taskType]) {
    const baseEffort = TASK_TYPE_EFFORT_MAP[taskType];
    
    // Calculate deadline based on effort and urgency
    let deadline: string | undefined = undefined;
    const today = new Date();
    
    // Determine urgency based on priority score or keywords
    let urgency: 'low' | 'medium' | 'high' = 'medium';
    
    // If task has strategic priority, use it to influence urgency
    if ((task as any).metadata?.priorityScore) {
      const priorityScore = (task as any).metadata.priorityScore;
      if (priorityScore >= 80) urgency = 'high';
      else if (priorityScore <= 40) urgency = 'low';
    } else {
      // Otherwise check for urgency keywords
      if (HIGH_URGENCY_KEYWORDS.some(keyword => goal.includes(keyword))) {
        urgency = 'high';
      }
    }
    
    // Calculate deadline based on urgency and estimated hours
    if (urgency === 'high') {
      const deadlineDate = new Date(today);
      deadlineDate.setDate(today.getDate() + 1); // Next day for high urgency
      deadline = deadlineDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    } else if (urgency === 'medium') {
      const deadlineDate = new Date(today);
      deadlineDate.setDate(today.getDate() + 3); // 3 days for medium urgency
      deadline = deadlineDate.toISOString().split('T')[0];
    } else {
      const deadlineDate = new Date(today);
      deadlineDate.setDate(today.getDate() + 7); // 7 days for low urgency
      deadline = deadlineDate.toISOString().split('T')[0];
    }
    
    // Adjust effort based on sub-goal complexity
    let adjustedEffort = baseEffort.effort;
    let estimatedHours = baseEffort.hours;
    
    if (subGoalCount > 5 || hasNestedSubGoals) {
      // Increase effort level if task has many sub-goals or nested complexity
      if (adjustedEffort === 'low') adjustedEffort = 'medium';
      else if (adjustedEffort === 'medium') adjustedEffort = 'high';
      
      // Adjust hours estimate based on complexity
      estimatedHours = estimatedHours * (1 + (subGoalCount * 0.2));
    }
    
    return {
      estimatedEffort: adjustedEffort,
      urgency,
      suggestedDeadline: deadline,
      estimatedHours: Math.round(estimatedHours),
      confidenceScore: 0.8,
      reasoningForEstimate: `Based on task type "${taskType}" and complexity (${subGoalCount} sub-goals${hasNestedSubGoals ? ', with nested tasks' : ''})`
    };
  }
  
  // Check keyword-based heuristics if we don't have a predefined type
  let effortScore = 0;
  let urgencyScore = 0;
  
  // Count effort keywords
  HIGH_EFFORT_KEYWORDS.forEach(keyword => {
    if (goal.includes(keyword)) effortScore++;
  });
  
  // Count urgency keywords
  HIGH_URGENCY_KEYWORDS.forEach(keyword => {
    if (goal.includes(keyword)) urgencyScore++;
  });
  
  // Adjust by sub-goal count
  if (subGoalCount > 5) effortScore += 2;
  else if (subGoalCount > 3) effortScore += 1;
  
  if (hasNestedSubGoals) effortScore += 1;
  
  // Don't return a result if we don't have strong signals
  // Let the LLM handle the more nuanced cases
  if (effortScore < 1 && urgencyScore < 1 && subGoalCount < 3) {
    return null;
  }
  
  // Map scores to levels
  const effort: 'low' | 'medium' | 'high' = 
    effortScore >= 3 ? 'high' : 
    effortScore >= 1 ? 'medium' : 'low';
    
  const urgency: 'low' | 'medium' | 'high' = 
    urgencyScore >= 2 ? 'high' : 
    urgencyScore >= 1 ? 'medium' : 'low';
  
  // Calculate a deadline based on effort and urgency
  let deadline: string | undefined = undefined;
  const today = new Date();
  
  if (urgency === 'high') {
    const daysToAdd = effort === 'high' ? 2 : (effort === 'medium' ? 1 : 1);
    const deadlineDate = new Date(today);
    deadlineDate.setDate(today.getDate() + daysToAdd);
    deadline = deadlineDate.toISOString().split('T')[0];
  } else if (urgency === 'medium') {
    const daysToAdd = effort === 'high' ? 7 : (effort === 'medium' ? 5 : 3);
    const deadlineDate = new Date(today);
    deadlineDate.setDate(today.getDate() + daysToAdd);
    deadline = deadlineDate.toISOString().split('T')[0];
  } else {
    const daysToAdd = effort === 'high' ? 14 : (effort === 'medium' ? 10 : 7);
    const deadlineDate = new Date(today);
    deadlineDate.setDate(today.getDate() + daysToAdd);
    deadline = deadlineDate.toISOString().split('T')[0];
  }
  
  // Calculate estimated hours based on effort
  const estimatedHours = 
    effort === 'high' ? 8 + (subGoalCount * 2) : 
    effort === 'medium' ? 4 + subGoalCount : 
    2;
  
  return {
    estimatedEffort: effort,
    urgency,
    suggestedDeadline: deadline,
    estimatedHours,
    confidenceScore: 0.7,
    reasoningForEstimate: `Keyword analysis found ${effortScore} effort indicators and ${urgencyScore} urgency indicators. Task has ${subGoalCount} sub-goals${hasNestedSubGoals ? ' with nested complexity' : ''}.`
  };
}

/**
 * Use LLM to estimate effort and urgency for a task
 * 
 * @param task The task to estimate
 * @param options Options for estimation
 * @returns EffortMetadata with LLM-based estimations
 */
async function llmBasedEstimation(
  task: PlanningTask,
  options: EffortEstimationOptions
): Promise<EffortMetadata> {
  const model = options.model || new ChatOpenAI({
    temperature: 0.2,
    modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview'
  });
  
  // Format subgoals for inclusion in the prompt
  const formatSubGoals = (subGoals: SubGoal[]): string => {
    return subGoals.map(sg => `- ${sg.description} (Priority: ${sg.priority})`).join('\n');
  };
  
  // Get strategic priority if available
  const priorityScore = (task as any).metadata?.priorityScore || 50;
  const priorityLevel = formatPriorityLevel(priorityScore);
  
  // Get today's date
  const today = new Date();
  const formattedToday = today.toISOString().split('T')[0];
  
  const template = `
You are an expert project planner who helps estimate effort and urgency for marketing tasks.

TASK GOAL: ${task.goal}

SUB-GOALS:
${task.subGoals ? formatSubGoals(task.subGoals) : 'No sub-goals defined.'}

STRATEGIC PRIORITY: ${priorityLevel} (${priorityScore}/100)

TODAY'S DATE: ${formattedToday}

Please analyze this task and estimate:
1. The effort required (low, medium, high)
2. The urgency level (low, medium, high)
3. A reasonable deadline date (YYYY-MM-DD format)
4. Estimated hours to complete the task

Consider the complexity of the sub-goals, the strategic priority, and the nature of the marketing task.

Respond with a JSON object in this exact format:
{
  "estimatedEffort": "low|medium|high",
  "urgency": "low|medium|high",
  "suggestedDeadline": "YYYY-MM-DD",
  "estimatedHours": number,
  "confidenceScore": number,
  "reasoningForEstimate": "brief explanation"
}

JSON response:`;
  
  try {
    // Create a prompt template
    const promptTemplate = ChatPromptTemplate.fromTemplate(template);
    
    // Generate the estimation
    const response = await model.invoke(template);
    
    // Parse the JSON response
    const content = response.content.toString();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not extract JSON from response");
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0]);
    
    // Validate and ensure the response has the required fields
    return {
      estimatedEffort: parsedResponse.estimatedEffort || 'medium',
      urgency: parsedResponse.urgency || 'medium',
      suggestedDeadline: parsedResponse.suggestedDeadline,
      estimatedHours: parsedResponse.estimatedHours,
      confidenceScore: parsedResponse.confidenceScore || 0.8,
      reasoningForEstimate: parsedResponse.reasoningForEstimate
    };
  } catch (error) {
    console.error("Error in LLM-based effort estimation:", error);
    
    // Fallback to a simple estimation based on sub-goal count
    const subGoalCount = task.subGoals?.length || 0;
    const hasNestedSubGoals = task.subGoals?.some(sg => sg.children && sg.children.length > 0) || false;
    
    // Calculate a simple deadline
    const deadline = new Date(today);
    deadline.setDate(today.getDate() + (subGoalCount > 3 ? 7 : 3));
    
    return {
      estimatedEffort: subGoalCount > 4 || hasNestedSubGoals ? 'high' : subGoalCount > 2 ? 'medium' : 'low',
      urgency: priorityScore > 75 ? 'high' : priorityScore > 40 ? 'medium' : 'low',
      suggestedDeadline: deadline.toISOString().split('T')[0],
      estimatedHours: subGoalCount * 2,
      confidenceScore: 0.5,
      reasoningForEstimate: "Fallback estimation based on sub-goal count and priority score"
    };
  }
}

/**
 * Calculate total estimated hours for a planning task
 * Useful for workload estimation
 * 
 * @param task The planning task to estimate
 * @returns Total estimated hours
 */
export function calculateTotalHours(task: PlanningTask): number {
  if ((task as any).metadata?.effort?.estimatedHours) {
    return (task as any).metadata.effort.estimatedHours;
  }
  
  // Simple estimation based on sub-goals if we don't have metadata
  const subGoalCount = task.subGoals?.length || 0;
  const hasNestedSubGoals = task.subGoals?.some(sg => sg.children && sg.children.length > 0) || false;
  
  if (hasNestedSubGoals) {
    // Complex task with nested structure
    return subGoalCount * 3;
  } else {
    // Simpler task
    return subGoalCount * 1.5;
  }
} 