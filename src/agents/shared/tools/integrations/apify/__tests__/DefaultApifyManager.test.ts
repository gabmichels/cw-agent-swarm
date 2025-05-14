/**
 * DefaultApifyManager.test.ts - Tests for the DefaultApifyManager
 * 
 * This file contains tests for the DefaultApifyManager class that provides
 * integration with the Apify platform for web scraping operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultApifyManager, ApifyError } from '../DefaultApifyManager';
import { ApifyToolInput, ApifyToolResult, ApifyLimitContext } from '../ApifyManager.interface';

// Mock the logger
vi.mock('../../../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('DefaultApifyManager', () => {
  let manager: DefaultApifyManager;
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock environment variable
    process.env = { ...originalEnv, APIFY_API_KEY: 'test-api-key' };
    
    // Create a new manager for each test
    manager = new DefaultApifyManager();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('constructor', () => {
    it('should initialize with API token from environment', () => {
      // Check if the manager is initialized with the API token
      expect(manager['apiToken']).toBe('test-api-key');
    });
    
    it('should warn if API token is missing', () => {
      // Remove API token
      process.env.APIFY_API_KEY = '';
      
      // Create new manager
      const warningManager = new DefaultApifyManager();
      
      // Check if warning was logged
      expect(warningManager['apiToken']).toBe('');
      expect(require('../../../../../../lib/logging').logger.warn).toHaveBeenCalledWith(
        'APIFY_API_KEY environment variable is not set. Apify tools will not work.'
      );
    });
  });
  
  describe('runApifyActor', () => {
    it('should return error if API token is missing', async () => {
      // Remove API token
      manager['apiToken'] = '';
      
      const options: ApifyToolInput = {
        actorId: 'test-actor',
        input: { key: 'value' },
      };
      
      const result = await manager.runApifyActor(options);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('APIFY_API_KEY environment variable is not set');
    });
    
    it('should handle dry run mode', async () => {
      const options: ApifyToolInput = {
        actorId: 'test-actor',
        input: { key: 'value' },
        label: 'Test Run',
        dryRun: true,
      };
      
      const result = await manager.runApifyActor(options);
      
      expect(result.success).toBe(true);
      expect(result.runId).toBe('dry-run-id');
      expect(result.output).toEqual([]);
      expect(result.error).toContain('dry run');
      expect(require('../../../../../../lib/logging').logger.info).toHaveBeenCalledWith(
        '[DRY RUN] Would start Apify actor: test-actor (Test Run)'
      );
    });
    
    // Additional tests would be added for the full implementation
    // Currently, our implementation is a stub
  });
  
  describe('runRedditSearch', () => {
    it('should call runApifyActor with correct parameters', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ title: 'Test Post' }],
        success: true,
      });
      
      await manager.runRedditSearch('test query', false, 20);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'trudax/reddit-scraper-lite',
        input: {
          searchQuery: 'test query',
          maxPosts: 20,
          skipComments: true,
        },
        label: 'Reddit search: test query',
        dryRun: false,
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Make runApifyActor throw an error
      vi.spyOn(manager, 'runApifyActor').mockRejectedValueOnce(new Error('API error'));
      
      const result = await manager.runRedditSearch('test query');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error in Reddit search: API error');
      expect(require('../../../../../../lib/logging').logger.error).toHaveBeenCalled();
    });
  });
  
  describe('runTwitterSearch', () => {
    it('should call runApifyActor with correct parameters', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ text: 'Test Tweet' }],
        success: true,
      });
      
      await manager.runTwitterSearch('test query', true, 15);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'apidojo/twitter-scraper-lite',
        input: {
          searchTerms: ['test query'],
          maxTweets: 15,
          scrapeTweetReplies: false,
        },
        label: 'Twitter search: test query',
        dryRun: true,
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Make runApifyActor throw an error
      vi.spyOn(manager, 'runApifyActor').mockRejectedValueOnce(new Error('Network error'));
      
      const result = await manager.runTwitterSearch('test query');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error in Twitter search: Network error');
      expect(require('../../../../../../lib/logging').logger.error).toHaveBeenCalled();
    });
  });
  
  describe('runWebsiteCrawler', () => {
    it('should call runApifyActor with correct parameters', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ url: 'https://example.com', title: 'Example' }],
        success: true,
      });
      
      await manager.runWebsiteCrawler('https://example.com', false, 30, 2);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'apify/website-content-crawler',
        input: {
          startUrls: [{ url: 'https://example.com' }],
          maxDepth: 2,
          maxPagesPerCrawl: 30,
        },
        label: 'Website crawl: https://example.com',
        dryRun: false,
      });
    });
  });
  
  describe('runYouTubeSearch', () => {
    it('should call runApifyActor with correct parameters', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ title: 'Test Video' }],
        success: true,
      });
      
      await manager.runYouTubeSearch('test video', false, 5);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'apify/youtube-scraper',
        input: {
          search: 'test video',
          maxResults: 5,
          proxy: {
            useApifyProxy: true,
          },
        },
        label: 'YouTube search: test video',
        dryRun: false,
      });
    });
  });
  
  describe('runInstagramScraper', () => {
    it('should call runApifyActor with correct parameters', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ username: 'testuser' }],
        success: true,
      });
      
      await manager.runInstagramScraper('testuser', false, 25);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'apify/instagram-scraper',
        input: {
          usernames: ['testuser'],
          resultsLimit: 25,
          addParentData: true,
          proxy: {
            useApifyProxy: true,
          },
        },
        label: 'Instagram scrape: testuser',
        dryRun: false,
      });
    });
  });
  
  describe('runTikTokScraper', () => {
    it('should handle username search correctly', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ username: 'testuser' }],
        success: true,
      });
      
      await manager.runTikTokScraper('@testuser', false, 15);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'clockworks/free-tiktok-scraper',
        input: {
          profiles: ['testuser'],
          scrapeType: 'posts',
          proxy: { useApifyProxy: true },
          maxItems: 15,
        },
        label: 'TikTok scrape: @testuser',
        dryRun: false,
      });
    });
    
    it('should handle hashtag search correctly', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ hashtag: 'trending' }],
        success: true,
      });
      
      await manager.runTikTokScraper('#trending', true);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'clockworks/free-tiktok-scraper',
        input: {
          hashtags: ['trending'],
          scrapeType: 'hashtag',
          proxy: { useApifyProxy: true },
          maxItems: 10,
        },
        label: 'TikTok scrape: #trending',
        dryRun: true,
      });
    });
    
    it('should handle keyword search correctly', async () => {
      // Create spy on runApifyActor
      const spy = vi.spyOn(manager, 'runApifyActor').mockResolvedValueOnce({
        runId: 'test-run',
        output: [{ keyword: 'dance' }],
        success: true,
      });
      
      await manager.runTikTokScraper('dance tutorial', false);
      
      expect(spy).toHaveBeenCalledWith({
        actorId: 'clockworks/free-tiktok-scraper',
        input: {
          keywords: ['dance tutorial'],
          scrapeType: 'search',
          proxy: { useApifyProxy: true },
          maxItems: 10,
        },
        label: 'TikTok scrape: dance tutorial',
        dryRun: false,
      });
    });
  });
  
  describe('requestHigherLimits', () => {
    it('should enforce limits based on user role', async () => {
      const result = await manager.requestHigherLimits(
        'test-actor',
        'Testing limits',
        100,
        { userRole: 'researcher' }
      );
      
      expect(result.approved).toBe(true);
      expect(result.grantedLimit).toBe(50); // Researcher role is capped at 50
    });
    
    it('should allow higher limits with budget approval', async () => {
      const result = await manager.requestHigherLimits(
        'test-actor',
        'Testing limits',
        150,
        { userRole: 'admin', budgetApproved: true }
      );
      
      expect(result.approved).toBe(true);
      expect(result.grantedLimit).toBe(100); // Admin with budget approval is capped at 100
    });
    
    it('should limit to default role if no role specified', async () => {
      const result = await manager.requestHigherLimits(
        'test-actor',
        'Testing limits',
        200
      );
      
      expect(result.approved).toBe(false);
      expect(result.grantedLimit).toBe(25); // Default cap without role
    });
  });
}); 