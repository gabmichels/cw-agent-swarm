/**
 * SchedulerApiEndpoints.ts
 * 
 * This module defines the API endpoints for the scheduler system,
 * providing a RESTful interface for managing scheduled tasks, batches,
 * and scheduler configuration.
 */

// Define Express types locally to avoid dependency issues
interface Request {
  params: any;
  query: any;
  body: any;
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
}

interface Router {
  get: (path: string, handler: (req: Request, res: Response) => Promise<void>) => void;
  post: (path: string, handler: (req: Request, res: Response) => Promise<void>) => void;
  put: (path: string, handler: (req: Request, res: Response) => Promise<void>) => void;
  delete: (path: string, handler: (req: Request, res: Response) => Promise<void>) => void;
}

type ExpressType = {
  Router: () => Router;
};

// Mock Express router function
const createRouter = (): Router => {
  return {
    get: (path, handler) => {},
    post: (path, handler) => {},
    put: (path, handler) => {},
    delete: (path, handler) => {}
  };
};

import { Task, TaskStatus } from '../../../../lib/scheduler/models/Task.model';
import { TaskCreationOptions } from '../../../../agents/shared/base/managers/SchedulerManager.interface';
import { ModularSchedulerManager } from '../../../../lib/scheduler/implementations/ModularSchedulerManager';
import { TaskFilter } from '../../../../lib/scheduler/models/TaskFilter.model';

/**
 * Create and configure the scheduler API router
 * 
 * @param schedulerManager The scheduler manager instance
 * @returns Configured Express router
 */
export function createSchedulerApiRouter(schedulerManager: ModularSchedulerManager): Router {
  const router = createRouter();
  
  /**
   * Error handling middleware for API endpoints
   */
  const asyncHandler = (fn: (req: Request, res: Response) => Promise<void>) => {
    return async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (error) {
        console.error('Scheduler API error:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };
  };
  
  /**
   * GET /scheduler/status
   * Get scheduler status
   */
  router.get('/status', asyncHandler(async (req, res) => {
    const status = await schedulerManager.getStatus();
    const health = await schedulerManager.getHealth();
    
    res.json({
      success: true,
      status,
      health
    });
  }));
  
  /**
   * POST /scheduler/tasks
   * Create a new scheduled task
   */
  router.post('/tasks', asyncHandler(async (req, res) => {
    const taskOptions: Partial<Task> = {
      ...req.body,
      status: TaskStatus.PENDING
    };
    
    try {
      const task = await schedulerManager.createTask(taskOptions as Task);
      res.status(201).json({
        success: true,
        task
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task'
      });
    }
  }));
  
  /**
   * GET /scheduler/tasks
   * List scheduled tasks with optional filtering
   */
  router.get('/tasks', asyncHandler(async (req, res) => {
    const query = req.query;
    
    // Parse filtering options
    const filter: TaskFilter = {};
    
    if (query.status) {
      filter.status = Array.isArray(query.status) 
        ? query.status as TaskStatus[] 
        : [query.status as TaskStatus];
    }
    
    if (query.type && typeof query.type === 'string') {
      filter.metadata = {
        ...filter.metadata,
        type: query.type
      };
    }
    
    if (query.priority) {
      filter.priority = Number(query.priority);
    }
    
    if (query.tags && typeof query.tags === 'string') {
      filter.metadata = {
        ...filter.metadata,
        tags: Array.isArray(query.tags) 
          ? query.tags
          : [query.tags]
      };
    }
    
    if (query.from) {
      filter.createdAfter = new Date(query.from as string);
    }
    
    if (query.to) {
      filter.createdBefore = new Date(query.to as string);
    }
    
    // These are not part of the filter but can be used for pagination
    const limit = query.limit ? Number(query.limit) : undefined;
    const offset = query.offset ? Number(query.offset) : undefined;
    
    const tasks = await schedulerManager.findTasks(filter);
    
    // Apply pagination manually if needed
    const paginatedTasks = limit !== undefined && offset !== undefined
      ? tasks.slice(offset, offset + limit)
      : tasks;
    
    res.json({
      success: true,
      count: paginatedTasks.length,
      tasks: paginatedTasks
    });
  }));
  
  /**
   * GET /scheduler/tasks/:taskId
   * Get a specific task
   */
  router.get('/tasks/:taskId', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const task = await schedulerManager.getTask(taskId);
    
    if (task) {
      res.json({
        success: true,
        task
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
  }));
  
  /**
   * PUT /scheduler/tasks/:taskId
   * Update a task
   */
  router.put('/tasks/:taskId', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const updates = req.body;
    
    // Get the existing task first
    const existingTask = await schedulerManager.getTask(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    // Create updated task by merging
    const updatedTask = {
      ...existingTask,
      ...updates,
      id: taskId // Ensure ID doesn't change
    };
    
    // Update the task
    const result = await schedulerManager.updateTask(updatedTask);
    
    if (result) {
      res.json({
        success: true,
        task: result
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
  }));
  
  /**
   * DELETE /scheduler/tasks/:taskId
   * Delete a task
   */
  router.delete('/tasks/:taskId', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const deleted = await schedulerManager.deleteTask(taskId);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Task deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
  }));
  
  /**
   * PUT /scheduler/tasks/:taskId/execute
   * Execute a task
   */
  router.put('/tasks/:taskId/execute', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const result = await schedulerManager.executeTaskNow(taskId);
    
    if (result.successful) {
      const task = await schedulerManager.getTask(taskId);
      res.json({
        success: true,
        task
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error ? result.error.message : 'Failed to execute task'
      });
    }
  }));
  
  /**
   * POST /scheduler/tasks/:taskId/cancel
   * Cancel a task
   */
  router.post('/tasks/:taskId/cancel', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const deleted = await schedulerManager.deleteTask(taskId);
    
    if (deleted) {
      res.json({
        success: true,
        message: 'Task cancelled'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Task could not be cancelled'
      });
    }
  }));
  
  /**
   * PUT /scheduler/tasks/:taskId/retry
   * Retry a failed task
   */
  router.put('/tasks/:taskId/retry', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    
    // Get the task first to check if it's in a failed state
    const task = await schedulerManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    if (task.status !== TaskStatus.FAILED) {
      return res.status(400).json({
        success: false,
        error: 'Only failed tasks can be retried'
      });
    }
    
    // Execute the task again
    const result = await schedulerManager.executeTaskNow(taskId);
    
    if (result.successful) {
      const updatedTask = await schedulerManager.getTask(taskId);
      res.json({
        success: true,
        task: updatedTask
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error ? result.error.message : 'Failed to retry task'
      });
    }
  }));
  
  /**
   * GET /scheduler/due-tasks
   * Get tasks that are due for execution
   */
  router.get('/due-tasks', asyncHandler(async (req, res) => {
    // Find pending tasks that are scheduled for execution
    const dueTasks = await schedulerManager.findTasks({
      status: TaskStatus.PENDING,
      // Use custom filtering for scheduledTime
      // This is a workaround since scheduledBefore isn't part of TaskFilter
    });
    
    // Filter tasks that are scheduled for execution and are due
    const filteredDueTasks = dueTasks.filter(task => 
      task.scheduledTime && task.scheduledTime <= new Date()
    );
    
    res.json({
      success: true,
      count: filteredDueTasks.length,
      tasks: filteredDueTasks
    });
  }));
  
  /**
   * GET /scheduler/metrics
   * Get scheduler metrics
   */
  router.get('/metrics', asyncHandler(async (req, res) => {
    const metrics = await schedulerManager.getMetrics();
    
    res.json({
      success: true,
      metrics
    });
  }));
  
  return router;
} 