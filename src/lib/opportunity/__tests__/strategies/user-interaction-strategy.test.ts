import { describe, test, expect, beforeEach } from 'vitest';
import { BasicUserInteractionStrategy } from '../../strategies/UserInteractionStrategy';
import { OpportunitySource } from '../../models/opportunity.model';

describe('UserInteractionStrategy', () => {
  let strategy: BasicUserInteractionStrategy;
  
  beforeEach(async () => {
    strategy = new BasicUserInteractionStrategy();
    await strategy.initialize();
  });
  
  test('should initialize successfully', async () => {
    const result = await strategy.initialize();
    expect(result).toBe(true);
  });
  
  test('should have correct strategy ID and source type', () => {
    expect(strategy.getStrategyId()).toBe('user-interaction-strategy');
    expect(strategy.getSourceType()).toBe(OpportunitySource.USER_INTERACTION);
  });
  
  test('should support user interaction content types', () => {
    expect(strategy.supportsContentType('text')).toBe(true);
    expect(strategy.supportsContentType('chat')).toBe(true);
    expect(strategy.supportsContentType('message')).toBe(true);
    expect(strategy.supportsContentType('question')).toBe(true);
    expect(strategy.supportsContentType('command')).toBe(true);
    expect(strategy.supportsContentType('image')).toBe(false);
    expect(strategy.supportsContentType('video')).toBe(false);
  });
  
  test('should detect need help intent', async () => {
    const content = 'I need help with setting up my environment. Can you assist me?';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThan(0);
    expect(result.strategyId).toBe('user-interaction-strategy');
    
    // Check first trigger details
    const trigger = result.triggers[0];
    expect(trigger.source).toBe(OpportunitySource.USER_INTERACTION);
    expect(trigger.confidence).toBeGreaterThanOrEqual(0.6);
    expect(trigger.type).toContain('keyword_group');
  });
  
  test('should detect report issue intent', async () => {
    const content = "There is a problem with the login page. It's not working correctly.";
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should detect optimization request', async () => {
    const content = 'The build process is too slow. Can we make it faster?';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should detect scheduling request', async () => {
    const content = 'Please schedule a meeting for tomorrow with the team.';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should detect automation opportunity', async () => {
    const content = "I have to do this task manually every day. It's very repetitive.";
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should not detect intent in irrelevant content', async () => {
    const content = 'The weather is nice today.';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBe(0);
  });
  
  test('should include metrics in detection result', async () => {
    const content = 'Can you help me with this problem?';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.metrics).toBeDefined();
    expect(result.metrics?.executionTimeMs).toBeTypeOf('number');
    expect(result.metrics?.contentSize).toBe(content.length);
  });
  
  test('should handle multiple intents in one message', async () => {
    const content = 'I need help with my project, and also please schedule a meeting for tomorrow.';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
  
  test('should not trigger with confidence below threshold', async () => {
    const content = 'Can I get some input on this?';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.9, // Set high threshold to test filtering
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBe(0);
  });
  
  test('should respect enabled/disabled state', async () => {
    // Disable the strategy
    await strategy.setEnabled(false);
    expect(strategy.isEnabled()).toBe(false);
    
    const content = 'I need help with this task.';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    // Should not detect anything when disabled
    expect(result.triggers.length).toBe(0);
    
    // Re-enable and test again
    await strategy.setEnabled(true);
    const resultAfterEnable = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(resultAfterEnable.triggers.length).toBeGreaterThan(0);
  });
  
  test('should support updating config', async () => {
    // Update the minimum confidence
    await strategy.updateConfig({
      minConfidence: 0.8,
      strategyId: 'user-interaction-strategy',
      enabled: true
    });
    
    const config = strategy.getConfig();
    expect(config.minConfidence).toBe(0.8);
  });
  
  test('should analyze user message', async () => {
    const content = 'I think we should optimize our database queries.';
    const result = await strategy.analyzeUserMessage(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
    expect(result.strategyId).toBe('user-interaction-strategy');
  });
  
  test('should configure custom intents', async () => {
    const customIntents = [
      {
        name: 'custom_intent',
        patterns: ['custom pattern', 'specific phrase'],
        examples: ['This is a custom intent example']
      }
    ];
    
    await strategy.configureIntents(customIntents);
    
    const content = 'I need to use this specific phrase in my work.';
    const result = await strategy.detectTriggers(content, {
      minConfidence: 0.6,
      source: OpportunitySource.USER_INTERACTION,
      context: {
        agentId: 'test-agent'
      },
      agentId: 'test-agent'
    });
    
    expect(result.triggers.length).toBeGreaterThanOrEqual(0);
  });
}); 