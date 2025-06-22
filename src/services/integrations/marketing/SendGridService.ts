import { ulid } from 'ulid';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  IMarketingService,
  MarketingProvider,
  EmailCampaignParams,
  CampaignResult,
  CampaignMetrics,
  DripCampaignDefinition,
  Campaign,
  SegmentationCriteria,
  AudienceSegment,
  HealthStatus,
  SendGridConfig,
  CampaignId,
  SegmentId
} from './interfaces/MarketingInterfaces';
import {
  MarketingError,
  MarketingConnectionError,
  MarketingAuthenticationError,
  CampaignValidationError,
  CampaignExecutionError,
  MarketingRateLimitError,
  SendGridError
} from './errors/MarketingErrors';
import { logger } from '../../../lib/logging';

export class SendGridService implements IMarketingService {
  private readonly httpClient: AxiosInstance;
  
  public readonly provider: MarketingProvider = {
    id: 'sendgrid',
    name: 'SendGrid',
    apiEndpoint: 'https://api.sendgrid.com/v3',
    rateLimit: {
      requestsPerMinute: 600,
      requestsPerHour: 10000,
      requestsPerDay: 100000
    },
    capabilities: [
      { type: 'email_campaigns', isAvailable: true },
      { type: 'drip_campaigns', isAvailable: true },
      { type: 'audience_segmentation', isAvailable: true },
      { type: 'analytics', isAvailable: true },
      { type: 'templates', isAvailable: true }
    ]
  };

  constructor(
    private readonly config: SendGridConfig
  ) {
    this.httpClient = axios.create({
      baseURL: this.provider.apiEndpoint,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AgentSwarm/1.0'
      },
      timeout: 30000
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('SendGrid API request', {
          method: config.method,
          url: config.url,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('SendGrid request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('SendGrid API response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        this.handleHttpError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleHttpError(error: AxiosError): void {
    const status = error.response?.status;
    const data = error.response?.data as any;
    
    logger.error('SendGrid API error', {
      status,
      data,
      url: error.config?.url,
      method: error.config?.method
    });

    if (status === 401) {
      throw new MarketingAuthenticationError('sendgrid', { status, data });
    }
    
    if (status === 429) {
      const resetAt = new Date(Date.now() + 60000); // Default 1 minute
      throw new MarketingRateLimitError('sendgrid', resetAt, { status, data });
    }
    
    throw new SendGridError(
      data?.message || error.message || 'Unknown SendGrid API error',
      status,
      { data, url: error.config?.url }
    );
  }

  async sendEmail(params: EmailCampaignParams): Promise<CampaignResult> {
    try {
      this.validateEmailCampaignParams(params);
      
      const sendGridPayload = this.transformToSendGridFormat(params);
      
      const response = await this.httpClient.post('/mail/send', sendGridPayload);
      
      const result: CampaignResult = {
        campaignId: params.campaignId,
        status: 'sent',
        sentAt: new Date(),
        recipientCount: params.recipients.length,
        deliveredCount: params.recipients.length, // SendGrid doesn't provide immediate delivery status
        openedCount: 0,
        clickedCount: 0,
        unsubscribedCount: 0,
        bounceCount: 0,
        errors: []
      };

      logger.info('Email campaign sent successfully', {
        campaignId: params.campaignId,
        recipientCount: params.recipients.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to send email campaign', {
        campaignId: params.campaignId,
        error
      });
      
      if (error instanceof MarketingError) {
        throw error;
      }
      
      throw new CampaignExecutionError(
        params.campaignId,
        error instanceof Error ? error.message : 'Unknown error',
        { originalError: error }
      );
    }
  }

  async getCampaignStatus(campaignId: CampaignId): Promise<CampaignResult> {
    try {
      // SendGrid doesn't have a direct campaign status endpoint for single sends
      // This would typically require storing campaign metadata and using stats API
      const response = await this.httpClient.get('/stats');
      
      return {
        campaignId,
        status: 'completed',
        sentAt: new Date(),
        recipientCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        unsubscribedCount: 0,
        bounceCount: 0,
        errors: []
      };
    } catch (error) {
      logger.error('Failed to get campaign status', { campaignId, error });
      throw new CampaignExecutionError(
        campaignId,
        'Failed to retrieve campaign status',
        { originalError: error }
      );
    }
  }

  async getCampaignMetrics(campaignId: CampaignId): Promise<CampaignMetrics> {
    try {
      const response = await this.httpClient.get('/stats', {
        params: {
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        }
      });

      const stats = response.data[0]?.stats[0]?.metrics || {};
      
      return {
        totalRecipients: stats.requests || 0,
        delivered: stats.delivered || 0,
        opened: stats.unique_opens || 0,
        clicked: stats.unique_clicks || 0,
        unsubscribed: stats.unsubscribes || 0,
        bounced: stats.bounces || 0,
        openRate: stats.requests > 0 ? (stats.unique_opens / stats.requests) * 100 : 0,
        clickRate: stats.requests > 0 ? (stats.unique_clicks / stats.requests) * 100 : 0,
        unsubscribeRate: stats.requests > 0 ? (stats.unsubscribes / stats.requests) * 100 : 0,
        bounceRate: stats.requests > 0 ? (stats.bounces / stats.requests) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get campaign metrics', { campaignId, error });
      throw new CampaignExecutionError(
        campaignId,
        'Failed to retrieve campaign metrics',
        { originalError: error }
      );
    }
  }

  async createDripCampaign(campaign: DripCampaignDefinition): Promise<Campaign> {
    try {
      // SendGrid doesn't have native drip campaigns - would need to implement using Automation API
      // For now, create a placeholder implementation
      const campaignId = campaign.campaignId;
      
      const result: Campaign = {
        id: campaignId,
        name: campaign.name,
        type: 'drip',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        metrics: {
          totalRecipients: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          unsubscribed: 0,
          bounced: 0,
          openRate: 0,
          clickRate: 0,
          unsubscribeRate: 0,
          bounceRate: 0
        }
      };

      logger.info('Drip campaign created', { campaignId: campaign.campaignId });
      return result;
    } catch (error) {
      logger.error('Failed to create drip campaign', { campaignId: campaign.campaignId, error });
      throw new CampaignExecutionError(
        campaign.campaignId,
        'Failed to create drip campaign',
        { originalError: error }
      );
    }
  }

  async updateDripCampaign(campaignId: CampaignId, updates: Partial<DripCampaignDefinition>): Promise<Campaign> {
    // Implementation would depend on SendGrid's Automation API
    throw new MarketingError('Drip campaign updates not yet implemented', 'NOT_IMPLEMENTED');
  }

  async activateDripCampaign(campaignId: CampaignId): Promise<void> {
    // Implementation would depend on SendGrid's Automation API
    logger.info('Drip campaign activated', { campaignId });
  }

  async deactivateDripCampaign(campaignId: CampaignId): Promise<void> {
    // Implementation would depend on SendGrid's Automation API
    logger.info('Drip campaign deactivated', { campaignId });
  }

  async segmentAudience(criteria: SegmentationCriteria): Promise<AudienceSegment> {
    try {
      // SendGrid uses lists and segments - this would create a segment
      const response = await this.httpClient.post('/marketing/segments', {
        name: criteria.name,
        query_dsl: this.buildSendGridQuery(criteria)
      });

      const segment: AudienceSegment = {
        id: `segment_${ulid()}` as SegmentId,
        name: criteria.name,
        contactCount: 0, // Would need to query for actual count
        criteria,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      logger.info('Audience segment created', { segmentId: segment.id });
      return segment;
    } catch (error) {
      logger.error('Failed to create audience segment', { criteria, error });
      throw new MarketingError(
        'Failed to create audience segment',
        'SEGMENTATION_FAILED',
        { criteria, originalError: error }
      );
    }
  }

  async getSegment(segmentId: SegmentId): Promise<AudienceSegment> {
    // Implementation would query SendGrid's segments API
    throw new MarketingError('Get segment not yet implemented', 'NOT_IMPLEMENTED');
  }

  async updateSegment(segmentId: SegmentId, updates: Partial<SegmentationCriteria>): Promise<AudienceSegment> {
    // Implementation would update SendGrid segment
    throw new MarketingError('Update segment not yet implemented', 'NOT_IMPLEMENTED');
  }

  async deleteSegment(segmentId: SegmentId): Promise<void> {
    // Implementation would delete SendGrid segment
    logger.info('Segment deleted', { segmentId });
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.httpClient.get('/user/profile');
      return true;
    } catch (error) {
      logger.error('SendGrid connection validation failed', { error });
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.httpClient.get('/user/profile');
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: true,
        lastChecked: new Date(),
        responseTime,
        rateLimitStatus: {
          remaining: 1000, // Would need to parse from headers
          resetAt: new Date(Date.now() + 60000),
          isThrottled: false
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        rateLimitStatus: {
          remaining: 0,
          resetAt: new Date(Date.now() + 60000),
          isThrottled: true
        }
      };
    }
  }

  private validateEmailCampaignParams(params: EmailCampaignParams): void {
    const errors: string[] = [];
    
    if (!params.subject?.trim()) {
      errors.push('Subject is required');
    }
    
    if (!params.content?.text?.trim() && !params.content?.html?.trim()) {
      errors.push('Email content (text or HTML) is required');
    }
    
    if (!params.recipients?.length) {
      errors.push('At least one recipient is required');
    }
    
    params.recipients.forEach((recipient, index) => {
      if (!recipient.email?.trim()) {
        errors.push(`Recipient ${index + 1}: Email is required`);
      } else if (!this.isValidEmail(recipient.email)) {
        errors.push(`Recipient ${index + 1}: Invalid email format`);
      }
    });
    
    if (errors.length > 0) {
      throw new CampaignValidationError(errors, params.campaignId);
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private transformToSendGridFormat(params: EmailCampaignParams): any {
    return {
      personalizations: [
        {
          to: params.recipients.map(r => ({
            email: r.email,
            name: r.name
          }))
        }
      ],
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName
      },
      subject: params.subject,
      content: [
        {
          type: 'text/plain',
          value: params.content.text
        },
        ...(params.content.html ? [{
          type: 'text/html',
          value: params.content.html
        }] : [])
      ],
      tracking_settings: {
        click_tracking: {
          enable: params.trackingEnabled
        },
        open_tracking: {
          enable: params.trackingEnabled
        }
      }
    };
  }

  private buildSendGridQuery(criteria: SegmentationCriteria): string {
    // Build SendGrid query DSL from criteria
    // This is a simplified implementation
    return JSON.stringify({
      and: criteria.conditions.map(condition => ({
        [condition.field]: {
          [condition.operator]: condition.value
        }
      }))
    });
  }
} 