/**
 * Cross-System Integration Baseline Tests
 * 
 * Documents current cross-system integration patterns, failures, and
 * string literal usage across all 17+ tool systems.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { WorkspaceAgentTools } from '../../../src/services/workspace/tools/WorkspaceAgentTools';
import { SocialMediaAgentTools } from '../../../src/services/social-media/tools/SocialMediaAgentTools';
import { EnhancedToolService } from '../../../src/services/tools/EnhancedToolService';
import { SharedToolRegistry } from '../../../src/agents/shared/tools/registry/SharedToolRegistry';
import { UnifiedToolRegistry } from '../../../src/services/tools/UnifiedToolRegistry';
import { DefaultToolManager } from '../../../src/lib/agents/implementations/managers/DefaultToolManager';
import { ToolService } from '../../../src/services/thinking/tools/ToolService';
import { ulid } from 'ulid';

// Test agent for cross-system testing
const TEST_AGENT_ID = ulid();
const TEST_CONNECTION_ID = 'cross-system-test-connection';

describe('Cross-System Integration Baseline', () => {
  let workspaceTools: WorkspaceAgentTools;
  let socialMediaTools: SocialMediaAgentTools;
  let enhancedToolService: EnhancedToolService;
  let sharedToolRegistry: SharedToolRegistry;
  let unifiedToolRegistry: UnifiedToolRegistry;
  let defaultToolManager: DefaultToolManager;
  let thinkingToolService: ToolService;

  // Cross-system interaction tracking
  const crossSystemFailures: Array<{
    sourceSystem: string;
    targetSystem: string;
    operation: string;
    errorType: string;
    errorMessage: string;
  }> = [];

  beforeAll(async () => {
    // Initialize all tool systems
    workspaceTools = new WorkspaceAgentTools();
    enhancedToolService = new EnhancedToolService();
    sharedToolRegistry = new SharedToolRegistry();
    unifiedToolRegistry = new UnifiedToolRegistry();
    defaultToolManager = new DefaultToolManager(TEST_AGENT_ID);
    thinkingToolService = new ToolService();

    // Note: SocialMediaAgentTools requires SocialMediaService
    // We'll test what we can without full initialization
  });

  describe('🔍 System Discovery and Visibility', () => {
    it('should document tool visibility across systems', async () => {
      console.log('\n🔍 CROSS-SYSTEM TOOL VISIBILITY ANALYSIS');
      console.log('='.repeat(60));

      // Test workspace tools visibility from other systems
      try {
        const workspaceToolsList = await workspaceTools.getAvailableTools(TEST_AGENT_ID);
        console.log(`📧 Workspace Tools Available: ${workspaceToolsList.length}`);

        // Can enhanced tool service find workspace tools?
        try {
          const workspaceToolInEnhanced = await enhancedToolService.findTool('send_email');
          console.log('✅ Enhanced Tool Service can find workspace tools:', !!workspaceToolInEnhanced);
        } catch (error) {
          console.log('❌ Enhanced Tool Service cannot find workspace tools:', error.message);
          crossSystemFailures.push({
            sourceSystem: 'EnhancedToolService',
            targetSystem: 'WorkspaceTools',
            operation: 'findTool',
            errorType: 'TOOL_NOT_FOUND',
            errorMessage: error.message
          });
        }

        // Can shared registry find workspace tools?
        try {
          const workspaceToolInRegistry = sharedToolRegistry.findTool('send_email');
          console.log('✅ Shared Registry can find workspace tools:', !!workspaceToolInRegistry);
        } catch (error) {
          console.log('❌ Shared Registry cannot find workspace tools:', error.message);
          crossSystemFailures.push({
            sourceSystem: 'SharedToolRegistry',
            targetSystem: 'WorkspaceTools',
            operation: 'findTool',
            errorType: 'TOOL_NOT_FOUND',
            errorMessage: error.message
          });
        }

        // Can thinking tool service find workspace tools?
        try {
          const workspaceToolInThinking = await thinkingToolService.getTool('send_email');
          console.log('✅ Thinking Service can find workspace tools:', !!workspaceToolInThinking);
        } catch (error) {
          console.log('❌ Thinking Service cannot find workspace tools:', error.message);
          crossSystemFailures.push({
            sourceSystem: 'ThinkingToolService',
            targetSystem: 'WorkspaceTools',
            operation: 'getTool',
            errorType: 'TOOL_NOT_FOUND',
            errorMessage: error.message
          });
        }

      } catch (error) {
        console.log('❌ Failed to get workspace tools:', error.message);
      }
    });

    it('should test cross-system tool execution attempts', async () => {
      console.log('\n🔄 CROSS-SYSTEM EXECUTION ATTEMPTS');
      console.log('='.repeat(50));

      // Test 1: Can Enhanced Tool Service execute workspace tools?
      try {
        const result = await enhancedToolService.executeTool({
          toolId: 'send_email',
          agentId: TEST_AGENT_ID,
          userId: TEST_AGENT_ID,
          parameters: {
            to: 'test@example.com',
            subject: 'Cross-system test',
            body: 'Testing cross-system execution'
          }
        });

        console.log('✅ Enhanced Tool Service executed workspace tool successfully');
      } catch (error) {
        console.log('❌ Enhanced Tool Service failed to execute workspace tool:', error.message);
        crossSystemFailures.push({
          sourceSystem: 'EnhancedToolService',
          targetSystem: 'WorkspaceTools',
          operation: 'executeTool',
          errorType: 'EXECUTION_FAILED',
          errorMessage: error.message
        });
      }

      // Test 2: Can Thinking Service execute social media tools?
      try {
        const result = await thinkingToolService.executeTool('create_social_post', {
          content: 'Cross-system test post',
          platforms: ['twitter']
        });

        console.log('✅ Thinking Service executed social media tool successfully');
      } catch (error) {
        console.log('❌ Thinking Service failed to execute social media tool:', error.message);
        crossSystemFailures.push({
          sourceSystem: 'ThinkingToolService',
          targetSystem: 'SocialMediaTools',
          operation: 'executeTool',
          errorType: 'EXECUTION_FAILED',
          errorMessage: error.message
        });
      }

      // Test 3: Can Default Tool Manager execute Apify tools?
      try {
        const result = await defaultToolManager.executeTool('apify-web-search', {
          query: 'cross-system test',
          maxResults: 5
        });

        console.log('✅ Default Tool Manager executed Apify tool successfully');
      } catch (error) {
        console.log('❌ Default Tool Manager failed to execute Apify tool:', error.message);
        crossSystemFailures.push({
          sourceSystem: 'DefaultToolManager',
          targetSystem: 'ApifyTools',
          operation: 'executeTool',
          errorType: 'EXECUTION_FAILED',
          errorMessage: error.message
        });
      }
    });
  });

  describe('🎯 Fallback Executor Pattern Analysis', () => {
    it('should document fallback executor usage patterns', async () => {
      console.log('\n🎯 FALLBACK EXECUTOR PATTERN ANALYSIS');
      console.log('='.repeat(50));

      const fallbackPatterns = {
        enhancedToolService: {
          hasFallback: true,
          fallbackMethod: 'handleExecutorNotFound',
          description: 'Uses fallback when no executor found for tool'
        },
        thinkingToolService: {
          hasFallback: true,
          fallbackMethod: 'fallbackExecutor',
          description: 'Generic fallback executor for unknown tools'
        },
        defaultToolManager: {
          hasFallback: true,
          fallbackMethod: 'executeWithFallback',
          description: 'Fallback to generic execution when specific executor missing'
        },
        workspaceTools: {
          hasFallback: false,
          fallbackMethod: null,
          description: 'No fallback - uses direct tool execution'
        },
        socialMediaTools: {
          hasFallback: false,
          fallbackMethod: null,
          description: 'No fallback - uses provider-specific execution'
        }
      };

      console.log('Fallback Patterns:', JSON.stringify(fallbackPatterns, null, 2));

      // Test fallback executor behavior
      try {
        // This should trigger fallback executor in thinking service
        const result = await thinkingToolService.executeTool('non_existent_tool_12345', {
          test: 'parameter'
        });

        console.log('🎯 Fallback executor triggered successfully');
      } catch (error) {
        if (error.message.includes('fallback') || error.message.includes('executor')) {
          console.log('🎯 Fallback executor pattern detected:', error.message);
        } else {
          console.log('🎯 No fallback executor pattern found:', error.message);
        }
      }
    });

    it('should identify "No executor found" error patterns', async () => {
      const noExecutorErrors: Array<{
        system: string;
        toolId: string;
        errorMessage: string;
        hasFallback: boolean;
      }> = [];

      // Test various systems with non-existent tools
      const testCases = [
        { system: 'EnhancedToolService', toolId: 'fake_tool_123' },
        { system: 'ThinkingToolService', toolId: 'fake_tool_456' },
        { system: 'DefaultToolManager', toolId: 'fake_tool_789' },
        { system: 'SharedToolRegistry', toolId: 'fake_tool_abc' }
      ];

      for (const testCase of testCases) {
        try {
          switch (testCase.system) {
            case 'EnhancedToolService':
              await enhancedToolService.executeTool({
                toolId: testCase.toolId,
                agentId: TEST_AGENT_ID,
                userId: TEST_AGENT_ID,
                parameters: {}
              });
              break;
            case 'ThinkingToolService':
              await thinkingToolService.executeTool(testCase.toolId, {});
              break;
            case 'DefaultToolManager':
              await defaultToolManager.executeTool(testCase.toolId, {});
              break;
            case 'SharedToolRegistry':
              sharedToolRegistry.findTool(testCase.toolId);
              break;
          }
        } catch (error) {
          const hasFallback = error.message.includes('fallback') ||
            error.message.includes('using fallback') ||
            !error.message.includes('not found');

          noExecutorErrors.push({
            system: testCase.system,
            toolId: testCase.toolId,
            errorMessage: error.message,
            hasFallback
          });
        }
      }

      console.log('\n🎯 "No Executor Found" Error Patterns:');
      noExecutorErrors.forEach(error => {
        console.log(`${error.system}: ${error.hasFallback ? '✅ Has Fallback' : '❌ No Fallback'}`);
        console.log(`  Error: ${error.errorMessage}`);
      });
    });
  });

  describe('📝 String Literal Usage Mapping', () => {
    it('should map all string literal tool names across systems', () => {
      console.log('\n📝 STRING LITERAL USAGE MAPPING');
      console.log('='.repeat(40));

      const stringLiteralsBySystem = {
        workspaceTools: [
          'read_specific_email', 'find_important_emails', 'search_emails',
          'send_email', 'smart_send_email', 'reply_to_email', 'forward_email',
          'read_calendar', 'schedule_event', 'find_availability', 'find_events',
          'create_spreadsheet', 'read_spreadsheet', 'update_spreadsheet',
          'search_files', 'get_file', 'create_file', 'share_file'
        ],
        socialMediaTools: [
          'create_text_post', 'create_image_post', 'schedule_post',
          'create_tiktok_video', 'analyze_tiktok_trends',
          'get_post_metrics', 'get_account_analytics', 'get_trending_hashtags'
        ],
        apifyTools: [
          'apify-actor-discovery', 'apify-actor-info', 'apify-dynamic-run',
          'apify-web-search', 'apify-instagram-scraper', 'apify-twitter-scraper'
        ],
        thinkingTools: [
          // Uses ULID-based IDs, fewer string literals
          'thinking_workflow_execute', 'thinking_tool_discover'
        ],
        externalWorkflowTools: [
          'n8n_workflow_execute', 'zapier_workflow_trigger',
          'workflow_status_check', 'workflow_result_get'
        ]
      };

      let totalStringLiterals = 0;
      for (const [system, literals] of Object.entries(stringLiteralsBySystem)) {
        console.log(`${system}: ${literals.length} string literals`);
        totalStringLiterals += literals.length;
      }

      console.log(`\nTotal String Literals Across All Systems: ${totalStringLiterals}`);
      console.log('⚠️ All of these should be replaced with constants in unified system');

      // Identify duplicate string literals across systems
      const allLiterals = Object.values(stringLiteralsBySystem).flat();
      const duplicates = allLiterals.filter((item, index) => allLiterals.indexOf(item) !== index);

      if (duplicates.length > 0) {
        console.log('\n⚠️ Duplicate String Literals Found:', duplicates);
      } else {
        console.log('\n✅ No duplicate string literals found across systems');
      }
    });

    it('should identify inconsistent naming patterns', () => {
      const namingPatterns = {
        snake_case: ['send_email', 'read_calendar', 'create_spreadsheet'],
        kebab_case: ['apify-actor-discovery', 'apify-web-search'],
        camelCase: ['createTikTokVideo', 'getPostMetrics'], // If any exist
        PascalCase: ['WorkspaceTools', 'SocialMediaTools'], // Class names
        UPPER_CASE: ['EMAIL_SEND', 'CALENDAR_READ'] // Constants
      };

      console.log('\n📝 NAMING PATTERN ANALYSIS');
      console.log('Current naming patterns in use:');
      for (const [pattern, examples] of Object.entries(namingPatterns)) {
        if (examples.length > 0) {
          console.log(`${pattern}: ${examples.length} examples`);
        }
      }

      console.log('\n⚠️ Unified system should standardize on snake_case for tool names');
    });
  });

  describe('🔧 System Integration Interfaces', () => {
    it('should document integration interface inconsistencies', () => {
      const systemInterfaces = {
        workspaceTools: {
          method: 'getAvailableTools',
          parameters: ['agentId'],
          returnType: 'AgentTool[]',
          async: true
        },
        socialMediaTools: {
          method: 'getAvailableTools',
          parameters: ['agentId'],
          returnType: 'SocialMediaToolDefinition[]',
          async: true
        },
        enhancedToolService: {
          method: 'executeTool',
          parameters: ['options: EnhancedToolExecutionOptions'],
          returnType: 'EnhancedToolExecutionResult',
          async: true
        },
        thinkingToolService: {
          method: 'executeTool',
          parameters: ['toolId: string', 'parameters: any'],
          returnType: 'ToolExecutionResult',
          async: true
        },
        defaultToolManager: {
          method: 'executeTool',
          parameters: ['toolId: string', 'params: any'],
          returnType: 'unknown',
          async: true
        }
      };

      console.log('\n🔧 SYSTEM INTERFACE ANALYSIS');
      console.log('Interface inconsistencies found:');

      // Check for parameter inconsistencies
      const parameterPatterns = new Set();
      const returnTypePatterns = new Set();

      for (const [system, interface_] of Object.entries(systemInterfaces)) {
        parameterPatterns.add(interface_.parameters.join(', '));
        returnTypePatterns.add(interface_.returnType);
      }

      console.log(`Parameter patterns: ${parameterPatterns.size} different patterns`);
      console.log(`Return type patterns: ${returnTypePatterns.size} different patterns`);
      console.log('⚠️ Unified system should standardize these interfaces');
    });
  });

  describe('📊 Cross-System Performance Impact', () => {
    it('should measure cross-system call overhead', async () => {
      console.log('\n📊 CROSS-SYSTEM PERFORMANCE ANALYSIS');

      // Measure direct tool execution vs cross-system attempts
      const performanceTests = [];

      // Direct workspace tool execution
      const directStartTime = Date.now();
      try {
        await workspaceTools.getAvailableTools(TEST_AGENT_ID);
        performanceTests.push({
          type: 'direct_workspace_call',
          duration: Date.now() - directStartTime,
          success: true
        });
      } catch (error) {
        performanceTests.push({
          type: 'direct_workspace_call',
          duration: Date.now() - directStartTime,
          success: false,
          error: error.message
        });
      }

      // Cross-system attempt (enhanced tool service -> workspace)
      const crossSystemStartTime = Date.now();
      try {
        await enhancedToolService.findTool('send_email');
        performanceTests.push({
          type: 'cross_system_workspace_call',
          duration: Date.now() - crossSystemStartTime,
          success: true
        });
      } catch (error) {
        performanceTests.push({
          type: 'cross_system_workspace_call',
          duration: Date.now() - crossSystemStartTime,
          success: false,
          error: error.message
        });
      }

      console.log('Performance Test Results:');
      performanceTests.forEach(test => {
        console.log(`${test.type}: ${test.duration}ms (${test.success ? 'SUCCESS' : 'FAILED'})`);
        if (!test.success) {
          console.log(`  Error: ${test.error}`);
        }
      });
    });
  });

  afterAll(() => {
    // Generate comprehensive cross-system analysis report
    console.log('\n📋 CROSS-SYSTEM INTEGRATION BASELINE REPORT');
    console.log('='.repeat(60));

    console.log(`Total Cross-System Failures Documented: ${crossSystemFailures.length}`);

    if (crossSystemFailures.length > 0) {
      console.log('\nFailure Summary:');
      const failuresByType = crossSystemFailures.reduce((acc, failure) => {
        acc[failure.errorType] = (acc[failure.errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      for (const [errorType, count] of Object.entries(failuresByType)) {
        console.log(`  ${errorType}: ${count} failures`);
      }
    }

    console.log('\n✅ Cross-system integration baseline documentation complete');
    console.log('🎯 This data will guide unified foundation implementation');
  });
}); 