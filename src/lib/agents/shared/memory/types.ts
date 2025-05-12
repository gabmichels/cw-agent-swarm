/**
 * types.ts - Type declarations for the memory system
 */

import { MemoryType, ImportanceLevel, MemorySource } from '../../../constants/memory';

/**
 * Base memory schema
 */
export interface BaseMemorySchema {
  text: string;
  type: MemoryType;
  metadata: Record<string, unknown>;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryType;
  importance: ImportanceLevel;
  source: MemorySource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

/**
 * Search result
 */
export interface SearchResult<T> {
  id: string;
  content: string;
  type: MemoryType;
  metadata: Record<string, unknown>;
  score: number;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  type?: MemoryType;
  metadata?: Record<string, unknown>;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  totalMemories: number;
  shortTermMemories: number;
  longTermMemories: number;
  memoryUsageRatio: number;
  averageMemorySize: number;
  consolidationStats: {
    lastConsolidation: Date;
    memoriesConsolidated: number;
  };
  pruningStats: {
    lastPruning: Date;
    memoriesPruned: number;
  };
}

/**
 * Memory service interface
 */
export interface MemoryService {
  initialize(): Promise<void>;
  addMemory(params: {
    id: string;
    content: string;
    type: MemoryType;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  getRecentMemories(limit: number): Promise<SearchResult<MemoryEntry>[]>;
  getStats(): Promise<{
    totalMemories: number;
    shortTermMemories: number;
    longTermMemories: number;
    memoryUsageRatio: number;
    averageMemorySize: number;
    consolidationStats: {
      lastConsolidation: string;
      memoriesConsolidated: number;
    };
    pruningStats: {
      lastPruning: string;
      memoriesPruned: number;
    };
  }>;
  clearMemories(): Promise<void>;
  shutdown(): Promise<void>;
  getMemory(params: { id: string; type?: MemoryType }): Promise<MemoryEntry | null>;
  getAllMemories(): Promise<MemoryEntry[]>;
  updateMemory(params: {
    id: string;
    importance?: ImportanceLevel;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  searchMemories(params: {
    type?: MemoryType;
    filter?: Record<string, unknown>;
    limit?: number;
  }): Promise<MemoryEntry[]>;
}

/**
 * Search service interface
 */
export interface SearchService {
  search<T>(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult<T>[]>;
}

/**
 * Memory error class
 */
export class MemoryError extends Error {
  code: string;
  context: Record<string, unknown>;

  constructor(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super(message);
    this.name = 'MemoryError';
    this.code = 'MEMORY_ERROR';
    this.context = context;
    if (cause) {
      this.cause = cause;
    }
  }

  static initFailed(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ): MemoryError {
    const error = new MemoryError(message, context, cause);
    error.code = 'INIT_FAILED';
    return error;
  }

  static shutdownFailed(
    message: string,
    context: Record<string, unknown> = {},
    cause?: Error
  ): MemoryError {
    const error = new MemoryError(message, context, cause);
    error.code = 'SHUTDOWN_FAILED';
    return error;
  }
}

/**
 * Memory decay configuration
 */
export interface MemoryDecayConfig {
  /** Base decay rate per day (0-1) */
  baseDecayRate: number;
  
  /** Decay rate multipliers by memory type */
  typeDecayRates: Partial<Record<MemoryType, number>>;
  
  /** Minimum importance level to prevent decay */
  criticalImportanceLevel: ImportanceLevel;
  
  /** Number of days before decay starts */
  decayStartDays: number;
  
  /** Maximum decay rate (0-1) */
  maxDecayRate: number;
  
  /** Minimum decay rate (0-1) */
  minDecayRate: number;
}

/**
 * Memory decay statistics
 */
export interface MemoryDecayStats {
  /** Total memories processed */
  totalProcessed: number;
  
  /** Memories marked as critical */
  criticalMemories: number;
  
  /** Memories that decayed */
  decayedMemories: number;
  
  /** Average decay rate applied */
  averageDecayRate: number;
  
  /** Last decay calculation timestamp */
  lastDecayCalculation: Date;
}

/**
 * Memory decay calculation result
 */
export interface MemoryDecayResult {
  /** Memory ID */
  id: string;
  
  /** New importance level after decay */
  newImportance: ImportanceLevel;
  
  /** Decay rate applied */
  decayRate: number;
  
  /** Whether memory was marked as critical */
  isCritical: boolean;
  
  /** Number of days since last access */
  daysSinceLastAccess: number;
  
  /** Number of times accessed */
  accessCount: number;
}

/**
 * Knowledge graph node types
 */
export type KnowledgeNodeType =
  | 'task'
  | 'concept'
  | 'trend'
  | 'tool'
  | 'strategy'
  | 'insight'
  | 'project'
  | 'agent';

/**
 * Knowledge graph edge types
 */
export type KnowledgeEdgeType =
  | 'related_to'
  | 'depends_on'
  | 'contradicts'
  | 'supports'
  | 'used_by'
  | 'reported_by'
  | 'produced_by';

/**
 * Knowledge graph node
 */
export interface KnowledgeNode {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph edge
 */
export interface KnowledgeEdge {
  from: string;
  to: string;
  type: KnowledgeEdgeType;
  label?: string;
  strength?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Knowledge graph manager interface
 */
export interface KnowledgeGraphManager {
  initialize(): Promise<void>;
  addNode(node: KnowledgeNode): Promise<void>;
  addEdge(edge: KnowledgeEdge): Promise<void>;
  getNode(id: string): Promise<KnowledgeNode | null>;
  getEdges(nodeId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<KnowledgeEdge[]>;
  findNodes(query: string, type?: KnowledgeNodeType, limit?: number): Promise<KnowledgeNode[]>;
  findPaths(fromId: string, toId: string, maxDepth?: number): Promise<KnowledgeEdge[][]>;
  updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<void>;
  updateEdge(from: string, to: string, updates: Partial<KnowledgeEdge>): Promise<void>;
  deleteNode(id: string): Promise<void>;
  deleteEdge(from: string, to: string): Promise<void>;
  getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<KnowledgeNodeType, number>;
    edgeTypes: Record<KnowledgeEdgeType, number>;
  }>;
  shutdown(): Promise<void>;
  buildGraphFromMemory(memories: Array<{ id: string; content: string; metadata?: any }>, tasks: Array<{ id: string; goal: string; subGoals?: any[]; status: string }>): Promise<void>;
  injectGraphContextIntoPlan(goal: string, maxNodes?: number): Promise<string>;
  getGraphVisualizationData(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
  clear(): void;
}

/**
 * Query expansion configuration
 */
export interface QueryExpansionConfig {
  enabled: boolean;
  maxExpansions: number;
  minQueryLength: number;
  expansionMap: Record<string, string[]>;
}

/**
 * Query clustering configuration
 */
export interface QueryClusteringConfig {
  enabled: boolean;
  minKeywords: number;
  maxClusters: number;
  categories: string[][];
}

/**
 * Enhanced search options
 */
export interface EnhancedSearchOptions extends MemorySearchOptions {
  semanticWeight?: number;
  keywordWeight?: number;
  expandQuery?: boolean;
  requireAllKeywords?: boolean;
  minRelevanceScore?: number;
  useQueryClusters?: boolean;
  debugScores?: boolean;
}

/**
 * Search result with scores
 */
export interface ScoredSearchResult {
  memory: MemoryEntry;
  score: number;
  keywordScore: number;
  semanticScore: number;
  keywordMatches: number;
  boostFactor: number;
} 