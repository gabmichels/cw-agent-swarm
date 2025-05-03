/**
 * Memory Utilities for Chloe
 * 
 * This file contains utility functions for enhancing Chloe's memory management:
 * 1. Hybrid scoring (vector similarity + tag overlap)
 * 2. Usage tracking and score adjustment
 * 3. Memory decay and reinforcement
 * 4. System prompt injection with relevant memories
 */

import { TagExtractor, Tag, TagAlgorithm } from './TagExtractor';
import { ImportanceCalculator } from './ImportanceCalculator';
import { searchMemory, updateMemoryMetadata, MemoryRecord } from '../../server/qdrant';

/**
 * Types of scoring details stored for diagnostics
 */
export interface ScoringDetails {
  vectorScore: number;   // Original vector similarity score (0-1)
  tagScore: number;      // Tag overlap score (0-1)
  hybridScore: number;   // Combined score (vectorScore * 0.7 + tagScore * 0.3)
  usageCount: number;    // Number of times this memory has been used
  adjustedScore: number; // Final score after usage adjustment
  matchedTags: string[]; // Which query tags matched this memory
  queryTags: string[];   // Original tags extracted from query
}

/**
 * Scored memory record with additional scoring information
 */
export interface ScoredMemoryRecord extends MemoryRecord {
  score: number;
  metadata: {
    [key: string]: any;
    _scoringDetails?: ScoringDetails;
  };
}

/**
 * Extract tags from a search query
 * 
 * @param query The search query to extract tags from
 * @returns Array of extracted tags
 */
export function extractTagsFromQuery(query: string): string[] {
  if (!query || query.trim().length < 3) {
    return [];
  }
  
  // Extract tags using RAKE algorithm (works better for queries)
  const extractedTags = TagExtractor.extractTags(query, {
    algorithm: TagAlgorithm.RAKE,
    maxTags: 8,
    minConfidence: 0.15,
    useStemming: true
  });
  
  return extractedTags.map(tag => tag.text);
}

/**
 * Calculate tag overlap score between query tags and memory tags
 * 
 * @param queryTags Array of tags from the query
 * @param memoryTags Array of tags from the memory record
 * @returns Normalized overlap score (0-1)
 */
export function calculateTagScore(queryTags: string[], memoryTags: string[]): number {
  if (!queryTags || !memoryTags || queryTags.length === 0 || memoryTags.length === 0) {
    return 0.0;
  }
  
  // Count overlapping tags (case insensitive)
  let overlapCount = 0;
  
  for (const tag of queryTags) {
    if (memoryTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
      overlapCount++;
    }
  }
  
  // Normalize by the smaller of the two sets
  return overlapCount / Math.min(queryTags.length, memoryTags.length);
}

/**
 * Adjust memory score based on usage count
 * Uses logarithmic scaling to provide diminishing returns
 * 
 * @param score Original score from search
 * @param usageCount Number of times the memory has been used
 * @returns Adjusted score with usage boost
 */
export function adjustScoreByUsage(score: number, usageCount: number = 0): number {
  // Ensure we always have at least 1 for log calculation
  const safeUsageCount = Math.max(1, usageCount);
  
  // Apply logarithmic scaling for diminishing returns
  // Formula: score * (1 + log(usageCount))
  // Log(1) = 0, so for new memories this will be score * (1 + 0) = score
  return score * (1 + Math.log(safeUsageCount));
}

/**
 * Apply hybrid scoring to memory search results
 * Combines vector similarity (70%) with tag overlap (30%)
 * 
 * @param vectorResults Original vector search results
 * @param query The original search query
 * @returns Results with hybrid scoring applied
 */
export function applyHybridScoring(
  vectorResults: MemoryRecord[],
  query: string
): ScoredMemoryRecord[] {
  if (!vectorResults || vectorResults.length === 0 || !query || query.trim().length === 0) {
    return vectorResults as ScoredMemoryRecord[];
  }
  
  // Extract tags from the query
  const queryTags = extractTagsFromQuery(query);
  
  // If no tags extracted, return original results
  if (queryTags.length === 0) {
    return vectorResults.map(result => {
      const vectorScore = 'score' in result ? (result as ScoredMemoryRecord).score : 0;
      return {
        ...result,
        score: vectorScore
      } as ScoredMemoryRecord;
    });
  }
  
  // Apply hybrid scoring (vector + tag overlap + usage)
  const hybridScoredResults = vectorResults.map(result => {
    // Original vector similarity score (already normalized 0-1)
    const vectorScore = 'score' in result ? (result as ScoredMemoryRecord).score : 0;
    
    // Calculate tag overlap score
    const memoryTags = result.metadata?.tags || [];
    const tagScore = calculateTagScore(queryTags, memoryTags as string[]);
    
    // Calculate matched tags for diagnostics
    const matchedTags = queryTags.filter(tag => 
      (memoryTags as string[]).some(mt => mt.toLowerCase() === tag.toLowerCase())
    );
    
    // Compute hybrid score: 70% vector similarity + 30% tag overlap
    const hybridScore = (vectorScore * 0.7) + (tagScore * 0.3);
    
    // Get usage count from metadata (default to 0 if not present)
    const usageCount = result.metadata?.usage_count || 0;
    
    // Apply usage-based adjustment
    const adjustedScore = adjustScoreByUsage(hybridScore, usageCount);
    
    // Store scoring details in metadata for diagnostics
    const scoredResult: ScoredMemoryRecord = {
      ...result,
      score: adjustedScore,
      metadata: {
        ...result.metadata,
        _scoringDetails: {
          vectorScore,
          tagScore,
          hybridScore,
          usageCount,
          adjustedScore,
          matchedTags,
          queryTags
        }
      }
    };
    
    return scoredResult;
  });
  
  // Sort by adjusted score
  return hybridScoredResults.sort((a, b) => b.score - a.score);
}

/**
 * Track memory usage when a memory is used in a response
 * Increments usage count and updates last_used timestamp
 * 
 * @param memoryId ID of the memory that was used
 * @returns Promise resolving to true if successful
 */
export async function trackMemoryUsage(memoryId: string): Promise<boolean> {
  try {
    // First, get the current metadata to read the existing usage count
    const memories = await searchMemory(null, "", {
      filter: { id: memoryId },
      limit: 1
    });
    
    if (!memories || memories.length === 0) {
      console.warn(`Cannot track usage: Memory ${memoryId} not found`);
      return false;
    }
    
    const memory = memories[0];
    
    // Get current usage count, defaulting to 0 if not present
    const currentUsageCount = memory.metadata?.usage_count || 0;
    
    // Increment the usage count
    const newUsageCount = currentUsageCount + 1;
    
    // Update the metadata with the new usage count and last_used timestamp
    return updateMemoryMetadata(memoryId, {
      usage_count: newUsageCount,
      last_used: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error tracking memory usage:', error);
    return false;
  }
}

/**
 * Reinforce memory importance when explicitly marked as helpful
 * Increases importance score by 20%
 * 
 * @param memoryId ID of the memory to reinforce
 * @param reason Reason for reinforcement (e.g., "user_feedback", "agent_decision")
 * @returns Promise resolving to true if successful
 */
export async function reinforceMemoryImportance(
  memoryId: string,
  reason: string = "explicit_reinforcement"
): Promise<boolean> {
  try {
    // First, get the current metadata
    const memories = await searchMemory(null, "", {
      filter: { id: memoryId },
      limit: 1
    });
    
    if (!memories || memories.length === 0) {
      console.warn(`Cannot reinforce: Memory ${memoryId} not found`);
      return false;
    }
    
    const memory = memories[0];
    
    // Get current importance score, defaulting to 0.5 if not present
    const currentScore = memory.metadata?.importance_score || 0.5;
    
    // Get current reinforcement count
    const currentReinforcementCount = memory.metadata?.reinforced || 0;
    
    // Calculate new importance score (20% increase)
    // Cap at maximum of 1.0
    const newScore = Math.min(1.0, currentScore * 1.2);
    
    // Update the metadata with reinforcement information
    return updateMemoryMetadata(memoryId, {
      importance_score: newScore,
      importance: ImportanceCalculator.scoreToImportanceLevel(newScore),
      reinforced: currentReinforcementCount + 1,
      last_reinforced_at: new Date().toISOString(),
      reinforcement_reason: reason
    });
  } catch (error) {
    console.error('Error reinforcing memory importance:', error);
    return false;
  }
}

/**
 * Mark a memory as critical to prevent it from being decayed
 * 
 * @param memoryId ID of the memory to mark as critical
 * @param isCritical Whether to mark as critical (true) or not (false)
 * @returns Promise resolving to true if successful
 */
export async function markMemoryAsCritical(
  memoryId: string,
  isCritical: boolean = true
): Promise<boolean> {
  return updateMemoryMetadata(memoryId, {
    critical: isCritical
  });
}

/**
 * Decay memory importance for memories that haven't been accessed recently
 * Reduces importance by specified percentage (default 5%)
 * 
 * @param options Configuration options for decay
 * @returns Statistics about the decay operation
 */
export async function decayMemoryImportance(options: {
  decayPercent?: number;
  olderThan?: number;
  dryRun?: boolean;
} = {}): Promise<{
  processed: number;
  decayed: number;
  exempted: number;
  errors: number;
}> {
  // Implementation details in server/qdrant/index.ts
  // This is a simplified version for our utility file
  
  try {
    // Set defaults for options
    const decayPercent = options.decayPercent || 5; // 5% decay by default
    const olderThan = options.olderThan || 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const dryRun = options.dryRun || false;
    
    // Stats for the operation
    const stats = {
      processed: 0,
      decayed: 0,
      exempted: 0,
      errors: 0
    };
    
    // Get cutoff date for "unused" memories
    const cutoffDate = new Date(Date.now() - olderThan);
    console.log(`Decaying memories not used since ${cutoffDate.toISOString()}`);
    
    // Get memories to potentially decay
    // In a real implementation, this would be done in batches
    const memories = await searchMemory(null, '', { limit: 1000 });
    
    // Process each memory
    for (const memory of memories) {
      stats.processed++;
      
      try {
        const metadata = memory.metadata || {};
        
        // Skip critical memories
        if (metadata.critical === true) {
          stats.exempted++;
          continue;
        }
        
        // Determine if this memory should be decayed
        let shouldDecay = true;
        
        // Skip if used recently
        if (metadata.last_used) {
          const lastUsed = new Date(metadata.last_used);
          if (lastUsed > cutoffDate) {
            shouldDecay = false;
          }
        }
        
        // Skip if it shouldn't be decayed
        if (!shouldDecay) {
          continue;
        }
        
        // Calculate new importance score
        const currentScore = metadata.importance_score || 0.5;
        const decayFactor = 1 - (decayPercent / 100);
        const newScore = Math.max(0.1, currentScore * decayFactor); // Minimum 0.1
        
        if (!dryRun) {
          // Update the memory's importance
          await updateMemoryMetadata(memory.id, {
            importance_score: newScore,
            importance: ImportanceCalculator.scoreToImportanceLevel(newScore),
            last_decayed_at: new Date().toISOString()
          });
          stats.decayed++;
        } else {
          // Just count it for dry run
          stats.decayed++;
        }
      } catch (error) {
        console.error(`Error processing memory ${memory.id}:`, error);
        stats.errors++;
      }
    }
    
    console.log(`Memory decay complete. Processed: ${stats.processed}, Decayed: ${stats.decayed}, Exempted: ${stats.exempted}, Errors: ${stats.errors}`);
    return stats;
  } catch (error) {
    console.error('Error running memory decay:', error);
    return { processed: 0, decayed: 0, exempted: 0, errors: 1 };
  }
}

/**
 * Extract relevant memories for system prompt injection
 * Uses hybrid scoring and filters by confidence threshold
 * 
 * @param query User message to find relevant memories for
 * @param options Search options
 * @returns Promise resolving to memory records to inject
 */
export async function getMemoriesForPromptInjection(
  query: string,
  options: {
    limit?: number;
    minConfidence?: number;
    trackUsage?: boolean;
  } = {}
): Promise<ScoredMemoryRecord[]> {
  try {
    // Set defaults
    const limit = options.limit || 3;
    const minConfidence = options.minConfidence || 0.75;
    const trackUsage = options.trackUsage !== false;
    
    // First extract key terms from the query
    const queryTags = extractTagsFromQuery(query);
    
    // Search with hybrid scoring
    // Get more results initially for better filtering
    const searchResults = await searchMemory(null, query, { 
      limit: Math.max(limit * 3, 10)
    });
    
    // Apply hybrid scoring
    const scoredResults = applyHybridScoring(searchResults, query);
    
    // Filter by confidence threshold and take top results
    const topResults = scoredResults
      .filter(result => result.score >= minConfidence)
      .slice(0, limit);
    
    // Track usage if enabled and we have results
    if (trackUsage && topResults.length > 0) {
      // Track in background, don't await
      Promise.all(topResults.map(result => 
        trackMemoryUsage(result.id)
      )).catch(error => {
        console.error('Error tracking memory usage during injection:', error);
      });
    }
    
    return topResults;
  } catch (error) {
    console.error('Error getting memories for prompt injection:', error);
    return [];
  }
}

/**
 * Format memory records for inclusion in system prompt
 * 
 * @param memories Array of memory records to format
 * @returns Formatted string for prompt injection
 */
export function formatMemoriesForPrompt(memories: ScoredMemoryRecord[]): string {
  if (!memories || memories.length === 0) {
    return "";
  }
  
  // Format each memory with its relevance score and content
  const formattedMemories = memories.map(memory => {
    const score = memory.score.toFixed(2);
    const tags = memory.metadata?.tags ? `[Tags: ${(memory.metadata.tags as string[]).join(', ')}]` : '';
    
    return `[Relevance: ${score}] ${memory.text || ''} ${tags}`;
  });
  
  // Combine with header
  return `RELEVANT MEMORIES:\n${formattedMemories.join('\n')}`;
}

/**
 * Inject relevant memories into a system prompt
 * 
 * @param systemPrompt Original system prompt
 * @param userMessage User message to find relevant memories for
 * @returns Promise resolving to enhanced system prompt
 */
export async function injectMemoriesIntoPrompt(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  // Get relevant memories
  const relevantMemories = await getMemoriesForPromptInjection(userMessage, {
    limit: 3,
    minConfidence: 0.75,
    trackUsage: true
  });
  
  // If no relevant memories found, return original prompt
  if (relevantMemories.length === 0) {
    return systemPrompt;
  }
  
  // Format memories for inclusion
  const memorySection = formatMemoriesForPrompt(relevantMemories);
  
  // Inject memories into the system prompt
  // Find a good position - after the initial description but before instructions
  const promptLines = systemPrompt.split('\n');
  const injectionPoint = Math.min(10, Math.floor(promptLines.length / 3));
  
  // Insert memory section
  promptLines.splice(injectionPoint, 0, '\n' + memorySection + '\n');
  
  return promptLines.join('\n');
} 