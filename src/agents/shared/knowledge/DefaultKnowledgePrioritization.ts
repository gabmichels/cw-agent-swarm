/**
 * DefaultKnowledgePrioritization
 * 
 * Default implementation of the KnowledgePrioritization interface.
 * This implementation provides a system for prioritizing knowledge items and managing relevance.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgePrioritization,
  KnowledgePriorityLevel,
  KnowledgeRelevanceCategory,
  PriorityFactor,
  PriorityScoringModel,
  KnowledgePriorityInfo,
  PrioritizationOptions,
  PrioritizationResult
} from './interfaces/KnowledgePrioritization.interface';
import { KnowledgeGraph } from './interfaces/KnowledgeGraph.interface';

/**
 * Options for initializing DefaultKnowledgePrioritization
 */
export interface DefaultKnowledgePrioritizationOptions {
  /** Knowledge graph instance for context */
  knowledgeGraph?: KnowledgeGraph;
  
  /** Default scoring model to use */
  defaultScoringModel?: PriorityScoringModel;
  
  /** Auto-recalculation interval in milliseconds */
  recalculationInterval?: number;
  
  /** Persistence options */
  persistence?: {
    enabled: boolean;
    storageLocation?: string;
    autoSaveInterval?: number;
  };
  
  /** Additional options */
  additionalOptions?: Record<string, unknown>;
}

/**
 * Error types for knowledge prioritization operations
 */
export class KnowledgePrioritizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgePrioritizationError';
  }
}

export class ModelNotFoundError extends KnowledgePrioritizationError {
  constructor(modelId: string) {
    super(`Scoring model with ID '${modelId}' not found`);
  }
}

export class PriorityNotFoundError extends KnowledgePrioritizationError {
  constructor(id: string) {
    super(`Priority with ID '${id}' not found`);
  }
}

export class NotInitializedError extends KnowledgePrioritizationError {
  constructor() {
    super('KnowledgePrioritization has not been initialized');
  }
}

/**
 * Default implementation of KnowledgePrioritization interface
 */
export class DefaultKnowledgePrioritization implements KnowledgePrioritization {
  private knowledgePriorities: Map<string, KnowledgePriorityInfo> = new Map();
  private scoringModels: Map<string, PriorityScoringModel> = new Map();
  private scheduledJobs: Map<string, { schedule: string; options: PrioritizationOptions; intervalId?: NodeJS.Timeout }> = new Map();
  private initialized: boolean = false;
  private knowledgeGraph?: KnowledgeGraph;
  private options: DefaultKnowledgePrioritizationOptions;
  private recalculationIntervalId?: NodeJS.Timeout;
  
  /**
   * Create a new DefaultKnowledgePrioritization instance
   */
  constructor(options: DefaultKnowledgePrioritizationOptions = {}) {
    this.options = {
      recalculationInterval: 24 * 60 * 60 * 1000, // 24 hours
      persistence: {
        enabled: false,
        autoSaveInterval: 60 * 60 * 1000 // 1 hour
      },
      ...options
    };
    
    this.knowledgeGraph = options.knowledgeGraph;
  }
  
  /**
   * Ensure the system is initialized
   * @throws {NotInitializedError} If not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new NotInitializedError();
    }
  }
  
  /**
   * Initialize the knowledge prioritization system
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }
    
    // Register default scoring model if provided
    if (this.options.defaultScoringModel) {
      await this.registerScoringModel(this.options.defaultScoringModel);
    } else {
      // Create and register a standard default model
      await this.registerScoringModel({
        name: 'default',
        description: 'Default scoring model for knowledge prioritization',
        factorWeights: {
          [PriorityFactor.RECENCY]: 0.7,
          [PriorityFactor.FREQUENCY]: 0.6,
          [PriorityFactor.DOMAIN_RELEVANCE]: 0.9,
          [PriorityFactor.TASK_RELEVANCE]: 0.8,
          [PriorityFactor.GAP_FILLING]: 0.7,
          [PriorityFactor.USER_INTEREST]: 0.5,
          [PriorityFactor.CONFIDENCE]: 0.4,
          [PriorityFactor.IMPORTANCE]: 0.9
        },
        categoryAdjustments: {
          [KnowledgeRelevanceCategory.CORE]: 0.3,
          [KnowledgeRelevanceCategory.SUPPORTING]: 0.2,
          [KnowledgeRelevanceCategory.CONTEXTUAL]: 0.1,
          [KnowledgeRelevanceCategory.PERIPHERAL]: -0.1,
          [KnowledgeRelevanceCategory.TANGENTIAL]: -0.2
        },
        version: '1.0.0'
      });
    }
    
    // Initialize knowledge graph if provided
    if (this.knowledgeGraph) {
      await this.knowledgeGraph.initialize();
    }
    
    // If persistence is enabled, load existing data
    if (this.options.persistence?.enabled) {
      await this.loadFromStorage();
    }
    
    // Set up auto-save if enabled
    if (this.options.persistence?.enabled && this.options.persistence.autoSaveInterval) {
      setInterval(() => {
        this.saveToStorage().catch(err => {
          console.error('Error auto-saving knowledge priorities:', err);
        });
      }, this.options.persistence.autoSaveInterval);
    }
    
    // Set up auto-recalculation if interval is provided
    if (this.options.recalculationInterval) {
      this.recalculationIntervalId = setInterval(() => {
        this.recalculateAllPriorities().catch(err => {
          console.error('Error auto-recalculating priorities:', err);
        });
      }, this.options.recalculationInterval);
    }
    
    this.initialized = true;
    return true;
  }
  
  /**
   * Load knowledge priorities and models from storage
   */
  private async loadFromStorage(): Promise<void> {
    // To be implemented
    // This would load knowledge priorities and models from the specified storage location
  }
  
  /**
   * Save knowledge priorities and models to storage
   */
  private async saveToStorage(): Promise<void> {
    // To be implemented
    // This would save knowledge priorities and models to the specified storage location
  }
  
  /**
   * Recalculate all priorities
   */
  private async recalculateAllPriorities(): Promise<void> {
    const knowledgeItemIds = Array.from(this.knowledgePriorities.keys());
    
    if (knowledgeItemIds.length > 0) {
      await this.prioritizeKnowledge({
        knowledgeItemIds,
        options: {
          forceRecalculation: true
        }
      });
    }
  }
  
  /**
   * Register a priority scoring model
   */
  async registerScoringModel(model: Omit<PriorityScoringModel, 'id'>): Promise<string> {
    // We can't call ensureInitialized here as the initialize method needs to register models
    // during initialization
    const id = model.name.toLowerCase().replace(/\s+/g, '_');
    
    const scoringModel: PriorityScoringModel = {
      ...model,
      name: model.name
    };
    
    this.scoringModels.set(id, scoringModel);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return id;
  }
  
  /**
   * Get all scoring models
   */
  async getScoringModels(): Promise<PriorityScoringModel[]> {
    this.ensureInitialized();
    return Array.from(this.scoringModels.values());
  }
  
  /**
   * Get a scoring model by name or ID
   */
  async getScoringModel(nameOrId: string): Promise<PriorityScoringModel | null> {
    this.ensureInitialized();
    
    // Try direct lookup by ID
    if (this.scoringModels.has(nameOrId)) {
      return this.scoringModels.get(nameOrId) || null;
    }
    
    // Try lookup by name
    const normalizedName = nameOrId.toLowerCase().replace(/\s+/g, '_');
    return this.scoringModels.get(normalizedName) || null;
  }
  
  /**
   * Prioritize knowledge items
   */
  async prioritizeKnowledge(options: PrioritizationOptions): Promise<PrioritizationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const knowledgeItemIds = options.knowledgeItemIds || [];
    let changedCount = 0;
    
    // Get the scoring model
    let scoringModel: PriorityScoringModel;
    
    if (options.scoringModel) {
      if (typeof options.scoringModel === 'string') {
        const model = await this.getScoringModel(options.scoringModel);
        if (!model) {
          throw new ModelNotFoundError(options.scoringModel);
        }
        scoringModel = model;
      } else {
        scoringModel = options.scoringModel;
      }
    } else {
      // Use default model
      const defaultModel = await this.getScoringModel('default');
      if (!defaultModel) {
        throw new Error('Default scoring model not found');
      }
      scoringModel = defaultModel;
    }
    
    // Update or create priorities for each item
    const priorities: KnowledgePriorityInfo[] = [];
    
    if (knowledgeItemIds.length === 0) {
      // If no specific items provided, we'll work with a mock item since the KnowledgeGraph interface
      // doesn't provide a method to get all nodes
      const mockItemId = uuidv4();
      const priority = await this.calculateRealPriority(mockItemId, scoringModel, options);
      this.knowledgePriorities.set(mockItemId, priority);
      priorities.push(priority);
      changedCount++;
    } else {
      for (const itemId of knowledgeItemIds) {
        const existing = this.knowledgePriorities.get(itemId);
        
        if (existing && !options.options?.forceRecalculation) {
          priorities.push(existing);
        } else {
          const priority = await this.calculateRealPriority(itemId, scoringModel, options);
          this.knowledgePriorities.set(itemId, priority);
          priorities.push(priority);
          changedCount++;
        }
      }
    }
    
    // Calculate level distribution
    const levelDistribution: Record<KnowledgePriorityLevel, number> = {
      [KnowledgePriorityLevel.CRITICAL]: 0,
      [KnowledgePriorityLevel.HIGH]: 0,
      [KnowledgePriorityLevel.MEDIUM]: 0,
      [KnowledgePriorityLevel.LOW]: 0,
      [KnowledgePriorityLevel.BACKGROUND]: 0
    };
    
    priorities.forEach(p => {
      levelDistribution[p.priorityLevel] += 1;
    });
    
    // Calculate average score
    const totalScore = priorities.reduce((sum, p) => sum + p.priorityScore, 0);
    const avgScore = priorities.length > 0 ? totalScore / priorities.length : 0;
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      prioritizedItems: priorities,
      stats: {
        itemsProcessed: priorities.length,
        itemsChanged: changedCount,
        averageScore: avgScore,
        levelDistribution,
        processingTimeMs: processingTime
      },
      timestamp: new Date()
    };
  }
  
  /**
   * Calculate real priority for a knowledge item based on multiple factors
   */
  private async calculateRealPriority(
    knowledgeItemId: string, 
    model: PriorityScoringModel, 
    options: PrioritizationOptions
  ): Promise<KnowledgePriorityInfo> {
    const now = new Date();
    
    // Initialize factor scores with all required factors
    const factorScores: Partial<Record<PriorityFactor, number>> = {
      [PriorityFactor.RECENCY]: 0,
      [PriorityFactor.FREQUENCY]: 0,
      [PriorityFactor.DOMAIN_RELEVANCE]: 0,
      [PriorityFactor.TASK_RELEVANCE]: 0,
      [PriorityFactor.GAP_FILLING]: 0,
      [PriorityFactor.USER_INTEREST]: 0,
      [PriorityFactor.CONFIDENCE]: 0,
      [PriorityFactor.IMPORTANCE]: 0
    };
    
    // Calculate individual factor scores
    factorScores[PriorityFactor.RECENCY] = await this.calculateRecencyScore(knowledgeItemId);
    factorScores[PriorityFactor.DOMAIN_RELEVANCE] = await this.calculateDomainRelevanceScore(
      knowledgeItemId, 
      options.context
    );
    factorScores[PriorityFactor.IMPORTANCE] = await this.calculateImportanceScore(knowledgeItemId);
    
    // Calculate other factors with default values for now
    factorScores[PriorityFactor.FREQUENCY] = 0.5; // Default moderate score
    factorScores[PriorityFactor.TASK_RELEVANCE] = 0.5; // Default moderate score
    factorScores[PriorityFactor.GAP_FILLING] = 0.5; // Default moderate score
    factorScores[PriorityFactor.USER_INTEREST] = 0.5; // Default moderate score
    factorScores[PriorityFactor.CONFIDENCE] = 0.7; // Default high confidence
    
    // Calculate weighted priority score using the scoring model
    let priorityScore = 0;
    let totalWeight = 0;
    
    for (const [factor, weight] of Object.entries(model.factorWeights)) {
      const score = factorScores[factor as PriorityFactor] || 0;
      priorityScore += score * (weight || 0);
      totalWeight += (weight || 0);
    }
    
    // Normalize to 0-100 scale
    if (totalWeight > 0) {
      priorityScore = (priorityScore / totalWeight) * 100;
    }
    
    // Apply category adjustments if available
    const relevanceCategory = this.determineRelevanceCategory(priorityScore, options.context);
    const categoryAdjustment = model.categoryAdjustments[relevanceCategory] || 0;
    priorityScore += categoryAdjustment * 100; // Convert to 0-100 scale
    
    // Ensure score is within bounds
    priorityScore = Math.max(0, Math.min(100, priorityScore));
    
    // Determine priority level based on score
    const priorityLevel = this.determinePriorityLevel(priorityScore);
    
    // Generate explanation
    const explanation = this.generatePriorityExplanation(factorScores as Record<PriorityFactor, number>, priorityScore, model);
    
    return {
      id: uuidv4(),
      knowledgeItemId,
      priorityScore,
      priorityLevel,
      relevanceCategory,
      factorScores,
      explanation,
      lastCalculated: now,
      updatedAt: now,
      nextRecalculation: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Default 1 day
      metadata: {
        modelName: model.name,
        modelVersion: model.version || '1.0',
        calculationContext: options.context || {}
      }
    };
  }
  
  /**
   * Calculate recency score based on when the knowledge item was last accessed or updated
   */
  private async calculateRecencyScore(knowledgeItemId: string): Promise<number> {
    if (!this.knowledgeGraph) {
      // Without knowledge graph, use a default moderate score
      return 0.5;
    }
    
    try {
      const node = await this.knowledgeGraph.getNode(knowledgeItemId);
      if (!node) {
        return 0.3; // Low score for non-existent items
      }
      
      const now = Date.now();
      const lastAccessed = node.metadata?.lastAccessed ? 
        new Date(node.metadata.lastAccessed as string).getTime() : 
        (node.createdAt ? node.createdAt.getTime() : now);
      
      // Calculate days since last access
      const daysSinceAccess = (now - lastAccessed) / (1000 * 60 * 60 * 24);
      
      // Recency score decreases exponentially with time
      // Recent items (< 1 day) get high scores, older items get lower scores
      if (daysSinceAccess < 1) return 1.0;
      if (daysSinceAccess < 7) return 0.8;
      if (daysSinceAccess < 30) return 0.6;
      if (daysSinceAccess < 90) return 0.4;
      return 0.2;
    } catch (error) {
      console.warn(`Error calculating recency score for ${knowledgeItemId}:`, error);
      return 0.5; // Default moderate score on error
    }
  }
  
  /**
   * Calculate domain relevance score based on context and knowledge graph connections
   */
  private async calculateDomainRelevanceScore(
    knowledgeItemId: string, 
    context?: Record<string, unknown>
  ): Promise<number> {
    if (!this.knowledgeGraph) {
      return 0.5; // Default moderate score without knowledge graph
    }
    
    try {
      const node = await this.knowledgeGraph.getNode(knowledgeItemId);
      if (!node) {
        return 0.2; // Low score for non-existent items
      }
      
      let relevanceScore = 0.5; // Base score
      
      // Check context relevance
      if (context) {
        const contextKeywords = this.extractContextKeywords(context);
        const nodeContent = `${node.label} ${node.description || ''} ${JSON.stringify(node.metadata || {})}`.toLowerCase();
        
        let matchCount = 0;
        for (const keyword of contextKeywords) {
          if (nodeContent.includes(keyword.toLowerCase())) {
            matchCount++;
          }
        }
        
        if (contextKeywords.length > 0) {
          const contextRelevance = matchCount / contextKeywords.length;
          relevanceScore += contextRelevance * 0.3; // Up to 30% boost for context relevance
        }
      }
      
      // Since getConnectedNodes doesn't exist, we'll use a simplified approach
      // In a real implementation, this would check knowledge graph connections
      relevanceScore += 0.1; // Default small boost for existing nodes
      
      return Math.min(1.0, relevanceScore);
    } catch (error) {
      console.warn(`Error calculating domain relevance score for ${knowledgeItemId}:`, error);
      return 0.5; // Default moderate score on error
    }
  }
  
  /**
   * Calculate importance score based on usage patterns and explicit importance markers
   */
  private async calculateImportanceScore(knowledgeItemId: string): Promise<number> {
    if (!this.knowledgeGraph) {
      return 0.5; // Default moderate score without knowledge graph
    }
    
    try {
      const node = await this.knowledgeGraph.getNode(knowledgeItemId);
      if (!node) {
        return 0.2; // Low score for non-existent items
      }
      
      let importanceScore = 0.5; // Base score
      
      // Check explicit importance markers in metadata
      if (node.metadata?.importance) {
        const importance = node.metadata.importance;
        if (typeof importance === 'string') {
          switch (importance.toLowerCase()) {
            case 'critical': importanceScore = 1.0; break;
            case 'high': importanceScore = 0.8; break;
            case 'medium': importanceScore = 0.6; break;
            case 'low': importanceScore = 0.4; break;
            default: importanceScore = 0.5; break;
          }
        } else if (typeof importance === 'number') {
          importanceScore = Math.max(0, Math.min(1, importance));
        }
      }
      
      // Check usage frequency
      const accessCount = typeof node.metadata?.accessCount === 'number' ? node.metadata.accessCount : 0;
      if (accessCount > 50) importanceScore += 0.2;
      else if (accessCount > 20) importanceScore += 0.15;
      else if (accessCount > 10) importanceScore += 0.1;
      else if (accessCount > 5) importanceScore += 0.05;
      
      // Since getIncomingEdges doesn't exist, we'll use a simplified approach
      // In a real implementation, this would check references from other important nodes
      importanceScore += 0.05; // Default small boost for existing nodes
      
      return Math.min(1.0, importanceScore);
    } catch (error) {
      console.warn(`Error calculating importance score for ${knowledgeItemId}:`, error);
      return 0.5; // Default moderate score on error
    }
  }
  
  /**
   * Extract keywords from context for relevance calculation
   */
  private extractContextKeywords(context: Record<string, unknown>): string[] {
    const keywords: string[] = [];
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Extract meaningful words (longer than 2 characters)
        const words = value.toLowerCase().match(/\b\w{3,}\b/g) || [];
        keywords.push(...words);
      } else if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string') {
            const words = item.toLowerCase().match(/\b\w{3,}\b/g) || [];
            keywords.push(...words);
          }
        });
      }
      
      // Also include the key itself if it's meaningful
      if (key.length > 2) {
        keywords.push(key.toLowerCase());
      }
    }
    
    // Remove duplicates and common stop words
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'will']);
    
    return Array.from(new Set(keywords)).filter(word => !stopWords.has(word));
  }
  
  /**
   * Apply scoring model adjustments
   */
  private applyAdjustment(score: number, adjustment: any): number {
    if (!adjustment || typeof adjustment !== 'object') {
      return score;
    }
    
    // Apply different types of adjustments
    if (adjustment.type === 'multiply' && typeof adjustment.value === 'number') {
      return score * adjustment.value;
    } else if (adjustment.type === 'add' && typeof adjustment.value === 'number') {
      return score + adjustment.value;
    } else if (adjustment.type === 'threshold') {
      if (score >= adjustment.threshold) {
        return adjustment.aboveValue || score;
      } else {
        return adjustment.belowValue || score;
      }
    }
    
    return score;
  }
  
  /**
   * Determine priority level based on score
   */
  private determinePriorityLevel(score: number): KnowledgePriorityLevel {
    if (score >= 85) return KnowledgePriorityLevel.CRITICAL;
    if (score >= 70) return KnowledgePriorityLevel.HIGH;
    if (score >= 50) return KnowledgePriorityLevel.MEDIUM;
    if (score >= 30) return KnowledgePriorityLevel.LOW;
    return KnowledgePriorityLevel.BACKGROUND;
  }
  
  /**
   * Determine relevance category based on score and context
   */
  private determineRelevanceCategory(
    score: number, 
    context?: Record<string, unknown>
  ): KnowledgeRelevanceCategory {
    // High scores with context suggest core relevance
    if (score >= 80 && context && Object.keys(context).length > 0) {
      return KnowledgeRelevanceCategory.CORE;
    }
    
    // Medium-high scores suggest supporting relevance
    if (score >= 60) {
      return KnowledgeRelevanceCategory.SUPPORTING;
    }
    
    // Medium scores suggest contextual relevance
    if (score >= 40) {
      return KnowledgeRelevanceCategory.CONTEXTUAL;
    }
    
    // Low scores suggest peripheral relevance
    if (score >= 20) {
      return KnowledgeRelevanceCategory.PERIPHERAL;
    }
    
    // Very low scores suggest tangential relevance
    return KnowledgeRelevanceCategory.TANGENTIAL;
  }
  
  /**
   * Generate human-readable explanation for the priority calculation
   */
  private generatePriorityExplanation(
    factorScores: Record<PriorityFactor, number>,
    finalScore: number,
    model: PriorityScoringModel
  ): string {
    const explanations: string[] = [];
    
    // Explain each factor's contribution
    for (const [factor, weight] of Object.entries(model.factorWeights)) {
      const score = factorScores[factor as PriorityFactor];
      if (score !== undefined && weight !== undefined) {
        const contribution = (score * weight * 100).toFixed(1);
        
        let factorName: string;
        switch (factor as PriorityFactor) {
          case PriorityFactor.RECENCY:
            factorName = 'recency';
            break;
          case PriorityFactor.DOMAIN_RELEVANCE:
            factorName = 'domain relevance';
            break;
          case PriorityFactor.IMPORTANCE:
            factorName = 'importance';
            break;
          case PriorityFactor.FREQUENCY:
            factorName = 'frequency';
            break;
          case PriorityFactor.TASK_RELEVANCE:
            factorName = 'task relevance';
            break;
          case PriorityFactor.GAP_FILLING:
            factorName = 'gap filling';
            break;
          case PriorityFactor.USER_INTEREST:
            factorName = 'user interest';
            break;
          case PriorityFactor.CONFIDENCE:
            factorName = 'confidence';
            break;
          default:
            factorName = factor.toLowerCase();
        }
        
        explanations.push(`${factorName}: ${(score * 100).toFixed(1)}% (weight: ${weight}, contribution: ${contribution}%)`);
      }
    }
    
    return `Priority score ${finalScore.toFixed(1)} calculated from: ${explanations.join(', ')}. Model: ${model.name}`;
  }
  
  /**
   * Get priority info for a knowledge item
   */
  async getKnowledgePriority(knowledgeItemId: string): Promise<KnowledgePriorityInfo | null> {
    this.ensureInitialized();
    return this.knowledgePriorities.get(knowledgeItemId) || null;
  }
  
  /**
   * Get priority info for multiple knowledge items
   */
  async getKnowledgePriorities(knowledgeItemIds: string[]): Promise<Map<string, KnowledgePriorityInfo>> {
    this.ensureInitialized();
    
    const result = new Map<string, KnowledgePriorityInfo>();
    
    for (const id of knowledgeItemIds) {
      const priority = this.knowledgePriorities.get(id);
      if (priority) {
        result.set(id, priority);
      }
    }
    
    return result;
  }
  
  /**
   * Set knowledge item relevance category
   */
  async setRelevanceCategory(
    knowledgeItemId: string,
    category: KnowledgeRelevanceCategory,
    reason?: string
  ): Promise<boolean> {
    this.ensureInitialized();
    
    const priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      return false;
    }
    
    const now = new Date();
    
    // Update the category
    this.knowledgePriorities.set(knowledgeItemId, {
      ...priority,
      relevanceCategory: category,
      updatedAt: now,
      metadata: {
        ...priority.metadata,
        categoryChangeReason: reason,
        categoryLastUpdated: now.toISOString()
      }
    });
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Manually adjust priority for a knowledge item
   */
  async adjustPriority(
    knowledgeItemId: string,
    adjustment: number,
    reason: string,
    expiration?: Date
  ): Promise<KnowledgePriorityInfo> {
    this.ensureInitialized();
    
    let priority = this.knowledgePriorities.get(knowledgeItemId);
    
    if (!priority) {
      // Create a new priority if it doesn't exist
      const defaultModel = await this.getScoringModel('default');
      if (!defaultModel) {
        throw new Error('Default scoring model not found');
      }
      
      priority = await this.calculateRealPriority(knowledgeItemId, defaultModel, {
        context: {}
      });
    }
    
    // Apply the adjustment
    const newScore = Math.min(100, Math.max(0, priority.priorityScore + adjustment));
    
    // Determine new priority level
    let newLevel: KnowledgePriorityLevel;
    
    if (newScore >= 80) {
      newLevel = KnowledgePriorityLevel.CRITICAL;
    } else if (newScore >= 60) {
      newLevel = KnowledgePriorityLevel.HIGH;
    } else if (newScore >= 40) {
      newLevel = KnowledgePriorityLevel.MEDIUM;
    } else if (newScore >= 20) {
      newLevel = KnowledgePriorityLevel.LOW;
    } else {
      newLevel = KnowledgePriorityLevel.BACKGROUND;
    }
    
    const now = new Date();
    
    // Update the priority
    const updatedPriority: KnowledgePriorityInfo = {
      ...priority,
      priorityScore: newScore,
      priorityLevel: newLevel,
      lastCalculated: now,
      updatedAt: now,
      metadata: {
        ...priority.metadata,
        manualAdjustment: adjustment,
        adjustmentReason: reason,
        adjustmentDate: now.toISOString(),
        adjustmentExpiration: expiration?.toISOString()
      }
    };
    
    this.knowledgePriorities.set(knowledgeItemId, updatedPriority);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return updatedPriority;
  }
  
  /**
   * Get top priority knowledge items
   */
  async getTopPriorityItems(
    count: number = 10,
    filter?: {
      minScore?: number;
      categories?: KnowledgeRelevanceCategory[];
      levels?: KnowledgePriorityLevel[];
    }
  ): Promise<KnowledgePriorityInfo[]> {
    this.ensureInitialized();
    
    let items = Array.from(this.knowledgePriorities.values());
    
    // Apply filters
    if (filter) {
      if (filter.minScore !== undefined) {
        items = items.filter(item => item.priorityScore >= filter.minScore!);
      }
      
      if (filter.categories?.length) {
        items = items.filter(item => filter.categories!.includes(item.relevanceCategory));
      }
      
      if (filter.levels?.length) {
        items = items.filter(item => filter.levels!.includes(item.priorityLevel));
      }
    }
    
    // Sort by score (descending) and take the top N
    return items
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, count);
  }
  
  /**
   * Schedule a prioritization job
   */
  async schedulePrioritization(
    schedule: string,
    options: PrioritizationOptions
  ): Promise<string> {
    this.ensureInitialized();
    
    const jobId = uuidv4();
    
    // In a real implementation, this would use a cron-like scheduler
    // For this skeleton, we'll just store the job information
    this.scheduledJobs.set(jobId, {
      schedule,
      options
    });
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return jobId;
  }
  
  /**
   * Cancel a scheduled prioritization job
   */
  async cancelScheduledPrioritization(jobId: string): Promise<boolean> {
    this.ensureInitialized();
    
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      return false;
    }
    
    // Clear the interval if it exists
    if (job.intervalId) {
      clearInterval(job.intervalId);
    }
    
    const result = this.scheduledJobs.delete(jobId);
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return result;
  }
  
  /**
   * Get knowledge priority statistics
   */
  async getPriorityStats(): Promise<{
    totalItems: number;
    averageScore: number;
    levelCounts: Record<KnowledgePriorityLevel, number>;
    categoryCounts: Record<KnowledgeRelevanceCategory, number>;
    topPriorityItems: Array<{ id: string; knowledgeItemId: string; score: number }>;
  }> {
    this.ensureInitialized();
    
    const items = Array.from(this.knowledgePriorities.values());
    
    // Initialize counters
    const levelCounts: Record<KnowledgePriorityLevel, number> = {
      [KnowledgePriorityLevel.CRITICAL]: 0,
      [KnowledgePriorityLevel.HIGH]: 0,
      [KnowledgePriorityLevel.MEDIUM]: 0,
      [KnowledgePriorityLevel.LOW]: 0,
      [KnowledgePriorityLevel.BACKGROUND]: 0
    };
    
    const categoryCounts: Record<KnowledgeRelevanceCategory, number> = {
      [KnowledgeRelevanceCategory.CORE]: 0,
      [KnowledgeRelevanceCategory.SUPPORTING]: 0,
      [KnowledgeRelevanceCategory.CONTEXTUAL]: 0,
      [KnowledgeRelevanceCategory.PERIPHERAL]: 0,
      [KnowledgeRelevanceCategory.TANGENTIAL]: 0
    };
    
    // Count by level and category
    for (const item of items) {
      levelCounts[item.priorityLevel]++;
      categoryCounts[item.relevanceCategory]++;
    }
    
    // Calculate average score
    const totalScore = items.reduce((sum, item) => sum + item.priorityScore, 0);
    const averageScore = items.length > 0 ? totalScore / items.length : 0;
    
    // Get top priority items
    const topItems = items
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5)
      .map(item => ({
        id: item.id,
        knowledgeItemId: item.knowledgeItemId,
        score: item.priorityScore
      }));
    
    return {
      totalItems: items.length,
      averageScore,
      levelCounts,
      categoryCounts,
      topPriorityItems: topItems
    };
  }
  
  /**
   * Generate a knowledge priority report
   */
  async generatePriorityReport(format: 'text' | 'markdown' | 'json'): Promise<string> {
    this.ensureInitialized();
    
    const stats = await this.getPriorityStats();
    
    if (format === 'json') {
      return JSON.stringify({
        stats,
        priorities: Array.from(this.knowledgePriorities.values())
      }, null, 2);
    }
    
    if (format === 'markdown') {
      return `# Knowledge Priority Report

## Summary
- Total Items: ${stats.totalItems}
- Average Score: ${stats.averageScore.toFixed(2)}

## Priority Levels
${Object.entries(stats.levelCounts)
  .map(([level, count]) => `- ${level}: ${count}`)
  .join('\n')}

## Relevance Categories
${Object.entries(stats.categoryCounts)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

## Top Priority Items
${stats.topPriorityItems
  .map((item, index) => `${index + 1}. Item ${item.knowledgeItemId.substring(0, 8)} (Score: ${item.score.toFixed(2)})`)
  .join('\n')}
`;
    }
    
    // Default to text format
    return `Knowledge Priority Report
==========================

Summary:
- Total Items: ${stats.totalItems}
- Average Score: ${stats.averageScore.toFixed(2)}

Priority Levels:
${Object.entries(stats.levelCounts)
  .map(([level, count]) => `- ${level}: ${count}`)
  .join('\n')}

Relevance Categories:
${Object.entries(stats.categoryCounts)
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

Top Priority Items:
${stats.topPriorityItems
  .map((item, index) => `${index + 1}. Item ${item.knowledgeItemId.substring(0, 8)} (Score: ${item.score.toFixed(2)})`)
  .join('\n')}
`;
  }
  
  /**
   * Clear all priority data
   */
  async clear(): Promise<boolean> {
    this.ensureInitialized();
    
    this.knowledgePriorities.clear();
    
    // Clear scheduled jobs
    Array.from(this.scheduledJobs.values()).forEach(job => {
      if (job.intervalId) {
        clearInterval(job.intervalId);
      }
    });
    this.scheduledJobs.clear();
    
    // Save if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    return true;
  }
  
  /**
   * Shutdown the knowledge prioritization system
   */
  async shutdown(): Promise<boolean> {
    if (!this.initialized) {
      return true;
    }
    
    // Clear recalculation interval if it exists
    if (this.recalculationIntervalId) {
      clearInterval(this.recalculationIntervalId);
      this.recalculationIntervalId = undefined;
    }
    
    // Clear scheduled jobs
    Array.from(this.scheduledJobs.values()).forEach(job => {
      if (job.intervalId) {
        clearInterval(job.intervalId);
      }
    });
    
    // Save data before shutdown if persistence is enabled
    if (this.options.persistence?.enabled) {
      await this.saveToStorage();
    }
    
    this.initialized = false;
    return true;
  }
} 