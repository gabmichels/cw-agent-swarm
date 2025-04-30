import { ChloeMemory } from '../memory';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { FeedbackInsight } from './feedbackIngestor';

/**
 * Interface for strategy adjustments based on feedback insights
 */
export interface StrategyAdjustment {
  adjustmentId: string;
  description: string;
  category: string;
  impact: "low" | "medium" | "high";
  appliedTo: string[]; // Task types, tools, behaviors, etc.
  date: string;
}

/**
 * Generates strategy adjustments based on feedback insights
 * 
 * @param memory ChloeMemory instance to access stored memories
 * @returns Promise<StrategyAdjustment[]> Array of strategy adjustments
 */
export async function generateStrategyAdjustments(
  memory: ChloeMemory
): Promise<StrategyAdjustment[]> {
  // Get recent feedback insights from memory
  const feedbackInsights = await getRecentFeedbackInsights(memory);
  
  // Filter for high and medium severity insights
  const significantInsights = feedbackInsights.filter(
    insight => insight.severity === 'high' || insight.severity === 'medium'
  );
  
  // Generate adjustments based on insights
  const adjustments = createAdjustmentsFromInsights(significantInsights);
  
  // Store adjustments in memory
  await storeAdjustmentsInMemory(adjustments, memory);
  
  return adjustments;
}

/**
 * Retrieves recent feedback insights from memory
 */
async function getRecentFeedbackInsights(
  memory: ChloeMemory
): Promise<FeedbackInsight[]> {
  try {
    // Query for memories with feedback_insight type
    const memories = await memory.getRelevantMemories(
      'FEEDBACK INSIGHTS',
      20
    );
    
    // Parse feedback insights from memory content
    const allInsights: FeedbackInsight[] = [];
    
    for (const mem of memories) {
      try {
        const lines = mem.content.split('\n\n');
        
        // Skip the header line
        for (let i = 1; i < lines.length; i++) {
          const insightBlock = lines[i].trim();
          if (!insightBlock) continue;
          
          const insightLines = insightBlock.split('\n');
          if (insightLines.length < 2) continue;
          
          // Extract data from the insight format
          // [1] HIGH - correction_tool_misuse
          // Incorrect tool usage requiring corrections in 2 tasks
          // Affected tasks: task_1234, task_3456
          const headerMatch = insightLines[0].match(/\[\d+\]\s+(\w+)\s+-\s+(.+)$/);
          
          if (headerMatch) {
            const severity = headerMatch[1].toLowerCase() as "low" | "medium" | "high";
            const category = headerMatch[2];
            const description = insightLines[1];
            
            // Extract affected tasks if present
            let affectedTasks: string[] = [];
            if (insightLines.length > 2 && insightLines[2].startsWith('Affected tasks:')) {
              affectedTasks = insightLines[2]
                .replace('Affected tasks:', '')
                .split(',')
                .map(task => task.trim());
            }
            
            allInsights.push({
              category,
              description,
              affectedTasks,
              severity
            });
          }
        }
      } catch (error) {
        console.warn('Error parsing feedback insight memory:', error);
      }
    }
    
    return allInsights;
  } catch (error) {
    console.error('Error retrieving feedback insights:', error);
    return [];
  }
}

/**
 * Creates strategy adjustments based on feedback insights
 */
function createAdjustmentsFromInsights(
  insights: FeedbackInsight[]
): StrategyAdjustment[] {
  if (!insights.length) return [];
  
  const adjustments: StrategyAdjustment[] = [];
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  for (const insight of insights) {
    // Determine the category based on insight type
    const insightType = insight.category.split('_')[0];
    const specificArea = insight.category.split('_')[1] || '';
    
    // Map insight categories to strategy categories
    let category: string;
    let appliedTo: string[] = [];
    
    // Handle special case for clarifications_needed
    if (insight.category === 'clarifications_needed') {
      category = 'communication';
      appliedTo = ['user_interaction', 'requirement_gathering'];
    } else {
      switch (insightType) {
        case 'correction':
          category = 'execution';
          if (specificArea === 'tool_misuse') {
            category = 'tooling';
            appliedTo = ['tool_selection', 'tool_usage'];
          } else if (specificArea === 'missed_context') {
            category = 'planning';
            appliedTo = ['context_awareness', 'memory_retrieval'];
          } else if (specificArea === 'misunderstanding') {
            category = 'communication';
            appliedTo = ['user_requests', 'clarification'];
          } else if (specificArea === 'wrong_approach') {
            category = 'planning';
            appliedTo = ['solution_design', 'approach_selection'];
          } else {
            appliedTo = ['task_execution'];
          }
          break;
          
        case 'corrections':
          category = 'execution';
          appliedTo = ['task_execution', 'error_prevention'];
          break;
          
        case 'clarifications':
          category = 'communication';
          appliedTo = ['user_interaction', 'requirement_gathering'];
          break;
          
        case 'task':
        case 'performance':
          category = 'planning';
          appliedTo = ['task_management', 'goal_setting'];
          break;
          
        case 'reflection':
          category = 'learning';
          if (specificArea) {
            appliedTo = [specificArea];
          } else {
            appliedTo = ['self_improvement'];
          }
          break;
          
        default:
          category = 'general';
          appliedTo = ['behavior', 'process'];
      }
    }
    
    // Create adjustment ID
    const adjustmentId = `adj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Generate adjustment description based on the insight
    const description = generateAdjustmentDescription(insight, category);
    
    // Map severity to impact (high severity = high impact)
    const impact = insight.severity;
    
    // Add affected tasks to appliedTo if available
    if (insight.affectedTasks && insight.affectedTasks.length > 0) {
      appliedTo.push('tasks:' + insight.affectedTasks.join(','));
    }
    
    adjustments.push({
      adjustmentId,
      description,
      category,
      impact,
      appliedTo,
      date: currentDate
    });
  }
  
  return adjustments;
}

/**
 * Generates appropriate strategy adjustment description
 */
function generateAdjustmentDescription(
  insight: FeedbackInsight,
  category: string
): string {
  // Extract severity and category info
  const severity = insight.severity;
  const insightType = insight.category.split('_')[0];
  const specificArea = insight.category.split('_')[1] || '';
  
  // Common patterns in the description
  const frequencyPattern = /(\d+)\s+tasks/;
  const frequencyMatch = insight.description.match(frequencyPattern);
  const frequency = frequencyMatch ? parseInt(frequencyMatch[1]) : 0;
  
  // Generate appropriate adjustment based on insight type and category
  switch (category) {
    case 'tooling':
      return `Implement additional verification steps before using tools related to ${specificArea}` +
             `${frequency > 2 ? ' to address recurring issues' : ''}`;
      
    case 'planning':
      return `Enhance planning phase with explicit ${specificArea.replace(/_/g, ' ')} check` +
             `${severity === 'high' ? ' as a critical priority' : ''}`;
      
    case 'communication':
      // Check specifically for clarifications_needed
      if (insight.category === 'clarifications_needed') {
        return `Add proactive clarification steps for requirements gathering` +
               `${severity === 'high' ? ' to prevent misunderstandings' : ''}`;
      }
      return `Add proactive clarification steps for potentially ambiguous ${specificArea || 'requests'}` +
             `${severity === 'high' ? ' to prevent misunderstandings' : ''}`;
      
    case 'execution':
      return `Implement incremental validation steps during task execution` +
             `${frequency > 2 ? ' to detect issues earlier' : ''}`;
      
    case 'learning':
      return `Prioritize learning about ${specificArea || 'general knowledge areas'} identified in reflections`;
      
    default:
      // Extract key terms from the insight description
      const keyTerms = insight.description
        .replace(/Recurring issue:|requiring corrections in|mentioned in|average score:/g, '')
        .replace(/\d+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      return `Adjust behavior to address: ${keyTerms}`;
  }
}

/**
 * Stores strategy adjustments in memory
 */
async function storeAdjustmentsInMemory(
  adjustments: StrategyAdjustment[],
  memory: ChloeMemory
): Promise<void> {
  if (!adjustments.length) {
    console.log('No strategy adjustments to store in memory');
    return;
  }
  
  try {
    // Format adjustments for memory storage
    const formattedAdjustments = formatAdjustmentsForMemory(adjustments);
    
    // Store in memory with high importance
    await memory.addMemory(
      formattedAdjustments,
      'strategy_adjustment',
      ImportanceLevel.HIGH,
      MemorySource.SYSTEM,
      `Generated ${adjustments.length} strategy adjustments`,
      ['strategy', 'learning', 'self_improvement']
    );
    
    console.log(`Stored ${adjustments.length} strategy adjustments in memory`);
  } catch (error) {
    console.error('Failed to store strategy adjustments in memory:', error);
  }
}

/**
 * Formats strategy adjustments for memory storage
 */
function formatAdjustmentsForMemory(adjustments: StrategyAdjustment[]): string {
  const timestamp = new Date().toISOString();
  let content = `STRATEGY ADJUSTMENTS - ${timestamp}\n\n`;
  
  for (let i = 0; i < adjustments.length; i++) {
    const adjustment = adjustments[i];
    content += `[${i + 1}] ${adjustment.impact.toUpperCase()} - ${adjustment.category}\n`;
    content += `ID: ${adjustment.adjustmentId}\n`;
    content += `Description: ${adjustment.description}\n`;
    content += `Applied to: ${adjustment.appliedTo.join(', ')}\n`;
    content += `Date: ${adjustment.date}\n\n`;
  }
  
  return content;
}

/**
 * Apply strategy adjustments to agent behavior
 * This is a placeholder for where the adjustments would actually modify behavior
 */
export function applyStrategyAdjustments(
  adjustments: StrategyAdjustment[]
): void {
  // This would be implemented to actually modify Chloe's behavior
  // For example:
  // - Update planning templates
  // - Modify tool selection logic
  // - Adjust confidence thresholds
  // - Change communication patterns
  
  // For now, we just log that we would apply these
  for (const adjustment of adjustments) {
    console.log(`Would apply ${adjustment.impact} impact adjustment to ${adjustment.category}: ${adjustment.description}`);
  }
}

// Testing data and functions
const sampleInsights: FeedbackInsight[] = [
  {
    category: 'correction_tool_misuse',
    description: 'Incorrect tool usage requiring corrections in 3 tasks',
    affectedTasks: ['task_1234', 'task_5678', 'task_9012'],
    severity: 'high'
  },
  {
    category: 'clarifications_needed',
    description: 'Recurring issue: Required clarification in 2 tasks, average score: 65.0',
    affectedTasks: ['task_2345', 'task_6789'],
    severity: 'medium'
  },
  {
    category: 'reflection_context',
    description: 'Recurring theme in reflections: "context" mentioned in 2 reflections',
    affectedTasks: [],
    severity: 'low'
  }
];

/**
 * Test function for generating strategy adjustments from sample data
 */
export function testGenerateStrategyAdjustments(): StrategyAdjustment[] {
  // Sample insights to test with
  const testInsights: FeedbackInsight[] = [
    {
      category: 'correction_tool_misuse',
      description: 'Incorrect tool usage requiring corrections in 3 tasks',
      affectedTasks: ['task_1234', 'task_5678', 'task_9012'],
      severity: 'high'
    },
    {
      category: 'clarifications_needed',
      description: 'Recurring issue: Required clarification in 2 tasks, average score: 65.0',
      affectedTasks: ['task_2345', 'task_6789'],
      severity: 'medium'
    }
  ];
  
  // Only use high and medium severity insights
  const significantInsights = testInsights.filter(
    insight => insight.severity === 'high' || insight.severity === 'medium'
  );
  
  return createAdjustmentsFromInsights(significantInsights);
} 