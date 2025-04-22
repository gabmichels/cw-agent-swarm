import fs from 'fs';
import path from 'path';

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