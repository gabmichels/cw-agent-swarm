/**
 * Social Media Tool System Integration
 * 
 * Integrates the Unified Social Media Tool System with the existing agent architecture.
 * This service acts as a bridge between the legacy social media integration and the
 * new unified foundation system.
 * 
 * Phase 2.2: Social Media Tool System Integration
 * - Replaces SocialMediaAgentIntegration with unified approach
 * - Maintains backward compatibility with existing approval workflows
 * - Provides migration path for existing agents
 * - Preserves all social media-specific functionality and platform logic
 */

import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { UnifiedSocialMediaToolSystem } from './UnifiedSocialMediaToolSystem';
import { SocialMediaAgentTools } from '../../../../services/social-media/tools/SocialMediaAgentTools';
import { SocialMediaService } from '../../../../services/social-media/SocialMediaService';
import { PrismaSocialMediaDatabase } from '../../../../services/social-media/database/PrismaSocialMediaDatabase';
import { logger } from '../../../../lib/logging';
import { ToolFoundationError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Configuration for social media tool system integration
 */
export interface SocialMediaToolSystemConfig {
  readonly enableUnifiedTools: boolean;
  readonly preserveLegacyIntegration: boolean;
  readonly enableDebugLogging: boolean;
  readonly autoRegisterAgentTools: boolean;
  readonly enableApprovalWorkflows: boolean;
}

/**
 * Default configuration for social media tool system
 */
const DEFAULT_CONFIG: SocialMediaToolSystemConfig = {
  enableUnifiedTools: true,
  preserveLegacyIntegration: true,
  enableDebugLogging: false,
  autoRegisterAgentTools: true,
  enableApprovalWorkflows: true
};

/**
 * Social Media Tool System Integration Service
 * 
 * Provides unified social media tool integration while maintaining compatibility
 * with existing social media services and approval workflows.
 */
export class SocialMediaToolSystemIntegration {
  private readonly unifiedSocialMediaSystem: UnifiedSocialMediaToolSystem;
  private readonly integratedAgents = new Map<string, string[]>(); // agentId -> connectionIds
  private initialized = false;

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly socialMediaService: SocialMediaService,
    private readonly socialMediaDatabase: PrismaSocialMediaDatabase,
    private readonly config: SocialMediaToolSystemConfig = DEFAULT_CONFIG
  ) {
    // Create social media agent tools
    const socialMediaTools = new SocialMediaAgentTools(
      this.socialMediaService,
      this.socialMediaDatabase
    );

    this.unifiedSocialMediaSystem = new UnifiedSocialMediaToolSystem(
      foundation,
      socialMediaTools
    );
  }

  /**
   * Initialize the social media tool system integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('SocialMediaToolSystemIntegration already initialized');
      return;
    }

    try {
      logger.info('Initializing Social Media Tool System Integration', {
        config: this.config
      });

      // Initialize the unified social media system
      await this.unifiedSocialMediaSystem.initialize();

      this.initialized = true;
      logger.info('✅ Social Media Tool System Integration initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize SocialMediaToolSystemIntegration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Integrate social media tools for an agent
   * 
   * This method replaces the legacy SocialMediaAgentIntegration.processSocialMediaInput
   * while maintaining the same interface for backward compatibility.
   */
  async integrateAgentSocialMediaTools(agent: AgentBase, connectionIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    const agentId = agent.getAgentId();

    if (this.integratedAgents.has(agentId)) {
      logger.debug('Social media tools already integrated for agent', {
        agentId,
        existingConnections: this.integratedAgents.get(agentId)?.length || 0,
        newConnections: connectionIds.length
      });

      // Update connection IDs if they've changed
      this.integratedAgents.set(agentId, connectionIds);
      return;
    }

    try {
      logger.info('Integrating social media tools for agent', {
        agentId,
        connectionCount: connectionIds.length,
        config: this.config
      });

      // Check if agent has social media connections
      if (connectionIds.length === 0) {
        logger.info('No social media connections found for agent', { agentId });
        return;
      }

      if (this.config.enableDebugLogging) {
        logger.debug('Agent social media connections', {
          agentId,
          connectionIds,
          connectionCount: connectionIds.length
        });
      }

      // Register social media tools with unified system
      if (this.config.enableUnifiedTools) {
        await this.unifiedSocialMediaSystem.registerAgentSocialMediaTools(agentId, connectionIds);
      }

      // Mark as integrated
      this.integratedAgents.set(agentId, connectionIds);

      logger.info('✅ Social media tools integrated for agent', {
        agentId,
        connectionCount: connectionIds.length,
        unifiedToolsEnabled: this.config.enableUnifiedTools
      });

    } catch (error) {
      logger.error('Failed to integrate social media tools for agent', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a social media tool for an agent
   * 
   * Provides unified social media tool execution through the foundation system
   */
  async executeSocialMediaTool(
    agentId: string,
    toolName: string,
    params: any,
    context?: any
  ): Promise<any> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    if (!this.integratedAgents.has(agentId)) {
      throw new ToolFoundationError(`Agent ${agentId} social media tools not integrated`);
    }

    try {
      if (this.config.enableDebugLogging) {
        logger.debug('Executing social media tool through unified system', {
          agentId,
          toolName,
          params: Object.keys(params || {}),
          connectionCount: this.integratedAgents.get(agentId)?.length || 0
        });
      }

      // Execute through unified social media system
      const result = await this.unifiedSocialMediaSystem.executeSocialMediaTool(
        toolName,
        params || {},
        {
          agentId,
          ...context
        }
      );

      if (this.config.enableDebugLogging) {
        logger.debug('Social media tool execution completed', {
          agentId,
          toolName,
          success: result.success,
          executionTime: result.metadata?.executionTimeMs
        });
      }

      return result;

    } catch (error) {
      logger.error('Social media tool execution failed', {
        agentId,
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Process social media input for an agent (legacy compatibility)
   * 
   * Maintains backward compatibility with existing SocialMediaAgentIntegration.processSocialMediaInput
   */
  async processSocialMediaInput(
    agentId: string,
    userMessage: string,
    connectionIds: string[]
  ): Promise<any> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    try {
      logger.info('Processing social media input through unified system', {
        agentId,
        messageLength: userMessage.length,
        connectionCount: connectionIds.length
      });

      // Ensure agent tools are integrated
      if (!this.integratedAgents.has(agentId)) {
        // Auto-integrate if enabled
        if (this.config.autoRegisterAgentTools) {
          // Create a mock agent object for integration
          const mockAgent = { getAgentId: () => agentId } as AgentBase;
          await this.integrateAgentSocialMediaTools(mockAgent, connectionIds);
        } else {
          throw new ToolFoundationError(`Agent ${agentId} social media tools not integrated`);
        }
      }

      // For now, delegate to the existing social media tools logic
      // TODO: Implement NLP processing through unified system
      const socialMediaTools = new SocialMediaAgentTools(
        this.socialMediaService,
        this.socialMediaDatabase
      );

      const result = await socialMediaTools.processUserInput(agentId, userMessage, connectionIds);

      if (this.config.enableDebugLogging) {
        logger.debug('Social media input processing completed', {
          agentId,
          success: result.success,
          executionTime: result.executionTime
        });
      }

      return result;

    } catch (error) {
      logger.error('Social media input processing failed', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get available social media tools for an agent
   */
  async getAvailableSocialMediaTools(agentId: string): Promise<readonly string[]> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    if (!this.integratedAgents.has(agentId)) {
      return [];
    }

    try {
      return await this.unifiedSocialMediaSystem.getRegisteredSocialMediaTools();
    } catch (error) {
      logger.error('Failed to get available social media tools', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check if social media tools are integrated for an agent
   */
  isAgentIntegrated(agentId: string): boolean {
    return this.integratedAgents.has(agentId);
  }

  /**
   * Get integration status for an agent
   */
  async getIntegrationStatus(agentId: string): Promise<{
    readonly integrated: boolean;
    readonly toolCount: number;
    readonly connectionCount: number;
    readonly connectionIds: readonly string[];
    readonly unifiedToolsEnabled: boolean;
    readonly approvalWorkflowsEnabled: boolean;
  }> {
    try {
      const integrated = this.integratedAgents.has(agentId);
      const connectionIds = integrated ? this.integratedAgents.get(agentId) || [] : [];
      const toolCount = integrated ?
        (await this.getAvailableSocialMediaTools(agentId)).length : 0;

      return {
        integrated,
        toolCount,
        connectionCount: connectionIds.length,
        connectionIds,
        unifiedToolsEnabled: this.config.enableUnifiedTools,
        approvalWorkflowsEnabled: this.config.enableApprovalWorkflows
      };
    } catch (error) {
      logger.error('Failed to get integration status', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        integrated: false,
        toolCount: 0,
        connectionCount: 0,
        connectionIds: [],
        unifiedToolsEnabled: this.config.enableUnifiedTools,
        approvalWorkflowsEnabled: this.config.enableApprovalWorkflows
      };
    }
  }

  /**
   * Update connection IDs for an agent
   */
  async updateAgentConnections(agentId: string, connectionIds: string[]): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    try {
      logger.info('Updating social media connections for agent', {
        agentId,
        oldConnectionCount: this.integratedAgents.get(agentId)?.length || 0,
        newConnectionCount: connectionIds.length
      });

      // Update stored connection IDs
      this.integratedAgents.set(agentId, connectionIds);

      // Re-register tools with new connections if enabled
      if (this.config.enableUnifiedTools) {
        await this.unifiedSocialMediaSystem.registerAgentSocialMediaTools(agentId, connectionIds);
      }

      logger.info('✅ Social media connections updated for agent', {
        agentId,
        connectionCount: connectionIds.length
      });

    } catch (error) {
      logger.error('Failed to update social media connections', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Remove social media tool integration for an agent
   */
  async removeAgentIntegration(agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('SocialMediaToolSystemIntegration not initialized');
    }

    try {
      logger.info('Removing social media tool integration for agent', { agentId });

      // Remove from integrated agents
      this.integratedAgents.delete(agentId);

      logger.info('✅ Social media tool integration removed for agent', { agentId });

    } catch (error) {
      logger.error('Failed to remove social media tool integration', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<{
    readonly healthy: boolean;
    readonly integratedAgents: number;
    readonly totalConnections: number;
    readonly unifiedSystemHealthy: boolean;
    readonly foundationHealthy: boolean;
  }> {
    try {
      const foundationHealthy = await this.foundation.isHealthy();
      const unifiedSystemHealthy = this.initialized;
      const totalConnections = Array.from(this.integratedAgents.values())
        .reduce((total, connections) => total + connections.length, 0);

      return {
        healthy: this.initialized && foundationHealthy,
        integratedAgents: this.integratedAgents.size,
        totalConnections,
        unifiedSystemHealthy,
        foundationHealthy
      };
    } catch (error) {
      logger.error('Failed to get social media tool system health', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        healthy: false,
        integratedAgents: this.integratedAgents.size,
        totalConnections: 0,
        unifiedSystemHealthy: false,
        foundationHealthy: false
      };
    }
  }

  /**
   * Shutdown the integration system
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Social Media Tool System Integration');

      // Clear integrated agents
      this.integratedAgents.clear();
      this.initialized = false;

      logger.info('✅ Social Media Tool System Integration shutdown completed');

    } catch (error) {
      logger.error('Failed to shutdown SocialMediaToolSystemIntegration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Singleton instance for global access
 */
let socialMediaToolSystemIntegration: SocialMediaToolSystemIntegration | null = null;

/**
 * Get or create the social media tool system integration instance
 * 
 * This provides a singleton pattern for easy access throughout the application
 * while maintaining dependency injection capabilities.
 */
export function getSocialMediaToolSystemIntegration(
  foundation?: IUnifiedToolFoundation,
  socialMediaService?: SocialMediaService,
  socialMediaDatabase?: PrismaSocialMediaDatabase,
  config?: SocialMediaToolSystemConfig
): SocialMediaToolSystemIntegration {
  if (!socialMediaToolSystemIntegration) {
    if (!foundation || !socialMediaService || !socialMediaDatabase) {
      throw new ToolFoundationError(
        'SocialMediaToolSystemIntegration not initialized. Provide all required dependencies.'
      );
    }

    socialMediaToolSystemIntegration = new SocialMediaToolSystemIntegration(
      foundation,
      socialMediaService,
      socialMediaDatabase,
      config
    );
  }

  return socialMediaToolSystemIntegration;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSocialMediaToolSystemIntegration(): void {
  socialMediaToolSystemIntegration = null;
} 