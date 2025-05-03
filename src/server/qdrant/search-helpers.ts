import { MemoryRecord } from './index';
import { TagExtractor, TagAlgorithm } from '../../lib/memory/TagExtractor';
import { ImportanceCalculator } from '../../lib/memory/ImportanceCalculator';

/**
 * Extended memory record with score information
 */
export interface ScoredMemoryRecord extends MemoryRecord {
  score: number;
  metadata: Record<string, any>; // Explicitly define metadata to ensure it exists
}

/**
 * Scoring details stored in memory metadata for diagnostics
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
 * Boost vector search results based on tag overlap
 * 
 * Applies a hybrid scoring formula:
 * final_score = vector_similarity * 0.7 + tag_overlap * 0.3
 * 
 * @param results Original search results with scores
 * @param query The original search query
 * @returns Boosted results with hybrid scoring
 */
export function applyHybridScoring(
  results: ScoredMemoryRecord[],
  query: string
): ScoredMemoryRecord[] {
  if (!results || results.length === 0 || !query || query.trim().length === 0) {
    return results;
  }
  
  // Extract tags from the query
  const extractedTags = TagExtractor.extractTags(query, {
    algorithm: TagAlgorithm.RAKE,
    maxTags: 8,
    minConfidence: 0.15,
    useStemming: true
  });
  
  const queryTags = extractedTags.map(tag => tag.text);
  
  if (queryTags.length === 0) {
    return results;
  }
  
  // Apply hybrid scoring
  return results.map(result => {
    // Get memory tags
    const memoryTags = result.metadata?.tags || [];
    
    // Calculate tag overlap score
    const tagScore = calculateTagScore(queryTags, memoryTags as string[]);
    
    // Calculate matched tags for diagnostics
    const matchedTags = queryTags.filter(tag => 
      (memoryTags as string[]).some(mt => mt.toLowerCase() === tag.toLowerCase())
    );
    
    // Apply hybrid scoring formula: 70% vector + 30% tag score
    const hybridScore = (result.score * 0.7) + (tagScore * 0.3);
    
    // Return the boosted result
    return {
      ...result,
      score: hybridScore,
      metadata: {
        ...result.metadata,
        _scoringDetails: {
          vectorScore: result.score,
          tagScore,
          hybridScore,
          usageCount: result.metadata?.usageCount || 0,
          adjustedScore: hybridScore,
          matchedTags,
          queryTags
        } as ScoringDetails
      }
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Calculate tag overlap score between query tags and memory tags
 * 
 * @param queryTags Array of tags from the query
 * @param memoryTags Array of tags from the memory record
 * @returns Normalized overlap score (0-1)
 */
function calculateTagScore(queryTags: string[], memoryTags: string[]): number {
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
 * Apply tag-based boosting to search results
 * 
 * @param results The original search results
 * @param queryTags Tags extracted from the query
 * @returns Boosted search results
 */
export function applyTagBoosting(
  results: ScoredMemoryRecord[], 
  queryTags: string[]
): ScoredMemoryRecord[] {
  if (!results || results.length === 0 || !queryTags || queryTags.length === 0) {
    return results;
  }
  
  // Apply tag-based boosting
  const boostedResults = results.map(result => {
    const memoryTags = result.metadata?.tags || [];
    
    // Calculate tag overlap boost factor
    const tagBoostFactor = ImportanceCalculator.calculateTagBoostFactor(
      queryTags, 
      memoryTags as string[]
    );
    
    // Apply the tag boost to the score
    return {
      ...result,
      score: result.score * tagBoostFactor
    };
  });
  
  // Re-sort by adjusted score
  boostedResults.sort((a, b) => b.score - a.score);
  
  return boostedResults;
}

/**
 * Extract tags from a search query
 * 
 * @param query The search query
 * @returns Extracted tags
 */
export function extractTagsFromQuery(query: string): string[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  // Extract tags from the query using RAKE algorithm (better for short text)
  const extractedTags = TagExtractor.extractTags(query, {
    algorithm: TagAlgorithm.RAKE,
    maxTags: 5,
    minConfidence: 0.2
  });
  
  return extractedTags.map(tag => tag.text);
}

/**
 * Calculate a usage-based boost factor using logarithmic scaling
 * 
 * @param usageCount Number of times the memory has been used
 * @returns Boost factor (1.0 = no boost)
 */
export function calculateUsageBoost(usageCount: number): number {
  // Ensure we always have at least 1 for log calculation
  const safeUsageCount = Math.max(1, usageCount);
  
  // Apply logarithmic scaling for diminishing returns
  return 1 + Math.log(safeUsageCount);
} 