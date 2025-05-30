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
        type: 'capability' as MemoryType,
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
      
      const result = await this.memoryService!.getMemory({
        type: 'capability' as MemoryType,
        id
      });
      
      if (!result) {
        return null;
      }
      
      return result.payload.metadata as CapabilityMemoryEntity;
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
      
      // Create content for embedding
      const content = `${capability.name} - ${capability.description} - ${capability.type}`;
      
      // Update capability in memory
      return await this.memoryService!.updateMemory({
        type: 'capability' as MemoryType,
        id: capability.id,
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
      
      return await this.memoryService!.deleteMemory({
        type: 'capability' as MemoryType,
        id
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
        type: 'capability' as MemoryType,
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
        type: 'capability' as MemoryType,
        query: searchText,
        limit
      });
      
      return result.map(point => point.payload.metadata as CapabilityMemoryEntity);
    } catch (error) {
      console.error(`Failed to search capabilities: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }
} 