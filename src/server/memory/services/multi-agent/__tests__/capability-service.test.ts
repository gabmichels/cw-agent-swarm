import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultCapabilityMemoryService } from '../capability-service';
import { CapabilityMemoryEntity } from '../../../schema/capability';
import { CapabilityType } from '../../../../../agents/shared/capability-system/types';
import { MemoryType } from '../../../config/types';
import { BaseMemorySchema, MemoryPoint } from '../../../models';

// Create a mock implementation for MemoryService
const mockAddMemory = vi.fn();
const mockGetMemory = vi.fn();
const mockUpdateMemory = vi.fn();
const mockDeleteMemory = vi.fn();
const mockSearchMemories = vi.fn();

// Mock the entire module
vi.mock('../../../services/memory/memory-service', () => {
  return {
    MemoryService: function() {
      return {
        addMemory: mockAddMemory,
        getMemory: mockGetMemory,
        updateMemory: mockUpdateMemory,
        deleteMemory: mockDeleteMemory,
        searchMemories: mockSearchMemories
      };
    },
    MemoryErrorCode: {
      NOT_FOUND: 'NOT_FOUND',
      INVALID_TYPE: 'INVALID_TYPE',
      DUPLICATE: 'DUPLICATE',
      VALIDATION_FAILED: 'VALIDATION_FAILED',
      QUERY_FAILED: 'QUERY_FAILED',
      EMBEDDING_FAILED: 'EMBEDDING_FAILED',
      CONNECTION_FAILED: 'CONNECTION_FAILED',
      TRANSACTION_FAILED: 'TRANSACTION_FAILED',
      INVALID_OPERATION: 'INVALID_OPERATION',
      UNKNOWN: 'UNKNOWN'
    }
  };
});

describe('DefaultCapabilityMemoryService', () => {
  let capabilityService: DefaultCapabilityMemoryService;
  let mockMemoryClient: any;
  let mockEmbeddingService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock memory client and embedding service
    mockMemoryClient = {
      getEmbeddingService: vi.fn()
    };
    mockEmbeddingService = {
      embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };
    mockMemoryClient.getEmbeddingService.mockReturnValue(mockEmbeddingService);

    // Create service instance
    capabilityService = new DefaultCapabilityMemoryService(mockMemoryClient);
  });

  // Helper function to create a mock memory point
  const createMockMemoryPoint = (metadata: CapabilityMemoryEntity): MemoryPoint<BaseMemorySchema> => ({
    id: metadata.id,
    vector: [0.1, 0.2, 0.3],
    payload: {
      id: metadata.id,
      text: `${metadata.name} - ${metadata.description}`,
      timestamp: new Date().toISOString(),
      type: 'capability' as MemoryType,
      metadata
    }
  });

  describe('createCapability', () => {
    it('should successfully create a capability', async () => {
      // Mock MemoryService.addMemory
      mockAddMemory.mockResolvedValue({ success: true, id: 'test-id' });

      // Test capability
      const capability: CapabilityMemoryEntity = {
        id: 'test-capability',
        name: 'Test Capability',
        description: 'A test capability',
        type: CapabilityType.SKILL,
        version: '1.0.0',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: '1.0',
        metadata: {},
        tags: ['test'],
        domains: ['testing']
      };

      // Call service
      const result = await capabilityService.createCapability(capability);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.id).toBe('test-id');

      // Verify memory service was called correctly
      expect(mockAddMemory).toHaveBeenCalledWith({
        type: 'capability' as MemoryType,
        content: `Test Capability - A test capability - ${CapabilityType.SKILL}`,
        metadata: capability
      });
    });

    it('should handle errors during capability creation', async () => {
      // Mock MemoryService.addMemory to throw
      mockAddMemory.mockRejectedValue(new Error('Test error'));

      // Test capability
      const capability: CapabilityMemoryEntity = {
        id: 'test-capability',
        name: 'Test Capability',
        description: 'A test capability',
        type: CapabilityType.SKILL,
        version: '1.0.0',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: '1.0',
        metadata: {},
        tags: ['test'],
        domains: ['testing']
      };

      // Call service
      const result = await capabilityService.createCapability(capability);

      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CREATE_CAPABILITY_ERROR');
      expect(result.error?.message).toContain('Test error');
    });
  });

  describe('getCapability', () => {
    it('should retrieve a capability by ID', async () => {
      // Mock capability
      const mockCapability: CapabilityMemoryEntity = {
        id: 'test-capability',
        name: 'Test Capability',
        description: 'A test capability',
        type: CapabilityType.SKILL,
        version: '1.0.0',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: '1.0',
        metadata: {},
        tags: ['test'],
        domains: ['testing']
      };

      // Mock memory service response with proper schema
      mockGetMemory.mockResolvedValue(createMockMemoryPoint(mockCapability));

      // Call service
      const result = await capabilityService.getCapability('test-capability');

      // Verify result
      expect(result).toEqual(mockCapability);
    });

    it('should return null when capability is not found', async () => {
      // Mock memory service to return null
      mockGetMemory.mockResolvedValue(null);

      // Call service
      const result = await capabilityService.getCapability('non-existent');

      // Verify result
      expect(result).toBeNull();
    });

    it('should handle errors during capability retrieval', async () => {
      // Mock memory service to throw
      mockGetMemory.mockRejectedValue(new Error('Test error'));

      // Call service
      const result = await capabilityService.getCapability('test-capability');

      // Verify error handling
      expect(result).toBeNull();
    });
  });

  describe('updateCapability', () => {
    it('should successfully update a capability', async () => {
      // Mock memory service
      mockUpdateMemory.mockResolvedValue(true);

      // Test capability
      const capability: CapabilityMemoryEntity = {
        id: 'test-capability',
        name: 'Updated Capability',
        description: 'An updated test capability',
        type: CapabilityType.SKILL,
        version: '1.1.0',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: '1.0',
        metadata: {},
        tags: ['test', 'updated'],
        domains: ['testing']
      };

      // Call service
      const result = await capabilityService.updateCapability(capability);

      // Verify result
      expect(result).toBe(true);

      // Verify memory service was called correctly
      expect(mockUpdateMemory).toHaveBeenCalledWith({
        type: 'capability' as MemoryType,
        id: 'test-capability',
        content: `Updated Capability - An updated test capability - ${CapabilityType.SKILL}`,
        metadata: capability
      });
    });

    it('should handle errors during capability update', async () => {
      // Mock memory service to throw
      mockUpdateMemory.mockRejectedValue(new Error('Test error'));

      // Test capability
      const capability: CapabilityMemoryEntity = {
        id: 'test-capability',
        name: 'Test Capability',
        description: 'A test capability',
        type: CapabilityType.SKILL,
        version: '1.0.0',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: '1.0',
        metadata: {},
        tags: ['test'],
        domains: ['testing']
      };

      // Call service
      const result = await capabilityService.updateCapability(capability);

      // Verify error handling
      expect(result).toBe(false);
    });
  });

  describe('deleteCapability', () => {
    it('should successfully delete a capability', async () => {
      // Mock memory service
      mockDeleteMemory.mockResolvedValue(true);

      // Call service
      const result = await capabilityService.deleteCapability('test-capability');

      // Verify result
      expect(result).toBe(true);

      // Verify memory service was called correctly
      expect(mockDeleteMemory).toHaveBeenCalledWith({
        type: 'capability' as MemoryType,
        id: 'test-capability'
      });
    });

    it('should handle errors during capability deletion', async () => {
      // Mock memory service to throw
      mockDeleteMemory.mockRejectedValue(new Error('Test error'));

      // Call service
      const result = await capabilityService.deleteCapability('test-capability');

      // Verify error handling
      expect(result).toBe(false);
    });
  });

  describe('findCapabilitiesByType', () => {
    it('should find capabilities by type', async () => {
      // Mock capabilities
      const mockCapabilities: CapabilityMemoryEntity[] = [
        {
          id: 'test-capability-1',
          name: 'Test Capability 1',
          description: 'A test capability',
          type: CapabilityType.SKILL,
          version: '1.0.0',
          content: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: '1.0',
          metadata: {},
          tags: ['test'],
          domains: ['testing']
        },
        {
          id: 'test-capability-2',
          name: 'Test Capability 2',
          description: 'Another test capability',
          type: CapabilityType.SKILL,
          version: '1.0.0',
          content: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: '1.0',
          metadata: {},
          tags: ['test'],
          domains: ['testing']
        }
      ];

      // Mock memory service with proper schema
      mockSearchMemories.mockResolvedValue(mockCapabilities.map(cap => createMockMemoryPoint(cap)));

      // Call service
      const result = await capabilityService.findCapabilitiesByType(CapabilityType.SKILL);

      // Verify result
      expect(result).toEqual(mockCapabilities);
    });

    it('should handle errors during capability search by type', async () => {
      // Mock memory service to throw
      mockSearchMemories.mockRejectedValue(new Error('Test error'));

      // Call service
      const result = await capabilityService.findCapabilitiesByType(CapabilityType.SKILL);

      // Verify error handling
      expect(result).toEqual([]);
    });
  });

  describe('searchCapabilities', () => {
    it('should search capabilities by text', async () => {
      // Mock capabilities
      const mockCapabilities: CapabilityMemoryEntity[] = [
        {
          id: 'test-capability-1',
          name: 'Search Capability',
          description: 'A searchable capability',
          type: CapabilityType.SKILL,
          version: '1.0.0',
          content: '',
          createdAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: '1.0',
          metadata: {},
          tags: ['search'],
          domains: ['testing']
        }
      ];

      // Mock memory service with proper schema
      mockSearchMemories.mockResolvedValue(mockCapabilities.map(cap => createMockMemoryPoint(cap)));

      // Call service
      const result = await capabilityService.searchCapabilities('search');

      // Verify result
      expect(result).toEqual(mockCapabilities);
    });

    it('should handle errors during capability text search', async () => {
      // Mock memory service to throw
      mockSearchMemories.mockRejectedValue(new Error('Test error'));

      // Call service
      const result = await capabilityService.searchCapabilities('search');

      // Verify error handling
      expect(result).toEqual([]);
    });
  });
}); 