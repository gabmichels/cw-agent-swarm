/**
 * LearningOutcomeManager.ts
 * 
 * Manages learning outcomes with CRUD operations, behavior application, and analytics.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  LearningOutcomeManager as ILearningOutcomeManager,
  LearningOutcome,
  LearningOutcomeType,
  ImprovementAreaType,
  LearningOutcomeListOptions,
  OutcomeManagerStats,
  LearningActivityError
} from '../interfaces/EnhancedReflectionInterfaces';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface LearningOutcomeManagerConfig {
  maxOutcomes?: number;
  enableValidation?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number; // milliseconds
  enableBehaviorTracking?: boolean;
  confidenceThreshold?: number; // 0-1, minimum confidence for behavior application
}

// ============================================================================
// Internal Types
// ============================================================================

interface OutcomeValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface BehaviorApplicationResult {
  outcomeId: string;
  success: boolean;
  appliedAt: Date;
  error?: string;
}

// ============================================================================
// Implementation
// ============================================================================

export class LearningOutcomeManager implements ILearningOutcomeManager {
  private readonly config: Required<LearningOutcomeManagerConfig>;
  private readonly outcomes: Map<string, LearningOutcome> = new Map();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  
  // Statistics tracking
  private stats = {
    totalRecorded: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    totalApplied: 0,
    lastOperationTime: new Date()
  };

  constructor(config: LearningOutcomeManagerConfig = {}) {
    this.config = {
      maxOutcomes: config.maxOutcomes ?? 10000,
      enableValidation: config.enableValidation ?? true,
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize ?? 100,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      enableBehaviorTracking: config.enableBehaviorTracking ?? true,
      confidenceThreshold: config.confidenceThreshold ?? 0.7
    };
  }

  // ============================================================================
  // Outcome CRUD Operations
  // ============================================================================

  async recordOutcome(outcome: Omit<LearningOutcome, 'id' | 'timestamp'>): Promise<LearningOutcome> {
    // Validate outcome data
    if (this.config.enableValidation) {
      const validation = this.validateOutcomeData(outcome);
      if (!validation.isValid) {
        throw new LearningActivityError(
          `Outcome validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { outcome, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Check outcome limit
    if (this.outcomes.size >= this.config.maxOutcomes) {
      throw new LearningActivityError(
        `Maximum number of outcomes reached (${this.config.maxOutcomes})`,
        'MAX_OUTCOMES_EXCEEDED',
        { maxOutcomes: this.config.maxOutcomes, currentCount: this.outcomes.size },
        true,
        ['Delete unused outcomes', 'Increase maxOutcomes configuration']
      );
    }

    // Create new outcome with generated ID and timestamp
    const newOutcome: LearningOutcome = {
      ...outcome,
      id: ulid(),
      timestamp: new Date()
    };

    // Store outcome
    this.outcomes.set(newOutcome.id, newOutcome);
    
    // Update statistics
    this.stats.totalRecorded++;
    this.stats.lastOperationTime = new Date();
    
    // Clear relevant caches
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');
    this.clearCacheByPattern(`plan_${newOutcome.planId}`);
    if (newOutcome.activityId) {
      this.clearCacheByPattern(`activity_${newOutcome.activityId}`);
    }

    return { ...newOutcome };
  }

  async getOutcome(outcomeId: string): Promise<LearningOutcome | null> {
    if (!outcomeId || typeof outcomeId !== 'string') {
      return null;
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<LearningOutcome>(`outcome_${outcomeId}`);
      if (cached) {
        return { ...cached };
      }
    }

    const outcome = this.outcomes.get(outcomeId);
    if (!outcome) {
      return null;
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(`outcome_${outcomeId}`, outcome);
    }

    return { ...outcome };
  }

  async updateOutcome(
    outcomeId: string, 
    updates: Partial<Omit<LearningOutcome, 'id' | 'timestamp'>>
  ): Promise<LearningOutcome> {
    const existingOutcome = this.outcomes.get(outcomeId);
    if (!existingOutcome) {
      throw new LearningActivityError(
        `Outcome not found: ${outcomeId}`,
        'OUTCOME_NOT_FOUND',
        { outcomeId },
        true,
        ['Check the outcome ID', 'Verify the outcome exists']
      );
    }

    // Create updated outcome data (excluding immutable fields)
    const { id, timestamp, ...allowedUpdates } = updates as any;
    const updatedOutcomeData = {
      ...existingOutcome,
      ...allowedUpdates
    };

    // Validate updated outcome data
    if (this.config.enableValidation) {
      const validation = this.validateOutcomeData(updatedOutcomeData);
      if (!validation.isValid) {
        throw new LearningActivityError(
          `Outcome update validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { outcomeId, updates, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Update outcome
    this.outcomes.set(outcomeId, updatedOutcomeData);
    
    // Update statistics
    this.stats.totalUpdated++;
    this.stats.lastOperationTime = new Date();
    
    // Clear relevant caches
    this.clearCacheByPattern(`outcome_${outcomeId}`);
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');
    this.clearCacheByPattern(`plan_${updatedOutcomeData.planId}`);
    if (updatedOutcomeData.activityId) {
      this.clearCacheByPattern(`activity_${updatedOutcomeData.activityId}`);
    }

    return { ...updatedOutcomeData };
  }

  async listOutcomes(options: LearningOutcomeListOptions = {}): Promise<LearningOutcome[]> {
    // Generate cache key based on options
    const cacheKey = `list_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<LearningOutcome[]>(cacheKey);
      if (cached) {
        return cached.map(outcome => ({ ...outcome }));
      }
    }

    let outcomes = Array.from(this.outcomes.values());

    // Apply filters
    if (options.planId) {
      outcomes = outcomes.filter(outcome => outcome.planId === options.planId);
    }

    if (options.activityId) {
      outcomes = outcomes.filter(outcome => outcome.activityId === options.activityId);
    }

    if (options.type && options.type.length > 0) {
      outcomes = outcomes.filter(outcome => options.type!.includes(outcome.type));
    }

    if (options.area && options.area.length > 0) {
      outcomes = outcomes.filter(outcome => options.area!.includes(outcome.area));
    }

    if (options.minConfidence !== undefined) {
      outcomes = outcomes.filter(outcome => outcome.confidence >= options.minConfidence!);
    }

    if (options.appliedToBehavior !== undefined) {
      outcomes = outcomes.filter(outcome => outcome.appliedToBehavior === options.appliedToBehavior);
    }

    // Apply sorting
    if (options.sortBy) {
      outcomes.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (options.sortBy) {
          case 'timestamp':
            aValue = a.timestamp.getTime();
            bValue = b.timestamp.getTime();
            break;
          case 'confidence':
            aValue = a.confidence;
            bValue = b.confidence;
            break;
          case 'type':
            aValue = a.type;
            bValue = b.type;
            break;
          default:
            aValue = a.timestamp.getTime();
            bValue = b.timestamp.getTime();
        }

        const direction = options.sortDirection === 'desc' ? -1 : 1;
        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? outcomes.length;
    const paginatedOutcomes = outcomes.slice(offset, offset + limit);

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, paginatedOutcomes);
    }

    return paginatedOutcomes.map(outcome => ({ ...outcome }));
  }

  async deleteOutcome(outcomeId: string): Promise<boolean> {
    const deleted = this.outcomes.delete(outcomeId);
    
    if (deleted) {
      // Update statistics
      this.stats.totalDeleted++;
      this.stats.lastOperationTime = new Date();
      
      // Clear relevant caches
      this.clearCacheByPattern(`outcome_${outcomeId}`);
      this.clearCacheByPattern('list_');
      this.clearCacheByPattern('stats');
    }

    return deleted;
  }

  // ============================================================================
  // Behavior Application
  // ============================================================================

  async applyOutcomesToBehavior(outcomeIds: string[]): Promise<boolean> {
    if (!outcomeIds || outcomeIds.length === 0) {
      return true; // Nothing to apply
    }

    const results: BehaviorApplicationResult[] = [];
    let allSuccessful = true;

    for (const outcomeId of outcomeIds) {
      try {
        const outcome = await this.getOutcome(outcomeId);
        if (!outcome) {
          results.push({
            outcomeId,
            success: false,
            appliedAt: new Date(),
            error: 'Outcome not found'
          });
          allSuccessful = false;
          continue;
        }

        // Check confidence threshold
        if (outcome.confidence < this.config.confidenceThreshold) {
          results.push({
            outcomeId,
            success: false,
            appliedAt: new Date(),
            error: `Confidence ${outcome.confidence} below threshold ${this.config.confidenceThreshold}`
          });
          allSuccessful = false;
          continue;
        }

        // Apply to behavior (mark as applied)
        await this.updateOutcome(outcomeId, { appliedToBehavior: true });
        
        results.push({
          outcomeId,
          success: true,
          appliedAt: new Date()
        });

        // Update statistics
        this.stats.totalApplied++;

      } catch (error) {
        results.push({
          outcomeId,
          success: false,
          appliedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        allSuccessful = false;
      }
    }

    return allSuccessful;
  }

  // ============================================================================
  // Plan and Activity Integration
  // ============================================================================

  async getOutcomesForPlan(planId: string): Promise<LearningOutcome[]> {
    return this.listOutcomes({ planId });
  }

  async getOutcomesForActivity(activityId: string): Promise<LearningOutcome[]> {
    return this.listOutcomes({ activityId });
  }

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  getStats(): OutcomeManagerStats {
    const cacheKey = 'stats';
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<OutcomeManagerStats>(cacheKey);
      if (cached) {
        return { ...cached };
      }
    }

    const outcomes = Array.from(this.outcomes.values());
    
    // Calculate statistics
    const appliedOutcomes = outcomes.filter(o => o.appliedToBehavior);
    const totalConfidence = outcomes.reduce((sum, o) => sum + o.confidence, 0);
    
    const stats: OutcomeManagerStats = {
      totalOutcomes: outcomes.length,
      appliedOutcomes: appliedOutcomes.length,
      averageConfidence: outcomes.length > 0 ? totalConfidence / outcomes.length : 0,
      outcomesByType: {
        knowledge_gained: outcomes.filter(o => o.type === 'knowledge_gained').length,
        skill_developed: outcomes.filter(o => o.type === 'skill_developed').length,
        behavior_changed: outcomes.filter(o => o.type === 'behavior_changed').length,
        insight_discovered: outcomes.filter(o => o.type === 'insight_discovered').length,
        pattern_recognized: outcomes.filter(o => o.type === 'pattern_recognized').length,
        strategy_learned: outcomes.filter(o => o.type === 'strategy_learned').length
      },
      outcomesByArea: {
        [ImprovementAreaType.KNOWLEDGE]: outcomes.filter(o => o.area === ImprovementAreaType.KNOWLEDGE).length,
        [ImprovementAreaType.SKILL]: outcomes.filter(o => o.area === ImprovementAreaType.SKILL).length,
        [ImprovementAreaType.BEHAVIOR]: outcomes.filter(o => o.area === ImprovementAreaType.BEHAVIOR).length,
        [ImprovementAreaType.COMMUNICATION]: outcomes.filter(o => o.area === ImprovementAreaType.COMMUNICATION).length,
        [ImprovementAreaType.DECISION_MAKING]: outcomes.filter(o => o.area === ImprovementAreaType.DECISION_MAKING).length,
        [ImprovementAreaType.PROBLEM_SOLVING]: outcomes.filter(o => o.area === ImprovementAreaType.PROBLEM_SOLVING).length,
        [ImprovementAreaType.CREATIVITY]: outcomes.filter(o => o.area === ImprovementAreaType.CREATIVITY).length,
        [ImprovementAreaType.EFFICIENCY]: outcomes.filter(o => o.area === ImprovementAreaType.EFFICIENCY).length,
        [ImprovementAreaType.QUALITY]: outcomes.filter(o => o.area === ImprovementAreaType.QUALITY).length,
        [ImprovementAreaType.COLLABORATION]: outcomes.filter(o => o.area === ImprovementAreaType.COLLABORATION).length
      },
      behaviorChangeRate: outcomes.length > 0 ? appliedOutcomes.length / outcomes.length : 0
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, stats);
    }

    return stats;
  }

  async clear(): Promise<void> {
    this.outcomes.clear();
    this.cache.clear();
    this.stats = {
      totalRecorded: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalApplied: 0,
      lastOperationTime: new Date()
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateOutcomeData(outcome: Omit<LearningOutcome, 'id' | 'timestamp'>): OutcomeValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Validate plan ID
    if (!outcome.planId || outcome.planId.trim().length === 0) {
      errors.push('Plan ID is required');
      suggestions.push('Associate the outcome with a valid improvement plan');
    }

    // Validate description
    if (!outcome.description || outcome.description.trim().length === 0) {
      errors.push('Outcome description is required');
      suggestions.push('Provide a meaningful outcome description');
    }

    // Validate confidence
    if (outcome.confidence < 0 || outcome.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
      suggestions.push('Set confidence to a value between 0.0 and 1.0');
    }

    // Validate evidence
    if (!outcome.evidence || outcome.evidence.length === 0) {
      errors.push('Evidence is required');
      suggestions.push('Provide evidence supporting the learning outcome');
    }

    // Validate evidence items
    if (outcome.evidence && outcome.evidence.some(e => !e || e.trim().length === 0)) {
      errors.push('All evidence items must be non-empty');
      suggestions.push('Remove empty evidence items or provide valid descriptions');
    }

    // Validate related insight IDs
    if (outcome.relatedInsightIds && outcome.relatedInsightIds.some(id => !id || id.trim().length === 0)) {
      errors.push('All related insight IDs must be non-empty');
      suggestions.push('Remove empty insight IDs or provide valid identifiers');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private setCache<T>(key: string, data: T): void {
    if (!this.config.enableCaching) return;

    // Clean up expired entries if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      this.cleanupExpiredCache();
    }

    // If still full, remove oldest entry
    if (this.cache.size >= this.config.cacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL
    });
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.enableCaching) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private clearCacheByPattern(pattern: string): void {
    if (!this.config.enableCaching) return;

    const keysToDelete: string[] = [];
    // Convert keys to array to avoid iteration issues
    const cacheKeys = Array.from(this.cache.keys());
    for (const key of cacheKeys) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Convert entries to array to avoid iteration issues
    const cacheEntries = Array.from(this.cache.entries());
    for (const [key, entry] of cacheEntries) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
} 