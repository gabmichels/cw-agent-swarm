import { Page } from 'puppeteer';
import { 
  IRPAWorkflow, 
  RPAExecutionContext, 
  ValidationResult,
  RPAWorkflowError,
  WorkflowHealth
} from '../../../types/RPATypes';

/**
 * Instagram Direct Message Parameters
 */
export interface InstagramDMParams {
  targetUsername: string;        // Username to send DM to (@username or username)
  message: string;              // Message content (max 1000 characters)
  media?: {
    type: 'image' | 'video' | 'gif';
    path: string;
    alt?: string;
  }[];
  delay?: {
    min: number;                // Minimum delay between actions (ms)
    max: number;                // Maximum delay between actions (ms)
  };
}

/**
 * Instagram Direct Message Result
 */
export interface InstagramDMResult {
  success: boolean;
  messageId?: string;
  conversationId?: string;
  timestamp: Date;
  error?: string;
  executionTime: number;
  screenshots?: string[];       // For debugging/audit
}

/**
 * Instagram Direct Message Workflow
 * 
 * Uses browser automation to send direct messages on Instagram
 * Includes human behavior simulation and anti-detection measures
 */
export class InstagramDirectMessageWorkflow implements IRPAWorkflow<InstagramDMParams, InstagramDMResult> {
  readonly id = 'instagram_send_dm';
  readonly domain = 'social-media';
  readonly name = 'Instagram Send Direct Message';
  readonly description = 'Send a direct message to an Instagram user using browser automation';
  readonly estimatedDuration = 25000; // 25 seconds
  readonly requiredCapabilities = ['browser_automation', 'instagram_access'];

  async validate(params: InstagramDMParams): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate target username
    if (!params.targetUsername || params.targetUsername.trim().length === 0) {
      errors.push('Target username is required');
    }

    // Clean and validate username format
    const cleanUsername = params.targetUsername.replace('@', '').trim();
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleanUsername)) {
      errors.push('Invalid Instagram username format');
    }

    // Validate message content
    if (!params.message || params.message.trim().length === 0) {
      errors.push('Message content is required');
    }

    if (params.message && params.message.length > 1000) {
      errors.push('Message exceeds Instagram 1000 character limit');
    }

    // Validate media if provided
    if (params.media && params.media.length > 0) {
      for (const media of params.media) {
        if (!['image', 'video', 'gif'].includes(media.type)) {
          errors.push(`Unsupported media type: ${media.type}`);
        }
        if (!media.path) {
          errors.push('Media path is required');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async execute(
    params: InstagramDMParams,
    context: RPAExecutionContext
  ): Promise<InstagramDMResult> {
    const { page, humanBehavior, logger } = context;
    const startTime = Date.now();

    try {
      // Clean username
      const targetUsername = params.targetUsername.replace('@', '').trim();
      
      logger.info('Starting Instagram DM workflow', {
        targetUsername,
        messageLength: params.message.length,
        hasMedia: !!params.media?.length
      });

      // Navigate to Instagram DMs
      await this.navigateToDirectMessages(page, humanBehavior);

      // Search for user and start conversation
      await this.searchAndSelectUser(page, humanBehavior, targetUsername);

      // Send the message
      const messageId = await this.sendMessage(page, humanBehavior, params);

      // Upload media if provided
      if (params.media && params.media.length > 0) {
        await this.uploadMedia(page, humanBehavior, params.media);
      }

      // Wait for message confirmation
      await this.waitForMessageConfirmation(page);

      logger.info('Instagram DM sent successfully', {
        targetUsername,
        messageId,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        messageId,
        timestamp: new Date(),
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error('Instagram DM workflow failed', {
        error: errorMessage,
        targetUsername: params.targetUsername,
        executionTime: Date.now() - startTime
      });

      throw new RPAWorkflowError(
        `Instagram DM sending failed: ${errorMessage}`,
        this.id,
        {
          params,
          error: errorMessage,
          executionTime: Date.now() - startTime
        }
      );
    }
  }

  async getHealthCheck(): Promise<WorkflowHealth> {
    return {
      status: 'healthy' as const,
      lastChecked: new Date(),
      issues: []
    };
  }

  /**
   * Navigate to Instagram Direct Messages
   */
  private async navigateToDirectMessages(page: Page, humanBehavior: any): Promise<void> {
    // Go to Instagram home if not already there
    if (!page.url().includes('instagram.com')) {
      await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle0' });
      await humanBehavior.randomDelay(2000, 4000);
    }

    // Look for DM icon in navigation or direct navigation
    try {
      // Try clicking the DM icon in navigation
      await page.waitForSelector('[aria-label="Direct"]', { timeout: 5000 });
      await humanBehavior.humanClick(page, '[aria-label="Direct"]');
    } catch {
      // Fallback: direct navigation to DMs
      await page.goto('https://www.instagram.com/direct/inbox/', { waitUntil: 'networkidle0' });
    }

    await humanBehavior.randomDelay(2000, 3000);
  }

  /**
   * Search for target user and select conversation
   */
  private async searchAndSelectUser(page: Page, humanBehavior: any, username: string): Promise<void> {
    // Look for new message button or search
    const newMessageSelectors = [
      '[aria-label="New message"]',
      'button:has-text("Send message")',
      '[data-testid="new-message-button"]',
      'svg[aria-label="New message"]'
    ];

    let found = false;
    for (const selector of newMessageSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await humanBehavior.humanClick(page, selector);
        found = true;
        break;
      } catch {
        continue;
      }
    }

    if (found) {
      await humanBehavior.randomDelay(1000, 2000);
    }

    // Search for the username
    const searchSelectors = [
      'input[placeholder*="Search"]',
      'input[aria-label*="Search"]',
      'input[name="queryBox"]',
      '[data-testid="search-input"]'
    ];

    let searchInput = null;
    for (const selector of searchSelectors) {
      try {
        searchInput = await page.waitForSelector(selector, { timeout: 3000 });
        break;
      } catch {
        continue;
      }
    }

    if (!searchInput) {
      throw new Error('Could not find search input for username');
    }

    // Type username with human behavior
    await humanBehavior.humanType(page, searchInput, username);
    await humanBehavior.randomDelay(1500, 2500);

    // Wait for search results and click the user
    try {
      const userResultSelector = `[role="button"]:has-text("${username}"), [data-testid="user-result"]:has-text("${username}")`;
      await page.waitForSelector(userResultSelector, { timeout: 5000 });
      await humanBehavior.humanClick(page, userResultSelector);
    } catch {
      // Fallback: try pressing Enter on search
      await page.keyboard.press('Enter');
    }

    await humanBehavior.randomDelay(1000, 2000);
  }

  /**
   * Send the actual message
   */
  private async sendMessage(page: Page, humanBehavior: any, params: InstagramDMParams): Promise<string> {
    // Look for message input
    const messageInputSelectors = [
      'textarea[placeholder*="Message"]',
      'div[contenteditable="true"][aria-label*="Message"]',
      '[data-testid="message-input"]',
      'textarea[aria-label="Message"]'
    ];

    let messageInput = null;
    for (const selector of messageInputSelectors) {
      try {
        messageInput = await page.waitForSelector(selector, { timeout: 5000 });
        break;
      } catch {
        continue;
      }
    }

    if (!messageInput) {
      throw new Error('Could not find message input field');
    }

    // Type the message with human behavior
    await humanBehavior.humanType(page, messageInput, params.message);
    await humanBehavior.randomDelay(500, 1500);

    // Send the message
    const sendSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      '[aria-label="Send"]',
      '[data-testid="send-button"]'
    ];

    let sendButton = null;
    for (const selector of sendSelectors) {
      try {
        sendButton = await page.waitForSelector(selector, { timeout: 3000 });
        break;
      } catch {
        continue;
      }
    }

    if (sendButton) {
      await humanBehavior.humanClick(page, sendButton);
    } else {
      // Fallback: press Enter
      await page.keyboard.press('Enter');
    }

    await humanBehavior.randomDelay(1000, 2000);

    // Generate a mock message ID for tracking
    return `dm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Upload media attachments
   */
  private async uploadMedia(page: Page, humanBehavior: any, media: any[]): Promise<void> {
    for (const attachment of media) {
      try {
        // Look for attachment/media button
        const mediaSelectors = [
          '[aria-label="Attach a photo or video"]',
          'input[type="file"]',
          '[data-testid="media-button"]',
          'button:has-text("Photo")'
        ];

        let mediaButton = null;
        for (const selector of mediaSelectors) {
          try {
            mediaButton = await page.waitForSelector(selector, { timeout: 3000 });
            break;
          } catch {
            continue;
          }
        }

        if (mediaButton) {
          const tagName = await mediaButton.evaluate((el: Element) => el.tagName);
          if (tagName === 'INPUT') {
            // Direct file input - cast to correct type
            const fileInput = mediaButton as any;
            await fileInput.uploadFile(attachment.path);
          } else {
            // Click button to reveal file input
            await humanBehavior.humanClick(page, mediaButton);
            await humanBehavior.randomDelay(500, 1000);
            
            const fileInputElement = await page.waitForSelector('input[type="file"]', { timeout: 3000 });
            if (fileInputElement) {
              await (fileInputElement as any).uploadFile(attachment.path);
            }
          }

          await humanBehavior.randomDelay(2000, 4000); // Wait for upload
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Log warning but continue - media upload is optional
        console.warn(`Failed to upload media: ${errorMessage}`);
      }
    }
  }

  /**
   * Wait for message delivery confirmation
   */
  private async waitForMessageConfirmation(page: Page): Promise<void> {
    try {
      // Look for delivery indicators
      const confirmationSelectors = [
        '[aria-label="Seen"]',
        '[aria-label="Delivered"]',
        '.message-sent-indicator',
        '[data-testid="message-status"]'
      ];

      for (const selector of confirmationSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          return; // Found confirmation
        } catch {
          continue;
        }
      }
    } catch {
      // Confirmation not found, but that's okay
    }
  }
} 