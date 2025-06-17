import { RPADomainService } from '../../core/RPADomainService';
import { RPADomainConfig, Logger, IRPAWorkflow } from '../../types/RPATypes';
import { TwitterCreatePostWorkflow } from './workflows/TwitterCreatePostWorkflow';
import { LinkedInCreatePostWorkflow } from './workflows/LinkedInCreatePostWorkflow';
import { FacebookCreatePostWorkflow } from './workflows/FacebookCreatePostWorkflow';
import { InstagramCreatePostWorkflow } from './workflows/InstagramCreatePostWorkflow';
import { TikTokCreateVideoWorkflow } from './workflows/TikTokCreateVideoWorkflow';
import { RedditCreatePostWorkflow } from './workflows/RedditCreatePostWorkflow';

/**
 * Social media specific RPA service
 * Manages all social media automation workflows
 */
export class SocialMediaRPAService extends RPADomainService {
  constructor(config: RPADomainConfig, logger: Logger) {
    super('social-media', config, logger);
  }

  /**
   * Register all social media workflows
   */
  protected registerWorkflows(): void {
    // Core posting workflows - use type assertion to handle the parameter type difference
    this.registerWorkflow(new TwitterCreatePostWorkflow() as unknown as IRPAWorkflow);
    this.registerWorkflow(new LinkedInCreatePostWorkflow() as unknown as IRPAWorkflow);
    this.registerWorkflow(new FacebookCreatePostWorkflow() as unknown as IRPAWorkflow);
    this.registerWorkflow(new InstagramCreatePostWorkflow() as unknown as IRPAWorkflow);
    this.registerWorkflow(new TikTokCreateVideoWorkflow() as unknown as IRPAWorkflow);
    this.registerWorkflow(new RedditCreatePostWorkflow() as unknown as IRPAWorkflow);

    this.logger.info('Social media RPA workflows registered', {
      domain: this.domain,
      workflowCount: this.workflows.size
    });
  }

  /**
   * Get social media specific configuration
   */
  getSocialMediaConfig(): SocialMediaRPAConfig {
    return this.config as SocialMediaRPAConfig;
  }
}

/**
 * Social media specific configuration extending base RPA config
 */
export interface SocialMediaRPAConfig extends RPADomainConfig {
  readonly socialMedia: {
    readonly platforms: {
      readonly twitter: PlatformConfig;
      readonly linkedin: PlatformConfig;
      readonly facebook: PlatformConfig;
      readonly instagram: PlatformConfig;
      readonly tiktok: PlatformConfig;
      readonly reddit: PlatformConfig;
    };
    readonly contentLimits: {
      readonly twitter: { maxLength: number; maxMedia: number };
      readonly linkedin: { maxLength: number; maxMedia: number };
      readonly facebook: { maxLength: number; maxMedia: number };
      readonly instagram: { maxLength: number; maxMedia: number };
      readonly tiktok: { maxLength: number; maxVideoSize: number };
      readonly reddit: { maxTitleLength: number; maxBodyLength: number };
    };
  };
}

interface PlatformConfig {
  readonly enabled: boolean;
  readonly rateLimits: {
    readonly postsPerHour: number;
    readonly postsPerDay: number;
  };
  readonly features: {
    readonly scheduling: boolean;
    readonly analytics: boolean;
    readonly mediaUpload: boolean;
  };
}

/**
 * Create default social media RPA configuration
 */
export function createSocialMediaRPAConfig(): SocialMediaRPAConfig {
  return {
    domain: 'social-media',
    enabled: true,
    maxConcurrentExecutions: 5,
    defaultTimeout: 30000, // 30 seconds
    retryConfig: {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 10000
    },
    browserConfig: {
      headless: process.env.RPA_HEADLESS !== 'false',
      maxInstances: parseInt(process.env.RPA_MAX_BROWSERS || '5'),
      idleTimeout: 300000, // 5 minutes
      launchOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        executablePath: process.env.RPA_CHROME_PATH
      }
    },
    security: {
      screenshotsEnabled: process.env.RPA_SCREENSHOTS_ENABLED === 'true',
      auditLogging: true,
      sessionIsolation: true,
      credentialEncryption: true
    },
    socialMedia: {
      platforms: {
        twitter: {
          enabled: true,
          rateLimits: { postsPerHour: 25, postsPerDay: 300 },
          features: { scheduling: true, analytics: true, mediaUpload: true }
        },
        linkedin: {
          enabled: true,
          rateLimits: { postsPerHour: 5, postsPerDay: 125 },
          features: { scheduling: true, analytics: true, mediaUpload: true }
        },
        facebook: {
          enabled: true,
          rateLimits: { postsPerHour: 10, postsPerDay: 200 },
          features: { scheduling: true, analytics: true, mediaUpload: true }
        },
        instagram: {
          enabled: true,
          rateLimits: { postsPerHour: 25, postsPerDay: 100 },
          features: { scheduling: false, analytics: true, mediaUpload: true }
        },
        tiktok: {
          enabled: true,
          rateLimits: { postsPerHour: 2, postsPerDay: 10 },
          features: { scheduling: false, analytics: true, mediaUpload: true }
        },
        reddit: {
          enabled: true,
          rateLimits: { postsPerHour: 6, postsPerDay: 50 },
          features: { scheduling: false, analytics: false, mediaUpload: true }
        }
      },
      contentLimits: {
        twitter: { maxLength: 280, maxMedia: 4 },
        linkedin: { maxLength: 3000, maxMedia: 9 },
        facebook: { maxLength: 63206, maxMedia: 10 },
        instagram: { maxLength: 2200, maxMedia: 10 },
        tiktok: { maxLength: 2200, maxVideoSize: 287457280 }, // 274 MB
        reddit: { maxTitleLength: 300, maxBodyLength: 40000 }
      }
    }
  };
} 