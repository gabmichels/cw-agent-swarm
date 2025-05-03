/**
 * Memory Graph System for Chloe
 * 
 * This file implements a knowledge graph structure for memory nodes:
 * - Connects memory nodes by shared tags or embedding similarity
 * - Stores edge weights based on relationship strength
 * - Provides functions to retrieve and boost related memories
 * - Integrates with the existing memory and knowledge graph systems
 */

import { KnowledgeGraph, RelationType } from './src/knowledge-graph';
import { searchMemory, updateMemoryMetadata, MemoryRecord } from '../../server/qdrant';
import { ScoredMemoryRecord } from './MemoryUtils';
import { computeCosineSimilarity } from '../../utils/vector-utils';

/**
 * Options for creating memory graph connections
 */
export interface MemoryGraphOptions {
  /** Similarity threshold for connecting memories (0-1) */
  similarityThreshold?: number;
  /** Minimum number of shared tags for connection */
  minSharedTags?: number;
  /** Maximum number of connections per memory */
  maxConnectionsPerMemory?: number;
  /** Whether to create bidirectional connections */
  bidirectional?: boolean;
  /** Namespace for the memory graph */
  namespace?: string;
}

/**
 * Edge in the memory graph
 */
export interface MemoryEdge {
  /** Source memory ID */
  sourceId: string;
  /** Target memory ID */
  targetId: string;
  /** Relationship type */
  type: RelationType;
  /** Edge weight (0-1) */
  weight: number;
  /** How this edge was created */
  creationMethod: 'tag_overlap' | 'vector_similarity' | 'manual' | 'inferred';
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Represents how a memory is connected to other memories in a graph structure
 */
export class MemoryGraph {
  private knowledgeGraph: KnowledgeGraph;
  private namespace: string;
  private options: Required<MemoryGraphOptions>;
  private initialized: boolean = false;

  /**
   * Create a new memory graph
   */
  constructor(options: MemoryGraphOptions = {}) {
    // Set default options
    this.options = {
      similarityThreshold: options.similarityThreshold || 0.85,
      minSharedTags: options.minSharedTags || 2,
      maxConnectionsPerMemory: options.maxConnectionsPerMemory || 10,
      bidirectional: options.bidirectional !== false, // Default to true
      namespace: options.namespace || 'chloe'
    };

    this.namespace = this.options.namespace;
    this.knowledgeGraph = new KnowledgeGraph(this.namespace);
  }

  /**
   * Initialize the memory graph
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      await this.knowledgeGraph.initialize();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing memory graph:', error);
      return false;
    }
  }

  /**
   * Connect a memory to other related memories
   * 
   * @param memoryId ID of the memory to connect
   * @returns Number of connections created
   */
  async connectMemory(memoryId: string): Promise<number> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Get the memory details
      const memories = await searchMemory(null, "", {
        filter: { id: memoryId },
        limit: 1
      });

      if (!memories || memories.length === 0) {
        console.warn(`Cannot connect memory: Memory ${memoryId} not found`);
        return 0;
      }

      const memory = memories[0];
      
      // Find related memories by tag overlap and vector similarity
      const connections = await this.findRelatedMemories(memory);
      
      // Create connections in the knowledge graph
      let createdConnections = 0;
      
      for (const connection of connections) {
        const sourceId = memoryId;
        const targetId = connection.id;
        
        // Skip self-connections
        if (sourceId === targetId) {
          continue;
        }
        
        // Determine relationship type based on similarity
        const relationshipType = this.determineRelationshipType(memory, connection);
        
        // Calculate edge weight (normalized 0-1)
        const weight = connection.score;
        
        // Determine creation method
        let creationMethod: 'tag_overlap' | 'vector_similarity' | 'manual' | 'inferred' = 'inferred';
        
        if (connection.metadata?._scoringDetails) {
          const details = connection.metadata._scoringDetails;
          creationMethod = details.tagScore > details.vectorScore ? 'tag_overlap' : 'vector_similarity';
        }
        
        // Create the edge in the knowledge graph
        await this.addEdge({
          sourceId,
          targetId,
          type: relationshipType,
          weight,
          creationMethod
        });
        
        createdConnections++;
        
        // Create bidirectional connection if enabled
        if (this.options.bidirectional) {
          await this.addEdge({
            sourceId: targetId,
            targetId: sourceId,
            type: this.getInverseRelationType(relationshipType),
            weight,
            creationMethod
          });
        }
      }
      
      // Update memory metadata to mark it as connected in the graph
      await updateMemoryMetadata(memoryId, {
        graph_connected: true,
        graph_connections_count: createdConnections,
        last_graph_update: new Date().toISOString()
      });
      
      return createdConnections;
    } catch (error) {
      console.error('Error connecting memory:', error);
      return 0;
    }
  }

  /**
   * Add an edge to the memory graph
   * 
   * @param edge Edge information
   */
  private async addEdge(edge: MemoryEdge): Promise<boolean> {
    try {
      // Add edge to knowledge graph
      await this.knowledgeGraph.addRelationship(
        edge.sourceId, 
        edge.targetId, 
        edge.type,
        {
          weight: edge.weight,
          creation_method: edge.creationMethod,
          created_at: new Date().toISOString(),
          ...edge.metadata
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error adding edge to memory graph:', error);
      return false;
    }
  }

  /**
   * Find related memories by tag overlap and vector similarity
   * 
   * @param memory Memory to find relations for
   * @returns Array of related memories with scores
   */
  private async findRelatedMemories(memory: MemoryRecord): Promise<ScoredMemoryRecord[]> {
    // Extract tags and content for similarity checks
    const memoryTags = memory.metadata?.tags || [];
    const memoryContent = memory.text || '';
    
    // Search for potentially related memories
    // First, try tag-based search if we have tags
    let candidateMemories: MemoryRecord[] = [];
    
    if (memoryTags.length > 0) {
      // Search for each tag to find potential matches
      for (const tag of memoryTags) {
        const tagResults = await searchMemory(null, String(tag), { 
          limit: this.options.maxConnectionsPerMemory
        });
        
        // Add unique results to candidates
        for (const result of tagResults) {
          if (result.id !== memory.id && !candidateMemories.some(m => m.id === result.id)) {
            candidateMemories.push(result);
          }
        }
      }
    }
    
    // If we don't have enough candidates, add vector similarity search
    if (candidateMemories.length < this.options.maxConnectionsPerMemory) {
      const vectorResults = await searchMemory(null, memoryContent, { 
        limit: this.options.maxConnectionsPerMemory * 2
      });
      
      // Add unique results to candidates
      for (const result of vectorResults) {
        if (result.id !== memory.id && !candidateMemories.some(m => m.id === result.id)) {
          candidateMemories.push(result);
        }
      }
    }
    
    // Score candidate memories based on both tag overlap and vector similarity
    const scoredCandidates: ScoredMemoryRecord[] = [];
    
    for (const candidate of candidateMemories) {
      const candidateTags = candidate.metadata?.tags || [];
      
      // Calculate tag overlap
      const sharedTags = memoryTags.filter((tag: string) => 
        candidateTags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
      );
      
      const tagOverlapScore = sharedTags.length / Math.max(
        Math.min(memoryTags.length, candidateTags.length), 1
      );
      
      // Check if we meet minimum shared tags threshold
      if (sharedTags.length < this.options.minSharedTags && tagOverlapScore < 0.5) {
        // Skip if not enough tag overlap and check vector similarity
        // Get vector similarity if available (from Qdrant search)
        let vectorScore = 'score' in candidate ? (candidate as ScoredMemoryRecord).score : 0;
        
        // If vector score doesn't meet threshold, skip this candidate
        if (vectorScore < this.options.similarityThreshold) {
          continue;
        }
      }
      
      // Calculate combined score (weighted average)
      // 60% tag overlap, 40% vector similarity
      let vectorScore = 'score' in candidate ? (candidate as ScoredMemoryRecord).score : 0;
      const combinedScore = (tagOverlapScore * 0.6) + (vectorScore * 0.4);
      
      // Only include if the combined score meets our threshold
      if (combinedScore >= this.options.similarityThreshold || sharedTags.length >= this.options.minSharedTags) {
        const scoredCandidate: ScoredMemoryRecord = {
          ...candidate,
          score: combinedScore,
          metadata: {
            ...candidate.metadata,
            _scoringDetails: {
              vectorScore,
              tagScore: tagOverlapScore,
              hybridScore: combinedScore,
              usageCount: candidate.metadata?.usage_count || 0,
              adjustedScore: combinedScore,
              matchedTags: sharedTags,
              queryTags: memoryTags as string[]
            }
          }
        };
        
        scoredCandidates.push(scoredCandidate);
      }
    }
    
    // Sort by score and limit to max connections
    return scoredCandidates
      .sort((a, b) => b.score - a.score)
      .slice(0, this.options.maxConnectionsPerMemory);
  }

  /**
   * Determine the relationship type between two memories
   */
  private determineRelationshipType(source: MemoryRecord, target: MemoryRecord): RelationType {
    // Default relationship
    let relationType = RelationType.RELATED_TO;
    
    // If we have specific types in metadata, use those
    const sourceType = source.metadata?.memory_type;
    const targetType = target.metadata?.memory_type;
    
    // Example logic for determining relationship types
    // This could be made more sophisticated with NLP analysis
    if (sourceType === 'principle' && targetType === 'example') {
      return RelationType.INCLUDES;
    }
    
    if (sourceType === 'example' && targetType === 'principle') {
      return RelationType.INSTANCE_OF;
    }
    
    if (sourceType === 'concept' && targetType === 'concept') {
      return RelationType.SIMILAR_TO;
    }
    
    // Check for temporal relationships
    const sourceDate = source.metadata?.timestamp || source.metadata?.created_at;
    const targetDate = target.metadata?.timestamp || target.metadata?.created_at;
    
    if (sourceDate && targetDate) {
      if (new Date(sourceDate) < new Date(targetDate)) {
        return RelationType.PRECEDES;
      } else {
        return RelationType.FOLLOWS;
      }
    }
    
    return relationType;
  }

  /**
   * Get the inverse relationship type
   */
  private getInverseRelationType(relationType: RelationType): RelationType {
    switch (relationType) {
      case RelationType.INCLUDES: return RelationType.MEMBER_OF;
      case RelationType.CAUSES: return RelationType.CAUSED_BY;
      case RelationType.INFLUENCES: return RelationType.INFLUENCED_BY;
      case RelationType.CONTRADICTS: return RelationType.CONTRADICTS; // Symmetric
      case RelationType.SIMILAR_TO: return RelationType.SIMILAR_TO; // Symmetric
      case RelationType.DEPENDS_ON: return RelationType.REQUIRED_BY;
      case RelationType.PRECEDES: return RelationType.FOLLOWS;
      case RelationType.FOLLOWS: return RelationType.PRECEDES;
      case RelationType.SPECIALIZES: return RelationType.GENERALIZES;
      case RelationType.GENERALIZES: return RelationType.SPECIALIZES;
      case RelationType.INSTANCE_OF: return RelationType.HAS_INSTANCE;
      case RelationType.MEMBER_OF: return RelationType.INCLUDES;
      default: return RelationType.RELATED_TO; // Default symmetric relationship
    }
  }

  /**
   * Get memories connected to the specified memory
   * 
   * @param memoryId ID of the memory to get connections for
   * @param maxDepth Maximum traversal depth in the graph
   * @param minWeight Minimum edge weight to consider
   * @returns Connected memories with their relationship info
   */
  async getConnectedMemories(
    memoryId: string,
    maxDepth: number = 1,
    minWeight: number = 0.7
  ): Promise<ScoredMemoryRecord[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Start with direct neighbors only
      if (maxDepth <= 1) {
        const edges = await this.knowledgeGraph.getEdges(memoryId, 'outgoing');
        
        // Filter by minimum weight
        const filteredEdges = edges.filter(edge => 
          (edge.weight ?? edge.strength) >= minWeight
        );
        
        // Get memory records for each edge
        const connectedMemories: ScoredMemoryRecord[] = [];
        
        for (const edge of filteredEdges) {
          const memories = await searchMemory(null, "", {
            filter: { id: edge.target },
            limit: 1
          });
          
          if (memories && memories.length > 0) {
            // Score based on edge weight
            const memory = memories[0];
            const edgeWeight = edge.weight ?? edge.strength;
            const scoredMemory: ScoredMemoryRecord = {
              ...memory,
              score: edgeWeight,
              metadata: {
                ...memory.metadata,
                _graph_relationship: {
                  type: edge.type,
                  weight: edgeWeight,
                  creationMethod: edge.metadata?.creation_method
                }
              }
            };
            
            connectedMemories.push(scoredMemory);
          }
        }
        
        return connectedMemories.sort((a, b) => b.score - a.score);
      }
      
      // For deeper traversal, use graph path finding
      // This is a more complex implementation that would leverage the KnowledgeGraph's
      // path finding capabilities to get multi-hop connections
      // For simplicity, we're focusing on direct connections in this implementation
      
      console.warn(`Deep traversal (depth > 1) not fully implemented yet. Using direct connections.`);
      return this.getConnectedMemories(memoryId, 1, minWeight);
    } catch (error) {
      console.error('Error getting connected memories:', error);
      return [];
    }
  }

  /**
   * Boost scores of memories based on graph connections
   * 
   * @param baseMemories Initial scored memories from vector search
   * @param boostFactor How much to boost connected memories (0-1)
   * @returns Enhanced memories with graph-based boosting
   */
  async boostConnectedMemories(
    baseMemories: ScoredMemoryRecord[],
    boostFactor: number = 0.3
  ): Promise<ScoredMemoryRecord[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!baseMemories || baseMemories.length === 0) {
        return baseMemories;
      }
      
      // Create a map of initial memories
      const memoryMap = new Map<string, ScoredMemoryRecord>();
      baseMemories.forEach(memory => {
        memoryMap.set(memory.id, memory);
      });
      
      // For each memory, get its connected memories and boost them
      const boostedMemories: ScoredMemoryRecord[] = [...baseMemories];
      
      for (const memory of baseMemories) {
        const connectedMemories = await this.getConnectedMemories(memory.id, 1, 0.7);
        
        for (const connected of connectedMemories) {
          // Skip if this is already in our base set with higher score
          const existingMemory = memoryMap.get(connected.id);
          if (existingMemory && existingMemory.score >= connected.score) {
            continue;
          }
          
          // Calculate boosted score - combine edge weight with base memory score
          const baseScore = memory.score;
          const connectionStrength = connected.score; // This is the edge weight
          
          // Boosted score formula: base memory score * connection strength * boost factor
          const boostedScore = memory.score * connectionStrength * boostFactor;
          
          // If we already have this memory in our results, update its score if the new one is higher
          const existingIndex = boostedMemories.findIndex(m => m.id === connected.id);
          
          if (existingIndex >= 0) {
            if (boostedMemories[existingIndex].score < boostedScore) {
              boostedMemories[existingIndex].score = boostedScore;
              boostedMemories[existingIndex].metadata._boosted_by_graph = true;
              boostedMemories[existingIndex].metadata._boost_details = {
                original_score: connected.score,
                boosted_score: boostedScore,
                base_memory_id: memory.id,
                connection_strength: connectionStrength
              };
            }
          } else {
            // Add as a new memory with the boosted score
            const boostedMemory: ScoredMemoryRecord = {
              ...connected,
              score: boostedScore,
              metadata: {
                ...connected.metadata,
                _boosted_by_graph: true,
                _boost_details: {
                  original_score: connected.score,
                  boosted_score: boostedScore,
                  base_memory_id: memory.id,
                  connection_strength: connectionStrength
                }
              }
            };
            
            boostedMemories.push(boostedMemory);
          }
        }
      }
      
      // Sort by score and remove duplicates
      return boostedMemories
        .sort((a, b) => b.score - a.score)
        .filter((memory, index, self) => 
          index === self.findIndex(m => m.id === memory.id)
        );
    } catch (error) {
      console.error('Error boosting connected memories:', error);
      return baseMemories;
    }
  }
  
  /**
   * Discover memory clusters by analyzing the graph structure
   * 
   * @param centerMemoryId Optional center memory to start from
   * @param minClusterSize Minimum size for a cluster
   * @returns Array of memory clusters
   */
  async discoverKnowledgeClusters(
    centerMemoryId?: string,
    minClusterSize: number = 3
  ): Promise<Array<{
    label: string,
    members: ScoredMemoryRecord[],
    commonTags: string[]
  }>> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // For the initial implementation, we'll use a simple approach:
      // 1. If center memory provided, start from its connections
      // 2. For each connection with sufficient weight, get its connections
      // 3. Find groups with high inter-connectivity
      
      let startingPoints: string[] = [];
      
      if (centerMemoryId) {
        // Start from the specified memory
        startingPoints = [centerMemoryId];
      } else {
        // Start from a set of important memories (e.g., with high importance score)
        const importantMemories = await searchMemory(null, "", {
          filter: { importance_score: { $gte: 0.8 } },
          limit: 10
        });
        
        startingPoints = importantMemories.map(m => m.id);
      }
      
      // Array to store discovered clusters
      const clusters: Array<{
        label: string,
        members: ScoredMemoryRecord[],
        commonTags: string[]
      }> = [];
      
      // Process each starting point
      for (const startId of startingPoints) {
        // Get direct connections
        const directConnections = await this.getConnectedMemories(startId, 1, 0.8);
        
        if (directConnections.length < minClusterSize - 1) {
          continue; // Not enough connections to form a cluster
        }
        
        // Get the starting memory
        const centerMemories = await searchMemory(null, "", {
          filter: { id: startId },
          limit: 1
        });
        
        if (!centerMemories || centerMemories.length === 0) {
          continue;
        }
        
        // Form cluster with center and direct connections
        const centerMemory = centerMemories[0];
        const clusterMembers: ScoredMemoryRecord[] = [
          { ...centerMemory, score: 1.0 } as ScoredMemoryRecord,
          ...directConnections
        ];
        
        // Find common tags across the cluster
        const allTags: Record<string, number> = {};
        
        for (const member of clusterMembers) {
          const tags = member.metadata?.tags || [];
          for (const tag of tags) {
            allTags[tag] = (allTags[tag] || 0) + 1;
          }
        }
        
        // Tags that appear in at least half of the members
        const threshold = Math.ceil(clusterMembers.length / 2);
        const commonTags = Object.entries(allTags)
          .filter(([_, count]) => count >= threshold)
          .map(([tag, _]) => tag);
        
        // Generate a label for the cluster based on common tags
        let label = commonTags.length > 0 
          ? commonTags.slice(0, 3).join(', ')
          : `Cluster around ${centerMemory.text?.substring(0, 30)}...`;
        
        clusters.push({
          label,
          members: clusterMembers,
          commonTags
        });
      }
      
      return clusters;
    } catch (error) {
      console.error('Error discovering knowledge clusters:', error);
      return [];
    }
  }
}

/**
 * Function to get the embedding vector for a memory if available
 */
function getEmbeddingVector(memory: MemoryRecord): number[] | null {
  // Check if memory has an embedding vector
  if (memory.metadata?.embedding) {
    return memory.metadata.embedding as number[];
  }
  
  return null;
}

/**
 * Compute vector similarity between two memories if they have embeddings
 */
export function computeMemoryVectorSimilarity(
  memory1: MemoryRecord,
  memory2: MemoryRecord
): number {
  const vector1 = getEmbeddingVector(memory1);
  const vector2 = getEmbeddingVector(memory2);
  
  if (!vector1 || !vector2) {
    return 0;
  }
  
  return computeCosineSimilarity(vector1, vector2);
} 