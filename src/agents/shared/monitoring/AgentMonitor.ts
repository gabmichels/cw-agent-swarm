/**
 * AgentMonitor.ts - Centralized service for structured logging of agent activity
 * 
 * This module provides:
 * - Logging of agent executions
 * - Task metadata tracking
 * - Tool usage monitoring
 * - Execution outcome recording
 * 
 * Used for observability, debugging, and metrics dashboards.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface AgentEvent {
  agentId: string;
  taskId: string;
  taskType?: string;
  toolUsed?: string;
  eventType: 'task_start' | 'task_end' | 'tool_start' | 'tool_end' | 'error' | 'delegation';
  status?: 'success' | 'failure';
  timestamp: number;
  durationMs?: number;
  errorMessage?: string;
  parentTaskId?: string;
  delegationContextId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class AgentMonitor {
  private static logs: AgentEvent[] = [];
  private static logFilePath: string | null = null;
  private static enableConsoleLogging: boolean = true;

  /**
   * Log an agent event
   */
  static log(event: AgentEvent) {
    AgentMonitor.logs.push(event);
    
    // Add console logging for easier debugging during development
    if (AgentMonitor.enableConsoleLogging) {
      console.log(`AgentMonitor: [${event.eventType}] Agent ${event.agentId} - ${event.taskId}${event.status ? ` (${event.status})` : ''}`);
    }
  }

  /**
   * Get logs filtered by provided criteria
   */
  static getLogs(filter?: Partial<AgentEvent>) {
    return AgentMonitor.logs.filter(log =>
      Object.entries(filter || {}).every(([key, val]) => log[key as keyof AgentEvent] === val)
    );
  }

  /**
   * Get recent failures, optionally filtered
   */
  static getRecentFailures(limit: number = 10, filter?: Partial<AgentEvent>): AgentEvent[] {
    // Get logs with failure status or error event type
    const failureLogs = AgentMonitor.logs.filter(log => 
      (log.status === 'failure' || log.eventType === 'error') &&
      Object.entries(filter || {}).every(([key, val]) => log[key as keyof AgentEvent] === val)
    );
    
    // Sort by timestamp, most recent first
    const sortedFailures = failureLogs.sort((a, b) => b.timestamp - a.timestamp);
    
    // Return limited number of failures
    return sortedFailures.slice(0, limit);
  }

  /**
   * Export logs to JSON file
   */
  static async exportLogsToFile(filePath: string): Promise<void> {
    try {
      // Ensure directory exists
      const directory = path.dirname(filePath);
      await fs.mkdir(directory, { recursive: true });
      
      // Write logs to file
      const logsJson = JSON.stringify(AgentMonitor.logs, null, 2);
      await fs.writeFile(filePath, logsJson, 'utf8');
      
      AgentMonitor.logFilePath = filePath;
      console.log(`Exported ${AgentMonitor.logs.length} logs to ${filePath}`);
      
      return;
    } catch (error) {
      console.error('Error exporting logs to file:', error);
      throw error;
    }
  }

  /**
   * Configure console logging
   */
  static setConsoleLogging(enabled: boolean): void {
    AgentMonitor.enableConsoleLogging = enabled;
  }

  /**
   * Clear all logs
   */
  static clear() {
    AgentMonitor.logs = [];
  }

  /**
   * Get metrics about agent activity
   */
  static getActivityMetrics(): Record<string, any> {
    // Total count by event type
    const eventTypeCounts: Record<string, number> = {};
    // Success/failure rates
    let successCount = 0;
    let failureCount = 0;
    // Agent activity
    const agentActivity: Record<string, number> = {};
    // Tool usage
    const toolUsage: Record<string, number> = {};
    
    for (const log of AgentMonitor.logs) {
      // Count event types
      eventTypeCounts[log.eventType] = (eventTypeCounts[log.eventType] || 0) + 1;
      
      // Count successes and failures
      if (log.status === 'success') successCount++;
      if (log.status === 'failure') failureCount++;
      
      // Count agent activity
      agentActivity[log.agentId] = (agentActivity[log.agentId] || 0) + 1;
      
      // Count tool usage
      if (log.toolUsed) {
        toolUsage[log.toolUsed] = (toolUsage[log.toolUsed] || 0) + 1;
      }
    }
    
    // Calculate success rate
    const statusTotal = successCount + failureCount;
    const successRate = statusTotal > 0 ? (successCount / statusTotal) * 100 : 0;
    
    return {
      totalLogs: AgentMonitor.logs.length,
      eventTypeCounts,
      successCount,
      failureCount,
      successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
      agentActivity,
      toolUsage
    };
  }
} 