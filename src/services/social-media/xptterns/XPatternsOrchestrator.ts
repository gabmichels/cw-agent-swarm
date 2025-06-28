/**
 * XPatternsOrchestrator.ts - Multi-Platform Social Media Orchestration Engine
 * 
 * Implements the "xPtterns" approach for intelligent multi-platform social media management.
 * Handles content adaptation, cross-platform scheduling, real-time optimization, and 
 * coordinated campaigns across Twitter, LinkedIn, Instagram, TikTok, Facebook, and Reddit.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - Interface-first design with dependency injection
 * - Strict TypeScript typing with ULID IDs
 * - Comprehensive error handling and logging
 * - Test-first development approach
 */

import { ulid } from 'ulid';
import {
  SocialMediaProvider,
  SocialMediaCapability,
  SocialMediaConnection,
  AccessLevel
} from '../database/ISocialMediaDatabase';
import {
  ISocialMediaProvider,
  PostCreationParams,
  SocialMediaPost,
  ContentAnalysis,
  OptimizedContent,
  AccountAnalytics,
  PostMetrics
} from '../providers/base/ISocialMediaProvider';
import { SocialMediaCommandType } from '../integration/SocialMediaNLP';

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface XPatternsConfig {
  enableIntelligentAdaptation: boolean;
  enableCrossPlatformCoordination: boolean;
  enableRealTimeOptimization: boolean;
  enableAudienceTargeting: boolean;
  enablePerformanceTracking: boolean;
  maxConcurrentPosts: number;
  retryAttempts: number;
  adaptationStrategies: PlatformAdaptationStrategy[];
}

export interface PlatformAdaptationStrategy {
  platform: SocialMediaProvider;
  maxLength: number;
  hashtagLimit: number;
  mentionLimit: number;
  mediaLimit: number;
  toneAdjustment: 'professional' | 'casual' | 'creative' | 'technical';
  contentOptimizations: string[];
}

export interface CrossPlatformCampaign {
  id: string;
  name: string;
  description: string;
  baseContent: string;
  targetPlatforms: SocialMediaProvider[];
  scheduledTime?: Date;
  adaptedContent: Map<SocialMediaProvider, AdaptedContent>;
  coordinationStrategy: CoordinationStrategy;
  performanceTargets: PerformanceTargets;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface AdaptedContent {
  platform: SocialMediaProvider;
  content: string;
  hashtags: string[];
  mentions: string[];
  media: string[];
  adaptationReason: string;
  optimizationScore: number;
  estimatedPerformance: EstimatedPerformance;
}

export interface CoordinationStrategy {
  type: 'simultaneous' | 'staggered' | 'sequential' | 'conditional';
  timing: CoordinationTiming;
  dependencies: PlatformDependency[];
  fallbackStrategy: string;
}

export interface CoordinationTiming {
  primaryPlatform?: SocialMediaProvider;
  intervals: Map<SocialMediaProvider, number>; // Minutes between posts
  conditions: TriggerCondition[];
}

export interface PlatformDependency {
  platform: SocialMediaProvider;
  dependsOn: SocialMediaProvider;
  condition: 'success' | 'engagement_threshold' | 'time_delay';
  threshold?: number;
}

export interface TriggerCondition {
  type: 'engagement_rate' | 'view_count' | 'time_elapsed' | 'manual_approval';
  platform?: SocialMediaProvider;
  threshold: number;
  action: 'proceed' | 'pause' | 'adapt' | 'cancel';
}

export interface PerformanceTargets {
  totalReach: number;
  engagementRate: number;
  platformSpecific: Map<SocialMediaProvider, PlatformTarget>;
}

export interface PlatformTarget {
  platform: SocialMediaProvider;
  expectedViews: number;
  expectedEngagement: number;
  priority: 'high' | 'medium' | 'low';
}

export interface EstimatedPerformance {
  platform: SocialMediaProvider;
  expectedViews: number;
  expectedLikes: number;
  expectedShares: number;
  expectedComments: number;
  engagementRate: number;
  confidence: number;
}

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface XPatternsExecutionResult {
  campaignId: string;
  success: boolean;
  platformResults: Map<SocialMediaProvider, PlatformExecutionResult>;
  totalReach: number;
  totalEngagement: number;
  performanceScore: number;
  adaptationsMade: AdaptationRecord[];
  coordinationEvents: CoordinationEvent[];
  errors: XPatternsError[];
  executionTime: number;
  metadata: Record<string, unknown>;
}

export interface PlatformExecutionResult {
  platform: SocialMediaProvider;
  success: boolean;
  postId?: string;
  platformPostId?: string;
  url?: string;
  actualPerformance?: PostMetrics;
  adaptationsApplied: string[];
  error?: string;
  executionTime: number;
}

export interface AdaptationRecord {
  id: string;
  platform: SocialMediaProvider;
  originalContent: string;
  adaptedContent: string;
  adaptationType: 'length' | 'tone' | 'hashtags' | 'media' | 'timing';
  reason: string;
  improvementScore: number;
  timestamp: Date;
}

export interface CoordinationEvent {
  id: string;
  type: 'platform_posted' | 'threshold_met' | 'dependency_satisfied' | 'fallback_triggered';
  platform: SocialMediaProvider;
  timestamp: Date;
  data: Record<string, unknown>;
  nextActions: string[];
}

export class XPatternsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly platform?: SocialMediaProvider,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'XPatternsError';
  }
}

// ============================================================================
// PLATFORM-SPECIFIC CONFIGURATIONS
// ============================================================================

export const DEFAULT_PLATFORM_STRATEGIES: Map<SocialMediaProvider, PlatformAdaptationStrategy> = new Map([
  [SocialMediaProvider.TWITTER, {
    platform: SocialMediaProvider.TWITTER,
    maxLength: 280,
    hashtagLimit: 3,
    mentionLimit: 5,
    mediaLimit: 4,
    toneAdjustment: 'casual',
    contentOptimizations: ['brevity', 'trending_hashtags', 'engagement_hooks', 'thread_splitting']
  }],
  [SocialMediaProvider.LINKEDIN, {
    platform: SocialMediaProvider.LINKEDIN,
    maxLength: 3000,
    hashtagLimit: 5,
    mentionLimit: 10,
    mediaLimit: 9,
    toneAdjustment: 'professional',
    contentOptimizations: ['professional_tone', 'industry_hashtags', 'thought_leadership', 'call_to_action']
  }],
  [SocialMediaProvider.INSTAGRAM, {
    platform: SocialMediaProvider.INSTAGRAM,
    maxLength: 2200,
    hashtagLimit: 30,
    mentionLimit: 20,
    mediaLimit: 10,
    toneAdjustment: 'creative',
    contentOptimizations: ['visual_focus', 'story_telling', 'lifestyle_hashtags', 'influencer_style']
  }],
  [SocialMediaProvider.TIKTOK, {
    platform: SocialMediaProvider.TIKTOK,
    maxLength: 150,
    hashtagLimit: 5,
    mentionLimit: 5,
    mediaLimit: 1,
    toneAdjustment: 'creative',
    contentOptimizations: ['trending_sounds', 'viral_hashtags', 'short_form', 'entertainment_focus']
  }],
  [SocialMediaProvider.FACEBOOK, {
    platform: SocialMediaProvider.FACEBOOK,
    maxLength: 63206,
    hashtagLimit: 10,
    mentionLimit: 50,
    mediaLimit: 10,
    toneAdjustment: 'casual',
    contentOptimizations: ['community_focus', 'longer_content', 'discussion_starters', 'local_hashtags']
  }],
  [SocialMediaProvider.REDDIT, {
    platform: SocialMediaProvider.REDDIT,
    maxLength: 40000,
    hashtagLimit: 0, // Reddit doesn't use hashtags
    mentionLimit: 3,
    mediaLimit: 20,
    toneAdjustment: 'technical',
    contentOptimizations: ['detailed_explanations', 'community_rules', 'authentic_voice', 'value_driven']
  }]
]);

// ============================================================================
// MAIN ORCHESTRATOR CLASS
// ============================================================================

export interface IXPatternsOrchestrator {
  // Campaign Management
  createCampaign(params: CreateCampaignParams): Promise<CrossPlatformCampaign>;
  updateCampaign(campaignId: string, updates: Partial<CrossPlatformCampaign>): Promise<CrossPlatformCampaign>;
  deleteCampaign(campaignId: string): Promise<void>;
  getCampaign(campaignId: string): Promise<CrossPlatformCampaign>;
  listCampaigns(filters?: CampaignFilters): Promise<CrossPlatformCampaign[]>;

  // Content Adaptation
  adaptContent(content: string, targetPlatforms: SocialMediaProvider[]): Promise<Map<SocialMediaProvider, AdaptedContent>>;
  optimizeForPlatform(content: string, platform: SocialMediaProvider): Promise<AdaptedContent>;

  // Execution
  executeCampaign(campaignId: string, agentId: string): Promise<XPatternsExecutionResult>;
  executeImmediatePost(content: string, platforms: SocialMediaProvider[], agentId: string): Promise<XPatternsExecutionResult>;

  // Performance Tracking
  trackCampaignPerformance(campaignId: string): Promise<CampaignPerformanceReport>;
  getCrossPlatformAnalytics(timeframe: string): Promise<CrossPlatformAnalytics>;

  // Real-time Optimization
  optimizeCampaignInProgress(campaignId: string): Promise<OptimizationRecommendations>;

  // Configuration
  updateConfig(config: Partial<XPatternsConfig>): Promise<void>;
  getPlatformStrategies(): Map<SocialMediaProvider, PlatformAdaptationStrategy>;
  updatePlatformStrategy(platform: SocialMediaProvider, strategy: PlatformAdaptationStrategy): Promise<void>;
}

export interface CreateCampaignParams {
  name: string;
  description: string;
  baseContent: string;
  targetPlatforms: SocialMediaProvider[];
  scheduledTime?: Date;
  coordinationStrategy?: Partial<CoordinationStrategy>;
  performanceTargets?: Partial<PerformanceTargets>;
  metadata?: Record<string, unknown>;
}

export interface CampaignFilters {
  status?: CampaignStatus[];
  platforms?: SocialMediaProvider[];
  dateRange?: { start: Date; end: Date };
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CampaignPerformanceReport {
  campaignId: string;
  totalReach: number;
  totalEngagement: number;
  platformBreakdown: Map<SocialMediaProvider, PlatformPerformance>;
  performanceScore: number;
  targetAchievement: number;
  recommendations: string[];
  generatedAt: Date;
}

export interface PlatformPerformance {
  platform: SocialMediaProvider;
  reach: number;
  engagement: number;
  metrics: PostMetrics;
  vsTarget: number;
  trends: PerformanceTrend[];
}

export interface PerformanceTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number;
  significance: 'low' | 'medium' | 'high';
}

export interface CrossPlatformAnalytics {
  timeframe: string;
  totalCampaigns: number;
  successRate: number;
  platformPerformance: Map<SocialMediaProvider, PlatformAnalytics>;
  topPerformingContent: ContentPerformance[];
  insights: AnalyticsInsight[];
  recommendations: string[];
}

export interface PlatformAnalytics {
  platform: SocialMediaProvider;
  totalPosts: number;
  avgEngagement: number;
  topPerformingPosts: string[];
  growthMetrics: GrowthMetrics;
}

export interface GrowthMetrics {
  followerGrowth: number;
  engagementGrowth: number;
  reachGrowth: number;
  period: string;
}

export interface ContentPerformance {
  content: string;
  platforms: SocialMediaProvider[];
  totalEngagement: number;
  avgEngagementRate: number;
  bestPlatform: SocialMediaProvider;
}

export interface AnalyticsInsight {
  type: 'trend' | 'opportunity' | 'warning' | 'success';
  title: string;
  description: string;
  platforms: SocialMediaProvider[];
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface OptimizationRecommendations {
  campaignId: string;
  recommendations: Recommendation[];
  estimatedImprovement: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  generatedAt: Date;
}

export interface Recommendation {
  id: string;
  type: 'content' | 'timing' | 'platform' | 'targeting';
  title: string;
  description: string;
  platform?: SocialMediaProvider;
  estimatedImpact: number;
  effort: 'low' | 'medium' | 'high';
  actionable: boolean;
}

export class XPatternsOrchestrator implements IXPatternsOrchestrator {
  private config: XPatternsConfig;
  private platformStrategies: Map<SocialMediaProvider, PlatformAdaptationStrategy>;
  private providers: Map<SocialMediaProvider, ISocialMediaProvider>;
  private campaigns: Map<string, CrossPlatformCampaign> = new Map();
  private executionQueue: Map<string, Promise<XPatternsExecutionResult>> = new Map();

  constructor(
    config: XPatternsConfig,
    providers: Map<SocialMediaProvider, ISocialMediaProvider>
  ) {
    this.config = config;
    this.providers = providers;
    this.platformStrategies = new Map(DEFAULT_PLATFORM_STRATEGIES);

    // Override with custom strategies from config
    if (config.adaptationStrategies) {
      config.adaptationStrategies.forEach(strategy => {
        this.platformStrategies.set(strategy.platform, strategy);
      });
    }
  }

  // ============================================================================
  // CAMPAIGN MANAGEMENT
  // ============================================================================

  async createCampaign(params: CreateCampaignParams): Promise<CrossPlatformCampaign> {
    const campaignId = ulid();

    // Adapt content for all target platforms
    const adaptedContent = await this.adaptContent(params.baseContent, params.targetPlatforms);

    // Set default coordination strategy
    const defaultCoordination: CoordinationStrategy = {
      type: 'simultaneous',
      timing: {
        intervals: new Map(),
        conditions: []
      },
      dependencies: [],
      fallbackStrategy: 'proceed_independently'
    };

    // Set default performance targets
    const defaultTargets: PerformanceTargets = {
      totalReach: 1000,
      engagementRate: 0.05,
      platformSpecific: new Map()
    };

    const campaign: CrossPlatformCampaign = {
      id: campaignId,
      name: params.name,
      description: params.description,
      baseContent: params.baseContent,
      targetPlatforms: params.targetPlatforms,
      scheduledTime: params.scheduledTime,
      adaptedContent,
      coordinationStrategy: { ...defaultCoordination, ...params.coordinationStrategy },
      performanceTargets: { ...defaultTargets, ...params.performanceTargets },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: params.metadata || {}
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  async updateCampaign(campaignId: string, updates: Partial<CrossPlatformCampaign>): Promise<CrossPlatformCampaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new XPatternsError('Campaign not found', 'CAMPAIGN_NOT_FOUND', undefined, { campaignId });
    }

    const updatedCampaign: CrossPlatformCampaign = {
      ...campaign,
      ...updates,
      id: campaignId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    // Re-adapt content if base content changed
    if (updates.baseContent && updates.baseContent !== campaign.baseContent) {
      updatedCampaign.adaptedContent = await this.adaptContent(
        updates.baseContent,
        updatedCampaign.targetPlatforms
      );
    }

    this.campaigns.set(campaignId, updatedCampaign);
    return updatedCampaign;
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new XPatternsError('Campaign not found', 'CAMPAIGN_NOT_FOUND', undefined, { campaignId });
    }

    // Cancel if in progress
    if (campaign.status === 'in_progress') {
      // TODO: Implement cancellation logic
      campaign.status = 'cancelled';
    }

    this.campaigns.delete(campaignId);
  }

  async getCampaign(campaignId: string): Promise<CrossPlatformCampaign> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new XPatternsError('Campaign not found', 'CAMPAIGN_NOT_FOUND', undefined, { campaignId });
    }
    return campaign;
  }

  async listCampaigns(filters?: CampaignFilters): Promise<CrossPlatformCampaign[]> {
    let campaigns = Array.from(this.campaigns.values());

    if (filters) {
      if (filters.status) {
        campaigns = campaigns.filter(c => filters.status!.includes(c.status));
      }
      if (filters.platforms) {
        campaigns = campaigns.filter(c =>
          c.targetPlatforms.some(p => filters.platforms!.includes(p))
        );
      }
      if (filters.dateRange) {
        campaigns = campaigns.filter(c =>
          c.createdAt >= filters.dateRange!.start && c.createdAt <= filters.dateRange!.end
        );
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        campaigns = campaigns.filter(c =>
          c.name.toLowerCase().includes(searchLower) ||
          c.description.toLowerCase().includes(searchLower) ||
          c.baseContent.toLowerCase().includes(searchLower)
        );
      }
      if (filters.offset) {
        campaigns = campaigns.slice(filters.offset);
      }
      if (filters.limit) {
        campaigns = campaigns.slice(0, filters.limit);
      }
    }

    return campaigns;
  }

  // ============================================================================
  // CONTENT ADAPTATION
  // ============================================================================

  async adaptContent(
    content: string,
    targetPlatforms: SocialMediaProvider[]
  ): Promise<Map<SocialMediaProvider, AdaptedContent>> {
    const adaptedContent = new Map<SocialMediaProvider, AdaptedContent>();

    for (const platform of targetPlatforms) {
      const adapted = await this.optimizeForPlatform(content, platform);
      adaptedContent.set(platform, adapted);
    }

    return adaptedContent;
  }

  async optimizeForPlatform(content: string, platform: SocialMediaProvider): Promise<AdaptedContent> {
    const strategy = this.platformStrategies.get(platform);
    if (!strategy) {
      throw new XPatternsError(
        `No adaptation strategy found for platform: ${platform}`,
        'STRATEGY_NOT_FOUND',
        platform
      );
    }

    const provider = this.providers.get(platform);
    let optimizedContent = content;
    let adaptationReason = 'Platform optimization applied';
    const adaptationReasons: string[] = [];

    // Length optimization
    if (content.length > strategy.maxLength) {
      optimizedContent = this.truncateContent(content, strategy.maxLength);
      adaptationReasons.push(`Truncated to ${strategy.maxLength} characters`);
    }

    // Tone adjustment
    optimizedContent = this.adjustTone(optimizedContent, strategy.toneAdjustment);
    adaptationReasons.push(`Adjusted tone to ${strategy.toneAdjustment}`);

    // Extract and optimize hashtags
    const hashtags = this.extractHashtags(optimizedContent, strategy.hashtagLimit);

    // Extract mentions
    const mentions = this.extractMentions(optimizedContent, strategy.mentionLimit);

    // Platform-specific optimizations
    for (const optimization of strategy.contentOptimizations) {
      optimizedContent = await this.applyOptimization(optimizedContent, optimization, platform);
      adaptationReasons.push(`Applied ${optimization}`);
    }

    // Get performance estimation if provider supports it
    let estimatedPerformance: EstimatedPerformance = {
      platform,
      expectedViews: 100,
      expectedLikes: 5,
      expectedShares: 1,
      expectedComments: 1,
      engagementRate: 0.05,
      confidence: 0.7
    };

    if (provider) {
      try {
        const analysis = await provider.analyzeContent(optimizedContent);
        estimatedPerformance = {
          platform,
          expectedViews: analysis.estimatedReach || 100,
          expectedLikes: Math.round((analysis.estimatedReach || 100) * analysis.engagementPrediction),
          expectedShares: Math.round((analysis.estimatedReach || 100) * analysis.engagementPrediction * 0.2),
          expectedComments: Math.round((analysis.estimatedReach || 100) * analysis.engagementPrediction * 0.1),
          engagementRate: analysis.engagementPrediction,
          confidence: analysis.readabilityScore / 100
        };
      } catch (error) {
        // Use default estimation if provider analysis fails
        console.warn(`Content analysis failed for ${platform}:`, error);
      }
    }

    return {
      platform,
      content: optimizedContent,
      hashtags,
      mentions,
      media: [], // TODO: Implement media optimization
      adaptationReason: adaptationReasons.join('; '),
      optimizationScore: this.calculateOptimizationScore(content, optimizedContent, strategy),
      estimatedPerformance
    };
  }

  // ============================================================================
  // EXECUTION
  // ============================================================================

  async executeCampaign(campaignId: string, agentId: string): Promise<XPatternsExecutionResult> {
    const startTime = Date.now();
    const campaign = await this.getCampaign(campaignId);

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new XPatternsError(
        `Cannot execute campaign with status: ${campaign.status}`,
        'INVALID_CAMPAIGN_STATUS',
        undefined,
        { campaignId, status: campaign.status }
      );
    }

    // Update campaign status
    campaign.status = 'in_progress';
    await this.updateCampaign(campaignId, { status: 'in_progress' });

    const platformResults = new Map<SocialMediaProvider, PlatformExecutionResult>();
    const adaptationsMade: AdaptationRecord[] = [];
    const coordinationEvents: CoordinationEvent[] = [];
    const errors: XPatternsError[] = [];

    try {
      // Execute based on coordination strategy
      switch (campaign.coordinationStrategy.type) {
        case 'simultaneous':
          await this.executeSimultaneous(campaign, agentId, platformResults, errors);
          break;
        case 'staggered':
          await this.executeStaggered(campaign, agentId, platformResults, coordinationEvents, errors);
          break;
        case 'sequential':
          await this.executeSequential(campaign, agentId, platformResults, coordinationEvents, errors);
          break;
        case 'conditional':
          await this.executeConditional(campaign, agentId, platformResults, coordinationEvents, errors);
          break;
      }

      // Calculate performance metrics
      const totalReach = Array.from(platformResults.values())
        .reduce((sum, result) => sum + (result.actualPerformance?.reach || 0), 0);

      const totalEngagement = Array.from(platformResults.values())
        .reduce((sum, result) => sum + (result.actualPerformance?.likes || 0) +
          (result.actualPerformance?.shares || 0) + (result.actualPerformance?.comments || 0), 0);

      const performanceScore = this.calculatePerformanceScore(campaign, platformResults);

      // Update campaign status
      const finalStatus: CampaignStatus = errors.length === 0 ? 'completed' :
        platformResults.size > 0 ? 'completed' : 'failed';

      await this.updateCampaign(campaignId, { status: finalStatus });

      return {
        campaignId,
        success: errors.length === 0,
        platformResults,
        totalReach,
        totalEngagement,
        performanceScore,
        adaptationsMade,
        coordinationEvents,
        errors,
        executionTime: Date.now() - startTime,
        metadata: {
          agentId,
          executedAt: new Date(),
          coordinationStrategy: campaign.coordinationStrategy.type
        }
      };

    } catch (error) {
      // Update campaign status to failed
      await this.updateCampaign(campaignId, { status: 'failed' });

      throw new XPatternsError(
        `Campaign execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXECUTION_FAILED',
        undefined,
        { campaignId, agentId, error: error instanceof Error ? error.message : error }
      );
    }
  }

  async executeImmediatePost(
    content: string,
    platforms: SocialMediaProvider[],
    agentId: string
  ): Promise<XPatternsExecutionResult> {
    // Create temporary campaign for immediate execution
    const campaign = await this.createCampaign({
      name: `Immediate Post - ${ulid()}`,
      description: 'Immediate cross-platform post',
      baseContent: content,
      targetPlatforms: platforms,
      coordinationStrategy: { type: 'simultaneous' }
    });

    return this.executeCampaign(campaign.id, agentId);
  }

  // ============================================================================
  // EXECUTION STRATEGIES
  // ============================================================================

  private async executeSimultaneous(
    campaign: CrossPlatformCampaign,
    agentId: string,
    platformResults: Map<SocialMediaProvider, PlatformExecutionResult>,
    errors: XPatternsError[]
  ): Promise<void> {
    const promises = campaign.targetPlatforms.map(platform =>
      this.executeOnPlatform(campaign, platform, agentId)
    );

    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const platform = campaign.targetPlatforms[index];
      if (result.status === 'fulfilled') {
        platformResults.set(platform, result.value);
      } else {
        const error = new XPatternsError(
          `Failed to post on ${platform}: ${result.reason}`,
          'PLATFORM_EXECUTION_FAILED',
          platform,
          { campaignId: campaign.id, reason: result.reason }
        );
        errors.push(error);

        platformResults.set(platform, {
          platform,
          success: false,
          error: error.message,
          adaptationsApplied: [],
          executionTime: 0
        });
      }
    });
  }

  private async executeStaggered(
    campaign: CrossPlatformCampaign,
    agentId: string,
    platformResults: Map<SocialMediaProvider, PlatformExecutionResult>,
    coordinationEvents: CoordinationEvent[],
    errors: XPatternsError[]
  ): Promise<void> {
    const intervals = campaign.coordinationStrategy.timing.intervals;

    for (const platform of campaign.targetPlatforms) {
      try {
        const result = await this.executeOnPlatform(campaign, platform, agentId);
        platformResults.set(platform, result);

        coordinationEvents.push({
          id: ulid(),
          type: 'platform_posted',
          platform,
          timestamp: new Date(),
          data: { postId: result.postId },
          nextActions: []
        });

        // Wait for interval before next platform
        const interval = intervals.get(platform) || 0;
        if (interval > 0) {
          await new Promise(resolve => setTimeout(resolve, interval * 60 * 1000));
        }

      } catch (error) {
        const xpError = new XPatternsError(
          `Failed to post on ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'PLATFORM_EXECUTION_FAILED',
          platform,
          { campaignId: campaign.id, error }
        );
        errors.push(xpError);

        platformResults.set(platform, {
          platform,
          success: false,
          error: xpError.message,
          adaptationsApplied: [],
          executionTime: 0
        });
      }
    }
  }

  private async executeSequential(
    campaign: CrossPlatformCampaign,
    agentId: string,
    platformResults: Map<SocialMediaProvider, PlatformExecutionResult>,
    coordinationEvents: CoordinationEvent[],
    errors: XPatternsError[]
  ): Promise<void> {
    const dependencies = campaign.coordinationStrategy.dependencies;
    const executed = new Set<SocialMediaProvider>();

    // Execute platforms in dependency order
    while (executed.size < campaign.targetPlatforms.length) {
      let progressMade = false;

      for (const platform of campaign.targetPlatforms) {
        if (executed.has(platform)) continue;

        // Check if dependencies are satisfied
        const dependency = dependencies.find(d => d.platform === platform);
        if (dependency && !executed.has(dependency.dependsOn)) {
          continue; // Wait for dependency
        }

        try {
          const result = await this.executeOnPlatform(campaign, platform, agentId);
          platformResults.set(platform, result);
          executed.add(platform);
          progressMade = true;

          coordinationEvents.push({
            id: ulid(),
            type: 'platform_posted',
            platform,
            timestamp: new Date(),
            data: { postId: result.postId },
            nextActions: []
          });

        } catch (error) {
          const xpError = new XPatternsError(
            `Failed to post on ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'PLATFORM_EXECUTION_FAILED',
            platform,
            { campaignId: campaign.id, error }
          );
          errors.push(xpError);
          executed.add(platform); // Mark as attempted to avoid infinite loop
          progressMade = true;
        }
      }

      if (!progressMade) {
        throw new XPatternsError(
          'Sequential execution deadlock detected',
          'EXECUTION_DEADLOCK',
          undefined,
          { campaignId: campaign.id, dependencies }
        );
      }
    }
  }

  private async executeConditional(
    campaign: CrossPlatformCampaign,
    agentId: string,
    platformResults: Map<SocialMediaProvider, PlatformExecutionResult>,
    coordinationEvents: CoordinationEvent[],
    errors: XPatternsError[]
  ): Promise<void> {
    // TODO: Implement conditional execution based on performance triggers
    // For now, fall back to sequential execution
    await this.executeSequential(campaign, agentId, platformResults, coordinationEvents, errors);
  }

  private async executeOnPlatform(
    campaign: CrossPlatformCampaign,
    platform: SocialMediaProvider,
    agentId: string
  ): Promise<PlatformExecutionResult> {
    const startTime = Date.now();
    const provider = this.providers.get(platform);

    if (!provider) {
      throw new XPatternsError(
        `No provider available for platform: ${platform}`,
        'PROVIDER_NOT_AVAILABLE',
        platform
      );
    }

    const adaptedContent = campaign.adaptedContent.get(platform);
    if (!adaptedContent) {
      throw new XPatternsError(
        `No adapted content found for platform: ${platform}`,
        'CONTENT_NOT_ADAPTED',
        platform
      );
    }

    // TODO: Get connection ID for agent on this platform
    const connectionId = 'mock-connection-id'; // This should come from agent permissions

    const postParams: PostCreationParams = {
      content: adaptedContent.content,
      hashtags: adaptedContent.hashtags,
      mentions: adaptedContent.mentions,
      visibility: 'public'
    };

    if (campaign.scheduledTime) {
      postParams.scheduledTime = campaign.scheduledTime;
    }

    const post = await provider.createPost(connectionId, postParams);

    return {
      platform,
      success: true,
      postId: post.id,
      platformPostId: post.platformPostId,
      url: post.url,
      adaptationsApplied: [adaptedContent.adaptationReason],
      executionTime: Date.now() - startTime
    };
  }

  // ============================================================================
  // PERFORMANCE TRACKING
  // ============================================================================

  async trackCampaignPerformance(campaignId: string): Promise<CampaignPerformanceReport> {
    const campaign = await this.getCampaign(campaignId);

    // TODO: Implement real performance tracking
    return {
      campaignId,
      totalReach: 0,
      totalEngagement: 0,
      platformBreakdown: new Map(),
      performanceScore: 0,
      targetAchievement: 0,
      recommendations: [],
      generatedAt: new Date()
    };
  }

  async getCrossPlatformAnalytics(timeframe: string): Promise<CrossPlatformAnalytics> {
    // TODO: Implement cross-platform analytics
    return {
      timeframe,
      totalCampaigns: this.campaigns.size,
      successRate: 0.85,
      platformPerformance: new Map(),
      topPerformingContent: [],
      insights: [],
      recommendations: []
    };
  }

  async optimizeCampaignInProgress(campaignId: string): Promise<OptimizationRecommendations> {
    // TODO: Implement real-time optimization
    return {
      campaignId,
      recommendations: [],
      estimatedImprovement: 0,
      implementationComplexity: 'low',
      generatedAt: new Date()
    };
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  async updateConfig(config: Partial<XPatternsConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  getPlatformStrategies(): Map<SocialMediaProvider, PlatformAdaptationStrategy> {
    return new Map(this.platformStrategies);
  }

  async updatePlatformStrategy(
    platform: SocialMediaProvider,
    strategy: PlatformAdaptationStrategy
  ): Promise<void> {
    this.platformStrategies.set(platform, strategy);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Try to truncate at word boundary
    const truncated = content.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  private adjustTone(content: string, tone: PlatformAdaptationStrategy['toneAdjustment']): string {
    // TODO: Implement AI-powered tone adjustment
    // For now, return content as-is
    return content;
  }

  private extractHashtags(content: string, limit: number): string[] {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags.slice(0, limit);
  }

  private extractMentions(content: string, limit: number): string[] {
    const mentions = content.match(/@\w+/g) || [];
    return mentions.slice(0, limit);
  }

  private async applyOptimization(
    content: string,
    optimization: string,
    platform: SocialMediaProvider
  ): Promise<string> {
    // TODO: Implement specific optimizations
    switch (optimization) {
      case 'brevity':
        return content; // Already handled in truncation
      case 'trending_hashtags':
        return content; // TODO: Add trending hashtags
      case 'professional_tone':
        return content; // TODO: AI tone adjustment
      default:
        return content;
    }
  }

  private calculateOptimizationScore(
    original: string,
    optimized: string,
    strategy: PlatformAdaptationStrategy
  ): number {
    let score = 0.7; // Base score

    // Length optimization
    if (optimized.length <= strategy.maxLength) {
      score += 0.1;
    }

    // Hashtag optimization
    const hashtags = this.extractHashtags(optimized, strategy.hashtagLimit);
    if (hashtags.length > 0 && hashtags.length <= strategy.hashtagLimit) {
      score += 0.1;
    }

    // Content improvement
    if (optimized !== original) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private calculatePerformanceScore(
    campaign: CrossPlatformCampaign,
    platformResults: Map<SocialMediaProvider, PlatformExecutionResult>
  ): number {
    const successfulPlatforms = Array.from(platformResults.values()).filter(r => r.success).length;
    const totalPlatforms = campaign.targetPlatforms.length;

    return totalPlatforms > 0 ? successfulPlatforms / totalPlatforms : 0;
  }
} 