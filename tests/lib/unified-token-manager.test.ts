import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { UnifiedTokenManager, OAuthTokenData } from '../../src/lib/security/unified-token-manager';
import { logger } from '../../src/lib/logging';

// Mock dependencies
vi.mock('../../src/lib/logging');
vi.mock('../../src/lib/core/unified-config', () => ({
  unifiedConfig: {
    loadConfig: vi.fn().mockResolvedValue(undefined),
  },
  getServiceConfig: vi.fn((service) => {
    if (service === 'security') {
      return { encryptionKey: 'test-encryption-key-32-characters-long' };
    }
    if (service === 'oauth') {
      return {
        tokenRefreshBuffer: 7200, // 2 hours (updated from 5 minutes)
        maxRetries: 3
      };
    }
    return {};
  }),
}));

describe('UnifiedTokenManager', () => {
  let tokenManager: UnifiedTokenManager;
  let mockDatabaseService: Mock;
  let mockConnectionStatus: Mock;

  const mockConnections = [
    {
      id: 'conn-1',
      provider: 'GOOGLE_WORKSPACE',
      email: 'user1@example.com',
      refreshToken: 'refresh-token-1',
      accessToken: 'access-token-1',
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now - within 2 hour buffer
      scopes: 'email profile',
    },
    {
      id: 'conn-2',
      provider: 'GOOGLE_WORKSPACE',
      email: 'user2@example.com',
      refreshToken: 'refresh-token-2',
      accessToken: 'access-token-2',
      tokenExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now - beyond 2 hour buffer
      scopes: 'email profile',
    },
    {
      id: 'conn-3',
      provider: 'ZOHO_WORKSPACE',
      email: 'user3@example.com',
      refreshToken: 'refresh-token-3',
      accessToken: 'access-token-3',
      tokenExpiresAt: new Date(Date.now() + 90 * 60 * 1000), // 90 minutes from now - within 2 hour buffer
      scopes: 'email profile',
    },
    {
      id: 'conn-4',
      provider: 'GOOGLE_WORKSPACE',
      email: 'user4@example.com',
      refreshToken: null, // No refresh token
      accessToken: 'access-token-4',
      tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scopes: 'email profile',
    },
    {
      id: 'conn-5',
      provider: 'GOOGLE_WORKSPACE',
      email: 'user5@example.com',
      refreshToken: 'refresh-token-5',
      accessToken: 'access-token-5',
      tokenExpiresAt: null, // No expiry date
      scopes: 'email profile',
    },
  ];

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock DatabaseService and ConnectionStatus dynamically
    mockDatabaseService = {
      getInstance: vi.fn().mockReturnValue({
        findWorkspaceConnections: vi.fn().mockResolvedValue(mockConnections.filter(c => c.refreshToken && c.tokenExpiresAt)),
      }),
    };

    mockConnectionStatus = {
      ACTIVE: 'ACTIVE',
    };

    // Mock dynamic imports
    vi.doMock('../../src/services/database/DatabaseService', () => ({
      DatabaseService: mockDatabaseService,
    }));

    vi.doMock('../../src/services/database/types', () => ({
      ConnectionStatus: mockConnectionStatus,
    }));

    // Get fresh instance
    tokenManager = UnifiedTokenManager.getInstance();

    // Register a mock refresh callback
    tokenManager.registerRefreshCallback('google-workspace', async (refreshToken, provider, connectionId) => {
      return {
        accessToken: 'new-access-token',
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scopes: ['email', 'profile'],
      };
    });

    tokenManager.registerRefreshCallback('zoho-workspace', async (refreshToken, provider, connectionId) => {
      return {
        accessToken: 'new-zoho-access-token',
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scopes: ['email', 'profile'],
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    tokenManager.destroy();
  });

  describe('Startup Recovery', () => {
    it('should recover existing connections successfully', async () => {
      const validConnections = mockConnections.filter(c => c.refreshToken && c.tokenExpiresAt);
      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue(validConnections);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith('Starting token recovery for existing connections...');
      expect(logger.info).toHaveBeenCalledWith(
        'Token recovery completed',
        expect.objectContaining({
          totalConnections: validConnections.length,
          recoveredCount: validConnections.length,
        })
      );
    });

    it('should handle connections expiring within 2 hours', async () => {
      const soonExpiringConnection = {
        id: 'conn-soon',
        provider: 'GOOGLE_WORKSPACE',
        email: 'soon@example.com',
        refreshToken: 'refresh-token-soon',
        accessToken: 'access-token-soon',
        tokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        scopes: 'email profile',
      };

      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue([soonExpiringConnection]);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith(
        'Token expires soon, scheduling immediate refresh',
        expect.objectContaining({
          connectionId: 'conn-soon',
          provider: 'google-workspace',
          email: 'soon@example.com',
        })
      );
    });

    it('should skip connections without refresh tokens', async () => {
      const connectionWithoutRefreshToken = {
        id: 'conn-no-refresh',
        provider: 'GOOGLE_WORKSPACE',
        email: 'norefresh@example.com',
        refreshToken: null,
        accessToken: 'access-token',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: 'email profile',
      };

      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue([connectionWithoutRefreshToken]);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith(
        'Token recovery completed',
        expect.objectContaining({
          recoveredCount: 0,
          totalConnections: 1,
        })
      );
    });

    it('should skip connections without expiry dates', async () => {
      const connectionWithoutExpiry = {
        id: 'conn-no-expiry',
        provider: 'GOOGLE_WORKSPACE',
        email: 'noexpiry@example.com',
        refreshToken: 'refresh-token',
        accessToken: 'access-token',
        tokenExpiresAt: null,
        scopes: 'email profile',
      };

      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue([connectionWithoutExpiry]);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith(
        'Token recovery completed',
        expect.objectContaining({
          recoveredCount: 0,
          totalConnections: 1,
        })
      );
    });

    it('should not run recovery multiple times', async () => {
      await tokenManager.recoverExistingConnections();
      await tokenManager.recoverExistingConnections(); // Second call

      expect(logger.debug).toHaveBeenCalledWith('Startup token recovery already completed, skipping');
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseService.getInstance().findWorkspaceConnections.mockRejectedValue(
        new Error('Database connection failed')
      );

      await tokenManager.recoverExistingConnections();

      expect(logger.error).toHaveBeenCalledWith(
        'Token recovery failed',
        expect.objectContaining({
          error: 'Database connection failed',
        })
      );
    });

    it('should handle individual connection errors gracefully', async () => {
      // Create a connection that will cause an error during processing
      const problematicConnection = {
        id: 'conn-problem',
        provider: 'INVALID_PROVIDER', // This will cause getProviderKey to return an unknown provider
        email: 'problem@example.com',
        refreshToken: 'refresh-token',
        accessToken: 'access-token',
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: 'email profile',
      };

      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue([problematicConnection]);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith(
        'Token recovery completed',
        expect.objectContaining({
          errorCount: 0, // Should handle gracefully without errors
          recoveredCount: 1,
        })
      );
    });
  });

  describe('Provider Key Mapping', () => {
    it('should map provider enums correctly', async () => {
      const connections = [
        {
          id: 'google',
          provider: 'GOOGLE_WORKSPACE',
          email: 'test@gmail.com',
          refreshToken: 'token',
          accessToken: 'access',
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          scopes: 'email'
        },
        {
          id: 'zoho',
          provider: 'ZOHO_WORKSPACE',
          email: 'test@zoho.com',
          refreshToken: 'token',
          accessToken: 'access',
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          scopes: 'email'
        },
        {
          id: 'office',
          provider: 'MICROSOFT_OFFICE',
          email: 'test@outlook.com',
          refreshToken: 'token',
          accessToken: 'access',
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          scopes: 'email'
        },
      ];

      mockDatabaseService.getInstance().findWorkspaceConnections.mockResolvedValue(connections);

      await tokenManager.recoverExistingConnections();

      expect(logger.info).toHaveBeenCalledWith(
        'Token recovery completed',
        expect.objectContaining({
          recoveredCount: 3,
        })
      );
    });
  });

  describe('Token Refresh Scheduling', () => {
    it('should schedule token refresh correctly', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        scopes: ['email', 'profile'],
      };

      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);

      expect(logger.debug).toHaveBeenCalledWith(
        'Token refresh scheduled',
        expect.objectContaining({
          provider: 'google-workspace',
          connectionId: 'conn-test',
        })
      );
    });

    it('should not schedule refresh without expiry date', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        // No expiresAt
        scopes: ['email', 'profile'],
      };

      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Token refresh scheduled',
        expect.any(Object)
      );
    });

    it('should not schedule refresh without refresh token', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        // No refreshToken
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Token refresh scheduled',
        expect.any(Object)
      );
    });

    it('should replace existing scheduled refresh', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      // Schedule first refresh
      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);

      // Schedule second refresh (should replace first)
      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);

      expect(logger.debug).toHaveBeenCalledTimes(2);
    });

    it('should cancel scheduled refresh', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-test', tokenData);
      tokenManager.cancelTokenRefresh('google-workspace', 'conn-test');

      expect(logger.debug).toHaveBeenCalledWith(
        'Token refresh cancelled',
        expect.objectContaining({
          provider: 'google-workspace',
          connectionId: 'conn-test',
        })
      );
    });
  });

  describe('Token Expiry Checks', () => {
    it('should detect expired tokens', () => {
      const expiredTokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 minute ago
        scopes: ['email', 'profile'],
      };

      const isExpired = tokenManager.isTokenExpired(expiredTokenData);
      expect(isExpired).toBe(true);
    });

    it('should detect tokens expiring within buffer', () => {
      const soonExpiringTokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
        scopes: ['email', 'profile'],
      };

      // Default buffer is 5 minutes (300 seconds)
      const isExpired = tokenManager.isTokenExpired(soonExpiringTokenData);
      expect(isExpired).toBe(true);
    });

    it('should not detect valid tokens as expired', () => {
      const validTokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        scopes: ['email', 'profile'],
      };

      const isExpired = tokenManager.isTokenExpired(validTokenData);
      expect(isExpired).toBe(false);
    });

    it('should use custom buffer for expiry check', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        scopes: ['email', 'profile'],
      };

      // With 60 minute buffer, token should be considered expired
      const isExpired = tokenManager.isTokenExpired(tokenData, 60 * 60);
      expect(isExpired).toBe(true);

      // With 10 minute buffer, token should not be considered expired
      const isNotExpired = tokenManager.isTokenExpired(tokenData, 10 * 60);
      expect(isNotExpired).toBe(false);
    });

    it('should handle tokens without expiry date', () => {
      const tokenDataWithoutExpiry: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        // No expiresAt
        scopes: ['email', 'profile'],
      };

      const isExpired = tokenManager.isTokenExpired(tokenDataWithoutExpiry);
      expect(isExpired).toBe(false);
    });
  });

  describe('Token Refresh Execution', () => {
    it('should refresh tokens successfully', async () => {
      const currentTokenData: OAuthTokenData = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        scopes: ['email', 'profile'],
      };

      const refreshedTokens = await tokenManager.refreshTokens(
        'google-workspace',
        'conn-test',
        currentTokenData
      );

      expect(refreshedTokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'refresh-token',
        expiresAt: expect.any(Date),
        scopes: ['email', 'profile'],
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Refreshing tokens',
        expect.objectContaining({
          provider: 'google-workspace',
          connectionId: 'conn-test',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Tokens refreshed successfully',
        expect.objectContaining({
          provider: 'google-workspace',
          connectionId: 'conn-test',
        })
      );
    });

    it('should handle refresh failure', async () => {
      // Register a failing refresh callback
      tokenManager.registerRefreshCallback('failing-provider', async () => {
        throw new Error('Refresh failed');
      });

      const currentTokenData: OAuthTokenData = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      await expect(
        tokenManager.refreshTokens('failing-provider', 'conn-test', currentTokenData)
      ).rejects.toThrow('Failed to refresh tokens');
    });

    it('should handle missing refresh callback', async () => {
      const currentTokenData: OAuthTokenData = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      await expect(
        tokenManager.refreshTokens('unknown-provider', 'conn-test', currentTokenData)
      ).rejects.toThrow('No refresh callback registered for provider: unknown-provider');
    });

    it('should handle missing refresh token', async () => {
      const currentTokenData: OAuthTokenData = {
        accessToken: 'old-access-token',
        // No refreshToken
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      await expect(
        tokenManager.refreshTokens('google-workspace', 'conn-test', currentTokenData)
      ).rejects.toThrow('No refresh token available');
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const tokenData: OAuthTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        scopes: ['email', 'profile'],
      };

      // Schedule some refreshes
      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-1', tokenData);
      tokenManager.scheduleTokenRefresh('google-workspace', 'conn-2', tokenData);

      tokenManager.destroy();

      expect(logger.info).toHaveBeenCalledWith('Unified token manager destroyed');
    });
  });
});

describe('UnifiedTokenManager Startup Recovery', () => {
  let tokenManager: UnifiedTokenManager;

  beforeEach(() => {
    tokenManager = UnifiedTokenManager.getInstance();
  });

  afterEach(() => {
    tokenManager.destroy();
  });

  it('should exist', () => {
    expect(tokenManager).toBeDefined();
  });
}); 