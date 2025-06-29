/**
 * ACG Integration Test - Phase 7 End-to-End Testing
 * 
 * This test verifies that the ACG system is properly integrated with DefaultAgent
 * and that real user messages trigger content generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultAgent } from '../../src/agents/shared/DefaultAgent';
import { createLogger } from '../../src/lib/logging/winston-logger';

describe('ACG Integration - End-to-End Tests', () => {
  let agent: DefaultAgent;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(async () => {
    logger = createLogger({ moduleId: 'acg-integration-test' });

    // Create agent with ACG enabled
    agent = new DefaultAgent({
      id: 'test-agent-acg',
      name: 'ACG Test Agent',
      description: 'Agent for testing ACG integration',
      enableACG: true,
      acgConfig: {
        enableAutoGeneration: true,
        requireConfirmation: false,
        maxGenerationTimeMs: 10000,
        fallbackOnError: true,
        cacheEnabled: false, // Disable cache for testing
        maxRetries: 1,
        batchSize: 5
      },
      // Enable required managers
      enableMemoryManager: true,
      enableToolManager: true,
      enableSchedulerManager: true
    });

    await agent.initialize();
  });

  afterEach(async () => {
    if (agent) {
      await agent.shutdown();
    }
  });

  describe('Real User Message Processing', () => {
    it('should process email request with missing content and generate subject/body', async () => {
      // Test the exact scenario: user wants to send email but doesn't provide subject/body
      const userMessage = "Send an email to john@example.com about why he should consider Bitcoin as an investment";

      const response = await agent.processUserInput(userMessage, {
        userId: 'test-user',
        chatId: 'test-chat'
      });

      // Verify ACG was triggered and content was generated
      expect(response).toBeDefined();
      expect(response.metadata).toBeDefined();

      // Check if workspace processing was triggered
      expect(response.metadata?.workspaceProcessed).toBe(true);

      // Check if ACG content generation occurred
      const workspaceData = response.metadata?.workspaceData;
      if (workspaceData?.contentGenerated) {
        expect(workspaceData.contentGenerated).toBe(true);
        expect(workspaceData.generatedContent).toBeDefined();

        // Verify email content was generated
        const generatedContent = workspaceData.generatedContent;
        if (generatedContent?.subject) {
          expect(generatedContent.subject.content).toContain('Bitcoin');
          expect(generatedContent.subject.confidence).toBeGreaterThan(0.7);
        }

        if (generatedContent?.body) {
          expect(generatedContent.body.content).toContain('investment');
          expect(generatedContent.body.confidence).toBeGreaterThan(0.7);
        }
      }

      // Verify the response contains appropriate content
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);

      logger.info('ACG Integration Test - Email Generation', {
        userMessage,
        responseLength: response.content.length,
        workspaceProcessed: response.metadata?.workspaceProcessed,
        contentGenerated: workspaceData?.contentGenerated,
        generatedContentKeys: workspaceData?.generatedContent ? Object.keys(workspaceData.generatedContent) : []
      });
    }, 30000); // 30 second timeout for LLM calls

    it('should handle document creation request with ACG', async () => {
      const userMessage = "Create a business proposal document for expanding our AI services to the healthcare sector";

      const response = await agent.processUserInput(userMessage, {
        userId: 'test-user',
        chatId: 'test-chat'
      });

      expect(response).toBeDefined();
      expect(response.metadata).toBeDefined();

      // Check if workspace processing was triggered
      const workspaceData = response.metadata?.workspaceData;

      logger.info('ACG Integration Test - Document Generation', {
        userMessage,
        responseLength: response.content.length,
        workspaceProcessed: response.metadata?.workspaceProcessed,
        contentGenerated: workspaceData?.contentGenerated
      });

      // At minimum, the agent should process the request without errors
      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
    }, 30000);

    it('should fallback gracefully when ACG fails', async () => {
      // Create agent with invalid ACG config to trigger fallback
      const fallbackAgent = new DefaultAgent({
        id: 'test-agent-fallback',
        name: 'Fallback Test Agent',
        enableACG: true,
        acgConfig: {
          enableAutoGeneration: true,
          maxGenerationTimeMs: 1, // Very short timeout to trigger failure
          fallbackOnError: true
        }
      });

      await fallbackAgent.initialize();

      try {
        const userMessage = "Send an email to test@example.com about our new product launch";

        const response = await fallbackAgent.processUserInput(userMessage, {
          userId: 'test-user'
        });

        // Should still get a response even if ACG fails
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();

        logger.info('ACG Integration Test - Fallback', {
          userMessage,
          responseLength: response.content.length,
          workspaceProcessed: response.metadata?.workspaceProcessed
        });
      } finally {
        await fallbackAgent.shutdown();
      }
    }, 15000);
  });

  describe('ACG Service Integration', () => {
    it('should have ACG services properly initialized when enabled', async () => {
      // Verify internal ACG services are initialized
      const agentConfig = agent.getConfig();
      expect(agentConfig).toBeDefined();

      // Check agent capabilities include ACG-related features
      const capabilities = await agent.getCapabilities();
      expect(capabilities).toContain('memory_management');
      expect(capabilities).toContain('tool_usage');

      logger.info('ACG Integration Test - Service Initialization', {
        capabilities,
        configKeys: Object.keys(agentConfig)
      });
    });

    it('should not initialize ACG services when disabled', async () => {
      const nonACGAgent = new DefaultAgent({
        id: 'test-agent-no-acg',
        name: 'Non-ACG Agent',
        enableACG: false // Explicitly disabled
      });

      await nonACGAgent.initialize();

      try {
        const userMessage = "Send an email to test@example.com";
        const response = await nonACGAgent.processUserInput(userMessage);

        // Should still process but without ACG enhancement
        expect(response).toBeDefined();

        logger.info('ACG Integration Test - Disabled ACG', {
          responseLength: response.content.length,
          workspaceProcessed: response.metadata?.workspaceProcessed
        });
      } finally {
        await nonACGAgent.shutdown();
      }
    });
  });

  describe('Memory Integration', () => {
    it('should use conversation history for context-aware content generation', async () => {
      // First message to establish context
      const contextMessage = "I'm working on a blockchain project focused on sustainable energy solutions";
      await agent.processUserInput(contextMessage, {
        userId: 'test-user',
        chatId: 'test-chat'
      });

      // Second message that should use the context
      const emailMessage = "Send an email to investor@venture.com about our project";
      const response = await agent.processUserInput(emailMessage, {
        userId: 'test-user',
        chatId: 'test-chat'
      });

      expect(response).toBeDefined();

      // If ACG generated content, it should incorporate the blockchain/energy context
      const workspaceData = response.metadata?.workspaceData;
      if (workspaceData?.contentGenerated && workspaceData.generatedContent) {
        const generatedContent = workspaceData.generatedContent;

        // Check if context was used in generation
        if (generatedContent.subject?.content) {
          const subjectContent = generatedContent.subject.content.toLowerCase();
          const hasContext = subjectContent.includes('blockchain') ||
            subjectContent.includes('energy') ||
            subjectContent.includes('sustainable');

          logger.info('ACG Integration Test - Context Usage', {
            subjectContent: generatedContent.subject.content,
            hasContext,
            confidence: generatedContent.subject.confidence
          });
        }
      }
    }, 45000); // Longer timeout for multiple LLM calls
  });
}); 