/**
 * StatusManager.ts
 * 
 * This file implements a status manager for tracking and updating agent status
 * with visualization support for status updates.
 */

import { v4 as uuidv4 } from 'uuid';
import { AbstractBaseManager } from '../base/managers/BaseManager';
import { AgentBase } from '../base/AgentBase.interface';
import { ManagerType } from '../base/managers/ManagerType';
import { ManagerHealth } from '../base/managers/ManagerHealth';
import { ThinkingVisualization, VisualizationService } from '../../../services/thinking/visualization/types';

// Status type definition
export type AgentStatus = 'idle' | 'processing' | 'thinking' | 'executing' | 'error' | 'paused';

// Status update event
export interface StatusUpdateEvent {
  id: string;
  timestamp: Date;
  previousStatus: AgentStatus;
  newStatus: AgentStatus;
  reason: string;
  metadata: Record<string, unknown>;
}

// Status manager configuration
export interface StatusManagerConfig {
  enabled: boolean;
  maxHistoryItems: number;
  logStatusChanges: boolean;
  enableVisualization: boolean;
  [key: string]: unknown;
}

/**
 * StatusManager class for tracking and visualizing agent status
 */
export class StatusManager extends AbstractBaseManager {
  private currentStatus: AgentStatus = 'idle';
  private statusHistory: StatusUpdateEvent[] = [];
  private statusListeners: Array<(event: StatusUpdateEvent) => void> = [];

  /**
   * Create a new StatusManager
   * 
   * @param agent The agent this manager belongs to
   * @param config Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<StatusManagerConfig> = {}
  ) {
    const defaultConfig: StatusManagerConfig = {
      enabled: true,
      maxHistoryItems: 100,
      logStatusChanges: true,
      enableVisualization: true,
      ...config
    };

    super(
      `status-manager-${uuidv4()}`,
      ManagerType.STATUS,
      agent,
      defaultConfig
    );
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    console.log(`[${this.managerId}] Initializing StatusManager`);
    this._initialized = true;
    return true;
  }

  /**
   * Get the current agent status
   */
  getCurrentStatus(): AgentStatus {
    return this.currentStatus;
  }

  /**
   * Get status history
   * 
   * @param limit Maximum number of history items to return
   */
  getStatusHistory(limit?: number): StatusUpdateEvent[] {
    if (limit && limit > 0) {
      return [...this.statusHistory].slice(0, limit);
    }
    return [...this.statusHistory];
  }

  /**
   * Update the agent status with visualization support
   * 
   * @param newStatus The new status
   * @param reason Reason for the status change
   * @param metadata Additional metadata
   * @param visualizationContext Optional visualization context
   */
  async updateStatus(
    newStatus: AgentStatus,
    reason: string,
    metadata: Record<string, unknown> = {},
    visualizationContext?: {
      visualization: ThinkingVisualization,
      visualizer: VisualizationService,
      parentNodeId?: string
    }
  ): Promise<StatusUpdateEvent> {
    const previousStatus = this.currentStatus;
    
    // Only proceed if there's an actual status change
    if (newStatus === previousStatus && Object.keys(metadata).length === 0) {
      return {
        id: uuidv4(),
        timestamp: new Date(),
        previousStatus,
        newStatus,
        reason: 'No status change',
        metadata
      };
    }
    
    // Update current status
    this.currentStatus = newStatus;
    
    // Create status update event
    const event: StatusUpdateEvent = {
      id: uuidv4(),
      timestamp: new Date(),
      previousStatus,
      newStatus,
      reason,
      metadata: {
        ...metadata,
        agentId: this.getAgent().getAgentId()
      }
    };
    
    // Add to history, maintaining max size
    this.statusHistory.unshift(event);
    const maxHistory = (this._config as StatusManagerConfig).maxHistoryItems;
    if (this.statusHistory.length > maxHistory) {
      this.statusHistory = this.statusHistory.slice(0, maxHistory);
    }
    
    // Log status change if enabled
    if ((this._config as StatusManagerConfig).logStatusChanges) {
      console.log(`[${this.managerId}] Status change: ${previousStatus} -> ${newStatus} (${reason})`);
    }
    
    // Notify listeners
    this.notifyListeners(event);
    
    // Create visualization node if visualization is enabled
    if ((this._config as StatusManagerConfig).enableVisualization &&
        visualizationContext &&
        visualizationContext.visualization &&
        visualizationContext.visualizer) {
      
      try {
        const { visualization, visualizer, parentNodeId } = visualizationContext;
        
        // Create status update visualization node
        const statusNodeId = visualizer.addNode(
          visualization,
          'status_update',
          `Status Update: ${previousStatus} → ${newStatus}`,
          {
            previousStatus,
            newStatus,
            reason,
            timestamp: event.timestamp.getTime(),
            metadata: event.metadata
          },
          'completed'
        );
        
        // Connect to parent node if specified
        if (parentNodeId && statusNodeId) {
          visualizer.addEdge(
            visualization,
            parentNodeId,
            statusNodeId,
            'status_change'
          );
        }
      } catch (error) {
        console.error('Error creating status visualization:', error);
      }
    }
    
    return event;
  }
  
  /**
   * Add a status change listener
   * 
   * @param listener Function to call when status changes
   */
  addStatusListener(listener: (event: StatusUpdateEvent) => void): void {
    this.statusListeners.push(listener);
  }
  
  /**
   * Remove a status change listener
   * 
   * @param listener Listener to remove
   */
  removeStatusListener(listener: (event: StatusUpdateEvent) => void): void {
    const index = this.statusListeners.indexOf(listener);
    if (index !== -1) {
      this.statusListeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners of a status change
   * 
   * @param event Status update event
   */
  private notifyListeners(event: StatusUpdateEvent): void {
    for (const listener of this.statusListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in status listener:', error);
      }
    }
  }
  
  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    return {
      status: this._initialized ? 'healthy' : 'degraded',
      message: this._initialized ? 'Status manager is operational' : 'Status manager not initialized',
      details: {
        lastCheck: new Date(),
        issues: []
      }
    };
  }
  
  /**
   * Reset the manager to its initial state
   */
  async reset(): Promise<boolean> {
    this.currentStatus = 'idle';
    this.statusHistory = [];
    this.statusListeners = [];
    return true;
  }
} 