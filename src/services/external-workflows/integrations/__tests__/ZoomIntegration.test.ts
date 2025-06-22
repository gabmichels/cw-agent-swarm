import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { 
  ZoomIntegration, 
  ZoomConfig, 
  ZoomMeetingParams,
  ZoomIntegrationError,
  ZoomAuthenticationError,
  ZoomMeetingError,
  ZoomRateLimitError,
  createZoomIntegration
} from '../ZoomIntegration';
import { WorkflowValidationError } from '../../errors/ExternalWorkflowErrors';

// Mock the logger
vi.mock('../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ZoomIntegration', () => {
  let mockHttpClient: {
    get: Mock;
    post: Mock;
    put: Mock;
    delete: Mock;
    patch: Mock;
  };

  let validConfig: ZoomConfig;
  let zoomIntegration: ZoomIntegration;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock HTTP client
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    // Valid configuration
    validConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'https://example.com/callback',
      scopes: ['meeting:write', 'meeting:read', 'user:read'] as const,
      apiVersion: 'v2'
    };

    // Create integration instance
    zoomIntegration = new ZoomIntegration(validConfig, mockHttpClient);
  });

  describe('Constructor and Configuration', () => {
    it('should create ZoomIntegration with valid config', () => {
      expect(zoomIntegration).toBeInstanceOf(ZoomIntegration);
    });

    it('should throw WorkflowValidationError for missing clientId', () => {
      const invalidConfig = { ...validConfig, clientId: '' };
      expect(() => new ZoomIntegration(invalidConfig, mockHttpClient)).toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for missing clientSecret', () => {
      const invalidConfig = { ...validConfig, clientSecret: '' };
      expect(() => new ZoomIntegration(invalidConfig, mockHttpClient)).toThrow(WorkflowValidationError);
    });

    it('should throw WorkflowValidationError for missing redirectUri', () => {
      const invalidConfig = { ...validConfig, redirectUri: '' };
      expect(() => new ZoomIntegration(invalidConfig, mockHttpClient)).toThrow(WorkflowValidationError);
    });

    it('should create integration using factory function', () => {
      const integration = createZoomIntegration(validConfig);
      expect(integration).toBeInstanceOf(ZoomIntegration);
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully with valid authorization code', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        scope: 'meeting:write meeting:read user:read'
      };

      // Mock fetch for token request
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse)
      });

      const result = await zoomIntegration.authenticate('test-auth-code');

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': expect.stringContaining('Basic '),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.any(URLSearchParams)
      });
    });

    it('should throw ZoomAuthenticationError for failed authentication', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      });

      await expect(zoomIntegration.authenticate('invalid-code')).rejects.toThrow(ZoomAuthenticationError);
    });

    it('should test connection successfully when authenticated', async () => {
      // First authenticate
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600
        })
      });

      await zoomIntegration.authenticate('test-code');

      // Mock user info response
      mockHttpClient.get.mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      });

      const result = await zoomIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.zoom.us/v2/users/me',
        expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      );
    });

    it('should throw ZoomAuthenticationError when not authenticated', async () => {
      await expect(zoomIntegration.testConnection()).rejects.toThrow(ZoomAuthenticationError);
    });
  });

  describe('Meeting Management', () => {
    beforeEach(async () => {
      // Authenticate first
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600
        })
      });

      await zoomIntegration.authenticate('test-code');
    });

    describe('createMeeting', () => {
      it('should create a meeting successfully', async () => {
        const meetingParams: ZoomMeetingParams = {
          topic: 'Test Meeting',
          type: 2,
          startTime: new Date('2024-01-01T10:00:00Z'),
          duration: 60,
          password: 'test123',
          agenda: 'Test agenda'
        };

        const mockMeetingResponse = {
          id: 123456789,
          uuid: 'test-uuid',
          host_id: 'test-host-id',
          host_email: 'host@example.com',
          topic: 'Test Meeting',
          type: 2,
          status: 'waiting',
          start_time: '2024-01-01T10:00:00Z',
          duration: 60,
          timezone: 'UTC',
          agenda: 'Test agenda',
          created_at: '2024-01-01T09:00:00Z',
          start_url: 'https://zoom.us/s/123456789?zak=test',
          join_url: 'https://zoom.us/j/123456789',
          password: 'test123',
          settings: {
            host_video: false,
            participant_video: false
          }
        };

        mockHttpClient.post.mockResolvedValue(mockMeetingResponse);

        const result = await zoomIntegration.createMeeting(meetingParams);

        expect(result).toEqual({
          id: '123456789',
          uuid: 'test-uuid',
          hostId: 'test-host-id',
          hostEmail: 'host@example.com',
          topic: 'Test Meeting',
          type: 2,
          status: 'waiting',
          startTime: new Date('2024-01-01T10:00:00Z'),
          duration: 60,
          timezone: 'UTC',
          agenda: 'Test agenda',
          createdAt: new Date('2024-01-01T09:00:00Z'),
          startUrl: 'https://zoom.us/s/123456789?zak=test',
          joinUrl: 'https://zoom.us/j/123456789',
          password: 'test123',
          settings: {
            hostVideo: false,
            participantVideo: false
          }
        });

        expect(mockHttpClient.post).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/users/me/meetings',
          {
            topic: 'Test Meeting',
            type: 2,
            start_time: '2024-01-01T10:00:00.000Z',
            duration: 60,
            timezone: 'UTC',
            password: 'test123',
            agenda: 'Test agenda'
          },
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw WorkflowValidationError for empty topic', async () => {
        const invalidParams: ZoomMeetingParams = {
          topic: '',
          type: 2
        };

        await expect(zoomIntegration.createMeeting(invalidParams)).rejects.toThrow(WorkflowValidationError);
      });

      it('should throw WorkflowValidationError for scheduled meeting without start time', async () => {
        const invalidParams: ZoomMeetingParams = {
          topic: 'Test Meeting',
          type: 2 // Scheduled meeting
          // Missing startTime
        };

        await expect(zoomIntegration.createMeeting(invalidParams)).rejects.toThrow(WorkflowValidationError);
      });

      it('should throw WorkflowValidationError for invalid duration', async () => {
        const invalidParams: ZoomMeetingParams = {
          topic: 'Test Meeting',
          type: 1,
          duration: 2000 // Too long
        };

        await expect(zoomIntegration.createMeeting(invalidParams)).rejects.toThrow(WorkflowValidationError);
      });

      it('should handle rate limiting', async () => {
        mockHttpClient.post.mockRejectedValue(new ZoomRateLimitError(60));

        const meetingParams: ZoomMeetingParams = {
          topic: 'Test Meeting',
          type: 1
        };

        await expect(zoomIntegration.createMeeting(meetingParams)).rejects.toThrow(ZoomRateLimitError);
      });
    });

    describe('getMeeting', () => {
      it('should get meeting details successfully', async () => {
        const mockMeetingResponse = {
          id: 123456789,
          uuid: 'test-uuid',
          host_id: 'test-host-id',
          host_email: 'host@example.com',
          topic: 'Test Meeting',
          type: 2,
          status: 'waiting',
          start_time: '2024-01-01T10:00:00Z',
          duration: 60,
          timezone: 'UTC',
          created_at: '2024-01-01T09:00:00Z',
          start_url: 'https://zoom.us/s/123456789?zak=test',
          join_url: 'https://zoom.us/j/123456789',
          settings: {
            host_video: true,
            participant_video: false
          }
        };

        mockHttpClient.get.mockResolvedValue(mockMeetingResponse);

        const result = await zoomIntegration.getMeeting('123456789');

        expect(result.id).toBe('123456789');
        expect(result.topic).toBe('Test Meeting');
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/meetings/123456789',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw ZoomMeetingError for non-existent meeting', async () => {
        mockHttpClient.get.mockRejectedValue(new Error('Meeting not found'));

        await expect(zoomIntegration.getMeeting('999999999')).rejects.toThrow(ZoomMeetingError);
      });
    });

    describe('updateMeeting', () => {
      it('should update meeting successfully', async () => {
        const updates = {
          topic: 'Updated Meeting Title',
          duration: 90
        };

        const mockUpdatedMeeting = {
          id: 123456789,
          uuid: 'test-uuid',
          host_id: 'test-host-id',
          host_email: 'host@example.com',
          topic: 'Updated Meeting Title',
          type: 2,
          status: 'waiting',
          start_time: '2024-01-01T10:00:00Z',
          duration: 90,
          timezone: 'UTC',
          created_at: '2024-01-01T09:00:00Z',
          start_url: 'https://zoom.us/s/123456789?zak=test',
          join_url: 'https://zoom.us/j/123456789',
          settings: {
            host_video: true,
            participant_video: false
          }
        };

        mockHttpClient.patch.mockResolvedValue({});
        mockHttpClient.get.mockResolvedValue(mockUpdatedMeeting);

        const result = await zoomIntegration.updateMeeting('123456789', updates);

        expect(result.topic).toBe('Updated Meeting Title');
        expect(result.duration).toBe(90);
        expect(mockHttpClient.patch).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/meetings/123456789',
          {
            topic: 'Updated Meeting Title',
            duration: 90
          },
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });
    });

    describe('deleteMeeting', () => {
      it('should delete meeting successfully', async () => {
        mockHttpClient.delete.mockResolvedValue(true);

        const result = await zoomIntegration.deleteMeeting('123456789');

        expect(result).toBe(true);
        expect(mockHttpClient.delete).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/meetings/123456789',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw ZoomMeetingError for failed deletion', async () => {
        mockHttpClient.delete.mockRejectedValue(new Error('Deletion failed'));

        await expect(zoomIntegration.deleteMeeting('123456789')).rejects.toThrow(ZoomMeetingError);
      });
    });

    describe('listMeetings', () => {
      it('should list meetings successfully', async () => {
        const mockMeetingsResponse = {
          meetings: [
            {
              id: 123456789,
              uuid: 'test-uuid-1',
              host_id: 'test-host-id',
              host_email: 'host@example.com',
              topic: 'Meeting 1',
              type: 2,
              status: 'waiting',
              start_time: '2024-01-01T10:00:00Z',
              duration: 60,
              timezone: 'UTC',
              created_at: '2024-01-01T09:00:00Z',
              start_url: 'https://zoom.us/s/123456789?zak=test',
              join_url: 'https://zoom.us/j/123456789',
              settings: {}
            }
          ],
          page_count: 1,
          page_number: 1,
          page_size: 30,
          total_records: 1
        };

        mockHttpClient.get.mockResolvedValue(mockMeetingsResponse);

        const result = await zoomIntegration.listMeetings({ type: 'scheduled' });

        expect(result.meetings).toHaveLength(1);
        expect(result.meetings[0].topic).toBe('Meeting 1');
        expect(result.totalRecords).toBe(1);
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/users/me/meetings?type=scheduled',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should list meetings with pagination', async () => {
        const mockMeetingsResponse = {
          meetings: [],
          page_count: 5,
          page_number: 2,
          page_size: 10,
          total_records: 50
        };

        mockHttpClient.get.mockResolvedValue(mockMeetingsResponse);

        const result = await zoomIntegration.listMeetings({ 
          pageSize: 10, 
          pageNumber: 2 
        });

        expect(result.pageNumber).toBe(2);
        expect(result.pageSize).toBe(10);
        expect(result.totalRecords).toBe(50);
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/users/me/meetings?page_size=10&page_number=2',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      // Authenticate first
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600
        })
      });

      await zoomIntegration.authenticate('test-code');
    });

    describe('getCurrentUser', () => {
      it('should get current user successfully', async () => {
        const mockUserResponse = {
          id: 'test-user-id',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          type: 2,
          role_name: 'Admin',
          pmi: 1234567890,
          use_pmi: false,
          personal_meeting_url: 'https://zoom.us/j/1234567890',
          timezone: 'America/New_York',
          verified: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login_time: '2024-01-01T10:00:00Z',
          pic_url: 'https://example.com/pic.jpg',
          host_key: '123456',
          jid: 'test@xmpp.zoom.us',
          group_ids: ['group1', 'group2'],
          account_id: 'account123',
          language: 'en-US',
          phone_country: 'US',
          phone_number: '+1234567890',
          status: 'active'
        };

        mockHttpClient.get.mockResolvedValue(mockUserResponse);

        const result = await zoomIntegration.getCurrentUser();

        expect(result).toEqual({
          id: 'test-user-id',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          type: 2,
          roleName: 'Admin',
          pmi: '1234567890',
          usePmi: false,
          personalMeetingUrl: 'https://zoom.us/j/1234567890',
          timezone: 'America/New_York',
          verified: true,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          lastLoginTime: new Date('2024-01-01T10:00:00Z'),
          picUrl: 'https://example.com/pic.jpg',
          hostKey: '123456',
          jid: 'test@xmpp.zoom.us',
          groupIds: ['group1', 'group2'],
          accountId: 'account123',
          language: 'en-US',
          phoneCountry: 'US',
          phoneNumber: '+1234567890',
          status: 'active'
        });

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://api.zoom.us/v2/users/me',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw ZoomIntegrationError for failed user retrieval', async () => {
        mockHttpClient.get.mockRejectedValue(new Error('User not found'));

        await expect(zoomIntegration.getCurrentUser()).rejects.toThrow(ZoomIntegrationError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting in HTTP client', async () => {
      const mockHttpClient = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn()
      };

      // Mock rate limit response
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (header: string) => header === 'retry-after' ? '120' : null
        }
      });

      const integration = new ZoomIntegration(validConfig, mockHttpClient);

      await expect(integration.authenticate('test-code')).rejects.toThrow(ZoomRateLimitError);
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(zoomIntegration.authenticate('test-code')).rejects.toThrow(ZoomAuthenticationError);
    });
  });

  describe('Advanced Meeting Features', () => {
    beforeEach(async () => {
      // Authenticate first
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_in: 3600
        })
      });

      await zoomIntegration.authenticate('test-code');
    });

    it('should create recurring meeting', async () => {
      const meetingParams: ZoomMeetingParams = {
        topic: 'Weekly Team Meeting',
        type: 8, // Recurring with fixed time
        startTime: new Date('2024-01-01T10:00:00Z'),
        duration: 60,
        recurrence: {
          type: 2, // Weekly
          repeatInterval: 1,
          weeklyDays: '1,2,3,4,5', // Weekdays
          endTimes: 10
        }
      };

      const mockMeetingResponse = {
        id: 123456789,
        uuid: 'test-uuid',
        host_id: 'test-host-id',
        host_email: 'host@example.com',
        topic: 'Weekly Team Meeting',
        type: 8,
        status: 'waiting',
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
        timezone: 'UTC',
        created_at: '2024-01-01T09:00:00Z',
        start_url: 'https://zoom.us/s/123456789?zak=test',
        join_url: 'https://zoom.us/j/123456789',
        settings: {},
        recurrence: {
          type: 2,
          repeat_interval: 1,
          weekly_days: '1,2,3,4,5',
          end_times: 10
        }
      };

      mockHttpClient.post.mockResolvedValue(mockMeetingResponse);

      const result = await zoomIntegration.createMeeting(meetingParams);

      expect(result.type).toBe(8);
      expect(result.recurrence).toEqual({
        type: 2,
        repeatInterval: 1,
        weeklyDays: '1,2,3,4,5',
        endTimes: 10
      });
    });

    it('should create meeting with advanced settings', async () => {
      const meetingParams: ZoomMeetingParams = {
        topic: 'Secure Meeting',
        type: 2,
        startTime: new Date('2024-01-01T10:00:00Z'),
        duration: 60,
        settings: {
          hostVideo: true,
          participantVideo: false,
          joinBeforeHost: false,
          muteUponEntry: true,
          watermark: true,
          autoRecording: 'cloud',
          encryptionType: 'enhanced_encryption'
        }
      };

      const mockMeetingResponse = {
        id: 123456789,
        uuid: 'test-uuid',
        host_id: 'test-host-id',
        host_email: 'host@example.com',
        topic: 'Secure Meeting',
        type: 2,
        status: 'waiting',
        start_time: '2024-01-01T10:00:00Z',
        duration: 60,
        timezone: 'UTC',
        created_at: '2024-01-01T09:00:00Z',
        start_url: 'https://zoom.us/s/123456789?zak=test',
        join_url: 'https://zoom.us/j/123456789',
        settings: {
          host_video: true,
          participant_video: false,
          join_before_host: false,
          mute_upon_entry: true,
          watermark: true,
          auto_recording: 'cloud',
          encryption_type: 'enhanced_encryption'
        }
      };

      mockHttpClient.post.mockResolvedValue(mockMeetingResponse);

      const result = await zoomIntegration.createMeeting(meetingParams);

      expect(result.settings).toEqual({
        hostVideo: true,
        participantVideo: false,
        joinBeforeHost: false,
        muteUponEntry: true,
        watermark: true,
        autoRecording: 'cloud',
        encryptionType: 'enhanced_encryption'
      });
    });
  });
}); 