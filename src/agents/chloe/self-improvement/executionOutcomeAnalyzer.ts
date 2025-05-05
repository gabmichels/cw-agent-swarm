import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { ExecutionResult } from '../../../lib/shared/types/agentTypes';
import { ToolResult } from '../tools/toolManager';
import { ExecutionTraceEntry } from '../graph/nodes/types';
import { PlannedTask } from '../human-collaboration';
import { MemoryType } from '../../../server/memory/config/types';

/**
 * Interface for execution outcome data
 */
export interface ExecutionOutcome {
  taskId: string;
  success: boolean;
  durationMs?: number;
  resultSummary?: string;
  failureReason?: string;
  affectedTools?: string[];
  taskType?: string;
  completionDate: Date;
  metadata?: Record<string, any>;
}

/**
 * Analyzer for execution outcomes that captures key metrics and insights
 * from completed or failed tasks.
 */
export class ExecutionOutcomeAnalyzer {
  /**
   * Analyzes a task result to determine outcome metrics and characteristics
   * 
   * @param task The task that was executed
   * @param traceEntries The execution trace entries from the task
   * @returns An ExecutionOutcome with metrics and analysis
   */
  static async analyzeResult(
    task: PlannedTask,
    traceEntries: ExecutionTraceEntry[]
  ): Promise<ExecutionOutcome> {
    // Calculate overall task duration
    const startTime = traceEntries.length > 0 ? traceEntries[0].startTime : new Date();
    let endTime = new Date();
    
    // Safely get the end time from the last trace entry
    if (traceEntries.length > 0) {
      const lastEntry = traceEntries[traceEntries.length - 1];
      if (lastEntry.endTime) {
        endTime = lastEntry.endTime;
      }
    }
    
    const durationMs = endTime.getTime() - startTime.getTime();
    
    // Detect success/failure status
    const success = task.status === 'complete';
    const failureReason = task.status === 'failed' ? (task as any).error : undefined;
    
    // Detect tools used
    const affectedTools = extractToolsFromTrace(traceEntries);
    
    // Determine task type from description or metadata
    const taskType = determineTaskType(task);
    
    // Collect any other relevant metadata
    const metadata: Record<string, any> = {
      subGoalCount: task.subGoals ? task.subGoals.length : 0,
      hasChildren: task.subGoals ? hasChildSubgoals(task.subGoals) : false,
      priority: (task as any).priority || (task.metadata && task.metadata.priority) || 'medium',
      ...extractMetricsFromTrace(traceEntries)
    };
    
    // Create result summary
    const resultSummary = createResultSummary(task, traceEntries, success, durationMs);
    
    return {
      taskId: task.id || task.params?.id || 'unknown',
      success,
      durationMs,
      resultSummary,
      failureReason,
      affectedTools,
      taskType,
      completionDate: new Date(),
      metadata
    };
  }
  
  /**
   * Stores an execution outcome in memory for future analysis
   * 
   * @param outcome The execution outcome to store
   * @param memory The memory system to store in
   */
  static async storeOutcome(
    outcome: ExecutionOutcome,
    memory: ChloeMemory
  ): Promise<void> {
    // Create formatted content for memory
    const content = formatOutcomeForMemory(outcome);
    
    // Create tags based on outcome properties
    const tags = ['execution_outcome', 
      outcome.success ? 'success' : 'failure',
      ...(outcome.taskType ? [outcome.taskType] : []),
      ...(outcome.affectedTools || [])
    ];
    
    // Store in memory with the appropriate parameters based on the available API
    try {
      await memory.addMemory(
        content,
        MemoryType.EXECUTION_OUTCOME,
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Task execution outcome: ${outcome.taskId}`,
        tags
      );
    } catch (error) {
      console.error('Error storing execution outcome:', error);
      
      // Try alternative memory API if available
      try {
        await memory.addMemory(
          content,
          MemoryType.EXECUTION_OUTCOME,
          outcome.success ? ImportanceLevel.MEDIUM : ImportanceLevel.HIGH,
          MemorySource.SYSTEM,
          `Task execution outcome: ${outcome.taskId}`,
          tags
        );
      } catch (fallbackError) {
        console.error('Failed to store execution outcome with both methods:', fallbackError);
      }
    }
  }
}

/**
 * Extract tools used from execution trace
 */
function extractToolsFromTrace(traceEntries: ExecutionTraceEntry[]): string[] {
  const tools = new Set<string>();
  
  traceEntries.forEach(entry => {
    // Check for tool names in the entry details
    if (entry.details && entry.details.toolName) {
      tools.add(entry.details.toolName);
    }
    
    // Check for tool results in details
    if (entry.details && entry.details.toolResults) {
      // If there are explicit tool results, extract names
      const toolResults = entry.details.toolResults as ToolResult[];
      toolResults.forEach(result => {
        // Check different properties that might contain the tool name
        const toolName = (result as any).tool || result.toolName || (result as any).name;
        if (toolName) {
          tools.add(toolName);
        }
      });
    }
    
    // Check for tools in step description
    if (entry.step) {
      // Common tool name patterns in step descriptions
      const toolNamePatterns = [
        /Using tool: (\w+)/i,
        /Executed tool: (\w+)/i,
        /Tool (\w+) returned/i
      ];
      
      for (const pattern of toolNamePatterns) {
        const match = entry.step.match(pattern);
        if (match && match[1]) {
          tools.add(match[1]);
        }
      }
    }
  });
  
  return Array.from(tools);
}

/**
 * Determine the task type from description and metadata
 */
function determineTaskType(task: PlannedTask): string {
  // If the task has a specified type in metadata, use it
  if (task.metadata && task.metadata.taskType) {
    return task.metadata.taskType;
  }
  
  // Otherwise try to infer from description or goal
  const description = 
    (task as any).description || 
    task.params?.description || 
    task.goal || 
    '';
  
  // Common task type patterns
  if (/research|find information|gather data/i.test(description)) {
    return 'research';
  } else if (/write|draft|compose|create content/i.test(description)) {
    return 'content_creation';
  } else if (/analyze|review|evaluate|assess/i.test(description)) {
    return 'analysis';
  } else if (/respond|reply|answer|message/i.test(description)) {
    return 'communication';
  } else if (/plan|schedule|organize|coordinate/i.test(description)) {
    return 'planning';
  } else if (/fix|resolve|debug|troubleshoot/i.test(description)) {
    return 'troubleshooting';
  }
  
  // Default type
  return 'general';
}

/**
 * Check if any sub-goals have children
 */
function hasChildSubgoals(subGoals: any[]): boolean {
  return subGoals.some(sg => sg.children && sg.children.length > 0);
}

/**
 * Extract performance metrics from trace entries
 */
function extractMetricsFromTrace(traceEntries: ExecutionTraceEntry[]): Record<string, any> {
  const metrics: Record<string, any> = {
    totalSteps: traceEntries.length,
    successfulSteps: 0,
    failedSteps: 0,
    toolUsageCount: 0,
    averageStepDurationMs: 0
  };
  
  // Count successful and failed steps
  let totalDuration = 0;
  traceEntries.forEach(entry => {
    if (entry.status === 'success') {
      metrics.successfulSteps++;
    } else if (entry.status === 'error') {
      metrics.failedSteps++;
    }
    
    // Check for tool usage
    if (entry.details && 
       (entry.details.toolName || 
        (entry.details.toolResults && Array.isArray(entry.details.toolResults)))) {
      metrics.toolUsageCount++;
    }
    
    // Add to total duration
    totalDuration += entry.duration || 0;
  });
  
  // Calculate average step duration
  if (traceEntries.length > 0) {
    metrics.averageStepDurationMs = Math.round(totalDuration / traceEntries.length);
  }
  
  return metrics;
}

/**
 * Create a summary of the execution result
 */
function createResultSummary(
  task: PlannedTask,
  traceEntries: ExecutionTraceEntry[],
  success: boolean,
  durationMs: number
): string {
  const durationSec = Math.round(durationMs / 1000);
  
  if (success) {
    return `Task completed successfully in ${durationSec}s with ${traceEntries.length} steps.`;
  } else {
    // Find the specific failure point
    const failureEntry = traceEntries.find(e => e.status === 'error');
    const failurePoint = failureEntry 
      ? failureEntry.step 
      : "Unknown failure point";
    
    return `Task failed after ${durationSec}s at step: ${failurePoint}`;
  }
}

/**
 * Format the outcome for storage in memory
 */
function formatOutcomeForMemory(outcome: ExecutionOutcome): string {
  const parts = [
    `Task Execution Outcome: ${outcome.taskId}`,
    `Status: ${outcome.success ? 'Success' : 'Failure'}`,
    `Type: ${outcome.taskType || 'Unknown'}`
  ];
  
  if (outcome.durationMs) {
    parts.push(`Duration: ${Math.round(outcome.durationMs / 1000)}s`);
  }
  
  if (outcome.resultSummary) {
    parts.push(`Summary: ${outcome.resultSummary}`);
  }
  
  if (outcome.failureReason) {
    parts.push(`Failure reason: ${outcome.failureReason}`);
  }
  
  if (outcome.affectedTools && outcome.affectedTools.length > 0) {
    parts.push(`Tools used: ${outcome.affectedTools.join(', ')}`);
  }
  
  if (outcome.metadata) {
    const metadataStr = Object.entries(outcome.metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`Metadata: ${metadataStr}`);
  }
  
  return parts.join('\n');
} 