import { CostTrackingService } from '../CostTrackingService';
import { logger } from '../../../lib/logging';
import { ApifyToolResult } from '../../../agents/shared/tools/integrations/apify/ApifyManager.interface';

/**
 * Wrapper service that automatically tracks costs for Apify tool usage
 */
export class ApifyCostTracker {
  private costTracker: CostTrackingService;

  constructor(costTracker: CostTrackingService) {
    this.costTracker = costTracker;
  }

  /**
   * Track cost for Apify actor execution
   */
  async trackActorExecution(params: {
    actorId: string;
    toolName: string;
    operation: string;
    input: any;
    result: ApifyToolResult<any>;
    executionTimeMs: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    try {
      // Extract results count from the result
      const resultsCount = this.extractResultsCount(params.result);
      
      // Determine if the execution was successful
      const success = params.result.success;

      // Track the cost
      await this.costTracker.recordApifyCost({
        toolName: params.toolName,
        operation: params.operation,
        resultsCount,
        executionTimeMs: params.executionTimeMs,
        success,
        initiatedBy: params.initiatedBy,
        sessionId: params.sessionId,
        toolParameters: {
          actorId: params.actorId,
          input: params.input,
          outputSize: this.calculateOutputSize(params.result)
        },
        departmentId: params.departmentId
      });

      logger.debug('Apify cost tracked successfully', {
        toolName: params.toolName,
        operation: params.operation,
        resultsCount,
        executionTime: params.executionTimeMs,
        success
      });
    } catch (error) {
      logger.error('Failed to track Apify cost', {
        error: error instanceof Error ? error.message : String(error),
        toolName: params.toolName,
        operation: params.operation
      });
      // Don't throw - cost tracking failure shouldn't break the main operation
    }
  }

  /**
   * Track cost for Apify web search
   */
  async trackWebSearch(params: {
    query: string;
    limit: number;
    result: ApifyToolResult<any>;
    executionTimeMs: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    await this.trackActorExecution({
      actorId: 'apify/web-search-scraper',
      toolName: 'apify-web-search',
      operation: 'web_search',
      input: { query: params.query, limit: params.limit },
      result: params.result,
      executionTimeMs: params.executionTimeMs,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for Reddit search
   */
  async trackRedditSearch(params: {
    query: string;
    limit: number;
    result: ApifyToolResult<any>;
    executionTimeMs: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    await this.trackActorExecution({
      actorId: 'apify/reddit-scraper',
      toolName: 'apify-reddit-search',
      operation: 'reddit_search',
      input: { query: params.query, limit: params.limit },
      result: params.result,
      executionTimeMs: params.executionTimeMs,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for social media scraping
   */
  async trackSocialMediaScraping(params: {
    platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube';
    operation: string;
    target: string; // username, hashtag, or URL
    limit: number;
    result: ApifyToolResult<any>;
    executionTimeMs: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    const actorMapping = {
      twitter: 'apify/twitter-scraper',
      instagram: 'apify/instagram-scraper',
      facebook: 'apify/facebook-pages-scraper',
      linkedin: 'apify/linkedin-company-scraper',
      tiktok: 'apify/tiktok-scraper',
      youtube: 'apify/youtube-scraper'
    };

    await this.trackActorExecution({
      actorId: actorMapping[params.platform],
      toolName: `apify-${params.platform}-scraper`,
      operation: params.operation,
      input: { target: params.target, limit: params.limit },
      result: params.result,
      executionTimeMs: params.executionTimeMs,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Track cost for website crawling
   */
  async trackWebsiteCrawling(params: {
    url: string;
    maxPages: number;
    maxDepth: number;
    result: ApifyToolResult<any>;
    executionTimeMs: number;
    initiatedBy: { type: 'agent' | 'user' | 'system'; id: string; name?: string };
    sessionId?: string;
    departmentId?: string;
  }): Promise<void> {
    await this.trackActorExecution({
      actorId: 'apify/website-content-crawler',
      toolName: 'apify-website-crawler',
      operation: 'website_crawl',
      input: { 
        startUrls: [params.url], 
        maxRequestsPerCrawl: params.maxPages,
        maxCrawlingDepth: params.maxDepth
      },
      result: params.result,
      executionTimeMs: params.executionTimeMs,
      initiatedBy: params.initiatedBy,
      sessionId: params.sessionId,
      departmentId: params.departmentId
    });
  }

  /**
   * Estimate cost before execution
   */
  estimateApifyCost(params: {
    toolName: string;
    expectedResults: number;
    estimatedTimeMs?: number;
  }): {
    estimatedCost: number;
    costBreakdown: {
      baseCost: number;
      resultsCost: number;
      timeCost: number;
    };
    costTier: 'free' | 'low' | 'medium' | 'high' | 'premium';
  } {
    // Get base costs for different tools
    const toolCosts = this.getToolBaseCosts();
    const toolCost = toolCosts[params.toolName] || toolCosts.default;

    const baseCost = toolCost.fixed;
    const resultsCost = params.expectedResults * toolCost.perResult;
    const timeCost = params.estimatedTimeMs ? 
      (params.estimatedTimeMs / 60000) * toolCost.perMinute : 0;

    const estimatedCost = baseCost + resultsCost + timeCost;

    return {
      estimatedCost,
      costBreakdown: {
        baseCost,
        resultsCost,
        timeCost
      },
      costTier: this.determineCostTier(estimatedCost)
    };
  }

  private extractResultsCount(result: ApifyToolResult<any>): number {
    if (!result.success || !result.output) {
      return 0;
    }

    // Handle different result formats
    if (Array.isArray(result.output)) {
      return result.output.length;
    }

    // If we can't determine the count, assume 1 result
    return 1;
  }

  private calculateOutputSize(result: ApifyToolResult<any>): number {
    try {
      return JSON.stringify(result.output || []).length;
    } catch {
      return 0;
    }
  }

  private getToolBaseCosts(): Record<string, { fixed: number; perResult: number; perMinute: number }> {
    return {
      'apify-web-search': { fixed: 0.02, perResult: 0.001, perMinute: 0.001 },
      'apify-reddit-search': { fixed: 0.01, perResult: 0.001, perMinute: 0.0005 },
      'apify-twitter-scraper': { fixed: 0.015, perResult: 0.0015, perMinute: 0.001 },
      'apify-instagram-scraper': { fixed: 0.02, perResult: 0.002, perMinute: 0.0015 },
      'apify-facebook-scraper': { fixed: 0.025, perResult: 0.002, perMinute: 0.0015 },
      'apify-linkedin-scraper': { fixed: 0.03, perResult: 0.0025, perMinute: 0.002 },
      'apify-tiktok-scraper': { fixed: 0.02, perResult: 0.0015, perMinute: 0.001 },
      'apify-youtube-scraper': { fixed: 0.015, perResult: 0.001, perMinute: 0.001 },
      'apify-website-crawler': { fixed: 0.05, perResult: 0.002, perMinute: 0.002 },
      'apify-google-search': { fixed: 0.02, perResult: 0.001, perMinute: 0.001 },
      'default': { fixed: 0.01, perResult: 0.001, perMinute: 0.001 }
    };
  }

  private determineCostTier(cost: number): 'free' | 'low' | 'medium' | 'high' | 'premium' {
    if (cost <= 0) return 'free';
    if (cost <= 1.00) return 'low';
    if (cost <= 10.00) return 'medium';
    if (cost <= 100.00) return 'high';
    return 'premium';
  }
} 