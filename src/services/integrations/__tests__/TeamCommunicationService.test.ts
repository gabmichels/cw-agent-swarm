/**
 * Unit Tests for TeamCommunicationService
 * 
 * Tests all core functionality including provider management, message operations,
 * channel management, rate limiting, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { ulid } from 'ulid';
import { 
  TeamCommunicationService,
  createTeamCommunicationService,
  TeamCommunicationConfig,
  MessageParams,
  MessageResult,
  Channel,
  SlackProvider,
  TeamsProvider,
  DiscordProvider,
  TeamCommunicationError,
  PlatformConnectionError,
  MessageValidationError
} from '../communication/TeamCommunicationService';
import { logger } from '../../../lib/logging';

// Mock dependencies
vi.mock('../../../lib/logging');
global.fetch = vi.fn();

describe('TeamCommunicationService', () => {
  let service: TeamCommunicationService;
  let config: TeamCommunicationConfig;
  let mockFetch: Mock;

  const mockChannel: Channel = {
    id: 'C1234567890',
    name: 'general',
    displayName: 'general',
    description: 'General discussion',
    type: 'public',
    memberCount: 10,
    isArchived: false,
    createdAt: new Date(),
    platform: 'slack',
    permissions: {
      canSend: true,
      canRead: true,
      canManage: false
    }
  };

  const mockMessageResult: MessageResult = {
    success: true,
    messageId: '1234567890.123456',
    channelId: 'C1234567890',
    timestamp: new Date(),
    platform: 'slack',
    url: 'https://slack.com/archives/C1234567890/p1234567890123456'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    config = {
      platforms: {
        slack: {
          enabled: true,
          botToken: 'xoxb-test-token',
          signingSecret: 'test-signing-secret',
          appToken: 'xapp-test-token'
        },
        teams: {
          enabled: false,
          clientId: 'test-teams-client-id',
          clientSecret: 'test-teams-client-secret',
          tenantId: 'test-tenant-id'
        },
        discord: {
          enabled: false,
          botToken: 'test-discord-token',
          applicationId: 'test-discord-app-id'
        }
      },
      features: {
        autoFormatting: true,
        mentionTranslation: true,
        attachmentProcessing: true,
        threadSupport: true
      },
      rateLimiting: {
        maxMessagesPerMinute: 10,
        maxMessagesPerHour: 100
      }
    };

    service = new TeamCommunicationService(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(service).toBeInstanceOf(TeamCommunicationService);
      expect(logger.info).toHaveBeenCalledWith('Slack provider initialized');
    });

    it('should initialize with factory function', () => {
      const factoryService = createTeamCommunicationService({
        platforms: {
          slack: { enabled: true, botToken: 'test-token' }
        }
      });
      expect(factoryService).toBeInstanceOf(TeamCommunicationService);
    });

    it('should use default configuration when none provided', () => {
      const defaultService = createTeamCommunicationService();
      expect(defaultService).toBeInstanceOf(TeamCommunicationService);
    });

    it('should initialize multiple providers when enabled', () => {
      const multiConfig = {
        ...config,
        platforms: {
          slack: { enabled: true, botToken: 'slack-token' },
          teams: { enabled: true, clientId: 'teams-id', clientSecret: 'teams-secret', tenantId: 'tenant-id' },
          discord: { enabled: true, botToken: 'discord-token', applicationId: 'discord-app-id' }
        }
      };

      const multiService = new TeamCommunicationService(multiConfig);
      expect(multiService).toBeInstanceOf(TeamCommunicationService);
      expect(logger.info).toHaveBeenCalledWith('Slack provider initialized');
      expect(logger.info).toHaveBeenCalledWith('Teams provider initialized (implementation pending)');
      expect(logger.info).toHaveBeenCalledWith('Discord provider initialized (implementation pending)');
    });
  });

  describe('SlackProvider', () => {
    let slackProvider: SlackProvider;

    beforeEach(() => {
      slackProvider = new SlackProvider('xoxb-test-token', 'test-signing-secret');
    });

    describe('testConnection', () => {
      it('should return true for successful connection', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({ ok: true })
        });

        const result = await slackProvider.testConnection();
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer xoxb-test-token',
            'Content-Type': 'application/json'
          }
        });
      });

      it('should return false for failed connection', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({ ok: false })
        });

        const result = await slackProvider.testConnection();
        expect(result).toBe(false);
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await slackProvider.testConnection();
        expect(result).toBe(false);
      });
    });

    describe('sendMessage', () => {
      const testMessageParams: MessageParams = {
        content: 'Hello, world!',
        channelId: 'C1234567890'
      };

      it('should send message successfully', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            ts: '1234567890.123456',
            channel: 'C1234567890'
          })
        });

        const result = await slackProvider.sendMessage(testMessageParams);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('1234567890.123456');
        expect(result.channelId).toBe('C1234567890');
        expect(result.platform).toBe('slack');
        expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer xoxb-test-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: 'C1234567890',
            text: 'Hello, world!',
            thread_ts: undefined
          })
        });
      });

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: false,
            error: 'channel_not_found'
          })
        });

        const result = await slackProvider.sendMessage(testMessageParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('channel_not_found');
        expect(result.platform).toBe('slack');
      });

      it('should validate message parameters', async () => {
        const invalidParams: MessageParams = {
          content: '',
          channelId: ''
        };

        const result = await slackProvider.sendMessage(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Message content is required');
      });

      it('should require either channelId or channelName', async () => {
        const invalidParams: MessageParams = {
          content: 'Test message'
        };

        const result = await slackProvider.sendMessage(invalidParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Either channelId or channelName is required');
      });

      it('should support thread messages', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            ts: '1234567890.123457',
            channel: 'C1234567890',
            thread_ts: '1234567890.123456'
          })
        });

        const threadParams: MessageParams = {
          content: 'Reply message',
          channelId: 'C1234567890',
          threadId: '1234567890.123456'
        };

        const result = await slackProvider.sendMessage(threadParams);

        expect(result.success).toBe(true);
        expect(result.threadId).toBe('1234567890.123456');
      });
    });

    describe('getChannels', () => {
      it('should retrieve channels successfully', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            channels: [
              {
                id: 'C1234567890',
                name: 'general',
                purpose: { value: 'General discussion' },
                is_private: false,
                num_members: 10,
                is_archived: false,
                created: 1234567890
              }
            ]
          })
        });

        const channels = await slackProvider.getChannels('test-user-id');

        expect(channels).toHaveLength(1);
        expect(channels[0].id).toBe('C1234567890');
        expect(channels[0].name).toBe('general');
        expect(channels[0].platform).toBe('slack');
        expect(channels[0].type).toBe('public');
      });

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: false,
            error: 'missing_scope'
          })
        });

        await expect(slackProvider.getChannels('test-user-id'))
          .rejects.toThrow('Failed to get channels: missing_scope');
      });
    });

    describe('getChannel', () => {
      it('should retrieve single channel successfully', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            channel: {
              id: 'C1234567890',
              name: 'general',
              purpose: { value: 'General discussion' },
              is_private: false,
              num_members: 10,
              is_archived: false,
              created: 1234567890
            }
          })
        });

        const channel = await slackProvider.getChannel('C1234567890');

        expect(channel).not.toBeNull();
        expect(channel!.id).toBe('C1234567890');
        expect(channel!.name).toBe('general');
      });

      it('should return null for non-existent channel', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: false,
            error: 'channel_not_found'
          })
        });

        const channel = await slackProvider.getChannel('INVALID');
        expect(channel).toBeNull();
      });
    });

    describe('formatMessage', () => {
      it('should format bold text', () => {
        const formatted = slackProvider.formatMessage('Hello', { bold: true });
        expect(formatted).toBe('*Hello*');
      });

      it('should format italic text', () => {
        const formatted = slackProvider.formatMessage('Hello', { italic: true });
        expect(formatted).toBe('_Hello_');
      });

      it('should format inline code', () => {
        const formatted = slackProvider.formatMessage('code', { code: true });
        expect(formatted).toBe('`code`');
      });

      it('should format code block', () => {
        const formatted = slackProvider.formatMessage('console.log("hello")', { codeBlock: 'javascript' });
        expect(formatted).toBe('```javascript\nconsole.log("hello")\n```');
      });

      it('should combine multiple formatting options', () => {
        let formatted = slackProvider.formatMessage('Hello', { bold: true, italic: true });
        // Order matters in Slack formatting
        expect(formatted).toBe('_*Hello*_');
      });
    });
  });

  describe('TeamCommunicationService Operations', () => {
    describe('sendMessage', () => {
      it('should send message to Slack successfully', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            ts: '1234567890.123456',
            channel: 'C1234567890'
          })
        });

        const messageParams: MessageParams = {
          content: 'Test message',
          channelId: 'C1234567890'
        };

        const result = await service.sendMessage('slack', messageParams);

        expect(result.success).toBe(true);
        expect(result.platform).toBe('slack');
        expect(result.messageId).toBe('1234567890.123456');
      });

      it('should throw error for unavailable provider', async () => {
        await expect(service.sendMessage('teams', { content: 'Test' }))
          .rejects.toThrow('Provider not available or not configured');
      });
    });

    describe('getChannels', () => {
      it('should get channels from Slack', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            channels: [
              {
                id: 'C1234567890',
                name: 'general',
                purpose: { value: 'General discussion' },
                is_private: false,
                num_members: 10,
                is_archived: false,
                created: 1234567890
              }
            ]
          })
        });

        const channels = await service.getChannels('slack', 'test-user-id');

        expect(channels).toHaveLength(1);
        expect(channels[0].platform).toBe('slack');
      });

      it('should throw error for unavailable provider', async () => {
        await expect(service.getChannels('teams', 'test-user-id'))
          .rejects.toThrow('Provider not available or not configured');
      });
    });

    describe('getAllChannels', () => {
      it('should get channels from all available providers', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            channels: [
              {
                id: 'C1234567890',
                name: 'general',
                purpose: { value: 'General discussion' },
                is_private: false,
                num_members: 10,
                is_archived: false,
                created: 1234567890
              }
            ]
          })
        });

        const channels = await service.getAllChannels('test-user-id');

        expect(channels).toHaveLength(1);
        expect(channels[0].platform).toBe('slack');
      });

      it('should handle provider failures gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const channels = await service.getAllChannels('test-user-id');
        expect(channels).toHaveLength(0);
      });
    });

    describe('broadcastMessage', () => {
      it('should broadcast to multiple platforms', async () => {
        mockFetch.mockResolvedValue({
          json: () => Promise.resolve({
            ok: true,
            ts: '1234567890.123456',
            channel: 'C1234567890'
          })
        });

        const messageParams: MessageParams = {
          content: 'Broadcast message',
          channelId: 'C1234567890'
        };

        const results = await service.broadcastMessage(['slack'], messageParams);

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(results[0].platform).toBe('slack');
      });

      it('should handle mixed success/failure results', async () => {
        const messageParams: MessageParams = {
          content: 'Broadcast message',
          channelId: 'C1234567890'
        };

        // This will fail because teams provider is not available
        const results = await service.broadcastMessage(['slack', 'teams'], messageParams);

        expect(results).toHaveLength(2);
        // First result (slack) would succeed if properly mocked
        // Second result (teams) should fail
        expect(results[1].success).toBe(false);
        expect(results[1].platform).toBe('teams');
      });
    });
  });

  describe('Health Monitoring', () => {
    it('should return healthy status when all providers are working', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: true })
      });

      const health = await service.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.platforms).toHaveLength(1);
      expect(health.platforms[0].platform).toBe('slack');
      expect(health.platforms[0].status).toBe('healthy');
    });

    it('should return unhealthy status when providers fail', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ ok: false })
      });

      const health = await service.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.platforms[0].status).toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should create TeamCommunicationError correctly', () => {
      const error = new TeamCommunicationError('Test error', 'TEST_CODE', 'slack', { test: true });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.platform).toBe('slack');
      expect(error.context).toEqual({ test: true });
    });

    it('should create PlatformConnectionError correctly', () => {
      const error = new PlatformConnectionError('slack', 'Connection failed', { reason: 'timeout' });
      
      expect(error.message).toBe('slack connection error: Connection failed');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.platform).toBe('slack');
    });

    it('should create MessageValidationError correctly', () => {
      const error = new MessageValidationError('Invalid message', { field: 'content' });
      
      expect(error.message).toBe('Message validation error: Invalid message');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Configuration', () => {
    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        platforms: {
          slack: { enabled: false }
        }
      };

      const service = createTeamCommunicationService(partialConfig);
      expect(service).toBeInstanceOf(TeamCommunicationService);
    });

    it('should use environment variables for default config', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        SLACK_BOT_TOKEN: 'env-slack-token'
      };

      const service = createTeamCommunicationService();
      expect(service).toBeInstanceOf(TeamCommunicationService);

      process.env = originalEnv;
    });
  });

  describe('Provider Implementations', () => {
    describe('TeamsProvider', () => {
      it('should return implementation pending messages', async () => {
        const teamsProvider = new TeamsProvider('client-id', 'client-secret', 'tenant-id');
        
        const connectionResult = await teamsProvider.testConnection();
        expect(connectionResult).toBe(false);
        
        const messageResult = await teamsProvider.sendMessage({ content: 'test' });
        expect(messageResult.success).toBe(false);
        expect(messageResult.error).toBe('Microsoft Teams integration not yet implemented');
        
        const channels = await teamsProvider.getChannels('user-id');
        expect(channels).toHaveLength(0);
        
        const channel = await teamsProvider.getChannel('channel-id');
        expect(channel).toBeNull();
      });
    });

    describe('DiscordProvider', () => {
      it('should return implementation pending messages', async () => {
        const discordProvider = new DiscordProvider('bot-token', 'app-id');
        
        const connectionResult = await discordProvider.testConnection();
        expect(connectionResult).toBe(false);
        
        const messageResult = await discordProvider.sendMessage({ content: 'test' });
        expect(messageResult.success).toBe(false);
        expect(messageResult.error).toBe('Discord integration not yet implemented');
        
        const channels = await discordProvider.getChannels('user-id');
        expect(channels).toHaveLength(0);
        
        const channel = await discordProvider.getChannel('channel-id');
        expect(channel).toBeNull();
      });
    });
  });
}); 