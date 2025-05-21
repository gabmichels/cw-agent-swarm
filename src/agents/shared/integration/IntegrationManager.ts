/**
 * Integration Manager
 * 
 * This file implements the Integration Manager which provides integration
 * services like visualization to the agent.
 */

import { AbstractBaseManager, ManagerConfig } from '../base/managers/BaseManager';
import { ManagerType } from '../base/managers/ManagerType';
import { ThinkingVisualizer } from '../../../services/thinking/visualization/ThinkingVisualizer';
import { ThinkingVisualization } from '../../../services/thinking/visualization/types';
import { v4 as uuidv4 } from 'uuid';
import { generateRequestId } from '../../../utils/visualization-utils';
import { AgentBase } from '../base/AgentBase.interface';
import { ManagerHealth } from '../base/managers/ManagerHealth';

/**
 * Integration Manager configuration
 */
export interface IntegrationManagerConfig extends ManagerConfig {
  /**
   * Whether to enable visualization
   */
  enableVisualization: boolean;

  /**
   * Whether to enable telemetry
   */
  enableTelemetry: boolean;

  /**
   * Options for visualization
   */
  visualizationOptions?: {
    /**
     * Storage collection name
     */
    collectionName?: string;
    
    /**
     * Whether to track memory operations
     */
    trackMemoryOperations?: boolean;
    
    /**
     * Whether to track tool execution
     */
    trackToolExecution?: boolean;
    
    /**
     * Whether to track thinking process
     */
    trackThinking?: boolean;
  };
}

/**
 * Integration Manager that provides integration services to the agent
 */
export class IntegrationManager extends AbstractBaseManager {
  /**
   * Visualization service
   */
  private visualizer: ThinkingVisualizer | null = null;
  
  /**
   * Constructor
   */
  constructor(agent: AgentBase, config: IntegrationManagerConfig) {
    const managerId = `integration_${uuidv4().substring(0, 8)}`;
    super(
      managerId,
      ManagerType.INTEGRATION,
      agent,
      config
    );
  }
  
  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    const config = this.getConfig<IntegrationManagerConfig>();
    
    // Initialize visualization if enabled
    if (config.enableVisualization) {
      try {
        // Dynamic import to avoid browser issues
        if (typeof window === 'undefined') {
          const { MemoryService } = await import('../../../server/memory/services/memory/memory-service');
          const { QdrantMemoryClient } = await import('../../../server/memory/services/client/qdrant-client');
          const { EmbeddingService } = await import('../../../server/memory/services/client/embedding-service');
          
          // Initialize memory services for visualization
          const memoryClient = new QdrantMemoryClient();
          await memoryClient.initialize();
          const embeddingService = new EmbeddingService();
          const memoryService = new MemoryService(memoryClient, embeddingService);
          
          // Create visualizer with collection name from config if provided
          this.visualizer = new ThinkingVisualizer(
            memoryService, 
            config.visualizationOptions?.collectionName
          );
        }
      } catch (error) {
        console.error('Error initializing visualization:', error);
        // Continue without visualization
      }
    }
    
    // Call parent initialize
    return await super.initialize();
  }
  
  /**
   * Get the visualizer instance
   */
  getVisualizer(): ThinkingVisualizer | null {
    return this.visualizer;
  }
  
  /**
   * Create a new visualization
   */
  createVisualization(params: {
    requestId?: string;
    userId: string;
    chatId: string;
    message: string;
    messageId?: string;
  }): ThinkingVisualization | null {
    if (!this.visualizer) {
      return null;
    }
    
    try {
      const requestId = params.requestId || generateRequestId();
      
      return this.visualizer.initializeVisualization(
        requestId,
        params.userId,
        this.getAgent().getAgentId(),
        params.chatId,
        params.message,
        params.messageId
      );
    } catch (error) {
      console.error('Error creating visualization:', error);
      return null;
    }
  }
  
  /**
   * Store a visualization
   */
  async storeVisualization(visualization: ThinkingVisualization): Promise<string | null> {
    if (!this.visualizer) {
      return null;
    }
    
    try {
      return await this.visualizer.saveVisualization(visualization);
    } catch (error) {
      console.error('Error storing visualization:', error);
      return null;
    }
  }
  
  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    // Call parent reset
    return await super.reset();
  }
  
  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    // Call parent shutdown
    await super.shutdown();
  }
  
  /**
   * Get the manager health
   */
  async getHealth(): Promise<ManagerHealth> {
    return {
      status: 'healthy',
      message: 'Integration manager is healthy',
      details: {
        lastCheck: new Date(),
        issues: [],
        metrics: {
          visualizationEnabled: !!this.visualizer
        }
      }
    };
  }
} 