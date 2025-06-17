import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdGenerator, RPAError, Logger } from '../types/RPATypes';
import { RPAServiceRegistry, resetRPARegistry } from '../core/RPAServiceRegistry';
import { SocialMediaRPAService, createSocialMediaRPAConfig } from '../domains/social-media/SocialMediaRPAService';

// Mock logger for testing
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
};

describe('RPA Framework', () => {
  beforeEach(() => {
    resetRPARegistry();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup after each test
    try {
      const registry = new RPAServiceRegistry(mockLogger);
      await registry.cleanup();
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('IdGenerator', () => {
    it('should generate valid ULID with prefix', () => {
      const id = IdGenerator.generate('TEST');
      
      expect(id.prefix).toBe('TEST');
      expect(id.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(id.timestamp).toBeInstanceOf(Date);
      expect(id.toString()).toBe(`TEST_${id.id}`);
    });

    it('should generate unique IDs', () => {
      const id1 = IdGenerator.generate('TEST');
      const id2 = IdGenerator.generate('TEST');
      
      expect(id1.id).not.toBe(id2.id);
      expect(id1.toString()).not.toBe(id2.toString());
    });

    it('should parse structured ID correctly', () => {
      const original = IdGenerator.generate('TEST');
      const parsed = IdGenerator.parse(original.toString());
      
      expect(parsed.prefix).toBe(original.prefix);
      expect(parsed.id).toBe(original.id);
      expect(parsed.toString()).toBe(original.toString());
    });

    it('should throw error for invalid ID format', () => {
      expect(() => IdGenerator.parse('invalid')).toThrow(RPAError);
      expect(() => IdGenerator.parse('')).toThrow(RPAError);
    });
  });

  describe('RPAServiceRegistry', () => {
    let registry: RPAServiceRegistry;

    beforeEach(() => {
      registry = new RPAServiceRegistry(mockLogger);
    });

    afterEach(async () => {
      await registry.cleanup();
    });

    it('should initialize empty registry', () => {
      expect(registry.getRegisteredDomains()).toHaveLength(0);
      expect(registry.getAllWorkflows()).toHaveLength(0);
      expect(registry.getStats().totalDomains).toBe(0);
    });

    it('should register domain service successfully', () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      expect(registry.hasService('social-media')).toBe(true);
      expect(registry.getRegisteredDomains()).toContain('social-media');
      expect(registry.getService('social-media')).toBe(service);
    });

    it('should throw error when registering duplicate domain', () => {
      const config = createSocialMediaRPAConfig();
      const service1 = new SocialMediaRPAService(config, mockLogger);
      const service2 = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service1);
      
      expect(() => registry.register('social-media', service2)).toThrow(RPAError);
    });

    it('should throw error for domain mismatch', () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      expect(() => registry.register('wrong-domain', service)).toThrow(RPAError);
    });

    it('should unregister domain service', async () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      expect(registry.hasService('social-media')).toBe(true);
      
      await registry.unregister('social-media');
      expect(registry.hasService('social-media')).toBe(false);
    });

    it('should throw error when unregistering non-existent domain', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow(RPAError);
    });

    it('should get workflows for domain', () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      const workflows = registry.getWorkflowsForDomain('social-media');
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.every(w => w.domain === 'social-media')).toBe(true);
    });

    it('should find workflows by capability', () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      const workflows = registry.findWorkflowsByCapability('browser_automation');
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.every(w => w.capabilities.includes('browser_automation'))).toBe(true);
    });

    it('should provide accurate statistics', () => {
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      const stats = registry.getStats();
      expect(stats.totalDomains).toBe(1);
      expect(stats.totalWorkflows).toBeGreaterThan(0);
      expect(stats.workflowsByDomain['social-media']).toBeGreaterThan(0);
    });
  });

  describe('SocialMediaRPAService', () => {
    let service: SocialMediaRPAService;
    let config: ReturnType<typeof createSocialMediaRPAConfig>;

    beforeEach(() => {
      config = createSocialMediaRPAConfig();
      service = new SocialMediaRPAService(config, mockLogger);
    });

    afterEach(async () => {
      await service.cleanup();
    });

    it('should initialize with correct domain', () => {
      expect(service.getDomain()).toBe('social-media');
    });

    it('should register social media workflows', () => {
      const workflows = service.getAvailableWorkflows();
      
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.some(w => w.id === 'twitter_create_post')).toBe(true);
      expect(workflows.some(w => w.id === 'linkedin_create_post')).toBe(true);
      expect(workflows.some(w => w.id === 'facebook_create_post')).toBe(true);
      expect(workflows.some(w => w.id === 'instagram_create_post')).toBe(true);
      expect(workflows.some(w => w.id === 'tiktok_create_video')).toBe(true);
      expect(workflows.some(w => w.id === 'reddit_create_post')).toBe(true);
    });

    it('should have workflows with correct domain', () => {
      const workflows = service.getAvailableWorkflows();
      
      expect(workflows.every(w => w.domain === 'social-media')).toBe(true);
    });

    it('should have workflows with required capabilities', () => {
      const workflows = service.getAvailableWorkflows();
      
      workflows.forEach(workflow => {
        expect(workflow.capabilities.length).toBeGreaterThan(0);
        expect(workflow.capabilities.every(cap => typeof cap === 'string')).toBe(true);
      });
    });

    it('should provide workflow health status', async () => {
      const healthStatuses = await service.getWorkflowHealthStatuses();
      
      expect(healthStatuses.length).toBeGreaterThan(0);
      healthStatuses.forEach(status => {
        expect(status.workflowId).toBeDefined();
        expect(status.health.status).toMatch(/^(healthy|degraded|unhealthy)$/);
        expect(status.health.lastChecked).toBeInstanceOf(Date);
        expect(Array.isArray(status.health.issues)).toBe(true);
      });
    });

    it('should get social media specific configuration', () => {
      const smConfig = service.getSocialMediaConfig();
      
      expect(smConfig.socialMedia).toBeDefined();
      expect(smConfig.socialMedia.platforms).toBeDefined();
      expect(smConfig.socialMedia.contentLimits).toBeDefined();
      
      // Check platform configurations
      expect(smConfig.socialMedia.platforms.twitter).toBeDefined();
      expect(smConfig.socialMedia.platforms.linkedin).toBeDefined();
      expect(smConfig.socialMedia.platforms.facebook).toBeDefined();
      expect(smConfig.socialMedia.platforms.instagram).toBeDefined();
      expect(smConfig.socialMedia.platforms.tiktok).toBeDefined();
      expect(smConfig.socialMedia.platforms.reddit).toBeDefined();
      
      // Check content limits
      expect(smConfig.socialMedia.contentLimits.twitter.maxLength).toBe(280);
      expect(smConfig.socialMedia.contentLimits.linkedin.maxLength).toBe(3000);
      expect(smConfig.socialMedia.contentLimits.tiktok.maxVideoSize).toBe(287457280);
    });
  });

  describe('Configuration', () => {
    it('should create valid social media RPA configuration', () => {
      const config = createSocialMediaRPAConfig();
      
      expect(config.domain).toBe('social-media');
      expect(config.enabled).toBe(true);
      expect(config.maxConcurrentExecutions).toBeGreaterThan(0);
      expect(config.defaultTimeout).toBeGreaterThan(0);
      
      // Retry configuration
      expect(config.retryConfig.maxAttempts).toBeGreaterThan(0);
      expect(config.retryConfig.backoffMultiplier).toBeGreaterThan(1);
      expect(config.retryConfig.initialDelay).toBeGreaterThan(0);
      expect(config.retryConfig.maxDelay).toBeGreaterThan(config.retryConfig.initialDelay);
      
      // Browser configuration
      expect(typeof config.browserConfig.headless).toBe('boolean');
      expect(config.browserConfig.maxInstances).toBeGreaterThan(0);
      expect(config.browserConfig.idleTimeout).toBeGreaterThan(0);
      expect(Array.isArray(config.browserConfig.launchOptions.args)).toBe(true);
      
      // Security configuration
      expect(typeof config.security.screenshotsEnabled).toBe('boolean');
      expect(typeof config.security.auditLogging).toBe('boolean');
      expect(typeof config.security.sessionIsolation).toBe('boolean');
      expect(typeof config.security.credentialEncryption).toBe('boolean');
    });

    it('should respect environment variables', () => {
      // Test headless mode
      process.env.RPA_HEADLESS = 'false';
      const config1 = createSocialMediaRPAConfig();
      expect(config1.browserConfig.headless).toBe(false);
      
      // Test max browsers
      process.env.RPA_MAX_BROWSERS = '10';
      const config2 = createSocialMediaRPAConfig();
      expect(config2.browserConfig.maxInstances).toBe(10);
      
      // Test screenshots
      process.env.RPA_SCREENSHOTS_ENABLED = 'true';
      const config3 = createSocialMediaRPAConfig();
      expect(config3.security.screenshotsEnabled).toBe(true);
      
      // Cleanup
      delete process.env.RPA_HEADLESS;
      delete process.env.RPA_MAX_BROWSERS;
      delete process.env.RPA_SCREENSHOTS_ENABLED;
    });
  });

  describe('Error Handling', () => {
    it('should create proper error hierarchy', () => {
      const rpaError = new RPAError('Test error', 'TEST_CODE', { context: 'test' });
      
      expect(rpaError).toBeInstanceOf(Error);
      expect(rpaError.name).toBe('RPAError');
      expect(rpaError.message).toBe('Test error');
      expect(rpaError.code).toBe('RPA_TEST_CODE');
      expect(rpaError.context).toEqual({ context: 'test' });
    });

    it('should handle registry errors properly', () => {
      const registry = new RPAServiceRegistry(mockLogger);
      
      expect(() => registry.getWorkflowsForDomain('non-existent')).toThrow(RPAError);
      expect(() => registry.getService('non-existent')).not.toThrow();
      expect(registry.getService('non-existent')).toBeUndefined();
    });
  });

  describe('Integration', () => {
    it('should integrate registry with social media service', async () => {
      const registry = new RPAServiceRegistry(mockLogger);
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      const workflows = registry.getAllWorkflows();
      expect(workflows.length).toBeGreaterThan(0);
      
      const socialMediaWorkflows = registry.getWorkflowsForDomain('social-media');
      expect(socialMediaWorkflows.length).toBe(workflows.length);
      
      const twitterWorkflows = registry.findWorkflowsByCapability('twitter_access');
      expect(twitterWorkflows.length).toBeGreaterThan(0);
      
      await registry.cleanup();
    });

    it('should handle multiple domain registrations', () => {
      const registry = new RPAServiceRegistry(mockLogger);
      const config = createSocialMediaRPAConfig();
      const service = new SocialMediaRPAService(config, mockLogger);
      
      registry.register('social-media', service);
      
      const stats = registry.getStats();
      expect(stats.totalDomains).toBe(1);
      expect(stats.workflowsByDomain['social-media']).toBeGreaterThan(0);
      
      const allWorkflows = registry.getAllWorkflows();
      expect(allWorkflows.length).toBe(stats.totalWorkflows);
    });
  });
});

describe('Twitter Workflow Validation', () => {
  it('should validate Twitter post parameters correctly', async () => {
    const { TwitterCreatePostWorkflow } = await import('../domains/social-media/workflows/TwitterCreatePostWorkflow');
    const workflow = new TwitterCreatePostWorkflow();
    
    // Valid parameters
    const validParams = {
      content: 'Test tweet content',
      hashtags: ['test', 'automation']
    };
    
    const validResult = await workflow.validate(validParams);
    expect(validResult.isValid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    // Invalid parameters - empty content
    const invalidParams1 = {
      content: '',
      hashtags: ['test']
    };
    
    const invalidResult1 = await workflow.validate(invalidParams1);
    expect(invalidResult1.isValid).toBe(false);
    expect(invalidResult1.errors).toContain('Content is required');
    
    // Invalid parameters - too long content
    const invalidParams2 = {
      content: 'x'.repeat(281), // Exceeds Twitter limit
      hashtags: ['test']
    };
    
    const invalidResult2 = await workflow.validate(invalidParams2);
    expect(invalidResult2.isValid).toBe(false);
    expect(invalidResult2.errors).toContain('Content exceeds Twitter character limit (280 characters)');
    
    // Invalid parameters - too many media files
    const invalidParams3 = {
      content: 'Test content',
      media: Array(5).fill({ path: '/test.jpg', type: 'image/jpeg' }) // Exceeds limit of 4
    };
    
    const invalidResult3 = await workflow.validate(invalidParams3);
    expect(invalidResult3.isValid).toBe(false);
    expect(invalidResult3.errors).toContain('Twitter allows maximum 4 media files per post');
  });
}); 