import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { findCommonExecutionPatterns } from './taskOutcomeAnalyzer';

/**
 * Interface for extracted lessons
 */
export interface Lesson {
  id: string;
  content: string;
  category: string;
  tags: string[];
  source: string;
  relatedPatterns: string[];
  successRate: number;
  created: Date;
}

/**
 * Extracts lessons from past task outcomes
 * 
 * @param memory ChloeMemory instance to access stored memories
 * @param lookbackDays Number of days to look back for outcome data
 * @returns Promise<Lesson[]> Array of extracted lessons
 */
export async function extractLessons(
  memory: ChloeMemory,
  lookbackDays: number = 30
): Promise<Lesson[]> {
  // Find common execution patterns first
  const patterns = await findCommonExecutionPatterns(memory);
  
  // Get recent task outcomes from memory
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  const memories = await memory.getRelevantMemories('TASK OUTCOME', 100);
  const recentMemories = memories.filter(mem => mem.created >= cutoffDate);
  
  if (recentMemories.length === 0) {
    return [];
  }
  
  // Initialize lessons array
  const lessons: Lesson[] = [];
  
  // Extract lessons by pattern category
  // Group by pattern first
  const patternGroups: Record<string, string[]> = {};
  
  for (const mem of recentMemories) {
    try {
      // Extract patterns line
      const lines = mem.content.split('\n');
      const statusLine = lines.find(line => line.startsWith('Status:'));
      const status = statusLine?.replace('Status:', '').trim();
      const patternsLine = lines.find(line => line.startsWith('Patterns:'));
      
      if (patternsLine) {
        const patternsStr = patternsLine.replace('Patterns:', '').trim();
        const patterns = patternsStr.split(',').map(p => p.trim()).filter(Boolean);
        
        // Add to the appropriate pattern group
        for (const pattern of patterns) {
          if (!patternGroups[pattern]) {
            patternGroups[pattern] = [];
          }
          
          // Add the full memory content
          patternGroups[pattern].push(mem.content);
        }
      }
    } catch (error) {
      console.warn('Error parsing memory for lessons:', error);
    }
  }
  
  // Generate lessons for each significant pattern
  for (const [pattern, relatedOutcomes] of Object.entries(patternGroups)) {
    if (relatedOutcomes.length < 2) {
      continue; // Skip patterns with too few examples
    }
    
    // Calculate success rate (outcomes where the pattern appeared but task was still successful)
    const successfulOutcomes = relatedOutcomes.filter(outcome => 
      outcome.includes('Status: SUCCESS') || outcome.includes('Status: CORRECTED')
    );
    const successRate = successfulOutcomes.length / relatedOutcomes.length;
    
    // Generate lesson content based on pattern
    const lesson = createLessonForPattern(
      pattern, 
      relatedOutcomes, 
      successRate
    );
    
    if (lesson) {
      lessons.push(lesson);
      
      // Store the lesson in memory
      await storeLesson(lesson, memory);
    }
  }
  
  return lessons;
}

/**
 * Create a specific lesson for a pattern
 */
function createLessonForPattern(
  pattern: string,
  outcomes: string[],
  successRate: number
): Lesson | null {
  // Skip if we don't have useful pattern
  if (pattern === 'None identified' || !pattern) {
    return null;
  }
  
  const lessonId = `lesson_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Extract failure points when available
  const failurePoints = outcomes
    .map(outcome => {
      const match = outcome.match(/Failure Point: (.+?)(\n|$)/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];
  
  // Determine general category
  let category = 'general';
  if (pattern.includes('tool_') || pattern.includes('resource_')) {
    category = 'tool_usage';
  } else if (pattern.includes('misunderstanding') || pattern.includes('context')) {
    category = 'understanding';
  } else if (pattern.includes('requirement') || pattern.includes('clarification')) {
    category = 'planning';
  } else if (pattern.includes('approach') || pattern.includes('execution')) {
    category = 'execution';
  }
  
  // Common tools that caused issues
  const toolsMentioned = outcomes
    .map(outcome => {
      const match = outcome.match(/Tools: (.+?)(\n|$)/);
      return match ? match[1] : '';
    })
    .filter(Boolean);
  
  const commonTools = findCommonElements(toolsMentioned);
  
  // Generate lesson content based on pattern type
  let content = '';
  const now = new Date();
  
  switch (pattern) {
    case 'misunderstanding':
      content = `When handling user requests, take extra time to clarify requirements before execution. Examples where misunderstandings occurred: ${summarizeExamples(failurePoints, 3)}`;
      break;
    case 'tool_misuse':
      content = `Be more careful when using the following tools: ${commonTools.join(', ')}. ${successRate > 0.5 ? 'While these often work, they require precise usage.' : 'These tools have been causing frequent failures.'}`;
      break;
    case 'missed_context':
      content = `Always review the full conversation history to catch important context before executing. Context was missed in these scenarios: ${summarizeExamples(failurePoints, 2)}`;
      break;
    case 'wrong_approach':
      content = `When approaching ${commonTools.length > 0 ? 'tasks using ' + commonTools.join(', ') : 'complex tasks'}, consider multiple solution strategies before committing to one. Previous wrong approaches: ${summarizeExamples(failurePoints, 2)}`;
      break;
    case 'unclear_requirements':
      content = `For tasks with potential ambiguity, ask clarifying questions before execution. Specific examples of ambiguity: ${summarizeExamples(failurePoints, 2)}`;
      break;
    case 'task_failure':
      content = `Tasks commonly fail when: ${summarizeExamples(failurePoints, 3)}. Break these into smaller steps with verification points.`;
      break;
    default:
      if (pattern.startsWith('blocked_')) {
        const blockerType = pattern.replace('blocked_', '');
        content = `Tasks requiring ${blockerType} have a ${Math.round(successRate * 100)}% success rate after the blocker is resolved. ${blockerType === 'awaiting_approval' ? 'Try to design tasks that minimize approval requirements when possible.' : `Consider proactively handling ${blockerType} issues.`}`;
      } else {
        content = `When encountering ${pattern}, success rate is ${Math.round(successRate * 100)}%. Consider ${successRate < 0.5 ? 'alternative approaches' : 'the successful strategies used in the past'}.`;
      }
  }
  
  return {
    id: lessonId,
    content,
    category,
    tags: [pattern, category, 'lesson'],
    source: 'task_outcome_analysis',
    relatedPatterns: [pattern],
    successRate,
    created: now
  };
}

/**
 * Find common elements across string arrays that may contain comma-separated values
 */
function findCommonElements(arrays: string[]): string[] {
  if (arrays.length === 0) return [];
  
  // First, split comma-separated values
  const expandedArrays = arrays.map(str => str.split(',').map(item => item.trim()));
  
  // Then find elements that appear in multiple arrays
  const elementCounts: Record<string, number> = {};
  
  for (const array of expandedArrays) {
    // Count each element only once per array
    const uniqueElements = Array.from(new Set(array));
    for (const element of uniqueElements) {
      if (element) { // Skip empty strings
        elementCounts[element] = (elementCounts[element] || 0) + 1;
      }
    }
  }
  
  // Return elements that appear in at least half of the arrays
  const threshold = Math.max(1, Math.floor(arrays.length / 2));
  return Object.entries(elementCounts)
    .filter(([_, count]) => count >= threshold)
    .map(([element, _]) => element);
}

/**
 * Summarize a list of examples by taking the first n and formatting them
 */
function summarizeExamples(examples: string[], limit: number): string {
  if (examples.length === 0) {
    return 'no specific examples available';
  }
  
  const limitedExamples = examples.slice(0, limit);
  
  if (limitedExamples.length === 1) {
    return `"${limitedExamples[0]}"`;
  }
  
  if (limitedExamples.length === 2) {
    return `"${limitedExamples[0]}" and "${limitedExamples[1]}"`;
  }
  
  return limitedExamples
    .map((ex, index) => index === limitedExamples.length - 1 
      ? `and "${ex}"` 
      : `"${ex}"`)
    .join(', ');
}

/**
 * Store a lesson in memory
 */
async function storeLesson(
  lesson: Lesson,
  memory: ChloeMemory
): Promise<void> {
  // Format the lesson for memory storage
  const formattedLesson = formatLessonForMemory(lesson);
  
  // Store in memory with appropriate tags
  await memory.addMemory(
    formattedLesson,
    'lesson',
    ImportanceLevel.MEDIUM,
    MemorySource.SYSTEM,
    `Pattern: ${lesson.relatedPatterns.join(', ')}`,
    ['lesson', lesson.category, ...lesson.tags]
  );
}

/**
 * Format lesson for memory storage
 */
function formatLessonForMemory(lesson: Lesson): string {
  return `LESSON - ${lesson.category.toUpperCase()}
Content: ${lesson.content}
Patterns: ${lesson.relatedPatterns.join(', ')}
Success Rate: ${Math.round(lesson.successRate * 100)}%
Source: ${lesson.source}
Created: ${lesson.created.toISOString()}`;
}

/**
 * Retrieve relevant lessons for a specific task
 * 
 * @param task The task description or context
 * @param taskType Optional task type for more targeted lessons
 * @param memory ChloeMemory instance
 * @param limit Maximum number of lessons to retrieve
 * @returns Promise<string[]> Array of relevant lesson content
 */
export async function getRelevantLessons(
  task: string,
  taskType: string | undefined,
  memory: ChloeMemory,
  limit: number = 3
): Promise<string[]> {
  // Build a search query that combines task description and type
  const searchQuery = taskType 
    ? `LESSON for ${taskType} task: ${task}`
    : `LESSON for task: ${task}`;
  
  // Query memory for relevant lessons
  const lessons = await memory.getRelevantMemories(searchQuery, limit * 2);
  
  // Filter for actual lessons
  const lessonMemories = lessons.filter(mem => 
    mem.category === 'lesson' || 
    (mem.content && mem.content.startsWith('LESSON'))
  );
  
  // Extract lesson content
  return lessonMemories
    .slice(0, limit)
    .map(mem => {
      const lines = mem.content.split('\n');
      const contentLine = lines.find(line => line.startsWith('Content:'));
      return contentLine 
        ? contentLine.replace('Content:', '').trim() 
        : mem.content;
    });
} 