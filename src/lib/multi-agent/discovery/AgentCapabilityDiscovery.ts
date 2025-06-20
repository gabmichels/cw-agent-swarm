/**
 * Agent Capability Discovery Service
 * 
 * Service for discovering and managing agent capabilities for tool delegation.
 * Following IMPLEMENTATION_GUIDELINES.md: ULID, strict typing, DI, pure functions, immutability
 */

import { ulid } from 'ulid';
import { StructuredId } from '../../../types/entity-identifier';
import {
  ToolCapability,
  ToolCapabilityCategory,
  AgentToolCapabilities,
  ToolDelegationError
} from '../delegation/ToolDelegationProtocol';

/**
 * Capability registry entry
 */
export interface CapabilityRegistryEntry {
  readonly id: StructuredId;
  readonly agentId: string;
  readonly capability: ToolCapability;
  readonly registeredAt: Date;
  readonly lastVerified: Date;
  readonly verificationStatus: 'verified' | 'pending' | 'failed';
  readonly performance: Readonly<{
    successRate: number;
    averageExecutionTime: number;
    totalExecutions: number;
    lastExecution?: Date;
  }>;
}

/**
 * Agent discovery criteria
 */
export interface AgentDiscoveryCriteria {
  readonly toolName?: string;
  readonly toolCategory?: ToolCapabilityCategory;
  readonly permissions?: readonly string[];
  readonly maxExecutionTime?: number;
  readonly minReliability?: number;
  readonly minSuccessRate?: number;
  readonly excludeAgents?: readonly string[];
  readonly preferredAgents?: readonly string[];
  readonly maxLoad?: number;
}

/**
 * Discovery result with ranking
 */
export interface AgentDiscoveryResult {
  readonly agentCapabilities: AgentToolCapabilities;
  readonly matchScore: number; // 0-1 score indicating how well the agent matches criteria
  readonly reasoning: readonly string[];
}

/**
 * Capability verification result
 */
export interface CapabilityVerificationResult {
  readonly agentId: string;
  readonly capability: string;
  readonly verified: boolean;
  readonly executionTime?: number;
  readonly error?: string;
  readonly verifiedAt: Date;
}

/**
 * Interface for agent capability discovery
 */
export interface IAgentCapabilityDiscovery {
  /**
   * Register agent capabilities
   */
  registerCapabilities(
    agentId: string,
    capabilities: readonly ToolCapability[]
  ): Promise<readonly CapabilityRegistryEntry[]>;

  /**
   * Discover agents matching criteria
   */
  discoverAgents(
    criteria: AgentDiscoveryCriteria
  ): Promise<readonly AgentDiscoveryResult[]>;

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(agentId: string): Promise<AgentToolCapabilities>;

  /**
   * Verify agent capability
   */
  verifyCapability(
    agentId: string,
    toolName: string
  ): Promise<CapabilityVerificationResult>;

  /**
   * Update capability performance metrics
   */
  updatePerformanceMetrics(
    agentId: string,
    toolName: string,
    metrics: {
      readonly successful: boolean;
      readonly executionTime: number;
    }
  ): Promise<void>;

  /**
   * Get capability registry for debugging
   */
  getCapabilityRegistry(): Promise<readonly CapabilityRegistryEntry[]>;
}

/**
 * In-memory capability registry (could be replaced with persistent storage)
 */
interface CapabilityRegistryStorage {
  readonly entries: Map<string, CapabilityRegistryEntry>;
  readonly agentCapabilities: Map<string, AgentToolCapabilities>;
}

/**
 * Agent capability discovery implementation
 */
export class AgentCapabilityDiscovery implements IAgentCapabilityDiscovery {
  private readonly storage: CapabilityRegistryStorage;

  constructor() {
    this.storage = {
      entries: new Map<string, CapabilityRegistryEntry>(),
      agentCapabilities: new Map<string, AgentToolCapabilities>()
    };
  }

  /**
   * Register agent capabilities
   */
  async registerCapabilities(
    agentId: string,
    capabilities: readonly ToolCapability[]
  ): Promise<readonly CapabilityRegistryEntry[]> {
    if (!agentId) {
      throw new ToolDelegationError(
        'Agent ID is required for capability registration',
        'INVALID_AGENT_ID'
      );
    }

    if (!capabilities || capabilities.length === 0) {
      throw new ToolDelegationError(
        'At least one capability must be provided',
        'INVALID_CAPABILITIES'
      );
    }

    const timestamp = new Date();
    const entries: CapabilityRegistryEntry[] = [];

    for (const capability of capabilities) {
      const entryId = {
        id: ulid(timestamp.getTime()),
        prefix: 'capability_entry',
        timestamp,
        toString: () => `capability_entry_${ulid(timestamp.getTime())}`
      } as StructuredId;

      const entry: CapabilityRegistryEntry = {
        id: entryId,
        agentId,
        capability: Object.freeze({ ...capability }),
        registeredAt: timestamp,
        lastVerified: timestamp,
        verificationStatus: 'pending',
        performance: Object.freeze({
          successRate: 1.0,
          averageExecutionTime: capability.estimatedExecutionTime,
          totalExecutions: 0
        })
      };

      const entryKey = `${agentId}:${capability.name}`;
      this.storage.entries.set(entryKey, entry);
      entries.push(entry);
    }

    // Update agent capabilities summary
    await this.updateAgentCapabilitiesSummary(agentId);

    return Object.freeze(entries);
  }

  /**
   * Discover agents matching criteria
   */
  async discoverAgents(
    criteria: AgentDiscoveryCriteria
  ): Promise<readonly AgentDiscoveryResult[]> {
    const allAgentCapabilities = Array.from(this.storage.agentCapabilities.values());
    const results: AgentDiscoveryResult[] = [];

    for (const agentCapabilities of allAgentCapabilities) {
      if (!agentCapabilities.availability) {
        continue;
      }

      if (criteria.excludeAgents?.includes(agentCapabilities.agentId)) {
        continue;
      }

      if (criteria.maxLoad && agentCapabilities.currentLoad > criteria.maxLoad) {
        continue;
      }

      const matchResult = this.calculateMatchScore(agentCapabilities, criteria);
      if (matchResult.matchScore > 0) {
        results.push(matchResult);
      }
    }

    // Sort by match score (descending) and preferred agents
    const sortedResults = results.sort((a, b) => {
      const aPreferred = criteria.preferredAgents?.includes(a.agentCapabilities.agentId) ?? false;
      const bPreferred = criteria.preferredAgents?.includes(b.agentCapabilities.agentId) ?? false;

      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;

      return b.matchScore - a.matchScore;
    });

    return Object.freeze(sortedResults);
  }

  /**
   * Get agent capabilities
   */
  async getAgentCapabilities(agentId: string): Promise<AgentToolCapabilities> {
    const capabilities = this.storage.agentCapabilities.get(agentId);
    if (!capabilities) {
      throw new ToolDelegationError(
        `No capabilities found for agent: ${agentId}`,
        'AGENT_CAPABILITIES_NOT_FOUND',
        { agentId }
      );
    }

    return capabilities;
  }

  /**
   * Verify agent capability
   */
  async verifyCapability(
    agentId: string,
    toolName: string
  ): Promise<CapabilityVerificationResult> {
    const entryKey = `${agentId}:${toolName}`;
    const entry = this.storage.entries.get(entryKey);

    if (!entry) {
      return {
        agentId,
        capability: toolName,
        verified: false,
        error: 'Capability not found in registry',
        verifiedAt: new Date()
      };
    }

    // For now, we assume verification is successful
    // In a real implementation, this would test the actual capability
    const verificationResult: CapabilityVerificationResult = {
      agentId,
      capability: toolName,
      verified: true,
      executionTime: entry.capability.estimatedExecutionTime,
      verifiedAt: new Date()
    };

    // Update entry verification status
    const updatedEntry: CapabilityRegistryEntry = {
      ...entry,
      lastVerified: verificationResult.verifiedAt,
      verificationStatus: verificationResult.verified ? 'verified' : 'failed'
    };

    this.storage.entries.set(entryKey, updatedEntry);

    return verificationResult;
  }

  /**
   * Update capability performance metrics
   */
  async updatePerformanceMetrics(
    agentId: string,
    toolName: string,
    metrics: {
      readonly successful: boolean;
      readonly executionTime: number;
    }
  ): Promise<void> {
    const entryKey = `${agentId}:${toolName}`;
    const entry = this.storage.entries.get(entryKey);

    if (!entry) {
      throw new ToolDelegationError(
        `Capability entry not found: ${agentId}:${toolName}`,
        'CAPABILITY_ENTRY_NOT_FOUND',
        { agentId, toolName }
      );
    }

    const currentPerformance = entry.performance;
    const newTotalExecutions = currentPerformance.totalExecutions + 1;
    const newSuccessCount = metrics.successful 
      ? Math.floor(currentPerformance.successRate * currentPerformance.totalExecutions) + 1
      : Math.floor(currentPerformance.successRate * currentPerformance.totalExecutions);

    const updatedPerformance = Object.freeze({
      successRate: newSuccessCount / newTotalExecutions,
      averageExecutionTime: (
        (currentPerformance.averageExecutionTime * currentPerformance.totalExecutions) + 
        metrics.executionTime
      ) / newTotalExecutions,
      totalExecutions: newTotalExecutions,
      lastExecution: new Date()
    });

    const updatedEntry: CapabilityRegistryEntry = {
      ...entry,
      performance: updatedPerformance
    };

    this.storage.entries.set(entryKey, updatedEntry);

    // Update agent capabilities summary
    await this.updateAgentCapabilitiesSummary(agentId);
  }

  /**
   * Get capability registry for debugging
   */
  async getCapabilityRegistry(): Promise<readonly CapabilityRegistryEntry[]> {
    return Object.freeze(Array.from(this.storage.entries.values()));
  }

  /**
   * Private: Calculate match score for agent capabilities
   */
  private calculateMatchScore(
    agentCapabilities: AgentToolCapabilities,
    criteria: AgentDiscoveryCriteria
  ): AgentDiscoveryResult {
    const reasoning: string[] = [];
    let score = 0;
    let maxScore = 0;

    // Tool name match
    if (criteria.toolName) {
      maxScore += 0.4;
      const hasCapability = agentCapabilities.capabilities.some(
        cap => cap.name === criteria.toolName
      );
      if (hasCapability) {
        score += 0.4;
        reasoning.push(`Has required tool: ${criteria.toolName}`);
      } else {
        reasoning.push(`Missing required tool: ${criteria.toolName}`);
        return {
          agentCapabilities,
          matchScore: 0,
          reasoning: Object.freeze(reasoning)
        };
      }
    }

    // Category match
    if (criteria.toolCategory) {
      maxScore += 0.3;
      const hasCategory = agentCapabilities.capabilities.some(
        cap => cap.category === criteria.toolCategory
      );
      if (hasCategory) {
        score += 0.3;
        reasoning.push(`Has capabilities in category: ${criteria.toolCategory}`);
      }
    }

    // Reliability check
    if (criteria.minReliability) {
      maxScore += 0.2;
      const meetsReliability = agentCapabilities.capabilities.some(
        cap => cap.reliability >= criteria.minReliability!
      );
      if (meetsReliability) {
        score += 0.2;
        reasoning.push(`Meets reliability requirement: ${criteria.minReliability}`);
      }
    }

    // Load check
    maxScore += 0.1;
    if (agentCapabilities.currentLoad < 0.8) {
      score += 0.1;
      reasoning.push(`Good availability (load: ${agentCapabilities.currentLoad})`);
    }

    return {
      agentCapabilities,
      matchScore: maxScore > 0 ? score / maxScore : 0,
      reasoning: Object.freeze(reasoning)
    };
  }

  /**
   * Private: Update agent capabilities summary
   */
  private async updateAgentCapabilitiesSummary(agentId: string): Promise<void> {
    const agentEntries = Array.from(this.storage.entries.values())
      .filter(entry => entry.agentId === agentId);

    if (agentEntries.length === 0) {
      this.storage.agentCapabilities.delete(agentId);
      return;
    }

    // Calculate average load (simplified)
    const averageLoad = agentEntries.reduce(
      (sum, entry) => sum + (entry.performance.totalExecutions / 100),
      0
    ) / agentEntries.length;

    const capabilities: AgentToolCapabilities = {
      agentId,
      capabilities: Object.freeze(agentEntries.map(entry => entry.capability)),
      currentLoad: Math.min(averageLoad, 1.0),
      availability: true, // Simplified - would check actual agent status
      lastUpdated: new Date()
    };

    this.storage.agentCapabilities.set(agentId, capabilities);
  }
}

/**
 * Pure function to create capability registry entry
 */
export const createCapabilityRegistryEntry = (
  agentId: string,
  capability: ToolCapability
): CapabilityRegistryEntry => {
  const timestamp = new Date();
  const id = {
    id: ulid(timestamp.getTime()),
    prefix: 'capability_entry',
    timestamp,
    toString: () => `capability_entry_${ulid(timestamp.getTime())}`
  } as StructuredId;

  return {
    id,
    agentId,
    capability: Object.freeze({ ...capability }),
    registeredAt: timestamp,
    lastVerified: timestamp,
    verificationStatus: 'pending',
    performance: Object.freeze({
      successRate: 1.0,
      averageExecutionTime: capability.estimatedExecutionTime,
      totalExecutions: 0
    })
  };
}; 