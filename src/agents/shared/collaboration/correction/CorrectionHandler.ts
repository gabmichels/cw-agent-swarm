/**
 * Correction handler module for handling agent self-corrections
 * and agent-human collaborative corrections
 * 
 * This file contains functions to handle corrections and learn from them
 * with visualization support for self-correction actions.
 */

import { v4 as uuidv4 } from 'uuid';
import { CollaborativeTask, Correction } from '../interfaces/HumanCollaboration.interface';
import { ThinkingVisualization, VisualizationService } from '../../../../services/thinking/visualization/types';
import { generateRequestId } from '../../../../utils/request-utils';

/**
 * Memory interface for accessing agent memory
 */
interface MemoryInterface {
  addMemory(memory: {
    content: string;
    category: string;
    source: string;
    context?: string;
    tags?: string[];
  }): Promise<any>;
  
  searchMemories(options: {
    query: string;
    filters?: Array<{ field: string; value: any }>;
    limit?: number;
  }): Promise<Array<{
    id: string;
    content: string;
    category: string;
    source: string;
    context?: string;
    tags?: string[];
    timestamp?: Date;
  }>>;
}

/**
 * Processes a correction and updates relevant systems with visualization support
 * 
 * @param task The task being corrected
 * @param correction The correction details
 * @param memoryManager Memory manager to store the correction
 * @param visualizationContext Optional visualization context
 * @returns The updated task with correction notes
 */
export async function handleCorrection(
  task: CollaborativeTask,
  correction: Correction,
  memoryManager?: MemoryInterface,
  visualizationContext?: {
    visualization: ThinkingVisualization,
    visualizer: VisualizationService,
    parentNodeId?: string
  }
): Promise<CollaborativeTask> {
  // Generate a new request ID for this self-correction action
  const requestId = generateRequestId();
  
  // Create visualization node if visualization is enabled
  let correctionNodeId: string | undefined;
  
  if (visualizationContext && 
      visualizationContext.visualization && 
      visualizationContext.visualizer) {
    try {
      // Create self-correction visualization node
      correctionNodeId = visualizationContext.visualizer.addNode(
        visualizationContext.visualization,
        'self_correction',
        `Self-Correction: ${correction.category || detectCorrectionCategory(correction)}`,
        {
          taskId: task.id,
          taskGoal: task.goal,
          originalPlan: correction.originalPlan,
          correctionText: correction.correctionText,
          correctedBy: correction.correctedBy,
          category: correction.category || detectCorrectionCategory(correction),
          timestamp: correction.timestamp,
          requestId,
          metadata: {}
        },
        'in_progress'
      );
      
      // Connect to parent node if specified
      if (visualizationContext.parentNodeId && correctionNodeId) {
        visualizationContext.visualizer.addEdge(
          visualizationContext.visualization,
          visualizationContext.parentNodeId,
          correctionNodeId,
          'triggered_correction'
        );
      }
    } catch (error) {
      console.error('Error creating self-correction visualization:', error);
    }
  }

  try {
    // 1. Store correction in memory if memory manager is provided
    if (memoryManager) {
      await memoryManager.addMemory({
        content: `Task correction: ${correction.correctionText}`,
        category: 'CORRECTION',
        source: correction.correctedBy === 'human' ? 'USER' : 'SYSTEM',
        context: task.goal,
        tags: ['correction', 'task', task.goal, ...getTagsFromCorrection(correction)]
      });
      
      // 2. Add a more detailed entry with the full correction context
      await memoryManager.addMemory({
        content: `Original plan: ${correction.originalPlan}\nCorrection: ${correction.correctionText}`,
        category: 'CORRECTION_DETAIL',
        source: correction.correctedBy === 'human' ? 'USER' : 'SYSTEM',
        context: task.goal,
        tags: ['correction_detail', 'learning', 'adaptation', task.goal]
      });

      // 3. Generate insight from correction (automatic categorization)
      const insight = generateInsightFromCorrection(correction);
      if (insight) {
        await memoryManager.addMemory({
          content: insight,
          category: 'INSIGHT',
          source: 'AGENT',
          context: task.goal,
          tags: ['insight', 'learning', 'correction', task.goal]
        });
      }
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
    
    // Update visualization node with success if enabled
    if (visualizationContext && correctionNodeId) {
      try {
        // Generate insight again for visualization (if not already done)
        const insight = memoryManager ? undefined : generateInsightFromCorrection(correction);
        
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          correctionNodeId,
          {
            status: 'completed',
            data: {
              taskId: task.id,
              result: 'Correction applied successfully',
              updatedTask: { 
                wasCorrected: updatedTask.wasCorrected,
                correctionCategory: updatedTask.correctionCategory,
                correctionTimestamp: updatedTask.correctionTimestamp
              }
            }
          }
        );
        
        // Create a learning insight node to show what was learned
        if (insight) {
          const insightNodeId = visualizationContext.visualizer.addNode(
            visualizationContext.visualization,
            'correction_insight',
            'Correction Insight',
            {
              taskId: task.id,
              insight,
              timestamp: Date.now()
            },
            'completed'
          );
          
          // Connect insight to correction node
          if (insightNodeId && correctionNodeId) {
            visualizationContext.visualizer.addEdge(
              visualizationContext.visualization,
              correctionNodeId,
              insightNodeId,
              'generated_insight'
            );
          }
        }
      } catch (error) {
        console.error('Error updating self-correction visualization:', error);
      }
    }
    
    return updatedTask;
  } catch (error) {
    // Update visualization with error if enabled
    if (visualizationContext && correctionNodeId) {
      try {
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          correctionNodeId,
          {
            status: 'error',
            data: {
              error: error instanceof Error ? error.message : String(error),
              timestamp: Date.now()
            }
          }
        );
      } catch (vizError) {
        console.error('Error updating correction visualization with error:', vizError);
      }
    }
    
    // Re-throw the error
    throw error;
  }
}

/**
 * Get tags based on the correction category
 */
function getTagsFromCorrection(correction: Correction): string[] {
  const category = correction.category || detectCorrectionCategory(correction);
  
  switch (category) {
    case 'misunderstanding':
      return ['misunderstanding', 'clarification'];
    case 'tool_misuse':
      return ['tool_misuse', 'skill_improvement'];
    case 'missed_context':
      return ['missed_context', 'context_awareness'];
    case 'wrong_approach':
      return ['wrong_approach', 'strategy'];
    default:
      return ['general_correction'];
  }
}

/**
 * Generate an insight from the correction
 */
function generateInsightFromCorrection(correction: Correction): string | null {
  const category = correction.category || detectCorrectionCategory(correction);
  
  switch (category) {
    case 'misunderstanding':
      return `Insight: Improved understanding needed for tasks like "${correction.originalPlan}". Ensure requirements are fully clarified before proceeding.`;
    case 'tool_misuse':
      return `Insight: Tool selection and usage needs refinement, especially for tasks similar to "${correction.originalPlan}". Review tool documentation and proper application.`;
    case 'missed_context':
      return `Insight: Important context was missed in "${correction.originalPlan}". Develop better context awareness by asking clarifying questions.`;
    case 'wrong_approach':
      return `Insight: Approach selection for "${correction.originalPlan}" was suboptimal. Consider multiple strategies before committing to a solution path.`;
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
 * Checks if a new task plan should be adjusted based on past corrections
 * with visualization support
 * 
 * @param task The current task plan
 * @param memoryManager Memory manager to retrieve past corrections
 * @param visualizationContext Optional visualization context
 * @returns Suggested adjustments based on past corrections
 */
export async function checkPastCorrections(
  task: CollaborativeTask,
  memoryManager?: MemoryInterface,
  visualizationContext?: {
    visualization: ThinkingVisualization,
    visualizer: VisualizationService,
    parentNodeId?: string
  }
): Promise<{
  hasSimilarCorrections: boolean;
  suggestedAdjustments: string[];
  relevantCorrections: string[];
}> {
  // Generate new requestId for the check operation
  const requestId = generateRequestId();
  
  // Create visualization node if visualization is enabled
  let checkNodeId: string | undefined;
  
  if (visualizationContext && 
      visualizationContext.visualization && 
      visualizationContext.visualizer) {
    try {
      // Create correction check visualization node
      checkNodeId = visualizationContext.visualizer.addNode(
        visualizationContext.visualization,
        'correction_check',
        `Checking Past Corrections for: ${task.goal}`,
        {
          taskId: task.id,
          taskGoal: task.goal,
          timestamp: Date.now(),
          requestId
        },
        'in_progress'
      );
      
      // Connect to parent node if specified
      if (visualizationContext.parentNodeId && checkNodeId) {
        visualizationContext.visualizer.addEdge(
          visualizationContext.visualization,
          visualizationContext.parentNodeId,
          checkNodeId,
          'initiated_check'
        );
      }
    } catch (error) {
      console.error('Error creating correction check visualization:', error);
    }
  }

  try {
    // Default return value if no memory manager
    if (!memoryManager) {
      const result = {
        hasSimilarCorrections: false,
        suggestedAdjustments: [],
        relevantCorrections: []
      };
      
      // Update visualization with result
      if (visualizationContext && checkNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            checkNodeId,
            {
              status: 'completed',
              data: {
                result,
                message: 'No memory manager available',
                timestamp: Date.now()
              }
            }
          );
        } catch (error) {
          console.error('Error updating correction check visualization:', error);
        }
      }
      
      return result;
    }

    // Retrieve relevant past corrections
    const relevantMemories = await memoryManager.searchMemories({
      query: `${task.goal}`,
      filters: [{ field: 'category', value: 'CORRECTION' }],
      limit: 5
    });
    
    const relevantCorrections = relevantMemories
      .filter((mem) => isRelevantToCurrentTask(mem.content, task.goal))
      .map((mem) => mem.content);
    
    // If no relevant corrections, return empty result
    if (relevantCorrections.length === 0) {
      const result = {
        hasSimilarCorrections: false,
        suggestedAdjustments: [],
        relevantCorrections: []
      };
      
      // Update visualization with result
      if (visualizationContext && checkNodeId) {
        try {
          visualizationContext.visualizer.updateNode(
            visualizationContext.visualization,
            checkNodeId,
            {
              status: 'completed',
              data: {
                result,
                message: 'No relevant corrections found',
                timestamp: Date.now()
              }
            }
          );
        } catch (error) {
          console.error('Error updating correction check visualization:', error);
        }
      }
      
      return result;
    }
    
    // Analyze patterns and generate suggestions
    const suggestedAdjustments = analyzeCorrectionsForPatterns(relevantCorrections);
    
    const result = {
      hasSimilarCorrections: true,
      suggestedAdjustments,
      relevantCorrections
    };
    
    // Update visualization with result
    if (visualizationContext && checkNodeId) {
      try {
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          checkNodeId,
          {
            status: 'completed',
            data: {
              result,
              correctionCount: relevantCorrections.length,
              suggestedAdjustments,
              timestamp: Date.now()
            }
          }
        );
        
        // Create suggestion nodes for visualizing each adjustment
        if (suggestedAdjustments.length > 0) {
          // Use for loop instead of entries() to avoid iterator issues
          for (let i = 0; i < suggestedAdjustments.length; i++) {
            const adjustment = suggestedAdjustments[i];
            const adjustmentNodeId = visualizationContext.visualizer.addNode(
              visualizationContext.visualization,
              'correction_suggestion',
              `Suggestion ${i + 1}`,
              {
                suggestion: adjustment,
                timestamp: Date.now()
              },
              'completed'
            );
            
            // Connect suggestion to check node
            if (adjustmentNodeId) {
              visualizationContext.visualizer.addEdge(
                visualizationContext.visualization,
                checkNodeId,
                adjustmentNodeId,
                'suggested_adjustment'
              );
            }
          }
        }
      } catch (error) {
        console.error('Error updating correction check visualization:', error);
      }
    }
    
    return result;
  } catch (error) {
    // Update visualization with error if enabled
    if (visualizationContext && checkNodeId) {
      try {
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          checkNodeId,
          {
            status: 'error',
            data: {
              error: error instanceof Error ? error.message : String(error),
              timestamp: Date.now()
            }
          }
        );
      } catch (vizError) {
        console.error('Error updating correction check visualization with error:', vizError);
      }
    }
    
    // Re-throw the error
    throw error;
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
 * Updates a task plan based on a specific correction with visualization support
 * 
 * @param task The current task
 * @param correction The correction to apply
 * @param visualizationContext Optional visualization context
 * @returns The updated task with the correction applied
 */
export function applyCorrection(
  task: CollaborativeTask,
  correction: Correction,
  visualizationContext?: {
    visualization: ThinkingVisualization,
    visualizer: VisualizationService,
    parentNodeId?: string
  }
): CollaborativeTask {
  // Generate new requestId for correction application
  const requestId = generateRequestId();
  
  // Create visualization node if visualization is enabled
  let applicationNodeId: string | undefined;
  
  if (visualizationContext && 
      visualizationContext.visualization && 
      visualizationContext.visualizer) {
    try {
      // Create correction application visualization node
      applicationNodeId = visualizationContext.visualizer.addNode(
        visualizationContext.visualization,
        'correction_application',
        `Applying Correction to Task: ${task.goal}`,
        {
          taskId: task.id,
          taskGoal: task.goal,
          correctionText: correction.correctionText,
          category: correction.category || detectCorrectionCategory(correction),
          timestamp: Date.now(),
          requestId
        },
        'in_progress'
      );
      
      // Connect to parent node if specified
      if (visualizationContext.parentNodeId && applicationNodeId) {
        visualizationContext.visualizer.addEdge(
          visualizationContext.visualization,
          visualizationContext.parentNodeId,
          applicationNodeId,
          'applying_correction'
        );
      }
    } catch (error) {
      console.error('Error creating correction application visualization:', error);
    }
  }
  
  try {
    // Create corrected version of the task
    const updatedTask = {
      ...task,
      wasCorrected: true,
      correctionNotes: [
        ...(task.correctionNotes || []),
        correction.correctionText
      ],
      // Apply the correction to the task plan or specific sub-goals
      // This is a simplified implementation - in real system would parse correction more carefully
      subGoals: task.subGoals ? task.subGoals.map((sg: any) => ({
        ...sg,
        status: 'pending', // Reset status to allow re-execution
        result: undefined   // Clear any previous results
      })) : []
    };
    
    // Update visualization with result
    if (visualizationContext && applicationNodeId) {
      try {
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          applicationNodeId,
          {
            status: 'completed',
            data: {
              result: 'Correction applied successfully',
              taskId: task.id,
              updatedTask: {
                wasCorrected: updatedTask.wasCorrected,
                subGoalsReset: updatedTask.subGoals ? updatedTask.subGoals.length : 0
              },
              timestamp: Date.now()
            }
          }
        );
      } catch (error) {
        console.error('Error updating correction application visualization:', error);
      }
    }
    
    return updatedTask;
  } catch (error) {
    // Update visualization with error if enabled
    if (visualizationContext && applicationNodeId) {
      try {
        visualizationContext.visualizer.updateNode(
          visualizationContext.visualization,
          applicationNodeId,
          {
            status: 'error',
            data: {
              error: error instanceof Error ? error.message : String(error),
              timestamp: Date.now()
            }
          }
        );
      } catch (vizError) {
        console.error('Error updating correction application visualization with error:', vizError);
      }
    }
    
    // Re-throw the error to be handled by the caller
    throw error;
  }
}

export const CorrectionHandler = {
  handleCorrection,
  checkPastCorrections,
  applyCorrection
}; 