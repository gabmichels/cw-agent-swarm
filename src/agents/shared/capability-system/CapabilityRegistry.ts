import { 
  Capability,
  CapabilityLevel,
  CapabilityQueryOptions,
  CapabilityType,
  ICapabilityRegistry,
  parseCapabilityId
} from './types';

/**
 * Registry entry for an agent's capabilities
 */
interface AgentCapabilityEntry {
  agentId: string;
  capabilities: Map<string, CapabilityLevel>;
  domains: Set<string>;
  roles: Set<string>;
  tags: Set<string>;
}

/**
 * Implementation of the capability registry service
 */
export class CapabilityRegistry implements ICapabilityRegistry {
  // Singleton instance
  private static instance: CapabilityRegistry;

  // Maps for capability registration
  private capabilities: Map<string, Capability> = new Map();
  private agentCapabilities: Map<string, AgentCapabilityEntry> = new Map();

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): CapabilityRegistry {
    if (!CapabilityRegistry.instance) {
      CapabilityRegistry.instance = new CapabilityRegistry();
    }
    return CapabilityRegistry.instance;
  }

  /**
   * Register a capability definition
   */
  async registerCapability(capability: Capability): Promise<void> {
    if (!capability.id) {
      throw new Error('Capability ID is required');
    }

    // Validate capability ID format
    try {
      parseCapabilityId(capability.id);
    } catch (error) {
      throw new Error(`Invalid capability ID format: ${capability.id}`);
    }

    this.capabilities.set(capability.id, { ...capability });
    console.log(`Registered capability: ${capability.id}`);
  }

  /**
   * Register an agent's capabilities
   */
  async registerAgentCapabilities(
    agentId: string,
    capabilities: Record<string, CapabilityLevel>,
    options?: {
      preferredDomains?: string[];
      primaryRoles?: string[];
    }
  ): Promise<void> {
    if (!agentId) {
      throw new Error('Agent ID is required');
    }

    // Get or create agent entry
    let agentEntry = this.agentCapabilities.get(agentId);
    if (!agentEntry) {
      agentEntry = {
        agentId,
        capabilities: new Map(),
        domains: new Set(),
        roles: new Set(),
        tags: new Set()
      };
      this.agentCapabilities.set(agentId, agentEntry);
    }

    // Register all capabilities
    for (const [capabilityId, level] of Object.entries(capabilities)) {
      // Validate capability ID
      try {
        const parsedId = parseCapabilityId(capabilityId);
        
        // Auto-register the capability if it doesn't exist
        if (!this.capabilities.has(capabilityId)) {
          await this.registerCapability({
            id: capabilityId,
            type: parsedId.type,
            name: parsedId.name
          });
        }

        // Add to agent's capabilities
        agentEntry.capabilities.set(capabilityId, level);

        // Categorize by type
        if (parsedId.type === CapabilityType.DOMAIN) {
          agentEntry.domains.add(parsedId.name);
        } else if (parsedId.type === CapabilityType.ROLE) {
          agentEntry.roles.add(parsedId.name);
        } else if (parsedId.type === CapabilityType.TAG) {
          agentEntry.tags.add(parsedId.name);
        }
      } catch (error) {
        console.warn(`Skipping invalid capability ID: ${capabilityId}`, error);
      }
    }

    // Add preferred domains if provided
    if (options?.preferredDomains) {
      for (const domain of options.preferredDomains) {
        agentEntry.domains.add(domain);
        const domainId = `${CapabilityType.DOMAIN}.${domain}`;
        
        // Auto-register domain capability if it doesn't exist
        if (!this.capabilities.has(domainId)) {
          await this.registerCapability({
            id: domainId,
            type: CapabilityType.DOMAIN,
            name: domain
          });
        }
      }
    }

    // Add primary roles if provided
    if (options?.primaryRoles) {
      for (const role of options.primaryRoles) {
        agentEntry.roles.add(role);
        const roleId = `${CapabilityType.ROLE}.${role}`;
        
        // Auto-register role capability if it doesn't exist
        if (!this.capabilities.has(roleId)) {
          await this.registerCapability({
            id: roleId,
            type: CapabilityType.ROLE,
            name: role
          });
        }
      }
    }

    console.log(`Registered ${agentEntry.capabilities.size} capabilities for agent: ${agentId}`);
  }

  /**
   * Get capabilities for a specific agent
   */
  async getAgentCapabilities(agentId: string): Promise<Record<string, CapabilityLevel> | null> {
    const agentEntry = this.agentCapabilities.get(agentId);
    if (!agentEntry) {
      return null;
    }

    // Convert Map to Record
    const capabilities: Record<string, CapabilityLevel> = {};
    agentEntry.capabilities.forEach((level, id) => {
      capabilities[id] = level;
    });

    return capabilities;
  }

  /**
   * Check if an agent has a specific capability
   */
  async hasCapability(agentId: string, capabilityId: string): Promise<boolean> {
    const agentEntry = this.agentCapabilities.get(agentId);
    if (!agentEntry) {
      return false;
    }

    return agentEntry.capabilities.has(capabilityId);
  }

  /**
   * Find agents with specific capabilities
   */
  async findAgentsWithCapability(
    capabilityId: string,
    options?: CapabilityQueryOptions
  ): Promise<string[]> {
    const results: string[] = [];
    const minLevel = options?.minLevel || CapabilityLevel.BASIC;
    
    // Level priority for comparison
    const levelPriority: Record<CapabilityLevel, number> = {
      [CapabilityLevel.BASIC]: 0,
      [CapabilityLevel.INTERMEDIATE]: 1,
      [CapabilityLevel.ADVANCED]: 2,
      [CapabilityLevel.EXPERT]: 3
    };

    // Find agents with the capability at or above the minimum level
    this.agentCapabilities.forEach((entry, agentId) => {
      const level = entry.capabilities.get(capabilityId);
      
      if (level && levelPriority[level] >= levelPriority[minLevel]) {
        results.push(agentId);
      }
    });

    // Filter by type if specified
    if (options?.type) {
      try {
        const parsedId = parseCapabilityId(capabilityId);
        const types = Array.isArray(options.type) ? options.type : [options.type];
        
        if (!types.includes(parsedId.type)) {
          return [];
        }
      } catch (error) {
        return [];
      }
    }

    // Filter by tags if specified
    if (options?.tags && options.tags.length > 0) {
      const capability = this.capabilities.get(capabilityId);
      if (!capability || !capability.tags) {
        return [];
      }

      const hasAllTags = options.tags.every(tag => capability.tags?.includes(tag));
      if (!hasAllTags) {
        return [];
      }
    }

    // Apply limit if specified
    if (options?.limit && options.limit > 0 && results.length > options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get a capability definition
   */
  async getCapability(capabilityId: string): Promise<Capability | null> {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      return null;
    }

    return { ...capability };
  }

  /**
   * Get all capabilities for an agent grouped by type
   */
  async getAgentCapabilitiesByType(agentId: string): Promise<Record<CapabilityType, Capability[]>> {
    const agentEntry = this.agentCapabilities.get(agentId);
    if (!agentEntry) {
      return {
        [CapabilityType.SKILL]: [],
        [CapabilityType.ROLE]: [],
        [CapabilityType.DOMAIN]: [],
        [CapabilityType.TAG]: []
      };
    }

    const result: Record<CapabilityType, Capability[]> = {
      [CapabilityType.SKILL]: [],
      [CapabilityType.ROLE]: [],
      [CapabilityType.DOMAIN]: [],
      [CapabilityType.TAG]: []
    };

    agentEntry.capabilities.forEach((level, capabilityId) => {
      const capability = this.capabilities.get(capabilityId);
      if (capability) {
        try {
          const parsedId = parseCapabilityId(capabilityId);
          const capabilityWithLevel = { 
            ...capability, 
            level 
          };
          result[parsedId.type].push(capabilityWithLevel);
        } catch (error) {
          console.warn(`Skipping invalid capability ID: ${capabilityId}`, error);
        }
      }
    });

    return result;
  }

  /**
   * Clear all registry data (mainly for testing)
   */
  clear(): void {
    this.capabilities.clear();
    this.agentCapabilities.clear();
  }
} 