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

import { DefaultSchedulerManager } from '../../../../lib/agents/implementations/managers/DefaultSchedulerManager';
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
  schedulerManager: DefaultSchedulerManager,
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
  schedulerManagers: Record<string, DefaultSchedulerManager>,
  basePath: string = '/api/agents'
): void {
  // Register each agent's scheduler endpoints
  Object.entries(schedulerManagers).forEach(([agentId, manager]) => {
    const agentSchedulerPath = `${basePath}/${agentId}/scheduler`;
    registerSchedulerApiEndpoints(app, manager, agentSchedulerPath);
  });
  
  console.log(`Scheduler API endpoints registered for ${Object.keys(schedulerManagers).length} agents`);
} 