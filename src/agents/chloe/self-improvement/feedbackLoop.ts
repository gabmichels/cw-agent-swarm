import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { getBehavioralModifiersFromFeedback, getTopBehavioralPatterns } from './feedbackIngestor';
import { MemoryType } from '../../../server/memory/config/types';

export interface FeedbackLoopData {
  modifiers: string[];
  taskId: string;
  taskGoal: string;
  feedbackInsightIds: string[];
}

/**
 * Interface representing a behavioral adjustment applied to a task
 */
export interface BehaviorAdjustment {
  taskId: string;
  appliedModifiers: string[];
  originInsightIds: string[];
  timestamp: Date;
}

/**
 * Retrieves behavioral modifiers for a specific task
 * 
 * @param task The planning task to get modifiers for
 * @returns Promise<string[]> Array of behavioral modifiers
 */
export async function getTaskBehavioralModifiers(
  task: { goal: string; id?: string; type?: string }
): Promise<string[]> {
  // Get modifiers from feedback
  const modifiers = await getBehavioralModifiersFromFeedback(task);
  
  // If no modifiers found from specific feedback, 
  // provide some general ones based on top patterns
  if (modifiers.length === 0) {
    const memory = new ChloeMemory();
    const patterns = await getTopBehavioralPatterns(memory);
    
    // Convert top patterns to modifiers
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      
      // Map categories to modifiers
      switch (topPattern.category) {
        case "tool_misuse":
          return ["Verify tool parameters carefully before execution", 
                  "Double-check tool selection before executing"];
          
        case "missed_context":
          return ["Review all available context before planning", 
                  "Consider historical patterns for similar tasks"];
          
        case "wrong_approach":
          return ["Break down tasks into smaller steps",
                  "Consider multiple approaches before committing to a plan"];
          
        case "misunderstanding":
          return ["Add clarification steps for complex requirements",
                  "Define key terms explicitly when planning"];
          
        default:
          return ["Be methodical in planning approach", 
                  "Review plan for completeness before execution"];
      }
    }
  }
  
  return modifiers;
}

/**
 * Records which modifiers were applied to a task for traceability
 * 
 * @param taskId The ID of the task
 * @param taskGoal The goal of the task
 * @param appliedModifiers The modifiers that were applied
 * @param feedbackInsightIds Optional IDs of feedback insights that led to the modifiers
 * @returns Promise<void>
 */
export async function recordBehaviorAdjustment(
  taskId: string,
  taskGoal: string,
  appliedModifiers: string[],
  feedbackInsightIds: string[] = []
): Promise<void> {
  if (appliedModifiers.length === 0) {
    return; // Nothing to record
  }
  
  const memory = new ChloeMemory();
  
  // Format memory content
  const content = `BEHAVIOR_ADJUSTMENT
Task: ${taskId}
Goal: ${taskGoal}
Applied Modifiers:
${appliedModifiers.map(m => `- ${m}`).join('\n')}
${feedbackInsightIds.length > 0 ? `\nBased on insights: ${feedbackInsightIds.join(', ')}` : ''}
`;

  // Store in memory with appropriate tags
  await memory.addMemory(
    content,
    MemoryType.BEHAVIOR_ADJUSTMENT,
    ImportanceLevel.MEDIUM,
    MemorySource.SYSTEM,
    `Task planning for ${taskGoal}`,
    ["planning", "self_improvement", "behavior_adjustment"]
  );
}

/**
 * Generates a report of behavioral adjustments and their effectiveness
 * 
 * @param lookbackDays Number of days to look back
 * @returns Promise<string> Report text
 */
export async function generateBehavioralAdjustmentReport(
  lookbackDays: number = 30
): Promise<string> {
  const memory = new ChloeMemory();
  
  // Get all behavioral adjustments
  const adjustments = await memory.getRelevantMemories(
    MemoryType.BEHAVIOR_ADJUSTMENT,
    50
  );
  
  // Filter to recent ones
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  const recentAdjustments = adjustments.filter(m => m.created >= cutoffDate);
  
  if (recentAdjustments.length === 0) {
    return "No behavioral adjustments have been applied in the specified time period.";
  }
  
  // Count modifier occurrences
  const modifierCounts: Record<string, number> = {};
  
  for (const adjustment of recentAdjustments) {
    // Extract modifiers from content
    const lines = adjustment.content.split('\n');
    const modifierLines = lines.filter(line => line.trim().startsWith('-'));
    
    for (const modifierLine of modifierLines) {
      const modifier = modifierLine.trim().substring(2);
      modifierCounts[modifier] = (modifierCounts[modifier] || 0) + 1;
    }
  }
  
  // Sort modifiers by frequency
  const sortedModifiers = Object.entries(modifierCounts)
    .sort(([_, a], [__, b]) => b - a)
    .map(([modifier, count]) => `${modifier} (${count} times)`);
  
  // Generate report
  return `
Behavioral Adjustment Report (Last ${lookbackDays} days)

Total Adjustments: ${recentAdjustments.length}

Most Common Adjustments:
${sortedModifiers.slice(0, 5).map(m => `- ${m}`).join('\n')}

${sortedModifiers.length > 5 ? `\nAnd ${sortedModifiers.length - 5} more...` : ''}
`.trim();
} 