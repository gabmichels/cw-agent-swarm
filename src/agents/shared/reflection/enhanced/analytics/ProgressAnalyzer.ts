/**
 * ProgressAnalyzer.ts
 * 
 * Analyzes progress across improvement plans, activities, and learning outcomes.
 * Provides comprehensive reporting, bottleneck identification, and recommendations.
 * Following @IMPLEMENTATION_GUIDELINES.md with strict typing and ULID identifiers.
 */

import { ulid } from 'ulid';
import { 
  ProgressAnalyzer as IProgressAnalyzer,
  ImprovementProgressReport,
  ProgressReportOptions,
  ActivityProgressAnalysis,
  LearningEffectivenessAnalysis,
  Bottleneck,
  AnalyzerStats,
  ProgressMetrics,
  Achievement,
  Challenge,
  ImprovementAreaType,
  ImprovementPriority,
  LearningActivity,
  LearningOutcome,
  SelfImprovementPlan,
  LearningActivityError,
  LearningOutcomeType
} from '../interfaces/EnhancedReflectionInterfaces';

// ============================================================================
// Configuration Interface
// ============================================================================

export interface ProgressAnalyzerConfig {
  enableTrendAnalysis?: boolean;
  enableBottleneckDetection?: boolean;
  enableRecommendations?: boolean;
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number; // milliseconds
  minDataPointsForTrends?: number;
  bottleneckThreshold?: number; // 0-1, progress below this is considered a bottleneck
  recommendationLimit?: number;
}

// ============================================================================
// Internal Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface TrendData {
  timestamps: Date[];
  values: number[];
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  confidence: number;
}

interface BottleneckAnalysis {
  area: ImprovementAreaType;
  severity: number; // 0-1
  causes: string[];
  impact: string;
  suggestions: string[];
}

// ============================================================================
// Implementation
// ============================================================================

export class ProgressAnalyzer implements IProgressAnalyzer {
  private readonly config: Required<ProgressAnalyzerConfig>;
  private readonly cache: Map<string, CacheEntry<unknown>> = new Map();
  
  // Statistics tracking
  private stats = {
    reportsGenerated: 0,
    plansAnalyzed: 0,
    totalAnalysisTime: 0,
    lastAnalysisTime: undefined as Date | undefined
  };

  constructor(config: ProgressAnalyzerConfig = {}) {
    this.config = {
      enableTrendAnalysis: config.enableTrendAnalysis ?? true,
      enableBottleneckDetection: config.enableBottleneckDetection ?? true,
      enableRecommendations: config.enableRecommendations ?? true,
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize ?? 100,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      minDataPointsForTrends: config.minDataPointsForTrends ?? 5,
      bottleneckThreshold: config.bottleneckThreshold ?? 0.3,
      recommendationLimit: config.recommendationLimit ?? 10
    };
  }

  // ============================================================================
  // Progress Report Generation
  // ============================================================================

  async generateReport(
    planId: string, 
    options: ProgressReportOptions = {}
  ): Promise<ImprovementProgressReport> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `report_${planId}_${JSON.stringify(options)}`;
      if (this.config.enableCaching) {
        const cached = this.getFromCache<ImprovementProgressReport>(cacheKey);
        if (cached) {
          return { ...cached };
        }
      }

      // Get plan data (this would normally come from the plan manager)
      const plan = await this.getPlanData(planId);
      if (!plan) {
        throw new LearningActivityError(
          `Plan not found: ${planId}`,
          'PLAN_NOT_FOUND',
          { planId },
          true,
          ['Check the plan ID', 'Verify the plan exists']
        );
      }

      // Get activities and outcomes
      const activities = await this.getActivitiesForPlan(planId);
      const outcomes = await this.getOutcomesForPlan(planId);

      // Calculate time range
      const timeRange = this.calculateTimeRange(activities, options);

      // Calculate overall progress
      const overallProgress = await this.calculateOverallProgress(planId);

      // Generate metrics
      const metrics = this.calculateProgressMetrics(activities, outcomes, timeRange);

      // Generate achievements and challenges
      const achievements = this.identifyAchievements(activities, outcomes);
      const challenges = this.identifyChallenges(activities, outcomes);

      // Generate insights and recommendations
      const keyInsights = this.extractKeyInsights(activities, outcomes, metrics);
      const recommendations = this.config.enableRecommendations 
        ? await this.generateRecommendations(planId)
        : [];

      // Generate next steps
      const nextSteps = this.generateNextSteps(activities, plan);

      const report: ImprovementProgressReport = {
        planId,
        generatedAt: new Date(),
        timeRange,
        overallProgress,
        completedActivities: activities.filter(a => a.status === 'completed').length,
        totalActivities: activities.length,
        learningOutcomes: outcomes,
        keyInsights,
        achievements,
        challenges,
        recommendations,
        nextSteps,
        metrics
      };

      // Cache the result
      if (this.config.enableCaching) {
        this.setCache(cacheKey, report);
      }

      // Update statistics
      this.stats.reportsGenerated++;
      this.stats.totalAnalysisTime += Date.now() - startTime;
      this.stats.lastAnalysisTime = new Date();

      return report;

    } catch (error) {
      if (error instanceof LearningActivityError) {
        throw error;
      }
      
      throw new LearningActivityError(
        `Progress report generation failed for plan ${planId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REPORT_GENERATION_FAILED',
        { planId, options, error },
        true,
        ['Check plan data', 'Verify activity data', 'Review report options']
      );
    }
  }

  async calculateOverallProgress(planId: string): Promise<number> {
    const cacheKey = `progress_${planId}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    const activities = await this.getActivitiesForPlan(planId);
    if (activities.length === 0) {
      return 0;
    }

    // Calculate weighted progress based on activity priority and completion
    let totalWeight = 0;
    let completedWeight = 0;

    for (const activity of activities) {
      const weight = this.getActivityWeight(activity);
      totalWeight += weight;
      
      if (activity.status === 'completed') {
        completedWeight += weight;
      } else if (activity.status === 'in_progress') {
        // Partial credit for in-progress activities
        completedWeight += weight * 0.5;
      }
    }

    const progress = totalWeight > 0 ? completedWeight / totalWeight : 0;

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, progress);
    }

    return progress;
  }

  // ============================================================================
  // Activity Progress Analysis
  // ============================================================================

  async analyzeActivityProgress(planId: string): Promise<ActivityProgressAnalysis> {
    const cacheKey = `activity_analysis_${planId}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<ActivityProgressAnalysis>(cacheKey);
      if (cached) {
        return { ...cached };
      }
    }

    const activities = await this.getActivitiesForPlan(planId);
    
    // Calculate basic counts
    const totalActivities = activities.length;
    const completedActivities = activities.filter(a => a.status === 'completed').length;
    const inProgressActivities = activities.filter(a => a.status === 'in_progress').length;
    const plannedActivities = activities.filter(a => a.status === 'planned').length;

    // Calculate overall progress
    const overallProgress = totalActivities > 0 ? completedActivities / totalActivities : 0;

    // Calculate progress by area
    const progressByArea: Record<ImprovementAreaType, number> = {} as Record<ImprovementAreaType, number>;
    for (const area of Object.values(ImprovementAreaType)) {
      const areaActivities = activities.filter(a => a.area === area);
      const areaCompleted = areaActivities.filter(a => a.status === 'completed').length;
      progressByArea[area] = areaActivities.length > 0 ? areaCompleted / areaActivities.length : 0;
    }

    // Calculate progress by type
    const progressByType: Record<LearningActivity['type'], number> = {} as Record<LearningActivity['type'], number>;
    const activityTypes: LearningActivity['type'][] = ['reading', 'practice', 'experiment', 'reflection', 'discussion', 'research', 'training'];
    for (const type of activityTypes) {
      const typeActivities = activities.filter(a => a.type === type);
      const typeCompleted = typeActivities.filter(a => a.status === 'completed').length;
      progressByType[type] = typeActivities.length > 0 ? typeCompleted / typeActivities.length : 0;
    }

    // Estimate completion date
    const estimatedCompletion = this.estimateCompletionDate(activities);

    // Identify blockers
    const blockers = this.identifyBlockers(activities);

    const analysis: ActivityProgressAnalysis = {
      planId,
      totalActivities,
      completedActivities,
      inProgressActivities,
      plannedActivities,
      overallProgress,
      progressByArea,
      progressByType,
      estimatedCompletion,
      blockers
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, analysis);
    }

    return analysis;
  }

  // ============================================================================
  // Learning Effectiveness Analysis
  // ============================================================================

  async analyzeLearningEffectiveness(planId: string): Promise<LearningEffectivenessAnalysis> {
    const cacheKey = `effectiveness_${planId}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<LearningEffectivenessAnalysis>(cacheKey);
      if (cached) {
        return { ...cached };
      }
    }

    const activities = await this.getActivitiesForPlan(planId);
    const outcomes = await this.getOutcomesForPlan(planId);

    // Calculate effectiveness metrics
    const completedActivities = activities.filter(a => a.status === 'completed');
    const totalOutcomes = outcomes.length;
    const appliedOutcomes = outcomes.filter(o => o.appliedToBehavior).length;

    // Calculate learning velocity (outcomes per week)
    const learningVelocity = this.calculateLearningVelocity(outcomes);

    // Calculate knowledge retention (based on outcome confidence)
    const knowledgeRetention = this.calculateKnowledgeRetention(outcomes);

    // Calculate behavior change rate
    const behaviorChangeRate = totalOutcomes > 0 ? appliedOutcomes / totalOutcomes : 0;

    // Calculate overall effectiveness
    const overallEffectiveness = this.calculateOverallEffectiveness(
      learningVelocity,
      knowledgeRetention,
      behaviorChangeRate
    );

    // Analyze effectiveness by area
    const effectivenessByArea: Record<ImprovementAreaType, number> = {} as Record<ImprovementAreaType, number>;
    for (const area of Object.values(ImprovementAreaType)) {
      const areaOutcomes = outcomes.filter(o => o.area === area);
      const areaApplied = areaOutcomes.filter(o => o.appliedToBehavior).length;
      effectivenessByArea[area] = areaOutcomes.length > 0 ? areaApplied / areaOutcomes.length : 0;
    }

    // Identify improvement opportunities
    const improvementOpportunities = this.identifyImprovementOpportunities(activities, outcomes);

    const analysis: LearningEffectivenessAnalysis = {
      planId,
      totalOutcomes,
      appliedOutcomes,
      averageConfidence: this.calculateAverageConfidence(outcomes),
      effectivenessByArea,
      effectivenessByType: this.calculateEffectivenessByType(outcomes),
      knowledgeRetention,
      behaviorChangeRate,
      learningVelocity,
      recommendations: improvementOpportunities
    };

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, analysis);
    }

    return analysis;
  }

  // ============================================================================
  // Bottleneck Identification
  // ============================================================================

  async identifyBottlenecks(planId: string): Promise<Bottleneck[]> {
    if (!this.config.enableBottleneckDetection) {
      return [];
    }

    const cacheKey = `bottlenecks_${planId}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<Bottleneck[]>(cacheKey);
      if (cached) {
        return cached.map(b => ({ ...b }));
      }
    }

    const activities = await this.getActivitiesForPlan(planId);
    const bottlenecks: Bottleneck[] = [];

    // Analyze progress by area to identify bottlenecks
    const progressByArea = await this.calculateProgressByArea(activities);
    
    for (const [area, progress] of Object.entries(progressByArea)) {
      if (progress < this.config.bottleneckThreshold) {
        const areaActivities = activities.filter(a => a.area === area as ImprovementAreaType);
        const bottleneckAnalysis = this.analyzeAreaBottleneck(
          area as ImprovementAreaType, 
          activities, 
          progress
        );
        
        bottlenecks.push({
          type: 'skill',
          description: `Low progress in ${area} area (${Math.round(progress * 100)}%)`,
          severity: progress < 0.1 ? 'high' : progress < 0.2 ? 'medium' : 'low',
          impact: bottleneckAnalysis.impact,
          suggestedSolutions: bottleneckAnalysis.suggestions,
          affectedActivities: areaActivities.filter((a: LearningActivity) => a.status !== 'completed').map((a: LearningActivity) => a.id),
          identifiedAt: new Date()
        });
      }
    }

    // Identify activity-specific bottlenecks
    const activityBottlenecks = this.identifyActivityBottlenecks(activities);
    bottlenecks.push(...activityBottlenecks);

    // Sort by severity (highest first)
    // Sort by severity (convert string severity to numeric for sorting)
    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    bottlenecks.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, bottlenecks);
    }

    return bottlenecks;
  }

  // ============================================================================
  // Recommendation Generation
  // ============================================================================

  async generateRecommendations(planId: string): Promise<string[]> {
    if (!this.config.enableRecommendations) {
      return [];
    }

    const cacheKey = `recommendations_${planId}`;
    
    // Check cache first
    if (this.config.enableCaching) {
      const cached = this.getFromCache<string[]>(cacheKey);
      if (cached) {
        return [...cached];
      }
    }

    const activities = await this.getActivitiesForPlan(planId);
    const outcomes = await this.getOutcomesForPlan(planId);
    const bottlenecks = await this.identifyBottlenecks(planId);

    const recommendations: string[] = [];

    // Generate recommendations based on bottlenecks
    for (const bottleneck of bottlenecks.slice(0, 3)) { // Top 3 bottlenecks
      recommendations.push(...bottleneck.suggestedSolutions);
    }

    // Generate recommendations based on activity patterns
    const activityRecommendations = this.generateActivityRecommendations(activities);
    recommendations.push(...activityRecommendations);

    // Generate recommendations based on learning effectiveness
    const effectivenessRecommendations = this.generateEffectivenessRecommendations(outcomes);
    recommendations.push(...effectivenessRecommendations);

    // Remove duplicates and limit
    const uniqueRecommendations = Array.from(new Set(recommendations))
      .slice(0, this.config.recommendationLimit);

    // Cache the result
    if (this.config.enableCaching) {
      this.setCache(cacheKey, uniqueRecommendations);
    }

    return uniqueRecommendations;
  }

  // ============================================================================
  // Statistics and State Management
  // ============================================================================

  getStats(): AnalyzerStats {
    return {
      reportsGenerated: this.stats.reportsGenerated,
      plansAnalyzed: new Set(Array.from(this.cache.keys())
        .filter(key => key.startsWith('progress_'))
        .map(key => key.replace('progress_', ''))).size,
      averageReportGenerationTime: this.stats.reportsGenerated > 0 
        ? this.stats.totalAnalysisTime / this.stats.reportsGenerated 
        : 0,
      lastAnalysisTime: this.stats.lastAnalysisTime
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      reportsGenerated: 0,
      plansAnalyzed: 0,
      totalAnalysisTime: 0,
      lastAnalysisTime: undefined
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async getPlanData(planId: string): Promise<SelfImprovementPlan | null> {
    // In a real implementation, this would fetch from the ImprovementPlanManager
    // For now, return a mock plan
    return {
      id: planId,
      name: 'Mock Plan',
      description: 'Mock improvement plan for testing',
      createdAt: new Date(),
      updatedAt: new Date(),
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      sourceReflectionIds: ['reflection-1'],
      targetAreas: [ImprovementAreaType.KNOWLEDGE, ImprovementAreaType.SKILL],
      status: 'active',
      priority: ImprovementPriority.MEDIUM,
      progress: 0.5,
      successMetrics: ['completion_rate', 'learning_velocity'],
      successCriteria: ['Complete all activities', 'Achieve target outcomes']
    };
  }

  private async getActivitiesForPlan(planId: string): Promise<LearningActivity[]> {
    // In a real implementation, this would fetch from the LearningActivityManager
    // For now, return mock activities
    return [
      {
        id: ulid(),
        name: 'Mock Activity 1',
        description: 'Mock learning activity',
        planId,
        type: 'reading',
        area: ImprovementAreaType.KNOWLEDGE,
        priority: ImprovementPriority.HIGH,
        status: 'completed',
        estimatedDuration: 60,
        successCriteria: ['Complete reading'],
        prerequisites: [],
        resources: [],
        notes: '',
        metadata: {}
      },
      {
        id: ulid(),
        name: 'Mock Activity 2',
        description: 'Another mock learning activity',
        planId,
        type: 'practice',
        area: ImprovementAreaType.SKILL,
        priority: ImprovementPriority.MEDIUM,
        status: 'in_progress',
        estimatedDuration: 90,
        successCriteria: ['Complete practice'],
        prerequisites: [],
        resources: [],
        notes: '',
        metadata: {}
      }
    ];
  }

  private async getOutcomesForPlan(planId: string): Promise<LearningOutcome[]> {
    // In a real implementation, this would fetch from the LearningOutcomeManager
    // For now, return mock outcomes
    return [
      {
        id: ulid(),
        planId,
        activityId: ulid(),
        type: 'knowledge_gained',
        area: ImprovementAreaType.KNOWLEDGE,
        description: 'Gained understanding of key concepts',
        confidence: 0.8,
        evidence: ['Completed reading', 'Answered questions correctly'],
        appliedToBehavior: true,
        relatedInsightIds: [],
        metadata: {},
        timestamp: new Date()
      }
    ];
  }

  private calculateTimeRange(activities: LearningActivity[], options: ProgressReportOptions): { start: Date; end: Date } {
    if (options.timeRange) {
      return options.timeRange;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      start: thirtyDaysAgo,
      end: now
    };
  }

  private calculateProgressMetrics(
    activities: LearningActivity[], 
    outcomes: LearningOutcome[], 
    timeRange: { start: Date; end: Date }
  ): ProgressMetrics {
    const completedActivities = activities.filter(a => a.status === 'completed').length;
    const inProgressActivities = activities.filter(a => a.status === 'in_progress').length;
    const plannedActivities = activities.filter(a => a.status === 'planned').length;

    // Calculate average activity duration
    const completedWithDuration = activities.filter(a => a.status === 'completed' && a.actualDuration);
    const averageActivityDuration = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, a) => sum + (a.actualDuration || 0), 0) / completedWithDuration.length
      : 0;

    // Calculate learning velocity (outcomes per week)
    const timeRangeWeeks = (timeRange.end.getTime() - timeRange.start.getTime()) / (7 * 24 * 60 * 60 * 1000);
    const learningVelocity = timeRangeWeeks > 0 ? outcomes.length / timeRangeWeeks : 0;

    // Calculate knowledge retention (based on outcome confidence)
    const knowledgeRetention = outcomes.length > 0
      ? outcomes.reduce((sum, o) => sum + o.confidence, 0) / outcomes.length
      : 0;

    // Calculate behavior change rate
    const appliedOutcomes = outcomes.filter(o => o.appliedToBehavior).length;
    const behaviorChangeRate = outcomes.length > 0 ? appliedOutcomes / outcomes.length : 0;

    // Calculate overall effectiveness
    const overallEffectiveness = (learningVelocity * 0.3 + knowledgeRetention * 0.4 + behaviorChangeRate * 0.3);

    return {
      activitiesCompleted: completedActivities,
      activitiesInProgress: inProgressActivities,
      activitiesPlanned: plannedActivities,
      averageActivityDuration,
      learningVelocity,
      knowledgeRetention,
      behaviorChangeRate,
      overallEffectiveness
    };
  }

  private identifyAchievements(activities: LearningActivity[], outcomes: LearningOutcome[]): Achievement[] {
    const achievements: Achievement[] = [];

    // Achievement for completing activities
    const completedActivities = activities.filter(a => a.status === 'completed').length;
    if (completedActivities > 0) {
      achievements.push({
        title: 'Activities Completed',
        description: `Successfully completed ${completedActivities} learning activities`,
        achievedAt: new Date(),
        impact: `Improved learning progress through completion of ${completedActivities} activities`,
        category: 'milestone',
        evidence: [`${completedActivities} activities marked as completed`]
      });
    }

    // Achievement for high-confidence outcomes
    const highConfidenceOutcomes = outcomes.filter(o => o.confidence >= 0.8).length;
    if (highConfidenceOutcomes > 0) {
      achievements.push({
        title: 'High-Quality Learning',
        description: `Achieved ${highConfidenceOutcomes} high-confidence learning outcomes`,
        achievedAt: new Date(),
        impact: `Improved learning quality through ${highConfidenceOutcomes} high-confidence outcomes`,
        category: 'quality',
        evidence: [`${highConfidenceOutcomes} outcomes with confidence >= 0.8`]
      });
    }

    return achievements;
  }

  private identifyChallenges(activities: LearningActivity[], outcomes: LearningOutcome[]): Challenge[] {
    const challenges: Challenge[] = [];

    // Challenge for incomplete activities
    const incompleteActivities = activities.filter(a => a.status !== 'completed').length;
    if (incompleteActivities > activities.length * 0.5) {
      challenges.push({
        title: 'Activity Completion Rate',
        description: `${incompleteActivities} activities remain incomplete`,
        severity: 'medium',
        impact: 'Slowing overall plan progress and potentially affecting deadlines',
        suggestedActions: ['Review activity priorities', 'Break down complex activities', 'Set clearer deadlines'],
        identifiedAt: new Date()
      });
    }

    // Challenge for low-confidence outcomes
    const lowConfidenceOutcomes = outcomes.filter(o => o.confidence < 0.5).length;
    if (lowConfidenceOutcomes > 0) {
      challenges.push({
        title: 'Learning Confidence',
        description: `${lowConfidenceOutcomes} outcomes have low confidence scores`,
        severity: 'medium',
        impact: 'Reducing overall learning effectiveness and behavior change potential',
        suggestedActions: ['Review learning methods', 'Seek additional resources', 'Practice more frequently'],
        identifiedAt: new Date()
      });
    }

    return challenges;
  }

  private extractKeyInsights(
    activities: LearningActivity[], 
    outcomes: LearningOutcome[], 
    metrics: ProgressMetrics
  ): string[] {
    const insights: string[] = [];

    // Insight about learning velocity
    if (metrics.learningVelocity > 1) {
      insights.push(`Strong learning velocity: ${metrics.learningVelocity.toFixed(1)} outcomes per week`);
    } else if (metrics.learningVelocity < 0.5) {
      insights.push(`Learning velocity could be improved: ${metrics.learningVelocity.toFixed(1)} outcomes per week`);
    }

    // Insight about behavior change
    if (metrics.behaviorChangeRate > 0.7) {
      insights.push(`Excellent behavior change rate: ${Math.round(metrics.behaviorChangeRate * 100)}% of outcomes applied`);
    } else if (metrics.behaviorChangeRate < 0.3) {
      insights.push(`Low behavior change rate: only ${Math.round(metrics.behaviorChangeRate * 100)}% of outcomes applied`);
    }

    // Insight about activity completion
    const completionRate = activities.length > 0 ? metrics.activitiesCompleted / activities.length : 0;
    if (completionRate > 0.8) {
      insights.push(`High activity completion rate: ${Math.round(completionRate * 100)}%`);
    } else if (completionRate < 0.5) {
      insights.push(`Activity completion needs attention: ${Math.round(completionRate * 100)}%`);
    }

    return insights;
  }

  private generateNextSteps(activities: LearningActivity[], plan: SelfImprovementPlan): string[] {
    const nextSteps: string[] = [];

    // Next steps based on activity status
    const inProgressActivities = activities.filter(a => a.status === 'in_progress');
    if (inProgressActivities.length > 0) {
      nextSteps.push(`Complete ${inProgressActivities.length} in-progress activities`);
    }

    const plannedActivities = activities.filter(a => a.status === 'planned');
    if (plannedActivities.length > 0) {
      const nextActivity = plannedActivities.sort((a, b) => 
        this.getActivityWeight(b) - this.getActivityWeight(a)
      )[0];
      nextSteps.push(`Start next priority activity: ${nextActivity.name}`);
    }

    // Next steps based on plan timeline
    if (plan.endDate && plan.endDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      nextSteps.push('Plan deadline approaching - review remaining activities');
    }

    return nextSteps;
  }

  private getActivityWeight(activity: LearningActivity): number {
    const priorityWeights = {
      [ImprovementPriority.LOW]: 1,
      [ImprovementPriority.MEDIUM]: 2,
      [ImprovementPriority.HIGH]: 3,
      [ImprovementPriority.CRITICAL]: 4
    };
    return priorityWeights[activity.priority] || 2;
  }

  private calculateProgressByArea(activities: LearningActivity[]): Record<string, number> {
    const progressByArea: Record<string, number> = {};
    
    for (const area of Object.values(ImprovementAreaType)) {
      const areaActivities = activities.filter(a => a.area === area);
      const areaCompleted = areaActivities.filter(a => a.status === 'completed').length;
      progressByArea[area] = areaActivities.length > 0 ? areaCompleted / areaActivities.length : 0;
    }
    
    return progressByArea;
  }

  private analyzeAreaBottleneck(
    area: ImprovementAreaType, 
    activities: LearningActivity[], 
    progress: number
  ): BottleneckAnalysis {
    const areaActivities = activities.filter(a => a.area === area);
    const causes: string[] = [];
    const suggestions: string[] = [];

    // Analyze causes
    const highPriorityIncomplete = areaActivities.filter(a => 
      a.priority === ImprovementPriority.HIGH && a.status !== 'completed'
    ).length;
    
    if (highPriorityIncomplete > 0) {
      causes.push(`${highPriorityIncomplete} high-priority activities incomplete`);
      suggestions.push('Focus on completing high-priority activities first');
    }

    const longDurationActivities = areaActivities.filter(a => 
      a.estimatedDuration > 120 && a.status !== 'completed'
    ).length;
    
    if (longDurationActivities > 0) {
      causes.push(`${longDurationActivities} long-duration activities may be blocking progress`);
      suggestions.push('Break down long activities into smaller tasks');
    }

    return {
      area,
      severity: 1 - progress,
      causes,
      impact: `${area} development is significantly behind schedule`,
      suggestions
    };
  }

  private calculateBottleneckSeverity(progress: number): number {
    return Math.max(0, Math.min(1, (this.config.bottleneckThreshold - progress) / this.config.bottleneckThreshold));
  }

  private identifyActivityBottlenecks(activities: LearningActivity[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Identify activities that have been in progress for too long
    const now = new Date();
    const stuckActivities = activities.filter(a => {
      if (a.status !== 'in_progress' || !a.startDate) return false;
      const daysSinceStart = (now.getTime() - a.startDate.getTime()) / (24 * 60 * 60 * 1000);
      const expectedDays = (a.estimatedDuration || 60) / (8 * 60); // Assuming 8 hours per day
      return daysSinceStart > expectedDays * 2; // Taking more than twice the expected time
    });

    for (const activity of stuckActivities) {
      bottlenecks.push({
        type: 'activity',
        description: `Activity "${activity.name}" has been in progress for an extended period`,
        severity: 'high',
        impact: 'Blocking progress in related activities',
        suggestedSolutions: [
          'Break activity into smaller tasks',
          'Review available resources',
          'Clarify success criteria',
          'Consider seeking help or guidance'
        ],
        affectedActivities: [activity.id],
        identifiedAt: new Date()
      });
    }

    return bottlenecks;
  }

  private estimateCompletionDate(activities: LearningActivity[]): Date {
    const incompleteActivities = activities.filter(a => a.status !== 'completed');
    const totalRemainingDuration = incompleteActivities.reduce((sum, a) => sum + (a.estimatedDuration || 60), 0);
    
    // Assume 2 hours of learning per day
    const dailyLearningHours = 2;
    const remainingDays = Math.ceil(totalRemainingDuration / (dailyLearningHours * 60));
    
    return new Date(Date.now() + remainingDays * 24 * 60 * 60 * 1000);
  }

  private identifyBlockers(activities: LearningActivity[]): string[] {
    const blockers: string[] = [];

    // Check for prerequisite blockers
    const activitiesWithPrereqs = activities.filter(a => a.prerequisites && a.prerequisites.length > 0);
    if (activitiesWithPrereqs.length > 0) {
      blockers.push('Some activities have unmet prerequisites');
    }

    // Check for resource blockers
    const activitiesWithResources = activities.filter(a => a.resources && a.resources.length > 0);
    if (activitiesWithResources.length > activities.length * 0.8) {
      blockers.push('High dependency on external resources');
    }

    return blockers;
  }

  private calculateLearningVelocity(outcomes: LearningOutcome[]): number {
    if (outcomes.length === 0) return 0;

    // Calculate outcomes per week based on timestamps
    const timestamps = outcomes.map(o => o.timestamp.getTime()).sort();
    const timeSpanWeeks = (timestamps[timestamps.length - 1] - timestamps[0]) / (7 * 24 * 60 * 60 * 1000);
    
    return timeSpanWeeks > 0 ? outcomes.length / timeSpanWeeks : outcomes.length;
  }

  private calculateKnowledgeRetention(outcomes: LearningOutcome[]): number {
    if (outcomes.length === 0) return 0;
    
    return outcomes.reduce((sum, o) => sum + o.confidence, 0) / outcomes.length;
  }

  private calculateOverallEffectiveness(
    learningVelocity: number, 
    knowledgeRetention: number, 
    behaviorChangeRate: number
  ): number {
    // Normalize learning velocity (assume 1 outcome per week is baseline)
    const normalizedVelocity = Math.min(1, learningVelocity / 1);
    
    // Weighted average: velocity 30%, retention 40%, behavior change 30%
    return normalizedVelocity * 0.3 + knowledgeRetention * 0.4 + behaviorChangeRate * 0.3;
  }

  private identifyImprovementOpportunities(
    activities: LearningActivity[], 
    outcomes: LearningOutcome[]
  ): string[] {
    const opportunities: string[] = [];

    // Opportunity based on low-confidence outcomes
    const lowConfidenceOutcomes = outcomes.filter(o => o.confidence < 0.6);
    if (lowConfidenceOutcomes.length > 0) {
      opportunities.push('Improve learning methods to increase outcome confidence');
    }

    // Opportunity based on unapplied outcomes
    const unappliedOutcomes = outcomes.filter(o => !o.appliedToBehavior);
    if (unappliedOutcomes.length > outcomes.length * 0.3) {
      opportunities.push('Focus on applying learning outcomes to behavior');
    }

    // Opportunity based on activity types
    const activityTypes = new Set(activities.map(a => a.type));
    if (activityTypes.size < 3) {
      opportunities.push('Diversify learning activity types for better engagement');
    }

    return opportunities;
  }

  private calculateAverageConfidence(outcomes: LearningOutcome[]): number {
    if (outcomes.length === 0) return 0;
    return outcomes.reduce((sum, o) => sum + o.confidence, 0) / outcomes.length;
  }

  private calculateEffectivenessByType(outcomes: LearningOutcome[]): Record<LearningOutcomeType, number> {
    const effectivenessByType: Record<LearningOutcomeType, number> = {} as Record<LearningOutcomeType, number>;
    const outcomeTypes: LearningOutcomeType[] = ['knowledge_gained', 'skill_developed', 'behavior_changed', 'insight_discovered', 'pattern_recognized', 'strategy_learned'];
    
    for (const type of outcomeTypes) {
      const typeOutcomes = outcomes.filter(o => o.type === type);
      if (typeOutcomes.length > 0) {
        const avgConfidence = typeOutcomes.reduce((sum, o) => sum + o.confidence, 0) / typeOutcomes.length;
        const appliedRate = typeOutcomes.filter(o => o.appliedToBehavior).length / typeOutcomes.length;
        effectivenessByType[type] = (avgConfidence + appliedRate) / 2;
      } else {
        effectivenessByType[type] = 0;
      }
    }
    
    return effectivenessByType;
  }

  private generateActivityRecommendations(activities: LearningActivity[]): string[] {
    const recommendations: string[] = [];

    // Recommendation based on activity distribution
    const activityTypes = activities.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const readingCount = activityTypes.reading || 0;
    const practiceCount = activityTypes.practice || 0;

    if (readingCount > practiceCount * 2) {
      recommendations.push('Balance reading activities with more hands-on practice');
    }

    if (practiceCount === 0) {
      recommendations.push('Add practice activities to reinforce learning');
    }

    // Recommendation based on priority distribution
    const highPriorityCount = activities.filter(a => a.priority === ImprovementPriority.HIGH).length;
    const totalCount = activities.length;

    if (highPriorityCount > totalCount * 0.7) {
      recommendations.push('Consider reducing the number of high-priority activities to maintain focus');
    }

    return recommendations;
  }

  private generateEffectivenessRecommendations(outcomes: LearningOutcome[]): string[] {
    const recommendations: string[] = [];

    // Recommendation based on confidence distribution
    const avgConfidence = this.calculateAverageConfidence(outcomes);
    if (avgConfidence < 0.6) {
      recommendations.push('Focus on improving learning quality to increase confidence in outcomes');
    }

    // Recommendation based on behavior application
    const behaviorChangeRate = outcomes.length > 0 
      ? outcomes.filter(o => o.appliedToBehavior).length / outcomes.length 
      : 0;

    if (behaviorChangeRate < 0.5) {
      recommendations.push('Create specific action plans to apply learning outcomes to behavior');
    }

    return recommendations;
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

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // Convert entries to array to avoid iteration issues
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }
} 