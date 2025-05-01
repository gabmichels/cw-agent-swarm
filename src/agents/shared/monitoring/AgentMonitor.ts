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

  static log(event: AgentEvent) {
    AgentMonitor.logs.push(event);
    // Optional: Add console logging for easier debugging during development
    console.log(`AgentMonitor: [${event.eventType}] Agent ${event.agentId} - ${event.taskId}${event.status ? ` (${event.status})` : ''}`);
  }

  static getLogs(filter?: Partial<AgentEvent>) {
    return AgentMonitor.logs.filter(log =>
      Object.entries(filter || {}).every(([key, val]) => log[key as keyof AgentEvent] === val)
    );
  }

  static clear() {
    AgentMonitor.logs = [];
  }
} 