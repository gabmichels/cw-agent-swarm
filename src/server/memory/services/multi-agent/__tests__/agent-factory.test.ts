/**
 * AgentFactory Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentFactory } from '../agent-factory';
import { AgentMemoryEntity, AgentStatus } from '../../../schema/agent';
import { IdGenerator } from '../../../../../utils/ulid';
import { Result, successResult } from '../../../../../lib/errors/base';
import { SchemaType } from '../../../schema/types';
import { IMemoryRepository } from '../../base/types';

// Create the repository functions with proper typing
const mockCreate = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['create']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['create']>>();
const mockGetById = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['getById']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['getById']>>();
const mockUpdate = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['update']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['update']>>();
const mockDelete = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['delete']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['delete']>>();
const mockSearch = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['search']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['search']>>();
const mockSearchByVector = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['searchByVector']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['searchByVector']>>();
const mockFilter = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['filter']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['filter']>>();
const mockGetAll = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['getAll']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['getAll']>>();
const mockCount = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['count']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['count']>>();
const mockExists = vi.fn<Parameters<IMemoryRepository<AgentMemoryEntity>['exists']>, ReturnType<IMemoryRepository<AgentMemoryEntity>['exists']>>();

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
    isValid: (data: unknown): data is AgentMemoryEntity => true,
    validate: vi.fn(),
    getDefaults: vi.fn(),
    create: vi.fn(),
    type: SchemaType.ENTITY,
    version: { 
      major: 1, 
      minor: 0, 
      toString: () => 'v1.0',
      isNewerThan: () => false,
      isCompatibleWith: () => true
    }
  },
  collectionName: 'agents'
};

// Mock the IdGenerator
vi.mock('../../../../../utils/ulid', () => ({
  IdGenerator: {
    generate: vi.fn().mockReturnValue({
      id: 'test-agent-id',
      prefix: 'agent',
      timestamp: new Date(),
      toString: () => 'agent_test-agent-id',
      toULID: () => 'test-agent-id',
      getTimestamp: () => new Date()
    })
  }
}));

describe('AgentFactory', () => {
  let agentFactory: AgentFactory;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create new factory instance
    agentFactory = new AgentFactory(mockRepository);
    
    // Mock the repository create method
    mockCreate.mockImplementation(async (data) => {
      return {
        ...data,
        id: 'agent_test-agent-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 'v1.0'
      };
    });
    
    // Mock the repository getById method
    mockGetById.mockImplementation(async (id) => {
      if (id === 'non-existent-id') {
        return null;
      }
      
      return {
        id: typeof id === 'string' ? id : id.toString(),
        name: 'Test Agent',
        description: 'Test agent description',
        capabilities: [
          {
            id: 'test_capability',
            name: 'Test Capability',
            description: 'Test capability description',
            version: '1.0'
          }
        ],
        parameters: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 2000,
          tools: []
        },
        status: AgentStatus.AVAILABLE,
        lastActive: new Date(),
        createdBy: 'test-user',
        chatIds: [],
        teamIds: [],
        content: 'Test agent description',
        type: 'agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 'v1.0',
        metadata: {
          tags: ['test'],
          domain: ['general'],
          specialization: ['testing'],
          performanceMetrics: {
            successRate: 0,
            averageResponseTime: 0,
            taskCompletionRate: 0
          },
          version: '1.0.0',
          isPublic: true
        }
      };
    });
  });
  
  describe('createAgent', () => {
    it('should create an agent from a template', async () => {
      // Arrange
      const template = {
        name: 'Test Agent',
        description: 'Test agent description',
        capabilities: [
          {
            id: 'test_capability',
            name: 'Test Capability',
            description: 'Test capability description',
            version: '1.0'
          }
        ],
        parameters: {
          model: 'test-model',
          temperature: 0.5,
          maxTokens: 2000,
          tools: []
        },
        metadata: {
          tags: ['test'],
          domain: ['general'],
          specialization: ['testing'],
          isPublic: true
        }
      };
      
      // Act
      const result = await agentFactory.createAgent(template, 'test-user');
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe(template.name);
        expect(result.data.description).toBe(template.description);
        expect(result.data.capabilities).toEqual(template.capabilities);
        expect(result.data.parameters.model).toBe(template.parameters.model);
        expect(result.data.createdBy).toBe('test-user');
        expect(result.data.status).toBe(AgentStatus.AVAILABLE);
        expect(result.data.metadata.tags).toEqual(template.metadata?.tags);
        
        // Verify Agent ID was generated
        expect(IdGenerator.generate).toHaveBeenCalledWith('agent');
      }
      
      // Verify repository was called correctly
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
    
    it('should use default values when not provided in template', async () => {
      // Arrange
      const template = {
        name: 'Minimal Agent',
        capabilities: [],
        parameters: {}
      };
      
      // Act
      const result = await agentFactory.createAgent(template);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe(template.name);
        expect(result.data.description).toBe('');
        expect(result.data.capabilities).toEqual([]);
        expect(result.data.parameters.model).toBe('default');
        expect(result.data.parameters.temperature).toBe(0.7);
        expect(result.data.parameters.maxTokens).toBe(1000);
        expect(result.data.status).toBe(AgentStatus.AVAILABLE);
        expect(result.data.metadata.tags).toEqual([]);
        expect(result.data.metadata.isPublic).toBe(false);
      }
    });
  });
  
  describe('createSpecializedAgent', () => {
    it('should create an assistant agent with default settings', async () => {
      // Act
      const result = await agentFactory.createSpecializedAgent('assistant', 'Test Assistant');
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe('Test Assistant');
        expect(result.data.capabilities.length).toBeGreaterThan(0);
        expect(result.data.metadata.tags).toContain('assistant');
        expect(result.data.parameters.model).toBe('gpt-4.1-2025-04-14');
      }
    });
    
    it('should create a researcher agent with custom parameters', async () => {
      // Arrange
      const customParams = {
        model: 'custom-model',
        temperature: 0.1
      };
      
      // Act
      const result = await agentFactory.createSpecializedAgent(
        'researcher', 
        'Custom Researcher', 
        customParams, 
        'researcher-creator'
      );
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe('Custom Researcher');
        expect(result.data.parameters.model).toBe('custom-model');
        expect(result.data.parameters.temperature).toBe(0.1);
        expect(result.data.createdBy).toBe('researcher-creator');
        expect(result.data.metadata.tags).toContain('researcher');
      }
    });
    
    it('should throw an error for unknown agent type', async () => {
      // Act & Assert
      await expect(agentFactory.createSpecializedAgent('unknown' as any, 'Test')).rejects.toThrow();
    });
  });
  
  describe('cloneAgent', () => {
    it('should clone an existing agent', async () => {
      // Arrange
      const agentId = 'existing-agent-id';
      
      // Act
      const result = await agentFactory.cloneAgent(agentId);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toContain('Clone of');
        expect(result.data.capabilities).toBeDefined();
        expect(result.data.parameters).toBeDefined();
      }
      
      // Verify repository calls
      expect(mockGetById).toHaveBeenCalledWith(agentId);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
    
    it('should return error when agent to clone does not exist', async () => {
      // Arrange
      const nonExistentId = 'non-existent-id';
      mockGetById.mockResolvedValueOnce(null);
      
      // Act
      const result = await agentFactory.cloneAgent(nonExistentId);
      
      // Assert
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });
    
    it('should apply modifications when cloning', async () => {
      // Arrange
      const agentId = 'existing-agent-id';
      const modifications = {
        name: 'Modified Clone',
        description: 'Modified description',
        metadata: {
          tags: ['modified', 'custom']
        }
      };
      
      // Act
      const result = await agentFactory.cloneAgent(agentId, modifications);
      
      // Assert
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      
      if (result.data) {
        expect(result.data.name).toBe('Modified Clone');
        expect(result.data.description).toBe('Modified description');
        expect(result.data.metadata.tags).toEqual(['modified', 'custom']);
      }
    });
  });
}); 