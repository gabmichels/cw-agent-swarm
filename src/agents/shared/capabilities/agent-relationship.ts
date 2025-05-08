/**
 * Agent Relationship Service
 * 
 * This module provides services for tracking and analyzing agent-to-agent relationships
 * to enable relationship-aware collaboration and intelligent task delegation.
 */

import { AnyMemoryService } from '../../../server/memory/services/memory/memory-service-wrappers';
import { MemoryType } from '../../../server/memory/config/types';
import { StructuredId, structuredIdToString } from '../../../types/structured-id';
import { v4 as uuidv4 } from 'uuid';

/**
 * Relationship types between agents
 */
export enum RelationshipType {
  COLLABORATION = 'collaboration',
  SUPERVISION = 'supervision',
  DELEGATION = 'delegation',
  COMPETITION = 'competition',
  CUSTOM = 'custom'
}

/**
 * Agent relationship record tracking the relationship between two agents
 */
export interface AgentRelationship {
  // Core identity
  id: string;
  agent1Id: string;
  agent2Id: string;
  
  // Relationship details
  relationshipType: RelationshipType;
  strength: number; // 0-100 score
  trustLevel: number; // 0-100 score
  description: string;
  
  // Interaction tracking
  interactionCount: number;
  successfulInteractions: number;
  lastInteraction: number; // timestamp
  averageResponseTime: number; // in milliseconds
  
  // Collaboration metrics
  collaborationScore: number; // 0-100 score
  taskCompletionRate: number; // 0-1 rate
  commonDomains: string[];
  complementaryCapabilities: {
    agent1Capability: string;
    agent2Capability: string;
    effectiveness: number; // 0-100 score
  }[];
  
  // Metadata
  establishedAt: number; // timestamp
  updatedAt: number; // timestamp
  metadata?: Record<string, unknown>;
}

/**
 * Relationship update options
 */
export interface RelationshipUpdateOptions {
  // Relationship details
  relationshipType?: RelationshipType;
  strength?: number;
  trustLevel?: number;
  description?: string;
  
  // Interaction details
  successful?: boolean;
  responseTime?: number;
  
  // Task details
  taskCompleted?: boolean;
  
  // Capability details
  agent1Capability?: string;
  agent2Capability?: string;
  capabilityEffectiveness?: number;
  
  // Domain details
  commonDomains?: string[];
  
  // Context
  context?: {
    requestId?: string;
    chatId?: string;
    taskId?: string;
  };
}

/**
 * Relationship query options
 */
export interface RelationshipQueryOptions {
  relationshipTypes?: RelationshipType[];
  minStrength?: number;
  minTrustLevel?: number;
  minInteractions?: number;
  minCollaborationScore?: number;
  updatedAfter?: number;
  updatedBefore?: number;
  includeMetadata?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Interface for the agent relationship service
 */
export interface IAgentRelationshipService {
  /**
   * Record or update a relationship between two agents
   */
  recordRelationship(
    agent1Id: string | StructuredId,
    agent2Id: string | StructuredId,
    options: RelationshipUpdateOptions
  ): Promise<AgentRelationship>;
  
  /**
   * Get relationship between two agents
   */
  getRelationship(
    agent1Id: string | StructuredId,
    agent2Id: string | StructuredId
  ): Promise<AgentRelationship | null>;
  
  /**
   * Get all relationships for an agent
   */
  getAgentRelationships(
    agentId: string | StructuredId,
    options?: RelationshipQueryOptions
  ): Promise<AgentRelationship[]>;
  
  /**
   * Find best collaborators for an agent
   */
  findBestCollaborators(
    agentId: string | StructuredId,
    limit?: number
  ): Promise<{ agentId: string; relationship: AgentRelationship }[]>;
  
  /**
   * Find ideal agent pairs for specific capabilities
   */
  findIdealPairs(
    capability1: string,
    capability2: string,
    limit?: number
  ): Promise<{ agent1Id: string; agent2Id: string; effectiveness: number }[]>;
  
  /**
   * Get relationship statistics for an agent
   */
  getRelationshipStats(
    agentId: string | StructuredId
  ): Promise<{
    totalRelationships: number;
    averageStrength: number;
    averageTrustLevel: number;
    topCollaborators: string[];
    mostCommonRelationshipType: RelationshipType;
  }>;
}

// Constants for memory types
const AGENT_RELATIONSHIP_TYPE = 'agent_relationship' as MemoryType;

/**
 * Implementation of the agent relationship service
 */
export class AgentRelationshipService implements IAgentRelationshipService {
  constructor(private readonly memoryService: AnyMemoryService) {}
  
  /**
   * Record or update a relationship between two agents
   */
  async recordRelationship(
    agent1Id: string | StructuredId,
    agent2Id: string | StructuredId,
    options: RelationshipUpdateOptions
  ): Promise<AgentRelationship> {
    // Convert structured IDs to strings if needed
    const agent1IdStr = typeof agent1Id === 'string' ? agent1Id : structuredIdToString(agent1Id);
    const agent2IdStr = typeof agent2Id === 'string' ? agent2Id : structuredIdToString(agent2Id);
    
    // Ensure consistent ordering of agent IDs for relationship lookups
    const [firstAgentId, secondAgentId] = this.orderAgentIds(agent1IdStr, agent2IdStr);
    
    // Look for existing relationship
    const existingRelationship = await this.getRelationship(firstAgentId, secondAgentId);
    
    if (existingRelationship) {
      // Update existing relationship
      return this.updateRelationship(existingRelationship, options);
    } else {
      // Create new relationship
      return this.createRelationship(firstAgentId, secondAgentId, options);
    }
  }
  
  /**
   * Get relationship between two agents
   */
  async getRelationship(
    agent1Id: string | StructuredId,
    agent2Id: string | StructuredId
  ): Promise<AgentRelationship | null> {
    // Convert structured IDs to strings if needed
    const agent1IdStr = typeof agent1Id === 'string' ? agent1Id : structuredIdToString(agent1Id);
    const agent2IdStr = typeof agent2Id === 'string' ? agent2Id : structuredIdToString(agent2Id);
    
    // Ensure consistent ordering of agent IDs for relationship lookups
    const [firstAgentId, secondAgentId] = this.orderAgentIds(agent1IdStr, agent2IdStr);
    
    // Search for the relationship
    const relationships = await this.memoryService.searchMemories({
      type: AGENT_RELATIONSHIP_TYPE,
      filter: {
        'metadata.agent1Id': firstAgentId,
        'metadata.agent2Id': secondAgentId
      },
      limit: 1
    });
    
    // Return null if no relationship found
    if (relationships.length === 0) {
      return null;
    }
    
    // Return the relationship
    return relationships[0].payload.metadata as unknown as AgentRelationship;
  }
  
  /**
   * Get all relationships for an agent
   */
  async getAgentRelationships(
    agentId: string | StructuredId,
    options: RelationshipQueryOptions = {}
  ): Promise<AgentRelationship[]> {
    // Convert structured ID to string if needed
    const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
    
    // Build the filter
    const filter: Record<string, unknown> = {
      $or: [
        { 'metadata.agent1Id': agentIdStr },
        { 'metadata.agent2Id': agentIdStr }
      ]
    };
    
    // Add relationship type filter if specified
    if (options.relationshipTypes && options.relationshipTypes.length > 0) {
      filter['metadata.relationshipType'] = {
        $in: options.relationshipTypes
      };
    }
    
    // Add strength filter if specified
    if (options.minStrength !== undefined) {
      filter['metadata.strength'] = { $gte: options.minStrength };
    }
    
    // Add trust level filter if specified
    if (options.minTrustLevel !== undefined) {
      filter['metadata.trustLevel'] = { $gte: options.minTrustLevel };
    }
    
    // Add interaction count filter if specified
    if (options.minInteractions !== undefined) {
      filter['metadata.interactionCount'] = { $gte: options.minInteractions };
    }
    
    // Add collaboration score filter if specified
    if (options.minCollaborationScore !== undefined) {
      filter['metadata.collaborationScore'] = { $gte: options.minCollaborationScore };
    }
    
    // Add updated timestamp filters if specified
    if (options.updatedAfter !== undefined) {
      filter['metadata.updatedAt'] = { $gte: options.updatedAfter };
    }
    
    if (options.updatedBefore !== undefined) {
      if (filter['metadata.updatedAt']) {
        (filter['metadata.updatedAt'] as Record<string, unknown>).$lte = options.updatedBefore;
      } else {
        filter['metadata.updatedAt'] = { $lte: options.updatedBefore };
      }
    }
    
    // Execute the search
    const relationships = await this.memoryService.searchMemories({
      type: AGENT_RELATIONSHIP_TYPE,
      filter,
      limit: options.limit || 100,
      offset: options.offset || 0
    });
    
    // Map to relationship objects
    return relationships.map(r => r.payload.metadata as unknown as AgentRelationship);
  }
  
  /**
   * Find best collaborators for an agent
   */
  async findBestCollaborators(
    agentId: string | StructuredId,
    limit: number = 5
  ): Promise<{ agentId: string; relationship: AgentRelationship }[]> {
    // Get all relationships for the agent
    const relationships = await this.getAgentRelationships(agentId, {
      limit: 100 // Get a larger set to filter from
    });
    
    // Map to collaborator info
    const collaborators = relationships.map(relationship => {
      // Convert structured ID to string if needed
      const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
      
      // Determine which agent ID is the collaborator
      const collaboratorId = relationship.agent1Id === agentIdStr
        ? relationship.agent2Id
        : relationship.agent1Id;
      
      return {
        agentId: collaboratorId,
        relationship
      };
    });
    
    // Sort by collaboration score, then by strength
    collaborators.sort((a, b) => {
      if (a.relationship.collaborationScore !== b.relationship.collaborationScore) {
        return b.relationship.collaborationScore - a.relationship.collaborationScore;
      }
      return b.relationship.strength - a.relationship.strength;
    });
    
    // Return top N
    return collaborators.slice(0, limit);
  }
  
  /**
   * Find ideal agent pairs for specific capabilities
   */
  async findIdealPairs(
    capability1: string,
    capability2: string,
    limit: number = 5
  ): Promise<{ agent1Id: string; agent2Id: string; effectiveness: number }[]> {
    // Search for relationships with complementary capabilities
    const relationships = await this.memoryService.searchMemories({
      type: AGENT_RELATIONSHIP_TYPE,
      filter: {
        $or: [
          {
            'metadata.complementaryCapabilities.agent1Capability': capability1,
            'metadata.complementaryCapabilities.agent2Capability': capability2
          },
          {
            'metadata.complementaryCapabilities.agent1Capability': capability2,
            'metadata.complementaryCapabilities.agent2Capability': capability1
          }
        ]
      },
      limit: 100 // Get a larger set to filter from
    });
    
    if (relationships.length === 0) {
      return [];
    }
    
    // Extract and map the relationships
    const pairs: { agent1Id: string; agent2Id: string; effectiveness: number }[] = [];
    
    for (const rel of relationships) {
      const relationship = rel.payload.metadata as unknown as AgentRelationship;
      
      // Find the complementary capability pair
      const complementary = relationship.complementaryCapabilities.find(
        cc => (cc.agent1Capability === capability1 && cc.agent2Capability === capability2) ||
              (cc.agent1Capability === capability2 && cc.agent2Capability === capability1)
      );
      
      if (complementary) {
        pairs.push({
          agent1Id: relationship.agent1Id,
          agent2Id: relationship.agent2Id,
          effectiveness: complementary.effectiveness
        });
      }
    }
    
    // Sort by effectiveness
    pairs.sort((a, b) => b.effectiveness - a.effectiveness);
    
    // Return top N
    return pairs.slice(0, limit);
  }
  
  /**
   * Get relationship statistics for an agent
   */
  async getRelationshipStats(
    agentId: string | StructuredId
  ): Promise<{
    totalRelationships: number;
    averageStrength: number;
    averageTrustLevel: number;
    topCollaborators: string[];
    mostCommonRelationshipType: RelationshipType;
  }> {
    // Get all relationships for the agent
    const relationships = await this.getAgentRelationships(agentId);
    
    if (relationships.length === 0) {
      return {
        totalRelationships: 0,
        averageStrength: 0,
        averageTrustLevel: 0,
        topCollaborators: [],
        mostCommonRelationshipType: RelationshipType.COLLABORATION // Default
      };
    }
    
    // Calculate average strength
    const totalStrength = relationships.reduce((sum, rel) => sum + rel.strength, 0);
    const averageStrength = totalStrength / relationships.length;
    
    // Calculate average trust level
    const totalTrustLevel = relationships.reduce((sum, rel) => sum + rel.trustLevel, 0);
    const averageTrustLevel = totalTrustLevel / relationships.length;
    
    // Find top collaborators
    const collaborators = relationships.map(relationship => {
      // Convert structured ID to string if needed
      const agentIdStr = typeof agentId === 'string' ? agentId : structuredIdToString(agentId);
      
      // Determine which agent ID is the collaborator
      return relationship.agent1Id === agentIdStr
        ? relationship.agent2Id
        : relationship.agent1Id;
    });
    
    // Find the most common relationship type
    const typeCounts: Record<RelationshipType, number> = {
      [RelationshipType.COLLABORATION]: 0,
      [RelationshipType.SUPERVISION]: 0,
      [RelationshipType.DELEGATION]: 0,
      [RelationshipType.COMPETITION]: 0,
      [RelationshipType.CUSTOM]: 0
    };
    
    relationships.forEach(rel => {
      typeCounts[rel.relationshipType] = (typeCounts[rel.relationshipType] || 0) + 1;
    });
    
    let mostCommonType = RelationshipType.COLLABORATION;
    let maxCount = 0;
    
    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type as RelationshipType;
      }
    });
    
    return {
      totalRelationships: relationships.length,
      averageStrength,
      averageTrustLevel,
      topCollaborators: collaborators.slice(0, 5), // Just return top 5
      mostCommonRelationshipType: mostCommonType
    };
  }
  
  /**
   * Create a new relationship between agents
   */
  private async createRelationship(
    agent1Id: string,
    agent2Id: string,
    options: RelationshipUpdateOptions
  ): Promise<AgentRelationship> {
    const timestamp = Date.now();
    
    // Create relationship record
    const relationship: AgentRelationship = {
      id: uuidv4(),
      agent1Id,
      agent2Id,
      relationshipType: options.relationshipType || RelationshipType.COLLABORATION,
      strength: options.strength || 50, // Default to neutral
      trustLevel: options.trustLevel || 50, // Default to neutral
      description: options.description || '',
      interactionCount: 1, // First interaction
      successfulInteractions: options.successful ? 1 : 0,
      lastInteraction: timestamp,
      averageResponseTime: options.responseTime || 0,
      collaborationScore: 50, // Default to neutral
      taskCompletionRate: 0,
      commonDomains: options.commonDomains || [],
      complementaryCapabilities: [],
      establishedAt: timestamp,
      updatedAt: timestamp
    };
    
    // Add complementary capability if provided
    if (options.agent1Capability && options.agent2Capability) {
      relationship.complementaryCapabilities.push({
        agent1Capability: options.agent1Capability,
        agent2Capability: options.agent2Capability,
        effectiveness: options.capabilityEffectiveness || 50 // Default to neutral
      });
    }
    
    // Store in memory
    await this.memoryService.addMemory({
      type: AGENT_RELATIONSHIP_TYPE,
      content: `${agent1Id}:${agent2Id}:relationship`,
      metadata: relationship
    });
    
    return relationship;
  }
  
  /**
   * Update an existing relationship
   */
  private async updateRelationship(
    relationship: AgentRelationship,
    options: RelationshipUpdateOptions
  ): Promise<AgentRelationship> {
    const timestamp = Date.now();
    
    // Update interaction stats
    const newInteractionCount = relationship.interactionCount + 1;
    const newSuccessfulInteractions = relationship.successfulInteractions +
      (options.successful ? 1 : 0);
    
    // Update response time average
    let newAverageResponseTime = relationship.averageResponseTime;
    if (options.responseTime !== undefined) {
      const totalResponseTime = relationship.averageResponseTime * relationship.interactionCount +
        options.responseTime;
      newAverageResponseTime = totalResponseTime / newInteractionCount;
    }
    
    // Update task completion rate
    let newTaskCompletionRate = relationship.taskCompletionRate;
    if (options.taskCompleted !== undefined) {
      // We assume task completion is being tracked separately from general interaction success
      const totalCompleted = relationship.taskCompletionRate * relationship.interactionCount +
        (options.taskCompleted ? 1 : 0);
      newTaskCompletionRate = totalCompleted / newInteractionCount;
    }
    
    // Update relationship details if provided
    const newRelationshipType = options.relationshipType || relationship.relationshipType;
    const newStrength = options.strength || relationship.strength;
    const newTrustLevel = options.trustLevel || relationship.trustLevel;
    const newDescription = options.description || relationship.description;
    
    // Calculate a collaboration score based on success rate, task completion, and trust
    const successRate = newSuccessfulInteractions / newInteractionCount;
    const newCollaborationScore = Math.round(
      (successRate * 0.4 + newTaskCompletionRate * 0.4 + (newTrustLevel / 100) * 0.2) * 100
    );
    
    // Update common domains
    const newCommonDomains = [...relationship.commonDomains];
    if (options.commonDomains) {
      options.commonDomains.forEach(domain => {
        if (!newCommonDomains.includes(domain)) {
          newCommonDomains.push(domain);
        }
      });
    }
    
    // Update complementary capabilities
    const newComplementaryCapabilities = [...relationship.complementaryCapabilities];
    if (options.agent1Capability && options.agent2Capability) {
      // Check if this capability pair already exists
      const existingIndex = newComplementaryCapabilities.findIndex(
        cc => cc.agent1Capability === options.agent1Capability &&
              cc.agent2Capability === options.agent2Capability
      );
      
      if (existingIndex >= 0 && options.capabilityEffectiveness !== undefined) {
        // Update existing capability effectiveness
        newComplementaryCapabilities[existingIndex].effectiveness = options.capabilityEffectiveness;
      } else if (existingIndex === -1) {
        // Add new complementary capability pair
        newComplementaryCapabilities.push({
          agent1Capability: options.agent1Capability,
          agent2Capability: options.agent2Capability,
          effectiveness: options.capabilityEffectiveness || 50 // Default to neutral
        });
      }
    }
    
    // Create updated relationship
    const updatedRelationship: AgentRelationship = {
      ...relationship,
      relationshipType: newRelationshipType,
      strength: newStrength,
      trustLevel: newTrustLevel,
      description: newDescription,
      interactionCount: newInteractionCount,
      successfulInteractions: newSuccessfulInteractions,
      lastInteraction: timestamp,
      averageResponseTime: newAverageResponseTime,
      collaborationScore: newCollaborationScore,
      taskCompletionRate: newTaskCompletionRate,
      commonDomains: newCommonDomains,
      complementaryCapabilities: newComplementaryCapabilities,
      updatedAt: timestamp
    };
    
    // Update in memory
    await this.memoryService.updateMemory({
      type: AGENT_RELATIONSHIP_TYPE,
      id: relationship.id,
      metadata: updatedRelationship
    });
    
    return updatedRelationship;
  }
  
  /**
   * Ensure consistent ordering of agent IDs
   * This is important for relationship lookups to be consistent
   */
  private orderAgentIds(agent1Id: string, agent2Id: string): [string, string] {
    return agent1Id < agent2Id
      ? [agent1Id, agent2Id]
      : [agent2Id, agent1Id];
  }
} 