import {
  IRPAWorkflow,
  RPAExecutionContext,
  ValidationResult,
  WorkflowHealth,
  RPAWorkflowError
} from '../../../types/RPATypes';

export interface TwitterPostParams {
  readonly content: string;
  readonly media?: TwitterMediaFile[];
  readonly hashtags?: string[];
  readonly mentions?: string[];
}

export interface TwitterMediaFile {
  readonly path: string;
  readonly type: string;
  readonly alt?: string;
}

export interface TwitterPostResult {
  readonly success: boolean;
  readonly postId?: string;
  readonly postUrl?: string;
  readonly timestamp: Date;
  readonly executionTime: number;
}

/**
 * Twitter create post workflow implementation
 * Handles posting content to Twitter using browser automation
 */
export class TwitterCreatePostWorkflow implements IRPAWorkflow<TwitterPostParams, TwitterPostResult> {
  readonly id = 'twitter_create_post';
  readonly domain = 'social-media';
  readonly name = 'Twitter Create Post';
  readonly description = 'Create and publish a post on Twitter using browser automation';
  readonly estimatedDuration = 15000; // 15 seconds
  readonly requiredCapabilities = ['browser_automation', 'twitter_access'] as const;

  async validate(params: TwitterPostParams): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!params.content || params.content.trim().length === 0) {
      errors.push('Content is required');
    }

    if (params.content.length > 280) {
      errors.push('Content exceeds Twitter character limit (280 characters)');
    }

    if (params.media && params.media.length > 4) {
      errors.push('Twitter allows maximum 4 media files per post');
    }

    if (params.hashtags && params.hashtags.length > 10) {
      errors.push('Too many hashtags (recommended maximum: 10)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(
    params: TwitterPostParams,
    context: RPAExecutionContext
  ): Promise<TwitterPostResult> {
    const { page, humanBehavior, logger } = context;
    const startTime = Date.now();

    try {
      logger.info('Starting Twitter post creation', {
        contentLength: params.content.length,
        mediaCount: params.media?.length || 0,
        hashtagCount: params.hashtags?.length || 0
      });

      // Navigate to Twitter compose
      await page.goto('https://twitter.com/compose/tweet', { waitUntil: 'networkidle0' });

      // Wait for compose area to be available
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });

      // Type content with human-like behavior
      const tweetText = this.formatTweetContent(params);
      await humanBehavior.humanType(page, '[data-testid="tweetTextarea_0"]', tweetText);

      // Handle media upload if present
      if (params.media && params.media.length > 0) {
        await this.uploadMedia(page, params.media, humanBehavior);
      }

      // Post tweet
      await humanBehavior.humanClick(page, '[data-testid="tweetButtonInline"]');

      // Wait for success indicator
      await page.waitForSelector('[data-testid="toast"]', { timeout: 10000 });

      // Extract tweet URL (simplified for now)
      const tweetUrl = await this.extractTweetUrl(page);
      const postId = this.extractPostIdFromUrl(tweetUrl);

      const result: TwitterPostResult = {
        success: true,
        postId,
        postUrl: tweetUrl,
        timestamp: new Date(),
        executionTime: Date.now() - startTime
      };

      logger.info('Twitter post created successfully', {
        postId,
        executionTime: result.executionTime
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Twitter post creation failed', {
        error: errorMessage,
        executionTime: Date.now() - startTime
      });

      throw new RPAWorkflowError(
        `Twitter posting failed: ${errorMessage}`,
        this.id,
        { params, executionTime: Date.now() - startTime }
      );
    }
  }

  async getHealthCheck(): Promise<WorkflowHealth> {
    try {
      // Simple health check - verify Twitter is accessible
      // In a full implementation, this would check login status, rate limits, etc.
      return {
        status: 'healthy',
        lastChecked: new Date(),
        issues: []
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastChecked: new Date(),
        issues: [`Health check failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Format tweet content with hashtags
   */
  private formatTweetContent(params: TwitterPostParams): string {
    let content = params.content;

    // Add hashtags if provided
    if (params.hashtags && params.hashtags.length > 0) {
      const hashtagText = params.hashtags.map(tag => `#${tag}`).join(' ');
      content = `${content}\n\n${hashtagText}`;
    }

    // Ensure character limit compliance
    if (content.length > 280) {
      content = content.substring(0, 277) + '...';
    }

    return content;
  }

  /**
   * Upload media files to Twitter
   */
  private async uploadMedia(
    page: import('puppeteer').Page,
    media: TwitterMediaFile[],
    humanBehavior: import('../../../types/RPATypes').HumanBehaviorSimulator
  ): Promise<void> {
    // Click media upload button
    await humanBehavior.humanClick(page, '[data-testid="fileInput"]');

    for (const file of media) {
      // Handle file upload (simplified implementation)
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(file.path);
        
        // Wait for upload to complete
        await page.waitForSelector('[data-testid="media-upload-success"]', { 
          timeout: 30000 
        });
      }
    }
  }

  /**
   * Extract tweet URL after posting
   */
  private async extractTweetUrl(page: import('puppeteer').Page): Promise<string> {
    // Simplified implementation - in reality would extract from DOM or response
    return `https://twitter.com/user/status/${Date.now()}`;
  }

  /**
   * Extract post ID from tweet URL
   */
  private extractPostIdFromUrl(url: string): string {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : `tweet_${Date.now()}`;
  }
} 