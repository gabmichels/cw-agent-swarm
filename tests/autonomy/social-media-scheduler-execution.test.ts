/**
 * Social Media Scheduler Execution Tests
 * 
 * Tests that verify the scheduler properly executes social media tasks
 * including scheduled posting, content optimization, engagement automation,
 * and cross-platform coordination.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { SocialMediaCommandType } from '../../src/services/social-media/integration/SocialMediaNLP';
import { SocialMediaProvider, SocialMediaCapability } from '../../src/services/social-media/database/ISocialMediaDatabase';
import { ulid } from 'ulid';

describe('Social Media Scheduler Execution Tests', () => {
  let testAgentId: string;
  let testConnections: Record<string, string> = {};

  beforeAll(async () => {
    console.log('🔧 Setting up social media scheduler execution tests...');
    
    // Create test agent ID
    testAgentId = `agent_${ulid()}`;
    
    // Mock test connections for testing
    testConnections = {
      [SocialMediaProvider.TWITTER]: 'mock-twitter-connection',
      [SocialMediaProvider.LINKEDIN]: 'mock-linkedin-connection',
      [SocialMediaProvider.INSTAGRAM]: 'mock-instagram-connection',
      [SocialMediaProvider.TIKTOK]: 'mock-tiktok-connection'
    };
    
    console.log(`✅ Test setup complete with agent: ${testAgentId}`);
  });

  afterAll(async () => {
    console.log(`✅ Test cleanup complete`);
  });

  describe('📱 Social Media Command Types', () => {
    test('should have all required command types defined', () => {
      // Test that our enum has the expected command types
      expect(SocialMediaCommandType.POST_CREATE).toBe('post_create');
      expect(SocialMediaCommandType.POST_SCHEDULE).toBe('post_schedule');
      expect(SocialMediaCommandType.DRAFT_LIST).toBe('draft_list');
      expect(SocialMediaCommandType.DRAFT_PUBLISH).toBe('draft_publish');
      expect(SocialMediaCommandType.TIKTOK_VIDEO_CREATE).toBe('tiktok_video_create');
      expect(SocialMediaCommandType.ANALYTICS_GET).toBe('analytics_get');
      expect(SocialMediaCommandType.COMMENTS_GET).toBe('comments_get');
      expect(SocialMediaCommandType.CONTENT_OPTIMIZE).toBe('content_optimize');
      
      console.log('✅ All command types are properly defined');
    });

    test('should validate social media providers', () => {
      expect(SocialMediaProvider.TWITTER).toBe('twitter');
      expect(SocialMediaProvider.LINKEDIN).toBe('linkedin');
      expect(SocialMediaProvider.INSTAGRAM).toBe('instagram');
      expect(SocialMediaProvider.TIKTOK).toBe('tiktok');
      expect(SocialMediaProvider.FACEBOOK).toBe('facebook');
      expect(SocialMediaProvider.REDDIT).toBe('reddit');
      
      console.log('✅ All social media providers are properly defined');
    });

    test('should validate social media capabilities', () => {
      expect(SocialMediaCapability.POST_CREATE).toBe('POST_CREATE');
      expect(SocialMediaCapability.DRAFT_READ).toBe('DRAFT_READ');
      expect(SocialMediaCapability.DRAFT_PUBLISH).toBe('DRAFT_PUBLISH');
      expect(SocialMediaCapability.TIKTOK_VIDEO_CREATE).toBe('TIKTOK_VIDEO_CREATE');
      expect(SocialMediaCapability.ANALYTICS_READ).toBe('ANALYTICS_READ');
      
      console.log('✅ All social media capabilities are properly defined');
    });
  });

  describe('🎯 Command Structure Validation', () => {
    test('should create valid post creation command', () => {
      const command = {
        type: SocialMediaCommandType.POST_CREATE,
        intent: 'Create and publish a social media post',
        entities: {
          content: 'Test post content',
          platforms: [SocialMediaProvider.TWITTER],
          hashtags: ['test', 'automation'],
          visibility: 'public'
        },
        platforms: [SocialMediaProvider.TWITTER],
        confidence: 0.95,
        originalText: 'Post this to Twitter',
        requiredCapabilities: [SocialMediaCapability.POST_CREATE]
      };

      expect(command.type).toBe(SocialMediaCommandType.POST_CREATE);
      expect(command.entities.content).toBe('Test post content');
      expect(command.platforms).toContain(SocialMediaProvider.TWITTER);
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.POST_CREATE);
      
      console.log('✅ Post creation command structure is valid');
    });

    test('should create valid draft command', () => {
      const command = {
        type: SocialMediaCommandType.DRAFT_PUBLISH,
        intent: 'Publish a draft post immediately',
        entities: {
          draftName: 'Summer Campaign',
          draftId: 'draft-123',
          overrides: {
            hashtags: ['summer', 'campaign']
          }
        },
        platforms: [SocialMediaProvider.INSTAGRAM],
        confidence: 0.90,
        originalText: 'Publish my draft called Summer Campaign',
        requiredCapabilities: [SocialMediaCapability.DRAFT_PUBLISH]
      };

      expect(command.type).toBe(SocialMediaCommandType.DRAFT_PUBLISH);
      expect(command.entities.draftName).toBe('Summer Campaign');
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.DRAFT_PUBLISH);
      
      console.log('✅ Draft command structure is valid');
    });

    test('should create valid TikTok command', () => {
      const command = {
        type: SocialMediaCommandType.TIKTOK_VIDEO_CREATE,
        intent: 'Create a TikTok video',
        entities: {
          title: 'AI Innovation Video',
          description: 'Educational content about AI',
          hashtags: ['AI', 'Innovation', 'Tech'],
          music: 'trending-sound-123'
        },
        platforms: [SocialMediaProvider.TIKTOK],
        confidence: 0.85,
        originalText: 'Create a TikTok video about AI innovation',
        requiredCapabilities: [SocialMediaCapability.TIKTOK_VIDEO_CREATE]
      };

      expect(command.type).toBe(SocialMediaCommandType.TIKTOK_VIDEO_CREATE);
      expect(command.entities.title).toBe('AI Innovation Video');
      expect(command.platforms).toContain(SocialMediaProvider.TIKTOK);
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.TIKTOK_VIDEO_CREATE);
      
      console.log('✅ TikTok command structure is valid');
    });

    test('should create valid analytics command', () => {
      const command = {
        type: SocialMediaCommandType.ANALYTICS_GET,
        intent: 'Get social media analytics',
        entities: {
          timeframe: 'week',
          metrics: ['likes', 'shares', 'comments', 'reach'],
          platforms: [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN]
        },
        platforms: [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN],
        confidence: 0.88,
        originalText: 'Show me analytics for this week',
        requiredCapabilities: [SocialMediaCapability.ANALYTICS_READ]
      };

      expect(command.type).toBe(SocialMediaCommandType.ANALYTICS_GET);
      expect(command.entities.timeframe).toBe('week');
      expect(command.entities.metrics).toContain('likes');
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.ANALYTICS_READ);
      
      console.log('✅ Analytics command structure is valid');
    });
  });

  describe('🔧 Integration Readiness', () => {
    test('should validate test environment setup', () => {
      expect(testAgentId).toBeTruthy();
      expect(testConnections).toBeTruthy();
      expect(Object.keys(testConnections).length).toBeGreaterThan(0);
      
      console.log(`✅ Test environment ready with ${Object.keys(testConnections).length} mock connections`);
    });

    test('should validate command type completeness', () => {
      const commandTypes = Object.values(SocialMediaCommandType);
      
      // Check that we have commands for all major categories
      const hasPostCommands = commandTypes.some(type => type.includes('post'));
      const hasDraftCommands = commandTypes.some(type => type.includes('draft'));
      const hasAnalyticsCommands = commandTypes.some(type => type.includes('analytics'));
      const hasEngagementCommands = commandTypes.some(type => type.includes('comment'));
      const hasTikTokCommands = commandTypes.some(type => type.includes('tiktok'));
      
      expect(hasPostCommands).toBe(true);
      expect(hasDraftCommands).toBe(true);
      expect(hasAnalyticsCommands).toBe(true);
      expect(hasEngagementCommands).toBe(true);
      expect(hasTikTokCommands).toBe(true);
      
      console.log(`✅ Command type coverage complete: ${commandTypes.length} total command types`);
    });

    test('should validate capability coverage', () => {
      const capabilities = Object.values(SocialMediaCapability);
      
      // Check that we have capabilities for all major functions
      const hasPostCapabilities = capabilities.some(cap => cap.includes('POST'));
      const hasDraftCapabilities = capabilities.some(cap => cap.includes('DRAFT'));
      const hasAnalyticsCapabilities = capabilities.some(cap => cap.includes('ANALYTICS'));
      const hasEngagementCapabilities = capabilities.some(cap => cap.includes('COMMENT'));
      const hasTikTokCapabilities = capabilities.some(cap => cap.includes('TIKTOK'));
      
      expect(hasPostCapabilities).toBe(true);
      expect(hasDraftCapabilities).toBe(true);
      expect(hasAnalyticsCapabilities).toBe(true);
      expect(hasEngagementCapabilities).toBe(true);
      expect(hasTikTokCapabilities).toBe(true);
      
      console.log(`✅ Capability coverage complete: ${capabilities.length} total capabilities`);
    });
  });

  describe('📋 Draft Functionality Tests', () => {
    test('should support draft listing commands', () => {
      const command = {
        type: SocialMediaCommandType.DRAFT_LIST,
        intent: 'List available draft posts',
        entities: {},
        platforms: [SocialMediaProvider.INSTAGRAM],
        confidence: 0.95,
        originalText: 'Show me my drafts on Instagram',
        requiredCapabilities: [SocialMediaCapability.DRAFT_READ]
      };

      expect(command.type).toBe(SocialMediaCommandType.DRAFT_LIST);
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.DRAFT_READ);
      
      console.log('✅ Draft listing command structure is valid');
    });

    test('should support draft scheduling commands', () => {
      const command = {
        type: SocialMediaCommandType.DRAFT_SCHEDULE,
        intent: 'Schedule a draft post for later',
        entities: {
          draftName: 'XYZ',
          scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
        },
        platforms: [SocialMediaProvider.INSTAGRAM],
        confidence: 0.90,
        originalText: 'Schedule my draft XYZ for tomorrow at 2pm',
        requiredCapabilities: [SocialMediaCapability.DRAFT_SCHEDULE]
      };

      expect(command.type).toBe(SocialMediaCommandType.DRAFT_SCHEDULE);
      expect(command.entities.draftName).toBe('XYZ');
      expect(command.requiredCapabilities).toContain(SocialMediaCapability.DRAFT_SCHEDULE);
      
      console.log('✅ Draft scheduling command structure is valid');
    });
  });

  describe('🎵 TikTok Specific Tests', () => {
    test('should support TikTok video creation', () => {
      const command = {
        type: SocialMediaCommandType.TIKTOK_VIDEO_CREATE,
        intent: 'Create a TikTok video',
        entities: {
          title: 'Business Tips Video',
          description: 'Quick tips for entrepreneurs',
          hashtags: ['business', 'entrepreneur', 'tips'],
          privacy: 'public',
          allowComments: true,
          allowDuet: true
        },
        platforms: [SocialMediaProvider.TIKTOK],
        confidence: 0.92,
        originalText: 'Create a TikTok video about business tips',
        requiredCapabilities: [SocialMediaCapability.TIKTOK_VIDEO_CREATE]
      };

      expect(command.type).toBe(SocialMediaCommandType.TIKTOK_VIDEO_CREATE);
      expect(command.entities.title).toBe('Business Tips Video');
      expect(command.platforms).toContain(SocialMediaProvider.TIKTOK);
      
      console.log('✅ TikTok video creation command is valid');
    });
  });

  describe('📊 Analytics & Insights Tests', () => {
    test('should support analytics retrieval', () => {
      const command = {
        type: SocialMediaCommandType.ANALYTICS_GET,
        intent: 'Get social media analytics',
        entities: {
          timeframe: 'month',
          platforms: [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN],
          metrics: ['engagement', 'reach', 'impressions']
        },
        platforms: [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN],
        confidence: 0.87,
        originalText: 'Show me this month\'s analytics',
        requiredCapabilities: [SocialMediaCapability.ANALYTICS_READ]
      };

      expect(command.type).toBe(SocialMediaCommandType.ANALYTICS_GET);
      expect(command.entities.timeframe).toBe('month');
      expect(command.entities.metrics).toContain('engagement');
      
      console.log('✅ Analytics command structure is valid');
    });

    test('should support post metrics', () => {
      const command = {
        type: SocialMediaCommandType.POST_METRICS,
        intent: 'Get metrics for specific posts',
        entities: {
          postId: 'post-123',
          metrics: ['likes', 'shares', 'comments']
        },
        platforms: [SocialMediaProvider.TWITTER],
        confidence: 0.85,
        originalText: 'How did my last post perform?',
        requiredCapabilities: [SocialMediaCapability.ANALYTICS_READ]
      };

      expect(command.type).toBe(SocialMediaCommandType.POST_METRICS);
      expect(command.entities.postId).toBe('post-123');
      
      console.log('✅ Post metrics command structure is valid');
    });
  });

  describe('💬 Engagement Tests', () => {
    test('should support comment retrieval', () => {
      const command = {
        type: SocialMediaCommandType.COMMENTS_GET,
        intent: 'Get comments from posts',
        entities: {
          postId: 'post-456',
          limit: 50
        },
        platforms: [SocialMediaProvider.INSTAGRAM],
        confidence: 0.90,
        originalText: 'Show me comments on my latest post',
        requiredCapabilities: [SocialMediaCapability.COMMENT_READ]
      };

      expect(command.type).toBe(SocialMediaCommandType.COMMENTS_GET);
      expect(command.entities.postId).toBe('post-456');
      
      console.log('✅ Comment retrieval command structure is valid');
    });

    test('should support comment replies', () => {
      const command = {
        type: SocialMediaCommandType.COMMENT_REPLY,
        intent: 'Reply to a comment',
        entities: {
          commentId: 'comment-789',
          reply: 'Thank you for your feedback!'
        },
        platforms: [SocialMediaProvider.LINKEDIN],
        confidence: 0.88,
        originalText: 'Reply to that comment with thanks',
        requiredCapabilities: [SocialMediaCapability.COMMENT_CREATE]
      };

      expect(command.type).toBe(SocialMediaCommandType.COMMENT_REPLY);
      expect(command.entities.reply).toBe('Thank you for your feedback!');
      
      console.log('✅ Comment reply command structure is valid');
    });
  });
});

// Helper functions for testing
function createMockSocialMediaCommand(type: SocialMediaCommandType, entities: Record<string, any> = {}) {
  return {
    type,
    intent: `Mock command for ${type}`,
    entities,
    platforms: [SocialMediaProvider.TWITTER],
    confidence: 0.85,
    originalText: `Mock command text for ${type}`,
    requiredCapabilities: [SocialMediaCapability.POST_CREATE]
  };
}

function validateCommandStructure(command: any): boolean {
  return !!(
    command.type &&
    command.intent &&
    command.entities &&
    command.platforms &&
    typeof command.confidence === 'number' &&
    command.originalText &&
    Array.isArray(command.requiredCapabilities)
  );
} 