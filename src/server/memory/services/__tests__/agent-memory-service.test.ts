/**
 * AgentMemoryService Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMemoryService } from '../agent-memory-service';
import { AgentMemoryEntity, AgentStatus, AgentCapability } from '../../schema/agent';
import { FilterOperator } from '../filters/types';
import { IMemoryRepository } from '../base/types';
import { StructuredId } from '../../../../utils/ulid';
import { SchemaType } from '../../schema/types';

// Create a mock repository with proper typing
const mockCreate = vi.fn();
const mockGetById = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSearch = vi.fn();
const mockSearchByVector = vi.fn();
const mockFilter = vi.fn();
const mockGetAll = vi.fn();
const mockCount = vi.fn();
const mockExists = vi.fn();

// Create a mock repository
const mockRepository: IMemoryRepository<AgentMemoryEntity> = {
  create: mockCreate,
  getById: mockGetById,
  update: mockUpdate,
  delete: mockDelete,
  search: mockSearch,
  searchByVector: mockSearchByVector,
  filter: mockFilter,
  getAll: mockGetAll,
  count: mockCount,
  exists: mockExists,
  schema: {
    name: 'agent',
    jsonSchema: {},
    isValid: vi.fn() as unknown as (data: unknown) => data is AgentMemoryEntity,
    validate: vi.fn(),
    getDefaults: vi.fn(),
    create: vi.fn(),
    type: SchemaType.ENTITY,
    version: { 
      major: 1, 
      minor: 0, 
      toString: () => 'v1.0',
      isNewerThan: vi.fn().mockReturnValue(false),
      isCompatibleWith: vi.fn().mockReturnValue(true)
    }
  },
  collectionName: 'agents'
};

// Mock the StructuredId class/functions with proper methods
const mockStructuredId = {
  id: 'test-agent-id',
  prefix: 'agent',
  timestamp: new Date(),
  toString: () => 'agent_test-agent-id',
  toULID: () => 'test-agent-id',
  getTimestamp: () => new Date(),
} as unknown as StructuredId;

describe('AgentMemoryService', () => {
  let agentMemoryService: AgentMemoryService;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create new service instance
    agentMemoryService = new AgentMemoryService(mockRepository);
    
    // Setup mock responses
    mockFilter.mockResolvedValue([
      {
        id: mockStructuredId,
        name: 'Test Agent',
        status: AgentStatus.AVAILABLE,
        capabilities: [
          {
            id: 'test_capability',
            name: 'Test Capability',
            description: 'Test capability description',
            version: '1.0'
          }
        ],
        metadata: {
          tags: ['test', 'assistant'],
          domain: ['general'],
          specialization: ['conversation'],
          performanceMetrics: {
            successRate: 0.95,
            averageResponseTime: 1.2,
            taskCompletionRate: 0.9
          },
          version: '1.0.0',
          isPublic: true
        },
        chatIds: ['chat_123'],
        teamIds: ['team_456']
      },
      {
        id: { 
          id: 'test-agent-id-2', 
          prefix: 'agent',
          timestamp: new Date(),
          toString: () => 'agent_test-agent-id-2',
          toULID: () => 'test-agent-id-2',
          getTimestamp: () => new Date(),
        } as unknown as StructuredId,
        name: 'Another Agent',
        status: AgentStatus.AVAILABLE,
        capabilities: [
          {
            id: 'search',
            name: 'Search',
            description: 'Can search for information',
            version: '1.0'
          }
        ],
        metadata: {
          tags: ['search', 'researcher'],
          domain: ['research'],
          specialization: ['information retrieval'],
          performanceMetrics: {
            successRate: 0.85,
            averageResponseTime: 2.5,
            taskCompletionRate: 0.8
          },
          version: '1.0.0',
          isPublic: true
        },
        chatIds: [],
        teamIds: ['team_456']
      }
    ]);
    
    mockSearch.mockResolvedValue([
      {
        id: mockStructuredId,
        name: 'Test Agent',
        capabilities: [
          {
            id: 'test_capability',
            name: 'Test Capability',
            description: 'Test capability description',
            version: '1.0'
          }
        ]
      }
    ]);
    
    mockUpdate.mockImplementation(async (id: string | StructuredId, updates: Partial<AgentMemoryEntity>) => {
      return {
        id: typeof id === 'string' ? { 
          id, 
          prefix: 'agent',
          timestamp: new Date(),
          toString: () => id,
          toULID: () => id,
          getTimestamp: () => new Date(),
        } as unknown as StructuredId : id,
        name: 'Test Agent',
        ...updates
      };
    });
    
    mockGetById.mockImplementation(async (id: string | StructuredId) => {
      if (id === 'non-existent-id' || id.toString() === 'non-existent-id') {
        return null;
      }
      
      const idStr = typeof id === 'string' ? id : id.toString().split('_')[1];
      
      return {
        id: typeof id === 'string' ? { 
          id, 
          prefix: 'agent',
          timestamp: new Date(),
          toString: () => `agent_${id}`,
          toULID: () => id,
          getTimestamp: () => new Date(),
        } as unknown as StructuredId : id,
        name: 'Test Agent',
        capabilities: [
          {
            id: 'test_capability',
            name: 'Test Capability',
            description: 'Test capability description',
            version: '1.0'
          }
        ],
        status: AgentStatus.AVAILABLE,
        chatIds: ['chat_123'],
        teamIds: ['team_456']
      };
    });
  });
  
  describe('findAgentsByCapability', () => {
    it('should find agents by capability', async () => {
      // Act
      const result = await agentMemoryService.findAgentsByCapability('Test Capability');
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      
      // Verify repository was called correctly with the actual parameters
      expect(mockSearch).toHaveBeenCalledWith(
        'Test Capability', 
        expect.any(Object)
      );
    });
  });
  
  describe('findAvailableAgents', () => {
    it('should find available agents', async () => {
      // Act
      const result = await agentMemoryService.findAvailableAgents();
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBeGreaterThan(0);
      
      // Verify repository was called correctly
      expect(mockFilter).toHaveBeenCalledWith(
        {
          status: {
            operator: FilterOperator.EQUALS,
            value: AgentStatus.AVAILABLE
          }
        },
        { includeDeleted: false }
      );
    });
  });
  
  describe('findAgentsByMetadata', () => {
    it('should find agents by metadata', async () => {
      // Arrange
      const metadata = {
        tags: 'assistant',
        isPublic: true
      };
      
      // Act
      const result = await agentMemoryService.findAgentsByMetadata(metadata);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockFilter).toHaveBeenCalledWith(
        {
          'metadata.tags': {
            operator: FilterOperator.EQUALS,
            value: 'assistant'
          },
          'metadata.isPublic': {
            operator: FilterOperator.EQUALS,
            value: true
          }
        },
        { includeDeleted: false }
      );
    });
  });
  
  describe('updateAgentCapabilities', () => {
    it('should update agent capabilities', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const capabilities: AgentCapability[] = [
        {
          id: 'new_capability',
          name: 'New Capability',
          description: 'New capability description',
          version: '1.0'
        }
      ];
      
      // Act
      const result = await agentMemoryService.updateAgentCapabilities(agentId, capabilities);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.capabilities).toEqual(capabilities);
      }
      
      // Verify repository was called correctly
      expect(mockUpdate).toHaveBeenCalledWith(
        agentId,
        { capabilities }
      );
    });
  });
  
  describe('updateAgentStatus', () => {
    it('should update agent status', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const status = AgentStatus.BUSY;
      
      // Act
      const result = await agentMemoryService.updateAgentStatus(agentId, status);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.status).toEqual(status);
      }
      
      // Verify repository was called with status and lastActive
      expect(mockUpdate).toHaveBeenCalledWith(
        agentId,
        {
          status,
          lastActive: expect.any(Date)
        }
      );
    });
  });
  
  describe('getAgentsByTeam', () => {
    it('should get agents by team ID', async () => {
      // Arrange
      const teamId = 'team_456';
      
      // Act
      const result = await agentMemoryService.getAgentsByTeam(teamId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly with the actual parameters
      expect(mockSearch).toHaveBeenCalledWith(
        teamId,
        expect.any(Object)
      );
    });
  });
  
  describe('addAgentToChat', () => {
    it('should add an agent to a chat', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const chatId = 'chat_new';
      
      // Act
      const result = await agentMemoryService.addAgentToChat(agentId, chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(agentId);
      expect(mockUpdate).toHaveBeenCalled();
    });
    
    it('should not add an agent to a chat it is already in', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const chatId = 'chat_123'; // Already in this chat
      
      // Act
      const result = await agentMemoryService.addAgentToChat(agentId, chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      // Verify repository was called correctly but no update happened
      expect(mockGetById).toHaveBeenCalledWith(agentId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
    
    it('should return null if agent does not exist', async () => {
      // Arrange
      const agentId = 'non-existent-id';
      const chatId = 'chat_new';
      
      // Setup mock response for non-existent agent
      mockGetById.mockResolvedValueOnce(null);
      
      // Act
      const result = await agentMemoryService.addAgentToChat(agentId, chatId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
      
      // Verify repository was called correctly
      expect(mockGetById).toHaveBeenCalledWith(agentId);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
}); 