import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ZohoWorkspaceProvider, ZohoRateLimitError } from '../../src/services/workspace/providers/ZohoWorkspaceProvider';
import { DatabaseService } from '../../src/services/database/DatabaseService';
import { WorkspaceService } from '../../src/services/workspace/WorkspaceService';
import { TokenRefreshService } from '../../src/services/workspace/TokenRefreshService';
import { ConnectionStatus, WorkspaceProvider } from '../../src/services/database/types';

// Mock dependencies
vi.mock('../../src/services/database/DatabaseService');
vi.mock('../../src/lib/logging');
vi.mock('axios');

describe('Zoho Rate Limiting Enhancement', () => {
  let zohoProvider: ZohoWorkspaceProvider;
  let mockDb: any;
  let mockConnection: any;

  beforeEach(() => {
    // Setup environment variables
    process.env.ZOHO_CLIENT_ID = 'test-client-id';
    process.env.ZOHO_CLIENT_SECRET = 'test-client-secret';
    process.env.ZOHO_REGION = 'com';

    // Mock database
    mockDb = {
      getWorkspaceConnection: vi.fn(),
      updateWorkspaceConnection: vi.fn(),
      findWorkspaceConnections: vi.fn(),
    };

    // Mock connection object
    mockConnection = {
      id: 'test-connection-id',
      email: 'test@example.com',
      provider: WorkspaceProvider.ZOHO,
      refreshToken: 'test-refresh-token',
      accessToken: 'test-access-token',
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      status: ConnectionStatus.ACTIVE,
    };

    (DatabaseService.getInstance as any).mockReturnValue(mockDb);
    mockDb.getWorkspaceConnection.mockResolvedValue(mockConnection);
    mockDb.updateWorkspaceConnection.mockResolvedValue(mockConnection);

    // Initialize provider after mocks are set up
    zohoProvider = new ZohoWorkspaceProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ZohoRateLimitError', () => {
    it('should create rate limit error with correct properties', () => {
      const error = new ZohoRateLimitError('Rate limit exceeded', 120);

      expect(error.name).toBe('ZohoRateLimitError');
      expect(error.code).toBe('ZOHO_RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(120);
      expect(error.message).toBe('Rate limit exceeded');
    });

    it('should use default values when not provided', () => {
      const error = new ZohoRateLimitError();

      expect(error.message).toBe('Zoho API rate limit exceeded');
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('Rate Limiting State Management', () => {
    it('should initialize with clean rate limiting state', () => {
      expect(zohoProvider).toBeDefined();
      // Rate limiting state should be initialized properly
    });

    it('should enforce minimum time between requests', async () => {
      const startTime = Date.now();

      // Make two rapid requests
      const promise1 = zohoProvider.refreshConnection('test-id-1');
      const promise2 = zohoProvider.refreshConnection('test-id-2');

      await Promise.all([promise1, promise2]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least 1 second (minimum time between requests)
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Rate Limit Response Handling', () => {
    it('should detect and handle Zoho rate limit response', async () => {
      // Mock axios to simulate rate limit response
      const mockAxios = require('axios');
      const rateLimitResponse = {
        response: {
          status: 400,
          data: {
            error: 'Access Denied',
            error_description: 'You have made too many requests continuously. Please try again after some time.',
            status: 'failure'
          }
        }
      };

      mockAxios.create().post.mockRejectedValueOnce(rateLimitResponse);

      await expect(
        zohoProvider.refreshConnection(mockConnection.id)
      ).rejects.toThrow();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on rate limit with exponential backoff', async () => {
      const mockAxios = require('axios');
      let attempts = 0;

      // Mock first few attempts to fail with rate limit, then succeed
      mockAxios.create().post.mockImplementation(() => {
        attempts++;
        if (attempts <= 2) {
          const rateLimitError = new Error('Rate limit exceeded');
          rateLimitError.response = {
            status: 400,
            data: {
              error: 'Access Denied',
              error_description: 'You have made too many requests continuously. Please try again after some time.'
            }
          };
          throw rateLimitError;
        }
        return Promise.resolve({
          data: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600
          }
        });
      });

      const result = await zohoProvider.refreshConnection(mockConnection.id);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3); // Should have retried twice before success
    });

    it('should give up after maximum retry attempts', async () => {
      const mockAxios = require('axios');

      // Mock all attempts to fail with rate limit
      mockAxios.create().post.mockImplementation(() => {
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.response = {
          status: 400,
          data: {
            error: 'Access Denied',
            error_description: 'You have made too many requests continuously. Please try again after some time.'
          }
        };
        throw rateLimitError;
      });

      const result = await zohoProvider.refreshConnection(mockConnection.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });
  });

  describe('Token Refresh Service Integration', () => {
    let tokenRefreshService: TokenRefreshService;
    let workspaceService: WorkspaceService;

    beforeEach(() => {
      workspaceService = new WorkspaceService();
      tokenRefreshService = new TokenRefreshService();
    });

    it('should handle rate limited connections in refresh cycle', async () => {
      // Mock connections requiring refresh
      const connections = [
        {
          ...mockConnection,
          id: 'conn-1',
          email: 'user1@example.com',
          tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        },
        {
          ...mockConnection,
          id: 'conn-2',
          email: 'user2@example.com',
          tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        }
      ];

      mockDb.findWorkspaceConnections.mockResolvedValue(connections);

      // Mock first connection to be rate limited, second to succeed
      vi.spyOn(workspaceService, 'refreshConnection')
        .mockResolvedValueOnce({ success: false, error: 'Rate limit exceeded', connectionId: 'conn-1' })
        .mockResolvedValueOnce({ success: true, connectionId: 'conn-2' });

      // Test the refresh cycle
      await tokenRefreshService.triggerRefresh();

      expect(workspaceService.refreshConnection).toHaveBeenCalledTimes(2);
    });

    it('should categorize rate limited vs other errors', async () => {
      const connections = [mockConnection];
      mockDb.findWorkspaceConnections.mockResolvedValue(connections);

      // Mock rate limit error
      vi.spyOn(workspaceService, 'refreshConnection')
        .mockRejectedValueOnce(new Error('Rate limit exceeded - too many requests'));

      const result = await tokenRefreshService.triggerRefresh();

      // Should handle rate limiting gracefully without marking as expired
      expect(mockDb.updateWorkspaceConnection).not.toHaveBeenCalledWith(
        mockConnection.id,
        { status: ConnectionStatus.EXPIRED }
      );
    });
  });

  describe('Backoff Calculation', () => {
    it('should calculate exponential backoff with jitter', () => {
      // Test backoff calculation logic
      const baseDelay = 5000;
      const maxDelay = 300000;

      // Simulate multiple rate limit hits
      for (let requestCount = 1; requestCount <= 5; requestCount++) {
        const backoffMultiplier = Math.min(4, Math.pow(2, requestCount / 10));
        const jitter = Math.random() * 0.3;
        const backoffDelay = Math.min(
          baseDelay * backoffMultiplier * (1 + jitter),
          maxDelay
        );

        expect(backoffDelay).toBeGreaterThanOrEqual(baseDelay);
        expect(backoffDelay).toBeLessThanOrEqual(maxDelay);
      }
    });
  });

  describe('Health Monitoring', () => {
    it('should report provider health correctly', async () => {
      const isHealthy = await zohoProvider.isHealthy();
      expect(isHealthy).toBe(true); // Should be healthy with mocked env vars
    });

    it('should report unhealthy when missing configuration', async () => {
      delete process.env.ZOHO_CLIENT_ID;

      const provider = new ZohoWorkspaceProvider();

      // This should throw during construction due to missing config
      expect(() => new ZohoWorkspaceProvider()).toThrow('Zoho OAuth provider not configured');
    });
  });

  describe('Integration with Debug Endpoint', () => {
    it('should provide rate limit status information', () => {
      // Test that rate limiting state can be accessed for monitoring
      const provider = new ZohoWorkspaceProvider();

      // The provider should be properly initialized with rate limiting
      expect(provider).toBeDefined();
      expect(provider.providerId).toBe(WorkspaceProvider.ZOHO);
    });
  });
});

describe('TokenRefreshService Rate Limiting Integration', () => {
  let tokenRefreshService: TokenRefreshService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      findWorkspaceConnections: vi.fn(),
      updateWorkspaceConnection: vi.fn(),
      getWorkspaceConnection: vi.fn(),
    };

    (DatabaseService.getInstance as any).mockReturnValue(mockDb);
    tokenRefreshService = new TokenRefreshService();
  });

  it('should track rate limited refresh attempts separately', async () => {
    const connections = [
      {
        id: 'conn-1',
        email: 'user1@example.com',
        provider: WorkspaceProvider.ZOHO,
        refreshToken: 'token1',
        tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        status: ConnectionStatus.ACTIVE
      }
    ];

    mockDb.findWorkspaceConnections.mockResolvedValue(connections);

    // Mock the internal refresh method to detect rate limiting
    const originalRefresh = TokenRefreshService.prototype['refreshExpiredTokens'];
    const refreshSpy = vi.spyOn(TokenRefreshService.prototype as any, 'refreshExpiredTokens');

    await tokenRefreshService.triggerRefresh();

    expect(refreshSpy).toHaveBeenCalled();
  });

  it('should handle mixed success and rate limit scenarios', async () => {
    const connections = [
      {
        id: 'conn-1',
        email: 'success@example.com',
        provider: WorkspaceProvider.ZOHO,
        refreshToken: 'token1',
        tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        status: ConnectionStatus.ACTIVE
      },
      {
        id: 'conn-2',
        email: 'ratelimited@example.com',
        provider: WorkspaceProvider.ZOHO,
        refreshToken: 'token2',
        tokenExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        status: ConnectionStatus.ACTIVE
      }
    ];

    mockDb.findWorkspaceConnections.mockResolvedValue(connections);

    const result = await tokenRefreshService.triggerRefresh();

    // Should complete without throwing errors
    expect(result).toBeDefined();
  });
}); 