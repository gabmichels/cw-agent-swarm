/**
 * Memory pruning functionality for the agent memory system
 * Handles removing expired or low-relevance memory entries
 */

import { Memory, MemoryEntry } from './memory';

export class MemoryPruner {
  /**
   * Prune memories for a specific agent
   * Removes entries that:
   * - Have expired (expiresAt is in the past)
   * - Have low relevance (below relevanceThreshold)
   */
  static async prune(
    agentId: string, 
    options: { 
      relevanceThreshold?: number;
      maxShortTermEntries?: number;
      currentTime?: number;
    } = {}
  ): Promise<{
    pruned: number;
    retained: number;
  }> {
    const memory = new Memory({ namespace: agentId });
    const entries = memory.getAll(agentId);
    const now = options.currentTime || Date.now();
    const relevanceThreshold = options.relevanceThreshold || 0.2;
    
    // Store original count
    const originalCount = entries.length;
    
    // Filter out expired and low-relevance entries
    const retained = entries.filter(entry => {
      // Check for expiration
      const expired = entry.expiresAt !== undefined && entry.expiresAt < now;
      
      // Check for low relevance
      const lowRelevance = entry.relevance !== undefined && entry.relevance < relevanceThreshold;
      
      return !expired && !lowRelevance;
    });
    
    // Limit short-term memory entries if needed
    if (options.maxShortTermEntries) {
      const shortTermEntries = retained.filter(entry => entry.scope === 'shortTerm');
      
      if (shortTermEntries.length > options.maxShortTermEntries) {
        // Sort by timestamp (newest first)
        shortTermEntries.sort((a, b) => b.timestamp - a.timestamp);
        
        // Keep only the newest entries up to maxShortTermEntries
        const shortTermToKeep = shortTermEntries.slice(0, options.maxShortTermEntries);
        
        // Get IDs to keep
        const shortTermIdsToKeep = new Set(shortTermToKeep.map(entry => entry.id));
        
        // Filter out excess short-term memories
        const filteredRetained = retained.filter(entry => 
          entry.scope !== 'shortTerm' || shortTermIdsToKeep.has(entry.id)
        );
        
        // Replace with filtered list
        memory.replaceAll(agentId, filteredRetained);
        
        return {
          pruned: originalCount - filteredRetained.length,
          retained: filteredRetained.length
        };
      }
    }
    
    // Replace agent's memories with pruned list
    memory.replaceAll(agentId, retained);
    
    return {
      pruned: originalCount - retained.length,
      retained: retained.length
    };
  }
  
  /**
   * Schedule automatic pruning for an agent
   */
  static scheduleAutoPrune(
    agentId: string, 
    intervalMs = 300000, // 5 minutes by default
    options: {
      relevanceThreshold?: number;
      maxShortTermEntries?: number;
    } = {}
  ): NodeJS.Timeout {
    console.log(`Scheduling memory pruning for agent ${agentId} every ${intervalMs}ms`);
    
    return setInterval(() => {
      this.prune(agentId, options)
        .then(result => {
          console.log(`Pruned ${result.pruned} memories for agent ${agentId}, ${result.retained} remaining`);
        })
        .catch(error => {
          console.error(`Error pruning memories for agent ${agentId}:`, error);
        });
    }, intervalMs);
  }
  
  /**
   * Cancel scheduled pruning
   */
  static cancelAutoPrune(timer: NodeJS.Timeout): void {
    clearInterval(timer);
  }
} 