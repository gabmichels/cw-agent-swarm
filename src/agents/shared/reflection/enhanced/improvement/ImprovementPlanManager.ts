/**
 * ImprovementPlanManager.ts
 * 
 * Manages self-improvement plans with CRUD operations, validation, and analytics.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  ImprovementPlanManager as IImprovementPlanManager,
  SelfImprovementPlan,
  ImprovementAreaType,
  ImprovementPriority,
  ImprovementPlanListOptions,
  PlanGenerationOptions,
  PlanManagerStats,
  ImprovementPlanError
} from '../interfaces/EnhancedReflectionInterfaces';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface ImprovementPlanManagerConfig {
  maxPlans?: number;
  enableAutoProgress?: boolean;
  enableValidation?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number; // milliseconds
}

// ============================================================================
// Internal Types
// ============================================================================

interface PlanValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class ImprovementPlanManager implements IImprovementPlanManager {
  private readonly config: Required<ImprovementPlanManagerConfig>;
  private readonly plans: Map<string, SelfImprovementPlan> = new Map();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  
  // Statistics tracking
  private stats = {
    totalCreated: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    lastOperationTime: new Date()
  };

  constructor(config: ImprovementPlanManagerConfig = {}) {
    this.config = {
      maxPlans: config.maxPlans ?? 1000,
      enableAutoProgress: config.enableAutoProgress ?? true,
      enableValidation: config.enableValidation ?? true,
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize ?? 100,
      cacheTTL: config.cacheTTL ?? 300000 // 5 minutes
    };
  }

  // ============================================================================
  // Plan CRUD Operations
  // ============================================================================

  async createPlan(plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SelfImprovementPlan> {
    // Validate plan data
    if (this.config.enableValidation) {
      const validation = this.validatePlanData(plan);
      if (!validation.isValid) {
        throw new ImprovementPlanError(
          `Plan validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { plan, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Check plan limit
    if (this.plans.size >= this.config.maxPlans) {
      throw new ImprovementPlanError(
        `Maximum number of plans reached (${this.config.maxPlans})`,
        'MAX_PLANS_EXCEEDED',
        { maxPlans: this.config.maxPlans, currentCount: this.plans.size },
        true,
        ['Delete unused plans', 'Increase maxPlans configuration']
      );
    }

    // Create new plan with generated ID and timestamps
    const now = new Date();
    const newPlan: SelfImprovementPlan = {
      ...plan,
      id: ulid(),
      createdAt: now,
      updatedAt: now
    };

    // Store plan
    this.plans.set(newPlan.id, newPlan);
    
    // Update statistics
    this.stats.totalCreated++;
    this.stats.lastOperationTime = now;
    
    // Clear relevant caches
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');

    return { ...newPlan };
  }

  async getPlan(planId: string): Promise<SelfImprovementPlan | null> {
    if (!planId || typeof planId !== 'string') {
      return null;
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<SelfImprovementPlan>(`plan_${planId}`);
      if (cached) {
        return { ...cached };
      }
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(`plan_${planId}`, plan);
    }

    return { ...plan };
  }

  async updatePlan(
    planId: string, 
    updates: Partial<Omit<SelfImprovementPlan, 'id' | 'createdAt'>>
  ): Promise<SelfImprovementPlan> {
    const existingPlan = this.plans.get(planId);
    if (!existingPlan) {
      throw new ImprovementPlanError(
        `Plan not found: ${planId}`,
        'PLAN_NOT_FOUND',
        { planId },
        true,
        ['Check the plan ID', 'Verify the plan exists']
      );
    }

    // Create updated plan data (excluding immutable fields)
    const { id, createdAt, ...allowedUpdates } = updates as any;
    const updatedPlanData = {
      ...existingPlan,
      ...allowedUpdates,
      updatedAt: new Date()
    };

    // Validate updated plan data
    if (this.config.enableValidation) {
      const validation = this.validatePlanData(updatedPlanData);
      if (!validation.isValid) {
        throw new ImprovementPlanError(
          `Plan update validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { planId, updates, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Update plan
    this.plans.set(planId, updatedPlanData);
    
    // Update statistics
    this.stats.totalUpdated++;
    this.stats.lastOperationTime = new Date();
    
    // Clear relevant caches
    this.clearCacheByPattern(`plan_${planId}`);
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');

    return { ...updatedPlanData };
  }

  async listPlans(options: ImprovementPlanListOptions = {}): Promise<SelfImprovementPlan[]> {
    // Generate cache key based on options
    const cacheKey = `list_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<SelfImprovementPlan[]>(cacheKey);
      if (cached) {
        return cached.map(plan => ({ ...plan }));
      }
    }

    let plans = Array.from(this.plans.values());

    // Apply filters
    if (options.status && options.status.length > 0) {
      plans = plans.filter(plan => options.status!.includes(plan.status));
    }

    if (options.priority && options.priority.length > 0) {
      plans = plans.filter(plan => options.priority!.includes(plan.priority));
    }

    if (options.area && options.area.length > 0) {
      plans = plans.filter(plan => 
        plan.targetAreas.some(area => options.area!.includes(area))
      );
    }

    if (options.minProgress !== undefined) {
      plans = plans.filter(plan => plan.progress >= options.minProgress!);
    }

    if (options.maxProgress !== undefined) {
      plans = plans.filter(plan => plan.progress <= options.maxProgress!);
    }

    // Apply sorting
    if (options.sortBy) {
      plans.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (options.sortBy) {
          case 'createdAt':
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
            break;
          case 'priority':
            aValue = this.getPriorityWeight(a.priority);
            bValue = this.getPriorityWeight(b.priority);
            break;
          case 'progress':
            aValue = a.progress;
            bValue = b.progress;
            break;
          case 'endDate':
            aValue = a.endDate.getTime();
            bValue = b.endDate.getTime();
            break;
          default:
            aValue = a.createdAt.getTime();
            bValue = b.createdAt.getTime();
        }

        const direction = options.sortDirection === 'desc' ? -1 : 1;
        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? plans.length;
    const paginatedPlans = plans.slice(offset, offset + limit);

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, paginatedPlans);
    }

    return paginatedPlans.map(plan => ({ ...plan }));
  }

  async deletePlan(planId: string): Promise<boolean> {
    const deleted = this.plans.delete(planId);
    
    if (deleted) {
      // Update statistics
      this.stats.totalDeleted++;
      this.stats.lastOperationTime = new Date();
      
      // Clear relevant caches
      this.clearCacheByPattern(`plan_${planId}`);
      this.clearCacheByPattern('list_');
      this.clearCacheByPattern('stats');
    }

    return deleted;
  }

  // ============================================================================
  // Advanced Operations
  // ============================================================================

  async generatePlanFromReflections(
    reflectionIds: string[], 
    options: PlanGenerationOptions = {}
  ): Promise<SelfImprovementPlan> {
    if (!reflectionIds || reflectionIds.length === 0) {
      throw new ImprovementPlanError(
        'At least one reflection ID is required',
        'INVALID_REFLECTION_IDS',
        { reflectionIds },
        true,
        ['Provide valid reflection IDs']
      );
    }

    // Generate plan based on reflections (simplified implementation)
    const now = new Date();
    const endDate = options.timeframe?.end ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default
    
    const planData = {
      name: `Improvement Plan from ${reflectionIds.length} Reflection${reflectionIds.length > 1 ? 's' : ''}`,
      description: `Generated improvement plan based on insights from reflections: ${reflectionIds.join(', ')}`,
      startDate: options.timeframe?.start ?? now,
      endDate,
      sourceReflectionIds: reflectionIds,
      targetAreas: options.focusAreas ?? [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
      status: 'draft' as const,
      priority: options.priorityThreshold ?? ImprovementPriority.MEDIUM,
      progress: 0,
      successMetrics: ['Improved performance', 'Better outcomes'],
      successCriteria: ['Measurable improvement in target areas', 'Successful completion of activities']
    };

    return this.createPlan(planData);
  }

  async calculateProgress(planId: string): Promise<number> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new ImprovementPlanError(
        `Plan not found: ${planId}`,
        'PLAN_NOT_FOUND',
        { planId },
        true,
        ['Check the plan ID', 'Verify the plan exists']
      );
    }

    // For now, return the stored progress
    // In a full implementation, this would calculate based on activities
    return plan.progress;
  }

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  getStats(): PlanManagerStats {
    const cacheKey = 'stats';
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<PlanManagerStats>(cacheKey);
      if (cached) {
        return { ...cached };
      }
    }

    const plans = Array.from(this.plans.values());
    
    // Calculate statistics
    const stats: PlanManagerStats = {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'active').length,
      completedPlans: plans.filter(p => p.status === 'completed').length,
      averageProgress: plans.length > 0 ? plans.reduce((sum, p) => sum + p.progress, 0) / plans.length : 0,
      plansByPriority: {
        [ImprovementPriority.LOW]: plans.filter(p => p.priority === ImprovementPriority.LOW).length,
        [ImprovementPriority.MEDIUM]: plans.filter(p => p.priority === ImprovementPriority.MEDIUM).length,
        [ImprovementPriority.HIGH]: plans.filter(p => p.priority === ImprovementPriority.HIGH).length,
        [ImprovementPriority.CRITICAL]: plans.filter(p => p.priority === ImprovementPriority.CRITICAL).length
      },
      plansByArea: {
        [ImprovementAreaType.KNOWLEDGE]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.KNOWLEDGE)).length,
        [ImprovementAreaType.SKILL]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.SKILL)).length,
        [ImprovementAreaType.BEHAVIOR]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.BEHAVIOR)).length,
        [ImprovementAreaType.COMMUNICATION]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.COMMUNICATION)).length,
        [ImprovementAreaType.DECISION_MAKING]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.DECISION_MAKING)).length,
        [ImprovementAreaType.PROBLEM_SOLVING]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.PROBLEM_SOLVING)).length,
        [ImprovementAreaType.CREATIVITY]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.CREATIVITY)).length,
        [ImprovementAreaType.EFFICIENCY]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.EFFICIENCY)).length,
        [ImprovementAreaType.QUALITY]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.QUALITY)).length,
        [ImprovementAreaType.COLLABORATION]: plans.filter(p => p.targetAreas.includes(ImprovementAreaType.COLLABORATION)).length
      },
      plansByStatus: {
        draft: plans.filter(p => p.status === 'draft').length,
        active: plans.filter(p => p.status === 'active').length,
        paused: plans.filter(p => p.status === 'paused').length,
        completed: plans.filter(p => p.status === 'completed').length,
        cancelled: plans.filter(p => p.status === 'cancelled').length
      }
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, stats);
    }

    return stats;
  }

  async clear(): Promise<void> {
    this.plans.clear();
    this.cache.clear();
    this.stats = {
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      lastOperationTime: new Date()
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validatePlanData(plan: Omit<SelfImprovementPlan, 'id' | 'createdAt' | 'updatedAt'>): PlanValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Validate name
    if (!plan.name || plan.name.trim().length === 0) {
      errors.push('Plan name is required');
      suggestions.push('Provide a valid plan name');
    }

    // Validate description
    if (!plan.description || plan.description.trim().length === 0) {
      errors.push('Plan description is required');
      suggestions.push('Provide a meaningful plan description');
    }

    // Validate dates
    if (plan.endDate <= plan.startDate) {
      errors.push('End date must be after start date');
      suggestions.push('Set end date to be later than start date');
    }

    // Validate progress
    if (plan.progress < 0 || plan.progress > 1) {
      errors.push('Progress must be between 0 and 1');
      suggestions.push('Set progress to a value between 0 and 1');
    }

    // Validate target areas
    if (!plan.targetAreas || plan.targetAreas.length === 0) {
      errors.push('At least one target area is required');
      suggestions.push('Select one or more improvement areas');
    }

    // Validate source reflections
    if (!plan.sourceReflectionIds || plan.sourceReflectionIds.length === 0) {
      errors.push('At least one source reflection is required');
      suggestions.push('Provide reflection IDs that inspired this plan');
    }

    // Validate success criteria
    if (!plan.successCriteria || plan.successCriteria.length === 0) {
      errors.push('Success criteria are required');
      suggestions.push('Define clear success criteria for the plan');
    }

    // Validate success metrics
    if (!plan.successMetrics || plan.successMetrics.length === 0) {
      errors.push('Success metrics are required');
      suggestions.push('Define measurable success metrics');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }

  private getPriorityWeight(priority: ImprovementPriority): number {
    switch (priority) {
      case ImprovementPriority.LOW: return 1;
      case ImprovementPriority.MEDIUM: return 2;
      case ImprovementPriority.HIGH: return 3;
      case ImprovementPriority.CRITICAL: return 4;
      default: return 2;
    }
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