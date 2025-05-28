/**
 * LearningActivityManager.ts
 * 
 * Manages learning activities with CRUD operations, lifecycle management, and analytics.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  LearningActivityManager as ILearningActivityManager,
  LearningActivity,
  ImprovementAreaType,
  ImprovementPriority,
  LearningActivityListOptions,
  ActivityManagerStats,
  LearningActivityError
} from '../interfaces/EnhancedReflectionInterfaces';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface LearningActivityManagerConfig {
  maxActivities?: number;
  enableAutoProgress?: boolean;
  enableValidation?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number; // milliseconds
  enableDurationTracking?: boolean;
}

// ============================================================================
// Internal Types
// ============================================================================

interface ActivityValidationResult {
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

export class LearningActivityManager implements ILearningActivityManager {
  private readonly config: Required<LearningActivityManagerConfig>;
  private readonly activities: Map<string, LearningActivity> = new Map();
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  
  // Statistics tracking
  private stats = {
    totalCreated: 0,
    totalUpdated: 0,
    totalDeleted: 0,
    totalStarted: 0,
    totalCompleted: 0,
    lastOperationTime: new Date()
  };

  constructor(config: LearningActivityManagerConfig = {}) {
    this.config = {
      maxActivities: config.maxActivities ?? 10000,
      enableAutoProgress: config.enableAutoProgress ?? true,
      enableValidation: config.enableValidation ?? true,
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize ?? 100,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      enableDurationTracking: config.enableDurationTracking ?? true
    };
  }

  // ============================================================================
  // Activity CRUD Operations
  // ============================================================================

  async createActivity(activity: Omit<LearningActivity, 'id'>): Promise<LearningActivity> {
    // Validate activity data
    if (this.config.enableValidation) {
      const validation = this.validateActivityData(activity);
      if (!validation.isValid) {
        throw new LearningActivityError(
          `Activity validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { activity, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Check activity limit
    if (this.activities.size >= this.config.maxActivities) {
      throw new LearningActivityError(
        `Maximum number of activities reached (${this.config.maxActivities})`,
        'MAX_ACTIVITIES_EXCEEDED',
        { maxActivities: this.config.maxActivities, currentCount: this.activities.size },
        true,
        ['Delete unused activities', 'Increase maxActivities configuration']
      );
    }

    // Create new activity with generated ID
    const newActivity: LearningActivity = {
      ...activity,
      id: ulid()
    };

    // Store activity
    this.activities.set(newActivity.id, newActivity);
    
    // Update statistics
    this.stats.totalCreated++;
    this.stats.lastOperationTime = new Date();
    
    // Clear relevant caches
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');
    this.clearCacheByPattern(`plan_${newActivity.planId}`);

    return { ...newActivity };
  }

  async getActivity(activityId: string): Promise<LearningActivity | null> {
    if (!activityId || typeof activityId !== 'string') {
      return null;
    }

    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<LearningActivity>(`activity_${activityId}`);
      if (cached) {
        return { ...cached };
      }
    }

    const activity = this.activities.get(activityId);
    if (!activity) {
      return null;
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(`activity_${activityId}`, activity);
    }

    return { ...activity };
  }

  async updateActivity(
    activityId: string, 
    updates: Partial<Omit<LearningActivity, 'id'>>
  ): Promise<LearningActivity> {
    const existingActivity = this.activities.get(activityId);
    if (!existingActivity) {
      throw new LearningActivityError(
        `Activity not found: ${activityId}`,
        'ACTIVITY_NOT_FOUND',
        { activityId },
        true,
        ['Check the activity ID', 'Verify the activity exists']
      );
    }

    // Create updated activity data (excluding immutable fields)
    const { id, ...allowedUpdates } = updates as any;
    const updatedActivityData = {
      ...existingActivity,
      ...allowedUpdates
    };

    // Validate updated activity data
    if (this.config.enableValidation) {
      const validation = this.validateActivityData(updatedActivityData);
      if (!validation.isValid) {
        throw new LearningActivityError(
          `Activity update validation failed: ${validation.errors.join(', ')}`,
          'VALIDATION_FAILED',
          { activityId, updates, errors: validation.errors },
          true,
          validation.suggestions
        );
      }
    }

    // Update activity
    this.activities.set(activityId, updatedActivityData);
    
    // Update statistics
    this.stats.totalUpdated++;
    this.stats.lastOperationTime = new Date();
    
    // Clear relevant caches
    this.clearCacheByPattern(`activity_${activityId}`);
    this.clearCacheByPattern('list_');
    this.clearCacheByPattern('stats');
    this.clearCacheByPattern(`plan_${updatedActivityData.planId}`);

    return { ...updatedActivityData };
  }

  async listActivities(options: LearningActivityListOptions = {}): Promise<LearningActivity[]> {
    // Generate cache key based on options
    const cacheKey = `list_${JSON.stringify(options)}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<LearningActivity[]>(cacheKey);
      if (cached) {
        return cached.map(activity => ({ ...activity }));
      }
    }

    let activities = Array.from(this.activities.values());

    // Apply filters
    if (options.planId) {
      activities = activities.filter(activity => activity.planId === options.planId);
    }

    if (options.status && options.status.length > 0) {
      activities = activities.filter(activity => options.status!.includes(activity.status));
    }

    if (options.type && options.type.length > 0) {
      activities = activities.filter(activity => options.type!.includes(activity.type));
    }

    if (options.area && options.area.length > 0) {
      activities = activities.filter(activity => options.area!.includes(activity.area));
    }

    if (options.priority && options.priority.length > 0) {
      activities = activities.filter(activity => options.priority!.includes(activity.priority));
    }

    // Apply sorting
    if (options.sortBy) {
      activities.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (options.sortBy) {
          case 'startDate':
            aValue = a.startDate?.getTime() ?? 0;
            bValue = b.startDate?.getTime() ?? 0;
            break;
          case 'priority':
            aValue = this.getPriorityWeight(a.priority);
            bValue = this.getPriorityWeight(b.priority);
            break;
          case 'estimatedDuration':
            aValue = a.estimatedDuration;
            bValue = b.estimatedDuration;
            break;
          default:
            aValue = a.startDate?.getTime() ?? 0;
            bValue = b.startDate?.getTime() ?? 0;
        }

        const direction = options.sortDirection === 'desc' ? -1 : 1;
        return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? activities.length;
    const paginatedActivities = activities.slice(offset, offset + limit);

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, paginatedActivities);
    }

    return paginatedActivities.map(activity => ({ ...activity }));
  }

  async deleteActivity(activityId: string): Promise<boolean> {
    const deleted = this.activities.delete(activityId);
    
    if (deleted) {
      // Update statistics
      this.stats.totalDeleted++;
      this.stats.lastOperationTime = new Date();
      
      // Clear relevant caches
      this.clearCacheByPattern(`activity_${activityId}`);
      this.clearCacheByPattern('list_');
      this.clearCacheByPattern('stats');
    }

    return deleted;
  }

  // ============================================================================
  // Activity Lifecycle Management
  // ============================================================================

  async startActivity(activityId: string): Promise<LearningActivity> {
    const activity = await this.getActivity(activityId);
    if (!activity) {
      throw new LearningActivityError(
        `Activity not found: ${activityId}`,
        'ACTIVITY_NOT_FOUND',
        { activityId },
        true,
        ['Check the activity ID', 'Verify the activity exists']
      );
    }

    if (activity.status !== 'planned') {
      throw new LearningActivityError(
        `Activity cannot be started from status: ${activity.status}`,
        'INVALID_STATUS_TRANSITION',
        { activityId, currentStatus: activity.status, requestedStatus: 'in_progress' },
        true,
        ['Only planned activities can be started']
      );
    }

    const updatedActivity = await this.updateActivity(activityId, {
      status: 'in_progress',
      startDate: new Date()
    });

    // Update statistics
    this.stats.totalStarted++;

    return updatedActivity;
  }

  async completeActivity(activityId: string, notes?: string): Promise<LearningActivity> {
    const activity = await this.getActivity(activityId);
    if (!activity) {
      throw new LearningActivityError(
        `Activity not found: ${activityId}`,
        'ACTIVITY_NOT_FOUND',
        { activityId },
        true,
        ['Check the activity ID', 'Verify the activity exists']
      );
    }

    if (activity.status !== 'in_progress') {
      throw new LearningActivityError(
        `Activity cannot be completed from status: ${activity.status}`,
        'INVALID_STATUS_TRANSITION',
        { activityId, currentStatus: activity.status, requestedStatus: 'completed' },
        true,
        ['Only in-progress activities can be completed']
      );
    }

    const completedAt = new Date();
    const actualDuration = this.config.enableDurationTracking && activity.startDate
      ? Math.round((completedAt.getTime() - activity.startDate.getTime()) / 60000) // minutes
      : undefined;

    const updatedActivity = await this.updateActivity(activityId, {
      status: 'completed',
      completedAt,
      actualDuration,
      notes: notes || activity.notes
    });

    // Update statistics
    this.stats.totalCompleted++;

    return updatedActivity;
  }

  // ============================================================================
  // Plan Integration
  // ============================================================================

  async getActivitiesForPlan(planId: string): Promise<LearningActivity[]> {
    return this.listActivities({ planId });
  }

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  getStats(): ActivityManagerStats {
    const cacheKey = 'stats';
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<ActivityManagerStats>(cacheKey);
      if (cached) {
        return { ...cached };
      }
    }

    const activities = Array.from(this.activities.values());
    
    // Calculate statistics
    const stats: ActivityManagerStats = {
      totalActivities: activities.length,
      completedActivities: activities.filter(a => a.status === 'completed').length,
      inProgressActivities: activities.filter(a => a.status === 'in_progress').length,
      averageDuration: this.calculateAverageDuration(activities),
      activitiesByType: {
        reading: activities.filter(a => a.type === 'reading').length,
        practice: activities.filter(a => a.type === 'practice').length,
        experiment: activities.filter(a => a.type === 'experiment').length,
        reflection: activities.filter(a => a.type === 'reflection').length,
        discussion: activities.filter(a => a.type === 'discussion').length,
        research: activities.filter(a => a.type === 'research').length,
        training: activities.filter(a => a.type === 'training').length
      },
      activitiesByArea: {
        [ImprovementAreaType.KNOWLEDGE]: activities.filter(a => a.area === ImprovementAreaType.KNOWLEDGE).length,
        [ImprovementAreaType.SKILL]: activities.filter(a => a.area === ImprovementAreaType.SKILL).length,
        [ImprovementAreaType.BEHAVIOR]: activities.filter(a => a.area === ImprovementAreaType.BEHAVIOR).length,
        [ImprovementAreaType.COMMUNICATION]: activities.filter(a => a.area === ImprovementAreaType.COMMUNICATION).length,
        [ImprovementAreaType.DECISION_MAKING]: activities.filter(a => a.area === ImprovementAreaType.DECISION_MAKING).length,
        [ImprovementAreaType.PROBLEM_SOLVING]: activities.filter(a => a.area === ImprovementAreaType.PROBLEM_SOLVING).length,
        [ImprovementAreaType.CREATIVITY]: activities.filter(a => a.area === ImprovementAreaType.CREATIVITY).length,
        [ImprovementAreaType.EFFICIENCY]: activities.filter(a => a.area === ImprovementAreaType.EFFICIENCY).length,
        [ImprovementAreaType.QUALITY]: activities.filter(a => a.area === ImprovementAreaType.QUALITY).length,
        [ImprovementAreaType.COLLABORATION]: activities.filter(a => a.area === ImprovementAreaType.COLLABORATION).length
      },
      activitiesByStatus: {
        planned: activities.filter(a => a.status === 'planned').length,
        in_progress: activities.filter(a => a.status === 'in_progress').length,
        completed: activities.filter(a => a.status === 'completed').length,
        skipped: activities.filter(a => a.status === 'skipped').length,
        failed: activities.filter(a => a.status === 'failed').length
      }
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, stats);
    }

    return stats;
  }

  async clear(): Promise<void> {
    this.activities.clear();
    this.cache.clear();
    this.stats = {
      totalCreated: 0,
      totalUpdated: 0,
      totalDeleted: 0,
      totalStarted: 0,
      totalCompleted: 0,
      lastOperationTime: new Date()
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateActivityData(activity: Omit<LearningActivity, 'id'>): ActivityValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Validate name
    if (!activity.name || activity.name.trim().length === 0) {
      errors.push('Activity name is required');
      suggestions.push('Provide a valid activity name');
    }

    // Validate description
    if (!activity.description || activity.description.trim().length === 0) {
      errors.push('Activity description is required');
      suggestions.push('Provide a meaningful activity description');
    }

    // Validate plan ID
    if (!activity.planId || activity.planId.trim().length === 0) {
      errors.push('Plan ID is required');
      suggestions.push('Associate the activity with a valid improvement plan');
    }

    // Validate estimated duration
    if (activity.estimatedDuration <= 0) {
      errors.push('Estimated duration must be positive');
      suggestions.push('Set estimated duration to a positive number of minutes');
    }

    // Validate success criteria
    if (!activity.successCriteria || activity.successCriteria.length === 0) {
      errors.push('Success criteria are required');
      suggestions.push('Define clear success criteria for the activity');
    }

    // Validate prerequisites
    if (activity.prerequisites && activity.prerequisites.some(p => !p || p.trim().length === 0)) {
      errors.push('All prerequisites must be non-empty');
      suggestions.push('Remove empty prerequisites or provide valid descriptions');
    }

    // Validate resources
    if (activity.resources && activity.resources.some(r => !r || r.trim().length === 0)) {
      errors.push('All resources must be non-empty');
      suggestions.push('Remove empty resources or provide valid resource descriptions');
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

  private calculateAverageDuration(activities: LearningActivity[]): number {
    const completedActivities = activities.filter(a => a.status === 'completed' && a.actualDuration);
    if (completedActivities.length === 0) return 0;
    
    const totalDuration = completedActivities.reduce((sum, a) => sum + (a.actualDuration || 0), 0);
    return Math.round(totalDuration / completedActivities.length);
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