import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SocialMediaService } from '../../src/services/social-media/SocialMediaService';
import { PrismaSocialMediaDatabase } from '../../src/services/social-media/database/PrismaSocialMediaDatabase';
import { SocialMediaAgentTools } from '../../src/services/social-media/tools/SocialMediaAgentTools';
import {
  SocialMediaProvider,
  SocialMediaCapability,
  AccessLevel,
  SocialMediaConnectionStatus
} from '../../src/services/social-media/database/ISocialMediaDatabase';
import { ulid } from 'ulid';
import { PrismaClient } from '@prisma/client';

describe('Social Media Capabilities Integration Tests', () => {
  let socialMediaService: SocialMediaService;
  let socialMediaDatabase: PrismaSocialMediaDatabase;
  let socialMediaTools: SocialMediaAgentTools;
  let prisma: PrismaClient;
  let testAgentId: string;
  let testConnectionId: string;

  beforeEach(async () => {
    // Initialize services
    prisma = new PrismaClient();
    socialMediaDatabase = new PrismaSocialMediaDatabase(prisma);
    socialMediaService = new SocialMediaService(socialMediaDatabase, new Map());
    socialMediaTools = new SocialMediaAgentTools(socialMediaService, socialMediaDatabase);

    // Create test agent ID
    testAgentId = `agent_${ulid()}`;

    // Create test social media connection
    testConnectionId = await createTestSocialMediaConnection();

    // Grant permissions to test agent
    await grantTestPermissions();
  });

  afterEach(async () => {
    // Clean up test social media connections
    try {
      const allConnections = await socialMediaDatabase.getConnectionsByUser('test-user');
      const testConnections = allConnections.filter(conn =>
        conn.accountDisplayName.includes('[TEST]') ||
        conn.accountUsername === 'test_account'
      );

      if (testConnections.length > 0) {
        console.log(`🧹 Cleaning up ${testConnections.length} test social media connections...`);

        for (const connection of testConnections) {
          try {
            // Delete related permissions first
            const permissions = await socialMediaDatabase.getConnectionPermissions(connection.id);
            for (const permission of permissions) {
              await socialMediaDatabase.revokePermission(permission.id);
            }

            // Delete the connection
            await socialMediaDatabase.deleteConnection(connection.id);
            console.log(`  ✅ Deleted test connection: ${connection.id}`);
          } catch (error) {
            console.warn(`  ⚠️ Failed to cleanup connection ${connection.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup test social media connections:', error);
    }

    // Close Prisma connection
    await prisma.$disconnect();
  });

  describe('Database Operations', () => {
    it('should create and retrieve social media connections', async () => {
      const connection = await socialMediaDatabase.getConnection(testConnectionId);

      expect(connection).toBeDefined();
      expect(connection?.id).toBe(testConnectionId);
      expect(connection?.provider).toBe(SocialMediaProvider.TWITTER);
      expect(connection?.accountDisplayName).toBe('[TEST] Test Account');
      expect(connection?.connectionStatus).toBe(SocialMediaConnectionStatus.ACTIVE);
    });

    it('should grant and retrieve agent permissions', async () => {
      const permissions = await socialMediaDatabase.getAgentPermissions(testAgentId);

      expect(permissions.length).toBeGreaterThan(0);

      const permission = permissions[0];
      expect(permission.agentId).toBe(testAgentId);
      expect(permission.connectionId).toBe(testConnectionId);
      expect(permission.capabilities).toContain(SocialMediaCapability.POST_CREATE);
      expect(permission.accessLevel).toBe(AccessLevel.FULL);
    });

    it('should validate permissions correctly', async () => {
      const hasPermission = await socialMediaDatabase.validatePermissions(
        testAgentId,
        testConnectionId,
        [SocialMediaCapability.POST_CREATE]
      );

      expect(hasPermission).toBe(true);

      const lacksPermission = await socialMediaDatabase.validatePermissions(
        testAgentId,
        testConnectionId,
        [SocialMediaCapability.TIKTOK_LIVE_CREATE] // Not granted
      );

      expect(lacksPermission).toBe(false);
    });
  });

  describe('Social Media Tools', () => {
    it('should get available tools based on permissions', async () => {
      const availableTools = await socialMediaTools.getAvailableTools(testAgentId);

      expect(availableTools.length).toBeGreaterThan(0);

      const toolNames = availableTools.map(t => t.name);

      console.log(`Available tools: ${toolNames.join(', ')}`);

      // Content creation tools
      expect(toolNames).toContain('create_text_post');
      expect(toolNames).toContain('create_image_post');
      expect(toolNames).toContain('create_video_post');

      // Check that we have some tools available
      expect(availableTools.length).toBeGreaterThan(0);

      console.log(`✅ Found ${availableTools.length} available tools for agent`);
    });

    it('should validate tool parameters correctly', async () => {
      const tools = await socialMediaTools.getAvailableTools(testAgentId);
      const createPostTool = tools.find(t => t.name === 'create_text_post');

      expect(createPostTool).toBeDefined();
      expect(createPostTool?.parameters).toBeDefined();
      expect(createPostTool?.parameters.properties).toBeDefined();
      expect(createPostTool?.parameters.properties.content).toBeDefined();
      expect(createPostTool?.parameters.properties.platforms).toBeDefined();

      console.log('✅ Tool parameters validated successfully');
    });
  });

  describe('Service Integration', () => {
    it('should handle social media service operations', async () => {
      // Test that the service can be initialized and basic operations work
      expect(socialMediaService).toBeDefined();

      const connections = await socialMediaService.getConnections('test-user');
      expect(Array.isArray(connections)).toBe(true);

      console.log(`✅ Service operations working correctly`);
    });

    it('should handle permission validation through service', async () => {
      const hasPermission = await socialMediaService.validateAgentPermissions(
        testAgentId,
        testConnectionId,
        [SocialMediaCapability.POST_CREATE]
      );

      expect(hasPermission).toBe(true);

      console.log('✅ Service permission validation working');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid connection IDs gracefully', async () => {
      const invalidConnectionId = 'invalid-connection-id';

      const connection = await socialMediaDatabase.getConnection(invalidConnectionId);
      expect(connection).toBeNull();

      console.log('✅ Invalid connection ID handled gracefully');
    });

    it('should handle invalid agent IDs gracefully', async () => {
      const invalidAgentId = 'invalid-agent-id';

      const permissions = await socialMediaDatabase.getAgentPermissions(invalidAgentId);
      expect(permissions).toEqual([]);

      console.log('✅ Invalid agent ID handled gracefully');
    });

    it('should handle permission validation for non-existent permissions', async () => {
      const nonExistentAgentId = `agent_${ulid()}`;

      const hasPermission = await socialMediaDatabase.validatePermissions(
        nonExistentAgentId,
        testConnectionId,
        [SocialMediaCapability.POST_CREATE]
      );

      expect(hasPermission).toBe(false);

      console.log('✅ Non-existent permissions handled gracefully');
    });
  });

  describe('Capability Coverage', () => {
    it('should support all major social media capabilities', () => {
      const capabilities = Object.values(SocialMediaCapability);

      // Check that we have capabilities for all major functions
      const hasPostCapabilities = capabilities.some(cap => cap.includes('POST'));
      const hasDraftCapabilities = capabilities.some(cap => cap.includes('DRAFT'));
      const hasAnalyticsCapabilities = capabilities.some(cap => cap.includes('ANALYTICS'));
      const hasEngagementCapabilities = capabilities.some(cap => cap.includes('COMMENT'));
      const hasTikTokCapabilities = capabilities.some(cap => cap.includes('TIKTOK'));
      const hasXPatternsCapabilities = capabilities.some(cap => cap.includes('CROSS_PLATFORM'));

      expect(hasPostCapabilities).toBe(true);
      expect(hasDraftCapabilities).toBe(true);
      expect(hasAnalyticsCapabilities).toBe(true);
      expect(hasEngagementCapabilities).toBe(true);
      expect(hasTikTokCapabilities).toBe(true);
      expect(hasXPatternsCapabilities).toBe(true);

      console.log(`✅ Capability coverage complete: ${capabilities.length} total capabilities`);
      console.log(`🎯 XPatterns cross-platform capabilities: ${hasXPatternsCapabilities ? 'SUPPORTED' : 'MISSING'}`);
    });

    it('should support all major social media providers', () => {
      const providers = Object.values(SocialMediaProvider);

      expect(providers).toContain(SocialMediaProvider.TWITTER);
      expect(providers).toContain(SocialMediaProvider.LINKEDIN);
      expect(providers).toContain(SocialMediaProvider.INSTAGRAM);
      expect(providers).toContain(SocialMediaProvider.TIKTOK);
      expect(providers).toContain(SocialMediaProvider.FACEBOOK);
      expect(providers).toContain(SocialMediaProvider.REDDIT);

      console.log(`✅ Provider coverage complete: ${providers.length} total providers`);
    });
  });

  // Helper functions
  async function createTestSocialMediaConnection(): Promise<string> {
    const connection = await socialMediaDatabase.createConnection({
      userId: 'test-user',
      organizationId: 'test-org',
      provider: SocialMediaProvider.TWITTER,
      providerAccountId: 'test_account_123',
      accountDisplayName: '[TEST] Test Account',
      accountUsername: 'test_account',
      accountType: 'business',
      encryptedCredentials: 'test_encrypted_credentials',
      scopes: ['read', 'write', 'analytics'],
      connectionStatus: SocialMediaConnectionStatus.ACTIVE,
      metadata: { test: true },
      lastValidated: new Date()
    });

    console.log(`Created test social media connection: ${connection.accountDisplayName}`);
    return connection.id;
  }

  async function grantTestPermissions(): Promise<void> {
    const allCapabilities = [
      SocialMediaCapability.POST_CREATE,
      SocialMediaCapability.POST_READ,
      SocialMediaCapability.POST_EDIT,
      SocialMediaCapability.POST_DELETE,
      SocialMediaCapability.STORY_CREATE,
      SocialMediaCapability.STORY_READ,
      SocialMediaCapability.VIDEO_UPLOAD,
      SocialMediaCapability.IMAGE_UPLOAD,
      SocialMediaCapability.COMMENT_READ,
      SocialMediaCapability.COMMENT_CREATE,
      SocialMediaCapability.LIKE_CREATE,
      SocialMediaCapability.SHARE_CREATE,
      SocialMediaCapability.ANALYTICS_READ,
      SocialMediaCapability.INSIGHTS_READ,
      SocialMediaCapability.DM_READ,
      SocialMediaCapability.DM_SEND,
      SocialMediaCapability.DRAFT_READ,
      SocialMediaCapability.DRAFT_PUBLISH,
      SocialMediaCapability.DRAFT_SCHEDULE
    ];

    await socialMediaDatabase.grantPermission({
      agentId: testAgentId,
      connectionId: testConnectionId,
      capabilities: allCapabilities,
      accessLevel: AccessLevel.FULL,
      restrictions: {},
      grantedBy: 'test-system',
      isActive: true
    });

    console.log(`✅ Granted ${allCapabilities.length} capabilities to test agent`);
  }
}); 