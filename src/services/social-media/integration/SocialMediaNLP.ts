/**
 * SocialMediaNLP.ts - Natural language processing for social media commands
 * 
 * This processor handles parsing and interpreting natural language commands
 * related to social media operations like posting, scheduling, analytics, and engagement.
 */

import { parse } from 'chrono-node';
import { SocialMediaCapability, SocialMediaProvider } from '../database/ISocialMediaDatabase';

/**
 * Types of social media commands
 */
export enum SocialMediaCommandType {
  // Content creation commands
  POST_CREATE = 'post_create',
  POST_SCHEDULE = 'post_schedule',
  POST_EDIT = 'post_edit',
  POST_DELETE = 'post_delete',

  // Draft management commands (NEW)
  DRAFT_LIST = 'draft_list',
  DRAFT_GET = 'draft_get',
  DRAFT_PUBLISH = 'draft_publish',
  DRAFT_SCHEDULE = 'draft_schedule',

  // Platform-specific commands
  TIKTOK_VIDEO_CREATE = 'tiktok_video_create',
  STORY_CREATE = 'story_create',
  POLL_CREATE = 'poll_create',

  // Analytics commands
  ANALYTICS_GET = 'analytics_get',
  POST_METRICS = 'post_metrics',
  ACCOUNT_INSIGHTS = 'account_insights',
  TREND_ANALYSIS = 'trend_analysis',

  // Engagement commands
  COMMENTS_GET = 'comments_get',
  COMMENT_REPLY = 'comment_reply',
  POST_LIKE = 'post_like',
  POST_SHARE = 'post_share',
  DM_SEND = 'dm_send',
  MENTIONS_GET = 'mentions_get',

  // Content management commands
  CONTENT_OPTIMIZE = 'content_optimize',
  HASHTAGS_GENERATE = 'hashtags_generate',
  CONTENT_ANALYZE = 'content_analyze',

  // General
  UNKNOWN = 'unknown'
}

/**
 * Parsed social media command structure
 */
export interface SocialMediaCommand {
  type: SocialMediaCommandType;
  intent: string;
  entities: Record<string, any>;
  platforms?: SocialMediaProvider[];
  scheduledTime?: Date;
  confidence: number;
  originalText: string;
  requiredCapabilities: SocialMediaCapability[];
}

/**
 * Conversation context for social media commands
 */
export interface ConversationContext {
  previousMessages: string[];
  currentTopic: string;
  userGoals: string[];
  availableConnections: Array<{
    id: string;
    provider: SocialMediaProvider;
    accountDisplayName: string;
  }>;
  agentCapabilities: SocialMediaCapability[];
}

/**
 * Natural language processor for social media commands
 */
export class SocialMediaNLP {

  /**
   * Parse a natural language command into a structured social media command
   */
  parseCommand(text: string, context?: ConversationContext): SocialMediaCommand | null {
    const normalizedText = text.toLowerCase().trim();

    // Extract scheduled time first
    const scheduledTime = this.extractScheduledTime(text);

    // Determine command type
    const commandType = this.determineCommandType(normalizedText, context);

    if (commandType === SocialMediaCommandType.UNKNOWN) {
      return null;
    }

    // Extract entities based on command type
    const entities = this.extractEntities(normalizedText, commandType);

    // Extract platforms
    const platforms = this.extractPlatforms(normalizedText, context);

    // Get required capabilities
    const requiredCapabilities = this.getRequiredCapabilities(commandType);

    // Calculate confidence
    const confidence = this.calculateConfidence(normalizedText, commandType, entities, context);

    return {
      type: commandType,
      intent: this.getIntent(commandType),
      entities,
      platforms,
      scheduledTime,
      confidence,
      originalText: text,
      requiredCapabilities
    };
  }

  /**
   * Determine the type of social media command
   */
  private determineCommandType(text: string, context?: ConversationContext): SocialMediaCommandType {
    // Draft commands (check first for specificity)
    if (this.matchesDraftSchedule(text)) return SocialMediaCommandType.DRAFT_SCHEDULE;
    if (this.matchesDraftPublish(text)) return SocialMediaCommandType.DRAFT_PUBLISH;
    if (this.matchesDraftGet(text)) return SocialMediaCommandType.DRAFT_GET;
    if (this.matchesDraftList(text)) return SocialMediaCommandType.DRAFT_LIST;

    // Scheduling commands (check next for specificity)
    if (this.matchesPostSchedule(text)) return SocialMediaCommandType.POST_SCHEDULE;

    // Content creation commands
    if (this.matchesTikTokVideo(text)) return SocialMediaCommandType.TIKTOK_VIDEO_CREATE;
    if (this.matchesStoryCreate(text)) return SocialMediaCommandType.STORY_CREATE;
    if (this.matchesPollCreate(text)) return SocialMediaCommandType.POLL_CREATE;
    if (this.matchesPostCreate(text)) return SocialMediaCommandType.POST_CREATE;

    // Content management commands
    if (this.matchesPostEdit(text)) return SocialMediaCommandType.POST_EDIT;
    if (this.matchesPostDelete(text)) return SocialMediaCommandType.POST_DELETE;
    if (this.matchesContentOptimize(text)) return SocialMediaCommandType.CONTENT_OPTIMIZE;
    if (this.matchesHashtagsGenerate(text)) return SocialMediaCommandType.HASHTAGS_GENERATE;
    if (this.matchesContentAnalyze(text)) return SocialMediaCommandType.CONTENT_ANALYZE;

    // Analytics commands
    if (this.matchesPostMetrics(text)) return SocialMediaCommandType.POST_METRICS;
    if (this.matchesAccountInsights(text)) return SocialMediaCommandType.ACCOUNT_INSIGHTS;
    if (this.matchesTrendAnalysis(text)) return SocialMediaCommandType.TREND_ANALYSIS;
    if (this.matchesAnalyticsGet(text)) return SocialMediaCommandType.ANALYTICS_GET;

    // Engagement commands
    if (this.matchesCommentReply(text)) return SocialMediaCommandType.COMMENT_REPLY;
    if (this.matchesCommentsGet(text)) return SocialMediaCommandType.COMMENTS_GET;
    if (this.matchesPostLike(text)) return SocialMediaCommandType.POST_LIKE;
    if (this.matchesPostShare(text)) return SocialMediaCommandType.POST_SHARE;
    if (this.matchesDMSend(text)) return SocialMediaCommandType.DM_SEND;
    if (this.matchesMentionsGet(text)) return SocialMediaCommandType.MENTIONS_GET;

    // Context-based inference
    if (context) {
      const contextualType = this.inferFromContext(text, context);
      if (contextualType !== SocialMediaCommandType.UNKNOWN) {
        return contextualType;
      }
    }

    return SocialMediaCommandType.UNKNOWN;
  }

  /**
   * Draft management command matchers
   */
  private matchesDraftList(text: string): boolean {
    const patterns = [
      /list.*drafts/,
      /show.*drafts/,
      /get.*drafts/,
      /my.*drafts/,
      /draft.*list/,
      /drafts.*on/,
      /see.*drafts/,
      /view.*drafts/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesDraftGet(text: string): boolean {
    const patterns = [
      /draft.*called/,
      /draft.*named/,
      /get.*draft/,
      /show.*draft/,
      /find.*draft/,
      /draft.*titled/,
      /my.*draft.*\w+/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesDraftPublish(text: string): boolean {
    const patterns = [
      /publish.*draft/,
      /post.*draft/,
      /share.*draft/,
      /upload.*draft/,
      /go.*live.*with.*draft/,
      /release.*draft/,
      /send.*draft/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesDraftSchedule(text: string): boolean {
    const patterns = [
      /schedule.*draft/,
      /draft.*later/,
      /draft.*tomorrow/,
      /draft.*at/,
      /queue.*draft/,
      /delay.*draft/,
      /post.*draft.*later/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Content creation command matchers
   */
  private matchesPostCreate(text: string): boolean {
    const patterns = [
      /post.*to/,
      /share.*on/,
      /publish.*to/,
      /create.*post/,
      /write.*post/,
      /send.*to/,
      /upload.*to/,
      /tweet.*about/,
      /share.*this/,
      /post.*about/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPostSchedule(text: string): boolean {
    const patterns = [
      /schedule.*post/,
      /post.*later/,
      /schedule.*for/,
      /post.*at\s+\d/,  // Fixed: only match "post at" followed by a digit (time)
      /post.*at\s+(morning|afternoon|evening|night|noon|midnight)/,  // "post at morning/evening"
      /queue.*post/,
      /delay.*post/,
      /post.*tomorrow/,
      /post.*tonight/,
      /schedule.*this/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesTikTokVideo(text: string): boolean {
    const patterns = [
      /create.*tiktok/,
      /make.*tiktok/,
      /tiktok.*video/,
      /upload.*tiktok/,
      /post.*tiktok/,
      /viral.*tiktok/,
      /trending.*tiktok/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesStoryCreate(text: string): boolean {
    const patterns = [
      /create.*story/,
      /post.*story/,
      /share.*story/,
      /instagram.*story/,
      /facebook.*story/,
      /add.*story/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPollCreate(text: string): boolean {
    const patterns = [
      /create.*poll/,
      /make.*poll/,
      /poll.*about/,
      /ask.*poll/,
      /survey.*about/,
      /vote.*on/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Analytics command matchers
   */
  private matchesAnalyticsGet(text: string): boolean {
    const patterns = [
      /show.*analytics/,
      /get.*analytics/,
      /social.*media.*stats/,
      /performance.*metrics/,
      /engagement.*data/,
      /social.*insights/,
      /how.*performing/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPostMetrics(text: string): boolean {
    const patterns = [
      /post.*performance/,
      /post.*metrics/,
      /how.*did.*post/,
      /post.*stats/,
      /engagement.*on.*post/,
      /likes.*on.*post/,
      /views.*on.*post/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesAccountInsights(text: string): boolean {
    const patterns = [
      /account.*insights/,
      /audience.*data/,
      /follower.*analytics/,
      /demographic.*data/,
      /audience.*insights/,
      /who.*follows.*me/,
      /my.*audience/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesTrendAnalysis(text: string): boolean {
    const patterns = [
      /trend.*analysis/,
      /trending.*topics/,
      /what.*trending/,
      /popular.*hashtags/,
      /viral.*content/,
      /trending.*now/,
      /hot.*topics/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Engagement command matchers
   */
  private matchesCommentsGet(text: string): boolean {
    const patterns = [
      /get.*comments/,
      /show.*comments/,
      /check.*comments/,
      /read.*comments/,
      /comments.*on/,
      /what.*people.*saying/,
      /feedback.*on/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesCommentReply(text: string): boolean {
    const patterns = [
      /reply.*to.*comment/,
      /respond.*to.*comment/,
      /answer.*comment/,
      /comment.*back/,
      /reply.*to/,
      /respond.*to/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPostLike(text: string): boolean {
    const patterns = [
      /like.*post/,
      /heart.*post/,
      /react.*to.*post/,
      /give.*like/,
      /thumbs.*up/,
      /love.*post/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPostShare(text: string): boolean {
    const patterns = [
      /share.*post/,
      /repost.*this/,
      /retweet.*this/,
      /share.*this.*post/,
      /amplify.*post/,
      /boost.*post/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesDMSend(text: string): boolean {
    const patterns = [
      /send.*dm/,
      /direct.*message/,
      /private.*message/,
      /message.*privately/,
      /dm.*them/,
      /send.*private/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesMentionsGet(text: string): boolean {
    const patterns = [
      /check.*mentions/,
      /get.*mentions/,
      /who.*mentioned.*me/,
      /mentions.*of.*me/,
      /tagged.*me/,
      /mentioned.*us/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Content management command matchers
   */
  private matchesPostEdit(text: string): boolean {
    const patterns = [
      /edit.*post/,
      /modify.*post/,
      /update.*post/,
      /change.*post/,
      /fix.*post/,
      /correct.*post/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesPostDelete(text: string): boolean {
    const patterns = [
      /delete.*post/,
      /remove.*post/,
      /take.*down.*post/,
      /unpublish.*post/,
      /cancel.*post/,
      /withdraw.*post/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesContentOptimize(text: string): boolean {
    const patterns = [
      /optimize.*content/,
      /improve.*post/,
      /make.*better/,
      /enhance.*content/,
      /optimize.*for/,
      /improve.*engagement/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesHashtagsGenerate(text: string): boolean {
    const patterns = [
      /generate.*hashtags/,
      /suggest.*hashtags/,
      /find.*hashtags/,
      /hashtags.*for/,
      /trending.*hashtags/,
      /best.*hashtags/,
      /popular.*hashtags/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private matchesContentAnalyze(text: string): boolean {
    const patterns = [
      /analyze.*content/,
      /content.*analysis/,
      /review.*content/,
      /assess.*content/,
      /evaluate.*post/,
      /content.*quality/
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Infer command type from conversation context
   */
  private inferFromContext(text: string, context: ConversationContext): SocialMediaCommandType {
    const lowerText = text.toLowerCase();

    // If discussing market trends, suggest posting
    if (context.currentTopic.includes('market_trend') || context.currentTopic.includes('trending')) {
      if (lowerText.includes('share') || lowerText.includes('tell people') || lowerText.includes('announce')) {
        return SocialMediaCommandType.POST_CREATE;
      }
    }

    // If discussing performance or metrics, suggest analytics
    if (context.currentTopic.includes('performance') || context.currentTopic.includes('metrics')) {
      if (lowerText.includes('how') || lowerText.includes('show') || lowerText.includes('check')) {
        return SocialMediaCommandType.ANALYTICS_GET;
      }
    }

    // If discussing TikTok or video content
    if (context.currentTopic.includes('tiktok') || context.currentTopic.includes('video') || context.currentTopic.includes('viral')) {
      if (lowerText.includes('create') || lowerText.includes('make') || lowerText.includes('upload')) {
        return SocialMediaCommandType.TIKTOK_VIDEO_CREATE;
      }
    }

    return SocialMediaCommandType.UNKNOWN;
  }

  /**
   * Extract entities from the command text
   */
  private extractEntities(text: string, commandType: SocialMediaCommandType): Record<string, any> {
    const entities: Record<string, any> = {};

    switch (commandType) {
      case SocialMediaCommandType.POST_CREATE:
      case SocialMediaCommandType.POST_SCHEDULE:
        entities.content = this.extractContent(text);
        entities.hashtags = this.extractHashtags(text);
        entities.mentions = this.extractMentions(text);
        entities.visibility = this.extractVisibility(text);

        // Enhanced: Detect if content needs expansion/generation
        entities.needsExpansion = this.detectExpansionNeeds(text);
        entities.expansionInstructions = this.extractExpansionInstructions(text);
        entities.requiresACG = this.shouldTriggerACG(text, entities.content);
        break;

      case SocialMediaCommandType.DRAFT_GET:
      case SocialMediaCommandType.DRAFT_PUBLISH:
      case SocialMediaCommandType.DRAFT_SCHEDULE:
        entities.draftId = this.extractDraftId(text);
        entities.draftName = this.extractDraftName(text);
        entities.overrides = this.extractDraftOverrides(text);
        break;

      case SocialMediaCommandType.DRAFT_LIST:
        // No specific entities needed for listing drafts
        break;

      case SocialMediaCommandType.TIKTOK_VIDEO_CREATE:
        entities.title = this.extractVideoTitle(text);
        entities.description = this.extractVideoDescription(text);
        entities.hashtags = this.extractHashtags(text);
        entities.music = this.extractMusic(text);
        break;

      case SocialMediaCommandType.ANALYTICS_GET:
      case SocialMediaCommandType.POST_METRICS:
        entities.timeframe = this.extractTimeframe(text);
        entities.metrics = this.extractMetrics(text);
        break;

      case SocialMediaCommandType.COMMENT_REPLY:
        entities.commentId = this.extractCommentId(text);
        entities.reply = this.extractReplyText(text);
        break;

      case SocialMediaCommandType.HASHTAGS_GENERATE:
        entities.topic = this.extractTopic(text);
        entities.count = this.extractHashtagCount(text);
        break;
    }

    return entities;
  }

  /**
   * Extract platforms from command text
   */
  private extractPlatforms(text: string, context?: ConversationContext): SocialMediaProvider[] {
    const platforms: SocialMediaProvider[] = [];

    const platformKeywords = {
      [SocialMediaProvider.TWITTER]: ['twitter', 'tweet', 'x.com', 'twitter.com'],
      [SocialMediaProvider.LINKEDIN]: ['linkedin', 'professional network'],
      [SocialMediaProvider.FACEBOOK]: ['facebook', 'fb'],
      [SocialMediaProvider.INSTAGRAM]: ['instagram', 'insta', 'ig'],
      [SocialMediaProvider.REDDIT]: ['reddit', 'subreddit'],
      [SocialMediaProvider.TIKTOK]: ['tiktok', 'tik tok']
    };

    for (const [platform, keywords] of Object.entries(platformKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        platforms.push(platform as SocialMediaProvider);
      }
    }

    // If no platforms specified, use context or default
    if (platforms.length === 0 && context) {
      return context.availableConnections.map(conn => conn.provider);
    }

    return platforms;
  }

  /**
   * Extract scheduled time from text
   */
  private extractScheduledTime(text: string): Date | undefined {
    try {
      const parsed = parse(text);
      if (parsed.length > 0) {
        return parsed[0].start.date();
      }
    } catch (error) {
      console.debug('Failed to parse time from text:', error);
    }
    return undefined;
  }

  /**
   * Entity extraction helpers
   */
  private extractContent(text: string): string | undefined {
    // First, try to extract content from quotes (most reliable)
    const quotedContent = this.extractQuotedContent(text);
    if (quotedContent) {
      return quotedContent;
    }

    // If no quoted content, try to extract from patterns like "post: content" or "create a post about content"
    const colonContent = this.extractColonContent(text);
    if (colonContent) {
      return colonContent;
    }

    // Fallback: remove command structure and extract remaining meaningful content
    return this.extractUnstructuredContent(text);
  }

  private extractQuotedContent(text: string): string | undefined {
    // Look for content in single or double quotes
    const quotedPatterns = [
      /"([^"]+)"/,           // Double quotes
      /'([^']+)'/,           // Single quotes  
      /[""]([^""]+)["]/,      // Smart quotes
      /['']([^'']+)[']/       // Smart single quotes
    ];

    for (const pattern of quotedPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 0) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractColonContent(text: string): string | undefined {
    // Look for patterns like "post: content" or "tweet: content"
    const colonPatterns = [
      /(?:post|tweet|share|publish|create.*?post|write.*?post):\s*(.+)$/i,
      /(?:post|tweet|share|publish|create.*?post|write.*?post)\s+(.+)$/i
    ];

    for (const pattern of colonPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 10) {
        // Clean up any remaining quotes or platform mentions
        let content = match[1].trim();

        // Remove trailing platform mentions like "on twitter"
        content = content.replace(/\s+on\s+(twitter|linkedin|facebook|instagram|reddit|tiktok).*$/i, '');

        // Remove any remaining quotes
        content = content.replace(/^["']|["']$/g, '');

        return content.trim();
      }
    }

    return undefined;
  }

  private extractUnstructuredContent(text: string): string | undefined {
    // Remove command words and extract the main content (fallback method)
    let content = text;

    // Remove leading command phrases more precisely
    const commandPhrases = [
      /^please\s+/i,
      /^can\s+you\s+/i,
      /^could\s+you\s+/i,
      /^i\s+want\s+to\s+/i,
      /^i\s+need\s+to\s+/i,
      /^create\s+a\s+post\s+(on|to|about)\s+/i,
      /^post\s+(on|to|about)\s+/i,
      /^share\s+(on|to|about)\s+/i,
      /^tweet\s+(on|to|about)\s+/i,
      /^publish\s+(on|to|about)\s+/i
    ];

    for (const phrase of commandPhrases) {
      content = content.replace(phrase, '').trim();
    }

    // Remove platform mentions
    const platformWords = ['twitter', 'linkedin', 'facebook', 'instagram', 'reddit', 'tiktok'];
    for (const word of platformWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      content = content.replace(regex, '').trim();
    }

    // Remove remaining command words only if they're not part of the actual content
    const commandWords = ['post', 'share', 'tweet', 'publish', 'create', 'to', 'on', 'about'];
    for (const word of commandWords) {
      // Only remove if it's at the beginning or isolated
      const regex = new RegExp(`^\\b${word}\\b\\s*`, 'gi');
      content = content.replace(regex, '').trim();
    }

    // Clean up extra spaces and punctuation
    content = content.replace(/^[:;\-\s]+/, '').trim();
    content = content.replace(/\s+/g, ' ').trim();

    return content.length > 10 ? content : undefined;
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w]+/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention.substring(1)) : [];
  }

  private extractVisibility(text: string): string {
    if (text.includes('private')) return 'private';
    if (text.includes('unlisted')) return 'unlisted';
    return 'public';
  }

  private extractVideoTitle(text: string): string | undefined {
    const titlePatterns = [
      /title[:\s]+"([^"]+)"/i,
      /called[:\s]+"([^"]+)"/i,
      /named[:\s]+"([^"]+)"/i
    ];

    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractVideoDescription(text: string): string | undefined {
    const descPatterns = [
      /description[:\s]+"([^"]+)"/i,
      /about[:\s]+"([^"]+)"/i,
      /desc[:\s]+"([^"]+)"/i
    ];

    for (const pattern of descPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractMusic(text: string): string | undefined {
    const musicPatterns = [
      /music[:\s]+"([^"]+)"/i,
      /sound[:\s]+"([^"]+)"/i,
      /song[:\s]+"([^"]+)"/i
    ];

    for (const pattern of musicPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractTimeframe(text: string): string | undefined {
    const timeframes = [
      'today', 'yesterday', 'tomorrow',
      'this week', 'last week', 'next week',
      'this month', 'last month', 'next month',
      'this year', 'last year'
    ];

    for (const timeframe of timeframes) {
      if (text.includes(timeframe)) return timeframe;
    }
    return undefined;
  }

  private extractMetrics(text: string): string[] {
    const metrics = ['likes', 'shares', 'comments', 'views', 'engagement', 'reach', 'impressions'];
    return metrics.filter(metric => text.includes(metric));
  }

  private extractCommentId(text: string): string | undefined {
    const idMatch = text.match(/comment[- _](\w+)/i);
    return idMatch ? idMatch[1] : undefined;
  }

  private extractReplyText(text: string): string | undefined {
    const replyPatterns = [
      /reply[:\s]+"([^"]+)"/i,
      /respond[:\s]+"([^"]+)"/i,
      /say[:\s]+"([^"]+)"/i
    ];

    for (const pattern of replyPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractTopic(text: string): string | undefined {
    const topicPatterns = [
      /hashtags.*for[:\s]+"([^"]+)"/i,
      /about[:\s]+"([^"]+)"/i,
      /topic[:\s]+"([^"]+)"/i
    ];

    for (const pattern of topicPatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private extractHashtagCount(text: string): number | undefined {
    const countMatch = text.match(/(\d+)\s*hashtags?/i);
    return countMatch ? parseInt(countMatch[1], 10) : undefined;
  }

  /**
   * Draft-specific extraction helpers
   */
  private extractDraftId(text: string): string | undefined {
    // Look for draft ID patterns like "draft-123" or "draft_abc"
    const idMatch = text.match(/draft[- _]([a-zA-Z0-9]+)/i);
    return idMatch ? idMatch[1] : undefined;
  }

  private extractDraftName(text: string): string | undefined {
    const namePatterns = [
      /draft.*called[:\s]+"([^"]+)"/i,
      /draft.*named[:\s]+"([^"]+)"/i,
      /draft.*titled[:\s]+"([^"]+)"/i,
      /my.*draft[:\s]+"([^"]+)"/i,
      /"([^"]+)".*draft/i
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    // Look for draft name without quotes
    const simpleMatch = text.match(/draft\s+(\w+)/i);
    return simpleMatch ? simpleMatch[1] : undefined;
  }

  private extractDraftOverrides(text: string): Record<string, unknown> | undefined {
    const overrides: Record<string, unknown> = {};

    // Check for content overrides
    const contentOverride = this.extractContent(text);
    if (contentOverride) {
      overrides.content = contentOverride;
    }

    // Check for hashtag overrides
    const hashtagOverrides = this.extractHashtags(text);
    if (hashtagOverrides.length > 0) {
      overrides.hashtags = hashtagOverrides;
    }

    // Check for visibility overrides
    const visibilityOverride = this.extractVisibility(text);
    if (visibilityOverride !== 'public') {
      overrides.visibility = visibilityOverride;
    }

    return Object.keys(overrides).length > 0 ? overrides : undefined;
  }

  /**
   * Get required capabilities for command type
   */
  private getRequiredCapabilities(commandType: SocialMediaCommandType): SocialMediaCapability[] {
    const capabilityMap: Record<SocialMediaCommandType, SocialMediaCapability[]> = {
      [SocialMediaCommandType.POST_CREATE]: [SocialMediaCapability.POST_CREATE],
      [SocialMediaCommandType.POST_SCHEDULE]: [SocialMediaCapability.POST_CREATE, SocialMediaCapability.POST_SCHEDULE],
      [SocialMediaCommandType.POST_EDIT]: [SocialMediaCapability.POST_EDIT],
      [SocialMediaCommandType.POST_DELETE]: [SocialMediaCapability.POST_DELETE],
      [SocialMediaCommandType.DRAFT_LIST]: [SocialMediaCapability.DRAFT_READ],
      [SocialMediaCommandType.DRAFT_GET]: [SocialMediaCapability.DRAFT_READ],
      [SocialMediaCommandType.DRAFT_PUBLISH]: [SocialMediaCapability.DRAFT_PUBLISH],
      [SocialMediaCommandType.DRAFT_SCHEDULE]: [SocialMediaCapability.DRAFT_SCHEDULE],
      [SocialMediaCommandType.TIKTOK_VIDEO_CREATE]: [SocialMediaCapability.TIKTOK_VIDEO_CREATE],
      [SocialMediaCommandType.STORY_CREATE]: [SocialMediaCapability.STORY_CREATE],
      [SocialMediaCommandType.POLL_CREATE]: [SocialMediaCapability.POST_CREATE],
      [SocialMediaCommandType.ANALYTICS_GET]: [SocialMediaCapability.ANALYTICS_READ],
      [SocialMediaCommandType.POST_METRICS]: [SocialMediaCapability.ANALYTICS_READ],
      [SocialMediaCommandType.ACCOUNT_INSIGHTS]: [SocialMediaCapability.INSIGHTS_READ],
      [SocialMediaCommandType.TREND_ANALYSIS]: [SocialMediaCapability.ANALYTICS_READ],
      [SocialMediaCommandType.COMMENTS_GET]: [SocialMediaCapability.COMMENT_READ],
      [SocialMediaCommandType.COMMENT_REPLY]: [SocialMediaCapability.COMMENT_CREATE],
      [SocialMediaCommandType.POST_LIKE]: [SocialMediaCapability.LIKE_CREATE],
      [SocialMediaCommandType.POST_SHARE]: [SocialMediaCapability.SHARE_CREATE],
      [SocialMediaCommandType.DM_SEND]: [SocialMediaCapability.DM_SEND],
      [SocialMediaCommandType.MENTIONS_GET]: [SocialMediaCapability.COMMENT_READ],
      [SocialMediaCommandType.CONTENT_OPTIMIZE]: [SocialMediaCapability.POST_CREATE],
      [SocialMediaCommandType.HASHTAGS_GENERATE]: [SocialMediaCapability.POST_CREATE],
      [SocialMediaCommandType.CONTENT_ANALYZE]: [SocialMediaCapability.ANALYTICS_READ],
      [SocialMediaCommandType.UNKNOWN]: []
    };

    return capabilityMap[commandType] || [];
  }

  /**
   * Calculate confidence score for the parsed command
   */
  private calculateConfidence(
    text: string,
    commandType: SocialMediaCommandType,
    entities: Record<string, any>,
    context?: ConversationContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on command type recognition
    if (commandType !== SocialMediaCommandType.UNKNOWN) {
      confidence += 0.3;
    }

    // Increase confidence based on extracted entities
    const entityCount = Object.keys(entities).filter(key => entities[key] !== undefined).length;
    confidence += entityCount * 0.05;

    // Increase confidence for platform mentions
    const platformKeywords = ['twitter', 'linkedin', 'facebook', 'instagram', 'reddit', 'tiktok'];
    const platformMatches = platformKeywords.filter(keyword => text.includes(keyword)).length;
    confidence += platformMatches * 0.1;

    // Increase confidence for social media specific keywords
    const socialKeywords = ['post', 'share', 'tweet', 'hashtag', 'like', 'comment', 'follow'];
    const socialMatches = socialKeywords.filter(keyword => text.includes(keyword)).length;
    confidence += socialMatches * 0.05;

    // Context-based confidence boost
    if (context && context.agentCapabilities.length > 0) {
      const requiredCaps = this.getRequiredCapabilities(commandType);
      const hasCapabilities = requiredCaps.every(cap => context.agentCapabilities.includes(cap));
      if (hasCapabilities) {
        confidence += 0.1;
      } else {
        confidence *= 0.7; // Reduce confidence if missing capabilities
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get intent description for command type
   */
  private getIntent(commandType: SocialMediaCommandType): string {
    const intents = {
      [SocialMediaCommandType.POST_CREATE]: 'Create and publish a social media post',
      [SocialMediaCommandType.POST_SCHEDULE]: 'Schedule a post for later publication',
      [SocialMediaCommandType.POST_EDIT]: 'Edit an existing social media post',
      [SocialMediaCommandType.POST_DELETE]: 'Delete a social media post',
      [SocialMediaCommandType.DRAFT_LIST]: 'List available draft posts',
      [SocialMediaCommandType.DRAFT_GET]: 'Get a specific draft post',
      [SocialMediaCommandType.DRAFT_PUBLISH]: 'Publish a draft post immediately',
      [SocialMediaCommandType.DRAFT_SCHEDULE]: 'Schedule a draft post for later',
      [SocialMediaCommandType.TIKTOK_VIDEO_CREATE]: 'Create a TikTok video',
      [SocialMediaCommandType.STORY_CREATE]: 'Create a story post',
      [SocialMediaCommandType.POLL_CREATE]: 'Create a poll post',
      [SocialMediaCommandType.ANALYTICS_GET]: 'Get social media analytics',
      [SocialMediaCommandType.POST_METRICS]: 'Get metrics for specific posts',
      [SocialMediaCommandType.ACCOUNT_INSIGHTS]: 'Get account insights and audience data',
      [SocialMediaCommandType.TREND_ANALYSIS]: 'Analyze trending topics and hashtags',
      [SocialMediaCommandType.COMMENTS_GET]: 'Get comments from posts',
      [SocialMediaCommandType.COMMENT_REPLY]: 'Reply to a comment',
      [SocialMediaCommandType.POST_LIKE]: 'Like a post',
      [SocialMediaCommandType.POST_SHARE]: 'Share or repost content',
      [SocialMediaCommandType.DM_SEND]: 'Send a direct message',
      [SocialMediaCommandType.MENTIONS_GET]: 'Get mentions and tags',
      [SocialMediaCommandType.CONTENT_OPTIMIZE]: 'Optimize content for better engagement',
      [SocialMediaCommandType.HASHTAGS_GENERATE]: 'Generate relevant hashtags',
      [SocialMediaCommandType.CONTENT_ANALYZE]: 'Analyze content quality and performance',
      [SocialMediaCommandType.UNKNOWN]: 'Unknown social media command'
    };

    return intents[commandType] || 'Unknown command';
  }

  /**
   * Detect if content needs expansion or additional generation
   */
  private detectExpansionNeeds(text: string): boolean {
    const expansionKeywords = [
      'expand', 'explain', 'elaborate', 'add to', 'build on', 'extend',
      'include', 'also', 'but also', 'and explain', 'and add',
      'why', 'how', 'because', 'important', 'significance',
      'more about', 'details about', 'context', 'background'
    ];

    return expansionKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Extract specific expansion instructions from text
   */
  private extractExpansionInstructions(text: string): string[] {
    const instructions: string[] = [];

    // Look for "and" clauses that indicate additional content needed
    const andClauses = text.split(/\s+and\s+/i);
    if (andClauses.length > 1) {
      // Skip the first clause (likely the main content), extract the rest
      instructions.push(...andClauses.slice(1));
    }

    // Look for "but also" clauses
    const butAlsoClauses = text.split(/\s+but\s+also\s+/i);
    if (butAlsoClauses.length > 1) {
      instructions.push(...butAlsoClauses.slice(1));
    }

    // Look for explanation requests
    const explanationPatterns = [
      /explain\s+(.+?)(?:\.|$)/i,
      /why\s+(.+?)(?:\.|$)/i,
      /how\s+(.+?)(?:\.|$)/i,
      /expand\s+on\s+(.+?)(?:\.|$)/i
    ];

    for (const pattern of explanationPatterns) {
      const match = text.match(pattern);
      if (match) {
        instructions.push(match[1].trim());
      }
    }

    return instructions.filter(instruction => instruction.length > 0);
  }

  /**
   * Determine if ACG should be triggered based on content analysis
   */
  private shouldTriggerACG(text: string, extractedContent?: string): boolean {
    // Case 1: No content extracted at all
    if (!extractedContent || extractedContent.length < 10) {
      return true;
    }

    // Case 2: Content exists but expansion/explanation needed
    if (this.detectExpansionNeeds(text)) {
      return true;
    }

    // Case 3: Instructions-only requests (no specific content provided)
    const instructionKeywords = [
      'create a post', 'write a post', 'make a post',
      'generate', 'come up with', 'think of',
      'about', 'explaining', 'discussing'
    ];

    const hasInstructions = instructionKeywords.some(keyword =>
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    // If it's instruction-heavy and content is minimal, trigger ACG
    if (hasInstructions && extractedContent.length < 50) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const socialMediaNLP = new SocialMediaNLP();

/**
 * Helper function to parse social media commands
 */
export function parseSocialMediaCommand(text: string, context?: ConversationContext): SocialMediaCommand | null {
  return socialMediaNLP.parseCommand(text, context);
} 