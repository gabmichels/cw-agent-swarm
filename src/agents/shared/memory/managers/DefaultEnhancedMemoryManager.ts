/**
 * Default Enhanced Memory Manager Implementation
 * 
 * This file implements the EnhancedMemoryManager interface with cognitive
 * memory capabilities, memory transformation, and advanced processing.
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentBase } from '../../base/AgentBase.interface';
import { DefaultMemoryManager } from '../../../../lib/agents/implementations/managers/DefaultMemoryManager';
import { EnhancedMemoryManager, EnhancedMemoryManagerConfig, EnhancedMemoryEntry, MemoryTransformationOptions } from '../interfaces/EnhancedMemoryManager.interface';
import { CognitiveMemory, CognitivePatternType, CognitiveReasoningType, FindAssociationsOptions, MemoryAssociation, MemoryReasoning, MemorySynthesis, MemorySynthesisOptions, MemoryReasoningOptions, AssociationStrength } from '../interfaces/CognitiveMemory.interface';
import { ConversationSummarizer, ConversationSummaryOptions, ConversationSummaryResult } from '../interfaces/ConversationSummarization.interface';
import { DefaultConversationSummarizer } from '../summarization/DefaultConversationSummarizer';
import { MemoryEntry, MemorySearchOptions, MemoryConsolidationResult, MemoryPruningResult } from '../../../../lib/agents/base/managers/MemoryManager';
import { MemoryVersionHistory, MemoryChangeType, MemoryVersion, MemoryDiff, RollbackOptions, RollbackResult, BatchHistoryOptions, BatchHistoryResult } from '../interfaces/MemoryVersionHistory.interface';
import { DefaultMemoryVersionHistory } from '../history/DefaultMemoryVersionHistory';
import { AbstractBaseManager } from '../../base/managers/BaseManager';
import { ManagerType } from '../../base/managers/ManagerType';
import { ManagerHealth } from '../../base/managers/ManagerHealth';
import { SemanticSearchService } from '../../../../lib/knowledge/SemanticSearchService';
import { KnowledgeGraphManager } from '../../../../lib/agents/implementations/memory/KnowledgeGraphManager';
import { tagExtractor } from '../../../../utils/tagExtractor';
import { Tag } from '../../../../lib/memory/TagExtractor';

/**
 * Error class for enhanced memory manager
 */
class EnhancedMemoryError extends Error {
  constructor(message: string, public readonly code: string = 'ENHANCED_MEMORY_ERROR') {
    super(message);
    this.name = 'EnhancedMemoryError';
  }
}

/**
 * Default implementation of the EnhancedMemoryManager interface.
 * Uses composition with DefaultMemoryManager for core memory functionality.
 */
export class DefaultEnhancedMemoryManager extends AbstractBaseManager implements EnhancedMemoryManager {
  protected baseMemoryManager: DefaultMemoryManager;
  protected conversationSummarizer: ConversationSummarizer;
  protected associations: Map<string, MemoryAssociation> = new Map();
  protected syntheses: Map<string, MemorySynthesis> = new Map();
  protected reasonings: Map<string, MemoryReasoning> = new Map();
  protected enhancedMemories: Map<string, EnhancedMemoryEntry> = new Map();
  protected versionHistory: MemoryVersionHistory;
  protected _config: EnhancedMemoryManagerConfig;
  protected semanticSearch: SemanticSearchService;
  protected knowledgeGraphManager: KnowledgeGraphManager;

  /**
   * Create a new DefaultEnhancedMemoryManager
   * 
   * @param agent The agent this manager belongs to
   * @param config Configuration options
   */
  constructor(
    agent: AgentBase,
    config: Partial<EnhancedMemoryManagerConfig> = {}
  ) {
    super(
      `enhanced-memory-manager-${uuidv4()}`,
      ManagerType.MEMORY,
      agent,
      { enabled: true }
    );

    // Initialize configuration
    this._config = {
      enabled: true,
      enableCognitiveMemory: config.enableCognitiveMemory ?? true,
      enableConversationSummarization: config.enableConversationSummarization ?? true,
      maxAssociationsPerMemory: config.maxAssociationsPerMemory ?? 20,
      enableAutoAssociationDiscovery: config.enableAutoAssociationDiscovery ?? false,
      autoAssociationMinScore: config.autoAssociationMinScore ?? 0.7,
      autoAssociationPatternTypes: config.autoAssociationPatternTypes ?? [
        CognitivePatternType.TEMPORAL,
        CognitivePatternType.CAUSAL
      ],
      autoAssociationIntervalMs: config.autoAssociationIntervalMs ?? 3600000, // 1 hour
      enableVersionHistory: config.enableVersionHistory ?? true,
      maxVersionsPerMemory: config.maxVersionsPerMemory ?? 10,
      autoCreateVersions: config.autoCreateVersions ?? true,
      ...config
    };
    
    // Initialize base memory manager
    this.baseMemoryManager = new DefaultMemoryManager(agent, this._config);

    // Initialize the conversation summarizer
    this.conversationSummarizer = new DefaultConversationSummarizer({
      logger: console,
      defaultOptions: {
        maxEntries: 20,
        maxLength: 500
      }
    });
    
    // Initialize the version history manager
    this.versionHistory = new DefaultMemoryVersionHistory({
      memoryManager: this,
      maxVersionsPerMemory: this._config.maxVersionsPerMemory ?? 10,
      autoCreateVersions: this._config.autoCreateVersions ?? true,
      logger: (message, data) => console.log(`[VersionHistory] ${message}`, data)
    });

    // Initialize knowledge graph manager
    this.knowledgeGraphManager = new KnowledgeGraphManager();

    // Initialize semantic search service
    this.semanticSearch = new SemanticSearchService(this.knowledgeGraphManager);
  }

  /**
   * Initialize the manager
   */
  async initialize(): Promise<boolean> {
    if (this._initialized) {
      return true;
    }

    try {
      // Initialize base memory manager
      const baseInitialized = await this.baseMemoryManager.initialize();
      if (!baseInitialized) {
        return false;
      }

      // Initialize knowledge graph manager
      await this.knowledgeGraphManager.initialize();

      // Initialize data stores (in a real implementation, this might load from a database)
      await this.loadEnhancedMemoryData();
      
      this._initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize enhanced memory manager:', error);
      return false;
    }
  }

  /**
   * Shut down the manager
   */
  async shutdown(): Promise<void> {
    try {
      // Persist any in-memory data before shutting down
      await this.persistEnhancedMemoryData();
      
      // Shut down all managers
      await Promise.all([
        this.baseMemoryManager.shutdown(),
        this.knowledgeGraphManager.shutdown()
      ]);
    } catch (error) {
      console.error('Error during enhanced memory manager shutdown:', error);
    }
  }

  /**
   * Reset the manager
   */
  async reset(): Promise<boolean> {
    try {
      await this.baseMemoryManager.reset();
      this.associations.clear();
      this.syntheses.clear();
      this.reasonings.clear();
      this.enhancedMemories.clear();
      
      // Clear knowledge graph
      this.knowledgeGraphManager.clear();
      
      return true;
    } catch (error) {
      console.error('Error resetting enhanced memory manager:', error);
      return false;
    }
  }

  /**
   * Get manager health status
   */
  async getHealth(): Promise<ManagerHealth> {
    const baseHealth = await this.baseMemoryManager.getHealth();
    return {
      status: this._initialized ? 'healthy' : 'unhealthy',
      message: `Enhanced memory manager is ${this._initialized ? 'healthy' : 'unhealthy'}`,
      details: {
        ...baseHealth.details,
        metrics: {
          ...baseHealth.details.metrics,
          associations: this.associations.size,
          syntheses: this.syntheses.size,
          reasonings: this.reasonings.size,
          enhancedMemories: this.enhancedMemories.size
        }
      }
    };
  }

  // #region Base Memory Operations (delegated to baseMemoryManager)

  async addMemory(content: string, metadata: Record<string, unknown> = {}): Promise<MemoryEntry> {
    const memory = await this.baseMemoryManager.addMemory(content, metadata);
    
    // Check if version history is enabled
    if (this._config.enableVersionHistory && this._config.autoCreateVersions) {
      try {
        // Create initial version for this memory
        await this.versionHistory.createVersion(
          memory.id,
          content,
          MemoryChangeType.CREATED,
          { ...metadata, createdAt: memory.createdAt }
        );
      } catch (error) {
        console.error('Error creating memory version:', error);
      }
    }
    
    return memory;
  }

  async getRecentMemories(limit?: number): Promise<MemoryEntry[]> {
    return this.baseMemoryManager.getRecentMemories(limit);
  }

  async searchMemories(query: string, options?: MemorySearchOptions): Promise<MemoryEntry[]> {
    try {
      // Try semantic search first
      const semanticResults = await this.searchMemoriesSemanticly(query, {
        ...options,
        minScore: 0.6
      });

      // If semantic search found results, return them
      if (semanticResults.length > 0) {
        return semanticResults;
      }

      // Fall back to base memory search
      return this.baseMemoryManager.searchMemories(query, options);
    } catch (error) {
      console.error('Error in enhanced memory search:', error);
      // Fall back to base memory search on error
      return this.baseMemoryManager.searchMemories(query, options);
    }
  }

  async consolidateMemories(): Promise<MemoryConsolidationResult> {
    return this.baseMemoryManager.consolidateMemories();
  }

  async pruneMemories(): Promise<MemoryPruningResult> {
    return this.baseMemoryManager.pruneMemories();
  }

  // #endregion

  /**
   * Load enhanced memory data from storage
   * In a real implementation, this would load from a database
   */
  private async loadEnhancedMemoryData(): Promise<void> {
    // This is a placeholder. In a real implementation, this would load from storage.
    // For example, from a database, file, or other persistent storage.
    console.debug('Loading enhanced memory data');
  }

  /**
   * Persist enhanced memory data to storage
   * In a real implementation, this would save to a database
   */
  private async persistEnhancedMemoryData(): Promise<void> {
    // This is a placeholder. In a real implementation, this would save to storage.
    console.debug('Persisting enhanced memory data');
  }

  /**
   * Verify that a memory exists
   * 
   * @param memoryId ID of the memory to check
   * @throws {EnhancedMemoryError} If the memory doesn't exist
   */
  private async verifyMemoryExists(memoryId: string): Promise<MemoryEntry> {
    // Since DefaultMemoryManager might not have a getMemory method,
    // we'll use searchMemories as a workaround
    const memories = await this.searchMemories(`id:${memoryId}`, {
      limit: 1
    });
    
    const memory = memories.length > 0 ? memories[0] : null;
    if (!memory) {
      throw new EnhancedMemoryError(`Memory ${memoryId} not found`, 'MEMORY_NOT_FOUND');
    }
    return memory;
  }

  /**
   * Get the config with the correct type
   */
  getEnhancedConfig(): EnhancedMemoryManagerConfig {
    return this._config;
  }

  // #region Memory Version History Methods

  /**
   * Create a new version of a memory
   * 
   * @param memoryId ID of the memory
   * @param content Current content of the memory
   * @param changeType Type of change
   * @param metadata Additional metadata
   * @returns Promise resolving to the created version
   */
  async createMemoryVersion(
    memoryId: string,
    content: string,
    changeType: MemoryChangeType = MemoryChangeType.UPDATED,
    metadata?: Record<string, unknown>
  ): Promise<MemoryVersion> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Create the version
    return this.versionHistory.createVersion(memoryId, content, changeType, metadata);
  }
  
  /**
   * Get all versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param options Query options
   * @returns Promise resolving to memory versions
   */
  async getMemoryVersions(
    memoryId: string,
    options?: {
      limit?: number;
      offset?: number;
      sortDirection?: 'asc' | 'desc';
    }
  ): Promise<MemoryVersion[]> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Get the versions
    return this.versionHistory.getVersions(memoryId, options);
  }
  
  /**
   * Get a specific version of a memory
   * 
   * @param memoryId ID of the memory
   * @param versionId ID of the version
   * @returns Promise resolving to the memory version
   */
  async getMemoryVersion(
    memoryId: string,
    versionId: string
  ): Promise<MemoryVersion | null> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Get the version
    return this.versionHistory.getVersion(memoryId, versionId);
  }
  
  /**
   * Roll back a memory to a previous version
   * 
   * @param memoryId ID of the memory to roll back
   * @param options Rollback options
   * @returns Promise resolving to rollback result
   */
  async rollbackMemoryToVersion(
    memoryId: string,
    options: RollbackOptions
  ): Promise<RollbackResult> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Roll back to the version
    return this.versionHistory.rollbackToVersion(memoryId, options);
  }
  
  /**
   * Compare two versions of a memory
   * 
   * @param memoryId ID of the memory
   * @param firstVersionId ID of the first version
   * @param secondVersionId ID of the second version
   * @returns Promise resolving to the difference between versions
   */
  async compareMemoryVersions(
    memoryId: string,
    firstVersionId: string,
    secondVersionId: string
  ): Promise<MemoryDiff> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Compare the versions
    return this.versionHistory.compareVersions(memoryId, firstVersionId, secondVersionId);
  }
  
  /**
   * Perform batch operations on memory history
   * 
   * @param operation Operation to perform ('rollback', 'delete', etc.)
   * @param options Batch operation options
   * @returns Promise resolving to batch operation result
   */
  async batchMemoryHistoryOperation(
    operation: string,
    options: BatchHistoryOptions
  ): Promise<BatchHistoryResult> {
    const config = this.getEnhancedConfig();
    if (!config.enableVersionHistory) {
      throw new EnhancedMemoryError('Version history is disabled', 'VERSION_HISTORY_DISABLED');
    }
    
    // Verify that all memories exist
    for (const memoryId of options.memoryIds) {
      try {
        await this.verifyMemoryExists(memoryId);
      } catch (error) {
        throw new EnhancedMemoryError(
          `Memory ${memoryId} not found in batch operation`,
          'MEMORY_NOT_FOUND'
        );
      }
    }
    
    // Perform the batch operation
    return this.versionHistory.batchHistoryOperation(operation, options);
  }
  
  // #endregion Memory Version History Methods
  
  // #region Cognitive Memory Methods
  
  /**
   * Create an association between two memories
   * 
   * @param sourceMemoryId ID of the source memory
   * @param targetMemoryId ID of the target memory
   * @param associationType Type of association
   * @param description Description of the association
   * @param options Additional options
   * @returns Promise resolving to the created association
   */
  async createAssociation(
    sourceMemoryId: string,
    targetMemoryId: string,
    associationType: CognitivePatternType,
    description: string,
    options: {
      strength?: AssociationStrength;
      score?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<MemoryAssociation> {
    // Verify that both memories exist
    await this.verifyMemoryExists(sourceMemoryId);
    await this.verifyMemoryExists(targetMemoryId);
    
    // Check if we're at the association limit for this memory
    const existingAssociations = await this.findAssociations(sourceMemoryId);
    const config = this.getEnhancedConfig();
    
    if (existingAssociations.length >= (config.maxAssociationsPerMemory || 20)) {
      throw new EnhancedMemoryError(
        `Memory ${sourceMemoryId} has reached the maximum number of associations`,
        'MAX_ASSOCIATIONS_REACHED'
      );
    }
    
    // Create the association
    const id = uuidv4();
    const now = new Date();
    
    const association: MemoryAssociation = {
      id,
      sourceMemoryId,
      targetMemoryId,
      associationType,
      description,
      strength: options.strength || AssociationStrength.MODERATE,
      createdAt: now,
      score: options.score || 0.5,
      metadata: options.metadata || {}
    };
    
    // Store the association
    this.associations.set(id, association);
    
    return association;
  }
  
  /**
   * Find associations for a memory
   * 
   * @param memoryId ID of the memory to find associations for
   * @param options Search options
   * @returns Promise resolving to matching associations
   */
  async findAssociations(
    memoryId: string,
    options: FindAssociationsOptions = {}
  ): Promise<MemoryAssociation[]> {
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Get all associations where this memory is the source
    let associations = Array.from(this.associations.values()).filter(
      association => association.sourceMemoryId === memoryId
    );
    
    // Apply filters
    if (options.associationType) {
      associations = associations.filter(
        association => association.associationType === options.associationType
      );
    }
    
    if (options.minStrength) {
      const strengthOrder = {
        [AssociationStrength.WEAK]: 0,
        [AssociationStrength.MODERATE]: 1,
        [AssociationStrength.STRONG]: 2,
        [AssociationStrength.VERY_STRONG]: 3
      };
      
      const minStrengthValue = strengthOrder[options.minStrength];
      
      associations = associations.filter(
        association => strengthOrder[association.strength] >= minStrengthValue
      );
    }
    
    if (options.minScore !== undefined) {
      associations = associations.filter(
        association => association.score >= options.minScore!
      );
    }
    
    if (options.createdAfter) {
      associations = associations.filter(
        association => association.createdAt > options.createdAfter!
      );
    }
    
    if (options.metadata) {
      associations = associations.filter(association => {
        for (const [key, value] of Object.entries(options.metadata || {})) {
          if (association.metadata[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Apply limit
    if (options.limit) {
      associations = associations.slice(0, options.limit);
    }
    
    return associations;
  }
  
  /**
   * Discover associations between memories automatically
   * 
   * @param memoryIds IDs of memories to analyze
   * @param options Discovery options
   * @returns Promise resolving to discovered associations
   */
  async discoverAssociations(
    memoryIds: string[],
    options: {
      patternTypes?: CognitivePatternType[];
      minScore?: number;
      maxResults?: number;
    } = {}
  ): Promise<MemoryAssociation[]> {
    // Set default options
    const patternTypes = options.patternTypes || Object.values(CognitivePatternType);
    const minScore = options.minScore || 0.5;
    const maxResults = options.maxResults || 10;
    
    // Verify that all memories exist
    const memories: MemoryEntry[] = [];
    for (const memoryId of memoryIds) {
      const memory = await this.verifyMemoryExists(memoryId);
      memories.push(memory);
    }
    
    if (memories.length < 2) {
      return [];
    }
    
    // In a real implementation, this would use an LLM or other algorithm
    // to discover associations between memories. For now, we'll simulate it.
    
    const discoveredAssociations: MemoryAssociation[] = [];
    
    // For each pair of memories, create a simulated association
    for (let i = 0; i < memories.length - 1; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const sourceMemory = memories[i];
        const targetMemory = memories[j];
        
        // Randomly choose a pattern type from the allowed types
        const patternTypeIndex = Math.floor(Math.random() * patternTypes.length);
        const patternType = patternTypes[patternTypeIndex];
        
        // Calculate a simulated score (in a real implementation, this would
        // be based on actual analysis of the memories)
        const score = Math.random() * 0.5 + 0.5; // Score between 0.5 and 1.0
        
        // Only create associations that meet the minimum score threshold
        if (score < minScore) {
          continue;
        }
        
        // Determine strength based on score
        let strength = AssociationStrength.WEAK;
        if (score > 0.9) {
          strength = AssociationStrength.VERY_STRONG;
        } else if (score > 0.8) {
          strength = AssociationStrength.STRONG;
        } else if (score > 0.6) {
          strength = AssociationStrength.MODERATE;
        }
        
        // Create a description (in a real implementation, this would
        // be a meaningful description generated by an LLM)
        const description = `Discovered ${patternType} association between memories`;
        
        const association: MemoryAssociation = {
          id: uuidv4(),
          sourceMemoryId: sourceMemory.id,
          targetMemoryId: targetMemory.id,
          associationType: patternType,
          description,
          strength,
          createdAt: new Date(),
          score,
          metadata: {
            discovered: true,
            discoveryMethod: 'auto'
          }
        };
        
        discoveredAssociations.push(association);
        
        // Store the association
        this.associations.set(association.id, association);
      }
    }
    
    // Sort by score and apply limit
    return discoveredAssociations
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }
  
  /**
   * Synthesize patterns from multiple memories
   * 
   * @param options Synthesis options
   * @returns Promise resolving to synthesis result
   */
  async synthesizeMemories(
    options: MemorySynthesisOptions
  ): Promise<MemorySynthesis> {
    // Verify that all memories exist
    const memories: MemoryEntry[] = [];
    for (const memoryId of options.memoryIds) {
      const memory = await this.verifyMemoryExists(memoryId);
      memories.push(memory);
    }
    
    if (memories.length < 2) {
      throw new EnhancedMemoryError(
        'At least 2 memories are required for synthesis',
        'INSUFFICIENT_MEMORIES'
      );
    }
    
    // In a real implementation, this would use an LLM to synthesize the memories
    // For now, we'll create a simulated synthesis
    
    // Default to conceptual pattern if not specified
    const patternType = options.patternType || CognitivePatternType.CONCEPTUAL;
    
    // Create a simulated content
    const contentParts = memories.map(memory => {
      // Extract a snippet from each memory's content
      const snippet = memory.content.substring(0, 30) + (memory.content.length > 30 ? '...' : '');
      return snippet;
    });
    
    const content = `Synthesis of memories: ${contentParts.join(' | ')}`;
    
    // Create the synthesis
    const synthesis: MemorySynthesis = {
      id: uuidv4(),
      sourceMemoryIds: options.memoryIds,
      content: options.maxLength ? content.substring(0, options.maxLength) : content,
      patternType,
      confidence: 0.8, // Simulated confidence
      createdAt: new Date(),
      metadata: options.metadata || {}
    };
    
    // Store the synthesis
    this.syntheses.set(synthesis.id, synthesis);
    
    return synthesis;
  }
  
  /**
   * Perform reasoning across multiple memories
   * 
   * @param options Reasoning options
   * @returns Promise resolving to reasoning result
   */
  async reasonAcrossMemories(
    options: MemoryReasoningOptions
  ): Promise<MemoryReasoning> {
    // Verify that all memories exist
    const memories: MemoryEntry[] = [];
    for (const memoryId of options.memoryIds) {
      const memory = await this.verifyMemoryExists(memoryId);
      memories.push(memory);
    }
    
    if (memories.length === 0) {
      throw new EnhancedMemoryError(
        'At least 1 memory is required for reasoning',
        'INSUFFICIENT_MEMORIES'
      );
    }
    
    // In a real implementation, this would use an LLM to perform reasoning
    // For now, we'll create a simulated reasoning result
    
    // Create a simulated reasoning result based on the prompt
    const result = `Reasoning result for prompt: "${options.prompt}" across ${memories.length} memories`;
    
    // Create the reasoning
    const reasoning: MemoryReasoning = {
      id: uuidv4(),
      memoryIds: options.memoryIds,
      prompt: options.prompt,
      result: options.maxLength ? result.substring(0, options.maxLength) : result,
      reasoningType: options.reasoningType,
      confidence: 0.75, // Simulated confidence
      createdAt: new Date(),
      metadata: options.metadata || {}
    };
    
    // Store the reasoning
    this.reasonings.set(reasoning.id, reasoning);
    
    return reasoning;
  }
  
  /**
   * Find similar memory patterns
   * 
   * @param patternType Type of pattern to find
   * @param options Search options
   * @returns Promise resolving to sets of memories with similar patterns
   */
  async findSimilarPatterns(
    patternType: CognitivePatternType,
    options: {
      minMemories?: number;
      maxMemories?: number;
      minConfidence?: number;
      limit?: number;
    } = {}
  ): Promise<MemorySynthesis[]> {
    // Set default options
    const minMemories = options.minMemories || 2;
    const maxMemories = options.maxMemories || 5;
    const minConfidence = options.minConfidence || 0.7;
    const limit = options.limit || 5;
    
    // Get all syntheses of the specified pattern type
    let patterns = Array.from(this.syntheses.values()).filter(
      synthesis => synthesis.patternType === patternType
    );
    
    // Apply filters
    patterns = patterns.filter(synthesis => {
      const memoryCount = synthesis.sourceMemoryIds.length;
      return (
        memoryCount >= minMemories &&
        memoryCount <= maxMemories &&
        synthesis.confidence >= minConfidence
      );
    });
    
    // Sort by confidence and limit
    return patterns
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }
  
  /**
   * Extract insights from memories
   * 
   * @param memoryIds IDs of memories to analyze
   * @param options Insight extraction options
   * @returns Promise resolving to extracted insights
   */
  async extractInsights(
    memoryIds: string[],
    options: {
      maxInsights?: number;
      minConfidence?: number;
      context?: string;
    } = {}
  ): Promise<string[]> {
    // Set default options
    const maxInsights = options.maxInsights || 3;
    const minConfidence = options.minConfidence || 0.7;
    
    // Verify that all memories exist
    const memories: MemoryEntry[] = [];
    for (const memoryId of memoryIds) {
      const memory = await this.verifyMemoryExists(memoryId);
      memories.push(memory);
    }
    
    if (memories.length === 0) {
      return [];
    }
    
    // In a real implementation, this would use an LLM to extract insights
    // For now, we'll create simulated insights
    
    // Get content snippets from each memory
    const contentSnippets = memories.map(memory => {
      return memory.content.substring(0, 50) + (memory.content.length > 50 ? '...' : '');
    });
    
    // Create simulated insights
    const insights: string[] = [];
    const numInsights = Math.min(maxInsights, memories.length);
    
    for (let i = 0; i < numInsights; i++) {
      insights.push(`Insight ${i + 1}: Observation about "${contentSnippets[i % contentSnippets.length]}"`);
    }
    
    return insights;
  }
  
  // #endregion Cognitive Memory Methods

  // #region Conversation Summarization Methods
  
  /**
   * Summarize a conversation
   * 
   * @param options Options for summarization
   * @returns Promise resolving to the summary result
   */
  async summarizeConversation(options?: ConversationSummaryOptions): Promise<ConversationSummaryResult> {
    // If conversation summarization is disabled, throw an error
    const config = this.getEnhancedConfig();
    if (!config.enableConversationSummarization) {
      throw new EnhancedMemoryError(
        'Conversation summarization is disabled',
        'CONVERSATION_SUMMARIZATION_DISABLED'
      );
    }
    
    try {
      // Delegate to the conversation summarizer
      return await this.conversationSummarizer.summarizeConversation(options);
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      return {
        summary: 'Failed to generate summary',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stats: {
          messageCount: 0,
          userMessageCount: 0,
          agentMessageCount: 0,
          systemMessageCount: 0
        }
      };
    }
  }
  
  /**
   * Summarize multiple conversations
   * 
   * @param conversationIds IDs of conversations to summarize
   * @param options Options for summarization
   * @returns Promise resolving to summaries for each conversation
   */
  async summarizeMultipleConversations(
    conversationIds: string[],
    options?: ConversationSummaryOptions
  ): Promise<Record<string, ConversationSummaryResult>> {
    // If conversation summarization is disabled, throw an error
    const config = this.getEnhancedConfig();
    if (!config.enableConversationSummarization) {
      throw new EnhancedMemoryError(
        'Conversation summarization is disabled',
        'CONVERSATION_SUMMARIZATION_DISABLED'
      );
    }
    
    try {
      // Delegate to the conversation summarizer
      return await this.conversationSummarizer.summarizeMultipleConversations(
        conversationIds,
        options
      );
    } catch (error) {
      console.error('Error summarizing multiple conversations:', error);
      
      // Create a failed result for each conversation ID
      const results: Record<string, ConversationSummaryResult> = {};
      for (const id of conversationIds) {
        results[id] = {
          summary: 'Failed to generate summary',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stats: {
            messageCount: 0,
            userMessageCount: 0,
            agentMessageCount: 0,
            systemMessageCount: 0
          }
        };
      }
      
      return results;
    }
  }
  
  /**
   * Get conversation topics
   * 
   * @param conversationId ID of conversation to analyze
   * @param options Options for topic extraction
   * @returns Promise resolving to extracted topics
   */
  async getConversationTopics(
    conversationId: string,
    options?: { maxTopics?: number; minConfidence?: number }
  ): Promise<string[]> {
    // If conversation summarization is disabled, throw an error
    const config = this.getEnhancedConfig();
    if (!config.enableConversationSummarization) {
      throw new EnhancedMemoryError(
        'Conversation summarization is disabled',
        'CONVERSATION_SUMMARIZATION_DISABLED'
      );
    }
    
    try {
      // Delegate to the conversation summarizer
      return await this.conversationSummarizer.getConversationTopics(
        conversationId,
        options
      );
    } catch (error) {
      console.error('Error extracting conversation topics:', error);
      return [];
    }
  }
  
  /**
   * Extract action items from conversation
   * 
   * @param conversationId ID of conversation to analyze
   * @param options Options for action item extraction
   * @returns Promise resolving to extracted action items
   */
  async extractActionItems(
    conversationId: string,
    options?: { maxItems?: number; minConfidence?: number }
  ): Promise<string[]> {
    // If conversation summarization is disabled, throw an error
    const config = this.getEnhancedConfig();
    if (!config.enableConversationSummarization) {
      throw new EnhancedMemoryError(
        'Conversation summarization is disabled',
        'CONVERSATION_SUMMARIZATION_DISABLED'
      );
    }
    
    try {
      // Delegate to the conversation summarizer
      return await this.conversationSummarizer.extractActionItems(
        conversationId,
        options
      );
    } catch (error) {
      console.error('Error extracting action items:', error);
      return [];
    }
  }
  
  // #endregion Conversation Summarization Methods

  // #region Enhanced Memory Methods
  
  /**
   * Get enhanced memory entry
   * 
   * @param memoryId ID of the memory to retrieve
   * @returns Promise resolving to the enhanced memory entry
   */
  async getEnhancedMemory(memoryId: string): Promise<EnhancedMemoryEntry | null> {
    // First, check if we already have an enhanced version of this memory
    const cachedEnhancedMemory = this.enhancedMemories.get(memoryId);
    if (cachedEnhancedMemory) {
      return cachedEnhancedMemory;
    }
    
    // If not, try to get the base memory
    const memories = await this.searchMemories(`id:${memoryId}`, {
      limit: 1
    });
    
    const baseMemory = memories.length > 0 ? memories[0] : null;
    if (!baseMemory) {
      return null;
    }
    
    // Create an enhanced version of the memory
    const enhancedMemory: EnhancedMemoryEntry = {
      ...baseMemory,
      // Default values for enhanced properties
      importance: 0.5,
      novelty: 0.5,
      cognitivelyProcessed: false
    };
    
    // Find any associations for this memory
    const associations = await this.findAssociations(memoryId);
    if (associations.length > 0) {
      enhancedMemory.associations = associations;
    }
    
    // Cache the enhanced memory
    this.enhancedMemories.set(memoryId, enhancedMemory);
    
    return enhancedMemory;
  }

  // Additional enhanced memory methods will be implemented in future steps
  // #endregion Enhanced Memory Methods

  /**
   * Transform a memory
   * 
   * @param memoryId ID of the memory to transform
   * @param options Transformation options
   * @returns Promise resolving to the transformed memory
   */
  async transformMemory(memoryId: string, options: MemoryTransformationOptions): Promise<EnhancedMemoryEntry> {
    // Verify that the memory exists
    const baseMemory = await this.verifyMemoryExists(memoryId);
    
    // In a real implementation, this would use an LLM to transform the memory
    // For now, we'll create a simulated transformation
    
    let transformedContent = baseMemory.content;
    
    switch (options.transformationType) {
      case 'generalize':
        transformedContent = `Generalized: ${baseMemory.content.substring(0, 100)}...`;
        break;
      case 'specify':
        transformedContent = `Specific details: ${baseMemory.content.substring(0, 100)}...`;
        break;
      case 'reframe':
        transformedContent = `Reframed perspective: ${baseMemory.content.substring(0, 100)}...`;
        break;
      case 'connect':
        transformedContent = `Connected context: ${baseMemory.content.substring(0, 100)}...`;
        break;
      case 'simplify':
        transformedContent = `Simplified: ${baseMemory.content.substring(0, 100)}...`;
        break;
    }
    
    // Apply length limit if specified
    if (options.maxLength && transformedContent.length > options.maxLength) {
      transformedContent = transformedContent.substring(0, options.maxLength);
    }
    
    // Create an enhanced memory with the transformed content
    const enhancedMemory: EnhancedMemoryEntry = {
      ...baseMemory,
      id: uuidv4(), // New ID for the transformed memory
      content: transformedContent,
      metadata: {
        ...baseMemory.metadata,
        transformationType: options.transformationType,
        originalMemoryId: memoryId,
        ...options.metadata
      },
      importance: 0.7, // Default importance for transformed memories
      novelty: 0.8, // Default novelty for transformed memories
      cognitivelyProcessed: true
    };
    
    // Store the enhanced memory
    this.enhancedMemories.set(enhancedMemory.id, enhancedMemory);
    
    return enhancedMemory;
  }
  
  /**
   * Rate memory importance
   * 
   * @param memoryId ID of the memory to rate
   * @returns Promise resolving to the importance score (0-1)
   */
  async rateMemoryImportance(memoryId: string): Promise<number> {
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // In a real implementation, this would use an algorithm or model to rate importance
    // For now, we'll return a simulated score
    const score = 0.5 + Math.random() * 0.5; // Score between 0.5 and 1.0
    
    // Get or create enhanced memory
    const enhancedMemory = await this.getEnhancedMemory(memoryId);
    if (enhancedMemory) {
      enhancedMemory.importance = score;
      this.enhancedMemories.set(memoryId, enhancedMemory);
    }
    
    return score;
  }
  
  /**
   * Rate memory novelty
   * 
   * @param memoryId ID of the memory to rate
   * @returns Promise resolving to the novelty score (0-1)
   */
  async rateMemoryNovelty(memoryId: string): Promise<number> {
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // In a real implementation, this would use an algorithm or model to rate novelty
    // For now, we'll return a simulated score
    const score = 0.5 + Math.random() * 0.5; // Score between 0.5 and 1.0
    
    // Get or create enhanced memory
    const enhancedMemory = await this.getEnhancedMemory(memoryId);
    if (enhancedMemory) {
      enhancedMemory.novelty = score;
      this.enhancedMemories.set(memoryId, enhancedMemory);
    }
    
    return score;
  }
  
  /**
   * Analyze memory emotional content
   * 
   * @param memoryId ID of the memory to analyze
   * @returns Promise resolving to the emotional valence (-1 to 1)
   */
  async analyzeMemoryEmotion(memoryId: string): Promise<number> {
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // In a real implementation, this would use sentiment analysis
    // For now, we'll return a simulated score
    const score = Math.random() * 2 - 1; // Score between -1 and 1
    
    // Get or create enhanced memory
    const enhancedMemory = await this.getEnhancedMemory(memoryId);
    if (enhancedMemory) {
      enhancedMemory.emotionalValence = score;
      this.enhancedMemories.set(memoryId, enhancedMemory);
    }
    
    return score;
  }
  
  /**
   * Categorize memory
   * 
   * @param memoryId ID of the memory to categorize
   * @param options Categorization options
   * @returns Promise resolving to assigned categories
   */
  async categorizeMemory(
    memoryId: string,
    options: {
      maxCategories?: number;
      customCategories?: string[];
      minConfidence?: number;
    } = {}
  ): Promise<string[]> {
    // Verify that the memory exists
    const memory = await this.verifyMemoryExists(memoryId);
    
    // Default options
    const maxCategories = options.maxCategories || 3;
    const minConfidence = options.minConfidence || 0.7;
    
    // Standard categories if custom ones aren't provided
    const defaultCategories = [
      'personal', 'work', 'learning', 'entertainment', 'health',
      'finance', 'relationships', 'travel', 'food', 'technology'
    ];
    
    const candidateCategories = options.customCategories || defaultCategories;
    
    // In a real implementation, this would use an algorithm or model to categorize
    // For now, we'll return simulated categories
    const content = memory.content.toLowerCase();
    const matchedCategories: string[] = [];
    
    // Simple word matching for demonstration
    for (const category of candidateCategories) {
      if (content.includes(category.toLowerCase()) && Math.random() > 0.3) {
        matchedCategories.push(category);
      }
    }
    
    // If no matches found, pick random categories
    if (matchedCategories.length === 0) {
      const numCategories = Math.min(maxCategories, 2);
      for (let i = 0; i < numCategories; i++) {
        const randomIndex = Math.floor(Math.random() * candidateCategories.length);
        matchedCategories.push(candidateCategories[randomIndex]);
      }
    }
    
    // Create a simplified version that works with ES5
    const categories = Array.from(new Set(matchedCategories)).slice(0, maxCategories);

    // Get or create enhanced memory
    const enhancedMemory = await this.getEnhancedMemory(memoryId);
    if (enhancedMemory) {
      enhancedMemory.categories = categories;
      this.enhancedMemories.set(memoryId, enhancedMemory);
    }
    
    return categories;
  }
  
  /**
   * Generate complete memory context
   * 
   * @param memoryId ID of the main memory
   * @param options Context generation options
   * @returns Promise resolving to the complete memory context
   */
  async generateMemoryContext(
    memoryId: string,
    options: {
      maxAssociatedMemories?: number;
      maxDepth?: number;
      includeReasoningPatterns?: boolean;
      includeSynthesis?: boolean;
    } = {}
  ): Promise<{
    mainMemory: EnhancedMemoryEntry;
    associatedMemories: EnhancedMemoryEntry[];
    synthesis?: MemorySynthesis;
    reasoning?: MemoryReasoning;
  }> {
    // Verify that the memory exists
    await this.verifyMemoryExists(memoryId);
    
    // Get enhanced memory
    const mainMemory = await this.getEnhancedMemory(memoryId);
    if (!mainMemory) {
      throw new EnhancedMemoryError(`Failed to get enhanced memory for ${memoryId}`, 'MEMORY_NOT_FOUND');
    }
    
    // Set defaults
    const maxAssociatedMemories = options.maxAssociatedMemories || 5;
    const maxDepth = options.maxDepth || 1;
    const includeReasoningPatterns = options.includeReasoningPatterns ?? true;
    const includeSynthesis = options.includeSynthesis ?? true;
    
    // Get associated memories
    const associatedMemoriesSet = new Set<string>();
    const processedMemories = new Set<string>([memoryId]);
    const memoriesToProcess = [memoryId];
    let currentDepth = 0;
    
    while (memoriesToProcess.length > 0 && currentDepth < maxDepth) {
      const currentMemoryId = memoriesToProcess.shift()!;
      const associations = await this.findAssociations(currentMemoryId);
      
      for (const association of associations) {
        if (!processedMemories.has(association.targetMemoryId)) {
          associatedMemoriesSet.add(association.targetMemoryId);
          
          if (currentDepth < maxDepth - 1) {
            memoriesToProcess.push(association.targetMemoryId);
          }
          
          processedMemories.add(association.targetMemoryId);
          
          if (associatedMemoriesSet.size >= maxAssociatedMemories) {
            break;
          }
        }
      }
      
      if (memoriesToProcess.length === 0 && currentDepth < maxDepth - 1) {
        currentDepth++;
      }
    }
    
    // Get all associated memories as enhanced memories
    const associatedMemories: EnhancedMemoryEntry[] = [];
    const associatedMemoryIdsArray = Array.from(associatedMemoriesSet);
    
    for (const associatedMemoryId of associatedMemoryIdsArray) {
      const enhancedMemory = await this.getEnhancedMemory(associatedMemoryId);
      if (enhancedMemory) {
        associatedMemories.push(enhancedMemory);
      }
    }
    
    // Result object
    const result: {
      mainMemory: EnhancedMemoryEntry;
      associatedMemories: EnhancedMemoryEntry[];
      synthesis?: MemorySynthesis;
      reasoning?: MemoryReasoning;
    } = {
      mainMemory,
      associatedMemories
    };
    
    // Add synthesis if requested
    if (includeSynthesis && associatedMemories.length > 0) {
      const allMemoryIds = [memoryId].concat(associatedMemoryIdsArray);
      
      try {
        const synthesis = await this.synthesizeMemories({
          memoryIds: allMemoryIds.slice(0, Math.min(allMemoryIds.length, 5)),
          patternType: CognitivePatternType.CONCEPTUAL
        });
        
        result.synthesis = synthesis;
      } catch (error) {
        console.warn('Failed to generate synthesis:', error);
      }
    }
    
    // Add reasoning if requested
    if (includeReasoningPatterns && associatedMemories.length > 0) {
      const allMemoryIds = [memoryId].concat(associatedMemoryIdsArray);
      
      try {
        const reasoning = await this.reasonAcrossMemories({
          memoryIds: allMemoryIds.slice(0, Math.min(allMemoryIds.length, 3)),
          reasoningType: CognitiveReasoningType.ABDUCTIVE,
          prompt: `What connections can be made between these memories?`
        });
        
        result.reasoning = reasoning;
      } catch (error) {
        console.warn('Failed to generate reasoning:', error);
      }
    }
    
    return result;
  }
  
  /**
   * Process memory cognitively
   * 
   * @param memoryId ID of the memory to process
   * @param options Processing options
   * @returns Promise resolving when processing is complete
   */
  async processMemoryCognitively(
    memoryId: string,
    options: {
      processingTypes?: Array<'associations' | 'importance' | 'novelty' | 'emotion' | 'categorization'>;
      forceReprocess?: boolean;
    } = {}
  ): Promise<EnhancedMemoryEntry> {
    // Get enhanced memory
    let enhancedMemory = await this.getEnhancedMemory(memoryId);
    if (!enhancedMemory) {
      throw new EnhancedMemoryError(`Failed to get enhanced memory for ${memoryId}`, 'MEMORY_NOT_FOUND');
    }
    
    // Check if reprocessing is needed
    if (enhancedMemory.cognitivelyProcessed && !options.forceReprocess) {
      return enhancedMemory;
    }
    
    // Default process everything if not specified
    const processingTypes = options.processingTypes || [
      'associations', 'importance', 'novelty', 'emotion', 'categorization'
    ];
    
    // Process each requested type
    const processingPromises: Promise<unknown>[] = [];
    
    if (processingTypes.includes('associations')) {
      // Find similar memories and create associations
      const recentMemories = await this.getRecentMemories(10);
      const recentMemoryIds = recentMemories
        .filter(m => m.id !== memoryId)
        .map(m => m.id);
      
      if (recentMemoryIds.length > 0) {
        processingPromises.push(
          this.discoverAssociations([memoryId, ...recentMemoryIds])
        );
      }
    }
    
    if (processingTypes.includes('importance')) {
      processingPromises.push(this.rateMemoryImportance(memoryId));
    }
    
    if (processingTypes.includes('novelty')) {
      processingPromises.push(this.rateMemoryNovelty(memoryId));
    }
    
    if (processingTypes.includes('emotion')) {
      processingPromises.push(this.analyzeMemoryEmotion(memoryId));
    }
    
    if (processingTypes.includes('categorization')) {
      processingPromises.push(this.categorizeMemory(memoryId));
    }
    
    // Wait for all processing to complete
    await Promise.all(processingPromises);
    
    // Update processed state
    enhancedMemory = await this.getEnhancedMemory(memoryId) || enhancedMemory;
    enhancedMemory.cognitivelyProcessed = true;
    enhancedMemory.lastCognitiveProcessingTime = new Date();
    
    // Store updated enhanced memory
    this.enhancedMemories.set(memoryId, enhancedMemory);
    
    return enhancedMemory;
  }
  
  /**
   * Batch process memories cognitively
   * 
   * @param memoryIds IDs of memories to process
   * @param options Processing options
   * @returns Promise resolving when processing is complete
   */
  async batchProcessMemoriesCognitively(
    memoryIds: string[],
    options: {
      processingTypes?: Array<'associations' | 'importance' | 'novelty' | 'emotion' | 'categorization'>;
      forceReprocess?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<EnhancedMemoryEntry[]> {
    if (memoryIds.length === 0) {
      return [];
    }
    
    // Set default options
    const maxConcurrent = options.maxConcurrent || 5;
    
    // Process in batches to avoid overwhelming resources
    const results: EnhancedMemoryEntry[] = [];
    const batches: string[][] = [];
    
    // Create batches
    for (let i = 0; i < memoryIds.length; i += maxConcurrent) {
      batches.push(memoryIds.slice(i, i + maxConcurrent));
    }
    
    // Process each batch
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(memoryId => this.processMemoryCognitively(memoryId, options))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Search memories using semantic search
   */
  async searchMemoriesSemanticly(
    query: string,
    options: MemorySearchOptions & {
      minScore?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      // Get semantic search results
      const searchResults = await this.semanticSearch.searchKnowledge(query, {
        limit: options.limit,
        threshold: options.minScore || 0.6
      });

      // Map search results to memory entries
      const memories = await Promise.all(
        searchResults.map(async result => {
          const memory = await this.baseMemoryManager.getMemory(result.item.id);
          if (!memory) {
            throw new Error(`Memory ${result.item.id} not found`);
          }
          return {
            ...memory,
            metadata: {
              ...memory.metadata,
              semanticScore: result.score,
              highlights: result.highlights
            }
          };
        })
      );

      return memories;
    } catch (error) {
      console.error('Error in semantic memory search:', error);
      // Fall back to base memory search
      return this.baseMemoryManager.searchMemories(query, options);
    }
  }

  /**
   * Retrieve memories relevant to a query with visualization support
   * @param query The query to search for
   * @param options Options for memory retrieval
   * @returns Array of relevant memories
   */
  async retrieveRelevantMemories(
    query: string,
    options: {
      limit?: number;
      types?: string[];
      tags?: string[];
      minRelevance?: number;
      includeCritical?: boolean;
      visualization?: any;
      visualizer?: any;
    } = {}
  ): Promise<MemoryEntry[]> {
    try {
      // Create visualization node if visualization is enabled
      const visualization = options.visualization;
      const visualizer = options.visualizer;
      let retrievalNodeId: string | undefined;
      
      if (visualization && visualizer) {
        try {
          // Create a memory retrieval visualization node
          retrievalNodeId = visualizer.addNode(
            visualization,
            'context_retrieval', // VisualizationNodeType.CONTEXT_RETRIEVAL
            'Enhanced Memory Retrieval',
            {
              query,
              types: options.types || [],
              tags: options.tags || [],
              timestamp: Date.now()
            },
            'in_progress'
          );
        } catch (error) {
          console.error('Error creating enhanced memory retrieval visualization node:', error);
        }
      }
      
      // First try semantic search for better results
      let memories: MemoryEntry[] = [];
      try {
        memories = await this.searchMemoriesSemanticly(query, {
          limit: options.limit || 10,
          minScore: options.minRelevance || 0.6
        });
      } catch (error) {
        console.error('Semantic search failed, falling back to standard search:', error);
      }
      
      // If semantic search didn't return results, fall back to standard search
      if (memories.length === 0) {
        // Prepare search options
        const searchOptions: MemorySearchOptions = {
          limit: options.limit || 10,
          metadata: {} as Record<string, any>
        };
        
        // Add type filter if specified
        if (options.types && options.types.length > 0) {
          searchOptions.metadata = searchOptions.metadata || {};
          searchOptions.metadata['type'] = options.types;
        }
        
        // Add tag filter if specified
        if (options.tags && options.tags.length > 0) {
          searchOptions.metadata = searchOptions.metadata || {};
          searchOptions.metadata['tags'] = options.tags;
        }
        
        // Get memories
        memories = await this.searchMemories(query, searchOptions);
      }
      
      // Update visualization node if it was created
      if (visualization && visualizer && retrievalNodeId) {
        try {
          // Find the retrieval node
          const retrievalNode = visualization.nodes.find(
            (node: { id: string }) => node.id === retrievalNodeId
          );
          
          if (retrievalNode) {
            // Create array of unique memory types
            const memoryTypes: string[] = [];
            memories.forEach(m => {
              const type = m.metadata?.type as string || 'unknown';
              if (!memoryTypes.includes(type)) {
                memoryTypes.push(type);
              }
            });
            
            // Extract unique tags from memories
            const memoryTags: string[] = [];
            memories.forEach(m => {
              const tags = m.metadata?.tags as string[] || [];
              tags.forEach(tag => {
                if (!memoryTags.includes(tag)) {
                  memoryTags.push(tag);
                }
              });
            });
            
            // Update with results
            retrievalNode.status = 'completed';
            retrievalNode.data = {
              ...retrievalNode.data,
              resultCount: memories.length,
              memoryTypes,
              memoryTags,
              memoryIds: memories.map(m => m.id),
              searchMethod: memories.some(m => m.metadata?.semanticScore) ? 'semantic' : 'standard'
            };
            
            // Add end time and duration to metrics
            if (retrievalNode.metrics) {
              retrievalNode.metrics.endTime = Date.now();
              retrievalNode.metrics.duration = 
                retrievalNode.metrics.endTime - (retrievalNode.metrics.startTime || Date.now());
            }
          }
        } catch (error) {
          console.error('Error updating enhanced memory retrieval visualization node:', error);
        }
      }
      
      return memories;
    } catch (error) {
      console.error('Error retrieving relevant memories in EnhancedMemoryManager:', error);
      
      // Update visualization with error if enabled
      if (options.visualization && options.visualizer) {
        try {
          options.visualizer.addNode(
            options.visualization,
            'error', // VisualizationNodeType.ERROR
            'Enhanced Memory Retrieval Error',
            {
              error: error instanceof Error ? error.message : String(error),
              query
            },
            'error'
          );
        } catch (visualizationError) {
          console.error('Error updating visualization with error:', visualizationError);
        }
      }
      
      return [];
    }
  }

  /**
   * Add a memory with automatic tagging and semantic processing
   */
  async addMemoryWithProcessing(
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<EnhancedMemoryEntry> {
    try {
      // Extract tags using tagExtractor
      const taggingResult = await tagExtractor.extractTags(content, {
        maxTags: 10,
        minConfidence: 0.3
      });
      
      // Add memory with extracted tags
      const memory = await this.addMemory(content, {
        ...metadata,
        tags: taggingResult.tags.map((t: Tag) => t.text)
      });

      // Process memory cognitively
      const enhancedMemory = await this.processMemoryCognitively(memory.id, {
        processingTypes: ['associations', 'importance', 'novelty', 'emotion', 'categorization']
      });

      return enhancedMemory;
    } catch (error) {
      console.error('Error adding memory with processing:', error);
      throw new EnhancedMemoryError('Failed to add and process memory');
    }
  }
} 