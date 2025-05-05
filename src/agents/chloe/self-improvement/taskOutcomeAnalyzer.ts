import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { MemoryType } from '../../../server/memory/config/types';
import { SubGoal, ExecutionTraceEntry } from '../graph/nodes/types';
import { PlannedTask } from '../human-collaboration';

/**
 * Interface for task outcome analysis result
 */
export interface TaskOutcomeAnalysis {
  taskId: string;
  status: 'success' | 'corrected' | 'failed';
  score: number;
  reason: string;
  patterns: string[];
  metadata: {
    toolsUsed?: string[];
    taskType?: string;
    executionTime?: number;
    subGoalCount?: number;
    failurePoint?: string;
  };
}

/**
 * Interface for patterns identified in task execution
 */
export interface ExecutionPattern {
  type: string;
  description: string;
  frequency: number;
  impact: 'low' | 'medium' | 'high';
}

/**
 * Analyzes the outcome of a task after completion
 * 
 * @param task The completed task to analyze
 * @param executionTrace The trace of execution steps
 * @param memory ChloeMemory instance for storing outcomes
 * @returns Promise<TaskOutcomeAnalysis> with the analysis result
 */
export async function analyzeTaskOutcome(
  task: PlannedTask,
  executionTrace: ExecutionTraceEntry[],
  memory?: ChloeMemory
): Promise<TaskOutcomeAnalysis> {
  // Create a unique ID if none exists
  const taskId = task.params?.id || task.id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // Extract tools used from execution trace
  const toolsUsed = extractToolsFromTrace(executionTrace);
  
  // Calculate execution time
  const executionTime = calculateExecutionTime(executionTrace);
  
  // Determine outcome status
  let status: 'success' | 'corrected' | 'failed';
  let score = 100; // Start with perfect score
  let reason = '';
  const patterns: string[] = [];
  
  // Analyze task status
  if (task.status === 'complete') {
    if (task.wasCorrected === true) {
      status = 'corrected';
      score -= 20;
      reason = 'Task completed but required correction';
      patterns.push(task.correctionCategory || 'unknown_correction');
    } else {
      status = 'success';
      reason = 'Task completed successfully';
    }
  } else {
    status = 'failed';
    score -= 50;
    reason = `Task failed with status: ${task.status}`;
    patterns.push('task_failure');
  }
  
  // Apply additional analysis
  if (task.needsClarification === true) {
    score -= 10;
    patterns.push('unclear_requirements');
  }
  
  // Analyze execution trace for blockers or errors
  const { blockerPatterns, errorCount } = analyzeExecutionTrace(executionTrace);
  patterns.push(...blockerPatterns);
  
  // Penalize for errors
  if (errorCount > 0) {
    score -= Math.min(20, errorCount * 5); // Max 20 point penalty for errors
  }
  
  // Ensure score is within 0-100 range
  score = Math.max(0, Math.min(100, score));
  
  // Construct final analysis
  const analysis: TaskOutcomeAnalysis = {
    taskId,
    status,
    score,
    reason,
    patterns,
    metadata: {
      toolsUsed,
      taskType: task.type,
      executionTime,
      subGoalCount: task.subGoals?.length || 0,
      failurePoint: findFailurePoint(task)
    }
  };
  
  // Store in memory if available
  if (memory) {
    await storeTaskOutcome(analysis, memory);
  }
  
  return analysis;
}

/**
 * Extract tools used from execution trace
 */
function extractToolsFromTrace(trace: ExecutionTraceEntry[]): string[] {
  const toolSet = new Set<string>();
  
  for (const entry of trace) {
    if (entry.details?.toolUsed) {
      toolSet.add(entry.details.toolUsed);
    }
  }
  
  return Array.from(toolSet);
}

/**
 * Calculate total execution time from trace
 */
function calculateExecutionTime(trace: ExecutionTraceEntry[]): number {
  let totalTime = 0;
  
  for (const entry of trace) {
    if (entry.duration) {
      totalTime += entry.duration;
    }
  }
  
  return totalTime;
}

/**
 * Analyze execution trace for patterns and errors
 */
function analyzeExecutionTrace(trace: ExecutionTraceEntry[]): { blockerPatterns: string[], errorCount: number } {
  const blockerPatterns: string[] = [];
  let errorCount = 0;
  
  for (const entry of trace) {
    if (entry.status === 'error') {
      errorCount++;
      
      // Check for specific error types in details
      if (entry.details?.error) {
        const errorMessage = entry.details.error.toString().toLowerCase();
        
        if (errorMessage.includes('permission') || errorMessage.includes('access')) {
          blockerPatterns.push('permission_error');
        } else if (errorMessage.includes('timeout') || errorMessage.includes('time exceeded')) {
          blockerPatterns.push('timeout_error');
        } else if (errorMessage.includes('not found')) {
          blockerPatterns.push('resource_not_found');
        }
      }
    }
    
    if (entry.details?.blockedReason) {
      blockerPatterns.push(`blocked_${entry.details.blockedReason}`);
    }
  }
  
  // Return unique patterns
  return {
    blockerPatterns: Array.from(new Set(blockerPatterns)),
    errorCount
  };
}

/**
 * Find the point of failure in a task
 */
function findFailurePoint(task: PlannedTask): string | undefined {
  if (task.status !== 'failed' && !task.wasCorrected) {
    return undefined;
  }
  
  // Look for first incomplete or failed sub-goal
  if (task.subGoals && task.subGoals.length > 0) {
    const findFailedSubGoal = (subGoals: SubGoal[]): SubGoal | undefined => {
      for (const sg of subGoals) {
        if (sg.status === 'failed' || sg.status === 'pending') {
          return sg;
        }
        
        if (sg.children && sg.children.length > 0) {
          const childFailure = findFailedSubGoal(sg.children);
          if (childFailure) return childFailure;
        }
      }
      
      return undefined;
    };
    
    const failedSubGoal = findFailedSubGoal(task.subGoals);
    if (failedSubGoal) {
      return failedSubGoal.description;
    }
  }
  
  return task.correctionNotes?.[0] || 'Unknown failure point';
}

/**
 * Store task outcome in memory
 */
async function storeTaskOutcome(
  analysis: TaskOutcomeAnalysis,
  memory: ChloeMemory
): Promise<void> {
  // Format the outcome for memory storage
  const formattedOutcome = formatOutcomeForMemory(analysis);
  
  // Determine importance based on status
  const importance = 
    analysis.status === 'failed' ? ImportanceLevel.HIGH :
    analysis.status === 'corrected' ? ImportanceLevel.MEDIUM :
    ImportanceLevel.LOW;
  
  // Store in memory with appropriate tags
  await memory.addMemory(
    formattedOutcome,
    MemoryType.TASK_OUTCOME,
    importance,
    MemorySource.SYSTEM,
    `Task ID: ${analysis.taskId}`,
    ['outcome', 'performance', ...analysis.patterns]
  );
}

/**
 * Format task outcome for memory storage
 */
function formatOutcomeForMemory(analysis: TaskOutcomeAnalysis): string {
  return `TASK OUTCOME - ${analysis.taskId}
Status: ${analysis.status.toUpperCase()}
Score: ${analysis.score}/100
Reason: ${analysis.reason}
Patterns: ${analysis.patterns.join(', ') || 'None identified'}
Execution Time: ${analysis.metadata.executionTime}ms
Tools: ${analysis.metadata.toolsUsed?.join(', ') || 'None'}
${analysis.metadata.failurePoint ? `Failure Point: ${analysis.metadata.failurePoint}` : ''}`;
}

/**
 * Find common patterns across multiple task outcomes
 * 
 * @param memory ChloeMemory instance to query for outcomes
 * @param limit Number of patterns to return
 * @returns Promise<ExecutionPattern[]> with common patterns
 */
export async function findCommonExecutionPatterns(
  memory: ChloeMemory,
  limit: number = 5
): Promise<ExecutionPattern[]> {
  // Get recent task outcomes from memory
  const memories = await memory.getRelevantMemories('TASK OUTCOME', 50);
  
  // Parse patterns from memories
  const patternCounts: Record<string, number> = {};
  
  for (const mem of memories) {
    try {
      // Extract patterns line
      const lines = mem.content.split('\n');
      const patternsLine = lines.find(line => line.startsWith('Patterns:'));
      
      if (patternsLine) {
        const patternsStr = patternsLine.replace('Patterns:', '').trim();
        const patterns = patternsStr.split(',').map(p => p.trim());
        
        // Count each pattern
        for (const pattern of patterns) {
          if (pattern && pattern !== 'None identified') {
            patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing memory for patterns:', error);
    }
  }
  
  // Convert to array and sort by frequency
  const patternEntries = Object.entries(patternCounts)
    .map(([type, frequency]) => ({
      type,
      description: getPatternDescription(type),
      frequency,
      impact: getPatternImpact(type, frequency)
    }))
    .sort((a, b) => b.frequency - a.frequency);
  
  // Return top patterns
  return patternEntries.slice(0, limit);
}

/**
 * Get a human-readable description for a pattern type
 */
function getPatternDescription(patternType: string): string {
  const descriptions: Record<string, string> = {
    'misunderstanding': 'Failed to correctly understand user request',
    'tool_misuse': 'Incorrect tool selection or usage',
    'missed_context': 'Overlooked important context information',
    'wrong_approach': 'Selected an ineffective solution approach',
    'task_failure': 'Failed to complete the assigned task',
    'unclear_requirements': 'Needed additional clarification of requirements',
    'permission_error': 'Encountered permissions or access issues',
    'timeout_error': 'Operation timed out during execution',
    'resource_not_found': 'Required resource was not found',
    'blocked_awaiting_approval': 'Execution blocked waiting for approval'
  };
  
  return descriptions[patternType] || `Pattern: ${patternType}`;
}

/**
 * Determine the impact level of a pattern based on type and frequency
 */
function getPatternImpact(patternType: string, frequency: number): 'low' | 'medium' | 'high' {
  // High-impact failures regardless of frequency
  const highImpactPatterns = ['task_failure', 'permission_error', 'wrong_approach'];
  if (highImpactPatterns.includes(patternType)) {
    return 'high';
  }
  
  // Medium-impact issues
  const mediumImpactPatterns = ['tool_misuse', 'missed_context', 'unclear_requirements'];
  if (mediumImpactPatterns.includes(patternType) || frequency >= 3) {
    return 'medium';
  }
  
  // Otherwise low impact
  return 'low';
} 