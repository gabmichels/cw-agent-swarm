import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { ulid } from 'ulid';
import {
  TwilioIntegration,
  TwilioConfig,
  TwilioSMSResult,
  TwilioBulkResult,
  TwilioSMSMessage,
  TwilioSMSStatus,
  TwilioCallResult,
  TwilioCall,
  TwilioRecording,
  TwilioPhoneNumber,
  TwilioVerification,
  TwilioVerificationResult,
  TwilioWebhook,
  TwilioWebhookPayload,
  SMSOptions,
  BulkSMSRecipient,
  CallOptions,
  SMSHistoryFilters,
  CallHistoryFilters,
  TwilioIntegrationError,
  TwilioAuthenticationError,
  TwilioRateLimitError,
  TwilioInsufficientFundsError,
  TwilioInvalidNumberError,
  TwilioNetworkError,
  TwilioWebhookError,
} from '../TwilioIntegration';

// Mock fetch globally
const mockFetch = vi.fn() as Mock;
global.fetch = mockFetch;

// Helper function to create proper Response mock
function createMockResponse(data: any, options: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
} = {}) {
  const headers = new Map(Object.entries(options.headers || {}));
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: vi.fn().mockResolvedValue(data),
  };
}

// Helper to generate proper Twilio SIDs
function generateTwilioSid(prefix: string): string {
  // Twilio SIDs are 34 characters: 2-char prefix + 32 character base
  const baseId = ulid().padEnd(32, '0').substring(0, 32);
  return `${prefix}${baseId}`;
}

describe('TwilioIntegration', () => {
  let twilioIntegration: TwilioIntegration;
  let mockConfig: TwilioConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      accountSid: 'ACtest1234567890abcdef1234567890abcd',
      authToken: 'test_auth_token_12345',
      fromNumber: '+1234567890',
      apiVersion: '2010-04-01'
    };

    twilioIntegration = new TwilioIntegration(mockConfig);
  });

  describe('Configuration and Validation', () => {
    it('should create TwilioIntegration with valid config', () => {
      expect(twilioIntegration).toBeInstanceOf(TwilioIntegration);
    });

    it('should throw error for missing account SID', () => {
      expect(() => new TwilioIntegration({
        ...mockConfig,
        accountSid: ''
      })).toThrow(TwilioAuthenticationError);
    });

    it('should throw error for missing auth token', () => {
      expect(() => new TwilioIntegration({
        ...mockConfig,
        authToken: ''
      })).toThrow(TwilioAuthenticationError);
    });

    it('should throw error for invalid account SID format', () => {
      expect(() => new TwilioIntegration({
        ...mockConfig,
        accountSid: 'invalid_sid'
      })).toThrow(TwilioAuthenticationError);
    });

    it('should validate phone numbers correctly', async () => {
      const mockSMSResponse = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockSMSResponse));

      // Valid phone number should work
      await expect(twilioIntegration.sendSMS('+1234567890', 'Test message'))
        .resolves.toBeDefined();

      // Invalid phone number should throw
      await expect(twilioIntegration.sendSMS('invalid', 'Test message'))
        .rejects.toThrow(TwilioInvalidNumberError);

      // Empty phone number should throw
      await expect(twilioIntegration.sendSMS('', 'Test message'))
        .rejects.toThrow(TwilioInvalidNumberError);
    });

    it('should validate message content', async () => {
      // Empty message should throw
      await expect(twilioIntegration.sendSMS('+1234567890', ''))
        .rejects.toThrow(TwilioIntegrationError);

      // Message too long should throw
      const longMessage = 'a'.repeat(1601);
      await expect(twilioIntegration.sendSMS('+1234567890', longMessage))
        .rejects.toThrow(TwilioIntegrationError);
    });
  });

  describe('SMS Operations', () => {
    it('should send SMS successfully', async () => {
      const mockResponse = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_sent: '2024-01-15T10:00:01Z',
        date_updated: '2024-01-15T10:00:01Z',
        price: '-0.0075',
        price_unit: 'USD',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.sendSMS('+1234567890', 'Test message');

      expect(result).toMatchObject({
        messageSid: mockResponse.sid,
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        status: 'sent',
        price: '-0.0075',
        priceUnit: 'USD'
      });
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
      expect(result.dateCreated).toBeInstanceOf(Date);
      expect(result.dateSent).toBeInstanceOf(Date);
      expect(result.dateUpdated).toBeInstanceOf(Date);
    });

    it('should send SMS with options', async () => {
      const mockResponse = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+1111111111',
        body: 'Test message with options',
        status: 'queued',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const options: SMSOptions = {
        from: '+1111111111',
        statusCallback: 'https://example.com/webhook',
        maxPrice: '0.01',
        validityPeriod: 3600
      };

      const result = await twilioIntegration.sendSMS('+1234567890', 'Test message with options', options);

      expect(result.from).toBe('+1111111111');
      expect(result.status).toBe('queued');
      
      // Verify the request was made with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/Messages.json'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Basic'),
            'Content-Type': 'application/x-www-form-urlencoded'
          }),
          body: expect.stringContaining('StatusCallback=https%3A%2F%2Fexample.com%2Fwebhook')
        })
      );
    });

    it('should send bulk SMS successfully', async () => {
      const mockResponse1 = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+0987654321',
        body: 'Message 1',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest1.json'
      };

      const mockResponse2 = {
        sid: generateTwilioSid('SM'),
        to: '+1234567891',
        from: '+0987654321',
        body: 'Message 2',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest2.json'
      };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockResponse1))
        .mockResolvedValueOnce(createMockResponse(mockResponse2));

      const recipients: BulkSMSRecipient[] = [
        { to: '+1234567890', message: 'Message 1' },
        { to: '+1234567891', message: 'Message 2' }
      ];

      const result = await twilioIntegration.sendBulkSMS(recipients);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    });

    it('should handle bulk SMS with partial failures', async () => {
      const mockResponse1 = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+0987654321',
        body: 'Message 1',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest1.json'
      };

      mockFetch
        .mockResolvedValueOnce(createMockResponse(mockResponse1))
        .mockRejectedValueOnce(new Error('Invalid phone number'));

      const recipients: BulkSMSRecipient[] = [
        { to: '+1234567890', message: 'Message 1' },
        { to: 'invalid', message: 'Message 2' }
      ];

      const result = await twilioIntegration.sendBulkSMS(recipients);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('invalid');
    });

    it('should get SMS history', async () => {
      const mockResponse = {
        messages: [
          {
            sid: generateTwilioSid('SM'),
            to: '+1234567890',
            from: '+0987654321',
            body: 'Test message 1',
            status: 'delivered',
            direction: 'outbound-api',
            date_created: '2024-01-15T10:00:00Z',
            date_sent: '2024-01-15T10:00:01Z',
            date_updated: '2024-01-15T10:00:02Z',
            num_segments: '1',
            num_media: '0'
          },
          {
            sid: generateTwilioSid('SM'),
            to: '+1234567891',
            from: '+0987654321',
            body: 'Test message 2',
            status: 'sent',
            direction: 'outbound-api',
            date_created: '2024-01-15T10:01:00Z',
            date_sent: '2024-01-15T10:01:01Z',
            date_updated: '2024-01-15T10:01:01Z',
            num_segments: '1',
            num_media: '0'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const filters: SMSHistoryFilters = {
        to: '+1234567890',
        pageSize: 10
      };

      const result = await twilioIntegration.getSMSHistory(filters);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('delivered');
      expect(result[0].direction).toBe('outbound-api');
      expect(result[0].numSegments).toBe(1);
      expect(result[0].numMedia).toBe(0);
    });

    it('should get SMS status', async () => {
      const messageSid = generateTwilioSid('SM');
      const mockResponse = {
        sid: messageSid,
        status: 'delivered',
        date_updated: '2024-01-15T10:00:02Z'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.getSMSStatus(messageSid);

      expect(result.messageSid).toBe(messageSid);
      expect(result.status).toBe('delivered');
      expect(result.dateUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Voice Operations', () => {
    it('should make call successfully', async () => {
      const mockResponse = {
        sid: generateTwilioSid('CA'),
        to: '+1234567890',
        from: '+0987654321',
        status: 'queued',
        start_time: null,
        end_time: null,
        duration: null,
        direction: 'outbound-api',
        uri: '/2010-04-01/Accounts/ACtest/Calls/CAtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const options: CallOptions = {
        url: 'https://example.com/twiml',
        timeout: 30,
        record: true
      };

      const result = await twilioIntegration.makeCall('+1234567890', '+0987654321', options);

      expect(result.callSid).toBe(mockResponse.sid);
      expect(result.to).toBe('+1234567890');
      expect(result.from).toBe('+0987654321');
      expect(result.status).toBe('queued');
      expect(result.direction).toBe('outbound-api');
      expect(result.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID format
    });

    it('should require URL or application SID for calls', async () => {
      const options: CallOptions = {}; // No URL or applicationSid

      await expect(twilioIntegration.makeCall('+1234567890', '+0987654321', options))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should get call history', async () => {
      const mockResponse = {
        calls: [
          {
            sid: generateTwilioSid('CA'),
            to: '+1234567890',
            from: '+0987654321',
            status: 'completed',
            start_time: '2024-01-15T10:00:00Z',
            end_time: '2024-01-15T10:02:00Z',
            duration: '120',
            direction: 'outbound-api',
            answered_by: 'human'
          },
          {
            sid: generateTwilioSid('CA'),
            to: '+1234567891',
            from: '+0987654321',
            status: 'no-answer',
            start_time: '2024-01-15T10:05:00Z',
            end_time: null,
            duration: null,
            direction: 'outbound-api'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const filters: CallHistoryFilters = {
        status: 'completed',
        pageSize: 10
      };

      const result = await twilioIntegration.getCallHistory(filters);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('completed');
      expect(result[0].duration).toBe(120);
      expect(result[0].answeredBy).toBe('human');
      expect(result[1].status).toBe('no-answer');
      expect(result[1].duration).toBeUndefined();
    });

    it('should get call recording', async () => {
      const callSid = generateTwilioSid('CA');
      const mockResponse = {
        recordings: [
          {
            sid: generateTwilioSid('RE'),
            call_sid: callSid,
            account_sid: 'ACtest1234567890abcdef1234567890abcd',
            status: 'completed',
            date_created: '2024-01-15T10:00:00Z',
            date_updated: '2024-01-15T10:02:00Z',
            start_time: '2024-01-15T10:00:05Z',
            duration: '115',
            channels: 1,
            source: 'RecordVerb',
            uri: '/2010-04-01/Accounts/ACtest/Recordings/REtest.json'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.getCallRecording(callSid);

      expect(result).toBeDefined();
      expect(result!.callSid).toBe(callSid);
      expect(result!.status).toBe('completed');
      expect(result!.duration).toBe(115);
      expect(result!.channels).toBe(1);
      expect(result!.source).toBe('RecordVerb');
    });

    it('should return null for call with no recording', async () => {
      const callSid = generateTwilioSid('CA');
      const mockResponse = {
        recordings: []
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.getCallRecording(callSid);

      expect(result).toBeNull();
    });
  });

  describe('Phone Number Operations', () => {
    it('should get phone numbers', async () => {
      const mockResponse = {
        incoming_phone_numbers: [
          {
            sid: generateTwilioSid('PN'),
            account_sid: 'ACtest1234567890abcdef1234567890abcd',
            friendly_name: 'Test Number 1',
            phone_number: '+1234567890',
            voice_url: 'https://example.com/voice',
            voice_method: 'POST',
            date_created: '2024-01-15T10:00:00Z',
            date_updated: '2024-01-15T10:00:00Z',
            capabilities: {
              voice: true,
              SMS: true,
              MMS: false,
              fax: false
            },
            origin: 'twilio',
            uri: '/2010-04-01/Accounts/ACtest/IncomingPhoneNumbers/PNtest1.json'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.getPhoneNumbers();

      expect(result).toHaveLength(1);
      expect(result[0].phoneNumber).toBe('+1234567890');
      expect(result[0].friendlyName).toBe('Test Number 1');
      expect(result[0].capabilities.voice).toBe(true);
      expect(result[0].capabilities.SMS).toBe(true);
      expect(result[0].capabilities.MMS).toBe(false);
    });

    it('should purchase phone number', async () => {
      const mockResponse = {
        sid: generateTwilioSid('PN'),
        account_sid: 'ACtest1234567890abcdef1234567890abcd',
        friendly_name: '+1234567890',
        phone_number: '+1234567890',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        capabilities: {
          voice: true,
          SMS: true,
          MMS: true,
          fax: false
        },
        origin: 'twilio',
        uri: '/2010-04-01/Accounts/ACtest/IncomingPhoneNumbers/PNtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.purchasePhoneNumber('+1234567890');

      expect(result.phoneNumber).toBe('+1234567890');
      expect(result.capabilities.voice).toBe(true);
      expect(result.capabilities.SMS).toBe(true);
      expect(result.capabilities.MMS).toBe(true);
    });

    it('should release phone number', async () => {
      const phoneNumberSid = generateTwilioSid('PN');
      mockFetch.mockResolvedValueOnce(createMockResponse({}));

      const result = await twilioIntegration.releasePhoneNumber(phoneNumberSid);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/IncomingPhoneNumbers/${phoneNumberSid}.json`),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Verification (2FA) Operations', () => {
    it('should send verification code via SMS', async () => {
      const mockResponse = {
        sid: generateTwilioSid('VE'),
        service_sid: generateTwilioSid('VA'),
        account_sid: 'ACtest1234567890abcdef1234567890abcd',
        to: '+1234567890',
        channel: 'sms',
        status: 'pending',
        valid: false,
        lookup: {},
        send_code_attempts: [],
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        url: 'https://verify.twilio.com/v2/Services/VA123/Verifications/VE123'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.sendVerificationCode('+1234567890', 'sms');

      expect(result.to).toBe('+1234567890');
      expect(result.channel).toBe('sms');
      expect(result.status).toBe('pending');
      expect(result.valid).toBe(false);
    });

    it('should send verification code via call', async () => {
      const mockResponse = {
        sid: generateTwilioSid('VE'),
        service_sid: generateTwilioSid('VA'),
        account_sid: 'ACtest1234567890abcdef1234567890abcd',
        to: '+1234567890',
        channel: 'call',
        status: 'pending',
        valid: false,
        lookup: {},
        send_code_attempts: [],
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        url: 'https://verify.twilio.com/v2/Services/VA123/Verifications/VE123'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.sendVerificationCode('+1234567890', 'call');

      expect(result.channel).toBe('call');
    });

    it('should verify code successfully', async () => {
      const mockResponse = {
        sid: generateTwilioSid('VE'),
        service_sid: generateTwilioSid('VA'),
        account_sid: 'ACtest1234567890abcdef1234567890abcd',
        to: '+1234567890',
        channel: 'sms',
        status: 'approved',
        valid: true,
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:01:00Z'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const result = await twilioIntegration.verifyCode('+1234567890', '123456');

      expect(result.to).toBe('+1234567890');
      expect(result.status).toBe('approved');
      expect(result.valid).toBe(true);
    });

    it('should handle invalid verification code', async () => {
      await expect(twilioIntegration.verifyCode('+1234567890', ''))
        .rejects.toThrow(TwilioIntegrationError);

      await expect(twilioIntegration.verifyCode('+1234567890', '   '))
        .rejects.toThrow(TwilioIntegrationError);
    });
  });

  describe('Webhook Operations', () => {
    it('should setup webhook', async () => {
      const events = ['message.status', 'call.completed'] as const;
      const result = await twilioIntegration.setupWebhook('https://example.com/webhook', events);

      expect(result.url).toBe('https://example.com/webhook');
      expect(result.method).toBe('POST');
      expect(result.filters).toEqual(events);
      expect(result.webhookSid).toMatch(/^WH/);
      expect(result.accountSid).toBe(mockConfig.accountSid);
      expect(result.dateCreated).toBeInstanceOf(Date);
      expect(result.dateUpdated).toBeInstanceOf(Date);
    });

    it('should validate webhook URL', async () => {
      await expect(twilioIntegration.setupWebhook('', ['message.status']))
        .rejects.toThrow(TwilioIntegrationError);

      await expect(twilioIntegration.setupWebhook('invalid-url', ['message.status']))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should require at least one webhook event', async () => {
      await expect(twilioIntegration.setupWebhook('https://example.com/webhook', []))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should handle webhook events', async () => {
      const webhookPayload: TwilioWebhookPayload = {
        MessageSid: generateTwilioSid('SM'),
        AccountSid: 'ACtest1234567890abcdef1234567890abcd',
        From: '+1234567890',
        To: '+0987654321',
        Body: 'Test message',
        MessageStatus: 'delivered',
        ApiVersion: '2010-04-01'
      };

      // Should not throw
      await expect(twilioIntegration.handleWebhookEvent(webhookPayload))
        .resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, {
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      }));

      await expect(twilioIntegration.sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(TwilioAuthenticationError);
    });

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '60' }
      }));

      await expect(twilioIntegration.sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(TwilioRateLimitError);
    });

    it('should handle insufficient funds errors', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, {
        ok: false,
        status: 402,
        statusText: 'Payment Required'
      }));

      await expect(twilioIntegration.sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(TwilioInsufficientFundsError);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(twilioIntegration.sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(TwilioNetworkError);
    });

    it('should handle invalid SID validation', async () => {
      await expect(twilioIntegration.getSMSStatus(''))
        .rejects.toThrow(TwilioIntegrationError);

      await expect(twilioIntegration.getSMSStatus('invalid-sid'))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should handle API errors with error details', async () => {
      const errorResponse = {
        code: 21211,
        message: 'The \'To\' number +1234567890 is not a valid phone number.',
        more_info: 'https://www.twilio.com/docs/errors/21211'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(errorResponse, {
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      }));

      await expect(twilioIntegration.sendSMS('+1234567890', 'Test'))
        .rejects.toThrow(TwilioIntegrationError);
    });
  });

  describe('Bulk Operations and Rate Limiting', () => {
    it('should handle empty bulk SMS recipients', async () => {
      await expect(twilioIntegration.sendBulkSMS([]))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should handle bulk SMS recipient limit', async () => {
      const recipients = Array.from({ length: 101 }, (_, i) => ({
        to: `+123456789${i.toString().padStart(2, '0')}`,
        message: `Message ${i}`
      }));

      await expect(twilioIntegration.sendBulkSMS(recipients))
        .rejects.toThrow(TwilioIntegrationError);
    });

    it('should process bulk SMS in batches', async () => {
      // Create 15 recipients to test batching (should be processed in 2 batches of 10 and 5)
      const recipients = Array.from({ length: 15 }, (_, i) => ({
        to: `+123456789${i.toString().padStart(2, '0')}`,
        message: `Message ${i}`
      }));

      // Mock successful responses for all messages
      const mockResponses = recipients.map((_, i) => ({
        sid: generateTwilioSid('SM'),
        to: `+123456789${i.toString().padStart(2, '0')}`,
        from: '+0987654321',
        body: `Message ${i}`,
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: `/2010-04-01/Accounts/ACtest/Messages/SMtest${i}.json`
      }));

      // Mock all the fetch calls
      mockResponses.forEach(response => {
        mockFetch.mockResolvedValueOnce(createMockResponse(response));
      });

      const result = await twilioIntegration.sendBulkSMS(recipients);

      expect(result.totalCount).toBe(15);
      expect(result.successCount).toBe(15);
      expect(result.failureCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(15);
    });
  });

  describe('Data Formatting and Validation', () => {
    it('should format SMS options correctly', async () => {
      const mockResponse = {
        sid: generateTwilioSid('SM'),
        to: '+1234567890',
        from: '+0987654321',
        body: 'Test message',
        status: 'sent',
        date_created: '2024-01-15T10:00:00Z',
        date_updated: '2024-01-15T10:00:00Z',
        uri: '/2010-04-01/Accounts/ACtest/Messages/SMtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const options: SMSOptions = {
        statusCallback: 'https://example.com/webhook',
        statusCallbackMethod: 'POST',
        provideFeedback: true,
        maxPrice: '0.01',
        validityPeriod: 3600,
        smartEncoded: true,
        sendAt: new Date('2024-01-15T12:00:00Z')
      };

      await twilioIntegration.sendSMS('+1234567890', 'Test message', options);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const requestBody = lastCall[1].body;

      expect(requestBody).toContain('StatusCallback=https%3A%2F%2Fexample.com%2Fwebhook');
      expect(requestBody).toContain('StatusCallbackMethod=POST');
      expect(requestBody).toContain('ProvideFeedback=true');
      expect(requestBody).toContain('MaxPrice=0.01');
      expect(requestBody).toContain('ValidityPeriod=3600');
      expect(requestBody).toContain('SmartEncoded=true');
      expect(requestBody).toContain('SendAt=2024-01-15T12%3A00%3A00.000Z');
    });

    it('should format call options correctly', async () => {
      const mockResponse = {
        sid: generateTwilioSid('CA'),
        to: '+1234567890',
        from: '+0987654321',
        status: 'queued',
        uri: '/2010-04-01/Accounts/ACtest/Calls/CAtest.json'
      };

      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const options: CallOptions = {
        url: 'https://example.com/twiml',
        method: 'POST',
        timeout: 30,
        record: true,
        recordingChannels: 'dual',
        machineDetection: 'Enable',
        machineDetectionTimeout: 5,
        timeLimit: 3600
      };

      await twilioIntegration.makeCall('+1234567890', '+0987654321', options);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const requestBody = lastCall[1].body;

      expect(requestBody).toContain('Url=https%3A%2F%2Fexample.com%2Ftwiml');
      expect(requestBody).toContain('Method=POST');
      expect(requestBody).toContain('Timeout=30');
      expect(requestBody).toContain('Record=true');
      expect(requestBody).toContain('RecordingChannels=dual');
      expect(requestBody).toContain('MachineDetection=Enable');
      expect(requestBody).toContain('MachineDetectionTimeout=5');
      expect(requestBody).toContain('TimeLimit=3600');
    });

    it('should format history filters correctly', async () => {
      const mockResponse = { messages: [] };
      mockFetch.mockResolvedValueOnce(createMockResponse(mockResponse));

      const filters: SMSHistoryFilters = {
        to: '+1234567890',
        from: '+0987654321',
        dateSentAfter: new Date('2024-01-01'),
        dateSentBefore: new Date('2024-01-31'),
        pageSize: 50,
        page: 2
      };

      await twilioIntegration.getSMSHistory(filters);

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const url = lastCall[0];

      expect(url).toContain('To=%2B1234567890');
      expect(url).toContain('From=%2B0987654321');
      expect(url).toContain('DateSent%3E=2024-01-01');
      expect(url).toContain('DateSent%3C=2024-01-31');
      expect(url).toContain('PageSize=50');
      expect(url).toContain('Page=2');
    });
  });
}); 