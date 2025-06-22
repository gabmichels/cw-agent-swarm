import { ulid } from 'ulid';
import { PrismaClient } from '@prisma/client';
import { ExternalWorkflowError } from '../errors/ExternalWorkflowErrors';

// ============================================================================
// Custom Error Classes
// ============================================================================

export class TwilioIntegrationError extends ExternalWorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'TWILIO_INTEGRATION_ERROR', context);
  }
}

export class TwilioAuthenticationError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'authentication' });
  }
}

export class TwilioRateLimitError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'rate_limit' });
  }
}

export class TwilioInsufficientFundsError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'insufficient_funds' });
  }
}

export class TwilioInvalidNumberError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'invalid_number' });
  }
}

export class TwilioNetworkError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'network' });
  }
}

export class TwilioWebhookError extends TwilioIntegrationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { ...context, errorType: 'webhook' });
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface TwilioConfig {
  readonly accountSid: string;
  readonly authToken: string;
  readonly fromPhoneNumber?: string;
  readonly webhookUrl?: string;
  readonly fromNumber?: string; // Default sending number
  readonly apiVersion?: string; // Default: '2010-04-01'
}

export interface TwilioSMSResult {
  readonly id: string; // ULID
  readonly messageSid: string;
  readonly to: string;
  readonly from: string;
  readonly body: string;
  readonly status: TwilioMessageStatus;
  readonly dateCreated: Date;
  readonly dateSent?: Date;
  readonly dateUpdated?: Date;
  readonly errorCode?: number;
  readonly errorMessage?: string;
  readonly price?: string;
  readonly priceUnit?: string;
  readonly uri: string;
}

export interface TwilioBulkResult {
  readonly id: string; // ULID
  readonly results: readonly TwilioSMSResult[];
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalCount: number;
  readonly errors: readonly string[];
}

export interface TwilioSMSMessage {
  readonly messageSid: string;
  readonly to: string;
  readonly from: string;
  readonly body: string;
  readonly status: TwilioMessageStatus;
  readonly direction: 'inbound' | 'outbound-api' | 'outbound-call' | 'outbound-reply';
  readonly dateCreated: Date;
  readonly dateSent?: Date;
  readonly dateUpdated?: Date;
  readonly errorCode?: number;
  readonly errorMessage?: string;
  readonly price?: string;
  readonly priceUnit?: string;
  readonly numSegments: number;
  readonly numMedia: number;
}

export interface TwilioSMSStatus {
  readonly messageSid: string;
  readonly status: TwilioMessageStatus;
  readonly dateUpdated: Date;
  readonly errorCode?: number;
  readonly errorMessage?: string;
}

export interface TwilioCallResult {
  readonly id: string; // ULID
  readonly callSid: string;
  readonly to: string;
  readonly from: string;
  readonly status: TwilioCallStatus;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number; // seconds
  readonly price?: string;
  readonly priceUnit?: string;
  readonly direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  readonly answeredBy?: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax';
  readonly forwardedFrom?: string;
  readonly callerName?: string;
  readonly uri: string;
}

export interface TwilioCall {
  readonly callSid: string;
  readonly to: string;
  readonly from: string;
  readonly status: TwilioCallStatus;
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly price?: string;
  readonly priceUnit?: string;
  readonly direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  readonly answeredBy?: string;
  readonly forwardedFrom?: string;
  readonly callerName?: string;
  readonly parentCallSid?: string;
  readonly phoneNumberSid?: string;
}

export interface TwilioRecording {
  readonly recordingSid: string;
  readonly callSid: string;
  readonly accountSid: string;
  readonly status: 'in-progress' | 'paused' | 'stopped' | 'processing' | 'completed' | 'absent' | 'deleted';
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly startTime?: Date;
  readonly duration?: number;
  readonly channels: number;
  readonly source: 'DialVerb' | 'Conference' | 'OutboundAPI' | 'Trunking' | 'RecordVerb' | 'StartCallRecording' | 'StartConferenceRecording';
  readonly price?: string;
  readonly priceUnit?: string;
  readonly uri: string;
  readonly encryptionDetails?: Record<string, unknown>;
}

export interface TwilioPhoneNumber {
  readonly phoneNumberSid: string;
  readonly accountSid: string;
  readonly friendlyName: string;
  readonly phoneNumber: string;
  readonly voiceUrl?: string;
  readonly voiceMethod?: string;
  readonly voiceFallbackUrl?: string;
  readonly voiceFallbackMethod?: string;
  readonly statusCallback?: string;
  readonly statusCallbackMethod?: string;
  readonly voiceCallerIdLookup?: boolean;
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly smsUrl?: string;
  readonly smsMethod?: string;
  readonly smsFallbackUrl?: string;
  readonly smsFallbackMethod?: string;
  readonly addressRequirements?: 'none' | 'any' | 'local' | 'foreign';
  readonly beta?: boolean;
  readonly capabilities: {
    readonly voice?: boolean;
    readonly SMS?: boolean;
    readonly MMS?: boolean;
    readonly fax?: boolean;
  };
  readonly origin: string;
  readonly trunkSid?: string;
  readonly emergencyStatus?: 'Active' | 'Inactive';
  readonly emergencyAddressSid?: string;
  readonly uri: string;
}

export interface TwilioVerification {
  readonly verificationSid: string;
  readonly serviceSid: string;
  readonly accountSid: string;
  readonly to: string;
  readonly channel: 'sms' | 'call' | 'email' | 'whatsapp';
  readonly status: 'pending' | 'approved' | 'canceled';
  readonly valid: boolean;
  readonly lookup: Record<string, unknown>;
  readonly amount?: string;
  readonly payee?: string;
  readonly sendCodeAttempts: Array<{
    readonly time: Date;
    readonly channel: string;
    readonly attempt_sid: string;
  }>;
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly sna?: Record<string, unknown>;
  readonly url: string;
}

export interface TwilioVerificationResult {
  readonly verificationSid: string;
  readonly serviceSid: string;
  readonly accountSid: string;
  readonly to: string;
  readonly channel: 'sms' | 'call' | 'email' | 'whatsapp';
  readonly status: 'pending' | 'approved' | 'canceled';
  readonly valid: boolean;
  readonly amount?: string;
  readonly payee?: string;
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
}

export interface TwilioWebhook {
  readonly webhookSid: string;
  readonly accountSid: string;
  readonly friendlyName: string;
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly filters: readonly TwilioWebhookEvent[];
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
  readonly uri: string;
}

export interface TwilioWebhookPayload {
  readonly MessageSid?: string;
  readonly CallSid?: string;
  readonly AccountSid: string;
  readonly From: string;
  readonly To: string;
  readonly Body?: string;
  readonly MessageStatus?: TwilioMessageStatus;
  readonly CallStatus?: TwilioCallStatus;
  readonly Direction?: string;
  readonly ApiVersion: string;
  readonly [key: string]: string | undefined;
}

export interface SetupWebhookResult {
  readonly webhookSid: string;
  readonly accountSid: string;
  readonly friendlyName: string;
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly filters: readonly string[];
  readonly dateCreated: Date;
  readonly dateUpdated: Date;
}

// ============================================================================
// Enums and Union Types
// ============================================================================

export type TwilioMessageStatus = 
  | 'accepted'
  | 'queued' 
  | 'sending'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'undelivered'
  | 'receiving'
  | 'received'
  | 'read';

export type TwilioCallStatus =
  | 'queued'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'busy'
  | 'failed'
  | 'no-answer'
  | 'canceled';

export type TwilioWebhookEvent =
  | 'message.status'
  | 'message.received'
  | 'call.status'
  | 'call.completed'
  | 'call.recording'
  | 'verification.status';

// ============================================================================
// Request/Options Interfaces
// ============================================================================

export interface SMSOptions {
  readonly from?: string; // Override default from number
  readonly statusCallback?: string; // Webhook URL for status updates
  readonly statusCallbackMethod?: 'GET' | 'POST';
  readonly provideFeedback?: boolean;
  readonly maxPrice?: string;
  readonly validityPeriod?: number; // seconds
  readonly forceDelivery?: boolean;
  readonly contentRetention?: 'retain' | 'discard';
  readonly addressRetention?: 'retain' | 'discard';
  readonly smartEncoded?: boolean;
  readonly persistentAction?: string[];
  readonly shortenUrls?: boolean;
  readonly scheduleType?: 'fixed';
  readonly sendAt?: Date;
  readonly sendAsMms?: boolean;
  readonly contentVariables?: string;
}

export interface BulkSMSRecipient {
  readonly to: string;
  readonly message: string;
  readonly options?: SMSOptions;
}

export interface CallOptions {
  readonly url?: string; // TwiML URL
  readonly method?: 'GET' | 'POST';
  readonly fallbackUrl?: string;
  readonly fallbackMethod?: 'GET' | 'POST';
  readonly statusCallback?: string;
  readonly statusCallbackMethod?: 'GET' | 'POST';
  readonly statusCallbackEvent?: readonly string[];
  readonly timeout?: number; // seconds
  readonly record?: boolean;
  readonly recordingChannels?: 'mono' | 'dual';
  readonly recordingStatusCallback?: string;
  readonly recordingStatusCallbackMethod?: 'GET' | 'POST';
  readonly recordingStatusCallbackEvent?: readonly string[];
  readonly sipAuthUsername?: string;
  readonly sipAuthPassword?: string;
  readonly machineDetection?: 'Enable' | 'DetectMessageEnd';
  readonly machineDetectionTimeout?: number;
  readonly machineDetectionSpeechThreshold?: number;
  readonly machineDetectionSpeechEndThreshold?: number;
  readonly machineDetectionSilenceTimeout?: number;
  readonly callerIdLookup?: boolean;
  readonly timeLimit?: number; // seconds
  readonly applicationSid?: string;
}

export interface SMSHistoryFilters {
  readonly to?: string;
  readonly from?: string;
  readonly dateSentAfter?: Date;
  readonly dateSentBefore?: Date;
  readonly pageSize?: number;
  readonly page?: number;
}

export interface CallHistoryFilters {
  readonly to?: string;
  readonly from?: string;
  readonly status?: TwilioCallStatus;
  readonly startTimeAfter?: Date;
  readonly startTimeBefore?: Date;
  readonly endTimeAfter?: Date;
  readonly endTimeBefore?: Date;
  readonly pageSize?: number;
  readonly page?: number;
}

// ============================================================================
// Main Integration Class
// ============================================================================

/**
 * Configuration service for Twilio integration
 */
class TwilioConfigService {
  private prisma = new PrismaClient();

  /**
   * Get Twilio configuration from database or environment
   */
  async getTwilioConfig(userId?: string, organizationId?: string): Promise<TwilioConfig> {
    try {
      // First try to get from database
      const connection = await this.prisma.integrationConnection.findFirst({
        where: {
          provider: {
            name: 'TWILIO'
          },
          OR: [
            userId ? { userId } : {},
            organizationId ? { organizationId } : {},
          ],
          status: 'ACTIVE',
          isEnabled: true,
        },
        include: {
          provider: true,
        },
      });

      if (connection && connection.apiKey) {
        // Decrypt the API key (in production, use proper decryption)
        const decryptedApiKey = Buffer.from(connection.apiKey, 'base64').toString();
        
        // Parse the API key (format: "accountSid:authToken")
        const [accountSid, authToken] = decryptedApiKey.split(':');
        
        if (!accountSid || !authToken) {
          throw new TwilioAuthenticationError('Invalid Twilio API key format. Expected "accountSid:authToken"');
        }

        return {
          accountSid,
          authToken,
          fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER,
          webhookUrl: process.env.TWILIO_WEBHOOK_URL,
        };
      }

      // Fallback to environment variables
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new TwilioAuthenticationError(
          'Twilio credentials not found. Please configure in API Keys settings or set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.'
        );
      }

      return {
        accountSid,
        authToken,
        fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER,
        webhookUrl: process.env.TWILIO_WEBHOOK_URL,
      };
    } catch (error) {
      if (error instanceof TwilioAuthenticationError) {
        throw error;
      }
      throw new TwilioIntegrationError(`Failed to get Twilio configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Twilio Integration Service
 * Provides SMS, voice, and 2FA capabilities using Twilio API
 */
export class TwilioIntegration {
  private configService = new TwilioConfigService();
  private config: TwilioConfig | null = null;
  private baseUrl: string = '';

  constructor(
    private userId?: string,
    private organizationId?: string
  ) {}

  /**
   * Initialize the Twilio configuration
   */
  private async ensureConfig(): Promise<TwilioConfig> {
    if (!this.config) {
      this.config = await this.configService.getTwilioConfig(this.userId, this.organizationId);
      this.validateConfig();
      const apiVersion = this.config.apiVersion || '2010-04-01';
      this.baseUrl = `https://api.twilio.com/${apiVersion}/Accounts/${this.config.accountSid}`;
    }
    return this.config;
  }

  // ============================================================================
  // SMS Operations
  // ============================================================================

  /**
   * Send a single SMS message
   */
  async sendSMS(to: string, message: string, options: SMSOptions = {}): Promise<TwilioSMSResult> {
    this.validatePhoneNumber(to);
    this.validateMessage(message);

    try {
      const config = await this.ensureConfig();
      const from = options.from || config.fromNumber;
      if (!from) {
        throw new TwilioInvalidNumberError('No from number specified in options or config');
      }

      const response = await this.makeRequest('/Messages.json', 'POST', {
        To: to,
        From: from,
        Body: message,
        ...this.formatSMSOptions(options)
      });

      return this.formatSMSResult(response);
    } catch (error) {
      throw this.handleError(error, 'Failed to send SMS', { to, messageLength: message.length });
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(recipients: readonly BulkSMSRecipient[]): Promise<TwilioBulkResult> {
    if (recipients.length === 0) {
      throw new TwilioIntegrationError('No recipients provided for bulk SMS');
    }

    if (recipients.length > 100) {
      throw new TwilioIntegrationError('Bulk SMS limited to 100 recipients per batch');
    }

    const results: TwilioSMSResult[] = [];
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process in batches of 10 for rate limiting
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const batchPromises = batch.map(async (recipient) => {
        try {
          const result = await this.sendSMS(recipient.to, recipient.message, recipient.options);
          results.push(result);
          successCount++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`${recipient.to}: ${errorMessage}`);
          failureCount++;
        }
      });

      await Promise.all(batchPromises);

      // Rate limiting: wait 1 second between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      id: ulid(),
      results,
      successCount,
      failureCount,
      totalCount: recipients.length,
      errors
    };
  }

  /**
   * Get SMS message history
   */
  async getSMSHistory(filters: SMSHistoryFilters = {}): Promise<readonly TwilioSMSMessage[]> {
    try {
      const queryParams = this.formatHistoryFilters(filters);
      const response = await this.makeRequest(`/Messages.json${queryParams}`, 'GET');

      if (!response.messages || !Array.isArray(response.messages)) {
        return [];
      }

      return response.messages.map((msg: any) => this.formatSMSMessage(msg));
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve SMS history', { filters });
    }
  }

  /**
   * Get SMS message status
   */
  async getSMSStatus(messageSid: string): Promise<TwilioSMSStatus> {
    this.validateSid(messageSid, 'Message SID');

    try {
      const response = await this.makeRequest(`/Messages/${messageSid}.json`, 'GET');
      return {
        messageSid: response.sid,
        status: response.status,
        dateUpdated: new Date(response.date_updated),
        errorCode: response.error_code,
        errorMessage: response.error_message
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to get SMS status', { messageSid });
    }
  }

  // ============================================================================
  // Voice Operations
  // ============================================================================

  /**
   * Make an outbound call
   */
  async makeCall(to: string, from: string, options: CallOptions): Promise<TwilioCallResult> {
    this.validatePhoneNumber(to);
    this.validatePhoneNumber(from);

    if (!options.url && !options.applicationSid) {
      throw new TwilioIntegrationError('Either url or applicationSid must be provided for call');
    }

    try {
      const response = await this.makeRequest('/Calls.json', 'POST', {
        To: to,
        From: from,
        ...this.formatCallOptions(options)
      });

      return this.formatCallResult(response);
    } catch (error) {
      throw this.handleError(error, 'Failed to make call', { to, from });
    }
  }

  /**
   * Get call history
   */
  async getCallHistory(filters: CallHistoryFilters = {}): Promise<readonly TwilioCall[]> {
    try {
      const queryParams = this.formatCallHistoryFilters(filters);
      const response = await this.makeRequest(`/Calls.json${queryParams}`, 'GET');

      if (!response.calls || !Array.isArray(response.calls)) {
        return [];
      }

      return response.calls.map((call: any) => this.formatCall(call));
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve call history', { filters });
    }
  }

  /**
   * Get call recording
   */
  async getCallRecording(callSid: string): Promise<TwilioRecording | null> {
    this.validateSid(callSid, 'Call SID');

    try {
      const response = await this.makeRequest(`/Calls/${callSid}/Recordings.json`, 'GET');

      if (!response.recordings || response.recordings.length === 0) {
        return null;
      }

      // Return the most recent recording
      const recording = response.recordings[0];
      return this.formatRecording(recording);
    } catch (error) {
      throw this.handleError(error, 'Failed to get call recording', { callSid });
    }
  }

  // ============================================================================
  // Phone Number Operations
  // ============================================================================

  /**
   * Get owned phone numbers
   */
  async getPhoneNumbers(): Promise<readonly TwilioPhoneNumber[]> {
    try {
      const response = await this.makeRequest('/IncomingPhoneNumbers.json', 'GET');

      if (!response.incoming_phone_numbers || !Array.isArray(response.incoming_phone_numbers)) {
        return [];
      }

      return response.incoming_phone_numbers.map((number: any) => this.formatPhoneNumber(number));
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve phone numbers');
    }
  }

  /**
   * Purchase a phone number
   */
  async purchasePhoneNumber(phoneNumber: string): Promise<TwilioPhoneNumber> {
    this.validatePhoneNumber(phoneNumber);

    try {
      const response = await this.makeRequest('/IncomingPhoneNumbers.json', 'POST', {
        PhoneNumber: phoneNumber
      });

      return this.formatPhoneNumber(response);
    } catch (error) {
      throw this.handleError(error, 'Failed to purchase phone number', { phoneNumber });
    }
  }

  /**
   * Release a phone number
   */
  async releasePhoneNumber(phoneNumberSid: string): Promise<boolean> {
    this.validateSid(phoneNumberSid, 'Phone Number SID');

    try {
      await this.makeRequest(`/IncomingPhoneNumbers/${phoneNumberSid}.json`, 'DELETE');
      return true;
    } catch (error) {
      throw this.handleError(error, 'Failed to release phone number', { phoneNumberSid });
    }
  }

  // ============================================================================
  // Verification (2FA) Operations
  // ============================================================================

  /**
   * Send verification code
   */
  async sendVerificationCode(to: string, channel: 'sms' | 'call' = 'sms'): Promise<TwilioVerification> {
    this.validatePhoneNumber(to);

    try {
      // Use Verify API v2
      const verifyUrl = `https://verify.twilio.com/v2/Services/${this.getVerifyServiceSid()}/Verifications`;
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config?.accountSid}:${this.config?.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          Channel: channel
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TwilioIntegrationError(`Verification request failed: ${response.statusText}`, { 
          status: response.status, 
          errorData 
        });
      }

      const data = await response.json();
      return this.formatVerification(data);
    } catch (error) {
      throw this.handleError(error, 'Failed to send verification code', { to, channel });
    }
  }

  /**
   * Verify code
   */
  async verifyCode(to: string, code: string): Promise<TwilioVerificationResult> {
    this.validatePhoneNumber(to);
    
    if (!code || code.trim().length === 0) {
      throw new TwilioIntegrationError('Verification code is required');
    }

    try {
      // Use Verify API v2
      const verifyUrl = `https://verify.twilio.com/v2/Services/${this.getVerifyServiceSid()}/VerificationCheck`;
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.config?.accountSid}:${this.config?.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          Code: code.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new TwilioIntegrationError(`Verification check failed: ${response.statusText}`, { 
          status: response.status, 
          errorData 
        });
      }

      const data = await response.json();
      return this.formatVerificationResult(data);
    } catch (error) {
      throw this.handleError(error, 'Failed to verify code', { to });
    }
  }

  // ============================================================================
  // Webhook Operations
  // ============================================================================

  /**
   * Setup webhook for receiving Twilio events
   */
  async setupWebhook(url: string, events: string[] = ['sms-received', 'call-completed']): Promise<SetupWebhookResult> {
    try {
      const config = await this.ensureConfig();
      const webhookId = ulid();
      
      // In a real implementation, this would register the webhook with Twilio
      // For now, return a mock response
      return {
        webhookSid: `WH${webhookId}`,
        accountSid: config.accountSid,
        friendlyName: `Webhook-${webhookId}`,
        url,
        method: 'POST',
        filters: events,
        dateCreated: new Date(),
        dateUpdated: new Date(),
      };
    } catch (error) {
      if (error instanceof TwilioIntegrationError) {
        throw error;
      }
      throw new TwilioIntegrationError(`Failed to setup webhook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(event: TwilioWebhookPayload): Promise<void> {
    try {
      // Validate webhook signature (in real implementation)
      // this.validateWebhookSignature(event);

      // Process different event types
      if (event.MessageSid && event.MessageStatus) {
        // Handle message status update
        console.log(`Message ${event.MessageSid} status: ${event.MessageStatus}`);
      } else if (event.CallSid && event.CallStatus) {
        // Handle call status update
        console.log(`Call ${event.CallSid} status: ${event.CallStatus}`);
      }

      // In real implementation, you would:
      // 1. Validate the webhook signature
      // 2. Parse the event payload
      // 3. Update local records
      // 4. Trigger appropriate business logic
      // 5. Return appropriate response

    } catch (error) {
      throw new TwilioWebhookError('Failed to handle webhook event', { event });
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateConfig(): void {
    if (!this.config?.accountSid) {
      throw new TwilioAuthenticationError('Account SID is required');
    }
    if (!this.config?.authToken) {
      throw new TwilioAuthenticationError('Auth token is required');
    }
    if (!this.config?.accountSid.startsWith('AC')) {
      throw new TwilioAuthenticationError('Invalid Account SID format');
    }
  }

  private validatePhoneNumber(phoneNumber: string): void {
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      throw new TwilioInvalidNumberError('Phone number is required');
    }
    
    // Basic E.164 format validation - more permissive for international numbers
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    if (!/^\+\d{1,15}$/.test(cleanNumber)) {
      throw new TwilioInvalidNumberError(`Invalid phone number format: ${phoneNumber}. Must be in E.164 format (e.g., +1234567890)`);
    }
  }

  private validateMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new TwilioIntegrationError('Message body is required');
    }
    if (message.length > 1600) {
      throw new TwilioIntegrationError('Message body exceeds 1600 character limit');
    }
  }

  private validateSid(sid: string, type: string): void {
    if (!sid || sid.trim().length === 0) {
      throw new TwilioIntegrationError(`${type} is required`);
    }
    if (sid.length !== 34) {
      throw new TwilioIntegrationError(`Invalid ${type} format`);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Make authenticated request to Twilio API
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE', data?: Record<string, any>): Promise<any> {
    const config = await this.ensureConfig();
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': method === 'GET' ? 'application/json' : 'application/x-www-form-urlencoded',
        },
      };

      if (data && method !== 'GET') {
        if (method === 'POST') {
          const formData = new URLSearchParams();
          Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              formData.append(key, value.toString());
            }
          });
          options.body = formData.toString();
        } else {
          options.body = JSON.stringify(data);
        }
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        await this.handleTwilioError(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TwilioIntegrationError) {
        throw error;
      }
      throw new TwilioNetworkError(`Network request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Handle Twilio API error responses
   */
  private async handleTwilioError(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type');
    let errorData: any = {};
    
    try {
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { message: await response.text() };
      }
    } catch {
      errorData = { message: 'Unknown error' };
    }

    const errorMessage = errorData.message || errorData.detail || `HTTP ${response.status}`;
    const errorCode = errorData.code || response.status;

    switch (response.status) {
      case 401:
        throw new TwilioAuthenticationError(`Authentication failed: ${errorMessage}`);
      case 403:
        throw new TwilioInsufficientFundsError(`Insufficient funds or permissions: ${errorMessage}`);
      case 429:
        throw new TwilioRateLimitError(`Rate limit exceeded: ${errorMessage}`);
      case 400:
        if (errorCode === 21211 || errorCode === 21614) {
          throw new TwilioInvalidNumberError(`Invalid phone number: ${errorMessage}`);
        }
        throw new TwilioIntegrationError(`Bad request: ${errorMessage}`);
      case 404:
        throw new TwilioIntegrationError(`Resource not found: ${errorMessage}`);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new TwilioNetworkError(`Twilio service error: ${errorMessage}`);
      default:
        throw new TwilioIntegrationError(`Twilio API error: ${errorMessage}`);
    }
  }

  private formatSMSOptions(options: SMSOptions): Record<string, any> {
    const formatted: Record<string, any> = {};
    
    if (options.statusCallback) formatted.StatusCallback = options.statusCallback;
    if (options.statusCallbackMethod) formatted.StatusCallbackMethod = options.statusCallbackMethod;
    if (options.provideFeedback !== undefined) formatted.ProvideFeedback = options.provideFeedback;
    if (options.maxPrice) formatted.MaxPrice = options.maxPrice;
    if (options.validityPeriod) formatted.ValidityPeriod = options.validityPeriod;
    if (options.forceDelivery !== undefined) formatted.ForceDelivery = options.forceDelivery;
    if (options.smartEncoded !== undefined) formatted.SmartEncoded = options.smartEncoded;
    if (options.sendAt) formatted.SendAt = options.sendAt.toISOString();
    
    return formatted;
  }

  private formatCallOptions(options: CallOptions): Record<string, any> {
    const formatted: Record<string, any> = {};
    
    if (options.url) formatted.Url = options.url;
    if (options.method) formatted.Method = options.method;
    if (options.fallbackUrl) formatted.FallbackUrl = options.fallbackUrl;
    if (options.fallbackMethod) formatted.FallbackMethod = options.fallbackMethod;
    if (options.statusCallback) formatted.StatusCallback = options.statusCallback;
    if (options.statusCallbackMethod) formatted.StatusCallbackMethod = options.statusCallbackMethod;
    if (options.statusCallbackEvent) formatted.StatusCallbackEvent = options.statusCallbackEvent;
    if (options.timeout) formatted.Timeout = options.timeout;
    if (options.record !== undefined) formatted.Record = options.record;
    if (options.recordingChannels) formatted.RecordingChannels = options.recordingChannels;
    if (options.machineDetection) formatted.MachineDetection = options.machineDetection;
    if (options.machineDetectionTimeout) formatted.MachineDetectionTimeout = options.machineDetectionTimeout;
    if (options.timeLimit) formatted.TimeLimit = options.timeLimit;
    if (options.applicationSid) formatted.ApplicationSid = options.applicationSid;
    
    return formatted;
  }

  private formatHistoryFilters(filters: SMSHistoryFilters): string {
    const params = new URLSearchParams();
    
    if (filters.to) params.append('To', filters.to);
    if (filters.from) params.append('From', filters.from);
    if (filters.dateSentAfter) params.append('DateSent>', filters.dateSentAfter.toISOString().split('T')[0]);
    if (filters.dateSentBefore) params.append('DateSent<', filters.dateSentBefore.toISOString().split('T')[0]);
    if (filters.pageSize) params.append('PageSize', filters.pageSize.toString());
    if (filters.page) params.append('Page', filters.page.toString());
    
    return params.toString() ? `?${params.toString()}` : '';
  }

  private formatCallHistoryFilters(filters: CallHistoryFilters): string {
    const params = new URLSearchParams();
    
    if (filters.to) params.append('To', filters.to);
    if (filters.from) params.append('From', filters.from);
    if (filters.status) params.append('Status', filters.status);
    if (filters.startTimeAfter) params.append('StartTime>', filters.startTimeAfter.toISOString().split('T')[0]);
    if (filters.startTimeBefore) params.append('StartTime<', filters.startTimeBefore.toISOString().split('T')[0]);
    if (filters.endTimeAfter) params.append('EndTime>', filters.endTimeAfter.toISOString().split('T')[0]);
    if (filters.endTimeBefore) params.append('EndTime<', filters.endTimeBefore.toISOString().split('T')[0]);
    if (filters.pageSize) params.append('PageSize', filters.pageSize.toString());
    if (filters.page) params.append('Page', filters.page.toString());
    
    return params.toString() ? `?${params.toString()}` : '';
  }

  private formatSMSResult(response: any): TwilioSMSResult {
    return {
      id: ulid(),
      messageSid: response.sid,
      to: response.to,
      from: response.from,
      body: response.body,
      status: response.status,
      dateCreated: new Date(response.date_created),
      dateSent: response.date_sent ? new Date(response.date_sent) : undefined,
      dateUpdated: new Date(response.date_updated),
      errorCode: response.error_code,
      errorMessage: response.error_message,
      price: response.price,
      priceUnit: response.price_unit,
      uri: response.uri
    };
  }

  private formatSMSMessage(response: any): TwilioSMSMessage {
    return {
      messageSid: response.sid,
      to: response.to,
      from: response.from,
      body: response.body,
      status: response.status,
      direction: response.direction,
      dateCreated: new Date(response.date_created),
      dateSent: response.date_sent ? new Date(response.date_sent) : undefined,
      dateUpdated: new Date(response.date_updated),
      errorCode: response.error_code,
      errorMessage: response.error_message,
      price: response.price,
      priceUnit: response.price_unit,
      numSegments: parseInt(response.num_segments) || 1,
      numMedia: parseInt(response.num_media) || 0
    };
  }

  private formatCallResult(response: any): TwilioCallResult {
    return {
      id: ulid(),
      callSid: response.sid,
      to: response.to,
      from: response.from,
      status: response.status,
      startTime: response.start_time ? new Date(response.start_time) : undefined,
      endTime: response.end_time ? new Date(response.end_time) : undefined,
      duration: response.duration ? parseInt(response.duration) : undefined,
      price: response.price,
      priceUnit: response.price_unit,
      direction: response.direction,
      answeredBy: response.answered_by,
      forwardedFrom: response.forwarded_from,
      callerName: response.caller_name,
      uri: response.uri
    };
  }

  private formatCall(response: any): TwilioCall {
    return {
      callSid: response.sid,
      to: response.to,
      from: response.from,
      status: response.status,
      startTime: response.start_time ? new Date(response.start_time) : undefined,
      endTime: response.end_time ? new Date(response.end_time) : undefined,
      duration: response.duration ? parseInt(response.duration) : undefined,
      price: response.price,
      priceUnit: response.price_unit,
      direction: response.direction,
      answeredBy: response.answered_by,
      forwardedFrom: response.forwarded_from,
      callerName: response.caller_name,
      parentCallSid: response.parent_call_sid,
      phoneNumberSid: response.phone_number_sid
    };
  }

  private formatRecording(response: any): TwilioRecording {
    return {
      recordingSid: response.sid,
      callSid: response.call_sid,
      accountSid: response.account_sid,
      status: response.status,
      dateCreated: new Date(response.date_created),
      dateUpdated: new Date(response.date_updated),
      startTime: response.start_time ? new Date(response.start_time) : undefined,
      duration: response.duration ? parseInt(response.duration) : undefined,
      channels: parseInt(response.channels) || 1,
      source: response.source,
      price: response.price,
      priceUnit: response.price_unit,
      uri: response.uri,
      encryptionDetails: response.encryption_details
    };
  }

  private formatPhoneNumber(response: any): TwilioPhoneNumber {
    return {
      phoneNumberSid: response.sid,
      accountSid: response.account_sid,
      friendlyName: response.friendly_name,
      phoneNumber: response.phone_number,
      voiceUrl: response.voice_url,
      voiceMethod: response.voice_method,
      voiceFallbackUrl: response.voice_fallback_url,
      voiceFallbackMethod: response.voice_fallback_method,
      statusCallback: response.status_callback,
      statusCallbackMethod: response.status_callback_method,
      voiceCallerIdLookup: response.voice_caller_id_lookup,
      dateCreated: new Date(response.date_created),
      dateUpdated: new Date(response.date_updated),
      smsUrl: response.sms_url,
      smsMethod: response.sms_method,
      smsFallbackUrl: response.sms_fallback_url,
      smsFallbackMethod: response.sms_fallback_method,
      addressRequirements: response.address_requirements,
      beta: response.beta,
      capabilities: {
        voice: response.capabilities?.voice,
        SMS: response.capabilities?.SMS,
        MMS: response.capabilities?.MMS,
        fax: response.capabilities?.fax
      },
      origin: response.origin,
      trunkSid: response.trunk_sid,
      emergencyStatus: response.emergency_status,
      emergencyAddressSid: response.emergency_address_sid,
      uri: response.uri
    };
  }

  private formatVerification(response: any): TwilioVerification {
    return {
      verificationSid: response.sid,
      serviceSid: response.service_sid,
      accountSid: response.account_sid,
      to: response.to,
      channel: response.channel,
      status: response.status,
      valid: response.valid,
      lookup: response.lookup || {},
      amount: response.amount,
      payee: response.payee,
      sendCodeAttempts: response.send_code_attempts || [],
      dateCreated: new Date(response.date_created),
      dateUpdated: new Date(response.date_updated),
      sna: response.sna,
      url: response.url
    };
  }

  private formatVerificationResult(response: any): TwilioVerificationResult {
    return {
      verificationSid: response.sid,
      serviceSid: response.service_sid,
      accountSid: response.account_sid,
      to: response.to,
      channel: response.channel,
      status: response.status,
      valid: response.valid,
      amount: response.amount,
      payee: response.payee,
      dateCreated: new Date(response.date_created),
      dateUpdated: new Date(response.date_updated)
    };
  }

  private getVerifyServiceSid(): string {
    // In real implementation, this would be configured
    // For now, assume it's set in environment or config
    return process.env.TWILIO_VERIFY_SERVICE_SID || 'VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  }

  /**
   * Handle generic errors and convert them to TwilioIntegrationError
   */
  private handleError(error: unknown, message: string, context?: Record<string, unknown>): TwilioIntegrationError {
    if (error instanceof TwilioIntegrationError) {
      return error;
    }
    return new TwilioIntegrationError(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`, context);
  }
} 