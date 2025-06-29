/**
 * Workspace Tool System Integration
 * 
 * Integrates the Unified Workspace Tool System with the existing agent architecture.
 * This service acts as a bridge between the legacy workspace integration and the
 * new unified foundation system.
 * 
 * Phase 2.1: Workspace Tool System Integration
 * - Replaces WorkspaceAgentIntegration with unified approach
 * - Maintains backward compatibility
 * - Provides migration path for existing agents
 * - Preserves all workspace-specific functionality
 */

import { AgentBase } from '../../../../agents/shared/base/AgentBase.interface';
import { IUnifiedToolFoundation } from '../../foundation/interfaces/UnifiedToolFoundationInterface';
import { UnifiedWorkspaceToolSystem } from './UnifiedWorkspaceToolSystem';
import { WorkspaceAgentTools } from '../../../../services/workspace/tools/WorkspaceAgentTools';
import { AgentWorkspacePermissionService } from '../../../../services/workspace/AgentWorkspacePermissionService';
import { logger } from '../../../../lib/logging';
import { ToolFoundationError } from '../../foundation/errors/ToolFoundationErrors';

/**
 * Configuration for workspace tool system integration
 */
export interface WorkspaceToolSystemConfig {
  readonly enableUnifiedTools: boolean;
  readonly preserveLegacyIntegration: boolean;
  readonly enableDebugLogging: boolean;
  readonly autoRegisterAgentTools: boolean;
}

/**
 * Default configuration for workspace tool system
 */
const DEFAULT_CONFIG: WorkspaceToolSystemConfig = {
  enableUnifiedTools: true,
  preserveLegacyIntegration: true,
  enableDebugLogging: false,
  autoRegisterAgentTools: true
};

/**
 * Workspace Tool System Integration Service
 * 
 * Provides unified workspace tool integration while maintaining compatibility
 * with existing workspace services and agent architectures.
 */
export class WorkspaceToolSystemIntegration {
  private readonly unifiedWorkspaceSystem: UnifiedWorkspaceToolSystem;
  private readonly integratedAgents = new Set<string>();
  private initialized = false;

  constructor(
    private readonly foundation: IUnifiedToolFoundation,
    private readonly workspaceTools: WorkspaceAgentTools,
    private readonly permissionService: AgentWorkspacePermissionService,
    private readonly config: WorkspaceToolSystemConfig = DEFAULT_CONFIG
  ) {
    this.unifiedWorkspaceSystem = new UnifiedWorkspaceToolSystem(
      foundation,
      workspaceTools,
      permissionService
    );
  }

  /**
   * Initialize the workspace tool system integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('WorkspaceToolSystemIntegration already initialized');
      return;
    }

    try {
      logger.info('Initializing Workspace Tool System Integration', {
        config: this.config
      });

      // Initialize the unified workspace system
      await this.unifiedWorkspaceSystem.initialize();

      this.initialized = true;
      logger.info('✅ Workspace Tool System Integration initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize WorkspaceToolSystemIntegration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Integrate workspace tools for an agent
   * 
   * This method replaces the legacy WorkspaceAgentIntegration.initializeAgentWorkspace
   * while maintaining the same interface for backward compatibility.
   */
  async integrateAgentWorkspaceTools(agent: AgentBase): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('WorkspaceToolSystemIntegration not initialized');
    }

    const agentId = agent.getAgentId();

    if (this.integratedAgents.has(agentId)) {
      logger.debug('Workspace tools already integrated for agent', { agentId });
      return;
    }

    try {
      logger.info('Integrating workspace tools for agent', {
        agentId,
        config: this.config
      });

      // Check if agent has workspace capabilities
      const capabilities = await this.permissionService.getAgentWorkspaceCapabilities(agentId);

      if (capabilities.length === 0) {
        logger.info('No workspace capabilities found for agent', { agentId });
        return;
      }

      if (this.config.enableDebugLogging) {
        logger.debug('Agent workspace capabilities', {
          agentId,
          capabilityCount: capabilities.length,
          capabilities: capabilities.map(c => ({
            capability: c.capability,
            provider: c.provider,
            connectionId: c.connectionId
          }))
        });
      }

      // Register workspace tools with unified system
      if (this.config.enableUnifiedTools) {
        await this.unifiedWorkspaceSystem.registerAgentWorkspaceTools(agentId);
      }

      // Mark as integrated
      this.integratedAgents.add(agentId);

      logger.info('✅ Workspace tools integrated for agent', {
        agentId,
        capabilityCount: capabilities.length,
        unifiedToolsEnabled: this.config.enableUnifiedTools
      });

    } catch (error) {
      logger.error('Failed to integrate workspace tools for agent', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute a workspace tool for an agent
   * 
   * Provides unified workspace tool execution through the foundation system
   */
  async executeWorkspaceTool(
    agentId: string,
    toolName: string,
    params: any,
    context?: any
  ): Promise<any> {
    if (!this.initialized) {
      throw new ToolFoundationError('WorkspaceToolSystemIntegration not initialized');
    }

    if (!this.integratedAgents.has(agentId)) {
      throw new ToolFoundationError(`Agent ${agentId} workspace tools not integrated`);
    }

    try {
      if (this.config.enableDebugLogging) {
        logger.debug('Executing workspace tool through unified system', {
          agentId,
          toolName,
          params: Object.keys(params || {})
        });
      }

      // Execute through unified workspace system
      const result = await this.unifiedWorkspaceSystem.executeWorkspaceTool(
        toolName,
        params || {},
        {
          agentId,
          ...context
        }
      );

      if (this.config.enableDebugLogging) {
        logger.debug('Workspace tool execution completed', {
          agentId,
          toolName,
          success: result.success,
          executionTime: result.metadata?.executionTimeMs
        });
      }

      return result;

    } catch (error) {
      logger.error('Workspace tool execution failed', {
        agentId,
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get available workspace tools for an agent
   */
  async getAvailableWorkspaceTools(agentId: string): Promise<readonly string[]> {
    if (!this.initialized) {
      throw new ToolFoundationError('WorkspaceToolSystemIntegration not initialized');
    }

    if (!this.integratedAgents.has(agentId)) {
      return [];
    }

    try {
      return await this.unifiedWorkspaceSystem.getRegisteredWorkspaceTools();
    } catch (error) {
      logger.error('Failed to get available workspace tools', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Check if workspace tools are integrated for an agent
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
    readonly capabilities: number;
    readonly unifiedToolsEnabled: boolean;
  }> {
    try {
      const integrated = this.integratedAgents.has(agentId);
      const capabilities = integrated ?
        await this.permissionService.getAgentWorkspaceCapabilities(agentId) : [];
      const toolCount = integrated ?
        (await this.getAvailableWorkspaceTools(agentId)).length : 0;

      return {
        integrated,
        toolCount,
        capabilities: capabilities.length,
        unifiedToolsEnabled: this.config.enableUnifiedTools
      };
    } catch (error) {
      logger.error('Failed to get integration status', {
        agentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        integrated: false,
        toolCount: 0,
        capabilities: 0,
        unifiedToolsEnabled: this.config.enableUnifiedTools
      };
    }
  }

  /**
   * Remove workspace tool integration for an agent
   */
  async removeAgentIntegration(agentId: string): Promise<void> {
    if (!this.initialized) {
      throw new ToolFoundationError('WorkspaceToolSystemIntegration not initialized');
    }

    try {
      logger.info('Removing workspace tool integration for agent', { agentId });

      // Remove from integrated agents
      this.integratedAgents.delete(agentId);

      logger.info('✅ Workspace tool integration removed for agent', { agentId });

    } catch (error) {
      logger.error('Failed to remove workspace tool integration', {
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
    readonly unifiedSystemHealthy: boolean;
    readonly foundationHealthy: boolean;
  }> {
    try {
      const foundationHealthy = await this.foundation.isHealthy();
      const unifiedSystemHealthy = this.initialized;

      return {
        healthy: this.initialized && foundationHealthy,
        integratedAgents: this.integratedAgents.size,
        unifiedSystemHealthy,
        foundationHealthy
      };
    } catch (error) {
      logger.error('Failed to get workspace tool system health', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        healthy: false,
        integratedAgents: this.integratedAgents.size,
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
      logger.info('Shutting down Workspace Tool System Integration');

      // Clear integrated agents
      this.integratedAgents.clear();
      this.initialized = false;

      logger.info('✅ Workspace Tool System Integration shutdown completed');

    } catch (error) {
      logger.error('Failed to shutdown WorkspaceToolSystemIntegration', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Singleton instance for global access
 */
let workspaceToolSystemIntegration: WorkspaceToolSystemIntegration | null = null;

/**
 * Get or create the workspace tool system integration instance
 * 
 * This provides a singleton pattern for easy access throughout the application
 * while maintaining dependency injection capabilities.
 */
export function getWorkspaceToolSystemIntegration(
  foundation?: IUnifiedToolFoundation,
  workspaceTools?: WorkspaceAgentTools,
  permissionService?: AgentWorkspacePermissionService,
  config?: WorkspaceToolSystemConfig
): WorkspaceToolSystemIntegration {
  if (!workspaceToolSystemIntegration) {
    if (!foundation || !workspaceTools || !permissionService) {
      throw new ToolFoundationError(
        'WorkspaceToolSystemIntegration not initialized. Provide all required dependencies.'
      );
    }

    workspaceToolSystemIntegration = new WorkspaceToolSystemIntegration(
      foundation,
      workspaceTools,
      permissionService,
      config
    );
  }

  return workspaceToolSystemIntegration;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetWorkspaceToolSystemIntegration(): void {
  workspaceToolSystemIntegration = null;
} 