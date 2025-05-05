/**
 * Correction handling module for Chloe
 * 
 * This module provides functionality to process and learn from human corrections
 * to Chloe's plans, execution steps, or output.
 */

import { PlannedTask } from './index';
import { ChloeMemory, MemoryEntry } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Interface for a human correction to Chloe's work
 */
export interface Correction {
  taskId: string;
  originalPlan: string;
  correctionText: string;
  correctedBy: string;
  timestamp: number;
  category?: 'misunderstanding' | 'tool_misuse' | 'missed_context' | 'wrong_approach' | 'other';
}

/**
 * Processes a correction and updates relevant systems
 * 
 * @param task The task being corrected
 * @param correction The correction details
 * @param memory Chloe's memory system to store the correction
 * @returns The updated task with correction notes
 */
export async function handleCorrection(
  task: PlannedTask, 
  correction: Correction,
  memory: ChloeMemory
): Promise<PlannedTask> {
  // 1. Store correction in memory with high importance
  await memory.addMemory(
    `Task correction: ${correction.correctionText}`,
    MemoryType.CORRECTION,
    ImportanceLevel.HIGH,
    correction.correctedBy === 'human' ? MemorySource.USER : MemorySource.SYSTEM,
    task.goal,
    ['correction', 'task', task.goal, ...getTagsFromCorrection(correction)]
  );
  
  // 2. Add a more detailed entry with the full correction context
  await memory.addMemory(
    `Original plan: ${correction.originalPlan}\nCorrection: ${correction.correctionText}`,
    MemoryType.CORRECTION_DETAIL,
    ImportanceLevel.MEDIUM,
    correction.correctedBy === 'human' ? MemorySource.USER : MemorySource.SYSTEM,
    task.goal,
    ['correction_detail', 'learning', 'adaptation', task.goal]
  );

  // 3. Generate insight from correction (automatic categorization)
  const insight = generateInsightFromCorrection(correction);
  if (insight) {
    await memory.addMemory(
      insight,
      MemoryType.INSIGHT,
      ImportanceLevel.HIGH,
      MemorySource.AGENT,
      task.goal,
      ['insight', 'learning', 'correction', task.goal]
    );
  }

  // 4. Update the task with correction info
  const updatedTask = {
    ...task,
    wasCorrected: true,
    correctionNotes: [
      ...(task.correctionNotes || []),
      correction.correctionText
    ],
    correctionCategory: correction.category || detectCorrectionCategory(correction),
    correctionTimestamp: correction.timestamp
  };
  
  return updatedTask;
}

/**
 * Generates insightful patterns from a correction
 */
function generateInsightFromCorrection(correction: Correction): string | null {
  const category = correction.category || detectCorrectionCategory(correction);
  
  switch (category) {
    case 'tool_misuse':
      return `Insight: Tool selection or usage needed correction. Should reconsider when and how specific tools are applied.`;
    case 'misunderstanding':
      return `Insight: Task requirements were misunderstood. Should improve clarification process for similar tasks.`;
    case 'missed_context':
      return `Insight: Important context was missed. Should improve memory retrieval for similar situations.`;
    case 'wrong_approach':
      return `Insight: Approach to solving the problem was suboptimal. Should consider alternative strategies for similar tasks.`;
    default:
      return null;
  }
}

/**
 * Attempts to automatically categorize a correction based on text content
 */
function detectCorrectionCategory(correction: Correction): 'misunderstanding' | 'tool_misuse' | 'missed_context' | 'wrong_approach' | 'other' {
  const text = correction.correctionText.toLowerCase();
  
  if (text.includes('tool') || text.includes('function') || text.includes('api') || text.includes('method')) {
    return 'tool_misuse';
  }
  
  if (text.includes('understand') || text.includes('misunderstood') || text.includes('wrong idea') || text.includes('not what I meant')) {
    return 'misunderstanding';
  }
  
  if (text.includes('context') || text.includes('background') || text.includes('history') || text.includes('forgot')) {
    return 'missed_context';
  }
  
  if (text.includes('approach') || text.includes('strategy') || text.includes('method') || text.includes('should have')) {
    return 'wrong_approach';
  }
  
  return 'other';
}

/**
 * Extracts meaningful tags from a correction
 */
function getTagsFromCorrection(correction: Correction): string[] {
  const tags: string[] = [];
  const category = correction.category || detectCorrectionCategory(correction);
  tags.push(category);
  
  // Add more specific tags based on correction text
  const text = correction.correctionText.toLowerCase();
  
  if (text.includes('plan')) tags.push('planning');
  if (text.includes('execute')) tags.push('execution');
  if (text.includes('clarify')) tags.push('clarification');
  if (text.includes('expert')) tags.push('expertise');
  
  return tags;
}

/**
 * Checks if a new task plan should be adjusted based on past corrections
 * 
 * @param task The current task plan
 * @param memory Chloe's memory system
 * @returns Suggested adjustments based on past corrections
 */
export async function checkPastCorrections(
  task: PlannedTask,
  memory: ChloeMemory
): Promise<{
  hasSimilarCorrections: boolean;
  suggestedAdjustments: string[];
  relevantCorrections: string[];
}> {
  // Retrieve relevant past corrections
  const relevantMemories = await getMemoriesByType(memory, MemoryType.CORRECTION, 5);
  const relevantCorrections = relevantMemories
    .filter((mem: MemoryEntry) => isRelevantToCurrentTask(mem.content, task.goal))
    .map((mem: MemoryEntry) => mem.content);
  
  // If no relevant corrections, return empty result
  if (relevantCorrections.length === 0) {
    return {
      hasSimilarCorrections: false,
      suggestedAdjustments: [],
      relevantCorrections: []
    };
  }
  
  // Analyze patterns and generate suggestions
  const suggestedAdjustments = analyzeCorrectionsForPatterns(relevantCorrections);
  
  return {
    hasSimilarCorrections: true,
    suggestedAdjustments,
    relevantCorrections
  };
}

/**
 * Helper function to get memories by type, since it's not directly available in ChloeMemory
 */
async function getMemoriesByType(memory: ChloeMemory, type: MemoryType, limit: number): Promise<MemoryEntry[]> {
  try {
    // Use getRelevantMemories with a type-specific query as a workaround
    const memories = await memory.getRelevantMemories(`type:${type}`, limit);
    return memories.filter((mem: MemoryEntry) => mem.category === type);
  } catch (error) {
    console.error(`Error retrieving memories of type ${type}:`, error);
    return [];
  }
}

/**
 * Determines if a past correction is relevant to current task
 */
function isRelevantToCurrentTask(correction: string, currentGoal: string): boolean {
  // Basic implementation - check for keyword overlap
  const correctionWords = new Set(correction.toLowerCase().split(/\s+/));
  const goalWords = new Set(currentGoal.toLowerCase().split(/\s+/));
  
  // Count overlapping significant words
  let overlap = 0;
  // Convert Set to Array before iteration to avoid TS error
  Array.from(goalWords).forEach(word => {
    if (word.length > 3 && correctionWords.has(word)) { // Only count significant words
      overlap++;
    }
  });
  
  return overlap >= 2; // At least two significant overlapping words
}

/**
 * Analyzes corrections for patterns and generates suggestions
 */
function analyzeCorrectionsForPatterns(corrections: string[]): string[] {
  const suggestions: string[] = [];
  
  // Look for tool-related patterns
  const toolPattern = /tool|function|api|method/i;
  const toolCorrections = corrections.filter(c => toolPattern.test(c));
  if (toolCorrections.length >= 2) {
    suggestions.push("Consider careful tool selection - past similar tasks had tool usage corrections");
  }
  
  // Look for understanding-related patterns
  const understandingPattern = /understand|misunderstood|clarify|unclear/i;
  const understandingCorrections = corrections.filter(c => understandingPattern.test(c));
  if (understandingCorrections.length >= 2) {
    suggestions.push("Ensure task requirements are fully understood - past similar tasks had clarification issues");
  }
  
  // Look for approach-related patterns
  const approachPattern = /approach|strategy|method|should have/i;
  const approachCorrections = corrections.filter(c => approachPattern.test(c));
  if (approachCorrections.length >= 2) {
    suggestions.push("Consider alternative approaches - past similar tasks had strategy corrections");
  }
  
  if (suggestions.length === 0 && corrections.length > 0) {
    suggestions.push("Past similar tasks received corrections - proceed with extra caution");
  }
  
  return suggestions;
}

/**
 * Updates a task plan based on a specific correction
 * 
 * @param task The current task
 * @param correction The correction to apply
 * @returns The updated task with the correction applied
 */
export function applyCorrection(
  task: PlannedTask,
  correction: Correction
): PlannedTask {
  // Create corrected version of the task
  return {
    ...task,
    wasCorrected: true,
    correctionNotes: [
      ...(task.correctionNotes || []),
      correction.correctionText
    ],
    // Apply the correction to the task plan or specific sub-goals
    // This is a simplified implementation - in real system would parse correction more carefully
    subGoals: task.subGoals.map(sg => ({
      ...sg,
      status: 'pending', // Reset status to allow re-execution
      result: undefined   // Clear any previous results
    }))
  };
}

export const CorrectionHandler = {
  handleCorrection,
  checkPastCorrections,
  applyCorrection
}; 