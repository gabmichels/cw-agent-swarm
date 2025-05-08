/**
 * Agent Relationship Service Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentRelationshipService, IAgentRelationshipService, AgentRelationship, RelationshipType } from '../agent-relationship';
import { AnyMemoryService } from '../../../../server/memory/services/memory/memory-service-wrappers';

// Mock memory service with proper typing
const mockAddMemory = vi.fn().mockResolvedValue({ success: true, id: 'test-id' });
const mockSearchMemories = vi.fn();
const mockUpdateMemory = vi.fn().mockResolvedValue({ success: true });

const mockMemoryService = {
  addMemory: mockAddMemory,
  searchMemories: mockSearchMemories,
  updateMemory: mockUpdateMemory
} as unknown as AnyMemoryService;

// Sample agent IDs for testing
const AGENT_1_ID = 'agent_123456';
const AGENT_2_ID = 'agent_789012';

// Sample relationship data
const sampleRelationship: AgentRelationship = {
  id: 'relationship_1',
  agent1Id: AGENT_1_ID,
  agent2Id: AGENT_2_ID,
  relationshipType: RelationshipType.COLLABORATION,
  strength: 75,
  trustLevel: 80,
  description: 'Collaborative research partnership',
  interactionCount: 10,
  successfulInteractions: 8,
  lastInteraction: Date.now() - 86400000, // 1 day ago
  averageResponseTime: 1500, // 1.5 seconds
  collaborationScore: 85,
  taskCompletionRate: 0.8,
  commonDomains: ['research', 'data-analysis'],
  complementaryCapabilities: [
    {
      agent1Capability: 'data_mining',
      agent2Capability: 'natural_language_processing',
      effectiveness: 90
    }
  ],
  establishedAt: Date.now() - 2592000000, // 30 days ago
  updatedAt: Date.now() - 86400000 // 1 day ago
};

describe('AgentRelationshipService', () => {
  let relationshipService: IAgentRelationshipService;
  
  beforeEach(() => {
    // Reset mock function calls
    vi.resetAllMocks();
    
    // Create new service instance
    relationshipService = new AgentRelationshipService(mockMemoryService);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('recordRelationship', () => {
    it('should create a new relationship when none exists', async () => {
      // Mock searchMemories to simulate no existing relationship
      mockSearchMemories.mockResolvedValue([]);
      
      // Options for creating a new relationship
      const options = {
        relationshipType: RelationshipType.COLLABORATION,
        strength: 70,
        trustLevel: 75,
        description: 'New collaborative partnership',
        successful: true,
        responseTime: 1200,
        commonDomains: ['ai', 'research'],
        agent1Capability: 'data_analysis',
        agent2Capability: 'machine_learning',
        capabilityEffectiveness: 85
      };
      
      // Call the service
      const result = await relationshipService.recordRelationship(
        AGENT_1_ID,
        AGENT_2_ID,
        options
      );
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.agent1Id).toBeDefined();
      expect(result.agent2Id).toBeDefined();
      expect(result.relationshipType).toBe(RelationshipType.COLLABORATION);
      expect(result.strength).toBe(70);
      expect(result.trustLevel).toBe(75);
      expect(result.interactionCount).toBe(1);
      expect(result.successfulInteractions).toBe(1);
      expect(result.complementaryCapabilities).toHaveLength(1);
      expect(result.complementaryCapabilities[0].agent1Capability).toBe('data_analysis');
      expect(result.complementaryCapabilities[0].agent2Capability).toBe('machine_learning');
      expect(result.complementaryCapabilities[0].effectiveness).toBe(85);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockAddMemory).toHaveBeenCalledTimes(1);
      expect(mockAddMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_relationship',
        metadata: expect.objectContaining({
          agent1Id: expect.any(String),
          agent2Id: expect.any(String),
          relationshipType: RelationshipType.COLLABORATION
        })
      }));
    });
    
    it('should update an existing relationship', async () => {
      // Mock searchMemories to simulate an existing relationship
      mockSearchMemories.mockResolvedValue([{
        id: 'test-memory-id',
        payload: {
          metadata: sampleRelationship
        }
      }]);
      
      // Options for updating the relationship
      const options = {
        successful: true,
        responseTime: 1000,
        trustLevel: 85
      };
      
      // Call the service
      const result = await relationshipService.recordRelationship(
        AGENT_1_ID,
        AGENT_2_ID,
        options
      );
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.interactionCount).toBe(sampleRelationship.interactionCount + 1);
      expect(result.successfulInteractions).toBe(sampleRelationship.successfulInteractions + 1);
      expect(result.trustLevel).toBe(85);
      expect(result.updatedAt).toBeGreaterThan(sampleRelationship.updatedAt);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockUpdateMemory).toHaveBeenCalledTimes(1);
      expect(mockUpdateMemory).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_relationship',
        id: sampleRelationship.id,
        metadata: expect.objectContaining({
          interactionCount: sampleRelationship.interactionCount + 1,
          successfulInteractions: sampleRelationship.successfulInteractions + 1,
          trustLevel: 85
        })
      }));
    });
    
    it('should handle agent IDs consistently regardless of order', async () => {
      // Mock searchMemories to simulate no existing relationship
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service twice with different order of agent IDs
      await relationshipService.recordRelationship(
        AGENT_1_ID,
        AGENT_2_ID,
        { relationshipType: RelationshipType.COLLABORATION }
      );
      
      // Reset mocks and simulate the first relationship was created
      mockAddMemory.mockClear();
      mockSearchMemories.mockResolvedValue([{
        id: 'test-memory-id',
        payload: {
          metadata: {
            ...sampleRelationship,
            agent1Id: AGENT_1_ID < AGENT_2_ID ? AGENT_1_ID : AGENT_2_ID,
            agent2Id: AGENT_1_ID < AGENT_2_ID ? AGENT_2_ID : AGENT_1_ID
          }
        }
      }]);
      
      // Call with reversed agent IDs
      await relationshipService.recordRelationship(
        AGENT_2_ID,
        AGENT_1_ID,
        { trustLevel: 90 }
      );
      
      // Verify that the update happened and not a new creation
      expect(mockUpdateMemory).toHaveBeenCalledTimes(1);
      expect(mockAddMemory).not.toHaveBeenCalled();
    });
  });
  
  describe('getRelationship', () => {
    it('should return relationship when it exists', async () => {
      // Mock searchMemories to return a relationship
      mockSearchMemories.mockResolvedValue([{
        id: 'test-memory-id',
        payload: {
          metadata: sampleRelationship
        }
      }]);
      
      // Call the service
      const result = await relationshipService.getRelationship(
        AGENT_1_ID,
        AGENT_2_ID
      );
      
      // Verify the result
      expect(result).not.toBeNull();
      expect(result?.id).toBe(sampleRelationship.id);
      expect(result?.agent1Id).toBe(sampleRelationship.agent1Id);
      expect(result?.agent2Id).toBe(sampleRelationship.agent2Id);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_relationship',
        filter: expect.objectContaining({
          'metadata.agent1Id': expect.any(String),
          'metadata.agent2Id': expect.any(String)
        })
      }));
    });
    
    it('should return null when no relationship exists', async () => {
      // Mock searchMemories to return no relationships
      mockSearchMemories.mockResolvedValue([]);
      
      // Call the service
      const result = await relationshipService.getRelationship(
        AGENT_1_ID,
        AGENT_2_ID
      );
      
      // Verify the result
      expect(result).toBeNull();
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('getAgentRelationships', () => {
    it('should return all relationships for an agent', async () => {
      // Create a second sample relationship
      const relationship2 = {
        ...sampleRelationship,
        id: 'relationship_2',
        agent1Id: AGENT_1_ID,
        agent2Id: 'agent_3',
        relationshipType: RelationshipType.DELEGATION
      };
      
      // Mock searchMemories to return multiple relationships
      mockSearchMemories.mockResolvedValue([
        {
          id: 'memory-1',
          payload: {
            metadata: sampleRelationship
          }
        },
        {
          id: 'memory-2',
          payload: {
            metadata: relationship2
          }
        }
      ]);
      
      // Call the service
      const results = await relationshipService.getAgentRelationships(AGENT_1_ID);
      
      // Verify the results
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe(sampleRelationship.id);
      expect(results[1].id).toBe(relationship2.id);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledTimes(1);
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_relationship',
        filter: expect.objectContaining({
          $or: [
            { 'metadata.agent1Id': AGENT_1_ID },
            { 'metadata.agent2Id': AGENT_1_ID }
          ]
        })
      }));
    });
    
    it('should filter relationships based on query options', async () => {
      // Mock search memories to return a result
      mockSearchMemories.mockResolvedValue([
        {
          id: 'memory-1',
          payload: {
            metadata: sampleRelationship
          }
        }
      ]);

      // Call the service with filter options
      await relationshipService.getAgentRelationships(AGENT_1_ID, {
        relationshipTypes: [RelationshipType.COLLABORATION],
        minStrength: 70,
        minTrustLevel: 75,
        minInteractions: 5,
        minCollaborationScore: 80,
        limit: 10,
        offset: 0
      });
      
      // Verify memory service calls with filters
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        filter: expect.objectContaining({
          'metadata.relationshipType': {
            $in: [RelationshipType.COLLABORATION]
          },
          'metadata.strength': { $gte: 70 },
          'metadata.trustLevel': { $gte: 75 },
          'metadata.interactionCount': { $gte: 5 },
          'metadata.collaborationScore': { $gte: 80 }
        }),
        limit: 10,
        offset: 0
      }));
    });
  });
  
  describe('findBestCollaborators', () => {
    it('should return collaborators sorted by collaboration score', async () => {
      // Create multiple relationships with different scores
      const relationship1 = {
        ...sampleRelationship,
        id: 'relationship_1',
        agent1Id: AGENT_1_ID,
        agent2Id: 'agent_2',
        collaborationScore: 90
      };
      
      const relationship2 = {
        ...sampleRelationship,
        id: 'relationship_2',
        agent1Id: AGENT_1_ID,
        agent2Id: 'agent_3',
        collaborationScore: 85
      };
      
      const relationship3 = {
        ...sampleRelationship,
        id: 'relationship_3',
        agent1Id: 'agent_4',
        agent2Id: AGENT_1_ID,
        collaborationScore: 95
      };
      
      // Mock getAgentRelationships to return the relationships
      vi.spyOn(relationshipService, 'getAgentRelationships').mockResolvedValue([
        relationship1,
        relationship2,
        relationship3
      ]);
      
      // Call the service
      const results = await relationshipService.findBestCollaborators(AGENT_1_ID, 2);
      
      // Verify the results
      expect(results).toHaveLength(2);
      expect(results[0].agentId).toBe('agent_4'); // Highest score
      expect(results[1].agentId).toBe('agent_2'); // Second highest
      
      // Verify the results are ordered correctly
      expect(results[0].relationship.collaborationScore).toBe(95);
      expect(results[1].relationship.collaborationScore).toBe(90);
    });
    
    it('should handle no relationships', async () => {
      // Mock getAgentRelationships to return empty array
      vi.spyOn(relationshipService, 'getAgentRelationships').mockResolvedValue([]);
      
      // Call the service
      const results = await relationshipService.findBestCollaborators(AGENT_1_ID);
      
      // Verify the results
      expect(results).toEqual([]);
    });
  });
  
  describe('findIdealPairs', () => {
    it('should find pairs with complementary capabilities', async () => {
      // Create relationships with complementary capabilities
      const relationship1 = {
        ...sampleRelationship,
        id: 'relationship_1',
        agent1Id: 'agent_1',
        agent2Id: 'agent_2',
        complementaryCapabilities: [
          {
            agent1Capability: 'data_mining',
            agent2Capability: 'machine_learning',
            effectiveness: 90
          }
        ]
      };
      
      const relationship2 = {
        ...sampleRelationship,
        id: 'relationship_2',
        agent1Id: 'agent_3',
        agent2Id: 'agent_4',
        complementaryCapabilities: [
          {
            agent1Capability: 'machine_learning',
            agent2Capability: 'data_mining',
            effectiveness: 85
          }
        ]
      };
      
      // Mock searchMemories to return the relationships
      mockSearchMemories.mockResolvedValue([
        {
          id: 'memory-1',
          payload: {
            metadata: relationship1
          }
        },
        {
          id: 'memory-2',
          payload: {
            metadata: relationship2
          }
        }
      ]);
      
      // Call the service
      const results = await relationshipService.findIdealPairs('data_mining', 'machine_learning');
      
      // Verify the results
      expect(results).toHaveLength(2);
      expect(results[0].agent1Id).toBe('agent_1');
      expect(results[0].agent2Id).toBe('agent_2');
      expect(results[0].effectiveness).toBe(90);
      expect(results[1].agent1Id).toBe('agent_3');
      expect(results[1].agent2Id).toBe('agent_4');
      expect(results[1].effectiveness).toBe(85);
      
      // Verify memory service calls
      expect(mockSearchMemories).toHaveBeenCalledWith(expect.objectContaining({
        type: 'agent_relationship',
        filter: expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              'metadata.complementaryCapabilities.agent1Capability': 'data_mining',
              'metadata.complementaryCapabilities.agent2Capability': 'machine_learning'
            })
          ])
        })
      }));
    });
  });
  
  describe('getRelationshipStats', () => {
    it('should return statistics for an agent\'s relationships', async () => {
      // Create multiple relationships with different types
      const relationship1 = {
        ...sampleRelationship,
        agent1Id: AGENT_1_ID,
        agent2Id: 'agent_2',
        relationshipType: RelationshipType.COLLABORATION,
        strength: 80,
        trustLevel: 85
      };
      
      const relationship2 = {
        ...sampleRelationship,
        agent1Id: AGENT_1_ID,
        agent2Id: 'agent_3',
        relationshipType: RelationshipType.COLLABORATION,
        strength: 70,
        trustLevel: 75
      };
      
      const relationship3 = {
        ...sampleRelationship,
        agent1Id: 'agent_4',
        agent2Id: AGENT_1_ID,
        relationshipType: RelationshipType.DELEGATION,
        strength: 60,
        trustLevel: 65
      };
      
      // Mock getAgentRelationships to return the relationships
      vi.spyOn(relationshipService, 'getAgentRelationships').mockResolvedValue([
        relationship1,
        relationship2,
        relationship3
      ]);
      
      // Call the service
      const stats = await relationshipService.getRelationshipStats(AGENT_1_ID);
      
      // Verify the statistics
      expect(stats.totalRelationships).toBe(3);
      expect(stats.averageStrength).toBe((80 + 70 + 60) / 3);
      expect(stats.averageTrustLevel).toBe((85 + 75 + 65) / 3);
      expect(stats.topCollaborators).toContain('agent_2');
      expect(stats.topCollaborators).toContain('agent_3');
      expect(stats.topCollaborators).toContain('agent_4');
      expect(stats.mostCommonRelationshipType).toBe(RelationshipType.COLLABORATION);
    });
    
    it('should handle no relationships', async () => {
      // Mock getAgentRelationships to return empty array
      vi.spyOn(relationshipService, 'getAgentRelationships').mockResolvedValue([]);
      
      // Call the service
      const stats = await relationshipService.getRelationshipStats(AGENT_1_ID);
      
      // Verify default statistics
      expect(stats.totalRelationships).toBe(0);
      expect(stats.averageStrength).toBe(0);
      expect(stats.averageTrustLevel).toBe(0);
      expect(stats.topCollaborators).toEqual([]);
      expect(stats.mostCommonRelationshipType).toBe(RelationshipType.COLLABORATION);
    });
  });
}); 