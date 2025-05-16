import { IdGenerator } from '@/utils/ulid';
import { getMemoryServices } from '@/server/memory/services';
import { MemoryType } from '@/server/memory/config';

/**
 * Shared memory item that can be accessed by multiple agents
 */
export interface SharedMemoryItem {
  /**
   * Unique ID for the memory
   */
  id: string;
  
  /**
   * Content of the memory
   */
  content: string;
  
  /**
   * Type of memory
   */
  type: string;
  
  /**
   * Tags for better retrieval
   */
  tags: string[];
  
  /**
   * Priority of the memory (higher = more important)
   */
  priority: number;
  
  /**
   * Confidence in the memory's accuracy (0-1)
   */
  confidence: number;
  
  /**
   * Agent who created the memory
   */
  createdBy: string;
  
  /**
   * Agents who can access this memory
   */
  accessibleBy: string[];
  
  /**
   * When the memory was created
   */
  createdAt: Date;
  
  /**
   * When the memory expires (null = never)
   */
  expiresAt: Date | null;
  
  /**
   * Metadata about the memory
   */
  metadata: Record<string, any>;
}

/**
 * Service for managing shared memory between agents
 */
export class SharedMemoryService {
  /**
   * Registry of memory items
   */
  private memoryItems: Map<string, SharedMemoryItem> = new Map();
  
  /**
   * Index of memory items by agent ID
   */
  private agentMemoryIndex: Map<string, Set<string>> = new Map();
  
  /**
   * Index of memory items by tag
   */
  private tagMemoryIndex: Map<string, Set<string>> = new Map();
  
  /**
   * Index of agents with read/write access to memories
   */
  private accessControlIndex: Map<string, { read: Set<string>; write: Set<string> }> = new Map();
  
  /**
   * Constructor
   */
  constructor() {
    // Initialize service
    this.initializeService();
  }
  
  /**
   * Initialize the service
   */
  private async initializeService(): Promise<void> {
    // Any initialization logic here
  }
  
  /**
   * Create a new shared memory
   * @param item Memory to store
   * @returns ID of the stored memory
   */
  async createSharedMemory(item: Omit<SharedMemoryItem, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Generate ID for the memory
      const memoryId = IdGenerator.generate('shared-memory').toString();
      
      // Create memory item
      const memoryItem: SharedMemoryItem = {
        ...item,
        id: memoryId,
        createdAt: new Date()
      };
      
      // Store in registry
      this.memoryItems.set(memoryId, memoryItem);
      
      // Update indices
      this.updateIndices(memoryItem);
      
      // Store in persistent memory service as well
      try {
        const { memoryService } = await getMemoryServices();
        
        // Map to appropriate memory type for the system
        await memoryService.addMemory({
          id: memoryId,
          type: MemoryType.AGENT_RELATIONSHIP, // Choose appropriate type for shared memories
          content: item.content,
          metadata: {
            sharedMemory: true,
            createdBy: item.createdBy,
            accessibleBy: item.accessibleBy,
            tags: item.tags,
            priority: item.priority,
            confidence: item.confidence,
            expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
            ...item.metadata
          }
        });
      } catch (storageError) {
        console.error('Error storing shared memory in persistent storage:', storageError);
        // Continue even if persistence fails - we still have in-memory copy
      }
      
      return memoryId;
    } catch (error) {
      console.error('Error creating shared memory:', error);
      throw error;
    }
  }
  
  /**
   * Update indices for a memory item
   * @param item Memory item to index
   */
  private updateIndices(item: SharedMemoryItem): void {
    // Add to agent index
    this.updateAgentIndex(item.createdBy, item.id);
    
    // Add to tag index
    for (const tag of item.tags) {
      this.updateTagIndex(tag, item.id);
    }
    
    // Add to access control index
    for (const agentId of item.accessibleBy) {
      this.updateAccessIndex(agentId, item.id, 'read');
    }
    
    // Creator always has write access
    this.updateAccessIndex(item.createdBy, item.id, 'write');
  }
  
  /**
   * Update agent index
   * @param agentId Agent ID
   * @param memoryId Memory ID
   */
  private updateAgentIndex(agentId: string, memoryId: string): void {
    if (!this.agentMemoryIndex.has(agentId)) {
      this.agentMemoryIndex.set(agentId, new Set());
    }
    
    this.agentMemoryIndex.get(agentId)!.add(memoryId);
  }
  
  /**
   * Update tag index
   * @param tag Tag
   * @param memoryId Memory ID
   */
  private updateTagIndex(tag: string, memoryId: string): void {
    if (!this.tagMemoryIndex.has(tag)) {
      this.tagMemoryIndex.set(tag, new Set());
    }
    
    this.tagMemoryIndex.get(tag)!.add(memoryId);
  }
  
  /**
   * Update access control index
   * @param agentId Agent ID
   * @param memoryId Memory ID
   * @param accessType Type of access ('read' or 'write')
   */
  private updateAccessIndex(agentId: string, memoryId: string, accessType: 'read' | 'write'): void {
    if (!this.accessControlIndex.has(agentId)) {
      this.accessControlIndex.set(agentId, { read: new Set(), write: new Set() });
    }
    
    this.accessControlIndex.get(agentId)![accessType].add(memoryId);
  }
  
  /**
   * Get all shared memories accessible by an agent
   * @param agentId Agent ID
   * @returns List of accessible memory items
   */
  async getAccessibleMemories(agentId: string): Promise<SharedMemoryItem[]> {
    try {
      // Check if agent has any accessible memories
      if (!this.accessControlIndex.has(agentId)) {
        return [];
      }
      
      // Get readable memory IDs
      const readableIds = Array.from(this.accessControlIndex.get(agentId)!.read);
      
      // Filter out expired memories
      const now = new Date();
      const memories = readableIds
        .map(id => this.memoryItems.get(id))
        .filter(item => 
          item !== undefined && 
          (item.expiresAt === null || item.expiresAt > now)
        ) as SharedMemoryItem[];
      
      return memories;
    } catch (error) {
      console.error(`Error getting accessible memories for agent ${agentId}:`, error);
      return [];
    }
  }
  
  /**
   * Search for shared memories by content and tags
   * @param agentId Agent searching for memories
   * @param query Search query
   * @param tags Optional tags to filter by
   * @param limit Maximum number of results
   * @returns Matching memory items
   */
  async searchSharedMemories(
    agentId: string,
    query: string,
    tags?: string[],
    limit?: number
  ): Promise<SharedMemoryItem[]> {
    try {
      // Get all accessible memories for this agent
      const accessibleMemories = await this.getAccessibleMemories(agentId);
      
      if (accessibleMemories.length === 0) {
        return [];
      }
      
      // Filter by tags if provided
      let filteredMemories = accessibleMemories;
      if (tags && tags.length > 0) {
        filteredMemories = filteredMemories.filter(memory => 
          tags.some(tag => memory.tags.includes(tag))
        );
      }
      
      // Search by content
      const searchTerms = query.toLowerCase().split(/\s+/);
      
      let matches: Array<{memory: SharedMemoryItem; score: number}> = [];
      
      // Simple keyword matching for in-memory search
      // In a real implementation, you would use a proper semantic search
      for (const memory of filteredMemories) {
        const content = memory.content.toLowerCase();
        
        // Calculate match score
        let score = 0;
        for (const term of searchTerms) {
          if (content.includes(term)) {
            score += 1;
          }
        }
        
        // If we have any matches or returning all results
        if (score > 0 || query === '') {
          // Apply priority and confidence to score
          score = score * (memory.priority / 10) * memory.confidence;
          
          matches.push({ memory, score });
        }
      }
      
      // Sort by score
      matches.sort((a, b) => b.score - a.score);
      
      // Apply limit
      if (limit && matches.length > limit) {
        matches = matches.slice(0, limit);
      }
      
      return matches.map(match => match.memory);
    } catch (error) {
      console.error(`Error searching shared memories for agent ${agentId}:`, error);
      return [];
    }
  }
  
  /**
   * Grant access to a memory for an agent
   * @param memoryId Memory ID
   * @param agentId Agent ID to grant access
   * @param accessType Type of access to grant
   * @param grantedBy Agent granting access
   * @returns Whether access was granted
   */
  async grantAccess(
    memoryId: string,
    agentId: string,
    accessType: 'read' | 'write',
    grantedBy: string
  ): Promise<boolean> {
    try {
      // Check if memory exists
      if (!this.memoryItems.has(memoryId)) {
        return false;
      }
      
      const memory = this.memoryItems.get(memoryId)!;
      
      // Check if the granting agent has write access
      if (!this.hasWriteAccess(grantedBy, memoryId)) {
        return false;
      }
      
      // Grant access
      if (accessType === 'read') {
        // Add to accessible agents
        if (!memory.accessibleBy.includes(agentId)) {
          memory.accessibleBy.push(agentId);
        }
      }
      
      // Update indices
      this.updateAccessIndex(agentId, memoryId, accessType);
      
      // Update memory item
      this.memoryItems.set(memoryId, memory);
      
      return true;
    } catch (error) {
      console.error(`Error granting ${accessType} access to memory ${memoryId} for agent ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Check if an agent has write access to a memory
   * @param agentId Agent ID
   * @param memoryId Memory ID
   * @returns Whether agent has write access
   */
  private hasWriteAccess(agentId: string, memoryId: string): boolean {
    if (!this.accessControlIndex.has(agentId)) {
      return false;
    }
    
    return this.accessControlIndex.get(agentId)!.write.has(memoryId);
  }
  
  /**
   * Update a shared memory item
   * @param memoryId Memory ID
   * @param updates Updates to apply
   * @param updatedBy Agent performing the update
   * @returns Whether update was successful
   */
  async updateSharedMemory(
    memoryId: string,
    updates: Partial<Omit<SharedMemoryItem, 'id' | 'createdAt' | 'createdBy'>>,
    updatedBy: string
  ): Promise<boolean> {
    try {
      // Check if memory exists
      if (!this.memoryItems.has(memoryId)) {
        return false;
      }
      
      // Check if agent has write access
      if (!this.hasWriteAccess(updatedBy, memoryId)) {
        return false;
      }
      
      // Get current memory
      const memory = this.memoryItems.get(memoryId)!;
      
      // Apply updates
      const updatedMemory: SharedMemoryItem = {
        ...memory,
        ...updates,
        // Preserve immutable fields
        id: memory.id,
        createdAt: memory.createdAt,
        createdBy: memory.createdBy
      };
      
      // Update in registry
      this.memoryItems.set(memoryId, updatedMemory);
      
      // If tags were updated, update tag index
      if (updates.tags) {
        // Remove from old tags
        for (const tag of memory.tags) {
          if (this.tagMemoryIndex.has(tag)) {
            this.tagMemoryIndex.get(tag)!.delete(memoryId);
          }
        }
        
        // Add to new tags
        for (const tag of updatedMemory.tags) {
          this.updateTagIndex(tag, memoryId);
        }
      }
      
      // If access permissions were updated, update access index
      if (updates.accessibleBy) {
        // Remove old access
        for (const agentId of memory.accessibleBy) {
          if (this.accessControlIndex.has(agentId)) {
            this.accessControlIndex.get(agentId)!.read.delete(memoryId);
          }
        }
        
        // Add new access
        for (const agentId of updatedMemory.accessibleBy) {
          this.updateAccessIndex(agentId, memoryId, 'read');
        }
      }
      
      // Update in persistent storage too
      try {
        const { memoryService } = await getMemoryServices();
        
        await memoryService.updateMemory({
          id: memoryId,
          type: MemoryType.AGENT_RELATIONSHIP,
          content: updates.content,
          metadata: {
            ...updates.metadata,
            accessibleBy: updatedMemory.accessibleBy,
            tags: updatedMemory.tags,
            priority: updatedMemory.priority,
            confidence: updatedMemory.confidence,
            expiresAt: updatedMemory.expiresAt ? updatedMemory.expiresAt.toISOString() : null,
          }
        });
      } catch (updateError) {
        console.error('Error updating shared memory in persistent storage:', updateError);
        // Continue even if persistence fails - we still have in-memory copy
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating shared memory ${memoryId}:`, error);
      return false;
    }
  }
  
  /**
   * Get agents who have access to a memory
   * @param memoryId Memory ID
   * @returns Agents with access to the memory
   */
  async getMemoryAccessors(memoryId: string): Promise<Array<{
    agentId: string;
    accessType: 'read' | 'write' | 'both';
  }>> {
    try {
      if (!this.memoryItems.has(memoryId)) {
        return [];
      }
      
      const result: Array<{
        agentId: string;
        accessType: 'read' | 'write' | 'both';
      }> = [];
      
      // Check all agents in access control index
      for (const [agentId, access] of Array.from(this.accessControlIndex.entries())) {
        const hasRead = access.read.has(memoryId);
        const hasWrite = access.write.has(memoryId);
        
        if (hasRead || hasWrite) {
          const accessType = hasRead && hasWrite ? 'both' : (hasRead ? 'read' : 'write');
          result.push({ agentId, accessType });
        }
      }
      
      return result;
    } catch (error) {
      console.error(`Error getting accessors for memory ${memoryId}:`, error);
      return [];
    }
  }
  
  /**
   * Delete a shared memory
   * @param memoryId Memory ID
   * @param deletedBy Agent performing the deletion
   * @returns Whether deletion was successful
   */
  async deleteSharedMemory(memoryId: string, deletedBy: string): Promise<boolean> {
    try {
      // Check if memory exists
      if (!this.memoryItems.has(memoryId)) {
        return false;
      }
      
      // Check if agent has write access
      if (!this.hasWriteAccess(deletedBy, memoryId)) {
        return false;
      }
      
      // Get memory for cleanup
      const memory = this.memoryItems.get(memoryId)!;
      
      // Remove from indices
      
      // Remove from agent index
      if (this.agentMemoryIndex.has(memory.createdBy)) {
        this.agentMemoryIndex.get(memory.createdBy)!.delete(memoryId);
      }
      
      // Remove from tag index
      for (const tag of memory.tags) {
        if (this.tagMemoryIndex.has(tag)) {
          this.tagMemoryIndex.get(tag)!.delete(memoryId);
        }
      }
      
      // Remove from access control index
      for (const agentId of [...memory.accessibleBy, memory.createdBy]) {
        if (this.accessControlIndex.has(agentId)) {
          this.accessControlIndex.get(agentId)!.read.delete(memoryId);
          this.accessControlIndex.get(agentId)!.write.delete(memoryId);
        }
      }
      
      // Remove from registry
      this.memoryItems.delete(memoryId);
      
      // Delete from persistent storage too
      try {
        const { memoryService } = await getMemoryServices();
        
        await memoryService.deleteMemory({
          id: memoryId,
          type: MemoryType.AGENT_RELATIONSHIP
        });
      } catch (deleteError) {
        console.error('Error deleting shared memory from persistent storage:', deleteError);
        // Continue even if persistence fails - we still deleted from in-memory
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting shared memory ${memoryId}:`, error);
      return false;
    }
  }
} 