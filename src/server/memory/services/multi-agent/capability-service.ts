/**
 * Capability Memory Service
 * 
 * This module implements a service for storing and retrieving capabilities
 * from the multi-agent system's memory.
 */
import { MemoryService } from '../../services/memory/memory-service';
import { MemoryResult } from '../../services/memory/types';
import { CapabilityMemoryEntity, capabilitySchema } from '../../schema/capability';
import { MemoryType } from '../../config/types';
import { getMemoryServices } from '../index';

/**
 * Collection name for capabilities
 */
const CAPABILITIES_COLLECTION = 'capabilities';

/**
 * Default capability memory service
 */
export class DefaultCapabilityMemoryService {
  private memoryService: MemoryService | null = null;
  private initializationPromise: Promise<void> | null = null;
  
  constructor(memoryClient?: any) {
    // Start initialization immediately
    this.initializationPromise = this.initializeMemoryService();
  }
  
  /**
   * Initialize the memory service with proper dependencies
   */
  private async initializeMemoryService(): Promise<void> {
    try {
      const { memoryService } = await getMemoryServices();
      this.memoryService = memoryService;
    } catch (error) {
      console.error('Failed to initialize memory service:', error);
      throw error;
    }
  }
  
  /**
   * Ensure memory service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null;
    }
    
    if (!this.memoryService) {
      throw new Error('Memory service failed to initialize');
    }
  }
  
  /**
   * Create a new capability
   * 
   * @param capability Capability to create
   * @returns Result with the capability ID or error
   */
  async createCapability(capability: CapabilityMemoryEntity): Promise<MemoryResult> {
    try {
      await this.ensureInitialized();
      
      // Create content for embedding
      const content = `${capability.name} - ${capability.description} - ${capability.type}`;
      
      // Add capability to memory
      return await this.memoryService!.addMemory({
        type: MemoryType.CAPABILITY_DEFINITION,
        content: content,
        metadata: capability
      });
    } catch (error) {
      console.error(`Failed to create capability: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        success: false,
        error: {
          code: 'CREATE_CAPABILITY_ERROR',
          message: `Failed to create capability: ${error instanceof Error ? error.message : String(error)}`
        }
      };
    }
  }
  
  /**
   * Get a capability by ID
   * 
   * @param id Capability ID
   * @returns The capability or null
   */
  async getCapability(id: string): Promise<CapabilityMemoryEntity | null> {
    try {
      await this.ensureInitialized();
      
      const results = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: '', // Empty query to get all capabilities
        filter: {
          'metadata.id': id
        },
        limit: 1
      });
      
      if (results.length === 0) {
        return null;
      }
      
      return results[0].payload.metadata as CapabilityMemoryEntity;
    } catch (error) {
      console.error(`Failed to get capability: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
  
  /**
   * Update a capability
   * 
   * @param capability Capability to update
   * @returns Success or failure
   */
  async updateCapability(capability: CapabilityMemoryEntity): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // First, try to find existing capability by its string ID
      const results = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: '',
        filter: {
          must: [
            {
              key: 'metadata.id',
              match: { value: capability.id }
            }
          ]
        },
        limit: 1
      });
      
      if (results.length === 0) {
        console.warn(`Capability ${capability.id} not found for update`);
        return false;
      }
      
      const pointId = results[0].id; // Use the actual UUID point ID
      
      // Create content for embedding
      const content = `${capability.name} - ${capability.description} - ${capability.type}`;
      
      // Update capability in memory using the correct point ID
      return await this.memoryService!.updateMemory({
        type: MemoryType.CAPABILITY_DEFINITION,
        id: pointId, // Use UUID point ID, not capability ID
        content,
        metadata: capability
      });
    } catch (error) {
      console.error(`Failed to update capability: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Delete a capability
   * 
   * @param id Capability ID
   * @returns Success or failure
   */
  async deleteCapability(id: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      const results = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: '',
        filter: {
          'metadata.id': id
        },
        limit: 1
      });
      
      if (results.length === 0) {
        console.warn(`Capability ${id} not found for deletion`);
        return false;
      }
      
      const pointId = results[0].id; // Use the actual UUID point ID
      
      return await this.memoryService!.deleteMemory({
        type: MemoryType.CAPABILITY_DEFINITION,
        id: pointId // Use UUID point ID, not capability ID
      });
    } catch (error) {
      console.error(`Failed to delete capability: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  /**
   * Find capabilities by type
   * 
   * @param type Capability type
   * @param limit Maximum number of results
   * @returns Array of capabilities
   */
  async findCapabilitiesByType(
    type: string,
    limit: number = 50
  ): Promise<CapabilityMemoryEntity[]> {
    try {
      await this.ensureInitialized();
      
      const result = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: `type:${type}`,
        limit
      });
      
      return result.map(point => point.payload.metadata as CapabilityMemoryEntity);
    } catch (error) {
      console.error(`Failed to find capabilities by type: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Search capabilities by name or description
   * 
   * @param searchText Text to search for
   * @param limit Maximum number of results
   * @returns Array of capabilities
   */
  async searchCapabilities(
    searchText: string,
    limit: number = 50
  ): Promise<CapabilityMemoryEntity[]> {
    try {
      await this.ensureInitialized();
      
      const result = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: searchText,
        limit
      });
      
      return result.map(point => point.payload.metadata as CapabilityMemoryEntity);
    } catch (error) {
      console.error(`Failed to search capabilities: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
  
  /**
   * Find or create a capability and return both UUID point ID and capability entity
   * This method ensures proper ID mapping between string capability IDs and UUID point IDs
   * 
   * @param capability Capability to find or create
   * @returns Object with UUID point ID and capability entity, or null if failed
   */
  async findOrCreateCapability(capability: CapabilityMemoryEntity): Promise<{
    pointId: string;
    capabilityId: string;
    entity: CapabilityMemoryEntity;
  } | null> {
    try {
      await this.ensureInitialized();
      
      // First, try to find existing capability by its string ID
      const results = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: '',
        filter: {
          must: [
            {
              key: 'metadata.id',
              match: { value: capability.id }
            }
          ]
        },
        limit: 1
      });
      
      if (results.length > 0) {
        // Found existing capability
        const existing = results[0];
        return {
          pointId: existing.id, // UUID point ID
          capabilityId: capability.id, // String capability ID
          entity: existing.payload.metadata as CapabilityMemoryEntity
        };
      }
      
      // Capability doesn't exist, create it
      const createResult = await this.createCapability(capability);
      
      if (!createResult.success || !createResult.id) {
        console.error(`Failed to create capability ${capability.id}:`, createResult.error);
        return null;
      }
      
      // Return the newly created capability info
      return {
        pointId: createResult.id, // UUID point ID from Qdrant
        capabilityId: capability.id, // String capability ID
        entity: capability
      };
      
    } catch (error) {
      console.error(`Failed to find or create capability ${capability.id}:`, error);
      return null;
    }
  }

  /**
   * Get all capabilities from the collection
   * 
   * @param limit Maximum number of capabilities to return
   * @returns Array of capabilities with their point IDs
   */
  async getAllCapabilities(limit: number = 100): Promise<Array<{
    pointId: string;
    capabilityId: string;
    entity: CapabilityMemoryEntity;
  }>> {
    try {
      await this.ensureInitialized();
      
      const results = await this.memoryService!.searchMemories({
        type: MemoryType.CAPABILITY_DEFINITION,
        query: '', // Empty query to get all
        limit
      });
      
      return results.map(result => ({
        pointId: result.id, // UUID point ID
        capabilityId: (result.payload.metadata as CapabilityMemoryEntity).id, // String capability ID
        entity: result.payload.metadata as CapabilityMemoryEntity
      }));
      
    } catch (error) {
      console.error('Failed to get all capabilities:', error);
      return [];
    }
  }
} 