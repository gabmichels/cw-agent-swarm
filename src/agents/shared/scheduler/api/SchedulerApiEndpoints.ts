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

import { ScheduledTask, TaskCreationOptions, TaskBatch } from '../../../../lib/agents/base/managers/SchedulerManager';
import { DefaultSchedulerManager } from '../../../../lib/agents/implementations/managers/DefaultSchedulerManager';

/**
 * Create and configure the scheduler API router
 * 
 * @param schedulerManager The scheduler manager instance
 * @returns Configured Express router
 */
export function createSchedulerApiRouter(schedulerManager: DefaultSchedulerManager): Router {
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
    const taskOptions: TaskCreationOptions = req.body;
    const result = await schedulerManager.createTask(taskOptions);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        task: result.task
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to create task'
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
    const options: any = {};
    
    if (query.status) {
      options.status = Array.isArray(query.status) 
        ? query.status as ScheduledTask['status'][] 
        : [query.status as ScheduledTask['status']];
    }
    
    if (query.type) {
      options.type = Array.isArray(query.type) 
        ? query.type as string[] 
        : [query.type as string];
    }
    
    if (query.priority) {
      options.priority = Number(query.priority);
    }
    
    if (query.minPriority) {
      options.minPriority = Number(query.minPriority);
    }
    
    if (query.tags) {
      options.tags = Array.isArray(query.tags) 
        ? query.tags as string[] 
        : [query.tags as string];
    }
    
    if (query.from) {
      options.from = new Date(query.from as string);
    }
    
    if (query.to) {
      options.to = new Date(query.to as string);
    }
    
    if (query.limit) {
      options.limit = Number(query.limit);
    }
    
    if (query.offset) {
      options.offset = Number(query.offset);
    }
    
    if (query.sortBy) {
      options.sortBy = query.sortBy as 'priority' | 'createdAt' | 'updatedAt';
    }
    
    if (query.sortDirection) {
      options.sortDirection = query.sortDirection as 'asc' | 'desc';
    }
    
    const tasks = await schedulerManager.listTasks(options);
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
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
    
    const updatedTask = await schedulerManager.updateTask(taskId, updates);
    
    if (updatedTask) {
      res.json({
        success: true,
        task: updatedTask
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
    const result = await schedulerManager.executeTask(taskId);
    
    if (result.success) {
      const task = await schedulerManager.getTask(taskId);
      res.json({
        success: true,
        task
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error ?? 'Failed to execute task'
      });
    }
  }));
  
  /**
   * POST /scheduler/tasks/:taskId/cancel
   * Cancel a task
   */
  router.post('/tasks/:taskId/cancel', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const cancelled = await schedulerManager.cancelTask(taskId);
    
    if (cancelled) {
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
    const result = await schedulerManager.retryTask(taskId);
    
    if (result.success) {
      const task = await schedulerManager.getTask(taskId);
      res.json({
        success: true,
        task
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error ?? 'Failed to retry task'
      });
    }
  }));
  
  /**
   * GET /scheduler/due-tasks
   * Get tasks that are due for execution
   */
  router.get('/due-tasks', asyncHandler(async (req, res) => {
    const tasks = await schedulerManager.getDueTasks();
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  }));
  
  /**
   * POST /scheduler/batches
   * Create a new task batch
   */
  router.post('/batches', asyncHandler(async (req, res) => {
    const batchOptions = req.body;
    const batch = await schedulerManager.createBatch(batchOptions);
    
    res.status(201).json({
      success: true,
      batch
    });
  }));
  
  /**
   * GET /scheduler/batches
   * List task batches
   */
  router.get('/batches', asyncHandler(async (req, res) => {
    const query = req.query;
    const options: any = {};
    
    // Parse filtering options
    if (query.status) {
      options.status = Array.isArray(query.status) 
        ? query.status as TaskBatch['status'][] 
        : [query.status as TaskBatch['status']];
    }
    
    if (query.tags) {
      options.tags = Array.isArray(query.tags) 
        ? query.tags as string[] 
        : [query.tags as string];
    }
    
    if (query.from) {
      options.from = new Date(query.from as string);
    }
    
    if (query.to) {
      options.to = new Date(query.to as string);
    }
    
    if (query.limit) {
      options.limit = Number(query.limit);
    }
    
    if (query.offset) {
      options.offset = Number(query.offset);
    }
    
    const batches = await schedulerManager.listBatches(options);
    
    res.json({
      success: true,
      count: batches.length,
      batches
    });
  }));
  
  /**
   * GET /scheduler/batches/:batchId
   * Get a specific batch
   */
  router.get('/batches/:batchId', asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const batch = await schedulerManager.getBatch(batchId);
    
    if (batch) {
      res.json({
        success: true,
        batch
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
  }));
  
  /**
   * POST /scheduler/batches/:batchId/cancel
   * Cancel a batch
   */
  router.post('/batches/:batchId/cancel', asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const cancelled = await schedulerManager.cancelBatch(batchId);
    
    if (cancelled) {
      res.json({
        success: true,
        message: 'Batch cancelled'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Batch could not be cancelled'
      });
    }
  }));
  
  /**
   * POST /scheduler/pause
   * Pause the scheduler
   */
  router.post('/pause', asyncHandler(async (req, res) => {
    const paused = await schedulerManager.pauseScheduler();
    
    res.json({
      success: true,
      paused
    });
  }));
  
  /**
   * POST /scheduler/resume
   * Resume the scheduler
   */
  router.post('/resume', asyncHandler(async (req, res) => {
    const resumed = await schedulerManager.resumeScheduler();
    
    res.json({
      success: true,
      resumed
    });
  }));
  
  /**
   * GET /scheduler/resource-utilization
   * Get current resource utilization
   */
  router.get('/resource-utilization', asyncHandler(async (req, res) => {
    const utilization = await schedulerManager.getResourceUtilization();
    
    res.json({
      success: true,
      utilization
    });
  }));
  
  /**
   * GET /scheduler/resource-utilization/history
   * Get resource utilization history
   */
  router.get('/resource-utilization/history', asyncHandler(async (req, res) => {
    const query = req.query;
    const options: any = {};
    
    if (query.from) {
      options.from = new Date(query.from as string);
    }
    
    if (query.to) {
      options.to = new Date(query.to as string);
    }
    
    if (query.interval) {
      options.interval = query.interval as 'minute' | 'hour' | 'day';
    }
    
    if (query.limit) {
      options.limit = Number(query.limit);
    }
    
    const history = await schedulerManager.getResourceUtilizationHistory(options);
    
    res.json({
      success: true,
      count: history.length,
      history
    });
  }));
  
  /**
   * POST /scheduler/resource-limits
   * Set resource limits
   */
  router.post('/resource-limits', asyncHandler(async (req, res) => {
    const limits = req.body;
    const success = await schedulerManager.setResourceLimits(limits);
    
    res.json({
      success
    });
  }));
  
  /**
   * GET /scheduler/metrics
   * Get scheduler metrics
   */
  router.get('/metrics', asyncHandler(async (req, res) => {
    const query = req.query;
    const options: any = {};
    
    if (query.from) {
      options.from = new Date(query.from as string);
    }
    
    if (query.to) {
      options.to = new Date(query.to as string);
    }
    
    if (query.includeResourceMetrics) {
      options.includeResourceMetrics = query.includeResourceMetrics === 'true';
    }
    
    if (query.includeBatchMetrics) {
      options.includeBatchMetrics = query.includeBatchMetrics === 'true';
    }
    
    const metrics = await schedulerManager.getMetrics(options);
    
    res.json({
      success: true,
      metrics
    });
  }));
  
  /**
   * GET /scheduler/events
   * Get scheduler events
   */
  router.get('/events', asyncHandler(async (req, res) => {
    const query = req.query;
    const options: any = {};
    
    if (query.types) {
      options.types = Array.isArray(query.types) 
        ? query.types as string[] 
        : [query.types as string];
    }
    
    if (query.from) {
      options.from = new Date(query.from as string);
    }
    
    if (query.to) {
      options.to = new Date(query.to as string);
    }
    
    if (query.taskId) {
      options.taskId = query.taskId as string;
    }
    
    if (query.batchId) {
      options.batchId = query.batchId as string;
    }
    
    if (query.limit) {
      options.limit = Number(query.limit);
    }
    
    if (query.offset) {
      options.offset = Number(query.offset);
    }
    
    const events = await schedulerManager.getEvents(options);
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  }));
  
  return router;
} 