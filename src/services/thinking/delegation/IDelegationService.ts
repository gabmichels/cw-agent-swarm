import { DelegationResult } from './DelegationManager';

/**
 * Interface for delegation service that routes tasks to appropriate agents
 */
export interface IDelegationService {
  /**
   * Delegate a task to the most appropriate agent based on capabilities and load
   * @param userId User who initiated the task
   * @param query Original query from the user
   * @param requiredCapabilities Required capabilities for this task
   * @param priority Priority of the task (higher = more important)
   * @param isUrgent Whether this is a time-sensitive task
   * @param context Additional context for the task
   * @returns Result of the delegation operation
   */
  delegateTask(
    userId: string,
    query: string,
    requiredCapabilities: string[],
    priority?: number,
    isUrgent?: boolean,
    context?: any
  ): Promise<DelegationResult>;
  
  /**
   * Get available agents with their capabilities and current load
   * @returns List of available agents
   */
  getAvailableAgents(): Promise<Array<{
    id: string;
    name: string;
    capabilities: string[];
    currentLoad: number;
  }>>;
  
  /**
   * Check if capabilities are available in the system
   * @param capabilities List of capabilities to check
   * @returns Whether all capabilities are available
   */
  hasCapabilities(capabilities: string[]): Promise<boolean>;
} 