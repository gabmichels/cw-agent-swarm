/**
 * Unified Token Management System
 * 
 * Centralizes OAuth token handling, encryption, refresh logic, and lifecycle management
 * across all providers. Follows IMPLEMENTATION_GUIDELINES.md with strict typing,
 * dependency injection, and comprehensive error handling.
 */

import * as crypto from 'crypto';
import { getServiceConfig } from '../core/unified-config';
import { AppError } from '../errors/base';
import { createErrorContext, ErrorSeverity, handleAsync } from '../errors/standardized-handler';
import { logger } from '../logging';

/**
 * Token management error
 */
export class TokenError extends AppError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'TOKEN_ERROR', context);
    this.name = 'TokenError';
  }
}

/**
 * Token expiry error
 */
export class TokenExpiredError extends TokenError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, { ...context, expired: true });
    this.name = 'TokenExpiredError';
  }
}

/**
 * Token refresh error
 */
export class TokenRefreshError extends TokenError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, { ...context, refreshFailed: true });
    this.name = 'TokenRefreshError';
  }
}

/**
 * OAuth token data structure
 */
export interface OAuthTokenData {
  /** Access token for API calls */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string;
  /** Token expiry timestamp */
  expiresAt?: Date;
  /** Token expiry in seconds from creation */
  expiresIn?: number;
  /** Token type (usually 'Bearer') */
  tokenType?: string;
  /** Granted scopes */
  scopes?: string[];
  /** Token creation timestamp */
  createdAt?: Date;
  /** Token version for migration support */
  version?: string;
}

/**
 * Encrypted token storage format
 */
export interface EncryptedTokenData {
  /** Encrypted token JSON */
  encryptedData: string;
  /** Encryption metadata */
  metadata: {
    algorithm: string;
    version: string;
    createdAt: Date;
    salt: string;
    iv: string;
  };
}

/**
 * Token refresh configuration
 */
export interface TokenRefreshConfig {
  /** Buffer time before expiry to trigger refresh (seconds) */
  refreshBuffer: number;
  /** Maximum retry attempts for refresh */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

/**
 * Provider token refresh callback
 */
export type TokenRefreshCallback = (
  refreshToken: string,
  provider: string,
  connectionId: string
) => Promise<OAuthTokenData>;

/**
 * Token lifecycle event types
 */
export enum TokenEvent {
  CREATED = 'created',
  REFRESHED = 'refreshed',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  ERROR = 'error',
}

/**
 * Token lifecycle event
 */
export interface TokenLifecycleEvent {
  event: TokenEvent;
  provider: string;
  connectionId: string;
  tokenData?: Partial<OAuthTokenData>;
  error?: Error;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Token lifecycle listener
 */
export type TokenLifecycleListener = (event: TokenLifecycleEvent) => void | Promise<void>;

/**
 * Unified token manager
 */
export class UnifiedTokenManager {
  private static instance: UnifiedTokenManager | null = null;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly iterations = 100000;
  private readonly tagLength = 16;

  private masterKey: Buffer;
  private refreshConfig: TokenRefreshConfig;
  private refreshCallbacks = new Map<string, TokenRefreshCallback>();
  private lifecycleListeners: TokenLifecycleListener[] = [];
  private refreshTimers = new Map<string, NodeJS.Timeout>();

  private constructor() {
    const securityConfig = getServiceConfig('security');
    const oauthConfig = getServiceConfig('oauth');

    this.masterKey = this.deriveMasterKey(securityConfig.encryptionKey);
    this.refreshConfig = {
      refreshBuffer: oauthConfig.tokenRefreshBuffer,
      maxRetries: oauthConfig.maxRetries,
      retryDelay: 1000,
      exponentialBackoff: true,
    };

    logger.info('Unified token manager initialized', {
      refreshBuffer: this.refreshConfig.refreshBuffer,
      maxRetries: this.refreshConfig.maxRetries,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedTokenManager {
    if (!UnifiedTokenManager.instance) {
      UnifiedTokenManager.instance = new UnifiedTokenManager();
    }
    return UnifiedTokenManager.instance;
  }

  /**
   * Encrypt OAuth token data
   */
  async encryptTokens(tokenData: OAuthTokenData): Promise<EncryptedTokenData> {
    const context = createErrorContext('UnifiedTokenManager', 'encryptTokens');

    const result = await handleAsync(async () => {
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = this.deriveKey(salt);

      // Add metadata to token data
      const enrichedTokenData: OAuthTokenData = {
        ...tokenData,
        createdAt: tokenData.createdAt || new Date(),
        version: '2.0',
      };

      const plaintext = JSON.stringify(enrichedTokenData);
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();
      const combined = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'hex'),
        tag
      ]);

      return {
        encryptedData: combined.toString('base64'),
        metadata: {
          algorithm: this.algorithm,
          version: '2.0',
          createdAt: new Date(),
          salt: salt.toString('hex'),
          iv: iv.toString('hex'),
        },
      };
    }, context);

    if (!result.success) {
      throw new TokenError('Failed to encrypt tokens', {
        error: result.error?.message,
      });
    }

    return result.data!;
  }

  /**
   * Decrypt OAuth token data
   */
  async decryptTokens(encryptedData: EncryptedTokenData | string): Promise<OAuthTokenData> {
    const context = createErrorContext('UnifiedTokenManager', 'decryptTokens');

    const result = await handleAsync(async () => {
      // Handle legacy string format
      if (typeof encryptedData === 'string') {
        return this.decryptLegacyTokens(encryptedData);
      }

      const combined = Buffer.from(encryptedData.encryptedData, 'base64');
      const salt = combined.subarray(0, this.saltLength);
      const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
      const encrypted = combined.subarray(
        this.saltLength + this.ivLength,
        combined.length - this.tagLength
      );
      const tag = combined.subarray(combined.length - this.tagLength);

      const key = this.deriveKey(salt);
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as OAuthTokenData;
    }, context);

    if (!result.success) {
      throw new TokenError('Failed to decrypt tokens', {
        error: result.error?.message,
      });
    }

    return result.data!;
  }

  /**
   * Check if tokens are expired or expiring soon
   */
  isTokenExpired(tokenData: OAuthTokenData, bufferSeconds?: number): boolean {
    if (!tokenData.expiresAt) {
      return false; // No expiry information, assume valid
    }

    const buffer = (bufferSeconds ?? this.refreshConfig.refreshBuffer) * 1000;
    const expiryTime = tokenData.expiresAt.getTime() - buffer;
    return Date.now() >= expiryTime;
  }

  /**
   * Register token refresh callback for a provider
   */
  registerRefreshCallback(provider: string, callback: TokenRefreshCallback): void {
    this.refreshCallbacks.set(provider, callback);
    logger.debug('Token refresh callback registered', { provider });
  }

  /**
   * Refresh tokens for a connection
   */
  async refreshTokens(
    provider: string,
    connectionId: string,
    currentTokenData: OAuthTokenData
  ): Promise<OAuthTokenData> {
    const context = createErrorContext('UnifiedTokenManager', 'refreshTokens', {
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      metadata: { provider, connectionId },
    });

    if (!currentTokenData.refreshToken) {
      throw new TokenRefreshError('No refresh token available', {
        provider,
        connectionId,
      });
    }

    const refreshCallback = this.refreshCallbacks.get(provider);
    if (!refreshCallback) {
      throw new TokenRefreshError(`No refresh callback registered for provider: ${provider}`, {
        provider,
        connectionId,
      });
    }

    const result = await handleAsync(async () => {
      logger.info('Refreshing tokens', { provider, connectionId });

      const newTokenData = await refreshCallback(
        currentTokenData.refreshToken!,
        provider,
        connectionId
      );

      // Preserve refresh token if not provided in response
      if (!newTokenData.refreshToken && currentTokenData.refreshToken) {
        newTokenData.refreshToken = currentTokenData.refreshToken;
      }

      // Calculate expiry if provided as seconds
      if (newTokenData.expiresIn && !newTokenData.expiresAt) {
        newTokenData.expiresAt = new Date(Date.now() + newTokenData.expiresIn * 1000);
      }

      // Emit lifecycle event
      this.emitTokenEvent({
        event: TokenEvent.REFRESHED,
        provider,
        connectionId,
        tokenData: newTokenData,
        timestamp: new Date(),
      });

      // Schedule next refresh
      this.scheduleTokenRefresh(provider, connectionId, newTokenData);

      logger.info('Tokens refreshed successfully', {
        provider,
        connectionId,
        expiresAt: newTokenData.expiresAt,
      });

      return newTokenData;
    }, context);

    if (!result.success) {
      this.emitTokenEvent({
        event: TokenEvent.ERROR,
        provider,
        connectionId,
        error: result.error,
        timestamp: new Date(),
      });

      throw new TokenRefreshError('Failed to refresh tokens', {
        provider,
        connectionId,
        error: result.error?.message,
      });
    }

    return result.data!;
  }

  /**
   * Schedule automatic token refresh
   */
  scheduleTokenRefresh(
    provider: string,
    connectionId: string,
    tokenData: OAuthTokenData
  ): void {
    const key = `${provider}:${connectionId}`;

    // Clear existing timer
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (!tokenData.expiresAt || !tokenData.refreshToken) {
      return; // Can't schedule without expiry or refresh token
    }

    const refreshTime = tokenData.expiresAt.getTime() - (this.refreshConfig.refreshBuffer * 1000);
    const delay = Math.max(0, refreshTime - Date.now());

    if (delay > 0) {
      const timer = setTimeout(async () => {
        try {
          await this.refreshTokens(provider, connectionId, tokenData);
        } catch (error) {
          logger.error('Scheduled token refresh failed', {
            provider,
            connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }, delay);

      this.refreshTimers.set(key, timer);

      logger.debug('Token refresh scheduled', {
        provider,
        connectionId,
        refreshInMs: delay,
        refreshAt: new Date(Date.now() + delay),
      });
    }
  }

  /**
   * Cancel scheduled token refresh
   */
  cancelTokenRefresh(provider: string, connectionId: string): void {
    const key = `${provider}:${connectionId}`;
    const timer = this.refreshTimers.get(key);

    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(key);
      logger.debug('Token refresh cancelled', { provider, connectionId });
    }
  }

  /**
   * Validate token data structure
   */
  validateTokenData(tokenData: unknown): tokenData is OAuthTokenData {
    if (!tokenData || typeof tokenData !== 'object') {
      return false;
    }

    const token = tokenData as Record<string, unknown>;
    return typeof token.accessToken === 'string' && token.accessToken.length > 0;
  }

  /**
   * Add token lifecycle listener
   */
  addLifecycleListener(listener: TokenLifecycleListener): void {
    this.lifecycleListeners.push(listener);
  }

  /**
   * Remove token lifecycle listener
   */
  removeLifecycleListener(listener: TokenLifecycleListener): void {
    const index = this.lifecycleListeners.indexOf(listener);
    if (index >= 0) {
      this.lifecycleListeners.splice(index, 1);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all timers
    this.refreshTimers.forEach((timer) => {
      clearTimeout(timer);
    });
    this.refreshTimers.clear();

    // Clear callbacks and listeners
    this.refreshCallbacks.clear();
    this.lifecycleListeners.length = 0;

    logger.info('Unified token manager destroyed');
  }

  /**
   * Derive encryption key from master key and salt
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Derive master key from configuration
   */
  private deriveMasterKey(configKey: string): Buffer {
    if (configKey.length < 32) {
      throw new TokenError('Encryption master key must be at least 32 characters');
    }

    // Use PBKDF2 to derive a consistent key from the config key
    const salt = Buffer.from('unified-token-manager-salt', 'utf8');
    return crypto.pbkdf2Sync(configKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Decrypt legacy token format for backward compatibility
   */
  private async decryptLegacyTokens(encryptedData: string): Promise<OAuthTokenData> {
    // This would handle the old TokenEncryption format
    // For now, throw an error to force migration
    throw new TokenError('Legacy token format detected. Please re-authenticate to use new format.');
  }

  /**
   * Emit token lifecycle event
   */
  private emitTokenEvent(event: TokenLifecycleEvent): void {
    // Emit to all listeners asynchronously
    setImmediate(async () => {
      for (const listener of this.lifecycleListeners) {
        try {
          await listener(event);
        } catch (error) {
          logger.error('Token lifecycle listener error', {
            event: event.event,
            provider: event.provider,
            connectionId: event.connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }
}

/**
 * Singleton instance
 */
export const unifiedTokenManager = UnifiedTokenManager.getInstance();

/**
 * Convenience functions for common token operations
 */

/**
 * Encrypt tokens with unified manager
 */
export async function encryptTokens(tokenData: OAuthTokenData): Promise<EncryptedTokenData> {
  return unifiedTokenManager.encryptTokens(tokenData);
}

/**
 * Decrypt tokens with unified manager
 */
export async function decryptTokens(encryptedData: EncryptedTokenData | string): Promise<OAuthTokenData> {
  return unifiedTokenManager.decryptTokens(encryptedData);
}

/**
 * Check if tokens are expired
 */
export function isTokenExpired(tokenData: OAuthTokenData, bufferSeconds?: number): boolean {
  return unifiedTokenManager.isTokenExpired(tokenData, bufferSeconds);
}

/**
 * Register provider refresh callback
 */
export function registerTokenRefreshCallback(provider: string, callback: TokenRefreshCallback): void {
  unifiedTokenManager.registerRefreshCallback(provider, callback);
}

/**
 * Refresh tokens for connection
 */
export async function refreshConnectionTokens(
  provider: string,
  connectionId: string,
  currentTokenData: OAuthTokenData
): Promise<OAuthTokenData> {
  return unifiedTokenManager.refreshTokens(provider, connectionId, currentTokenData);
} 