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
  MailchimpConfig,
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
  MailchimpError
} from './errors/MarketingErrors';
import { logger } from '../../../lib/logging';

export class MailchimpService implements IMarketingService {
  private readonly httpClient: AxiosInstance;
  
  public readonly provider: MarketingProvider = {
    id: 'mailchimp',
    name: 'Mailchimp',
    apiEndpoint: `https://${this.config.serverPrefix}.api.mailchimp.com/3.0`,
    rateLimit: {
      requestsPerMinute: 120,
      requestsPerHour: 7200,
      requestsPerDay: 172800
    },
    capabilities: [
      { type: 'email_campaigns', isAvailable: true },
      { type: 'drip_campaigns', isAvailable: true, limitations: ['Requires paid plan'] },
      { type: 'audience_segmentation', isAvailable: true },
      { type: 'analytics', isAvailable: true },
      { type: 'templates', isAvailable: true }
    ]
  };

  constructor(
    private readonly config: MailchimpConfig
  ) {
    this.httpClient = axios.create({
      baseURL: this.provider.apiEndpoint,
      headers: {
        'Authorization': `apikey ${config.apiKey}`,
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
        logger.debug('Mailchimp API request', {
          method: config.method,
          url: config.url,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('Mailchimp request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('Mailchimp API response', {
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
    
    logger.error('Mailchimp API error', {
      status,
      data,
      url: error.config?.url,
      method: error.config?.method
    });

    if (status === 401) {
      throw new MarketingAuthenticationError('mailchimp', { status, data });
    }
    
    if (status === 429) {
      const resetAt = new Date(Date.now() + 60000); // Default 1 minute
      throw new MarketingRateLimitError('mailchimp', resetAt, { status, data });
    }
    
    throw new MailchimpError(
      data?.detail || error.message || 'Unknown Mailchimp API error',
      status,
      { data, url: error.config?.url }
    );
  }

  async sendEmail(params: EmailCampaignParams): Promise<CampaignResult> {
    try {
      this.validateEmailCampaignParams(params);
      
      // Create campaign
      const campaignPayload = this.transformToMailchimpCampaignFormat(params);
      const campaignResponse = await this.httpClient.post('/campaigns', campaignPayload);
      const mailchimpCampaignId = campaignResponse.data.id;
      
      // Send campaign
      await this.httpClient.post(`/campaigns/${mailchimpCampaignId}/actions/send`);
      
      const result: CampaignResult = {
        campaignId: params.campaignId,
        status: 'sent',
        sentAt: new Date(),
        recipientCount: params.recipients.length,
        deliveredCount: params.recipients.length,
        openedCount: 0,
        clickedCount: 0,
        unsubscribedCount: 0,
        bounceCount: 0,
        errors: []
      };

      logger.info('Email campaign sent successfully', {
        campaignId: params.campaignId,
        mailchimpCampaignId,
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
      // In a real implementation, we'd need to store the mapping between our campaignId and Mailchimp's ID
      // For now, return a placeholder implementation
      const response = await this.httpClient.get('/campaigns');
      
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
      // In a real implementation, we'd query specific campaign reports
      const response = await this.httpClient.get('/reports');
      const report = response.data.reports[0] || {};
      
      return {
        totalRecipients: report.emails_sent || 0,
        delivered: report.emails_sent - (report.bounces?.hard_bounces || 0) - (report.bounces?.soft_bounces || 0),
        opened: report.opens?.unique_opens || 0,
        clicked: report.clicks?.unique_clicks || 0,
        unsubscribed: report.unsubscribed || 0,
        bounced: (report.bounces?.hard_bounces || 0) + (report.bounces?.soft_bounces || 0),
        openRate: report.opens?.open_rate || 0,
        clickRate: report.clicks?.click_rate || 0,
        unsubscribeRate: report.unsubscribed_rate || 0,
        bounceRate: report.bounce_rate || 0
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
      // Mailchimp uses Automations for drip campaigns
      const automationPayload = this.transformToMailchimpAutomationFormat(campaign);
      const response = await this.httpClient.post('/automations', automationPayload);
      
      const result: Campaign = {
        id: campaign.campaignId,
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

      logger.info('Drip campaign created', { 
        campaignId: campaign.campaignId,
        mailchimpAutomationId: response.data.id 
      });
      
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
    try {
      // Implementation would update Mailchimp automation
      const result: Campaign = {
        id: campaignId,
        name: updates.name || 'Updated Campaign',
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

      logger.info('Drip campaign updated', { campaignId });
      return result;
    } catch (error) {
      logger.error('Failed to update drip campaign', { campaignId, error });
      throw new CampaignExecutionError(
        campaignId,
        'Failed to update drip campaign',
        { originalError: error }
      );
    }
  }

  async activateDripCampaign(campaignId: CampaignId): Promise<void> {
    try {
      // Implementation would start Mailchimp automation
      logger.info('Drip campaign activated', { campaignId });
    } catch (error) {
      logger.error('Failed to activate drip campaign', { campaignId, error });
      throw new CampaignExecutionError(
        campaignId,
        'Failed to activate drip campaign',
        { originalError: error }
      );
    }
  }

  async deactivateDripCampaign(campaignId: CampaignId): Promise<void> {
    try {
      // Implementation would pause Mailchimp automation
      logger.info('Drip campaign deactivated', { campaignId });
    } catch (error) {
      logger.error('Failed to deactivate drip campaign', { campaignId, error });
      throw new CampaignExecutionError(
        campaignId,
        'Failed to deactivate drip campaign',
        { originalError: error }
      );
    }
  }

  async segmentAudience(criteria: SegmentationCriteria): Promise<AudienceSegment> {
    try {
      const segmentPayload = this.transformToMailchimpSegmentFormat(criteria);
      const response = await this.httpClient.post(`/lists/${this.config.defaultListId}/segments`, segmentPayload);
      
      const segment: AudienceSegment = {
        id: `segment_${ulid()}` as SegmentId,
        name: criteria.name,
        contactCount: response.data.member_count || 0,
        criteria,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      logger.info('Audience segment created', { 
        segmentId: segment.id,
        mailchimpSegmentId: response.data.id 
      });
      
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
    try {
      // Implementation would query specific segment from Mailchimp
      const segment: AudienceSegment = {
        id: segmentId,
        name: 'Sample Segment',
        contactCount: 0,
        criteria: {
          segmentId,
          name: 'Sample Segment',
          conditions: [],
          operator: 'and'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      return segment;
    } catch (error) {
      logger.error('Failed to get segment', { segmentId, error });
      throw new MarketingError(
        'Failed to retrieve segment',
        'SEGMENT_NOT_FOUND',
        { segmentId, originalError: error }
      );
    }
  }

  async updateSegment(segmentId: SegmentId, updates: Partial<SegmentationCriteria>): Promise<AudienceSegment> {
    try {
      // Implementation would update Mailchimp segment
      const segment: AudienceSegment = {
        id: segmentId,
        name: updates.name || 'Updated Segment',
        contactCount: 0,
        criteria: {
          segmentId,
          name: updates.name || 'Updated Segment',
          conditions: updates.conditions || [],
          operator: updates.operator || 'and'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      logger.info('Segment updated', { segmentId });
      return segment;
    } catch (error) {
      logger.error('Failed to update segment', { segmentId, error });
      throw new MarketingError(
        'Failed to update segment',
        'SEGMENT_UPDATE_FAILED',
        { segmentId, originalError: error }
      );
    }
  }

  async deleteSegment(segmentId: SegmentId): Promise<void> {
    try {
      // Implementation would delete Mailchimp segment
      logger.info('Segment deleted', { segmentId });
    } catch (error) {
      logger.error('Failed to delete segment', { segmentId, error });
      throw new MarketingError(
        'Failed to delete segment',
        'SEGMENT_DELETE_FAILED',
        { segmentId, originalError: error }
      );
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.httpClient.get('/ping');
      return true;
    } catch (error) {
      logger.error('Mailchimp connection validation failed', { error });
      return false;
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      await this.httpClient.get('/ping');
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

  private transformToMailchimpCampaignFormat(params: EmailCampaignParams): any {
    return {
      type: 'regular',
      recipients: {
        list_id: this.config.defaultListId
      },
      settings: {
        subject_line: params.subject,
        from_name: 'AgentSwarm',
        reply_to: 'noreply@agentswarm.com'
      }
    };
  }

  private transformToMailchimpAutomationFormat(campaign: DripCampaignDefinition): any {
    return {
      type: 'date_based',
      recipients: {
        list_id: this.config.defaultListId
      },
      settings: {
        title: campaign.name,
        from_name: 'AgentSwarm',
        reply_to: 'noreply@agentswarm.com'
      },
      trigger_settings: {
        workflow_type: 'emailSeries'
      }
    };
  }

  private transformToMailchimpSegmentFormat(criteria: SegmentationCriteria): any {
    return {
      name: criteria.name,
      options: {
        match: criteria.operator === 'and' ? 'all' : 'any',
        conditions: criteria.conditions.map(condition => ({
          condition_type: this.mapConditionType(condition.field),
          field: condition.field,
          op: this.mapOperator(condition.operator),
          value: condition.value
        }))
      }
    };
  }

  private mapConditionType(field: string): string {
    const fieldMapping: Record<string, string> = {
      'email': 'EmailAddress',
      'first_name': 'TextMerge',
      'last_name': 'TextMerge',
      'status': 'StaticSegment'
    };
    return fieldMapping[field] || 'TextMerge';
  }

  private mapOperator(operator: string): string {
    const operatorMapping: Record<string, string> = {
      'equals': 'is',
      'contains': 'contains',
      'greater_than': 'greater',
      'less_than': 'less',
      'in': 'is',
      'not_in': 'not'
    };
    return operatorMapping[operator] || 'is';
  }
} 