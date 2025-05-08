/**
 * Capability Registry 
 * 
 * Registry for agent capabilities that enables discovery and capability-based routing
 */

import { AnyMemoryService } from '../../../server/memory/services/memory/memory-service-wrappers';
import { MemoryType } from '../../../server/memory/config/types';

import { 
  Capability, 
  CapabilityLevel, 
  CapabilityType, 
  AgentCapability, 
  CapabilityRequest, 
  CapabilityRegistration 
} from './types';
import { 
  CapabilityMetricsService, 
  ICapabilityMetricsService, 
  CapabilityPerformanceMetrics
} from './capability-metrics';

// String literal type for capability memory types, avoiding enum conflicts
type CapabilityMemoryType = 'agent' | 'agent_capability' | 'capability_definition';

/**
 * Interface for capability registry
 */
export interface ICapabilityRegistry {
  /**
   * Register a capability for an agent
   */
  registerCapability(
    agentId: string, 
    capability: AgentCapability
  ): Promise<CapabilityRegistration>;
  
  /**
   * Unregister a capability for an agent
   */
  unregisterCapability(
    agentId: string, 
    capabilityId: string
  ): Promise<boolean>;
  
  /**
   * Find agents that provide a capability
   */
  findProviders(
    capabilityId: string, 
    request?: Partial<CapabilityRequest>
  ): Promise<string[]>;

  /**
   * Find best performing agents for a capability based on metrics
   */
  findBestProviders(
    capabilityId: string,
    limit?: number
  ): Promise<string[]>;
  
  /**
   * Get all capabilities for an agent
   */
  getAgentCapabilities(agentId: string): Promise<AgentCapability[]>;
  
  /**
   * Define a new capability
   */
  defineCapability(capability: Omit<Capability, 'id'>): Promise<Capability>;
  
  /**
   * Get a capability definition by ID
   */
  getCapability(capabilityId: string): Promise<Capability | null>;
  
  /**
   * Get all registered capability definitions
   */
  getAllCapabilities(): Promise<Capability[]>;

  /**
   * Get performance metrics for a capability
   */
  getCapabilityMetrics(
    agentId: string,
    capabilityId: string
  ): Promise<CapabilityPerformanceMetrics | null>;

  /**
   * Record usage of a capability with performance data
   */
  recordCapabilityUsage(
    agentId: string,
    capabilityId: string,
    success: boolean,
    duration: number,
    options?: {
      latency?: number;
      tokenCount?: number;
      confidenceScore?: number;
      qualityScore?: number;
      context?: {
        requestId?: string;
        chatId?: string;
        taskId?: string;
      };
    }
  ): Promise<void>;

  /**
   * Update capability levels based on performance metrics
   */
  updateCapabilityLevels(agentId: string): Promise<{
    updated: number;
    unchanged: number;
  }>;
}

/**
 * Capability Registry implementation
 */
export class CapabilityRegistry implements ICapabilityRegistry {
  // Private constants for memory types to ensure consistent usage
  private readonly AGENT_TYPE: CapabilityMemoryType = 'agent';
  private readonly AGENT_CAPABILITY_TYPE: CapabilityMemoryType = 'agent_capability';
  private readonly CAPABILITY_DEFINITION_TYPE: CapabilityMemoryType = 'capability_definition';
  
  // Metrics service for tracking capability performance
  private readonly metricsService: ICapabilityMetricsService;

  /**
   * Create a new capability registry
   */
  constructor(
    private readonly memoryService: AnyMemoryService
  ) {
    // Initialize the metrics service
    this.metricsService = new CapabilityMetricsService(memoryService);
  }
  
  /**
   * Register a capability for an agent
   */
  async registerCapability(
    agentId: string, 
    capability: AgentCapability
  ): Promise<CapabilityRegistration> {
    try {
      // Validate the capability ID exists
      const capabilityExists = await this.getCapability(capability.capabilityId);
      if (!capabilityExists) {
        throw new Error(`Capability ${capability.capabilityId} does not exist`);
      }
      
      // Remove any existing registration for this capability
      await this.unregisterCapability(agentId, capability.capabilityId);
      
      const timestamp = Date.now();
      
      // Create the registration
      const registration: CapabilityRegistration = {
        agentId,
        capability,
        registeredAt: timestamp
      };
      
      // Store in memory
      await this.memoryService.addMemory({
        type: this.AGENT_CAPABILITY_TYPE as MemoryType,
        content: `${agentId}:${capability.capabilityId}`,
        metadata: {
          ...registration,
          registrationType: 'capability'
        }
      });
      
      // Update agent record with capability
      await this.updateAgentCapabilities(agentId, capability);
      
      return registration;
    } catch (error) {
      console.error(`Error registering capability ${capability.capabilityId} for agent ${agentId}:`, error);
      throw error;
    }
  }
  
  /**
   * Unregister a capability for an agent
   */
  async unregisterCapability(
    agentId: string, 
    capabilityId: string
  ): Promise<boolean> {
    try {
      // Find the capability registration
      const registrations = await this.memoryService.searchMemories({
        type: this.AGENT_CAPABILITY_TYPE as MemoryType,
        filter: {
          'metadata.agentId': agentId,
          'metadata.capability.capabilityId': capabilityId
        }
      });
      
      if (registrations.length === 0) {
        return false; // Nothing to unregister
      }
      
      // Delete all matching registrations
      for (const registration of registrations) {
        await this.memoryService.deleteMemory({ 
          type: this.AGENT_CAPABILITY_TYPE as MemoryType,
          id: registration.id 
        });
      }
      
      // Update agent record
      await this.removeAgentCapability(agentId, capabilityId);
      
      return true;
    } catch (error) {
      console.error(`Error unregistering capability ${capabilityId} for agent ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Find agents that provide a capability
   */
  async findProviders(
    capabilityId: string, 
    request?: Partial<CapabilityRequest>
  ): Promise<string[]> {
    try {
      // Build the filter
      const filter: Record<string, unknown> = {
        'metadata.capability.capabilityId': capabilityId,
        'metadata.capability.enabled': true
      };
      
      // Add minimum level filter if specified
      if (request?.minimumLevel) {
        filter['metadata.capability.level'] = {
          $in: this.getLevelsAtOrAbove(request.minimumLevel)
        };
      }
      
      // Add minimum proficiency filter if specified
      if (request?.minimumProficiency) {
        filter['metadata.capability.proficiency'] = {
          $gte: request.minimumProficiency
        };
      }
      
      // Search for matching registrations
      const registrations = await this.memoryService.searchMemories({
        type: this.AGENT_CAPABILITY_TYPE as MemoryType,
        filter
      });
      
      // Extract agent IDs
      let agentIds = registrations.map(r => {
        if (r.payload.metadata) {
          // Cast to unknown first, then to Record to satisfy TypeScript
          const metadata = r.payload.metadata as unknown as Record<string, unknown>;
          return metadata.agentId as string || '';
        }
        return '';
      }).filter(id => id !== '');
      
      // Filter to preferred agents if specified
      if (request?.preferredAgentIds && request.preferredAgentIds.length > 0) {
        const preferred = agentIds.filter(id => request.preferredAgentIds?.includes(id));
        if (preferred.length > 0) {
          agentIds = preferred;
        }
      }
      
      // Remove duplicates
      return Array.from(new Set(agentIds));
    } catch (error) {
      console.error(`Error finding providers for capability ${capabilityId}:`, error);
      return [];
    }
  }
  
  /**
   * Get all capabilities for an agent
   */
  async getAgentCapabilities(agentId: string): Promise<AgentCapability[]> {
    try {
      // Search for the agent's registrations
      const registrations = await this.memoryService.searchMemories({
        type: this.AGENT_CAPABILITY_TYPE as MemoryType,
        filter: {
          'metadata.agentId': agentId
        }
      });
      
      // Extract capabilities
      return registrations
        .filter(r => r.payload.metadata) // Filter out records without metadata
        .map(r => {
          // Cast to unknown first, then to Record to satisfy TypeScript
          const metadata = r.payload.metadata as unknown as Record<string, unknown>;
          return metadata.capability as AgentCapability;
        })
        .filter(Boolean); // Filter out any undefined or null entries
    } catch (error) {
      console.error(`Error getting capabilities for agent ${agentId}:`, error);
      return [];
    }
  }
  
  /**
   * Define a new capability
   */
  async defineCapability(capability: Omit<Capability, 'id'>): Promise<Capability> {
    try {
      // Generate a unique ID for the capability
      const id = `${capability.type.toLowerCase()}.${capability.name.toLowerCase().replace(/\s+/g, '_')}`;
      
      // Check if a capability with this ID already exists
      const existing = await this.getCapability(id);
      if (existing) {
        throw new Error(`Capability with ID ${id} already exists`);
      }
      
      // Create the capability definition
      const newCapability: Capability = {
        ...capability,
        id
      };
      
      // Store in memory
      await this.memoryService.addMemory({
        type: this.CAPABILITY_DEFINITION_TYPE as MemoryType,
        content: newCapability.name,
        metadata: {
          ...newCapability,
          definitionType: 'capability'
        }
      });
      
      return newCapability;
    } catch (error) {
      console.error(`Error defining capability ${capability.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Get a capability definition by ID
   */
  async getCapability(capabilityId: string): Promise<Capability | null> {
    try {
      // Search for the capability definition
      const definitions = await this.memoryService.searchMemories({
        type: this.CAPABILITY_DEFINITION_TYPE as MemoryType,
        filter: {
          'metadata.id': capabilityId
        }
      });
      
      if (definitions.length === 0 || !definitions[0].payload.metadata) {
        return null;
      }
      
      // Cast to unknown first, then to Record to satisfy TypeScript
      const metadata = definitions[0].payload.metadata as unknown as Record<string, unknown>;
      
      return {
        id: metadata.id as string,
        name: metadata.name as string,
        description: metadata.description as string,
        type: metadata.type as CapabilityType,
        parameters: metadata.parameters as Record<string, unknown>,
        requiredCapabilities: metadata.requiredCapabilities as string[],
        incompatibleWith: metadata.incompatibleWith as string[]
      };
    } catch (error) {
      console.error(`Error getting capability ${capabilityId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all registered capability definitions
   */
  async getAllCapabilities(): Promise<Capability[]> {
    try {
      // Search for all capability definitions
      const definitions = await this.memoryService.searchMemories({
        type: this.CAPABILITY_DEFINITION_TYPE as MemoryType,
        filter: {
          'metadata.definitionType': 'capability'
        }
      });
      
      // Extract the capability definitions
      return definitions
        .filter(d => d.payload.metadata) // Filter out records without metadata
        .map(d => {
          // Cast to unknown first, then to Record to satisfy TypeScript
          const metadata = d.payload.metadata as unknown as Record<string, unknown>;
          
          return {
            id: metadata.id as string,
            name: metadata.name as string,
            description: metadata.description as string,
            type: metadata.type as CapabilityType,
            parameters: metadata.parameters as Record<string, unknown>,
            requiredCapabilities: metadata.requiredCapabilities as string[],
            incompatibleWith: metadata.incompatibleWith as string[]
          };
        });
    } catch (error) {
      console.error('Error getting all capabilities:', error);
      return [];
    }
  }
  
  /**
   * Private: Get levels at or above the specified level
   */
  private getLevelsAtOrAbove(level: CapabilityLevel): string[] {
    const levels = [
      CapabilityLevel.BASIC,
      CapabilityLevel.INTERMEDIATE,
      CapabilityLevel.ADVANCED,
      CapabilityLevel.EXPERT
    ];
    
    const levelIndex = levels.indexOf(level);
    return levels.slice(levelIndex);
  }
  
  /**
   * Private: Update agent capabilities
   */
  private async updateAgentCapabilities(
    agentId: string,
    capability: AgentCapability
  ): Promise<void> {
    try {
      // Get the agent
      const agents = await this.memoryService.searchMemories({
        type: this.AGENT_TYPE as MemoryType,
        filter: {
          id: agentId
        }
      });
      
      if (agents.length === 0) {
        return; // Agent doesn't exist
      }
      
      const agent = agents[0];
      let capabilities: AgentCapability[] = [];
      
      if (agent.payload.metadata) {
        // Cast to unknown first, then to Record to satisfy TypeScript
        const metadata = agent.payload.metadata as unknown as Record<string, unknown>;
        capabilities = (metadata.capabilities as AgentCapability[]) || [];
      }
      
      // Remove the capability if it already exists
      const index = capabilities.findIndex(c => c.capabilityId === capability.capabilityId);
      if (index !== -1) {
        capabilities.splice(index, 1);
      }
      
      // Add the new capability
      capabilities.push(capability);
      
      // Update the agent
      await this.memoryService.updateMemory({
        type: this.AGENT_TYPE as MemoryType,
        id: agentId,
        metadata: {
          capabilities
        }
      });
    } catch (error) {
      console.error(`Error updating agent capabilities for ${agentId}:`, error);
      // Don't throw, just log the error
    }
  }
  
  /**
   * Private: Remove a capability from an agent
   */
  private async removeAgentCapability(
    agentId: string,
    capabilityId: string
  ): Promise<void> {
    try {
      // Get the agent
      const agents = await this.memoryService.searchMemories({
        type: this.AGENT_TYPE as MemoryType,
        filter: {
          id: agentId
        }
      });
      
      if (agents.length === 0) {
        return; // Agent doesn't exist
      }
      
      const agent = agents[0];
      let capabilities: AgentCapability[] = [];
      
      if (agent.payload.metadata) {
        // Cast to unknown first, then to Record to satisfy TypeScript
        const metadata = agent.payload.metadata as unknown as Record<string, unknown>;
        capabilities = (metadata.capabilities as AgentCapability[]) || [];
      }
      
      // Remove the capability
      const updatedCapabilities = capabilities.filter(c => c.capabilityId !== capabilityId);
      
      // Only update if something changed
      if (updatedCapabilities.length !== capabilities.length) {
        // Update the agent
        await this.memoryService.updateMemory({
          type: this.AGENT_TYPE as MemoryType,
          id: agentId,
          metadata: {
            capabilities: updatedCapabilities
          }
        });
      }
    } catch (error) {
      console.error(`Error removing agent capability ${capabilityId} from ${agentId}:`, error);
      // Don't throw, just log the error
    }
  }

  /**
   * Find best performing agents for a capability based on metrics
   */
  async findBestProviders(
    capabilityId: string,
    limit: number = 5
  ): Promise<string[]> {
    try {
      // Get best performing agents from metrics service
      const bestPerforming = await this.metricsService.getBestPerformingAgents(
        capabilityId,
        limit
      );
      
      if (bestPerforming.length > 0) {
        return bestPerforming.map(result => result.agentId);
      }
      
      // Fall back to regular findProviders if no metrics exist
      return this.findProviders(capabilityId, {
        minimumProficiency: 0.5 // Reasonable default
      });
    } catch (error) {
      console.error(`Error finding best providers for capability ${capabilityId}:`, error);
      // Fall back to regular provider search
      return this.findProviders(capabilityId);
    }
  }

  /**
   * Get performance metrics for a capability
   */
  async getCapabilityMetrics(
    agentId: string,
    capabilityId: string
  ): Promise<CapabilityPerformanceMetrics | null> {
    return this.metricsService.getCapabilityPerformance(agentId, capabilityId);
  }

  /**
   * Record usage of a capability with performance data
   */
  async recordCapabilityUsage(
    agentId: string,
    capabilityId: string,
    success: boolean,
    duration: number,
    options: {
      latency?: number;
      tokenCount?: number;
      confidenceScore?: number;
      qualityScore?: number;
      context?: {
        requestId?: string;
        chatId?: string;
        taskId?: string;
      };
    } = {}
  ): Promise<void> {
    try {
      // Verify the capability is registered for this agent
      const capabilities = await this.getAgentCapabilities(agentId);
      const hasCapability = capabilities.some(cap => cap.capabilityId === capabilityId);
      
      if (!hasCapability) {
        console.warn(`Agent ${agentId} does not have capability ${capabilityId} registered`);
        return;
      }
      
      // Record the usage
      await this.metricsService.recordCapabilityUsage(
        agentId,
        capabilityId,
        {
          duration,
          success,
          latency: options.latency || duration, // Default to duration if latency not provided
          tokenCount: options.tokenCount,
          confidenceScore: options.confidenceScore,
          qualityScore: options.qualityScore,
          context: options.context
        }
      );
    } catch (error) {
      console.error(`Error recording capability usage for ${capabilityId} by agent ${agentId}:`, error);
    }
  }

  /**
   * Update capability levels based on performance metrics
   */
  async updateCapabilityLevels(agentId: string): Promise<{
    updated: number;
    unchanged: number;
  }> {
    try {
      // Get all capabilities for the agent
      const capabilities = await this.getAgentCapabilities(agentId);
      
      let updated = 0;
      let unchanged = 0;
      
      // Update each capability level based on performance
      for (const capability of capabilities) {
        const result = await this.metricsService.updateCapabilityLevel(
          agentId,
          capability.capabilityId
        );
        
        if (result) {
          if (result.previousLevel !== result.newLevel) {
            updated++;
          } else {
            unchanged++;
          }
        } else {
          unchanged++;
        }
      }
      
      return { updated, unchanged };
    } catch (error) {
      console.error(`Error updating capability levels for agent ${agentId}:`, error);
      return { updated: 0, unchanged: 0 };
    }
  }
} 