import fs from 'fs';
import path from 'path';
import { PlannedTask } from '../human-collaboration';
import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource, ChloeMemoryType } from '../../../constants/memory';

/**
 * Interface for task performance score
 */
export interface TaskPerformanceScore {
  taskId: string;
  baseScore: number;
  penalties: string[];
  finalScore: number;
  insights: string[];
}

/**
 * Score a task based on various performance metrics
 * 
 * @param task PlannedTask to evaluate
 * @param memory ChloeMemory instance for storing score
 * @returns Promise<TaskPerformanceScore> with the calculated score
 */
export async function scoreTaskPerformance(
  task: PlannedTask, 
  memory?: ChloeMemory
): Promise<TaskPerformanceScore> {
  // Ensure the task has an ID
  if (!task.goal) {
    console.warn('Task missing goal - scoring may be incomplete');
  }
  
  // Create a unique ID if none exists
  const taskId = task.params?.id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Initialize score tracking
  let baseScore = 100;
  const penalties: string[] = [];
  const insights: string[] = [];
  
  // Apply penalties based on task attributes
  // Check if task needed correction
  if (task.wasCorrected === true) {
    baseScore -= 20;
    penalties.push('Required correction (-20)');
    
    // Add specific insights based on correction category
    if (task.correctionCategory) {
      switch (task.correctionCategory) {
        case 'misunderstanding':
          insights.push('Improve understanding of user requests by seeking clarification earlier');
          break;
        case 'tool_misuse':
          insights.push('Review appropriate tool selection and usage patterns');
          break;
        case 'missed_context':
          insights.push('Enhance context tracking across conversation turns');
          break;
        case 'wrong_approach':
          insights.push('Consider alternative solution strategies before executing tasks');
          break;
        default:
          insights.push('Analyze correction feedback to prevent similar issues');
      }
    }
  }
  
  // Check if task needed clarification
  if (task.needsClarification === true) {
    baseScore -= 10;
    penalties.push('Required clarification (-10)');
    insights.push('Anticipate information needs before beginning task execution');
  }
  
  // Check task completion status
  if (task.status === 'failed' || task.status === 'awaiting_clarification') {
    baseScore -= 30;
    penalties.push('Task not completed successfully (-30)');
    insights.push('Break complex tasks into smaller, manageable subtasks');
  }
  
  // Final score cannot be negative
  const finalScore = Math.max(0, baseScore);
  
  // Create the performance score object
  const performanceScore: TaskPerformanceScore = {
    taskId,
    baseScore: 100, // Initial score before penalties
    penalties,
    finalScore,
    insights
  };
  
  // Store in memory if available
  if (memory) {
    try {
      await storePerformanceScore(performanceScore, memory);
      console.log(`Performance score stored in memory for task: ${taskId}`);
    } catch (error) {
      console.error('Failed to store performance score in memory:', error);
    }
  }
  
  return performanceScore;
}

/**
 * Store the performance score in memory
 */
async function storePerformanceScore(
  score: TaskPerformanceScore,
  memory: ChloeMemory
): Promise<void> {
  // Format the performance score as a string for memory storage
  const formattedScore = formatPerformanceScoreForMemory(score);
  
  // Store in memory with medium importance
  await memory.addMemory(
    formattedScore,
    'performance_score', // Custom memory type
    ImportanceLevel.MEDIUM,
    MemorySource.SYSTEM, // Use enum value instead of string
    `Task ID: ${score.taskId}`, // Context
    ['performance', 'task_score', 'self_improvement'] // Tags
  );
}

/**
 * Format performance score for memory storage
 */
function formatPerformanceScoreForMemory(score: TaskPerformanceScore): string {
  return `PERFORMANCE SCORE - Task: ${score.taskId}
Score: ${score.finalScore}/100
Penalties: ${score.penalties.join(', ')}
Insights: ${score.insights.join(' | ')}`;
}

/**
 * Get a task's performance score from memory if available
 */
export async function getPerformanceScoreForTask(
  taskId: string,
  memory: ChloeMemory
): Promise<TaskPerformanceScore | null> {
  // Ensure memory is initialized
  try {
    // Search for the memory entry related to this task's performance
    const memories = await memory.getRelevantMemories(
      `PERFORMANCE SCORE - Task: ${taskId}`,
      5
    );
    
    if (memories && memories.length > 0) {
      // Parse the memory content to recreate the performance score object
      const scoreMemory = memories[0];
      const lines = scoreMemory.content.split('\n');
      
      // Parse score, penalties and insights from memory text
      const scoreMatch = lines[1].match(/Score: (\d+)\/100/);
      const finalScore = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      
      const penaltiesLine = lines[2].replace('Penalties: ', '');
      const penalties = penaltiesLine ? penaltiesLine.split(', ') : [];
      
      const insightsLine = lines[3].replace('Insights: ', '');
      const insights = insightsLine ? insightsLine.split(' | ') : [];
      
      return {
        taskId,
        baseScore: 100,
        penalties,
        finalScore,
        insights
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error retrieving performance score for task ${taskId}:`, error);
    return null;
  }
}

/**
 * Ensure the self-improvement directory exists
 */
function ensureSelfImprovementDirectoryExists(): void {
  const dirPath = path.join(process.cwd(), 'data', 'self-improvement');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created self-improvement directory: ${dirPath}`);
  }
}

// Example usage
/*
const exampleTask: PlannedTask = {
  goal: "Find the latest sales figures",
  subGoals: [{ 
    id: "sg1", 
    description: "Query the database", 
    priority: 1, 
    status: "completed" 
  }],
  reasoning: "Need to analyze sales trends",
  status: "completed",
  wasCorrected: true,
  correctionCategory: "missed_context",
  correctionNotes: ["You missed the date range specification"],
  needsClarification: false
};

const score = await scoreTaskPerformance(exampleTask);
console.log(JSON.stringify(score, null, 2));
*/ 