import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { scoreTaskPerformance, TaskPerformanceScore } from './performanceScorer';
import { generateFeedbackInsights, FeedbackInsight } from './feedbackIngestor';
import { generateStrategyAdjustments, StrategyAdjustment } from './strategyAdjuster';
import { PlannedTask } from '../human-collaboration';

/**
 * Interface for self-improvement cycle results
 */
export interface SelfImprovementResult {
  date: string;
  tasksScored: number;
  insightsGenerated: number;
  adjustmentsProposed: number;
  errors: string[];
}

/**
 * Runs the weekly self-improvement cycle
 * 
 * @param memory ChloeMemory instance to access stored memories
 * @param recentTasks Optional array of tasks completed in the last week (if not provided, will attempt to retrieve from memory)
 * @returns Promise<SelfImprovementResult> Summary of the self-improvement cycle
 */
export async function runWeeklySelfImprovement(
  memory: ChloeMemory,
  recentTasks?: PlannedTask[]
): Promise<SelfImprovementResult> {
  const startTime = Date.now();
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const result: SelfImprovementResult = {
    date: currentDate,
    tasksScored: 0,
    insightsGenerated: 0,
    adjustmentsProposed: 0,
    errors: []
  };
  
  try {
    console.log('🔄 Starting weekly self-improvement cycle...');
    
    // Step 1: Retrieve recent tasks if not provided
    const tasks = recentTasks || await getRecentTasks(memory);
    console.log(`📋 Retrieved ${tasks.length} tasks for review`);
    
    // Step 2: Score all tasks
    console.log('📊 Scoring task performance...');
    const scores: TaskPerformanceScore[] = [];
    
    for (const task of tasks) {
      try {
        const score = await scoreTaskPerformance(task, memory);
        scores.push(score);
        result.tasksScored++;
      } catch (error) {
        const errorMsg = `Error scoring task ${task.params?.id || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }
    
    console.log(`✅ Scored ${result.tasksScored}/${tasks.length} tasks`);
    
    // Step 3: Generate feedback insights
    console.log('🧠 Generating feedback insights...');
    let insights: FeedbackInsight[] = [];
    
    try {
      insights = await generateFeedbackInsights(memory);
      result.insightsGenerated = insights.length;
      console.log(`✅ Generated ${insights.length} feedback insights`);
    } catch (error) {
      const errorMsg = `Error generating feedback insights: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    // Step 4: Generate strategy adjustments
    console.log('⚙️ Generating strategy adjustments...');
    let adjustments: StrategyAdjustment[] = [];
    
    try {
      adjustments = await generateStrategyAdjustments(memory);
      result.adjustmentsProposed = adjustments.length;
      console.log(`✅ Generated ${adjustments.length} strategy adjustments`);
    } catch (error) {
      const errorMsg = `Error generating strategy adjustments: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    // Step 5: Store summary log in memory
    await storeSelfImprovementLog(result, memory);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Self-improvement cycle completed in ${duration}s`);
    
    return result;
  } catch (error) {
    const errorMsg = `Error in self-improvement cycle: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
    
    // Try to store the error log even if the process failed
    try {
      await storeSelfImprovementLog(result, memory);
    } catch {
      console.error('Failed to store self-improvement log');
    }
    
    return result;
  }
}

/**
 * Retrieves tasks completed in the last 7 days
 */
async function getRecentTasks(
  memory: ChloeMemory,
  lookbackDays: number = 7
): Promise<PlannedTask[]> {
  try {
    // Get tasks from memory
    // This is a simplified approach - in a real implementation,
    // we would need to pull from a task database or task log
    
    const now = new Date();
    const cutoffDate = new Date(now.setDate(now.getDate() - lookbackDays));
    
    // Query for memories with task type
    const memories = await memory.getRelevantMemories(
      'completed task',
      100
    );
    
    // Filter and parse into PlannedTask objects
    const recentTasks: PlannedTask[] = [];
    
    for (const mem of memories) {
      if (mem.created < cutoffDate) continue;
      
      try {
        // Try to extract task information from memory content
        // This is a simplified parsing approach - in a real implementation,
        // we would have proper task serialization/deserialization
        
        // Example memory content format:
        // "Completed task: Find latest sales figures. Status: completed. ID: task_1234"
        
        const taskIdMatch = mem.content.match(/ID: ([a-zA-Z0-9_]+)/i);
        const goalMatch = mem.content.match(/task: ([^.]+)/i);
        const statusMatch = mem.content.match(/Status: ([a-zA-Z_]+)/i);
        
        if (taskIdMatch && goalMatch) {
          const taskId = taskIdMatch[1];
          const goal = goalMatch[1].trim();
          const status = statusMatch ? statusMatch[1].toLowerCase() as 'completed' | 'failed' : 'completed';
          
          // Create a minimal task object with the extracted information
          recentTasks.push({
            goal,
            subGoals: [],
            reasoning: '',
            status: status as any,
            params: { id: taskId }
          });
        }
      } catch (error) {
        console.warn('Error parsing task memory:', error);
      }
    }
    
    return recentTasks;
  } catch (error) {
    console.error('Error retrieving recent tasks:', error);
    return [];
  }
}

/**
 * Stores self-improvement log in memory
 */
async function storeSelfImprovementLog(
  result: SelfImprovementResult,
  memory: ChloeMemory
): Promise<void> {
  try {
    const formattedLog = formatSelfImprovementLog(result);
    
    await memory.addMemory(
      formattedLog,
      'self_improvement_log',
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Weekly self-improvement cycle: ${result.date}`,
      ['self_improvement', 'reflection', 'weekly']
    );
    
    console.log('✅ Stored self-improvement log in memory');
  } catch (error) {
    console.error('Failed to store self-improvement log:', error);
    throw error;
  }
}

/**
 * Formats self-improvement log for storage
 */
function formatSelfImprovementLog(result: SelfImprovementResult): string {
  return `WEEKLY SELF-IMPROVEMENT CYCLE - ${result.date}

SUMMARY:
- Tasks scored: ${result.tasksScored}
- Feedback insights generated: ${result.insightsGenerated}
- Strategy adjustments proposed: ${result.adjustmentsProposed}

${result.errors.length > 0 ? `ERRORS (${result.errors.length}):\n${result.errors.map(err => `- ${err}`).join('\n')}\n` : ''}

This weekly cycle helps Chloe improve by analyzing past performance,
identifying patterns, and adjusting behavior to better serve users.
`;
}

/**
 * Test function to demonstrate the weekly self-improvement cycle
 */
export async function testWeeklySelfImprovement(): Promise<SelfImprovementResult> {
  // Create sample tasks for testing
  const sampleTasks: PlannedTask[] = [
    {
      goal: "Find the latest sales figures",
      subGoals: [{ id: "sg1", description: "Query the database", priority: 1, status: "completed" }],
      reasoning: "Need to analyze sales trends",
      status: "completed",
      wasCorrected: true,
      correctionCategory: "missed_context",
      correctionNotes: ["You missed the date range specification"],
      needsClarification: false,
      params: { id: "task_1234" }
    },
    {
      goal: "Schedule team meeting",
      subGoals: [{ id: "sg1", description: "Check availability", priority: 1, status: "completed" }],
      reasoning: "Need to align on project goals",
      status: "completed",
      wasCorrected: false,
      needsClarification: true,
      clarificationQuestions: ["What time zone should I use?"],
      params: { id: "task_5678" }
    },
    {
      goal: "Analyze customer feedback",
      subGoals: [{ id: "sg1", description: "Process survey results", priority: 1, status: "failed" }],
      reasoning: "Need to identify improvement areas",
      status: "failed",
      wasCorrected: true,
      correctionCategory: "tool_misuse",
      correctionNotes: ["Used wrong data processing function"],
      params: { id: "task_9012" }
    }
  ];
  
  // Create mock memory for testing
  const mockMemory = {
    addMemory: async (content: string, type: string, importance: any, source: any, context: string, tags: string[]) => {
      console.log(`[MOCK] Storing memory of type ${type} with importance ${importance}`);
      return { id: `memory_${Date.now()}`, content, type };
    },
    getRelevantMemories: async (query: string, limit: number) => {
      console.log(`[MOCK] Retrieving memories for query: ${query}, limit: ${limit}`);
      return [];
    }
  } as unknown as ChloeMemory;
  
  // Run the self-improvement cycle with sample tasks
  return runWeeklySelfImprovement(mockMemory, sampleTasks);
} 