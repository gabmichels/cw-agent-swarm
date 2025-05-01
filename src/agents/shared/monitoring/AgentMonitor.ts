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
  eventType: 'task_start' | 'task_end' | 'tool_start' | 'tool_end' | 'error' | 'delegation' | 'message';
  status?: 'success' | 'failure';
  timestamp: number;
  durationMs?: number;
  errorMessage?: string;
  parentTaskId?: string;
  delegationContextId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Delegation Chain Link representing a node in a delegation tree
export interface DelegationChainLink {
  taskId: string;
  agentId: string;
  eventType: string;
  status?: string;
  timestamp: number;
  parentTaskId?: string;
  delegationContextId?: string;
  children: DelegationChainLink[];
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

  /**
   * Get delegation chain for a specific task or delegation context
   */
  static getDelegationChain(
    identifier: { taskId?: string; delegationContextId?: string }
  ): DelegationChainLink[] {
    if (!identifier.taskId && !identifier.delegationContextId) {
      throw new Error('Either taskId or delegationContextId must be provided');
    }
    
    // Find all events for this delegation context or task
    let relevantEvents: AgentEvent[] = [];
    
    if (identifier.delegationContextId) {
      // Get all events with this delegation context ID
      relevantEvents = AgentMonitor.logs.filter(
        log => log.delegationContextId === identifier.delegationContextId
      );
    } else if (identifier.taskId) {
      // First find the delegation context for this task
      const taskEvent = AgentMonitor.logs.find(log => log.taskId === identifier.taskId);
      if (!taskEvent) {
        return [];
      }
      
      // If we have a delegation context, get all events with that context
      if (taskEvent.delegationContextId) {
        relevantEvents = AgentMonitor.logs.filter(
          log => log.delegationContextId === taskEvent.delegationContextId
        );
      } else {
        // Otherwise, just get events for this specific task
        relevantEvents = AgentMonitor.logs.filter(log => log.taskId === identifier.taskId);
      }
    }
    
    // Sort by timestamp to get chronological order
    relevantEvents.sort((a, b) => a.timestamp - b.timestamp);
    
    // Build a map of task IDs to their events
    const taskEventMap = new Map<string, AgentEvent[]>();
    for (const event of relevantEvents) {
      if (!taskEventMap.has(event.taskId)) {
        taskEventMap.set(event.taskId, []);
      }
      taskEventMap.get(event.taskId)?.push(event);
    }
    
    // Find root tasks (those without parentTaskId or with parentTaskId outside the context)
    const rootTasks = relevantEvents.filter(event => 
      !event.parentTaskId || !relevantEvents.some(e => e.taskId === event.parentTaskId)
    );
    
    // Helper function to recursively build the tree
    function buildTree(event: AgentEvent): DelegationChainLink {
      const link: DelegationChainLink = {
        taskId: event.taskId,
        agentId: event.agentId,
        eventType: event.eventType,
        status: event.status,
        timestamp: event.timestamp,
        parentTaskId: event.parentTaskId,
        delegationContextId: event.delegationContextId,
        children: [],
        metadata: event.metadata
      };
      
      // Find child tasks
      const childEvents = relevantEvents.filter(e => e.parentTaskId === event.taskId);
      
      // Sort children by timestamp
      childEvents.sort((a, b) => a.timestamp - b.timestamp);
      
      // Process child events
      for (const childEvent of childEvents) {
        // Avoid circular references
        if (childEvent.taskId !== event.taskId) {
          link.children.push(buildTree(childEvent));
        }
      }
      
      return link;
    }
    
    // Build trees from root tasks
    const delegationChain: DelegationChainLink[] = [];
    for (const rootEvent of rootTasks) {
      delegationChain.push(buildTree(rootEvent));
    }
    
    return delegationChain;
  }
  
  /**
   * Generate a visualization of the delegation chain as a Mermaid flowchart
   */
  static generateDelegationFlowchart(
    identifier: { taskId?: string; delegationContextId?: string }
  ): string {
    const chain = AgentMonitor.getDelegationChain(identifier);
    if (chain.length === 0) {
      return 'flowchart TD\n  NoData["No delegation data found"]';
    }
    
    let mermaidCode = 'flowchart TD\n';
    
    // Helper function to recursively add nodes and connections
    function addToFlowchart(node: DelegationChainLink, depth: number = 0): void {
      // Create node ID (sanitized task ID)
      const nodeId = `task_${node.taskId.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      // Add node with label showing agent and task
      const status = node.status ? ` (${node.status})` : '';
      const indent = '  '.repeat(depth + 1);
      mermaidCode += `${indent}${nodeId}["${node.agentId}: ${node.taskId.substring(0, 10)}${status}"]\n`;
      
      // Process children
      for (const child of node.children) {
        const childId = `task_${child.taskId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Add child node
        addToFlowchart(child, depth + 1);
        
        // Add connection
        mermaidCode += `${indent}${nodeId} --> ${childId}\n`;
      }
    }
    
    // Add each root node to the flowchart
    for (const root of chain) {
      addToFlowchart(root);
    }
    
    return mermaidCode;
  }
} 