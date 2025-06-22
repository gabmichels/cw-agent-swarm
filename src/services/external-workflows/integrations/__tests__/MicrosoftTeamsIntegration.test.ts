/**
 * Microsoft Teams Integration Tests
 * 
 * Comprehensive test suite for the Microsoft Teams integration service
 * following IMPLEMENTATION_GUIDELINES.md testing standards.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { 
  MicrosoftTeamsIntegration,
  TeamsConfig,
  TeamsMessageParams,
  TeamsAuthenticationError,
  TeamsIntegrationError,
  TeamsChannelError,
  TeamsMeetingError,
  createMicrosoftTeamsIntegration
} from '../MicrosoftTeamsIntegration';
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

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('MicrosoftTeamsIntegration', () => {
  let teamsIntegration: MicrosoftTeamsIntegration;
  let mockConfig: TeamsConfig;
  let mockHttpClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tenantId: 'test-tenant-id',
      redirectUri: 'https://example.com/callback',
      scopes: ['https://graph.microsoft.com/Chat.ReadWrite']
    };

    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    teamsIntegration = new MicrosoftTeamsIntegration(mockConfig, mockHttpClient);
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with valid configuration', () => {
      expect(teamsIntegration).toBeInstanceOf(MicrosoftTeamsIntegration);
    });

    it('should throw WorkflowValidationError for missing required config', () => {
      const invalidConfig = {
        clientId: '',
        clientSecret: 'test-secret',
        tenantId: 'test-tenant',
        redirectUri: 'https://example.com/callback',
        scopes: []
      };

      expect(() => new MicrosoftTeamsIntegration(invalidConfig)).toThrow(WorkflowValidationError);
      expect(() => new MicrosoftTeamsIntegration(invalidConfig)).toThrow('Missing required Teams configuration');
    });

    it('should create instance using factory function', () => {
      const integration = createMicrosoftTeamsIntegration(mockConfig);
      expect(integration).toBeInstanceOf(MicrosoftTeamsIntegration);
    });
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);

      const result = await teamsIntegration.authenticate();
      expect(result).toBe(true);
    });

    it('should throw TeamsAuthenticationError for invalid credentials', async () => {
      const mockErrorResponse = {
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve(mockErrorResponse)
      } as Response);

      await expect(teamsIntegration.authenticate()).rejects.toThrow(TeamsAuthenticationError);
      await expect(teamsIntegration.authenticate()).rejects.toThrow('Authentication failed');
    });

    it('should handle network errors during authentication', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(teamsIntegration.authenticate()).rejects.toThrow(TeamsAuthenticationError);
    });
  });

  describe('Connection Testing', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await teamsIntegration.authenticate();
    });

    it('should test connection successfully', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        id: 'test-user-id',
        displayName: 'Test User'
      });

      const result = await teamsIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      );
    });

    it('should return false for failed connection test', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await teamsIntegration.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Message Operations', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await teamsIntegration.authenticate();
    });

    describe('sendMessage', () => {
      const validMessageParams: TeamsMessageParams = {
        teamId: 'team-123',
        channelId: 'channel-456',
        content: 'Test message',
        contentType: 'text',
        importance: 'normal'
      };

      it('should send message successfully', async () => {
        const mockResponse = {
          id: 'test-message-id',
          createdDateTime: new Date().toISOString(),
          webUrl: 'https://teams.microsoft.com/message-link'
        };

        mockHttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await teamsIntegration.sendMessage(validMessageParams);

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(result.createdDateTime).toBeInstanceOf(Date);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          `https://graph.microsoft.com/v1.0/teams/${validMessageParams.teamId}/channels/${validMessageParams.channelId}/messages`,
          expect.objectContaining({
            body: expect.objectContaining({
              contentType: validMessageParams.contentType,
              content: validMessageParams.content
            }),
            importance: validMessageParams.importance
          }),
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should validate message parameters', async () => {
        const invalidParams = {
          ...validMessageParams,
          teamId: '', // Empty team ID
          channelId: '', // Empty channel ID
          content: '' // Empty content
        };

        const result = await teamsIntegration.sendMessage(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Team ID cannot be empty');
      });

      it('should send message with mentions and attachments', async () => {
        const messageWithExtras: TeamsMessageParams = {
          ...validMessageParams,
          mentions: [{
            id: 'mention-1',
            mentionText: '@testuser',
            mentioned: {
              user: {
                displayName: 'Test User',
                id: 'user-123',
                userIdentityType: 'aadUser'
              }
            }
          }],
          attachments: [{
            id: 'attachment-1',
            contentType: 'application/pdf',
            name: 'document.pdf'
          }]
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: 'test-message-id',
          createdDateTime: new Date().toISOString()
        });

        const result = await teamsIntegration.sendMessage(messageWithExtras);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            mentions: expect.arrayContaining([
              expect.objectContaining({
                id: 'mention-1',
                mentionText: '@testuser'
              })
            ]),
            attachments: expect.arrayContaining([
              expect.objectContaining({
                id: 'attachment-1',
                contentType: 'application/pdf'
              })
            ])
          }),
          expect.any(Object)
        );
      });

      it('should handle message sending errors', async () => {
        mockHttpClient.post.mockRejectedValueOnce(new Error('Send failed'));

        const result = await teamsIntegration.sendMessage(validMessageParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Send failed');
      });

      it('should send reply message', async () => {
        const replyParams: TeamsMessageParams = {
          ...validMessageParams,
          replyToId: 'original-message-id'
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: 'reply-message-id',
          createdDateTime: new Date().toISOString()
        });

        const result = await teamsIntegration.sendMessage(replyParams);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          `https://graph.microsoft.com/v1.0/teams/${validMessageParams.teamId}/channels/${validMessageParams.channelId}/messages/original-message-id/replies`,
          expect.any(Object),
          expect.any(Object)
        );
      });
    });

    describe('getTeamChannels', () => {
      it('should retrieve team channels successfully', async () => {
        const mockChannels = {
          value: [
            {
              id: 'channel-1',
              displayName: 'General',
              description: 'General channel',
              webUrl: 'https://teams.microsoft.com/channel-link',
              membershipType: 'standard',
              createdDateTime: new Date().toISOString()
            }
          ]
        };

        mockHttpClient.get.mockResolvedValueOnce(mockChannels);

        const result = await teamsIntegration.getTeamChannels('team-123');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'channel-1',
          displayName: 'General',
          description: 'General channel',
          membershipType: 'standard'
        });
        expect(result[0].createdDateTime).toBeInstanceOf(Date);
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/teams/team-123/channels',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw TeamsChannelError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('API Error'));

        await expect(teamsIntegration.getTeamChannels('team-123')).rejects.toThrow(TeamsChannelError);
      });
    });

    describe('getJoinedTeams', () => {
      it('should retrieve joined teams successfully', async () => {
        const mockTeams = {
          value: [
            {
              id: 'team-1',
              displayName: 'Test Team',
              description: 'A test team',
              internalId: 'internal-123',
              specialization: 'none',
              visibility: 'private',
              webUrl: 'https://teams.microsoft.com/team-link',
              isArchived: false,
              isMembershipLimitedToOwners: false,
              memberSettings: {
                allowCreateUpdateChannels: true,
                allowCreatePrivateChannels: false,
                allowDeleteChannels: false,
                allowAddRemoveApps: true,
                allowCreateUpdateRemoveTabs: true,
                allowCreateUpdateRemoveConnectors: false
              },
              guestSettings: {
                allowCreateUpdateChannels: false,
                allowDeleteChannels: false
              },
              messagingSettings: {
                allowUserEditMessages: true,
                allowUserDeleteMessages: true,
                allowOwnerDeleteMessages: true,
                allowTeamMentions: true,
                allowChannelMentions: true
              },
              funSettings: {
                allowGiphy: true,
                giphyContentRating: 'moderate',
                allowStickersAndMemes: true,
                allowCustomMemes: true
              },
              createdDateTime: new Date().toISOString()
            }
          ]
        };

        mockHttpClient.get.mockResolvedValueOnce(mockTeams);

        const result = await teamsIntegration.getJoinedTeams();

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          id: 'team-1',
          displayName: 'Test Team',
          description: 'A test team',
          specialization: 'none',
          visibility: 'private',
          isArchived: false
        });
        expect(result[0].createdDateTime).toBeInstanceOf(Date);
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/joinedTeams',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw TeamsIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('API Error'));

        await expect(teamsIntegration.getJoinedTeams()).rejects.toThrow(TeamsIntegrationError);
      });
    });

    describe('createOnlineMeeting', () => {
      const validMeetingData = {
        subject: 'Test Meeting',
        body: {
          contentType: 'html' as const,
          content: '<p>Meeting description</p>'
        },
        start: {
          dateTime: new Date('2024-01-01T10:00:00Z'),
          timeZone: 'UTC'
        },
        end: {
          dateTime: new Date('2024-01-01T11:00:00Z'),
          timeZone: 'UTC'
        },
        attendees: [{
          emailAddress: {
            name: 'Test Attendee',
            address: 'attendee@example.com'
          },
          status: {
            response: 'none' as const
          },
          type: 'required' as const
        }],
        organizer: {
          emailAddress: {
            name: 'Test Organizer',
            address: 'organizer@example.com'
          }
        },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness' as const,
        allowedPresenters: 'everyone' as const,
        isEntryExitAnnounced: false,
        lobbyBypassSettings: {
          scope: 'organizer' as const,
          isDialInBypassEnabled: false
        },
        joinMeetingIdSettings: {
          isPasscodeRequired: false
        },
        createdDateTime: new Date(),
        lastModifiedDateTime: new Date()
      };

      it('should create online meeting successfully', async () => {
        const mockResponse = {
          id: 'meeting-123',
          subject: 'Test Meeting',
          createdDateTime: new Date().toISOString(),
          lastModifiedDateTime: new Date().toISOString(),
          onlineMeeting: {
            joinUrl: 'https://teams.microsoft.com/join/meeting-123',
            conferenceId: 'conf-123'
          }
        };

        mockHttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await teamsIntegration.createOnlineMeeting(validMeetingData);

        expect(result).toMatchObject({
          id: 'meeting-123',
          subject: 'Test Meeting'
        });
        expect(result.createdDateTime).toBeInstanceOf(Date);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/me/onlineMeetings',
          expect.objectContaining({
            subject: 'Test Meeting',
            start: expect.objectContaining({
              dateTime: validMeetingData.start.dateTime.toISOString(),
              timeZone: 'UTC'
            })
          }),
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw TeamsMeetingError on failure', async () => {
        mockHttpClient.post.mockRejectedValueOnce(new Error('Meeting creation failed'));

        await expect(teamsIntegration.createOnlineMeeting(validMeetingData)).rejects.toThrow(TeamsMeetingError);
      });
    });

    describe('getUser', () => {
      it('should retrieve user information successfully', async () => {
        const mockUser = {
          id: 'user-123',
          displayName: 'Test User',
          givenName: 'Test',
          surname: 'User',
          mail: 'test.user@example.com',
          userPrincipalName: 'test.user@example.com',
          jobTitle: 'Software Engineer',
          mobilePhone: '+1234567890',
          businessPhones: ['+0987654321'],
          officeLocation: 'Building A',
          preferredLanguage: 'en-US',
          userType: 'Member'
        };

        mockHttpClient.get.mockResolvedValueOnce(mockUser);

        const result = await teamsIntegration.getUser('user-123');

        expect(result).toMatchObject({
          id: 'user-123',
          displayName: 'Test User',
          givenName: 'Test',
          surname: 'User',
          email: 'test.user@example.com',
          userPrincipalName: 'test.user@example.com',
          jobTitle: 'Software Engineer'
        });
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://graph.microsoft.com/v1.0/users/user-123',
          expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        );
      });

      it('should throw TeamsIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('User not found'));

        await expect(teamsIntegration.getUser('user-123')).rejects.toThrow(TeamsIntegrationError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: 'invalid_request',
          error_description: 'The request is missing a required parameter'
        })
      } as Response);

      await expect(teamsIntegration.authenticate()).rejects.toThrow(TeamsAuthenticationError);
    });

    it('should handle rate limiting', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('HTTP 429: Too Many Requests'));

      await expect(teamsIntegration.testConnection()).resolves.toBe(false);
    });

    it('should handle network timeouts', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      await expect(teamsIntegration.testConnection()).resolves.toBe(false);
    });
  });

  describe('Token Management', () => {
    it('should handle token expiration', async () => {
      // Mock initial authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'initial-token',
          expires_in: 1 // Expires in 1 second
        })
      } as Response);

      await teamsIntegration.authenticate();

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Mock re-authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          expires_in: 3600
        })
      } as Response);

      mockHttpClient.get.mockResolvedValueOnce({ id: 'test-user' });

      const result = await teamsIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial auth + re-auth
    });
  });

  describe('Data Mapping', () => {
    beforeEach(async () => {
      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'test-token',
          expires_in: 3600
        })
      } as Response);
      
      await teamsIntegration.authenticate();
    });

    it('should map channel data correctly', async () => {
      const mockApiChannel = {
        id: 'channel-123',
        displayName: 'Test Channel',
        description: 'A test channel',
        email: 'test-channel@example.com',
        webUrl: 'https://teams.microsoft.com/channel-link',
        membershipType: 'standard',
        moderationSettings: {
          userNewMessageRestriction: 'everyone',
          replyRestriction: 'everyone',
          allowNewMessageFromBots: true,
          allowNewMessageFromConnectors: true
        },
        createdDateTime: '2023-12-01T10:00:00Z'
      };

      mockHttpClient.get.mockResolvedValueOnce({
        value: [mockApiChannel]
      });

      const result = await teamsIntegration.getTeamChannels('team-123');

      expect(result[0]).toMatchObject({
        id: 'channel-123',
        displayName: 'Test Channel',
        description: 'A test channel',
        email: 'test-channel@example.com',
        webUrl: 'https://teams.microsoft.com/channel-link',
        membershipType: 'standard'
      });
      expect(result[0].createdDateTime).toBeInstanceOf(Date);
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockApiChannel = {
        id: 'channel-123',
        displayName: 'Minimal Channel',
        webUrl: 'https://teams.microsoft.com/channel-link',
        membershipType: 'standard',
        createdDateTime: '2023-12-01T10:00:00Z'
        // Missing optional fields
      };

      mockHttpClient.get.mockResolvedValueOnce({
        value: [mockApiChannel]
      });

      const result = await teamsIntegration.getTeamChannels('team-123');

      expect(result[0]).toMatchObject({
        id: 'channel-123',
        displayName: 'Minimal Channel',
        webUrl: 'https://teams.microsoft.com/channel-link',
        membershipType: 'standard'
      });
      expect(result[0].description).toBeUndefined();
      expect(result[0].email).toBeUndefined();
    });
  });
}); 