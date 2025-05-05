import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { TaskPerformanceScore } from './performanceScorer';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Interface for feedback insights generated from performance data
 */
export interface FeedbackInsight {
  category: string;
  description: string;
  affectedTasks: string[];
  severity: "low" | "medium" | "high";
}

/**
 * Generates feedback insights by analyzing performance patterns
 * 
 * @param memory ChloeMemory instance to access stored memories
 * @param lookbackDays Number of days to look back for performance data
 * @returns Promise<FeedbackInsight[]> Array of feedback insights
 */
export async function generateFeedbackInsights(
  memory: ChloeMemory,
  lookbackDays: number = 14
): Promise<FeedbackInsight[]> {
  // Get all relevant performance-related memories
  const [scores, corrections, reflections] = await Promise.all([
    getRecentTaskScores(memory, lookbackDays),
    getRecentCorrections(memory, lookbackDays),
    getRecentReflections(memory, lookbackDays)
  ]);
  
  // Extract patterns from performance scores
  const scoreInsights = analyzeScorePatterns(scores);
  
  // Extract patterns from corrections
  const correctionInsights = analyzeCorrectionPatterns(corrections);
  
  // Extract patterns from reflections
  const reflectionInsights = analyzeReflectionPatterns(reflections);
  
  // Combine all insights
  const allInsights = [
    ...scoreInsights,
    ...correctionInsights,
    ...reflectionInsights
  ];
  
  // Deduplicate insights by merging similar categories
  const uniqueInsights = deduplicateInsights(allInsights);
  
  // Store insights in memory
  await storeInsightsInMemory(uniqueInsights, memory);
  
  return uniqueInsights;
}

/**
 * Retrieves recent task performance scores from memory
 */
async function getRecentTaskScores(
  memory: ChloeMemory,
  lookbackDays: number = 14
): Promise<TaskScoreMemory[]> {
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  try {
    // Query for memories with performance_score type
    const memories = await memory.getRelevantMemories(
      'PERFORMANCE SCORE',
      50
    );
    
    // Parse each memory into a TaskScoreMemory
    const taskScores: TaskScoreMemory[] = [];
    
    for (const mem of memories) {
      if (mem.created < cutoffDate) continue;
      
      try {
        // Format is expected to be:
        // PERFORMANCE SCORE - Task: {taskId}
        // Score: {score}/100
        // Penalties: {penalties}
        // Insights: {insights}
        const lines = mem.content.split('\n');
        const taskIdMatch = lines[0].match(/Task: (.+)$/);
        const scoreMatch = lines[1].match(/Score: (\d+)\/100/);
        const penaltiesLine = lines[2].replace('Penalties: ', '');
        const insightsLine = lines[3].replace('Insights: ', '');
        
        if (taskIdMatch && scoreMatch) {
          taskScores.push({
            taskId: taskIdMatch[1],
            finalScore: parseInt(scoreMatch[1]),
            penalties: penaltiesLine ? penaltiesLine.split(', ') : [],
            insights: insightsLine ? insightsLine.split(' | ') : [],
            timestamp: mem.created
          });
        }
      } catch (error) {
        console.warn('Error parsing memory:', error);
      }
    }
    
    return taskScores;
  } catch (error) {
    console.error('Error retrieving task scores:', error);
    return [];
  }
}

/**
 * Retrieves recent corrections from memory
 */
async function getRecentCorrections(
  memory: ChloeMemory,
  lookbackDays: number = 14
): Promise<CorrectionMemory[]> {
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  try {
    // Query for memories with correction type
    const memories = await memory.getRelevantMemories(
      'correction',
      50
    );
    
    // Parse each memory into a CorrectionMemory
    return memories
      .filter(mem => mem.created >= cutoffDate)
      .map(mem => {
        // Extract category from tags or content
        let category = 'general';
        
        if (mem.tags && mem.tags.length > 0) {
          // Look for tags like misunderstanding, tool_misuse, etc.
          const correctionTags = ['misunderstanding', 'tool_misuse', 'missed_context', 'wrong_approach'];
          const matchingTag = mem.tags.find(tag => correctionTags.includes(tag));
          if (matchingTag) category = matchingTag;
        }
        
        // Extract task ID if available
        let taskId = 'unknown';
        const taskIdMatch = mem.content.match(/Task[ :]+([a-zA-Z0-9_]+)/);
        if (taskIdMatch) taskId = taskIdMatch[1];
        
        return {
          taskId,
          category,
          content: mem.content,
          timestamp: mem.created
        };
      });
  } catch (error) {
    console.error('Error retrieving corrections:', error);
    return [];
  }
}

/**
 * Retrieves recent reflections from memory
 */
async function getRecentReflections(
  memory: ChloeMemory,
  lookbackDays: number = 14
): Promise<ReflectionMemory[]> {
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  try {
    // Query for memories with reflection type
    const memories = await memory.getRelevantMemories(
      'reflection',
      50
    );
    
    // Parse each memory into a ReflectionMemory
    return memories
      .filter(mem => mem.created >= cutoffDate)
      .map(mem => {
        // Extract category and tags from content or metadata
        let category = 'general';
        let tags: string[] = [];
        
        if (mem.tags && mem.tags.length > 0) {
          tags = mem.tags;
          
          // Try to determine a category from the tags
          const categoryTags = ['performance', 'learning', 'efficiency', 'accuracy', 'communication'];
          const matchingTag = mem.tags.find(tag => categoryTags.includes(tag));
          if (matchingTag) category = matchingTag;
        }
        
        return {
          content: mem.content,
          category,
          tags,
          timestamp: mem.created
        };
      });
  } catch (error) {
    console.error('Error retrieving reflections:', error);
    return [];
  }
}

/**
 * Analyzes score patterns to generate insights
 */
function analyzeScorePatterns(scores: TaskScoreMemory[]): FeedbackInsight[] {
  if (scores.length === 0) return [];
  
  const insights: FeedbackInsight[] = [];
  
  // Group low-scoring tasks (< 70)
  const lowScores = scores.filter(score => score.finalScore < 70);
  
  if (lowScores.length >= 3 || (scores.length > 0 && lowScores.length / scores.length > 0.3)) {
    // Calculate average score
    const avgScore = lowScores.reduce((sum, score) => sum + score.finalScore, 0) / lowScores.length;
    
    // Count penalty types
    const penaltyCounts: Record<string, { count: number, tasks: string[] }> = {};
    
    for (const score of lowScores) {
      for (const penalty of score.penalties) {
        const penaltyType = penalty.replace(/\s*\(-\d+\)$/, '');
        if (!penaltyCounts[penaltyType]) {
          penaltyCounts[penaltyType] = { count: 0, tasks: [] };
        }
        penaltyCounts[penaltyType].count++;
        penaltyCounts[penaltyType].tasks.push(score.taskId);
      }
    }
    
    // Find the most common penalty
    let mostCommonPenalty = '';
    let maxCount = 0;
    
    for (const [penalty, data] of Object.entries(penaltyCounts)) {
      if (data.count > maxCount) {
        mostCommonPenalty = penalty;
        maxCount = data.count;
      }
    }
    
    if (mostCommonPenalty && maxCount >= 2) {
      // Create insight for the most common penalty
      const penaltyMap: Record<string, string> = {
        'Required correction': 'corrections_needed',
        'Required clarification': 'clarifications_needed',
        'Task not completed successfully': 'task_failures'
      };
      
      insights.push({
        category: penaltyMap[mostCommonPenalty] || 'performance_issues',
        description: `Recurring issue: ${mostCommonPenalty} in ${maxCount} tasks, average score: ${avgScore.toFixed(1)}`,
        affectedTasks: penaltyCounts[mostCommonPenalty].tasks,
        severity: getSeverityFromFrequency(maxCount, scores.length)
      });
    }
  }
  
  return insights;
}

/**
 * Analyzes correction patterns to generate insights
 */
function analyzeCorrectionPatterns(corrections: CorrectionMemory[]): FeedbackInsight[] {
  if (corrections.length === 0) return [];
  
  const insights: FeedbackInsight[] = [];
  
  // Group corrections by category
  const categoryCounts: Record<string, { count: number, tasks: string[] }> = {};
  
  for (const correction of corrections) {
    if (!categoryCounts[correction.category]) {
      categoryCounts[correction.category] = { count: 0, tasks: [] };
    }
    categoryCounts[correction.category].count++;
    categoryCounts[correction.category].tasks.push(correction.taskId);
  }
  
  // Generate insights for categories with multiple occurrences
  for (const [category, data] of Object.entries(categoryCounts)) {
    if (data.count >= 2) {
      const categoryDescriptions: Record<string, string> = {
        'misunderstanding': 'User request misunderstandings',
        'tool_misuse': 'Incorrect tool usage',
        'missed_context': 'Missing contextual information',
        'wrong_approach': 'Suboptimal solution approaches',
        'general': 'General correction patterns'
      };
      
      insights.push({
        category: `correction_${category}`,
        description: `${categoryDescriptions[category] || 'Issues'} requiring corrections in ${data.count} tasks`,
        affectedTasks: data.tasks,
        severity: getSeverityFromFrequency(data.count, corrections.length)
      });
    }
  }
  
  return insights;
}

/**
 * Analyzes reflection patterns to generate insights
 */
function analyzeReflectionPatterns(reflections: ReflectionMemory[]): FeedbackInsight[] {
  if (reflections.length === 0) return [];
  
  const insights: FeedbackInsight[] = [];
  
  // Extract common tags across reflections
  const tagCounts: Record<string, { count: number, reflections: ReflectionMemory[] }> = {};
  
  for (const reflection of reflections) {
    for (const tag of reflection.tags) {
      if (!tagCounts[tag]) {
        tagCounts[tag] = { count: 0, reflections: [] };
      }
      tagCounts[tag].count++;
      tagCounts[tag].reflections.push(reflection);
    }
  }
  
  // Generate insights for tags with multiple occurrences
  for (const [tag, data] of Object.entries(tagCounts)) {
    if (data.count >= 2) {
      insights.push({
        category: `reflection_${tag}`,
        description: `Recurring theme in reflections: "${tag}" mentioned in ${data.count} reflections`,
        affectedTasks: [], // Reflections may not be tied to specific tasks
        severity: getSeverityFromFrequency(data.count, reflections.length)
      });
    }
  }
  
  return insights;
}

/**
 * Deduplicates insights by merging similar categories
 */
function deduplicateInsights(insights: FeedbackInsight[]): FeedbackInsight[] {
  if (insights.length <= 1) return insights;
  
  const categoryMap: Record<string, FeedbackInsight> = {};
  
  for (const insight of insights) {
    const baseCategory = insight.category.split('_')[0];
    const mergeKey = `${baseCategory}_${insight.severity}`;
    
    if (!categoryMap[mergeKey]) {
      categoryMap[mergeKey] = { ...insight };
    } else {
      // Merge affected tasks and enhance description
      const combinedTasks = [...categoryMap[mergeKey].affectedTasks, ...insight.affectedTasks];
      // Use Array.from to avoid Set iterator issues
      categoryMap[mergeKey].affectedTasks = Array.from(new Set(combinedTasks));
      categoryMap[mergeKey].description = `${categoryMap[mergeKey].description}; ${insight.description.split(':')[1] || ''}`;
    }
  }
  
  return Object.values(categoryMap);
}

/**
 * Determines severity based on frequency
 */
function getSeverityFromFrequency(count: number, total: number): "low" | "medium" | "high" {
  const ratio = total > 0 ? count / total : 0;
  
  if (ratio > 0.5 || count >= 5) return "high";
  if (ratio > 0.3 || count >= 3) return "medium";
  return "low";
}

/**
 * Stores insights in memory for future reference
 */
async function storeInsightsInMemory(
  insights: FeedbackInsight[],
  memory: ChloeMemory
): Promise<void> {
  if (!insights.length) {
    console.log('No insights to store in memory');
    return;
  }
  
  try {
    // Format insights for memory storage
    const formattedInsights = formatInsightsForMemory(insights);
    
    // Store in memory with high importance
    await memory.addMemory(
      formattedInsights,
      MemoryType.FEEDBACK_INSIGHT,
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Generated from ${insights.length} feedback patterns`,
      ['feedback', 'learning', 'self_improvement']
    );
    
    console.log(`Stored ${insights.length} feedback insights in memory`);
  } catch (error) {
    console.error('Failed to store insights in memory:', error);
  }
}

/**
 * Formats insights for memory storage
 */
function formatInsightsForMemory(insights: FeedbackInsight[]): string {
  const timestamp = new Date().toISOString();
  let content = `FEEDBACK INSIGHTS - ${timestamp}\n\n`;
  
  // Use traditional for loop to avoid ArrayIterator issues
  for (let i = 0; i < insights.length; i++) {
    const insight = insights[i];
    content += `[${i + 1}] ${insight.severity.toUpperCase()} - ${insight.category}\n`;
    content += `${insight.description}\n`;
    
    if (insight.affectedTasks.length > 0) {
      content += `Affected tasks: ${insight.affectedTasks.join(', ')}\n`;
    }
    
    content += '\n';
  }
  
  return content;
}

// Type definitions for memory parsing
interface TaskScoreMemory {
  taskId: string;
  finalScore: number;
  penalties: string[];
  insights: string[];
  timestamp: Date;
}

interface CorrectionMemory {
  taskId: string;
  category: string;
  content: string;
  timestamp: Date;
}

interface ReflectionMemory {
  content: string;
  category: string;
  tags: string[];
  timestamp: Date;
}

// Example data for testing
const sampleScores: TaskScoreMemory[] = [
  {
    taskId: 'task_1234',
    finalScore: 60,
    penalties: ['Required correction (-20)', 'Required clarification (-10)'],
    insights: ['Enhance context tracking across conversation turns'],
    timestamp: new Date('2023-06-01')
  },
  {
    taskId: 'task_5678',
    finalScore: 70,
    penalties: ['Required clarification (-10)', 'Task not completed successfully (-30)'],
    insights: ['Anticipate information needs before beginning task execution'],
    timestamp: new Date('2023-06-02')
  },
  {
    taskId: 'task_9012',
    finalScore: 80,
    penalties: ['Required correction (-20)'],
    insights: ['Review appropriate tool selection and usage patterns'],
    timestamp: new Date('2023-06-03')
  }
];

/**
 * Gets behavioral modifiers based on recent feedback and corrections
 * 
 * @param task Current planning task
 * @returns Promise<string[]> Array of behavioral modifiers
 */
export async function getBehavioralModifiersFromFeedback(
  task: { goal: string; type?: string }
): Promise<string[]> {
  // Get singleton memory instance
  const memory = new ChloeMemory();
  
  // Look back 30 days for relevant feedback
  const lookbackDays = 30;
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  try {
    // Get feedback insights and corrections
    const [feedbackInsights, corrections] = await Promise.all([
      // Get stored feedback insights
      memory.getRelevantMemories(
        "feedback_insight " + task.goal,
        10
      ),
      // Get correction memories
      memory.getRelevantMemories(
        "correction " + task.goal,
        10
      )
    ]);
    
    // Filter to recent relevant insights and corrections
    const recentInsights = feedbackInsights.filter(m => m.created >= cutoffDate);
    const recentCorrections = corrections.filter(m => m.created >= cutoffDate);
    
    // Extract behavioral modifiers from insights
    const modifiers: string[] = [];
    
    // Process feedback insights
    for (const insight of recentInsights) {
      // Check for severity in content
      const severityMatch = insight.content.match(/severity: (low|medium|high)/i);
      const severity = severityMatch ? severityMatch[1].toLowerCase() : "low";
      
      // Extract category
      let category = "general";
      if (insight.tags && insight.tags.length > 0) {
        category = insight.tags[0];
      }
      
      // Generate appropriate modifier based on category
      switch (category) {
        case "tool_misuse":
          // Check if there's a specific tool mentioned
          const toolMatch = insight.content.match(/tool: ([a-zA-Z0-9_]+)/i);
          if (toolMatch) {
            modifiers.push(`Be cautious when using the ${toolMatch[1]} tool - verify its correct usage`);
          } else {
            modifiers.push("Verify tool parameters carefully before execution");
          }
          break;
          
        case "missed_context":
          modifiers.push("Review all available context before making decisions");
          modifiers.push("Consider relevant historical information when planning");
          break;
          
        case "wrong_approach":
          modifiers.push("Break down execution into micro steps");
          modifiers.push("Consider alternative approaches before committing to a plan");
          break;
          
        case "misunderstanding":
          modifiers.push("Add clarification steps to ensure understanding");
          modifiers.push("Validate assumptions before proceeding with plan");
          break;
          
        default:
          // Extract any recommendation from insight content
          const recommendationMatch = insight.content.match(/recommendation: (.+?)(?:$|\n)/i);
          if (recommendationMatch) {
            modifiers.push(recommendationMatch[1]);
          }
      }
    }
    
    // Process corrections for additional modifiers
    for (const correction of recentCorrections) {
      // Look for specific patterns in corrections
      if (correction.content.includes("tool")) {
        modifiers.push("Double-check tool selection and parameters");
      }
      
      if (correction.content.includes("step") || correction.content.includes("sequence")) {
        modifiers.push("Use more fine-grained steps in planning");
      }
      
      if (correction.content.includes("context") || correction.content.includes("information")) {
        modifiers.push("Ensure all relevant context is considered in planning");
      }
    }
    
    // Deduplicate modifiers
    const uniqueModifiers = Array.from(new Set(modifiers));
    
    // Limit to most relevant (max 5)
    return uniqueModifiers.slice(0, 5);
  } catch (error) {
    console.error('Error getting behavioral modifiers:', error);
    return [
      "Be cautious and methodical in your planning",
      "Break down complex tasks into smaller steps"
    ];
  }
}

/**
 * Gets top behavioral patterns for summary reporting
 * 
 * @param memory ChloeMemory instance
 * @param lookbackDays Number of days to look back
 * @returns Promise<{category: string, count: number, severity: string}[]>
 */
export async function getTopBehavioralPatterns(
  memory: ChloeMemory = new ChloeMemory(),
  lookbackDays: number = 30
): Promise<{category: string, count: number, severity: string}[]> {
  const now = new Date();
  const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
  
  try {
    // Get all feedback insights from memory
    const insights = await memory.getRelevantMemories(
      MemoryType.FEEDBACK_INSIGHT,
      50
    );
    
    // Filter to recent insights
    const recentInsights = insights.filter(m => m.created >= cutoffDate);
    
    // Count occurrences by category
    const categoryCounts: Record<string, {count: number, severitySum: number}> = {};
    
    for (const insight of recentInsights) {
      // Get category from tags or default to "general"
      let category = "general";
      if (insight.tags && insight.tags.length > 0) {
        category = insight.tags[0];
      }
      
      // Get severity (convert to numeric value)
      const severityMatch = insight.content.match(/severity: (low|medium|high)/i);
      let severityValue = 1; // default low
      if (severityMatch) {
        const severity = severityMatch[1].toLowerCase();
        severityValue = severity === "high" ? 3 : (severity === "medium" ? 2 : 1);
      }
      
      // Update counts
      if (!categoryCounts[category]) {
        categoryCounts[category] = { count: 0, severitySum: 0 };
      }
      
      categoryCounts[category].count += 1;
      categoryCounts[category].severitySum += severityValue;
    }
    
    // Convert to array and sort by frequency
    return Object.entries(categoryCounts)
      .map(([category, data]) => {
        // Calculate average severity
        const avgSeverity = data.severitySum / data.count;
        let severityLabel = "low";
        if (avgSeverity > 2.5) severityLabel = "high";
        else if (avgSeverity > 1.5) severityLabel = "medium";
        
        return {
          category,
          count: data.count,
          severity: severityLabel
        };
      })
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting behavioral patterns:', error);
    return [];
  }
}

export async function testGenerateFeedbackInsights(): Promise<FeedbackInsight[]> {
  // Simulate analyzing the sample data
  const scoreInsights = analyzeScorePatterns(sampleScores);
  
  const sampleCorrections: CorrectionMemory[] = [
    {
      taskId: 'task_1234',
      category: 'tool_misuse',
      content: 'Used incorrect API parameters',
      timestamp: new Date('2023-06-01')
    },
    {
      taskId: 'task_5678',
      category: 'missed_context',
      content: 'Missed previous conversation context',
      timestamp: new Date('2023-06-02')
    },
    {
      taskId: 'task_3456',
      category: 'tool_misuse',
      content: 'Selected wrong tool for the job',
      timestamp: new Date('2023-06-03')
    }
  ];
  
  const correctionInsights = analyzeCorrectionPatterns(sampleCorrections);
  
  const sampleReflections: ReflectionMemory[] = [
    {
      content: 'Need to improve context tracking',
      category: 'performance',
      tags: ['context', 'memory', 'conversation'],
      timestamp: new Date('2023-06-01')
    },
    {
      content: 'Tool selection needs to be more precise',
      category: 'efficiency',
      tags: ['tools', 'selection', 'accuracy'],
      timestamp: new Date('2023-06-02')
    }
  ];
  
  const reflectionInsights = analyzeReflectionPatterns(sampleReflections);
  
  // Combine all insights
  const allInsights = [
    ...scoreInsights,
    ...correctionInsights,
    ...reflectionInsights
  ];
  
  // Deduplicate insights
  return deduplicateInsights(allInsights);
} 