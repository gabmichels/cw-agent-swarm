/**
 * SchedulerApiIntegration.ts
 * 
 * This module provides integration for the scheduler API endpoints with
 * the main Express application. It handles registration of scheduler endpoints
 * and initializes required middleware.
 */

// Define Express type to avoid dependency issues
interface Express {
  use: (basePath: string, router: any) => void;
}

import { ModularSchedulerManager } from '../../../../lib/scheduler/implementations/ModularSchedulerManager';
import { createSchedulerApiRouter } from './SchedulerApiEndpoints';

/**
 * Register scheduler API endpoints with the Express application
 * 
 * @param app Express application instance
 * @param schedulerManager Scheduler manager instance
 * @param basePath Base path for scheduler API (default: '/api/scheduler')
 */
export function registerSchedulerApiEndpoints(
  app: Express,
  schedulerManager: ModularSchedulerManager,
  basePath: string = '/api/scheduler'
): void {
  // Create the scheduler router
  const schedulerRouter = createSchedulerApiRouter(schedulerManager);
  
  // Register the router with the Express app
  app.use(basePath, schedulerRouter);
  
  console.log(`Scheduler API endpoints registered at ${basePath}`);
}

/**
 * Initialize scheduler API integration for multiple managers
 * 
 * @param app Express application instance
 * @param schedulerManagers Map of scheduler managers (key is agent ID or identifier)
 * @param basePath Base path for scheduler APIs (default: '/api/agents')
 */
export function initializeSchedulerApiForMultipleAgents(
  app: Express,
  schedulerManagers: Record<string, ModularSchedulerManager>,
  basePath: string = '/api/agents'
): void {
  // Register each agent's scheduler endpoints
  Object.entries(schedulerManagers).forEach(([agentId, manager]) => {
    const agentSchedulerPath = `${basePath}/${agentId}/scheduler`;
    registerSchedulerApiEndpoints(app, manager, agentSchedulerPath);
  });
  
  console.log(`Scheduler API endpoints registered for ${Object.keys(schedulerManagers).length} agents`);
}

/**
 * Initialize the scheduler API endpoints
 * @param router Express router to attach API endpoints to
 * @param schedulerManager Scheduler manager instance to use for handling API requests
 * @returns The configured router
 */
export function initializeSchedulerApi(
  router: any,
  schedulerManager: ModularSchedulerManager,
  basePath = '/api/scheduler'
): any {
  // Create and attach the scheduler API endpoints
  const apiRouter = createSchedulerApiRouter(schedulerManager);
  
  // Attach the API router to the main router at the specified base path
  router.use(basePath, apiRouter);
  
  return router;
}

/**
 * Initialize multiple scheduler APIs for different agents
 * @param router Express router to attach API endpoints to
 * @param schedulerManagers Map of agent IDs to scheduler managers
 * @param basePath Base path for all scheduler APIs
 * @returns The configured router
 */
export function initializeMultiAgentSchedulerApi(
  router: any,
  schedulerManagers: Record<string, ModularSchedulerManager>,
  basePath = '/api/scheduler'
): any {
  // Register each agent's scheduler endpoints
  Object.entries(schedulerManagers).forEach(([agentId, manager]) => {
    const agentSchedulerPath = `${basePath}/${agentId}/scheduler`;
    initializeSchedulerApi(router, manager, agentSchedulerPath);
  });
  
  console.log(`Scheduler API endpoints registered for ${Object.keys(schedulerManagers).length} agents`);
  
  return router;
} 