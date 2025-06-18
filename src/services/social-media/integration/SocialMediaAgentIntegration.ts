import { SocialMediaService } from '../SocialMediaService';
import { PrismaSocialMediaDatabase } from '../database/PrismaSocialMediaDatabase';
import { SocialMediaAgentTools } from '../tools/SocialMediaAgentTools';
import { SocialMediaNLP, ConversationContext } from './SocialMediaNLP';
import { SocialMediaContentGenerator, BrandVoice, ContentGenerationParams } from './SocialMediaContentGenerator';
import { TrendBasedContentSuggester, UserPreferences, ProactiveContentSuggestion } from './TrendBasedContentSuggester';
import { SocialMediaProvider, SocialMediaCapability } from '../database/ISocialMediaDatabase';

export interface SocialMediaAgentConfig {
  agentId: string;
  connectionIds: string[];
  brandVoice: BrandVoice;
  userPreferences: UserPreferences;
  capabilities: SocialMediaCapability[];
}

export interface ProcessingResult {
  success: boolean;
  data?: unknown;
  error?: string;
  intent?: {
    type: string;
    confidence: number;
    reasoning: string;
  };
  suggestions?: ProactiveContentSuggestion[];
  executionTime: number;
}

/**
 * Main integration class that orchestrates all social media agent capabilities
 * This is the primary interface for agents to interact with social media functionality
 */
export class SocialMediaAgentIntegration {
  private socialMediaService: SocialMediaService;
  private database: PrismaSocialMediaDatabase;
  private agentTools: SocialMediaAgentTools;
  private nlpProcessor: SocialMediaNLP;
  private contentGenerator: SocialMediaContentGenerator;
  private trendSuggester: TrendBasedContentSuggester;

  constructor(
    socialMediaService: SocialMediaService,
    database: PrismaSocialMediaDatabase
  ) {
    this.socialMediaService = socialMediaService;
    this.database = database;
    this.agentTools = new SocialMediaAgentTools(socialMediaService, database);
    this.nlpProcessor = new SocialMediaNLP();
    this.contentGenerator = new SocialMediaContentGenerator();
    this.trendSuggester = new TrendBasedContentSuggester(this.contentGenerator);
  }

  /**
   * Main entry point for processing social media input from agents
   */
  async processSocialMediaInput(
    agentId: string,
    userMessage: string,
    connectionIds: string[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      // Build conversation context
      const context = await this.buildAgentContext(agentId, connectionIds);
      
      // Parse command
      const command = this.nlpProcessor.parseCommand(userMessage, context);
      
      if (!command || command.type === 'unknown') {
        // No direct social media intent detected, check for proactive suggestions
        const suggestions = await this.generateProactiveSuggestions(agentId, context);
        
        return {
          success: false,
          error: 'No social media command detected in the message',
          suggestions,
          executionTime: Date.now() - startTime
        };
      }

      // Process the detected intent
      const result = await this.agentTools.processUserInput(agentId, userMessage, connectionIds);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        intent: {
          type: command.type,
          confidence: command.confidence,
          reasoning: command.intent
        },
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate content suggestions based on current trends
   */
  async generateContentSuggestions(
    agentId: string,
    topic?: string,
    platforms?: SocialMediaProvider[]
  ): Promise<ProactiveContentSuggestion[]> {
    try {
      const context = await this.buildAgentContext(agentId, []);
      const userPreferences = await this.getUserPreferences(agentId);
      
      if (topic) {
        // Generate content for specific topic
        const contentParams: ContentGenerationParams = {
          topic,
          platforms: platforms || userPreferences.platforms,
          brandVoice: userPreferences.brandVoice,
          includeHashtags: true,
          includeCallToAction: true,
          targetAudience: userPreferences.targetAudience
        };
        
        const generatedContent = await this.contentGenerator.generateContent(contentParams);
        
        // Convert to suggestion format
        return [{
          id: this.generateSuggestionId(),
          agentId,
          opportunity: {
            trend: {
              id: 'manual-topic',
              title: topic,
              description: `Content generation for topic: ${topic}`,
              confidence: 0.8,
              relevanceScore: 0.9,
              trendingScore: 0.5,
              sentiment: 'neutral' as const,
              keywords: topic.split(' '),
              category: 'manual',
              timeframe: 'day' as const,
              sources: ['user-request'],
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            },
            contentIdea: generatedContent.baseContent,
            suggestedPlatforms: platforms || userPreferences.platforms,
            estimatedEngagement: 150,
            urgency: 50,
            reasoning: 'User-requested content generation',
            hashtags: generatedContent.suggestedHashtags,
            optimalPostTime: new Date(Date.now() + 60 * 60 * 1000)
          },
          generatedContent: {
            title: topic,
            content: generatedContent.baseContent,
            platforms: Object.entries(generatedContent.platformContent).reduce((acc, [platform, data]) => {
              acc[platform] = {
                optimizedContent: data.content,
                hashtags: data.hashtags,
                estimatedReach: data.characterCount // Using characterCount as proxy for reach
              };
              return acc;
            }, {} as Record<string, { optimizedContent: string; hashtags: string[]; estimatedReach: number; }>)
          },
          confidence: 80,
          createdAt: new Date(),
          status: 'pending' as const
        }];
      } else {
        // Generate trend-based suggestions
        return await this.trendSuggester.generateProactiveContentSuggestions(
          agentId,
          context.agentCapabilities,
          userPreferences
        );
      }
    } catch (error) {
      console.error('Failed to generate content suggestions:', error);
      return [];
    }
  }

  /**
   * Execute a specific social media tool
   */
  async executeSocialMediaTool(
    toolName: string,
    parameters: Record<string, unknown>,
    agentId: string,
    connectionIds: string[]
  ): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const result = await this.agentTools.executeTool(toolName, parameters, agentId, connectionIds);
      
      return {
        success: result.success,
        data: result.data,
        error: result.error,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get available social media tools for an agent
   */
  async getAvailableTools(agentId: string): Promise<Array<{
    name: string;
    description: string;
    parameters: any;
    capabilities: SocialMediaCapability[];
  }>> {
    return await this.agentTools.getAvailableTools(agentId);
  }

  /**
   * Analyze current trends and suggest optimal posting strategy
   */
  async analyzePostingStrategy(
    agentId: string,
    timeframe: 'day' | 'week' = 'week'
  ): Promise<{
    optimalTimes: Record<string, { hour: number; day: string }>;
    trendingTopics: string[];
    contentGaps: string[];
    recommendations: string[];
  }> {
    try {
      const userPreferences = await this.getUserPreferences(agentId);
      const trends = await this.trendSuggester.getRealtimeTrends(userPreferences.industries, timeframe);
      
      const optimalTimes = await this.contentGenerator.getOptimalPostTimes(userPreferences.platforms);
      const trendingTopics = trends.slice(0, 10).map(t => t.title);
      
      return {
        optimalTimes,
        trendingTopics,
        contentGaps: ['Video content', 'Interactive posts', 'User-generated content'],
        recommendations: [
          'Increase posting frequency during peak hours',
          'Focus on trending topics in your industry',
          'Engage more with audience comments',
          'Experiment with different content formats'
        ]
      };
    } catch (error) {
      console.error('Failed to analyze posting strategy:', error);
      return {
        optimalTimes: {},
        trendingTopics: [],
        contentGaps: [],
        recommendations: []
      };
    }
  }

  /**
   * Get social media performance analytics
   */
  async getPerformanceAnalytics(
    agentId: string,
    connectionIds: string[],
    timeframe: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    totalPosts: number;
    totalEngagement: number;
    averageEngagement: number;
    topPerformingPosts: Array<{
      id: string;
      platform: string;
      content: string;
      engagement: number;
    }>;
    platformBreakdown: Record<string, {
      posts: number;
      engagement: number;
      reach: number;
    }>;
  }> {
    try {
      // TODO: Implement getAggregatedAnalytics method in SocialMediaService
      const analytics = {
        totalPosts: 0,
        totalEngagement: 0,
        averageEngagement: 0,
        topPosts: [],
        platformBreakdown: {}
      };

      return {
        totalPosts: analytics.totalPosts || 0,
        totalEngagement: analytics.totalEngagement || 0,
        averageEngagement: analytics.averageEngagement || 0,
        topPerformingPosts: analytics.topPosts || [],
        platformBreakdown: analytics.platformBreakdown || {}
      };
    } catch (error) {
      console.error('Failed to get performance analytics:', error);
      return {
        totalPosts: 0,
        totalEngagement: 0,
        averageEngagement: 0,
        topPerformingPosts: [],
        platformBreakdown: {}
      };
    }
  }

  // Private helper methods

  private async buildAgentContext(agentId: string, connectionIds: string[]): Promise<ConversationContext> {
    const permissions = await this.database.getAgentPermissions(agentId);
    const connections = await Promise.all(
      connectionIds.map(id => this.database.getConnection(id))
    );

    return {
      previousMessages: [], // Would be populated from conversation history
      currentTopic: '', // Would be determined from context
      userGoals: [], // Would be extracted from user preferences
      availableConnections: connections.filter(conn => conn !== null).map(conn => ({
        id: conn!.id,
        provider: conn!.provider,
        accountDisplayName: conn!.accountDisplayName
      })),
      agentCapabilities: permissions.flatMap(p => p.capabilities)
    };
  }

  private async generateProactiveSuggestions(
    agentId: string,
    context: ConversationContext
  ): Promise<ProactiveContentSuggestion[]> {
    try {
      const userPreferences = await this.getUserPreferences(agentId);
      
      return await this.trendSuggester.generateProactiveContentSuggestions(
        agentId,
        context.agentCapabilities,
        userPreferences
      );
    } catch (error) {
      console.error('Failed to generate proactive suggestions:', error);
      return [];
    }
  }

  private async getUserPreferences(agentId: string): Promise<UserPreferences> {
    // This would typically fetch from user preferences or agent configuration
    // For now, return default preferences
    return {
      industries: ['technology', 'business'],
      topics: ['innovation', 'AI', 'automation'],
      contentTypes: ['educational', 'promotional', 'engaging'],
      platforms: [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN],
      postingFrequency: 'medium',
      brandVoice: {
        tone: 'professional',
        description: 'Professional and informative with a focus on industry insights',
        keywords: ['innovation', 'technology', 'business'],
        avoidWords: ['controversial', 'political']
      },
      targetAudience: 'business professionals and technology enthusiasts'
    };
  }

  private generateSuggestionId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 