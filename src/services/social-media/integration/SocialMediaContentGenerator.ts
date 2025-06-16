import { SocialMediaProvider, SocialMediaCapability } from '../database/ISocialMediaDatabase';

export interface BrandVoice {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'humorous' | 'inspirational';
  description: string;
  keywords: string[];
  avoidWords: string[];
}

export interface ContentGenerationParams {
  topic: string;
  platforms: SocialMediaProvider[];
  brandVoice: BrandVoice;
  includeHashtags: boolean;
  includeCallToAction: boolean;
  targetAudience?: string;
  contentLength?: 'short' | 'medium' | 'long';
  urgency?: 'low' | 'medium' | 'high';
}

export interface PlatformOptimizedContent {
  baseContent: string;
  platformContent: Record<string, {
    content: string;
    hashtags: string[];
    characterCount: number;
    optimizations: string[];
  }>;
  suggestedHashtags: string[];
  optimalPostTimes: Record<string, {
    bestHour: number;
    bestDay: string;
    timezone: string;
  }>;
}

export interface MarketInsight {
  topic: string;
  summary: string;
  relevanceScore: number;
  trendingScore: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  sources: string[];
}

export interface ContentSuggestion {
  content: string;
  platforms: SocialMediaProvider[];
  hashtags: string[];
  estimatedEngagement: number;
  urgency: number;
  reasoning: string;
  marketInsight?: MarketInsight;
}

export class SocialMediaContentGenerator {
  private platformLimits: Record<SocialMediaProvider, number> = {
    [SocialMediaProvider.TWITTER]: 280,
    [SocialMediaProvider.LINKEDIN]: 3000,
    [SocialMediaProvider.FACEBOOK]: 63206,
    [SocialMediaProvider.INSTAGRAM]: 2200,
    [SocialMediaProvider.REDDIT]: 40000,
    [SocialMediaProvider.TIKTOK]: 2200
  };

  private platformTones: Record<SocialMediaProvider, string[]> = {
    [SocialMediaProvider.TWITTER]: ['casual', 'news-worthy', 'conversational'],
    [SocialMediaProvider.LINKEDIN]: ['professional', 'thought-leadership', 'industry-focused'],
    [SocialMediaProvider.FACEBOOK]: ['community-oriented', 'personal', 'engaging'],
    [SocialMediaProvider.INSTAGRAM]: ['visual-first', 'lifestyle', 'inspirational'],
    [SocialMediaProvider.REDDIT]: ['informative', 'discussion-oriented', 'authentic'],
    [SocialMediaProvider.TIKTOK]: ['entertaining', 'trending', 'creative']
  };

  /**
   * Generate platform-optimized content for multiple platforms
   */
  async generateContent(
    params: ContentGenerationParams
  ): Promise<PlatformOptimizedContent> {
    // Generate base content
    const baseContent = await this.generateBaseContent(params);
    
    // Optimize for each platform
    const platformContent: Record<string, any> = {};
    
    for (const platform of params.platforms) {
      platformContent[platform] = await this.optimizeForPlatform(
        baseContent, 
        platform, 
        params.brandVoice,
        params.includeHashtags
      );
    }
    
    // Generate hashtags
    const suggestedHashtags = await this.generateHashtags(params.topic, params.platforms);
    
    // Get optimal posting times
    const optimalPostTimes = await this.getOptimalPostTimes(params.platforms);
    
    return {
      baseContent,
      platformContent,
      suggestedHashtags,
      optimalPostTimes
    };
  }

  /**
   * Generate content based on market trends and insights
   */
  async generateTrendBasedContent(
    marketInsights: MarketInsight[],
    platforms: SocialMediaProvider[],
    brandVoice: BrandVoice
  ): Promise<ContentSuggestion[]> {
    const suggestions: ContentSuggestion[] = [];
    
    for (const insight of marketInsights) {
      if (insight.relevanceScore > 0.6 && insight.trendingScore > 0.5) {
        const content = await this.generateContentFromInsight(insight, brandVoice);
        const hashtags = await this.generateHashtags(insight.topic, platforms);
        
        suggestions.push({
          content,
          platforms: this.selectOptimalPlatforms(insight, platforms),
          hashtags,
          estimatedEngagement: this.calculateEngagementPotential(insight),
          urgency: this.calculateUrgency(insight),
          reasoning: `Based on trending topic: ${insight.topic} (relevance: ${insight.relevanceScore}, trending: ${insight.trendingScore})`,
          marketInsight: insight
        });
      }
    }
    
    return suggestions.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Optimize content for a specific platform
   */
  async optimizeForPlatform(
    content: string,
    platform: SocialMediaProvider,
    brandVoice: BrandVoice,
    includeHashtags: boolean = true
  ): Promise<{
    content: string;
    hashtags: string[];
    characterCount: number;
    optimizations: string[];
  }> {
    const limit = this.platformLimits[platform];
    const platformTones = this.platformTones[platform];
    const optimizations: string[] = [];
    
    let optimizedContent = content;
    
    // Platform-specific optimizations
    switch (platform) {
      case SocialMediaProvider.TWITTER:
        optimizedContent = await this.optimizeForTwitter(content, brandVoice);
        optimizations.push('Twitter thread structure', 'Hashtag placement', 'Mention optimization');
        break;
        
      case SocialMediaProvider.LINKEDIN:
        optimizedContent = await this.optimizeForLinkedIn(content, brandVoice);
        optimizations.push('Professional tone', 'Industry keywords', 'Call-to-action');
        break;
        
      case SocialMediaProvider.INSTAGRAM:
        optimizedContent = await this.optimizeForInstagram(content, brandVoice);
        optimizations.push('Visual storytelling', 'Emoji usage', 'Story-friendly format');
        break;
        
      case SocialMediaProvider.TIKTOK:
        optimizedContent = await this.optimizeForTikTok(content, brandVoice);
        optimizations.push('Trending sounds', 'Hook optimization', 'Viral potential');
        break;
        
      case SocialMediaProvider.REDDIT:
        optimizedContent = await this.optimizeForReddit(content, brandVoice);
        optimizations.push('Community guidelines', 'Discussion starters', 'Authenticity');
        break;
        
      case SocialMediaProvider.FACEBOOK:
        optimizedContent = await this.optimizeForFacebook(content, brandVoice);
        optimizations.push('Community engagement', 'Share-worthy content', 'Algorithm optimization');
        break;
    }
    
    // Ensure character limit compliance
    if (optimizedContent.length > limit) {
      optimizedContent = await this.truncateContent(optimizedContent, limit, platform);
      optimizations.push('Character limit compliance');
    }
    
    // Generate platform-specific hashtags
    const hashtags = includeHashtags ? 
      await this.generatePlatformHashtags(content, platform) : [];
    
    return {
      content: optimizedContent,
      hashtags,
      characterCount: optimizedContent.length,
      optimizations
    };
  }

  /**
   * Generate hashtags for content and platforms
   */
  async generateHashtags(topic: string, platforms: SocialMediaProvider[]): Promise<string[]> {
    const baseHashtags = await this.extractTopicHashtags(topic);
    const trendingHashtags = await this.getTrendingHashtags(platforms);
    
    // Combine and deduplicate
    const allHashtags = [...baseHashtags, ...trendingHashtags];
    const uniqueHashtags = Array.from(new Set(allHashtags));
    
    // Limit to reasonable number
    return uniqueHashtags.slice(0, 10);
  }

  /**
   * Get optimal posting times for platforms
   */
  async getOptimalPostTimes(platforms: SocialMediaProvider[]): Promise<Record<string, any>> {
    const optimalTimes: Record<string, any> = {};
    
    // Default optimal times based on platform research
    const defaultTimes = {
      [SocialMediaProvider.TWITTER]: { bestHour: 9, bestDay: 'Tuesday', timezone: 'UTC' },
      [SocialMediaProvider.LINKEDIN]: { bestHour: 8, bestDay: 'Wednesday', timezone: 'UTC' },
      [SocialMediaProvider.FACEBOOK]: { bestHour: 15, bestDay: 'Wednesday', timezone: 'UTC' },
      [SocialMediaProvider.INSTAGRAM]: { bestHour: 11, bestDay: 'Wednesday', timezone: 'UTC' },
      [SocialMediaProvider.REDDIT]: { bestHour: 10, bestDay: 'Monday', timezone: 'UTC' },
      [SocialMediaProvider.TIKTOK]: { bestHour: 18, bestDay: 'Tuesday', timezone: 'UTC' }
    };
    
    for (const platform of platforms) {
      optimalTimes[platform] = defaultTimes[platform];
    }
    
    return optimalTimes;
  }

  // Platform-specific optimization methods

  private async optimizeForTwitter(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add Twitter-specific elements
    if (brandVoice.tone === 'casual' || brandVoice.tone === 'friendly') {
      optimized = this.addConversationalElements(optimized);
    }
    
    // Optimize for engagement
    optimized = this.addEngagementHooks(optimized, 'twitter');
    
    return optimized;
  }

  private async optimizeForLinkedIn(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add professional context
    if (!optimized.includes('insights') && !optimized.includes('experience')) {
      optimized = `Sharing some insights: ${optimized}`;
    }
    
    // Add thought leadership elements
    optimized = this.addThoughtLeadershipElements(optimized);
    
    return optimized;
  }

  private async optimizeForInstagram(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add visual storytelling elements
    optimized = this.addVisualStorytelling(optimized);
    
    // Add appropriate emojis
    optimized = this.addEmojis(optimized, brandVoice);
    
    return optimized;
  }

  private async optimizeForTikTok(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add hook at the beginning
    optimized = this.addTikTokHook(optimized);
    
    // Optimize for trending elements
    optimized = this.addTrendingElements(optimized);
    
    return optimized;
  }

  private async optimizeForReddit(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add authenticity markers
    optimized = this.addAuthenticityMarkers(optimized);
    
    // Format for discussion
    optimized = this.formatForDiscussion(optimized);
    
    return optimized;
  }

  private async optimizeForFacebook(content: string, brandVoice: BrandVoice): Promise<string> {
    let optimized = content;
    
    // Add community engagement elements
    optimized = this.addCommunityElements(optimized);
    
    // Optimize for sharing
    optimized = this.optimizeForSharing(optimized);
    
    return optimized;
  }

  // Helper methods

  private async generateBaseContent(params: ContentGenerationParams): Promise<string> {
    // This would integrate with an LLM service in production
    // For now, return a template-based content
    
    const templates = {
      professional: `Exciting developments in ${params.topic}! Our latest insights show significant potential for innovation and growth.`,
      casual: `Just discovered something amazing about ${params.topic}! 🚀 This could be a game-changer.`,
      friendly: `Hey everyone! Wanted to share some thoughts on ${params.topic}. What do you think?`,
      authoritative: `Industry analysis: ${params.topic} represents a critical shift in our sector. Key implications include...`,
      humorous: `${params.topic} got me like... 😄 But seriously, this is pretty interesting stuff!`,
      inspirational: `${params.topic} reminds us that innovation never stops. Every challenge is an opportunity to grow.`
    };
    
    let baseContent = templates[params.brandVoice.tone] || templates.professional;
    
    // Add call to action if requested
    if (params.includeCallToAction) {
      baseContent += '\n\nWhat are your thoughts? Share your experience in the comments!';
    }
    
    return baseContent;
  }

  private async generateContentFromInsight(insight: MarketInsight, brandVoice: BrandVoice): Promise<string> {
    const sentimentMap = {
      positive: 'exciting opportunity',
      negative: 'important challenge',
      neutral: 'significant development'
    };
    
    const sentiment = sentimentMap[insight.sentiment];
    
    return `${insight.summary} This represents an ${sentiment} in ${insight.topic}. ${insight.keywords.slice(0, 3).join(', ')} are key factors to watch.`;
  }

  private selectOptimalPlatforms(insight: MarketInsight, availablePlatforms: SocialMediaProvider[]): SocialMediaProvider[] {
    // Select platforms based on insight characteristics
    const platformScores: Record<SocialMediaProvider, number> = {
      [SocialMediaProvider.TWITTER]: 0,
      [SocialMediaProvider.LINKEDIN]: 0,
      [SocialMediaProvider.FACEBOOK]: 0,
      [SocialMediaProvider.INSTAGRAM]: 0,
      [SocialMediaProvider.REDDIT]: 0,
      [SocialMediaProvider.TIKTOK]: 0
    };
    
    // Score based on topic and trending score
    if (insight.topic.includes('business') || insight.topic.includes('professional')) {
      platformScores[SocialMediaProvider.LINKEDIN] += 0.8;
      platformScores[SocialMediaProvider.TWITTER] += 0.6;
    }
    
    if (insight.trendingScore > 0.8) {
      platformScores[SocialMediaProvider.TWITTER] += 0.7;
      platformScores[SocialMediaProvider.TIKTOK] += 0.9;
    }
    
    if (insight.topic.includes('visual') || insight.topic.includes('creative')) {
      platformScores[SocialMediaProvider.INSTAGRAM] += 0.8;
      platformScores[SocialMediaProvider.TIKTOK] += 0.7;
    }
    
    // Return top scoring platforms that are available
    return availablePlatforms
      .sort((a, b) => platformScores[b] - platformScores[a])
      .slice(0, 3);
  }

  private calculateEngagementPotential(insight: MarketInsight): number {
    return (insight.relevanceScore * 0.4 + insight.trendingScore * 0.6) * 100;
  }

  private calculateUrgency(insight: MarketInsight): number {
    return insight.trendingScore * insight.relevanceScore * 100;
  }

  private async extractTopicHashtags(topic: string): Promise<string[]> {
    // Extract hashtags from topic
    const words = topic.toLowerCase().split(' ');
    const hashtags = words
      .filter(word => word.length > 3)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .slice(0, 5);
    
    return hashtags;
  }

  private async getTrendingHashtags(platforms: SocialMediaProvider[]): Promise<string[]> {
    // Return some trending hashtags (would be fetched from APIs in production)
    const trending = ['Innovation', 'Technology', 'Growth', 'Future', 'AI'];
    return trending;
  }

  private async generatePlatformHashtags(content: string, platform: SocialMediaProvider): Promise<string[]> {
    const platformSpecific = {
      [SocialMediaProvider.TWITTER]: ['TwitterTips', 'TechNews'],
      [SocialMediaProvider.LINKEDIN]: ['ProfessionalGrowth', 'Leadership'],
      [SocialMediaProvider.INSTAGRAM]: ['InstaDaily', 'Lifestyle'],
      [SocialMediaProvider.TIKTOK]: ['TikTokTrends', 'Viral'],
      [SocialMediaProvider.REDDIT]: ['Discussion', 'Community'],
      [SocialMediaProvider.FACEBOOK]: ['Community', 'Sharing']
    };
    
    return platformSpecific[platform] || [];
  }

  private async truncateContent(content: string, limit: number, platform: SocialMediaProvider): Promise<string> {
    if (content.length <= limit) return content;
    
    // Smart truncation that preserves meaning
    const truncated = content.substring(0, limit - 3) + '...';
    
    // For Twitter, suggest thread continuation
    if (platform === SocialMediaProvider.TWITTER) {
      return truncated + ' (1/n)';
    }
    
    return truncated;
  }

  // Content enhancement methods

  private addConversationalElements(content: string): string {
    const starters = ['Just thinking...', 'Quick thought:', 'Interesting observation:'];
    const randomStarter = starters[Math.floor(Math.random() * starters.length)];
    return `${randomStarter} ${content}`;
  }

  private addEngagementHooks(content: string, platform: string): string {
    const hooks = ['What do you think?', 'Agree or disagree?', 'Your thoughts?'];
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    return `${content}\n\n${randomHook}`;
  }

  private addThoughtLeadershipElements(content: string): string {
    return `${content}\n\nIn my experience, this trend highlights the importance of staying ahead of industry developments.`;
  }

  private addVisualStorytelling(content: string): string {
    return `📸 ${content}\n\n#VisualStory #BehindTheScenes`;
  }

  private addEmojis(content: string, brandVoice: BrandVoice): string {
    if (brandVoice.tone === 'professional') return content;
    
    const emojis = ['🚀', '💡', '✨', '🎯', '📈'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    return `${randomEmoji} ${content}`;
  }

  private addTikTokHook(content: string): string {
    const hooks = ['Wait for it...', 'You won\'t believe this...', 'Plot twist:'];
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    return `${randomHook} ${content}`;
  }

  private addTrendingElements(content: string): string {
    return `${content}\n\n#Trending #Viral #ForYou`;
  }

  private addAuthenticityMarkers(content: string): string {
    return `Genuine question: ${content}\n\nEdit: Thanks for all the responses!`;
  }

  private formatForDiscussion(content: string): string {
    return `${content}\n\nTL;DR: Key points for discussion\n\nWhat's your experience with this?`;
  }

  private addCommunityElements(content: string): string {
    return `${content}\n\nTag someone who needs to see this! 👥`;
  }

  private optimizeForSharing(content: string): string {
    return `${content}\n\nShare if you found this helpful! 🔄`;
  }
} 