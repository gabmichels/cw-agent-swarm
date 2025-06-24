import { z } from 'zod';
import { ulid } from 'ulid';
import type { WorkflowIntent } from './WorkflowIntentAnalyzer.js';
import type { WorkflowSearchService } from '../integrations/WorkflowSearchService.js';
import type { UserContextProvider } from './providers/UserContextProvider.js';
import type { DomainKnowledgeProvider } from './providers/DomainKnowledgeProvider.js';

// Recommendation types
export interface WorkflowRecommendation {
  id: string;
  workflowId: string;
  title: string;
  description: string;
  category: string;
  score: number;
  confidence: number;
  explanation: string;
  matchReasons: string[];
  setupComplexity: 'simple' | 'medium' | 'complex';
  estimatedSetupTime: string;
  requirements: WorkflowRequirement[];
  compatibility: CompatibilityInfo;
  customizationSuggestions: CustomizationSuggestion[];
  similarWorkflows: string[];
  popularityRank: number;
  userFitScore: number;
}

export interface WorkflowRequirement {
  type: 'api_key' | 'oauth' | 'webhook' | 'premium_account' | 'technical_setup';
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  documentation?: string;
  alternatives?: string[];
}

export interface CompatibilityInfo {
  sourceSystemMatch: number; // 0-1 score
  targetSystemMatch: number; // 0-1 score
  actionMatch: number; // 0-1 score
  userSkillMatch: number; // 0-1 score
  toolAvailabilityMatch: number; // 0-1 score
  overallCompatibility: number; // 0-1 score
}

export interface CustomizationSuggestion {
  type: 'parameter' | 'trigger' | 'filter' | 'action' | 'integration';
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
  reasoning: string;
}

export interface RecommendationContext {
  intent: WorkflowIntent;
  userProfile: UserProfile;
  sessionHistory: WorkflowSearchHistory[];
  availableIntegrations: string[];
  preferences: RecommendationPreferences;
}

export interface UserProfile {
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredComplexity: 'simple' | 'medium' | 'complex' | 'any';
  connectedServices: string[];
  pastWorkflows: string[];
  successfulSetups: number;
  failedSetups: number;
  averageSetupTime: number;
  domains: string[];
}

export interface WorkflowSearchHistory {
  query: string;
  intent: WorkflowIntent;
  selectedWorkflows: string[];
  dismissedWorkflows: string[];
  timestamp: Date;
  outcome: 'successful' | 'abandoned' | 'failed';
}

export interface RecommendationPreferences {
  prioritizeSimplicity: boolean;
  favorPopularWorkflows: boolean;
  includeExperimentalFeatures: boolean;
  maxSetupTime: number; // minutes
  requireDocumentation: boolean;
  avoidPremiumRequirements: boolean;
}

// Configuration
const RecommenderConfigSchema = z.object({
  maxRecommendations: z.number().min(1).max(20).default(5),
  minConfidenceScore: z.number().min(0).max(1).default(0.3),
  enablePersonalization: z.boolean().default(true),
  enableLearning: z.boolean().default(true),
  weightings: z.object({
    intentMatch: z.number().min(0).max(1).default(0.3),
    userFit: z.number().min(0).max(1).default(0.25),
    popularity: z.number().min(0).max(1).default(0.15),
    setupSimplicity: z.number().min(0).max(1).default(0.2),
    compatibility: z.number().min(0).max(1).default(0.1)
  }).default({}),
  cacheDurationMinutes: z.number().min(1).max(60).default(15)
});

export type RecommenderConfig = z.infer<typeof RecommenderConfigSchema>;

// Error classes
export class RecommendationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RecommendationError';
  }
}

export class InsufficientDataError extends RecommendationError {
  constructor(dataType: string) {
    super(
      `Insufficient data for ${dataType}`,
      'INSUFFICIENT_DATA',
      { dataType }
    );
  }
}

export class InvalidRecommendationContextError extends RecommendationError {
  constructor(reason: string) {
    super(
      `Invalid recommendation context: ${reason}`,
      'INVALID_CONTEXT',
      { reason }
    );
  }
}

// Interfaces
export interface IIntelligentWorkflowRecommender {
  generateRecommendations(context: RecommendationContext): Promise<WorkflowRecommendation[]>;
  scoreWorkflow(workflowId: string, context: RecommendationContext): Promise<number>;
  explainRecommendation(recommendation: WorkflowRecommendation): string;
  getCustomizationSuggestions(workflowId: string, intent: WorkflowIntent): Promise<CustomizationSuggestion[]>;
  updateUserFeedback(workflowId: string, feedback: 'positive' | 'negative' | 'neutral', context?: Record<string, unknown>): Promise<void>;
}

export interface IRecommendationCache {
  get(key: string): Promise<WorkflowRecommendation[] | null>;
  set(key: string, recommendations: WorkflowRecommendation[], expiryMinutes: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  cleanup(): Promise<number>;
}

// In-memory cache implementation
export class InMemoryRecommendationCache implements IRecommendationCache {
  private cache = new Map<string, { data: WorkflowRecommendation[]; expiry: Date }>();

  async get(key: string): Promise<WorkflowRecommendation[] | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiry <= new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  async set(key: string, recommendations: WorkflowRecommendation[], expiryMinutes: number): Promise<void> {
    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
    this.cache.set(key, { data: recommendations, expiry });
  }

  async invalidate(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Main implementation
export class IntelligentWorkflowRecommender implements IIntelligentWorkflowRecommender {
  private readonly config: RecommenderConfig;
  private readonly userFeedback = new Map<string, { positive: number; negative: number; neutral: number }>();

  constructor(
    private readonly searchService: WorkflowSearchService,
    private readonly userContextProvider: UserContextProvider,
    private readonly domainKnowledgeProvider: DomainKnowledgeProvider,
    private readonly cache: IRecommendationCache,
    config: Partial<RecommenderConfig> = {}
  ) {
    this.config = RecommenderConfigSchema.parse(config);
  }

  async generateRecommendations(context: RecommendationContext): Promise<WorkflowRecommendation[]> {
    try {
      this.validateRecommendationContext(context);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Search for candidate workflows
      const candidates = await this.searchCandidateWorkflows(context);
      
      if (candidates.length === 0) {
        throw new InsufficientDataError('workflow candidates');
      }
      
      // Score and rank workflows
      const scoredRecommendations = await Promise.all(
        candidates.map(workflow => this.createDetailedRecommendation(workflow, context))
      );
      
      // Filter by minimum confidence and sort by score
      const filteredRecommendations = scoredRecommendations
        .filter(rec => rec.confidence >= this.config.minConfidenceScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.config.maxRecommendations);
      
      // Cache the results
      await this.cache.set(cacheKey, filteredRecommendations, this.config.cacheDurationMinutes);
      
      return filteredRecommendations;
      
    } catch (error) {
      if (error instanceof RecommendationError) {
        throw error;
      }
      
      throw new RecommendationError(
        'Failed to generate recommendations',
        'GENERATION_ERROR',
        { originalError: error, context }
      );
    }
  }

  async scoreWorkflow(workflowId: string, context: RecommendationContext): Promise<number> {
    try {
      // Fetch workflow details
      const workflow = await this.getWorkflowDetails(workflowId);
      if (!workflow) {
        throw new RecommendationError('Workflow not found', 'WORKFLOW_NOT_FOUND', { workflowId });
      }
      
      // Calculate composite score
      const intentScore = this.calculateIntentMatchScore(workflow, context.intent);
      const userFitScore = this.calculateUserFitScore(workflow, context.userProfile);
      const popularityScore = this.calculatePopularityScore(workflow);
      const simplicityScore = this.calculateSimplicityScore(workflow, context.preferences);
      const compatibilityScore = this.calculateCompatibilityScore(workflow, context);
      
      // Apply weightings
      const weights = this.config.weightings;
      const finalScore = 
        intentScore * weights.intentMatch +
        userFitScore * weights.userFit +
        popularityScore * weights.popularity +
        simplicityScore * weights.setupSimplicity +
        compatibilityScore * weights.compatibility;
      
      return Math.min(finalScore, 1.0); // Cap at 1.0
      
    } catch (error) {
      throw new RecommendationError(
        'Failed to score workflow',
        'SCORING_ERROR',
        { workflowId, error }
      );
    }
  }

  explainRecommendation(recommendation: WorkflowRecommendation): string {
    const parts: string[] = [];
    
    parts.push(`**${recommendation.title}** (Score: ${(recommendation.score * 100).toFixed(0)}%)`);
    parts.push(`\n${recommendation.explanation}`);
    
    if (recommendation.matchReasons.length > 0) {
      parts.push(`\n**Why this matches:**`);
      recommendation.matchReasons.forEach(reason => {
        parts.push(`• ${reason}`);
      });
    }
    
    if (recommendation.requirements.length > 0) {
      parts.push(`\n**Requirements:**`);
      recommendation.requirements.forEach(req => {
        const difficulty = req.difficulty === 'easy' ? '🟢' : req.difficulty === 'medium' ? '🟡' : '🔴';
        parts.push(`${difficulty} ${req.description}`);
      });
    }
    
    if (recommendation.customizationSuggestions.length > 0) {
      parts.push(`\n**Customization suggestions:**`);
      recommendation.customizationSuggestions.slice(0, 3).forEach(suggestion => {
        parts.push(`• ${suggestion.suggestion}`);
      });
    }
    
    parts.push(`\n*Setup complexity: ${recommendation.setupComplexity} (~${recommendation.estimatedSetupTime})*`);
    
    return parts.join('\n');
  }

  async getCustomizationSuggestions(workflowId: string, intent: WorkflowIntent): Promise<CustomizationSuggestion[]> {
    try {
      const workflow = await this.getWorkflowDetails(workflowId);
      if (!workflow) {
        throw new RecommendationError('Workflow not found', 'WORKFLOW_NOT_FOUND', { workflowId });
      }
      
      const suggestions: CustomizationSuggestion[] = [];
      
      // Analyze workflow structure for customization opportunities
      suggestions.push(...this.generateParameterSuggestions(workflow, intent));
      suggestions.push(...this.generateTriggerSuggestions(workflow, intent));
      suggestions.push(...this.generateFilterSuggestions(workflow, intent));
      suggestions.push(...this.generateIntegrationSuggestions(workflow, intent));
      
      // Sort by impact and difficulty
      return suggestions.sort((a, b) => {
        const impactOrder = { high: 3, medium: 2, low: 1 };
        const difficultyOrder = { easy: 3, medium: 2, hard: 1 };
        
        const scoreA = impactOrder[a.impact] * difficultyOrder[a.difficulty];
        const scoreB = impactOrder[b.impact] * difficultyOrder[b.difficulty];
        
        return scoreB - scoreA;
      });
      
    } catch (error) {
      throw new RecommendationError(
        'Failed to generate customization suggestions',
        'CUSTOMIZATION_ERROR',
        { workflowId, error }
      );
    }
  }

  async updateUserFeedback(
    workflowId: string,
    feedback: 'positive' | 'negative' | 'neutral',
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Update feedback tracking
      const current = this.userFeedback.get(workflowId) || { positive: 0, negative: 0, neutral: 0 };
      current[feedback]++;
      this.userFeedback.set(workflowId, current);
      
      // Invalidate relevant cache entries
      await this.cache.invalidate(`.*${workflowId}.*`);
      
      // TODO: In production, this would update a persistent store
      // and potentially trigger recommendation model retraining
      
    } catch (error) {
      throw new RecommendationError(
        'Failed to update user feedback',
        'FEEDBACK_ERROR',
        { workflowId, feedback, error }
      );
    }
  }

  // Private helper methods
  private validateRecommendationContext(context: RecommendationContext): void {
    if (!context.intent) {
      throw new InvalidRecommendationContextError('Missing workflow intent');
    }
    
    if (!context.userProfile) {
      throw new InvalidRecommendationContextError('Missing user profile');
    }
    
    if (!context.preferences) {
      throw new InvalidRecommendationContextError('Missing recommendation preferences');
    }
  }

  private generateCacheKey(context: RecommendationContext): string {
    const keyData = {
      query: context.intent.originalQuery,
      action: context.intent.primaryIntent.action,
      sourceSystem: context.intent.extractedEntities.integrations[0] || undefined,
      targetSystem: context.intent.extractedEntities.integrations[1] || undefined,
      skillLevel: context.userProfile.skillLevel,
      connectedServices: context.userProfile.connectedServices.slice(0, 5).sort(),
      preferences: context.preferences
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  private async searchCandidateWorkflows(context: RecommendationContext): Promise<any[]> {
    const searchQuery = this.buildEnhancedSearchQuery(context);
    
    // Perform multiple searches with different strategies
    const searches = await Promise.all([
      // Primary search based on intent
      this.searchService.searchWorkflows({
        q: searchQuery,
        category: context.intent.primaryIntent.domain as any,
        limit: this.config.maxRecommendations * 3
      }),
      
      // Search based on user's connected services
      this.searchConnectedServicesWorkflows(context),
      
      // Search popular workflows in the same category
      this.searchPopularWorkflows(context)
    ]);
    
    // Combine and deduplicate results
    const allWorkflows = new Map();
    searches.forEach(result => {
      result.workflows.forEach((workflow: any) => {
        allWorkflows.set(workflow.id, workflow);
      });
    });
    
    return Array.from(allWorkflows.values());
  }

  private buildEnhancedSearchQuery(context: RecommendationContext): string {
    const queryParts: string[] = [];
    
    // Base intent information
    if (context.intent.extractedEntities.integrations[0]) queryParts.push(context.intent.extractedEntities.integrations[0]);
    if (context.intent.extractedEntities.integrations[1]) queryParts.push(context.intent.extractedEntities.integrations[1]);
    if (context.intent.primaryIntent.action !== 'other') queryParts.push(context.intent.primaryIntent.action);
    
    // Add user's connected services for broader matching
    context.userProfile.connectedServices.slice(0, 3).forEach(service => {
      if (!queryParts.includes(service)) {
        queryParts.push(service);
      }
    });
    
    // Add compatible integrations from intent
    if (context.intent.extractedEntities.integrations) {
      context.intent.extractedEntities.integrations.slice(0, 2).forEach(integration => {
        if (!queryParts.includes(integration)) {
          queryParts.push(integration);
        }
      });
    }
    
    return queryParts.join(' ');
  }

  private async searchConnectedServicesWorkflows(context: RecommendationContext): Promise<any> {
    const services = context.userProfile.connectedServices.slice(0, 5);
    if (services.length === 0) {
      return { workflows: [] };
    }
    
    return this.searchService.searchWorkflows({
      q: services.join(' '),
      limit: this.config.maxRecommendations
    });
  }

  private async searchPopularWorkflows(context: RecommendationContext): Promise<any> {
    const category = context.intent.primaryIntent.domain;
    if (!category) {
      return { workflows: [] };
    }
    
    return this.searchService.searchWorkflows({
      q: '',
      category: category as any,
      sortBy: 'popularity',
      limit: this.config.maxRecommendations
    });
  }

  private async createDetailedRecommendation(
    workflow: any,
    context: RecommendationContext
  ): Promise<WorkflowRecommendation> {
    const score = await this.scoreWorkflow(workflow.id, context);
    const compatibility = this.calculateDetailedCompatibility(workflow, context);
    const requirements = this.extractDetailedRequirements(workflow);
    const customizationSuggestions = await this.getCustomizationSuggestions(workflow.id, context.intent);
    
    return {
      id: ulid(),
      workflowId: workflow.id,
      title: workflow.title,
      description: workflow.description,
      category: workflow.category,
      score,
      confidence: this.calculateConfidence(workflow, context),
      explanation: this.generateRecommendationExplanation(workflow, context),
      matchReasons: this.generateMatchReasons(workflow, context),
      setupComplexity: this.determineSetupComplexity(workflow, context.userProfile),
      estimatedSetupTime: this.estimateSetupTime(workflow, context.userProfile),
      requirements,
      compatibility,
      customizationSuggestions: customizationSuggestions.slice(0, 5),
      similarWorkflows: workflow.similarWorkflows || [],
      popularityRank: workflow.popularityRank || 0,
      userFitScore: this.calculateUserFitScore(workflow, context.userProfile)
    };
  }

  private calculateIntentMatchScore(workflow: any, intent: WorkflowIntent): number {
    let score = 0;
    
    // Source system match
    if (intent.extractedEntities.integrations[0] && this.workflowIncludesSystem(workflow, intent.extractedEntities.integrations[0])) {
      score += 0.3;
    }
    
    // Target system match
    if (intent.extractedEntities.integrations[1] && this.workflowIncludesSystem(workflow, intent.extractedEntities.integrations[1])) {
      score += 0.3;
    }
    
    // Action match
    if (this.workflowMatchesAction(workflow, intent.primaryIntent.action)) {
      score += 0.2;
    }
    
    // Category match
    if (intent.primaryIntent.domain && workflow.category === intent.primaryIntent.domain) {
      score += 0.1;
    }
    
    // Compatible integrations
    if (intent.extractedEntities.integrations) {
      const matchingIntegrations = intent.extractedEntities.integrations.filter(integration =>
        this.workflowIncludesSystem(workflow, integration)
      );
      score += (matchingIntegrations.length / intent.extractedEntities.integrations.length) * 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateUserFitScore(workflow: any, userProfile: UserProfile): number {
    let score = 0;
    
    // Skill level compatibility
    const workflowComplexity = this.getWorkflowComplexity(workflow);
    const skillMatch = this.calculateSkillMatch(workflowComplexity, userProfile.skillLevel);
    score += skillMatch * 0.4;
    
    // Connected services match
    const connectedServicesMatch = this.calculateConnectedServicesMatch(workflow, userProfile.connectedServices);
    score += connectedServicesMatch * 0.3;
    
    // Domain experience
    const domainMatch = this.calculateDomainMatch(workflow, userProfile.domains);
    score += domainMatch * 0.2;
    
    // Success rate factor
    const successRateFactor = userProfile.successfulSetups / Math.max(userProfile.successfulSetups + userProfile.failedSetups, 1);
    score += successRateFactor * 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculatePopularityScore(workflow: any): number {
    const usageCount = workflow.usageCount || 0;
    const rating = workflow.averageRating || 0;
    const reviews = workflow.reviewCount || 0;
    
    // Normalize popularity metrics
    const usageScore = Math.min(usageCount / 1000, 1.0) * 0.5;
    const ratingScore = (rating / 5.0) * 0.3;
    const reviewScore = Math.min(reviews / 100, 1.0) * 0.2;
    
    return usageScore + ratingScore + reviewScore;
  }

  private calculateSimplicityScore(workflow: any, preferences: RecommendationPreferences): number {
    if (!preferences.prioritizeSimplicity) {
      return 0.5; // Neutral score if user doesn't prioritize simplicity
    }
    
    const complexity = this.getWorkflowComplexity(workflow);
    const nodeCount = workflow.nodeCount || 5;
    const requirementsCount = workflow.requirements?.length || 0;
    
    // Score based on simplicity factors
    let score = 0;
    
    if (complexity === 'simple') score += 0.5;
    else if (complexity === 'medium') score += 0.3;
    else score += 0.1;
    
    // Penalize high node count
    score += Math.max(0, (10 - nodeCount) / 10) * 0.3;
    
    // Penalize many requirements
    score += Math.max(0, (5 - requirementsCount) / 5) * 0.2;
    
    return Math.min(score, 1.0);
  }

  private calculateCompatibilityScore(workflow: any, context: RecommendationContext): number {
    const compatibility = this.calculateDetailedCompatibility(workflow, context);
    return compatibility.overallCompatibility;
  }

  private calculateDetailedCompatibility(workflow: any, context: RecommendationContext): CompatibilityInfo {
    const sourceSystemMatch = context.intent.extractedEntities.integrations[0] ? 
      (this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[0]) ? 1.0 : 0.0) : 0.5;
    
    const targetSystemMatch = context.intent.extractedEntities.integrations[1] ? 
      (this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[1]) ? 1.0 : 0.0) : 0.5;
    
    const actionMatch = this.workflowMatchesAction(workflow, context.intent.primaryIntent.action) ? 1.0 : 0.3;
    
    const userSkillMatch = this.calculateSkillMatch(
      this.getWorkflowComplexity(workflow),
      context.userProfile.skillLevel
    );
    
    const toolAvailabilityMatch = this.calculateConnectedServicesMatch(
      workflow,
      context.userProfile.connectedServices
    );
    
    const overallCompatibility = (
      sourceSystemMatch * 0.25 +
      targetSystemMatch * 0.25 +
      actionMatch * 0.2 +
      userSkillMatch * 0.15 +
      toolAvailabilityMatch * 0.15
    );
    
    return {
      sourceSystemMatch,
      targetSystemMatch,
      actionMatch,
      userSkillMatch,
      toolAvailabilityMatch,
      overallCompatibility
    };
  }

  private calculateConfidence(workflow: any, context: RecommendationContext): number {
    const factors = [
      this.calculateIntentMatchScore(workflow, context.intent),
      workflow.usageCount > 50 ? 0.2 : 0.1, // Usage confidence
      workflow.averageRating > 4.0 ? 0.2 : 0.1, // Rating confidence
      context.userProfile.connectedServices.length > 2 ? 0.1 : 0.05 // User data confidence
    ];
    
    return Math.min(factors.reduce((sum, factor) => sum + factor, 0), 1.0);
  }

  private generateRecommendationExplanation(workflow: any, context: RecommendationContext): string {
    const parts: string[] = [];
    
    if (context.intent.extractedEntities.integrations[0] && this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[0])) {
      parts.push(`integrates with ${context.intent.extractedEntities.integrations[0]}`);
    }
    
    if (context.intent.extractedEntities.integrations[1] && this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[1])) {
      parts.push(`connects to ${context.intent.extractedEntities.integrations[1]}`);
    }
    
    if (this.workflowMatchesAction(workflow, context.intent.primaryIntent.action)) {
      parts.push(`handles ${context.intent.primaryIntent.action} operations`);
    }
    
    const connectedServicesUsed = context.userProfile.connectedServices.filter(service =>
      this.workflowIncludesSystem(workflow, service)
    );
    
    if (connectedServicesUsed.length > 0) {
      parts.push(`works with your connected ${connectedServicesUsed.slice(0, 2).join(' and ')} account${connectedServicesUsed.length > 1 ? 's' : ''}`);
    }
    
    if (parts.length === 0) {
      return `This ${workflow.category} workflow might be useful for your automation needs.`;
    }
    
    return `Perfect match - ${parts.join(', ')}.`;
  }

  private generateMatchReasons(workflow: any, context: RecommendationContext): string[] {
    const reasons: string[] = [];
    
    // Intent-based reasons
    if (context.intent.extractedEntities.integrations[0] && this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[0])) {
      reasons.push(`Matches your source system: ${context.intent.extractedEntities.integrations[0]}`);
    }
    
    if (context.intent.extractedEntities.integrations[1] && this.workflowIncludesSystem(workflow, context.intent.extractedEntities.integrations[1])) {
      reasons.push(`Connects to your target system: ${context.intent.extractedEntities.integrations[1]}`);
    }
    
    if (this.workflowMatchesAction(workflow, context.intent.primaryIntent.action)) {
      reasons.push(`Handles ${context.intent.primaryIntent.action} operations`);
    }
    
    // User profile reasons
    const skillMatch = this.calculateSkillMatch(this.getWorkflowComplexity(workflow), context.userProfile.skillLevel);
    if (skillMatch > 0.8) {
      reasons.push(`Matches your ${context.userProfile.skillLevel} skill level`);
    }
    
    const connectedServicesUsed = context.userProfile.connectedServices.filter(service =>
      this.workflowIncludesSystem(workflow, service)
    ).slice(0, 2);
    
    if (connectedServicesUsed.length > 0) {
      reasons.push(`Uses your connected ${connectedServicesUsed.join(' and ')} account${connectedServicesUsed.length > 1 ? 's' : ''}`);
    }
    
    // Popularity reasons
    if (workflow.usageCount > 500) {
      reasons.push(`Popular workflow with ${workflow.usageCount}+ users`);
    }
    
    if (workflow.averageRating > 4.5) {
      reasons.push(`Highly rated (${workflow.averageRating}/5.0)`);
    }
    
    return reasons;
  }

  // Helper methods for workflow analysis
  private workflowIncludesSystem(workflow: any, systemName: string): boolean {
    const normalizedSystem = systemName.toLowerCase();
    const workflowText = `${workflow.title} ${workflow.description} ${(workflow.tags || []).join(' ')}`.toLowerCase();
    return workflowText.includes(normalizedSystem);
  }

  private workflowMatchesAction(workflow: any, action: string): boolean {
    if (action === 'other') return false;
    
    const actionKeywords: Record<string, string[]> = {
      sync: ['sync', 'synchronize', 'mirror', 'replicate'],
      notify: ['notify', 'alert', 'message', 'email', 'send'],
      backup: ['backup', 'archive', 'save', 'store'],
      monitor: ['monitor', 'watch', 'track', 'observe'],
      transform: ['transform', 'convert', 'process', 'format'],
      automate: ['automate', 'automatic', 'trigger', 'schedule']
    };
    
    const keywords = actionKeywords[action] || [action];
    const workflowText = `${workflow.title} ${workflow.description}`.toLowerCase();
    
    return keywords.some(keyword => workflowText.includes(keyword));
  }

  private getWorkflowComplexity(workflow: any): 'simple' | 'medium' | 'complex' {
    if (workflow.complexity) return workflow.complexity;
    
    const nodeCount = workflow.nodeCount || 5;
    const requirementsCount = workflow.requirements?.length || 0;
    
    if (nodeCount <= 3 && requirementsCount <= 1) return 'simple';
    if (nodeCount <= 8 && requirementsCount <= 3) return 'medium';
    return 'complex';
  }

  private calculateSkillMatch(workflowComplexity: 'simple' | 'medium' | 'complex', userSkill: 'beginner' | 'intermediate' | 'advanced'): number {
    const complexityScores = { simple: 1, medium: 2, complex: 3 };
    const skillScores = { beginner: 1, intermediate: 2, advanced: 3 };
    
    const complexityScore = complexityScores[workflowComplexity];
    const userScore = skillScores[userSkill];
    
    // Perfect match gets 1.0, each level difference reduces score
    const difference = Math.abs(complexityScore - userScore);
    return Math.max(0, 1.0 - (difference * 0.3));
  }

  private calculateConnectedServicesMatch(workflow: any, connectedServices: string[]): number {
    if (connectedServices.length === 0) return 0.5; // Neutral if no connected services
    
    const matchingServices = connectedServices.filter(service =>
      this.workflowIncludesSystem(workflow, service)
    );
    
    return matchingServices.length / Math.min(connectedServices.length, 5); // Cap at 5 services
  }

  private calculateDomainMatch(workflow: any, userDomains: string[]): number {
    if (userDomains.length === 0) return 0.5; // Neutral if no domain info
    
    const workflowCategory = workflow.category?.toLowerCase() || '';
    const matchingDomains = userDomains.filter(domain =>
      workflowCategory.includes(domain.toLowerCase())
    );
    
    return matchingDomains.length > 0 ? 1.0 : 0.3;
  }

  private determineSetupComplexity(workflow: any, userProfile: UserProfile): 'simple' | 'medium' | 'complex' {
    const baseComplexity = this.getWorkflowComplexity(workflow);
    
    // Adjust based on user skill level
    if (userProfile.skillLevel === 'advanced' && baseComplexity === 'complex') return 'medium';
    if (userProfile.skillLevel === 'beginner' && baseComplexity === 'medium') return 'complex';
    
    return baseComplexity;
  }

  private estimateSetupTime(workflow: any, userProfile: UserProfile): string {
    const baseTime = this.getBaseSetupTime(workflow);
    const skillMultiplier = userProfile.skillLevel === 'beginner' ? 1.5 :
                           userProfile.skillLevel === 'intermediate' ? 1.0 : 0.8;
    
    const adjustedTime = Math.round(baseTime * skillMultiplier);
    
    if (adjustedTime <= 15) return '15 minutes';
    if (adjustedTime <= 30) return '30 minutes';
    if (adjustedTime <= 60) return '1 hour';
    return '2+ hours';
  }

  private getBaseSetupTime(workflow: any): number {
    const complexity = this.getWorkflowComplexity(workflow);
    const nodeCount = workflow.nodeCount || 5;
    const requirementsCount = workflow.requirements?.length || 0;
    
    let baseTime = 0;
    
    // Base time by complexity
    if (complexity === 'simple') baseTime = 15;
    else if (complexity === 'medium') baseTime = 30;
    else baseTime = 60;
    
    // Add time for each node beyond basic workflow
    baseTime += Math.max(0, nodeCount - 3) * 5;
    
    // Add time for each requirement
    baseTime += requirementsCount * 10;
    
    return baseTime;
  }

  private extractDetailedRequirements(workflow: any): WorkflowRequirement[] {
    const requirements: WorkflowRequirement[] = [];
    
    // Extract from workflow metadata
    if (workflow.requirements) {
      workflow.requirements.forEach((req: any) => {
        if (typeof req === 'string') {
          requirements.push(this.parseRequirementString(req));
        } else {
          requirements.push(req);
        }
      });
    }
    
    // Infer from workflow content
    const workflowText = `${workflow.title} ${workflow.description} ${(workflow.tags || []).join(' ')}`.toLowerCase();
    
    if (workflowText.includes('api key') || workflowText.includes('api token')) {
      requirements.push({
        type: 'api_key',
        description: 'API key or token required',
        difficulty: 'medium',
        documentation: 'Check the service provider documentation for API access'
      });
    }
    
    if (workflowText.includes('oauth') || workflowText.includes('authentication')) {
      requirements.push({
        type: 'oauth',
        description: 'OAuth authentication setup required',
        difficulty: 'medium',
        documentation: 'Follow the OAuth setup guide in the workflow documentation'
      });
    }
    
    if (workflowText.includes('webhook')) {
      requirements.push({
        type: 'webhook',
        description: 'Webhook configuration required',
        difficulty: 'hard',
        documentation: 'Configure webhook endpoints according to the setup guide'
      });
    }
    
    if (workflowText.includes('premium') || workflowText.includes('paid') || workflowText.includes('pro')) {
      requirements.push({
        type: 'premium_account',
        description: 'Premium account required for some services',
        difficulty: 'easy',
        alternatives: ['Use free tier limitations', 'Consider alternative free services']
      });
    }
    
    return requirements;
  }

  private parseRequirementString(requirement: string): WorkflowRequirement {
    const lower = requirement.toLowerCase();
    
    if (lower.includes('api')) {
      return {
        type: 'api_key',
        description: requirement,
        difficulty: 'medium'
      };
    }
    
    if (lower.includes('webhook')) {
      return {
        type: 'webhook',
        description: requirement,
        difficulty: 'hard'
      };
    }
    
    if (lower.includes('premium') || lower.includes('paid')) {
      return {
        type: 'premium_account',
        description: requirement,
        difficulty: 'easy'
      };
    }
    
    return {
      type: 'technical_setup',
      description: requirement,
      difficulty: 'medium'
    };
  }

  private generateParameterSuggestions(workflow: any, intent: WorkflowIntent): CustomizationSuggestion[] {
    const suggestions: CustomizationSuggestion[] = [];
    
    // Suggest parameter customizations based on user intent
    if (intent.primaryIntent.action === 'sync' && intent.extractedEntities.integrations[0] && intent.extractedEntities.integrations[1]) {
      suggestions.push({
        type: 'parameter',
        suggestion: `Set sync frequency to match your ${intent.primaryIntent.action} needs`,
        impact: 'high',
        difficulty: 'easy',
        reasoning: `Frequency is crucial for ${intent.extractedEntities.integrations[0]} to ${intent.extractedEntities.integrations[1]} sync`
      });
    }
    
    if (intent.originalQuery.includes('schedule') || intent.originalQuery.includes('time')) {
      suggestions.push({
        type: 'parameter',
        suggestion: 'Configure custom scheduling parameters',
        impact: 'medium',
        difficulty: 'easy',
        reasoning: 'Your query indicates specific timing requirements'
      });
    }
    
    return suggestions;
  }

  private generateTriggerSuggestions(workflow: any, intent: WorkflowIntent): CustomizationSuggestion[] {
    const suggestions: CustomizationSuggestion[] = [];
    
    if (intent.primaryIntent.action === 'notify') {
      suggestions.push({
        type: 'trigger',
        suggestion: 'Add custom trigger conditions for notifications',
        impact: 'high',
        difficulty: 'medium',
        reasoning: 'Notifications should only trigger under specific conditions'
      });
    }
    
    return suggestions;
  }

  private generateFilterSuggestions(workflow: any, intent: WorkflowIntent): CustomizationSuggestion[] {
    const suggestions: CustomizationSuggestion[] = [];
    
    if (intent.extractedEntities.integrations[0] === 'salesforce' || intent.extractedEntities.integrations[1] === 'salesforce') {
      suggestions.push({
        type: 'filter',
        suggestion: 'Add filters for specific Salesforce record types',
        impact: 'medium',
        difficulty: 'medium',
        reasoning: 'Filter by opportunity stage, lead status, or custom fields'
      });
    }
    
    return suggestions;
  }

  private generateIntegrationSuggestions(workflow: any, intent: WorkflowIntent): CustomizationSuggestion[] {
    const suggestions: CustomizationSuggestion[] = [];
    
    if (intent.extractedEntities.integrations && intent.extractedEntities.integrations.length > 2) {
      suggestions.push({
        type: 'integration',
        suggestion: `Consider adding ${intent.extractedEntities.integrations[2]} integration for enhanced functionality`,
        impact: 'low',
        difficulty: 'hard',
        reasoning: 'Additional integrations can provide more comprehensive automation'
      });
    }
    
    return suggestions;
  }

  private async getWorkflowDetails(workflowId: string): Promise<any> {
    // In a real implementation, this would fetch from a workflow database
    // For now, we'll use the search service to get workflow details
    try {
      const result = await this.searchService.searchWorkflows({
        q: `id:${workflowId}`,
        limit: 1
      });
      
      return result.workflows[0] || null;
    } catch (error) {
      throw new RecommendationError(
        'Failed to fetch workflow details',
        'WORKFLOW_FETCH_ERROR',
        { workflowId, error }
      );
    }
  }
} 