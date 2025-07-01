/**
 * Discord Integration Tests
 * 
 * Comprehensive test suite for the Discord integration service
 * following IMPLEMENTATION_GUIDELINES.md testing standards.
 */

import { beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { WorkflowValidationError } from '../../errors/ExternalWorkflowErrors';
import {
  DiscordAuthenticationError,
  DiscordChannelError,
  DiscordConfig,
  DiscordIntegration,
  DiscordIntegrationError,
  DiscordMessageParams,
  DiscordRateLimitError,
  createDiscordIntegration
} from '../DiscordIntegration';

// Mock the logger
vi.mock('../../../../lib/logging', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock existing Discord notification utility
vi.mock('../../../../agents/shared/notifications/utils/discordUtils', () => ({
  notifyDiscord: vi.fn().mockResolvedValue(true)
}));

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('DiscordIntegration', () => {
  let discordIntegration: DiscordIntegration;
  let mockConfig: DiscordConfig;
  let mockHttpClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      botToken: 'Bot MOCK_BOT_TOKEN_FOR_TESTING',
      applicationId: '198622483471925248',
      publicKey: 'ed25519-public-key',
      guildId: '123456789012345678',
      defaultChannelId: '987654321098765432',
      permissions: ['SEND_MESSAGES', 'READ_MESSAGE_HISTORY', 'MANAGE_CHANNELS']
    };

    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    };

    discordIntegration = new DiscordIntegration(mockConfig, mockHttpClient);
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with valid configuration', () => {
      expect(discordIntegration).toBeInstanceOf(DiscordIntegration);
    });

    it('should throw WorkflowValidationError for missing required config', () => {
      const invalidConfig = {
        botToken: '',
        applicationId: 'test-app-id',
        guildId: 'test-guild-id'
      };

      expect(() => new DiscordIntegration(invalidConfig)).toThrow(WorkflowValidationError);
      expect(() => new DiscordIntegration(invalidConfig)).toThrow('Missing required Discord configuration');
    });

    it('should create instance using factory function', () => {
      const integration = createDiscordIntegration(mockConfig);
      expect(integration).toBeInstanceOf(DiscordIntegration);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid bot token', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        id: '198622483471925248',
        username: 'TestBot',
        discriminator: '0000',
        bot: true
      });

      const result = await discordIntegration.initialize();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://discord.com/api/v10/users/@me',
        expect.objectContaining({
          'Authorization': `Bot ${mockConfig.botToken}`
        })
      );
    });

    it('should throw DiscordAuthenticationError for invalid bot token', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('401 Unauthorized'));

      await expect(discordIntegration.initialize()).rejects.toThrow(DiscordAuthenticationError);
    });

    it('should handle network errors during initialization', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(discordIntegration.initialize()).rejects.toThrow(DiscordAuthenticationError);
    });
  });

  describe('Connection Testing', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockHttpClient.get.mockResolvedValueOnce({
        id: '198622483471925248',
        username: 'TestBot',
        bot: true
      });

      await discordIntegration.initialize();
    });

    it('should test connection successfully', async () => {
      mockHttpClient.get.mockResolvedValueOnce({
        id: '123456789012345678',
        name: 'Test Guild',
        owner_id: '987654321098765432'
      });

      const result = await discordIntegration.testConnection();

      expect(result).toBe(true);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `https://discord.com/api/v10/guilds/${mockConfig.guildId}`,
        expect.objectContaining({
          'Authorization': `Bot ${mockConfig.botToken}`
        })
      );
    });

    it('should return false for failed connection test', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await discordIntegration.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('Message Operations', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockHttpClient.get.mockResolvedValueOnce({
        id: '198622483471925248',
        username: 'TestBot',
        bot: true
      });

      await discordIntegration.initialize();
    });

    describe('sendMessage', () => {
      const validMessageParams: DiscordMessageParams = {
        channelId: '987654321098765432',
        content: 'Hello, Discord!'
      };

      it('should send message successfully', async () => {
        const mockResponse = {
          id: '1234567890123456789',
          channel_id: '987654321098765432',
          guild_id: '123456789012345678',
          content: 'Hello, Discord!',
          timestamp: new Date().toISOString(),
          author: {
            id: '198622483471925248',
            username: 'TestBot',
            bot: true
          }
        };

        mockHttpClient.post.mockResolvedValueOnce(mockResponse);

        const result = await discordIntegration.sendMessage(validMessageParams);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('1234567890123456789');
        expect(result.channelId).toBe('987654321098765432');
        expect(result.timestamp).toBeInstanceOf(Date);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          `https://discord.com/api/v10/channels/${validMessageParams.channelId}/messages`,
          expect.objectContaining({
            content: validMessageParams.content
          }),
          expect.objectContaining({
            'Authorization': `Bot ${mockConfig.botToken}`
          })
        );
      });

      it('should validate message parameters', async () => {
        const invalidParams = {
          channelId: '', // Empty channel ID
          content: '' // Empty content
        };

        const result = await discordIntegration.sendMessage(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Channel ID cannot be empty');
      });

      it('should send message with embeds', async () => {
        const messageWithEmbeds: DiscordMessageParams = {
          channelId: '987654321098765432',
          content: 'Check out this embed!',
          embeds: [{
            title: 'Test Embed',
            description: 'This is a test embed',
            color: 0x00ff00,
            timestamp: new Date(),
            footer: {
              text: 'Test Footer'
            },
            author: {
              name: 'Test Author',
              iconUrl: 'https://example.com/icon.png'
            },
            fields: [{
              name: 'Field 1',
              value: 'Value 1',
              inline: true
            }]
          }]
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: '1234567890123456789',
          channel_id: '987654321098765432',
          timestamp: new Date().toISOString()
        });

        const result = await discordIntegration.sendMessage(messageWithEmbeds);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            content: 'Check out this embed!',
            embeds: expect.arrayContaining([
              expect.objectContaining({
                title: 'Test Embed',
                description: 'This is a test embed',
                color: 0x00ff00,
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    name: 'Field 1',
                    value: 'Value 1',
                    inline: true
                  })
                ])
              })
            ])
          }),
          expect.any(Object)
        );
      });

      it('should send message with components', async () => {
        const messageWithComponents: DiscordMessageParams = {
          channelId: '987654321098765432',
          content: 'Click the button!',
          components: [{
            type: 1 as const, // Action Row
            components: [{
              type: 2 as const, // Button
              style: 1 as const, // Primary
              label: 'Click Me!',
              customId: 'test_button_1'
            }]
          }]
        };

        mockHttpClient.post.mockResolvedValueOnce({
          id: '1234567890123456789',
          channel_id: '987654321098765432',
          timestamp: new Date().toISOString()
        });

        const result = await discordIntegration.sendMessage(messageWithComponents);

        expect(result.success).toBe(true);
        expect(mockHttpClient.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            content: 'Click the button!',
            components: expect.arrayContaining([
              expect.objectContaining({
                type: 1,
                components: expect.arrayContaining([
                  expect.objectContaining({
                    type: 2,
                    style: 1,
                    label: 'Click Me!',
                    custom_id: 'test_button_1'
                  })
                ])
              })
            ])
          }),
          expect.any(Object)
        );
      });

      it('should handle message sending errors', async () => {
        mockHttpClient.post.mockRejectedValueOnce(new Error('Send failed'));

        const result = await discordIntegration.sendMessage(validMessageParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Send failed');
      });

      it('should handle rate limiting', async () => {
        const rateLimitError = new Error('HTTP 429: Too Many Requests');
        mockHttpClient.post.mockRejectedValueOnce(rateLimitError);

        const result = await discordIntegration.sendMessage(validMessageParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('429');
      });
    });

    describe('getGuild', () => {
      it('should retrieve guild information successfully', async () => {
        const mockGuild = {
          id: '123456789012345678',
          name: 'Test Guild',
          icon: 'guild-icon-hash',
          owner_id: '987654321098765432',
          afk_timeout: 300,
          verification_level: 2,
          default_message_notifications: 0,
          explicit_content_filter: 1,
          roles: [],
          emojis: [],
          features: ['COMMUNITY'],
          mfa_level: 1,
          system_channel_flags: 0,
          premium_tier: 1,
          preferred_locale: 'en-US',
          nsfw_level: 0,
          premium_progress_bar_enabled: false
        };

        mockHttpClient.get.mockResolvedValueOnce(mockGuild);

        const result = await discordIntegration.getGuild('123456789012345678');

        expect(result).toMatchObject({
          id: '123456789012345678',
          name: 'Test Guild',
          icon: 'guild-icon-hash',
          ownerId: '987654321098765432',
          verificationLevel: 2,
          defaultMessageNotifications: 0,
          explicitContentFilter: 1,
          features: ['COMMUNITY'],
          mfaLevel: 1,
          premiumTier: 1,
          preferredLocale: 'en-US',
          nsfwLevel: 0,
          premiumProgressBarEnabled: false
        });
        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://discord.com/api/v10/guilds/123456789012345678',
          expect.objectContaining({
            'Authorization': `Bot ${mockConfig.botToken}`
          })
        );
      });

      it('should throw DiscordIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('Guild not found'));

        await expect(discordIntegration.getGuild('123456789012345678')).rejects.toThrow(DiscordIntegrationError);
      });
    });

    describe('getGuildChannels', () => {
      it('should retrieve guild channels successfully', async () => {
        const mockChannels = [
          {
            id: '987654321098765432',
            type: 0 as const,
            guild_id: '123456789012345678',
            position: 0,
            name: 'general',
            topic: 'General discussion',
            nsfw: false,
            last_message_id: '1234567890123456789',
            rate_limit_per_user: 0,
            parent_id: null
          },
          {
            id: '876543210987654321',
            type: 2 as const,
            guild_id: '123456789012345678',
            position: 1,
            name: 'General Voice',
            bitrate: 64000,
            user_limit: 10,
            parent_id: null
          }
        ];

        mockHttpClient.get.mockResolvedValueOnce(mockChannels);

        const result = await discordIntegration.getGuildChannels('123456789012345678');

        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
          id: '987654321098765432',
          type: 0,
          guildId: '123456789012345678',
          position: 0,
          name: 'general',
          topic: 'General discussion',
          nsfw: false,
          lastMessageId: '1234567890123456789',
          rateLimitPerUser: 0
        });
        expect(result[1]).toMatchObject({
          id: '876543210987654321',
          type: 2,
          guildId: '123456789012345678',
          position: 1,
          name: 'General Voice',
          bitrate: 64000,
          userLimit: 10
        });
      });

      it('should throw DiscordChannelError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('Channels not found'));

        await expect(discordIntegration.getGuildChannels('123456789012345678')).rejects.toThrow(DiscordChannelError);
      });
    });

    describe('Webhook Operations', () => {
      describe('createWebhook', () => {
        it('should create webhook successfully', async () => {
          const mockWebhook = {
            id: '1234567890123456789',
            type: 1 as const,
            guild_id: '123456789012345678',
            channel_id: '987654321098765432',
            name: 'Test Webhook',
            avatar: null,
            token: 'webhook-token-here',
            application_id: null,
            url: 'https://discord.com/api/webhooks/1234567890123456789/webhook-token-here'
          };

          mockHttpClient.post.mockResolvedValueOnce(mockWebhook);

          const result = await discordIntegration.createWebhook('987654321098765432', 'Test Webhook');

          expect(result).toMatchObject({
            id: '1234567890123456789',
            type: 1,
            guildId: '123456789012345678',
            channelId: '987654321098765432',
            name: 'Test Webhook',
            token: 'webhook-token-here',
            url: 'https://discord.com/api/webhooks/1234567890123456789/webhook-token-here'
          });
          expect(mockHttpClient.post).toHaveBeenCalledWith(
            'https://discord.com/api/v10/channels/987654321098765432/webhooks',
            expect.objectContaining({
              name: 'Test Webhook'
            }),
            expect.objectContaining({
              'Authorization': `Bot ${mockConfig.botToken}`
            })
          );
        });

        it('should create webhook with avatar', async () => {
          const avatarData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

          mockHttpClient.post.mockResolvedValueOnce({
            id: '1234567890123456789',
            name: 'Test Webhook',
            avatar: 'avatar-hash'
          });

          await discordIntegration.createWebhook('987654321098765432', 'Test Webhook', avatarData);

          expect(mockHttpClient.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              name: 'Test Webhook',
              avatar: avatarData
            }),
            expect.any(Object)
          );
        });

        it('should throw DiscordIntegrationError on failure', async () => {
          mockHttpClient.post.mockRejectedValueOnce(new Error('Webhook creation failed'));

          await expect(discordIntegration.createWebhook('987654321098765432', 'Test Webhook')).rejects.toThrow(DiscordIntegrationError);
        });
      });

      describe('executeWebhook', () => {
        it('should execute webhook successfully', async () => {
          const mockResponse = {
            id: '1234567890123456789',
            channel_id: '987654321098765432',
            timestamp: new Date().toISOString(),
            content: 'Webhook message'
          };

          mockHttpClient.post.mockResolvedValueOnce(mockResponse);

          const result = await discordIntegration.executeWebhook('webhook-id', 'webhook-token', {
            content: 'Webhook message',
            username: 'Custom Bot'
          });

          expect(result.success).toBe(true);
          expect(result.messageId).toBe('1234567890123456789');
          expect(mockHttpClient.post).toHaveBeenCalledWith(
            'https://discord.com/api/v10/webhooks/webhook-id/webhook-token?wait=true',
            expect.objectContaining({
              content: 'Webhook message',
              username: 'Custom Bot'
            }),
            expect.objectContaining({
              'Content-Type': 'application/json'
            })
          );
        });

        it('should execute webhook with embeds and components', async () => {
          const webhookParams = {
            content: 'Webhook with extras',
            embeds: [{
              title: 'Webhook Embed',
              description: 'This is from a webhook',
              color: 0xff0000
            }],
            components: [{
              type: 1 as const, // Action Row
              components: [{
                type: 2 as const, // Button
                style: 2 as const, // Secondary
                label: 'Webhook Button',
                customId: 'webhook_button'
              }]
            }]
          };

          mockHttpClient.post.mockResolvedValueOnce({
            id: '1234567890123456789',
            timestamp: new Date().toISOString()
          });

          const result = await discordIntegration.executeWebhook('webhook-id', 'webhook-token', webhookParams);

          expect(result.success).toBe(true);
          expect(mockHttpClient.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
              content: 'Webhook with extras',
              embeds: expect.arrayContaining([
                expect.objectContaining({
                  title: 'Webhook Embed',
                  description: 'This is from a webhook',
                  color: 0xff0000
                })
              ]),
              components: expect.arrayContaining([
                expect.objectContaining({
                  type: 1,
                  components: expect.arrayContaining([
                    expect.objectContaining({
                      type: 2,
                      style: 2,
                      label: 'Webhook Button',
                      custom_id: 'webhook_button'
                    })
                  ])
                })
              ])
            }),
            expect.any(Object)
          );
        });

        it('should handle webhook execution errors', async () => {
          mockHttpClient.post.mockRejectedValueOnce(new Error('Webhook execution failed'));

          const result = await discordIntegration.executeWebhook('webhook-id', 'webhook-token', {
            content: 'Test message'
          });

          expect(result.success).toBe(false);
          expect(result.error).toBe('Webhook execution failed');
        });
      });
    });

    describe('getGuildMembers', () => {
      it('should retrieve guild members successfully', async () => {
        const mockMembers = [
          {
            user: {
              id: '987654321098765432',
              username: 'testuser',
              discriminator: '1234',
              avatar: 'user-avatar-hash',
              bot: false
            },
            nick: 'Test User',
            roles: ['role1', 'role2'],
            joined_at: '2023-01-01T00:00:00.000Z',
            deaf: false,
            mute: false,
            flags: 0
          }
        ];

        mockHttpClient.get.mockResolvedValueOnce(mockMembers);

        const result = await discordIntegration.getGuildMembers('123456789012345678');

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          user: {
            id: '987654321098765432',
            username: 'testuser',
            discriminator: '1234',
            avatar: 'user-avatar-hash',
            bot: false
          },
          nick: 'Test User',
          roles: ['role1', 'role2'],
          deaf: false,
          mute: false,
          flags: 0
        });
        expect(result[0].joinedAt).toBeInstanceOf(Date);
      });

      it('should handle pagination options', async () => {
        mockHttpClient.get.mockResolvedValueOnce([]);

        await discordIntegration.getGuildMembers('123456789012345678', {
          limit: 100,
          after: '987654321098765432'
        });

        expect(mockHttpClient.get).toHaveBeenCalledWith(
          'https://discord.com/api/v10/guilds/123456789012345678/members?limit=100&after=987654321098765432',
          expect.objectContaining({
            'Authorization': `Bot ${mockConfig.botToken}`
          })
        );
      });

      it('should throw DiscordIntegrationError on failure', async () => {
        mockHttpClient.get.mockRejectedValueOnce(new Error('Members not found'));

        await expect(discordIntegration.getGuildMembers('123456789012345678')).rejects.toThrow(DiscordIntegrationError);
      });
    });

    describe('sendNotification (Legacy Support)', () => {
      it('should send notification using existing Discord utility', async () => {
        const { notifyDiscord } = await import('../../../../agents/shared/notifications/utils/discordUtils');

        const result = await discordIntegration.sendNotification('Test notification', 'info');

        expect(result).toBe(true);
        expect(notifyDiscord).toHaveBeenCalledWith('Test notification', 'info', undefined);
      });

      it('should send notification with mention', async () => {
        const { notifyDiscord } = await import('../../../../agents/shared/notifications/utils/discordUtils');

        const result = await discordIntegration.sendNotification('Test notification', 'warning', '@here');

        expect(result).toBe(true);
        expect(notifyDiscord).toHaveBeenCalledWith('Test notification', 'warning', '@here');
      });

      it('should handle notification errors gracefully', async () => {
        const { notifyDiscord } = await import('../../../../agents/shared/notifications/utils/discordUtils');
        (notifyDiscord as any).mockRejectedValueOnce(new Error('Notification failed'));

        const result = await discordIntegration.sendNotification('Test notification');

        expect(result).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors properly', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('401 Unauthorized'));

      await expect(discordIntegration.initialize()).rejects.toThrow(DiscordAuthenticationError);
    });

    it('should handle permission errors', async () => {
      mockHttpClient.post.mockRejectedValueOnce(new Error('403 Forbidden'));

      const result = await discordIntegration.sendMessage({
        channelId: '987654321098765432',
        content: 'Test message'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('403');
    });

    it('should handle rate limiting with retry-after', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Map([['retry-after', '5']])
      };

      mockFetch.mockResolvedValueOnce(rateLimitResponse as any);

      await expect(discordIntegration.sendMessage({
        channelId: '987654321098765432',
        content: 'Test message'
      })).rejects.toThrow(DiscordRateLimitError);
    });

    it('should handle network timeouts', async () => {
      mockHttpClient.get.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      await expect(discordIntegration.testConnection()).resolves.toBe(false);
    });
  });

  describe('Data Mapping', () => {
    beforeEach(async () => {
      // Mock successful initialization
      mockHttpClient.get.mockResolvedValueOnce({
        id: '198622483471925248',
        username: 'TestBot',
        bot: true
      });

      await discordIntegration.initialize();
    });

    it('should map guild data correctly', async () => {
      const mockApiGuild = {
        id: '123456789012345678',
        name: 'Test Guild',
        icon: 'guild-icon-hash',
        splash: 'splash-hash',
        owner_id: '987654321098765432',
        afk_channel_id: '111111111111111111',
        afk_timeout: 300,
        verification_level: 2,
        default_message_notifications: 0,
        explicit_content_filter: 1,
        roles: [],
        emojis: [],
        features: ['COMMUNITY', 'NEWS'],
        mfa_level: 1,
        system_channel_id: '222222222222222222',
        system_channel_flags: 0,
        premium_tier: 2,
        preferred_locale: 'en-US',
        nsfw_level: 0,
        premium_progress_bar_enabled: true
      };

      mockHttpClient.get.mockResolvedValueOnce(mockApiGuild);

      const result = await discordIntegration.getGuild('123456789012345678');

      expect(result).toMatchObject({
        id: '123456789012345678',
        name: 'Test Guild',
        icon: 'guild-icon-hash',
        splash: 'splash-hash',
        ownerId: '987654321098765432',
        afkChannelId: '111111111111111111',
        afkTimeout: 300,
        verificationLevel: 2,
        defaultMessageNotifications: 0,
        explicitContentFilter: 1,
        features: ['COMMUNITY', 'NEWS'],
        mfaLevel: 1,
        systemChannelId: '222222222222222222',
        systemChannelFlags: 0,
        premiumTier: 2,
        preferredLocale: 'en-US',
        nsfwLevel: 0,
        premiumProgressBarEnabled: true
      });
    });

    it('should handle missing optional fields gracefully', async () => {
      const mockApiGuild = {
        id: '123456789012345678',
        name: 'Minimal Guild',
        owner_id: '987654321098765432',
        afk_timeout: 300,
        verification_level: 0,
        default_message_notifications: 0,
        explicit_content_filter: 0,
        roles: [],
        emojis: [],
        features: [],
        mfa_level: 0,
        system_channel_flags: 0,
        premium_tier: 0,
        preferred_locale: 'en-US',
        nsfw_level: 0,
        premium_progress_bar_enabled: false
        // Missing optional fields
      };

      mockHttpClient.get.mockResolvedValueOnce(mockApiGuild);

      const result = await discordIntegration.getGuild('123456789012345678');

      expect(result).toMatchObject({
        id: '123456789012345678',
        name: 'Minimal Guild',
        ownerId: '987654321098765432',
        verificationLevel: 0,
        defaultMessageNotifications: 0,
        explicitContentFilter: 0,
        features: [],
        mfaLevel: 0,
        premiumTier: 0,
        preferredLocale: 'en-US',
        nsfwLevel: 0,
        premiumProgressBarEnabled: false
      });
      expect(result.icon).toBeUndefined();
      expect(result.splash).toBeUndefined();
      expect(result.afkChannelId).toBeUndefined();
    });
  });
}); 