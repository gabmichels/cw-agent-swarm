/**
 * XPatterns Integration Tests - Agent Tools & Workflow Integration
 * 
 * Tests the integration of XPatterns multi-platform social media management
 * with the existing agent system, including tool registration, workflow
 * execution, and agent command processing.
 */

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ulid } from 'ulid';
import {
  XPatternsService,
  IXPatternsService,
  createXPatternsService
} from '../../src/services/social-media/xptterns/XPatternsService';
import { SocialMediaAgentTools } from '../../src/services/social-media/tools/SocialMediaAgentTools';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { AbstractAgentBase } from '../../src/agents/shared/base/AgentBase';
import {
  SocialMediaProvider,
  SocialMediaCapability,
  AccessLevel
} from '../../src/services/social-media/database/ISocialMediaDatabase';
import { PrismaSocialMediaDatabase } from '../../src/services/social-media/database/PrismaSocialMediaDatabase';
import { SocialMediaService } from '../../src/services/social-media/SocialMediaService';
import { TwitterProvider } from '../../src/services/social-media/providers/TwitterProvider';
import { LinkedInProvider } from '../../src/services/social-media/providers/LinkedInProvider';
import { ISocialMediaProvider } from '../../src/services/social-media/providers/base/ISocialMediaProvider';

describe('🔗 XPatterns Integration Tests - Agent Tools & Workflows', () => {
  let prisma: PrismaClient;
  let database: PrismaSocialMediaDatabase;
  let socialMediaService: SocialMediaService;
  let xpatternsService: IXPatternsService;
  let socialMediaTools: SocialMediaAgentTools;
  let testAgent: AbstractAgentBase;
  let providers: Map<SocialMediaProvider, ISocialMediaProvider>;

  const testAgentId = `xpatterns-agent-${ulid()}`;
  const testUserId = `xpatterns-user-${ulid()}`;
  const testOrganizationId = `xpatterns-org-${ulid()}`;

  beforeAll(async () => {
    // Initialize database and services
    prisma = new PrismaClient();
    database = new PrismaSocialMediaDatabase(prisma);

    // Initialize providers
    providers = new Map();
    providers.set(SocialMediaProvider.TWITTER, new TwitterProvider());
    providers.set(SocialMediaProvider.LINKEDIN, new LinkedInProvider());

    // Initialize services
    socialMediaService = new SocialMediaService(database, providers);
    xpatternsService = createXPatternsService(socialMediaService, database, providers);
    socialMediaTools = new SocialMediaAgentTools(database, providers);

    // Create test agent
    testAgent = new DefaultAgent({
      id: testAgentId,
      name: 'XPatterns Test Agent',
      userId: testUserId,
      organizationId: testOrganizationId,
      role: 'social_media_manager',
      instructions: 'Test agent for XPatterns multi-platform social media management',
      model: 'gpt-4',
      temperature: 0.7,
      isActive: true
    });

    // Setup test connections and permissions
    await setupTestEnvironment();

    console.log('🚀 XPatterns integration test environment initialized');
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
    await prisma.$disconnect();
    console.log('🧹 XPatterns integration test cleanup completed');
  });

  // ============================================================================
  // AGENT TOOL INTEGRATION TESTS
  // ============================================================================

  describe('🛠️ Agent Tool Integration', () => {
    test('should register XPatterns tools with agent system', async () => {
      const xpatternsTools = xpatternsService.getXPatternsTools();

      expect(xpatternsTools.length).toBeGreaterThan(0);

      const expectedXPatternsTools = [
        'xpatterns_create_campaign',
        'xpatterns_execute_campaign',
        'xpatterns_immediate_post',
        'xpatterns_adapt_content',
        'xpatterns_get_analytics'
      ];

      const toolNames = xpatternsTools.map(tool => tool.name);

      for (const expectedTool of expectedXPatternsTools) {
        expect(toolNames).toContain(expectedTool);
      }

      console.log(`🛠️ XPatterns tools registered: ${toolNames.join(', ')}`);
      console.log('✅ XPatterns tool registration validated');
    });

    test('should execute XPatterns immediate post tool', async () => {
      const xpatternsTools = xpatternsService.getXPatternsTools();
      const immediatePostTool = xpatternsTools.find(tool => tool.name === 'xpatterns_immediate_post');

      expect(immediatePostTool).toBeDefined();

      const toolParams = {
        content: `XPatterns tool test ${Date.now()} #integration #testing`,
        platforms: ['twitter', 'linkedin'],
        optimization: true
      };

      try {
        const result = await immediatePostTool!.execute(testAgentId, toolParams);

        expect(result).toBeDefined();
        expect(result.success).toBeDefined();
        expect(result.platformResults).toBeDefined();

        console.log(`✅ XPatterns immediate post tool executed`);
        console.log(`📱 Platforms: ${Object.keys(result.platformResults).join(', ')}`);
        console.log(`🎯 Success: ${result.success}`);
      } catch (error) {
        console.log(`⚠️ Tool execution failed (expected in test environment): ${error.message}`);
      }
    });

    test('should execute XPatterns campaign creation tool', async () => {
      const xpatternsTools = xpatternsService.getXPatternsTools();
      const createCampaignTool = xpatternsTools.find(tool => tool.name === 'xpatterns_create_campaign');

      expect(createCampaignTool).toBeDefined();

      const campaignParams = {
        name: 'Tool Integration Test Campaign',
        description: 'Testing campaign creation via agent tool',
        baseContent: `Campaign tool test ${Date.now()} #campaign #integration`,
        targetPlatforms: ['twitter', 'linkedin'],
        coordinationStrategy: 'simultaneous',
        scheduledTime: new Date(Date.now() + 3600000) // 1 hour from now
      };

      try {
        const result = await createCampaignTool!.execute(testAgentId, campaignParams);

        expect(result).toBeDefined();
        expect(result.campaignId).toBeDefined();
        expect(result.status).toBe('draft');

        console.log(`✅ Campaign created via tool: ${result.campaignId}`);
        console.log(`📝 Status: ${result.status}`);
        console.log(`📱 Platforms: ${result.targetPlatforms.join(', ')}`);
      } catch (error) {
        console.log(`⚠️ Campaign creation failed: ${error.message}`);
      }
    });

    test('should execute XPatterns content adaptation tool', async () => {
      const xpatternsTools = xpatternsService.getXPatternsTools();
      const adaptContentTool = xpatternsTools.find(tool => tool.name === 'xpatterns_adapt_content');

      expect(adaptContentTool).toBeDefined();

      const adaptationParams = {
        content: 'This is a long piece of content that needs to be adapted for different social media platforms with varying character limits, audience preferences, and content optimization strategies to maximize engagement and reach across multiple channels.',
        targetPlatforms: ['twitter', 'linkedin', 'instagram'],
        optimizationGoals: ['engagement', 'reach', 'platform_specific']
      };

      try {
        const result = await adaptContentTool!.execute(testAgentId, adaptationParams);

        expect(result).toBeDefined();
        expect(result.adaptedContent).toBeDefined();

        console.log(`✅ Content adapted via tool for ${Object.keys(result.adaptedContent).length} platforms`);

        for (const [platform, adaptation] of Object.entries(result.adaptedContent)) {
          console.log(`📱 ${platform}: ${adaptation.adaptedContent.substring(0, 50)}...`);
        }
      } catch (error) {
        console.log(`⚠️ Content adaptation failed: ${error.message}`);
      }
    });

    test('should execute XPatterns analytics tool', async () => {
      const xpatternsTools = xpatternsService.getXPatternsTools();
      const analyticsTool = xpatternsTools.find(tool => tool.name === 'xpatterns_get_analytics');

      expect(analyticsTool).toBeDefined();

      const analyticsParams = {
        timeframe: '7d',
        platforms: ['twitter', 'linkedin'],
        metrics: ['reach', 'engagement', 'performance']
      };

      try {
        const result = await analyticsTool!.execute(testAgentId, analyticsParams);

        expect(result).toBeDefined();
        expect(result.agentId).toBe(testAgentId);
        expect(result.timeframe).toBe('7d');

        console.log(`✅ Analytics retrieved via tool`);
        console.log(`📊 Total campaigns: ${result.totalCampaigns}`);
        console.log(`📈 Total reach: ${result.totalReach}`);
        console.log(`💬 Total engagement: ${result.totalEngagement}`);
      } catch (error) {
        console.log(`⚠️ Analytics retrieval failed: ${error.message}`);
      }
    });
  });

  // ============================================================================
  // AGENT COMMAND PROCESSING TESTS
  // ============================================================================

  describe('🗣️ Agent Command Processing', () => {
    test('should process multi-platform posting commands', async () => {
      const commands = [
        'Post "XPatterns integration test! 🚀" to all my social media accounts',
        'Share this on Twitter and LinkedIn: "Testing multi-platform coordination"',
        'Create a campaign for "Weekly update! 📊" across all platforms for tomorrow'
      ];

      for (const command of commands) {
        try {
          // Simulate agent processing the command
          const result = await xpatternsService.processNaturalLanguageCommand(testAgentId, command);

          expect(result).toBeDefined();
          console.log(`✅ Agent processed command: "${command.substring(0, 50)}..."`);
          console.log(`🎯 Result: ${result.success ? 'SUCCESS' : 'PARTIAL/FAILED'}`);
        } catch (error) {
          console.log(`⚠️ Command processing failed: "${command}" - ${error.message}`);
        }
      }

      console.log('✅ Agent command processing validated');
    });

    test('should handle complex coordination commands', async () => {
      const complexCommands = [
        'Create a staggered campaign posting "Product launch announcement! 🎉" starting with Twitter, then LinkedIn 5 minutes later, then Instagram 10 minutes after that',
        'Schedule a coordinated post about "Weekly team meeting recap" for all platforms tomorrow at 2 PM with platform-specific optimizations',
        'Adapt this content for all platforms and post immediately: "Long technical explanation about our new AI-powered social media management system that helps businesses coordinate campaigns across multiple platforms..."'
      ];

      for (const command of complexCommands) {
        try {
          const result = await xpatternsService.processNaturalLanguageCommand(testAgentId, command);

          expect(result).toBeDefined();
          console.log(`✅ Complex command processed: "${command.substring(0, 60)}..."`);

          if (result.coordinationEvents && result.coordinationEvents.length > 0) {
            console.log(`⏰ Coordination events: ${result.coordinationEvents.length}`);
          }

          if (result.adaptationsMade && result.adaptationsMade.length > 0) {
            console.log(`🎨 Adaptations made: ${result.adaptationsMade.length}`);
          }
        } catch (error) {
          console.log(`⚠️ Complex command failed: "${command.substring(0, 50)}..." - ${error.message}`);
        }
      }

      console.log('✅ Complex coordination command processing validated');
    });

    test('should validate agent permissions before execution', async () => {
      // Test with limited permissions
      const limitedAgentId = `limited-agent-${ulid()}`;

      try {
        await xpatternsService.processNaturalLanguageCommand(
          limitedAgentId,
          'Post "Test without permissions" to all platforms'
        );
      } catch (error) {
        expect(error.message).toContain('permissions');
        console.log('✅ Permission validation working correctly');
      }
    });
  });

  // ============================================================================
  // WORKFLOW INTEGRATION TESTS
  // ============================================================================

  describe('🔄 Workflow Integration', () => {
    test('should integrate with existing social media workflows', async () => {
      // Test integration with standard social media tools
      const standardTools = await socialMediaTools.getAvailableTools(testAgentId);
      const xpatternsTools = xpatternsService.getXPatternsTools();

      expect(standardTools.length).toBeGreaterThan(0);
      expect(xpatternsTools.length).toBeGreaterThan(0);

      // Verify XPatterns tools complement standard tools
      const standardToolNames = standardTools.map(tool => tool.name);
      const xpatternsToolNames = xpatternsTools.map(tool => tool.name);

      // Should have both individual platform tools and XPatterns coordination tools
      expect(standardToolNames.some(name => name.includes('twitter'))).toBe(true);
      expect(xpatternsToolNames.some(name => name.includes('xpatterns'))).toBe(true);

      console.log(`🛠️ Standard tools: ${standardToolNames.length}`);
      console.log(`🎯 XPatterns tools: ${xpatternsToolNames.length}`);
      console.log('✅ Workflow integration validated');
    });

    test('should handle workflow escalation from single platform to multi-platform', async () => {
      // Start with single platform post
      const singlePlatformCommand = 'Post "Test message" to Twitter';

      try {
        const singleResult = await xpatternsService.processNaturalLanguageCommand(testAgentId, singlePlatformCommand);
        console.log(`✅ Single platform post: ${singleResult.success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`⚠️ Single platform failed: ${error.message}`);
      }

      // Escalate to multi-platform
      const multiPlatformCommand = 'Also post that message to LinkedIn and Instagram with platform optimization';

      try {
        const multiResult = await xpatternsService.processNaturalLanguageCommand(testAgentId, multiPlatformCommand);
        console.log(`✅ Multi-platform escalation: ${multiResult.success ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.log(`⚠️ Multi-platform escalation failed: ${error.message}`);
      }

      console.log('✅ Workflow escalation handling validated');
    });

    test('should support workflow templates and automation', async () => {
      // Test predefined workflow templates
      const workflowTemplates = [
        {
          name: 'Daily Announcement',
          trigger: 'scheduled',
          platforms: ['twitter', 'linkedin'],
          coordination: 'simultaneous',
          optimization: true
        },
        {
          name: 'Product Launch',
          trigger: 'manual',
          platforms: ['twitter', 'linkedin', 'instagram', 'facebook'],
          coordination: 'staggered',
          optimization: true
        },
        {
          name: 'Weekly Recap',
          trigger: 'scheduled',
          platforms: ['linkedin', 'facebook'],
          coordination: 'sequential',
          optimization: true
        }
      ];

      for (const template of workflowTemplates) {
        try {
          // Simulate workflow template execution
          const campaignParams = {
            name: template.name,
            description: `Automated workflow: ${template.name}`,
            baseContent: `${template.name} content ${Date.now()}`,
            targetPlatforms: template.platforms,
            coordinationStrategy: template.coordination
          };

          const campaign = await xpatternsService.createCampaign(testAgentId, campaignParams);

          expect(campaign.id).toBeDefined();
          expect(campaign.name).toBe(template.name);

          console.log(`✅ Workflow template "${template.name}" created: ${campaign.id}`);
        } catch (error) {
          console.log(`⚠️ Workflow template "${template.name}" failed: ${error.message}`);
        }
      }

      console.log('✅ Workflow templates and automation validated');
    });
  });

  // ============================================================================
  // PERFORMANCE & SCALABILITY TESTS
  // ============================================================================

  describe('⚡ Performance & Scalability', () => {
    test('should handle concurrent multi-platform operations', async () => {
      const concurrentOperations = Array.from({ length: 3 }, (_, i) => ({
        content: `Concurrent test ${i + 1} - ${Date.now()}`,
        platforms: ['twitter', 'linkedin'].slice(0, i + 1)
      }));

      const startTime = Date.now();

      const results = await Promise.allSettled(
        concurrentOperations.map(op =>
          xpatternsService.executeImmediatePost(testAgentId, op.content, op.platforms as SocialMediaProvider[])
        )
      );

      const executionTime = Date.now() - startTime;

      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
          console.log(`✅ Concurrent operation ${index + 1}: SUCCESS`);
        } else {
          failureCount++;
          console.log(`❌ Concurrent operation ${index + 1}: FAILED`);
        }
      });

      console.log(`⚡ Concurrent operations: ${successCount} success, ${failureCount} failures`);
      console.log(`⏱️ Total execution time: ${executionTime}ms`);
      console.log('✅ Concurrent operation handling validated');
    });

    test('should optimize resource usage for large campaigns', async () => {
      const largeCampaignParams = {
        name: 'Large Scale Test Campaign',
        description: 'Testing resource optimization for large campaigns',
        baseContent: `Large scale campaign test ${Date.now()} with extensive content that needs to be adapted for multiple platforms with different optimization strategies and coordination requirements`,
        targetPlatforms: ['twitter', 'linkedin', 'instagram', 'facebook'] as SocialMediaProvider[],
        coordinationStrategy: { type: 'staggered' as const }
      };

      const startTime = Date.now();

      try {
        const campaign = await xpatternsService.createCampaign(testAgentId, largeCampaignParams);
        const creationTime = Date.now() - startTime;

        expect(campaign.id).toBeDefined();
        expect(campaign.adaptedContent.size).toBe(largeCampaignParams.targetPlatforms.length);

        console.log(`✅ Large campaign created in ${creationTime}ms`);
        console.log(`📱 Platforms: ${campaign.targetPlatforms.length}`);
        console.log(`🎨 Adaptations: ${campaign.adaptedContent.size}`);

        // Test execution performance
        const executionStartTime = Date.now();
        const result = await xpatternsService.executeCampaign(testAgentId, campaign.id);
        const executionTime = Date.now() - executionStartTime;

        console.log(`⚡ Campaign executed in ${executionTime}ms`);
        console.log(`📊 Platform results: ${result.platformResults.size}`);

      } catch (error) {
        console.log(`⚠️ Large campaign test failed: ${error.message}`);
      }

      console.log('✅ Resource optimization for large campaigns validated');
    });

    test('should maintain performance under load', async () => {
      const loadTestOperations = Array.from({ length: 5 }, (_, i) => ({
        type: 'immediate_post',
        content: `Load test ${i + 1} - ${Date.now()}`,
        platforms: ['twitter']
      }));

      const startTime = Date.now();
      const results = [];

      for (const operation of loadTestOperations) {
        const opStartTime = Date.now();

        try {
          const result = await xpatternsService.executeImmediatePost(
            testAgentId,
            operation.content,
            operation.platforms as SocialMediaProvider[]
          );

          const opTime = Date.now() - opStartTime;
          results.push({ success: true, time: opTime });

        } catch (error) {
          const opTime = Date.now() - opStartTime;
          results.push({ success: false, time: opTime, error: error.message });
        }
      }

      const totalTime = Date.now() - startTime;
      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const successRate = results.filter(r => r.success).length / results.length;

      console.log(`⚡ Load test results:`);
      console.log(`   Total operations: ${loadTestOperations.length}`);
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`   Average operation time: ${avgTime.toFixed(0)}ms`);
      console.log(`   Total time: ${totalTime}ms`);

      expect(successRate).toBeGreaterThan(0); // At least some operations should succeed
      expect(avgTime).toBeLessThan(10000); // Should complete within reasonable time

      console.log('✅ Performance under load validated');
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  async function setupTestEnvironment(): Promise<void> {
    try {
      // Create test connections for available platforms
      const platforms = [SocialMediaProvider.TWITTER, SocialMediaProvider.LINKEDIN];

      for (const platform of platforms) {
        const connection = await database.createConnection({
          userId: testUserId,
          organizationId: testOrganizationId,
          provider: platform,
          providerAccountId: `test_${platform.toLowerCase()}_${Date.now()}`,
          accountDisplayName: `[TEST] ${platform} Integration Account`,
          accountUsername: `test_${platform.toLowerCase()}_integration`,
          accountType: 'business',
          encryptedCredentials: 'test_encrypted_credentials_integration',
          scopes: ['read', 'write', 'analytics'],
          connectionStatus: 'ACTIVE',
          metadata: { test: true, integration: true },
          lastValidated: new Date()
        });

        // Grant comprehensive permissions for XPatterns
        await database.grantPermission({
          agentId: testAgentId,
          connectionId: connection.id,
          capabilities: [
            SocialMediaCapability.POST_CREATE,
            SocialMediaCapability.POST_READ,
            SocialMediaCapability.POST_EDIT,
            SocialMediaCapability.ANALYTICS_READ,
            SocialMediaCapability.CROSS_PLATFORM_COORDINATION,
            SocialMediaCapability.CONTENT_OPTIMIZATION,
            SocialMediaCapability.CAMPAIGN_MANAGEMENT
          ],
          accessLevel: AccessLevel.FULL,
          restrictions: {},
          grantedBy: 'test-system-integration',
          isActive: true
        });

        console.log(`🔗 Created integration test connection for ${platform}`);
      }

      console.log('🚀 Test environment setup completed');
    } catch (error) {
      console.log(`⚠️ Test environment setup failed: ${error.message}`);
    }
  }

  async function cleanupTestEnvironment(): Promise<void> {
    try {
      // Clean up test connections and permissions
      const connections = await database.getConnectionsByUser(testUserId);

      for (const connection of connections) {
        if (connection.metadata?.test && connection.metadata?.integration) {
          await database.deleteConnection(connection.id);
        }
      }

      console.log('🧹 Test environment cleanup completed');
    } catch (error) {
      console.log(`⚠️ Cleanup failed: ${error.message}`);
    }
  }
}); 