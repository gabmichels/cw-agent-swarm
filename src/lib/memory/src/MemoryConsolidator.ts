/**
 * Memory consolidation functionality for the agent memory system
 * Handles summarizing and organizing memories across scopes
 */

import { Memory, MemoryEntry, MemoryScope, MemoryKind } from './memory';

export interface ConsolidationOptions {
  // Minimum number of memories needed for consolidation
  minMemories?: number;
  
  // Relevance threshold for memories to be considered
  relevanceThreshold?: number;
  
  // Target scope for consolidated memories ('reflections' or 'longTerm')
  targetScope?: MemoryScope;
  
  // Default kind for the consolidated memory
  defaultKind?: MemoryKind;
  
  // Tags to add to consolidated memories
  additionalTags?: string[];
  
  // If true, removes source memories after consolidation
  forgetSourceMemories?: boolean;
  
  // If provided, only consolidates memories with matching tags
  filterTags?: string[];
  
  // If provided, only consolidates memories with matching context ID
  contextId?: string;
}

/**
 * Default consolidation options
 */
const DEFAULT_OPTIONS: ConsolidationOptions = {
  minMemories: 3,
  relevanceThreshold: 0.3,
  targetScope: 'reflections',
  defaultKind: 'insight',
  additionalTags: ['summary', 'auto-consolidated'],
  forgetSourceMemories: false
};

export class MemoryConsolidator {
  /**
   * Consolidate memories for a specific agent
   * Summarizes short-term memories into reflections or long-term memory
   */
  static async consolidate(
    agentId: string, 
    options: ConsolidationOptions = {}
  ): Promise<MemoryEntry | null> {
    // Merge with default options
    const consolidationOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Create memory instance
    const memory = new Memory({ namespace: agentId });
    
    // Get short-term memories
    const shortTerm = memory.getByScope(agentId, 'shortTerm');
    
    // Apply filters
    let filteredMemories = shortTerm
      // Filter by minimum relevance
      .filter(m => (m.relevance ?? 0.5) > (consolidationOptions.relevanceThreshold ?? 0.3));
    
    // Filter by tags if specified
    if (consolidationOptions.filterTags && consolidationOptions.filterTags.length > 0) {
      filteredMemories = filteredMemories.filter(m => 
        m.tags && consolidationOptions.filterTags?.some(tag => m.tags?.includes(tag))
      );
    }
    
    // Filter by context ID if specified
    if (consolidationOptions.contextId) {
      filteredMemories = filteredMemories.filter(m => 
        m.contextId === consolidationOptions.contextId
      );
    }
    
    // Check if we have enough memories to consolidate
    if (filteredMemories.length < (consolidationOptions.minMemories ?? 3)) {
      console.log(`Not enough relevant memories to consolidate for agent ${agentId}: ${filteredMemories.length} < ${consolidationOptions.minMemories}`);
      return null;
    }
    
    // Sort by timestamp (newest first)
    filteredMemories.sort((a, b) => b.timestamp - a.timestamp);
    
    // Create content for summarization
    const summaryContent = filteredMemories.map(m => `- ${m.content}`).join('\n');
    
    // Get a summary using the summarizer tool
    const summary = await Memory.summarizerTool(summaryContent);
    
    // Create consolidated memory entry
    const consolidatedEntry = await memory.write({
      agentId,
      content: summary,
      scope: consolidationOptions.targetScope,
      kind: consolidationOptions.defaultKind,
      relevance: 0.9, // Consolidated memories are highly relevant
      timestamp: Date.now(),
      summaryOf: filteredMemories.map(m => m.id),
      tags: [
        ...(consolidationOptions.additionalTags ?? []),
        'consolidated'
      ]
    });
    
    console.log(`Created consolidated memory (${consolidatedEntry.id}) from ${filteredMemories.length} sources for agent ${agentId}`);
    
    // Remove source memories if configured
    if (consolidationOptions.forgetSourceMemories) {
      // Get all memories
      const allMemories = memory.getAll(agentId);
      
      // Create a set of IDs to remove
      const idsToRemove = new Set(filteredMemories.map(m => m.id));
      
      // Filter out removed memories
      const remainingMemories = allMemories.filter(m => !idsToRemove.has(m.id));
      
      // Replace with filtered list
      memory.replaceAll(agentId, remainingMemories);
      
      console.log(`Removed ${filteredMemories.length} source memories after consolidation for agent ${agentId}`);
    }
    
    return consolidatedEntry;
  }
  
  /**
   * Consolidate memories by specific tags
   */
  static async consolidateByTags(
    agentId: string,
    tags: string[],
    options: ConsolidationOptions = {}
  ): Promise<MemoryEntry | null> {
    return this.consolidate(agentId, {
      ...options,
      filterTags: tags
    });
  }
  
  /**
   * Consolidate memories from a specific context (e.g., conversation or task)
   */
  static async consolidateByContext(
    agentId: string,
    contextId: string,
    options: ConsolidationOptions = {}
  ): Promise<MemoryEntry | null> {
    return this.consolidate(agentId, {
      ...options,
      contextId
    });
  }
  
  /**
   * Schedule automatic consolidation for an agent
   */
  static scheduleAutoConsolidate(
    agentId: string, 
    intervalMs = 600000, // 10 minutes by default
    options: ConsolidationOptions = {}
  ): NodeJS.Timeout {
    console.log(`Scheduling memory consolidation for agent ${agentId} every ${intervalMs}ms`);
    
    return setInterval(() => {
      this.consolidate(agentId, options)
        .then(result => {
          if (result) {
            console.log(`Consolidated memories for agent ${agentId}, created entry ${result.id}`);
          }
        })
        .catch(error => {
          console.error(`Error consolidating memories for agent ${agentId}:`, error);
        });
    }, intervalMs);
  }
  
  /**
   * Cancel scheduled consolidation
   */
  static cancelAutoConsolidate(timer: NodeJS.Timeout): void {
    clearInterval(timer);
  }
} 