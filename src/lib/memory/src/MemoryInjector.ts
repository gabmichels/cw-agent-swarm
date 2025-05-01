/**
 * Memory injection functionality for the agent planning system
 * Retrieves relevant memories to provide context during planning
 */

import { Memory, MemoryEntry, MemoryScope, MemoryKind } from './memory';

export interface MemoryInjectionOptions {
  // Maximum number of memories to include in the context
  maxContextEntries?: number;
  
  // Minimum relevance threshold for memory inclusion
  minRelevance?: number;
  
  // Priority weights for different memory scopes (higher = more important)
  scopePriorities?: Record<MemoryScope, number>;
  
  // Which types of memory to prioritize
  priorityKinds?: MemoryKind[];
  
  // Filter to specific memory kinds only
  filterKinds?: MemoryKind[];
  
  // Time range to limit memory search
  maxMemoryAgeMs?: number;
}

/**
 * Default injection options
 */
const DEFAULT_OPTIONS: MemoryInjectionOptions = {
  maxContextEntries: 5,
  minRelevance: 0.3,
  scopePriorities: {
    'reflections': 4,
    'longTerm': 3,
    'shortTerm': 2,
    'inbox': 1
  },
  priorityKinds: ['insight', 'decision', 'fact'],
  maxMemoryAgeMs: 7 * 24 * 60 * 60 * 1000 // 7 days default
};

export class MemoryInjector {
  /**
   * Get relevant memories for task planning based on goal, tags, and context
   */
  static async getRelevantContext({
    agentId,
    goal,
    tags = [],
    delegationContextId,
    options = {}
  }: {
    agentId: string;
    goal: string;
    tags?: string[];
    delegationContextId?: string;
    options?: MemoryInjectionOptions;
  }): Promise<MemoryEntry[]> {
    // Merge with default options
    const injectionOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Create memory instance
    const memory = new Memory({ namespace: agentId });
    
    // First try semantic search for goal-related memories
    let semanticResults: MemoryEntry[] = [];
    try {
      semanticResults = await memory.searchMemory(goal, { 
        limit: injectionOptions.maxContextEntries ? injectionOptions.maxContextEntries * 2 : 10, // Get more results to filter
        minRelevance: injectionOptions.minRelevance
      });
    } catch (error) {
      console.warn(`Semantic search for memory injection failed: ${error}`);
      // Continue with fallback approach
    }
    
    // Get entries from each memory scope
    const reflections = memory.getByScope(agentId, 'reflections');
    const longTerm = memory.getByScope(agentId, 'longTerm');
    const shortTerm = memory.getByScope(agentId, 'shortTerm');
    const inbox = memory.getByScope(agentId, 'inbox');
    
    // Combine results with manual filtering results
    const allEntries = [...semanticResults, ...reflections, ...longTerm, ...shortTerm, ...inbox];
    
    // Remove duplicates based on id
    const uniqueEntries = Array.from(
      new Map(allEntries.map(entry => [entry.id, entry])).values()
    );
    
    // Apply time filter if set
    let filteredByTime = uniqueEntries;
    if (injectionOptions.maxMemoryAgeMs) {
      const cutoffTime = Date.now() - injectionOptions.maxMemoryAgeMs;
      filteredByTime = uniqueEntries.filter(entry => entry.timestamp >= cutoffTime);
    }
    
    // Apply kind filter if set
    let filteredByKind = filteredByTime;
    if (injectionOptions.filterKinds && injectionOptions.filterKinds.length > 0) {
      filteredByKind = filteredByTime.filter(entry => 
        entry.kind && injectionOptions.filterKinds?.includes(entry.kind)
      );
    }
    
    // Match based on tags, context, and goal keywords
    const filteredEntries = filteredByKind.filter(entry => {
      // Always include entries from semantic search - they already match the goal
      if (semanticResults.some(r => r.id === entry.id)) {
        return true;
      }
      
      // Match by tags
      const matchTags = tags.length > 0 && 
        entry.tags && 
        tags.some(tag => entry.tags?.includes(tag));
      
      // Match by context ID
      const matchContext = delegationContextId && 
        entry.contextId === delegationContextId;
      
      // Match by goal keywords (primitive approach as fallback)
      const goalWords = goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matchGoalKeywords = goalWords.some(word => 
        entry.content.toLowerCase().includes(word)
      );
      
      return matchTags || matchContext || matchGoalKeywords;
    });
    
    // Score and sort entries by relevance, scope priority, and kind
    const scoredEntries = filteredEntries.map(entry => {
      // Base score is entry relevance or default
      let score = entry.relevance || 0.5;
      
      // Add scope priority bonus
      const scopePriority = injectionOptions.scopePriorities?.[entry.scope] || 0;
      score += scopePriority * 0.1;
      
      // Add kind priority bonus
      if (entry.kind && injectionOptions.priorityKinds?.includes(entry.kind)) {
        // More points for being earlier in the priority list
        const kindIndex = injectionOptions.priorityKinds.indexOf(entry.kind);
        const kindPriority = injectionOptions.priorityKinds.length - kindIndex;
        score += kindPriority * 0.05;
      }
      
      // Tag match bonus
      if (entry.tags && tags.some(tag => entry.tags?.includes(tag))) {
        score += 0.2;
      }
      
      // Context match bonus
      if (delegationContextId && entry.contextId === delegationContextId) {
        score += 0.3;
      }
      
      return { entry, score };
    });
    
    // Sort by score descending
    scoredEntries.sort((a, b) => b.score - a.score);
    
    // Take top N entries
    const topEntries = scoredEntries
      .slice(0, injectionOptions.maxContextEntries || 5)
      .map(item => item.entry);
    
    console.log(`Injecting ${topEntries.length} memories for planning context`);
    return topEntries;
  }
  
  /**
   * Format memory entries into a string for inclusion in prompts
   */
  static formatMemoriesForPrompt(memories: MemoryEntry[]): string {
    if (!memories || memories.length === 0) {
      return "No relevant memories available.";
    }
    
    // Group memories by scope
    const byScope: Record<string, MemoryEntry[]> = {};
    
    for (const memory of memories) {
      const scope = memory.scope || 'unknown';
      if (!byScope[scope]) {
        byScope[scope] = [];
      }
      byScope[scope].push(memory);
    }
    
    // Format each scope section
    const sections: string[] = [];
    
    // Order of scopes in the output
    const scopeOrder: MemoryScope[] = ['reflections', 'longTerm', 'shortTerm', 'inbox'];
    
    for (const scope of scopeOrder) {
      const entriesInScope = byScope[scope];
      if (entriesInScope && entriesInScope.length > 0) {
        sections.push(`RELEVANT ${scope.toUpperCase()} MEMORIES:`);
        
        for (const entry of entriesInScope) {
          const kind = entry.kind ? `[${entry.kind}]` : '';
          sections.push(`- ${kind} ${entry.content}`);
        }
        
        sections.push('');
      }
    }
    
    return sections.join('\n');
  }
} 