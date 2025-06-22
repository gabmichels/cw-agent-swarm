import { ULID } from 'ulid';

// ULID-based identifiers
export type CampaignId = `campaign_${ULID}`;
export type SegmentId = `segment_${ULID}`;
export type ContactId = `contact_${ULID}`;
export type TemplateId = `template_${ULID}`;

// Core interfaces
export interface MarketingProvider {
  readonly id: string;
  readonly name: string;
  readonly apiEndpoint: string;
  readonly rateLimit: RateLimitConfig;
  readonly capabilities: readonly MarketingCapability[];
}

export interface MarketingCapability {
  readonly type: 'email_campaigns' | 'drip_campaigns' | 'audience_segmentation' | 'analytics' | 'templates';
  readonly isAvailable: boolean;
  readonly limitations?: readonly string[];
}

export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly requestsPerHour: number;
  readonly requestsPerDay: number;
}

// Email campaign interfaces
export interface EmailCampaignParams {
  readonly campaignId: CampaignId;
  readonly subject: string;
  readonly content: EmailContent;
  readonly recipients: readonly EmailRecipient[];
  readonly scheduledAt?: Date;
  readonly trackingEnabled: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface EmailContent {
  readonly html?: string;
  readonly text: string;
  readonly templateId?: TemplateId;
  readonly personalizations?: readonly PersonalizationVariable[];
}

export interface PersonalizationVariable {
  readonly key: string;
  readonly value: string;
  readonly fallback?: string;
}

export interface EmailRecipient {
  readonly email: string;
  readonly name?: string;
  readonly customFields?: Record<string, unknown>;
  readonly segmentIds?: readonly SegmentId[];
}

// Campaign results
export interface CampaignResult {
  readonly campaignId: CampaignId;
  readonly status: CampaignStatus;
  readonly scheduledAt?: Date;
  readonly sentAt?: Date;
  readonly recipientCount: number;
  readonly deliveredCount?: number;
  readonly openedCount?: number;
  readonly clickedCount?: number;
  readonly unsubscribedCount?: number;
  readonly bounceCount?: number;
  readonly errors?: readonly CampaignError[];
}

export type CampaignStatus = 
  | 'draft' 
  | 'scheduled' 
  | 'sending' 
  | 'sent' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export interface CampaignError {
  readonly code: string;
  readonly message: string;
  readonly recipientEmail?: string;
  readonly timestamp: Date;
}

// Drip campaign interfaces
export interface DripCampaignDefinition {
  readonly campaignId: CampaignId;
  readonly name: string;
  readonly description?: string;
  readonly triggerConditions: readonly TriggerCondition[];
  readonly steps: readonly DripStep[];
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TriggerCondition {
  readonly type: 'signup' | 'purchase' | 'behavior' | 'date' | 'custom';
  readonly criteria: Record<string, unknown>;
  readonly operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
}

export interface DripStep {
  readonly stepId: string;
  readonly order: number;
  readonly delayInDays: number;
  readonly emailTemplate: EmailContent;
  readonly conditions?: readonly TriggerCondition[];
}

export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly type: 'email' | 'drip';
  readonly status: CampaignStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metrics: CampaignMetrics;
}

export interface CampaignMetrics {
  readonly totalRecipients: number;
  readonly delivered: number;
  readonly opened: number;
  readonly clicked: number;
  readonly unsubscribed: number;
  readonly bounced: number;
  readonly openRate: number;
  readonly clickRate: number;
  readonly unsubscribeRate: number;
  readonly bounceRate: number;
}

// Audience segmentation interfaces
export interface SegmentationCriteria {
  readonly segmentId: SegmentId;
  readonly name: string;
  readonly conditions: readonly SegmentCondition[];
  readonly operator: 'and' | 'or';
}

export interface SegmentCondition {
  readonly field: string;
  readonly operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'exists' | 'not_exists';
  readonly value: unknown;
}

export interface AudienceSegment {
  readonly id: SegmentId;
  readonly name: string;
  readonly description?: string;
  readonly contactCount: number;
  readonly criteria: SegmentationCriteria;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isActive: boolean;
}

// Service interfaces
export interface IMarketingService {
  readonly provider: MarketingProvider;
  
  // Email campaigns
  sendEmail(params: EmailCampaignParams): Promise<CampaignResult>;
  getCampaignStatus(campaignId: CampaignId): Promise<CampaignResult>;
  getCampaignMetrics(campaignId: CampaignId): Promise<CampaignMetrics>;
  
  // Drip campaigns
  createDripCampaign(campaign: DripCampaignDefinition): Promise<Campaign>;
  updateDripCampaign(campaignId: CampaignId, updates: Partial<DripCampaignDefinition>): Promise<Campaign>;
  activateDripCampaign(campaignId: CampaignId): Promise<void>;
  deactivateDripCampaign(campaignId: CampaignId): Promise<void>;
  
  // Audience segmentation
  segmentAudience(criteria: SegmentationCriteria): Promise<AudienceSegment>;
  getSegment(segmentId: SegmentId): Promise<AudienceSegment>;
  updateSegment(segmentId: SegmentId, updates: Partial<SegmentationCriteria>): Promise<AudienceSegment>;
  deleteSegment(segmentId: SegmentId): Promise<void>;
  
  // Health and validation
  validateConnection(): Promise<boolean>;
  getHealthStatus(): Promise<HealthStatus>;
}

export interface HealthStatus {
  readonly isHealthy: boolean;
  readonly lastChecked: Date;
  readonly responseTime: number;
  readonly errors?: readonly string[];
  readonly rateLimitStatus: RateLimitStatus;
}

export interface RateLimitStatus {
  readonly remaining: number;
  readonly resetAt: Date;
  readonly isThrottled: boolean;
}

// Provider-specific interfaces
export interface SendGridConfig {
  readonly apiKey: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly webhookEndpoint?: string;
}

export interface MailchimpConfig {
  readonly apiKey: string;
  readonly serverPrefix: string;
  readonly defaultListId: string;
  readonly webhookSecret?: string;
} 