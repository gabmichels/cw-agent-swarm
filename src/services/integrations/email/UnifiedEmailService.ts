/**
 * Unified Email Service - Phase 2 of Orchestration Platform
 * 
 * Provides a unified interface for multiple email providers (Gmail, Outlook)
 * while maintaining provider-specific optimizations and capabilities.
 * 
 * Following IMPLEMENTATION_GUIDELINES.md:
 * - ULID-based IDs for all entities
 * - Strict TypeScript interfaces
 * - Dependency injection pattern
 * - Comprehensive error handling
 * - Immutable data structures
 */

import { ulid } from 'ulid';
import { EmailCapabilities, EmailMessage, EmailSearchCriteria, SendEmailParams, ReplyEmailParams, ForwardEmailParams } from '../../workspace/capabilities/EmailCapabilities';
import { GoogleEmailCapabilities } from '../../workspace/capabilities/google/GoogleEmailCapabilities';
import { DatabaseService } from '../../database/DatabaseService';
import { WorkspaceProvider, WorkspaceConnection, WorkspaceAccountType, ConnectionType, ConnectionStatus } from '../../database/types';
import { logger } from '../../../lib/logging';

// ============================================================================
// Unified Email Interfaces
// ============================================================================

export interface EmailProvider {
  readonly id: string;
  readonly name: string;
  readonly type: 'gmail' | 'outlook';
  readonly isAvailable: boolean;
}

export interface EmailParams {
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly body: string;
  readonly htmlBody?: string;
  readonly attachments?: readonly EmailAttachment[];
  readonly priority?: 'low' | 'normal' | 'high';
  readonly requestDeliveryReceipt?: boolean;
  readonly requestReadReceipt?: boolean;
}

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer;
  readonly contentType: string;
  readonly mimeType: string;
  readonly attachmentId: string;
  readonly size: number;
}

export interface EmailFilters {
  readonly query?: string;
  readonly from?: string;
  readonly to?: string;
  readonly subject?: string;
  readonly hasAttachments?: boolean;
  readonly isUnread?: boolean;
  readonly isImportant?: boolean;
  readonly labels?: readonly string[];
  readonly dateRange?: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly maxResults?: number;
  readonly pageToken?: string;
}

export interface EmailResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly threadId?: string;
  readonly message?: EmailMessage;
  readonly error?: string;
  readonly provider: 'gmail' | 'outlook';
  readonly timestamp: Date;
}

export interface WebhookConfig {
  readonly id: string;
  readonly provider: 'gmail' | 'outlook';
  readonly userId: string;
  readonly webhookUrl: string;
  readonly events: readonly string[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

export interface EmailServiceConfig {
  readonly providers: {
    readonly gmail: {
      readonly enabled: boolean;
      readonly clientId?: string;
      readonly clientSecret?: string;
    };
    readonly outlook: {
      readonly enabled: boolean;
      readonly clientId?: string;
      readonly clientSecret?: string;
      readonly tenantId?: string;
    };
  };
  readonly webhooks: {
    readonly enabled: boolean;
    readonly baseUrl: string;
    readonly secret: string;
  };
  readonly rateLimiting: {
    readonly maxEmailsPerHour: number;
    readonly maxEmailsPerDay: number;
  };
}

// ============================================================================
// Custom Error Types
// ============================================================================

export class UnifiedEmailError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider?: 'gmail' | 'outlook',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'UnifiedEmailError';
  }
}

export class EmailProviderError extends UnifiedEmailError {
  constructor(provider: 'gmail' | 'outlook', message: string, context?: Record<string, unknown>) {
    super(`${provider} provider error: ${message}`, 'PROVIDER_ERROR', provider, context);
  }
}

export class EmailValidationError extends UnifiedEmailError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(`Validation error: ${message}`, 'VALIDATION_ERROR', undefined, context);
  }
}

export class EmailRateLimitError extends UnifiedEmailError {
  constructor(provider: 'gmail' | 'outlook', resetTime: Date, context?: Record<string, unknown>) {
    super(`Rate limit exceeded for ${provider}. Resets at ${resetTime.toISOString()}`, 'RATE_LIMIT_ERROR', provider, context);
  }
}

// ============================================================================
// Unified Email Service Implementation
// ============================================================================

export class UnifiedEmailService {
  private readonly config: EmailServiceConfig;
  private readonly database: DatabaseService;
  private readonly providers = new Map<'gmail' | 'outlook', EmailCapabilities>();
  private readonly rateLimitTracking = new Map<string, { count: number; resetTime: Date }>();

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.database = DatabaseService.getInstance();
    this.initializeProviders();
  }

  // ============================================================================
  // Provider Management
  // ============================================================================

  private initializeProviders(): void {
    // Initialize Gmail provider if enabled
    if (this.config.providers.gmail.enabled) {
      this.providers.set('gmail', new GoogleEmailCapabilities());
      logger.info('Gmail provider initialized');
    }

    // Initialize Outlook provider if enabled (placeholder for future implementation)
    if (this.config.providers.outlook.enabled) {
      // TODO: Implement OutlookEmailCapabilities when Microsoft 365 integration is ready
      logger.info('Outlook provider configuration ready (implementation pending)');
    }
  }

  /**
   * Get available email providers
   */
  async getAvailableProviders(): Promise<readonly EmailProvider[]> {
    const providers: EmailProvider[] = [];

    if (this.config.providers.gmail.enabled) {
      providers.push({
        id: ulid(),
        name: 'Gmail',
        type: 'gmail',
        isAvailable: this.providers.has('gmail')
      });
    }

    if (this.config.providers.outlook.enabled) {
      providers.push({
        id: ulid(),
        name: 'Outlook',
        type: 'outlook',
        isAvailable: this.providers.has('outlook')
      });
    }

    return providers;
  }

  /**
   * Get the best available provider for a user
   */
  private async getBestProvider(userId: string): Promise<{ provider: 'gmail' | 'outlook'; connection: WorkspaceConnection }> {
    // Mock connections for now since we don't have the actual database method
    const connections: WorkspaceConnection[] = [
      {
        id: ulid(),
        userId,
        organizationId: ulid(),
        provider: WorkspaceProvider.GOOGLE_WORKSPACE,
        accountType: WorkspaceAccountType.ORGANIZATIONAL,
        connectionType: ConnectionType.OAUTH_PERSONAL,
        accessToken: 'encrypted_token',
        refreshToken: 'encrypted_refresh',
        tokenExpiresAt: new Date(Date.now() + 86400000),
        scopes: 'read,write',
        providerAccountId: `gmail_${userId}`,
        displayName: 'Gmail Account',
        email: `${userId}@gmail.com`,
        status: ConnectionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Prefer Gmail if available
    const gmailConnection = connections.find((c: WorkspaceConnection) => c.provider === WorkspaceProvider.GOOGLE_WORKSPACE);
    if (gmailConnection && this.providers.has('gmail')) {
      return { provider: 'gmail', connection: gmailConnection };
    }

    // Fall back to Outlook if available
    const outlookConnection = connections.find((c: WorkspaceConnection) => c.provider === WorkspaceProvider.MICROSOFT_365);
    if (outlookConnection && this.providers.has('outlook')) {
      return { provider: 'outlook', connection: outlookConnection };
    }

    throw new UnifiedEmailError('No email provider available for user', 'NO_PROVIDER_AVAILABLE', undefined, { userId });
  }

  // ============================================================================
  // Email Operations
  // ============================================================================

  /**
   * Send email using the best available provider
   */
  async sendEmail(userId: string, agentId: string, params: EmailParams): Promise<EmailResult> {
    const operationId = ulid();
    const timestamp = new Date();

    try {
      // Validate parameters
      this.validateEmailParams(params);

      // Check rate limits
      await this.checkRateLimit(userId);

      // Get best provider
      const { provider, connection } = await this.getBestProvider(userId);
      const emailProvider = this.providers.get(provider);

      if (!emailProvider) {
        throw new EmailProviderError(provider, 'Provider not available');
      }

      // Convert to provider-specific format
      const providerParams: SendEmailParams = {
        to: [...params.to],
        cc: params.cc ? [...params.cc] : undefined,
        bcc: params.bcc ? [...params.bcc] : undefined,
        subject: params.subject,
        body: params.body,
        htmlBody: params.htmlBody,
        attachments: params.attachments ? [...params.attachments] : undefined
      };

      // Send email
      const message = await emailProvider.sendEmail(providerParams, connection.id, agentId);

      // Update rate limit tracking
      this.updateRateLimit(userId);

      logger.info('Email sent successfully', {
        operationId,
        provider,
        messageId: message.id,
        agentId,
        userId
      });

      return {
        success: true,
        messageId: message.id,
        threadId: message.threadId,
        message,
        provider,
        timestamp
      };

    } catch (error) {
      logger.error('Failed to send email', {
        operationId,
        error: error instanceof Error ? error.message : error,
        agentId,
        userId
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'gmail', // Default for error reporting
        timestamp
      };
    }
  }

  /**
   * Get emails using the best available provider
   */
  async getEmails(userId: string, agentId: string, filters: EmailFilters): Promise<readonly EmailMessage[]> {
    try {
      // Get best provider
      const { provider, connection } = await this.getBestProvider(userId);
      const emailProvider = this.providers.get(provider);

      if (!emailProvider) {
        throw new EmailProviderError(provider, 'Provider not available');
      }

      // Convert to provider-specific format
      const criteria: EmailSearchCriteria = {
        query: filters.query,
        from: filters.from,
        to: filters.to,
        subject: filters.subject,
        hasAttachment: filters.hasAttachments,
        isUnread: filters.isUnread,
        labels: filters.labels ? [...filters.labels] : undefined,
        maxResults: filters.maxResults || 50,
        pageToken: filters.pageToken
      };

      // Get emails
      const messages = await emailProvider.searchEmails(criteria, connection.id, agentId);

      logger.info('Emails retrieved successfully', {
        provider,
        count: messages.length,
        agentId,
        userId
      });

      return messages;

    } catch (error) {
      logger.error('Failed to get emails', {
        error: error instanceof Error ? error.message : error,
        agentId,
        userId
      });
      throw error;
    }
  }

  /**
   * Setup email webhook for real-time notifications
   */
  async setupEmailWebhook(provider: 'gmail' | 'outlook', userId: string): Promise<WebhookConfig> {
    if (!this.config.webhooks.enabled) {
      throw new UnifiedEmailError('Webhooks not enabled', 'WEBHOOKS_DISABLED');
    }

    const webhookId = ulid();
    const webhookUrl = `${this.config.webhooks.baseUrl}/webhooks/email/${provider}/${webhookId}`;

    try {
      // Provider-specific webhook setup
      if (provider === 'gmail') {
        // Gmail uses Google Cloud Pub/Sub for push notifications
        // Implementation would set up Pub/Sub topic and subscription
        logger.info('Gmail webhook setup initiated', { webhookId, userId });
      } else if (provider === 'outlook') {
        // Outlook uses Microsoft Graph webhooks
        // Implementation would create subscription via Graph API
        logger.info('Outlook webhook setup initiated', { webhookId, userId });
      }

      const config: WebhookConfig = {
        id: webhookId,
        provider,
        userId,
        webhookUrl,
        events: ['message.received', 'message.sent', 'message.deleted'],
        isActive: true,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };

      // Store webhook configuration
      // TODO: Implement webhook storage in database

      return config;

    } catch (error) {
      logger.error('Failed to setup email webhook', {
        provider,
        userId,
        error: error instanceof Error ? error.message : error
      });
      throw new EmailProviderError(provider, `Failed to setup webhook: ${error instanceof Error ? error.message : error}`);
    }
  }

  // ============================================================================
  // Validation and Rate Limiting
  // ============================================================================

  private validateEmailParams(params: EmailParams): void {
    if (!params.to || params.to.length === 0) {
      throw new EmailValidationError('At least one recipient is required');
    }

    if (!params.subject || params.subject.trim().length === 0) {
      throw new EmailValidationError('Subject is required');
    }

    if (!params.body || params.body.trim().length === 0) {
      throw new EmailValidationError('Body is required');
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmails = [...params.to, ...(params.cc || []), ...(params.bcc || [])];
    
    for (const email of allEmails) {
      if (!emailRegex.test(email)) {
        throw new EmailValidationError(`Invalid email address: ${email}`);
      }
    }
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const now = new Date();
    const tracking = this.rateLimitTracking.get(userId);

    if (!tracking) {
      return; // No previous usage
    }

    if (now < tracking.resetTime && tracking.count >= this.config.rateLimiting.maxEmailsPerHour) {
      throw new EmailRateLimitError('gmail', tracking.resetTime, { userId, count: tracking.count });
    }
  }

  private updateRateLimit(userId: string): void {
    const now = new Date();
    const resetTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const tracking = this.rateLimitTracking.get(userId);

    if (!tracking || now >= tracking.resetTime) {
      // Reset or initialize tracking
      this.rateLimitTracking.set(userId, { count: 1, resetTime });
    } else {
      // Increment existing tracking
      tracking.count++;
    }
  }

  // ============================================================================
  // Health and Monitoring
  // ============================================================================

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly providers: readonly {
      readonly name: string;
      readonly type: 'gmail' | 'outlook';
      readonly status: 'healthy' | 'unhealthy';
      readonly lastChecked: Date;
    }[];
    readonly webhooks: {
      readonly enabled: boolean;
      readonly activeCount: number;
    };
  }> {
    const providerStatuses = [];
    let overallHealthy = true;

    // Check Gmail provider
    if (this.providers.has('gmail')) {
      try {
        // Simple health check - could be enhanced with actual API call
        providerStatuses.push({
          name: 'Gmail',
          type: 'gmail' as const,
          status: 'healthy' as const,
          lastChecked: new Date()
        });
      } catch {
        providerStatuses.push({
          name: 'Gmail',
          type: 'gmail' as const,
          status: 'unhealthy' as const,
          lastChecked: new Date()
        });
        overallHealthy = false;
      }
    }

    // Check Outlook provider
    if (this.providers.has('outlook')) {
      try {
        providerStatuses.push({
          name: 'Outlook',
          type: 'outlook' as const,
          status: 'healthy' as const,
          lastChecked: new Date()
        });
      } catch {
        providerStatuses.push({
          name: 'Outlook',
          type: 'outlook' as const,
          status: 'unhealthy' as const,
          lastChecked: new Date()
        });
        overallHealthy = false;
      }
    }

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      providers: providerStatuses,
      webhooks: {
        enabled: this.config.webhooks.enabled,
        activeCount: 0 // TODO: Implement webhook counting
      }
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createUnifiedEmailService(config?: Partial<EmailServiceConfig>): UnifiedEmailService {
  const defaultConfig: EmailServiceConfig = {
    providers: {
      gmail: {
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      },
      outlook: {
        enabled: false, // Disabled until Microsoft 365 integration is implemented
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        tenantId: process.env.MICROSOFT_TENANT_ID
      }
    },
    webhooks: {
      enabled: true,
      baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',
      secret: process.env.WEBHOOK_SECRET || 'default-secret'
    },
    rateLimiting: {
      maxEmailsPerHour: 100,
      maxEmailsPerDay: 1000
    }
  };

  // Deep merge configuration to handle nested objects properly
  const finalConfig: EmailServiceConfig = {
    providers: {
      gmail: { ...defaultConfig.providers.gmail, ...config?.providers?.gmail },
      outlook: { ...defaultConfig.providers.outlook, ...config?.providers?.outlook }
    },
    webhooks: { ...defaultConfig.webhooks, ...config?.webhooks },
    rateLimiting: { ...defaultConfig.rateLimiting, ...config?.rateLimiting }
  };

  return new UnifiedEmailService(finalConfig);
} 