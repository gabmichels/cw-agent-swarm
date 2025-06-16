import { SocialMediaProvider, SocialMediaCapability } from '../database/ISocialMediaDatabase';
import { SocialMediaContentGenerator, MarketInsight, ContentSuggestion, BrandVoice } from './SocialMediaContentGenerator';

export interface MarketTrend {
  id: string;
  title: string;
  description: string;
  confidence: number;
  relevanceScore: number;
  trendingScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  category: string;
  timeframe: 'hour' | 'day' | 'week' | 'month';
  sources: string[];
  createdAt: Date;
  expiresAt: Date;
}

export interface UserPreferences {
  industries: string[];
  topics: string[];
  contentTypes: string[];
  platforms: SocialMediaProvider[];
  postingFrequency: 'low' | 'medium' | 'high';
  brandVoice: BrandVoice;
  targetAudience: string;
}

export interface ContentOpportunity {
  trend: MarketTrend;
  contentIdea: string;
  suggestedPlatforms: SocialMediaProvider[];
  estimatedEngagement: number;
  urgency: number;
  reasoning: string;
  hashtags: string[];
  optimalPostTime: Date;
  competitorAnalysis?: {
    isBeingDiscussed: boolean;
    competitorCount: number;
    averageEngagement: number;
  };
}

export interface ProactiveContentSuggestion {
  id: string;
  agentId: string;
  opportunity: ContentOpportunity;
  generatedContent: {
    title: string;
    content: string;
    platforms: Record<string, {
      optimizedContent: string;
      hashtags: string[];
      estimatedReach: number;
    }>;
  };
  confidence: number;
  createdAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'posted';
}

export class TrendBasedContentSuggester {
  private contentGenerator: SocialMediaContentGenerator;
  private marketScannerEndpoint: string;

  constructor(contentGenerator: SocialMediaContentGenerator) {
    this.contentGenerator = contentGenerator;
    this.marketScannerEndpoint = process.env.MARKET_SCANNER_ENDPOINT || 'http://localhost:3000/api/market-scanner';
  }

  /**
   * Suggest content based on current market trends
   */
  async suggestContentFromTrends(
    marketTrends: MarketTrend[],
    agentCapabilities: SocialMediaCapability[],
    userPreferences: UserPreferences
  ): Promise<ContentSuggestion[]> {
    const suggestions: ContentSuggestion[] = [];
    
    for (const trend of marketTrends) {
      if (this.isTrendRelevant(trend, userPreferences)) {
        const contentIdea = await this.generateContentIdea(trend, userPreferences.brandVoice);
        
        const suggestion: ContentSuggestion = {
          content: contentIdea,
          platforms: this.selectOptimalPlatforms(trend, agentCapabilities, userPreferences.platforms),
          hashtags: await this.generateTrendHashtags(trend),
          estimatedEngagement: this.predictEngagement(trend, userPreferences),
          urgency: this.calculateUrgency(trend),
          reasoning: this.generateReasoning(trend, userPreferences),
          marketInsight: this.convertTrendToInsight(trend)
        };
        
        suggestions.push(suggestion);
      }
    }
    
    return suggestions.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Get real-time trending topics from market scanner
   */
  async getRealtimeTrends(
    categories: string[] = [],
    timeframe: 'hour' | 'day' | 'week' = 'day'
  ): Promise<MarketTrend[]> {
    try {
      const response = await fetch(`${this.marketScannerEndpoint}/trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categories,
          timeframe,
          limit: 50
        })
      });

      if (!response.ok) {
        throw new Error(`Market scanner API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.trends || [];
    } catch (error) {
      console.error('Failed to fetch real-time trends:', error);
      return this.getFallbackTrends();
    }
  }

  /**
   * Generate proactive content suggestions for an agent
   */
  async generateProactiveContentSuggestions(
    agentId: string,
    agentCapabilities: SocialMediaCapability[],
    userPreferences: UserPreferences
  ): Promise<ProactiveContentSuggestion[]> {
    // Get current trends
    const trends = await this.getRealtimeTrends(userPreferences.industries);
    
    // Filter and score trends
    const opportunities = await this.identifyContentOpportunities(trends, agentCapabilities, userPreferences);
    
    // Generate content for top opportunities
    const suggestions: ProactiveContentSuggestion[] = [];
    
    for (const opportunity of opportunities.slice(0, 5)) { // Top 5 opportunities
      const generatedContent = await this.generateContentForOpportunity(opportunity, userPreferences);
      
      suggestions.push({
        id: this.generateSuggestionId(),
        agentId,
        opportunity,
        generatedContent,
        confidence: this.calculateContentConfidence(opportunity, generatedContent),
        createdAt: new Date(),
        status: 'pending'
      });
    }
    
    return suggestions;
  }

  /**
   * Analyze competitor activity around trends
   */
  async analyzeCompetitorActivity(
    trend: MarketTrend,
    userPreferences: UserPreferences
  ): Promise<{
    isBeingDiscussed: boolean;
    competitorCount: number;
    averageEngagement: number;
    contentGaps: string[];
    opportunities: string[];
  }> {
    try {
      const response = await fetch(`${this.marketScannerEndpoint}/competitor-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trend: trend.title,
          keywords: trend.keywords,
          industry: userPreferences.industries[0],
          timeframe: trend.timeframe
        })
      });

      if (!response.ok) {
        throw new Error(`Competitor analysis API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('Failed to analyze competitor activity:', error);
      return {
        isBeingDiscussed: false,
        competitorCount: 0,
        averageEngagement: 0,
        contentGaps: [],
        opportunities: ['First-mover advantage', 'Unique perspective opportunity']
      };
    }
  }

  /**
   * Predict optimal posting times based on trend lifecycle
   */
  async predictOptimalPostingTime(
    trend: MarketTrend,
    platforms: SocialMediaProvider[]
  ): Promise<Date> {
    const now = new Date();
    const trendAge = now.getTime() - trend.createdAt.getTime();
    const trendLifespan = trend.expiresAt.getTime() - trend.createdAt.getTime();
    const trendProgress = trendAge / trendLifespan;
    
    // If trend is very new (< 10% of lifecycle), post immediately
    if (trendProgress < 0.1) {
      return new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    }
    
    // If trend is in growth phase (10-50%), post within optimal hours
    if (trendProgress < 0.5) {
      const optimalHour = this.getOptimalHourForPlatforms(platforms);
      const nextOptimalTime = this.getNextOptimalTime(optimalHour);
      return nextOptimalTime;
    }
    
    // If trend is mature (50-80%), post soon to catch remaining momentum
    if (trendProgress < 0.8) {
      return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    }
    
    // If trend is declining (>80%), consider if it's worth posting
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow (lower priority)
  }

  /**
   * Generate content performance predictions
   */
  async predictContentPerformance(
    content: string,
    platforms: SocialMediaProvider[],
    trend: MarketTrend,
    userPreferences: UserPreferences
  ): Promise<Record<string, {
    estimatedReach: number;
    estimatedEngagement: number;
    viralPotential: number;
    confidence: number;
  }>> {
    const predictions: Record<string, any> = {};
    
    for (const platform of platforms) {
      const baseReach = this.getBaseReachForPlatform(platform);
      const trendMultiplier = this.getTrendMultiplier(trend, platform);
      const contentQuality = this.assessContentQuality(content, platform);
      
      predictions[platform] = {
        estimatedReach: Math.round(baseReach * trendMultiplier * contentQuality),
        estimatedEngagement: Math.round(baseReach * trendMultiplier * contentQuality * 0.05),
        viralPotential: this.calculateViralPotential(trend, platform, contentQuality),
        confidence: this.calculatePredictionConfidence(trend, platform)
      };
    }
    
    return predictions;
  }

  // Private helper methods

  private isTrendRelevant(trend: MarketTrend, userPreferences: UserPreferences): boolean {
    // Check if trend matches user's industries or topics
    const industryMatch = userPreferences.industries.some(industry => 
      trend.keywords.some(keyword => keyword.toLowerCase().includes(industry.toLowerCase()))
    );
    
    const topicMatch = userPreferences.topics.some(topic =>
      trend.title.toLowerCase().includes(topic.toLowerCase()) ||
      trend.description.toLowerCase().includes(topic.toLowerCase())
    );
    
    // Check trend quality thresholds
    const qualityThreshold = trend.confidence > 0.6 && trend.relevanceScore > 0.5;
    
    return (industryMatch || topicMatch) && qualityThreshold;
  }

  private async generateContentIdea(trend: MarketTrend, brandVoice: BrandVoice): Promise<string> {
    const templates = {
      professional: `Industry insight: ${trend.title} is reshaping our sector. Key implications include ${trend.keywords.slice(0, 3).join(', ')}.`,
      casual: `Just saw this about ${trend.title} - pretty interesting stuff! ${trend.description}`,
      friendly: `Hey everyone! Wanted to share thoughts on ${trend.title}. What's your take on this trend?`,
      authoritative: `Analysis: ${trend.title} represents a significant development. Our assessment shows ${trend.description}`,
      humorous: `${trend.title} got me thinking... ${trend.description} (and yes, I have thoughts about this! 😄)`,
      inspirational: `${trend.title} reminds us that innovation never stops. Every trend is an opportunity to learn and grow.`
    };
    
    return templates[brandVoice.tone] || templates.professional;
  }

  private selectOptimalPlatforms(
    trend: MarketTrend,
    agentCapabilities: SocialMediaCapability[],
    availablePlatforms: SocialMediaProvider[]
  ): SocialMediaProvider[] {
    const platformScores: Record<SocialMediaProvider, number> = {
      [SocialMediaProvider.TWITTER]: 0,
      [SocialMediaProvider.LINKEDIN]: 0,
      [SocialMediaProvider.FACEBOOK]: 0,
      [SocialMediaProvider.INSTAGRAM]: 0,
      [SocialMediaProvider.REDDIT]: 0,
      [SocialMediaProvider.TIKTOK]: 0
    };
    
    // Score based on trend characteristics
    if (trend.category === 'business' || trend.category === 'technology') {
      platformScores[SocialMediaProvider.LINKEDIN] += 0.8;
      platformScores[SocialMediaProvider.TWITTER] += 0.7;
    }
    
    if (trend.trendingScore > 0.8) {
      platformScores[SocialMediaProvider.TWITTER] += 0.9;
      platformScores[SocialMediaProvider.TIKTOK] += 0.8;
    }
    
    if (trend.category === 'entertainment' || trend.category === 'lifestyle') {
      platformScores[SocialMediaProvider.INSTAGRAM] += 0.9;
      platformScores[SocialMediaProvider.TIKTOK] += 0.8;
    }
    
    // Filter by available platforms and capabilities
    return availablePlatforms
      .filter(platform => this.hasRequiredCapabilities(platform, agentCapabilities))
      .sort((a, b) => platformScores[b] - platformScores[a])
      .slice(0, 3);
  }

  private async generateTrendHashtags(trend: MarketTrend): Promise<string[]> {
    const hashtags = [...trend.keywords];
    
    // Add trend-specific hashtags
    hashtags.push(trend.title.replace(/\s+/g, ''));
    hashtags.push('Trending');
    
    // Add category hashtags
    if (trend.category) {
      hashtags.push(trend.category.charAt(0).toUpperCase() + trend.category.slice(1));
    }
    
    return hashtags.slice(0, 8);
  }

  private predictEngagement(trend: MarketTrend, userPreferences: UserPreferences): number {
    const baseEngagement = 100; // Base engagement score
    const trendMultiplier = trend.trendingScore * 2;
    const relevanceMultiplier = trend.relevanceScore * 1.5;
    const confidenceMultiplier = trend.confidence;
    
    return Math.round(baseEngagement * trendMultiplier * relevanceMultiplier * confidenceMultiplier);
  }

  private calculateUrgency(trend: MarketTrend): number {
    const now = new Date();
    const trendAge = now.getTime() - trend.createdAt.getTime();
    const trendLifespan = trend.expiresAt.getTime() - trend.createdAt.getTime();
    const timeRemaining = (trendLifespan - trendAge) / trendLifespan;
    
    return Math.round(trend.trendingScore * timeRemaining * 100);
  }

  private generateReasoning(trend: MarketTrend, userPreferences: UserPreferences): string {
    const reasons = [];
    
    if (trend.trendingScore > 0.8) {
      reasons.push('High trending score indicates viral potential');
    }
    
    if (trend.relevanceScore > 0.7) {
      reasons.push('Highly relevant to your industry');
    }
    
    if (trend.confidence > 0.8) {
      reasons.push('High confidence trend prediction');
    }
    
    const industryMatch = userPreferences.industries.some(industry => 
      trend.keywords.some(keyword => keyword.toLowerCase().includes(industry.toLowerCase()))
    );
    
    if (industryMatch) {
      reasons.push('Matches your industry focus');
    }
    
    return reasons.join(', ');
  }

  private convertTrendToInsight(trend: MarketTrend): MarketInsight {
    return {
      topic: trend.title,
      summary: trend.description,
      relevanceScore: trend.relevanceScore,
      trendingScore: trend.trendingScore,
      sentiment: trend.sentiment,
      keywords: trend.keywords,
      sources: trend.sources
    };
  }

  private async identifyContentOpportunities(
    trends: MarketTrend[],
    agentCapabilities: SocialMediaCapability[],
    userPreferences: UserPreferences
  ): Promise<ContentOpportunity[]> {
    const opportunities: ContentOpportunity[] = [];
    
    for (const trend of trends) {
      if (this.isTrendRelevant(trend, userPreferences)) {
        const competitorAnalysis = await this.analyzeCompetitorActivity(trend, userPreferences);
        
        opportunities.push({
          trend,
          contentIdea: await this.generateContentIdea(trend, userPreferences.brandVoice),
          suggestedPlatforms: this.selectOptimalPlatforms(trend, agentCapabilities, userPreferences.platforms),
          estimatedEngagement: this.predictEngagement(trend, userPreferences),
          urgency: this.calculateUrgency(trend),
          reasoning: this.generateReasoning(trend, userPreferences),
          hashtags: await this.generateTrendHashtags(trend),
          optimalPostTime: await this.predictOptimalPostingTime(trend, userPreferences.platforms),
          competitorAnalysis
        });
      }
    }
    
    return opportunities.sort((a, b) => b.urgency - a.urgency);
  }

  private async generateContentForOpportunity(
    opportunity: ContentOpportunity,
    userPreferences: UserPreferences
  ): Promise<any> {
    const platformContent: Record<string, any> = {};
    
    for (const platform of opportunity.suggestedPlatforms) {
      const optimizedContent = await this.contentGenerator.optimizeForPlatform(
        opportunity.contentIdea,
        platform,
        userPreferences.brandVoice,
        true
      );
      
      const performance = await this.predictContentPerformance(
        optimizedContent.content,
        [platform],
        opportunity.trend,
        userPreferences
      );
      
      platformContent[platform] = {
        optimizedContent: optimizedContent.content,
        hashtags: [...optimizedContent.hashtags, ...opportunity.hashtags],
        estimatedReach: performance[platform]?.estimatedReach || 0
      };
    }
    
    return {
      title: opportunity.trend.title,
      content: opportunity.contentIdea,
      platforms: platformContent
    };
  }

  private getFallbackTrends(): MarketTrend[] {
    // Return some default trends when API is unavailable
    return [
      {
        id: 'fallback-1',
        title: 'AI Innovation in Business',
        description: 'Artificial intelligence continues to transform business operations',
        confidence: 0.8,
        relevanceScore: 0.7,
        trendingScore: 0.6,
        sentiment: 'positive',
        keywords: ['AI', 'innovation', 'business', 'automation'],
        category: 'technology',
        timeframe: 'week',
        sources: ['tech-news'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  private hasRequiredCapabilities(platform: SocialMediaProvider, capabilities: SocialMediaCapability[]): boolean {
    const requiredCapabilities = [SocialMediaCapability.POST_CREATE];
    
    if (platform === SocialMediaProvider.TIKTOK) {
      requiredCapabilities.push(SocialMediaCapability.TIKTOK_VIDEO_CREATE);
    }
    
    return requiredCapabilities.every(cap => capabilities.includes(cap));
  }

  private getOptimalHourForPlatforms(platforms: SocialMediaProvider[]): number {
    const optimalHours = {
      [SocialMediaProvider.TWITTER]: 9,
      [SocialMediaProvider.LINKEDIN]: 8,
      [SocialMediaProvider.FACEBOOK]: 15,
      [SocialMediaProvider.INSTAGRAM]: 11,
      [SocialMediaProvider.REDDIT]: 10,
      [SocialMediaProvider.TIKTOK]: 18
    };
    
    const hours = platforms.map(p => optimalHours[p]);
    return Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
  }

  private getNextOptimalTime(hour: number): Date {
    const now = new Date();
    const nextOptimal = new Date();
    nextOptimal.setHours(hour, 0, 0, 0);
    
    if (nextOptimal <= now) {
      nextOptimal.setDate(nextOptimal.getDate() + 1);
    }
    
    return nextOptimal;
  }

  private getBaseReachForPlatform(platform: SocialMediaProvider): number {
    const baseReach = {
      [SocialMediaProvider.TWITTER]: 1000,
      [SocialMediaProvider.LINKEDIN]: 500,
      [SocialMediaProvider.FACEBOOK]: 800,
      [SocialMediaProvider.INSTAGRAM]: 1200,
      [SocialMediaProvider.REDDIT]: 600,
      [SocialMediaProvider.TIKTOK]: 2000
    };
    
    return baseReach[platform] || 500;
  }

  private getTrendMultiplier(trend: MarketTrend, platform: SocialMediaProvider): number {
    return 1 + (trend.trendingScore * 2);
  }

  private assessContentQuality(content: string, platform: SocialMediaProvider): number {
    // Simple content quality assessment
    let score = 0.5; // Base score
    
    if (content.length > 50) score += 0.2;
    if (content.includes('?')) score += 0.1; // Questions increase engagement
    if (content.includes('#')) score += 0.1; // Hashtags help discovery
    if (content.includes('!')) score += 0.1; // Excitement
    
    return Math.min(score, 1.0);
  }

  private calculateViralPotential(trend: MarketTrend, platform: SocialMediaProvider, contentQuality: number): number {
    return Math.round(trend.trendingScore * contentQuality * 100);
  }

  private calculatePredictionConfidence(trend: MarketTrend, platform: SocialMediaProvider): number {
    return Math.round(trend.confidence * 100);
  }

  private calculateContentConfidence(opportunity: ContentOpportunity, generatedContent: any): number {
    const trendConfidence = opportunity.trend.confidence;
    const platformCount = opportunity.suggestedPlatforms.length;
    const contentQuality = Object.keys(generatedContent.platforms).length > 0 ? 0.8 : 0.5;
    
    return Math.round(trendConfidence * (platformCount / 3) * contentQuality * 100);
  }

  private generateSuggestionId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 