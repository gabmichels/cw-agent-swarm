/**
 * Autonomous Scheduler for Chloe
 * Implements self-initiated maintenance, improvement, and knowledge optimization routines
 */

import { ChloeScheduler } from './chloeScheduler';
import { ChloeAgent } from '../core/agent';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { KnowledgeGraphManager } from '../knowledge/graphManager';

// Interfaces to handle memory types safely
interface BaseMemoryItem {
  tags?: string[];
}

interface TimestampedMemory extends BaseMemoryItem {
  timestamp: string;
}

interface DateMemory extends BaseMemoryItem {
  created: Date;
}

type MemoryItem = TimestampedMemory | DateMemory;

// Temporary placeholder for KnowledgeOptimizer until the real implementation is available
class KnowledgeOptimizer {
  constructor(private graphManager: KnowledgeGraphManager) {}
  
  async pruneStaleNodes(): Promise<void> {
    console.log('Pruning stale nodes');
  }
  
  async discoverNewRelationships(): Promise<void> {
    console.log('Discovering new relationships');
  }
  
  async extractGraphInsights(): Promise<string[]> {
    return ['Sample insight'];
  }
  
  async checkGraphHealth(): Promise<{needsOptimization: boolean, reason: string}> {
    return { needsOptimization: false, reason: 'Graph is healthy' };
  }
}

// Interface for planned autonomous tasks
export interface PlannedTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTimeMinutes: number;
  tags: string[];
  triggerReason: string;
}

/**
 * Run autonomous maintenance routines for Chloe
 * This is triggered weekly or when Chloe is idle
 */
export async function runAutonomousMaintenance(): Promise<void> {
  const scheduler = new ChloeScheduler();
  
  if (!scheduler.isInitialized()) {
    await scheduler.initialize();
  }
  
  const agent = scheduler.getAgent();
  const memory = agent.getMemory ? agent.getMemory() : null;
  const taskLogger = agent.getTaskLogger ? agent.getTaskLogger() : null;
  
  if (!memory || !taskLogger) {
    console.error('Memory or TaskLogger not available');
    return;
  }
  
  try {
    taskLogger.logAction("Starting autonomous maintenance cycle", {
      timestamp: new Date().toISOString(),
      triggerType: "scheduled"
    });
    
    // 1. Run memory consolidation and cleanup
    if ('runMemoryConsolidation' in memory && typeof memory.runMemoryConsolidation === 'function') {
      await memory.runMemoryConsolidation();
    }
    
    // 2. Run knowledge graph optimization
    const graphManager = new KnowledgeGraphManager();
    const knowledgeOptimizer = new KnowledgeOptimizer(graphManager);
    
    await knowledgeOptimizer.pruneStaleNodes();
    await knowledgeOptimizer.discoverNewRelationships();
    const insights = await knowledgeOptimizer.extractGraphInsights();
    
    // 3. Log maintenance summary
    const memoriesProcessed = ('getStats' in memory && typeof memory.getStats === 'function') ? 
      (await memory.getStats()).messageCount : 0;
    
    const maintenanceSummary = `
      Autonomous Maintenance Completed:
      - Memory consolidation: ${memoriesProcessed} memories processed
      - Knowledge optimization: 
        - Pruned stale nodes
        - Discovered new relationships
        - Generated ${insights.length} insights
    `;
    
    // Store maintenance summary in memory
    await memory.addMemory(
      maintenanceSummary,
      "maintenance_log",
      ImportanceLevel.MEDIUM,
      MemorySource.SYSTEM,
      `Autonomous maintenance for ${new Date().toISOString().split('T')[0]}`,
      ["maintenance", "autonomous", "self_improvement"]
    );
    
    // Store insights separately as important discoveries
    if (insights.length > 0) {
      await memory.addMemory(
        `Knowledge Graph Insights:\n${insights.join('\n')}`,
        "knowledge_insight",
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Knowledge insights from ${new Date().toISOString().split('T')[0]}`,
        ["knowledge", "insight", "autonomous"]
      );
    }
    
    // Notify about completion
    agent.notify("🧹 Autonomous maintenance cycle completed successfully");
    
    taskLogger.logAction("Completed autonomous maintenance cycle", {
      timestamp: new Date().toISOString(),
      results: {
        memoriesProcessed: memoriesProcessed,
        insightsGenerated: insights.length
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (taskLogger) {
      taskLogger.logAction("Error in autonomous maintenance cycle", {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store error in memory
    if (memory) {
      await memory.addMemory(
        `Error in autonomous maintenance: ${errorMessage}`,
        "error_log",
        ImportanceLevel.HIGH,
        MemorySource.SYSTEM,
        `Maintenance failure on ${new Date().toISOString().split('T')[0]}`,
        ["error", "maintenance", "autonomous"]
      );
    }
    
    // Send notification about error
    agent.notify("❌ Error in autonomous maintenance: " + errorMessage);
    
    throw error;
  }
}

/**
 * Check for self-triggered tasks based on Chloe's state and context
 * This proactively identifies tasks that should be initiated autonomously
 */
export async function checkForSelfTriggeredTasks(): Promise<PlannedTask[]> {
  const scheduler = new ChloeScheduler();
  
  if (!scheduler.isInitialized()) {
    await scheduler.initialize();
  }
  
  const agent = scheduler.getAgent();
  const memory = agent.getMemory ? agent.getMemory() : null;
  const taskLogger = agent.getTaskLogger ? agent.getTaskLogger() : null;
  
  if (!memory || !taskLogger) {
    console.error('Memory or TaskLogger not available');
    return [];
  }
  
  const plannedTasks: PlannedTask[] = [];
  
  try {
    taskLogger.logAction("Checking for self-triggered tasks", {
      timestamp: new Date().toISOString()
    });
    
    // 1. Check for missed maintenance cycles
    // Use getRelevantMemories as fallback if searchMemories doesn't exist
    let maintenanceMemories: any[] = [];
    if ('getRelevantMemories' in memory && typeof memory.getRelevantMemories === 'function') {
      maintenanceMemories = await memory.getRelevantMemories("maintenance_log", 5);
    }
      
    const lastMaintenanceDate = maintenanceMemories.length > 0 
      ? new Date(getTimestampFromMemory(maintenanceMemories[0]))
      : new Date(0); // Default to epoch if no maintenance has been logged
      
    const daysSinceLastMaintenance = Math.floor((Date.now() - lastMaintenanceDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLastMaintenance > 7) {
      plannedTasks.push({
        id: `maintenance-${Date.now()}`,
        title: "Run system maintenance cycle",
        description: "Perform memory consolidation and knowledge graph optimization",
        priority: "high",
        estimatedTimeMinutes: 30,
        tags: ["maintenance", "autonomous", "system"],
        triggerReason: `Last maintenance cycle was ${daysSinceLastMaintenance} days ago`
      });
    }
    
    // 2. Check for knowledge graph health
    const graphManager = new KnowledgeGraphManager();
    const knowledgeOptimizer = new KnowledgeOptimizer(graphManager);
    const graphStatus = await knowledgeOptimizer.checkGraphHealth();
    
    if (graphStatus.needsOptimization) {
      plannedTasks.push({
        id: `graph-optimize-${Date.now()}`,
        title: "Optimize knowledge graph",
        description: "Prune stale nodes and discover new relationships in the knowledge graph",
        priority: "medium",
        estimatedTimeMinutes: 20,
        tags: ["knowledge", "autonomous", "optimization"],
        triggerReason: graphStatus.reason
      });
    }
    
    // 3. Check for strategic opportunities based on recent memories
    // Use getRelevantMemories instead of searchMemories
    let recentHighImportanceMemories: any[] = [];
    if ('getRelevantMemories' in memory && typeof memory.getRelevantMemories === 'function') {
      recentHighImportanceMemories = await memory.getRelevantMemories("importance:high", 10);
    }
    
    // Analyze patterns in recent memories to identify strategic opportunities
    // This is a simplified logic - in production this would use more sophisticated analysis
    const topics = new Map<string, number>();
    
    for (const memoryItem of recentHighImportanceMemories) {
      const memoryTags = memoryItem.tags || [];
      for (const tag of memoryTags) {
        topics.set(tag, (topics.get(tag) || 0) + 1);
      }
    }
    
    // Find topics that appear frequently but don't have related tasks
    // Fix for Map iterator
    const topicEntries = Array.from(topics.entries());
    for (const [topic, count] of topicEntries) {
      if (count >= 3) {
        // This topic appears frequently in important memories
        
        // Check if there are already tasks for this topic
        const getTasksWithTag = agent.getTasksWithTag || (() => Promise.resolve([]));
        const topicTasks = await getTasksWithTag(topic);
        
        if (topicTasks.length === 0) {
          // No tasks exist for this topic, suggest creating one
          plannedTasks.push({
            id: `strategic-${topic}-${Date.now()}`,
            title: `Evaluate strategic opportunities for "${topic}"`,
            description: `This topic has appeared frequently in recent important memories but has no associated tasks`,
            priority: "medium",
            estimatedTimeMinutes: 45,
            tags: ["strategic", "autonomous", topic],
            triggerReason: `Topic "${topic}" appears ${count} times in recent important memories`
          });
        }
      }
    }
    
    // Log the planned tasks
    taskLogger.logAction("Completed self-triggered task check", {
      timestamp: new Date().toISOString(),
      plannedTasksCount: plannedTasks.length,
      plannedTasks: plannedTasks.map(task => task.title)
    });
    
    return plannedTasks;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (taskLogger) {
      taskLogger.logAction("Error checking for self-triggered tasks", {
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
    
    // Store error in memory
    if (memory) {
      await memory.addMemory(
        `Error checking for self-triggered tasks: ${errorMessage}`,
        "error_log",
        ImportanceLevel.MEDIUM,
        MemorySource.SYSTEM,
        `Self-triggered task check failure on ${new Date().toISOString().split('T')[0]}`,
        ["error", "autonomous", "task_planning"]
      );
    }
    
    // Empty array as fallback
    return [];
  }
}

/**
 * Helper function to get timestamp from various memory formats
 */
function getTimestampFromMemory(memory: any): string {
  if (!memory) return new Date(0).toISOString();
  
  // Handle different memory formats
  if (memory.timestamp) return memory.timestamp;
  if (memory.created) return memory.created instanceof Date ? 
    memory.created.toISOString() : memory.created;
  
  // Return current time as fallback
  return new Date().toISOString();
}

/**
 * Register autonomy hooks with the ChloeScheduler
 * This adds self-maintenance capabilities to Chloe
 */
export function enableAutonomousMode(scheduler: ChloeScheduler): void {
  // Check if the scheduler has registerWeeklyTask method
  if (typeof scheduler.registerWeeklyTask !== 'function') {
    console.warn('registerWeeklyTask method not available on scheduler');
    return;
  }
  
  // Check if the scheduler has registerDailyTask method
  if (typeof scheduler.registerDailyTask !== 'function') {
    console.warn('registerDailyTask method not available on scheduler');
    return;
  }
  
  // Setup maintenance mode to run weekly at 3 AM Sunday
  scheduler.registerWeeklyTask(
    "autonomousMaintenance",
    "sunday",
    "03:00",
    async () => {
      await runAutonomousMaintenance();
    },
    ["maintenance", "autonomous"]
  );
  
  // Setup daily task check at 7 AM
  scheduler.registerDailyTask(
    "selfTriggeredTaskCheck",
    "07:00",
    async () => {
      const tasks = await checkForSelfTriggeredTasks();
      if (tasks.length > 0) {
        const agent = scheduler.getAgent();
        
        // Get task logger if available
        const taskLogger = agent.getTaskLogger ? agent.getTaskLogger() : null;
        
        // Log the self-triggered tasks
        if (taskLogger) {
          taskLogger.logAction("Found self-triggered tasks", {
            timestamp: new Date().toISOString(),
            taskCount: tasks.length,
            tasks: tasks.map(t => ({ id: t.id, title: t.title }))
          });
        }
        
        // Add tasks to queue if the method exists
        const queueTask = agent.queueTask || (() => Promise.resolve());
        for (const task of tasks) {
          await queueTask({
            id: task.id,
            goal: task.title,
            description: task.description,
            priority: task.priority,
            tags: task.tags,
            metadata: {
              estimatedTimeMinutes: task.estimatedTimeMinutes,
              triggerReason: task.triggerReason,
              source: "autonomous"
            }
          });
        }
        
        // Notify about the self-triggered tasks
        agent.notify(`🤖 Added ${tasks.length} self-triggered task(s) to the queue`);
      }
    },
    ["autonomous", "task_planning"]
  );
} 