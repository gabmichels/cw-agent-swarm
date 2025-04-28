import fs from 'fs';
import path from 'path';
import { CognitiveMemory } from '../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../lib/memory/src/knowledge-graph';
import { ChloeAgent } from './core/agent';

export interface Task {
  id: string;
  content: string;
  created: Date;
  completed?: Date;
  status: 'pending' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  userInitiated?: boolean;
  category?: string;
  notes?: string;
}

export interface TaskManagerConfig {
  dataDir?: string;
  taskLogFile?: string;
}

/**
 * Class to manage Chloe's tasks and logging
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private dataDir: string;
  private taskLogFile: string;
  private initialized: boolean = false;

  constructor(config?: TaskManagerConfig) {
    // Set default data directory and log file
    this.dataDir = config?.dataDir || path.join(process.cwd(), 'data', 'tasks');
    this.taskLogFile = config?.taskLogFile || path.join(this.dataDir, 'task-log.json');
  }

  /**
   * Initialize the task manager and load existing tasks
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing task manager...');
      
      // Create directory if it doesn't exist
      await this.ensureDirectoryExists(this.dataDir);
      
      // Load existing tasks from log file if it exists
      if (fs.existsSync(this.taskLogFile)) {
        const taskData = fs.readFileSync(this.taskLogFile, 'utf-8');
        const parsedTasks = JSON.parse(taskData);
        
        // Convert data to Task objects and restore dates
        parsedTasks.forEach((task: any) => {
          task.created = new Date(task.created);
          if (task.completed) task.completed = new Date(task.completed);
          this.tasks.set(task.id, task);
        });
        
        console.log(`Loaded ${this.tasks.size} tasks from task log`);
      } else {
        // Create empty task log
        await this.saveTasks();
        console.log('Created new task log file');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing task manager:', error);
      return false;
    }
  }

  /**
   * Save tasks to the log file
   */
  private async saveTasks(): Promise<void> {
    try {
      // Convert Map to array for JSON serialization
      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync(this.taskLogFile, JSON.stringify(tasksArray, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  /**
   * Create a new task
   */
  async createTask(
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    category?: string,
    userInitiated: boolean = false
  ): Promise<Task> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTask: Task = {
      id: taskId,
      content,
      created: new Date(),
      status: 'pending',
      priority,
      userInitiated,
      category
    };
    
    this.tasks.set(taskId, newTask);
    await this.saveTasks();
    
    console.log(`Created new task: ${taskId} - ${content}`);
    return newTask;
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, notes?: string): Promise<Task | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return null;
    }
    
    task.status = 'completed';
    task.completed = new Date();
    if (notes) task.notes = notes;
    
    await this.saveTasks();
    console.log(`Completed task: ${taskId} - ${task.content}`);
    return task;
  }

  /**
   * Mark a task as failed
   */
  async failTask(taskId: string, notes?: string): Promise<Task | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const task = this.tasks.get(taskId);
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      return null;
    }
    
    task.status = 'failed';
    task.completed = new Date();
    if (notes) task.notes = notes;
    
    await this.saveTasks();
    console.log(`Failed task: ${taskId} - ${task.content}`);
    return task;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get pending tasks
   */
  getPendingTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === 'pending');
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: 'pending' | 'completed' | 'failed'): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by priority
   */
  getTasksByPriority(priority: 'low' | 'medium' | 'high'): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.priority === priority);
  }

  /**
   * Get tasks by category
   */
  getTasksByCategory(category: string): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.category === category);
  }

  /**
   * Get user-initiated tasks
   */
  getUserInitiatedTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.userInitiated);
  }

  /**
   * Create default directory structure
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }
}

/**
 * Run memory consolidation process
 */
export async function runMemoryConsolidation(agent: ChloeAgent): Promise<boolean> {
  console.log('📚 Starting memory consolidation process...');
  const startTime = Date.now();

  try {
    // Get cognitive memory and knowledge graph from agent
    const cognitiveMemory = agent.getCognitiveMemory();
    const knowledgeGraph = agent.getKnowledgeGraph();
    
    if (!cognitiveMemory || !knowledgeGraph) {
      console.error('❌ Cognitive memory systems are not initialized');
      return false;
    }
    
    // Run memory consolidation
    console.log('🧠 Running memory decay and consolidation...');
    const consolidatedCount = await cognitiveMemory.consolidateMemories();
    console.log(`✅ Processed ${consolidatedCount} memories for consolidation`);
    
    // Find concept nodes in knowledge graph
    console.log('🔍 Finding important concepts in knowledge graph...');
    const conceptNodes = await knowledgeGraph.findNodes('', ['concept'], 20);
    console.log(`📊 Found ${conceptNodes.length} concept nodes`);
    
    // Infer new connections for top concept nodes
    console.log('🔄 Inferring new connections in knowledge graph...');
    let totalInferences = 0;
    
    for (const node of conceptNodes) {
      const inferences = await knowledgeGraph.inferNewEdges(node.id, 0.7);
      
      if (inferences.length > 0) {
        console.log(`🔗 Found ${inferences.length} potential new connections for "${node.label}"`);
        
        // Add high confidence inferences automatically
        for (const inference of inferences) {
          if (inference.confidence > 0.8) {
            await knowledgeGraph.addEdge(
              inference.source,
              inference.target,
              inference.type,
              inference.confidence
            );
            
            totalInferences++;
          }
        }
      }
    }
    
    console.log(`✅ Added ${totalInferences} new inferred connections to knowledge graph`);
    
    // Calculate completion time
    const duration = (Date.now() - startTime) / 1000;
    console.log(`🎉 Memory consolidation complete in ${duration.toFixed(2)} seconds`);
    
    return true;
  } catch (error) {
    console.error('❌ Error during memory consolidation:', error);
    return false;
  }
} 