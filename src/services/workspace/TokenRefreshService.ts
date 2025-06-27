import { logger } from '../../lib/logging';
import { unifiedTokenManager, TokenEvent } from '../../lib/security/unified-token-manager';
import { DatabaseService } from '../database/DatabaseService';
import { ConnectionStatus } from '../database/types';
import { WorkspaceService } from './WorkspaceService';

/**
 * Enhanced background service that automatically refreshes workspace tokens before they expire
 * - Coordinates with unified token manager to avoid duplicate refreshes
 * - Runs periodic checks every 30 minutes
 * - Refreshes tokens 1-2 hours before expiry
 * - Waits for startup recovery to complete before starting periodic checks
 */
export class TokenRefreshService {
  private static instance: TokenRefreshService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly refreshIntervalMs = 30 * 60 * 1000; // Check every 30 minutes (reduced from 10)
  private readonly refreshThresholdMs = 2 * 60 * 60 * 1000; // Refresh if expiring within 2 hours
  private readonly immediateRefreshThresholdMs = 10 * 60 * 1000; // Immediate refresh if expiring within 10 minutes
  private isStarted = false;
  private startupRecoveryWaitTime = 60 * 1000; // Wait 60 seconds for startup recovery to complete

  // Track recent refreshes to prevent duplicates across systems
  private recentRefreshes = new Map<string, number>(); // connectionId -> timestamp
  private readonly refreshCooldownMs = 5 * 60 * 1000; // 5 minute cooldown between refreshes

  private constructor() { }

  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService();
    }
    return TokenRefreshService.instance;
  }

  /**
   * Start the background token refresh service with startup recovery coordination
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      logger.info('Token refresh service is already running');
      return;
    }

    logger.info('Starting enhanced token refresh service...', {
      checkInterval: this.refreshIntervalMs / 1000 / 60,
      refreshThreshold: this.refreshThresholdMs / 1000 / 60 / 60,
      startupDelay: this.startupRecoveryWaitTime / 1000,
    });

    // Listen for token refresh events from unified token manager to coordinate cooldowns
    unifiedTokenManager.addLifecycleListener((event) => {
      if (event.event === TokenEvent.REFRESHED && event.connectionId) {
        this.recentRefreshes.set(event.connectionId, Date.now());
        logger.debug('Tracked token refresh from unified manager', {
          connectionId: event.connectionId,
          provider: event.provider,
        });
      }
    });

    // Perform startup token recovery first
    try {
      await unifiedTokenManager.recoverExistingConnections();
      logger.info('Startup token recovery completed');
    } catch (error) {
      logger.error('Startup token recovery failed', { error });
      // Continue with service start even if recovery fails
    }

    // Start periodic checks
    this.intervalId = setInterval(() => {
      this.refreshExpiredTokens().catch(error => {
        logger.error('Error in token refresh service', { error });
      });
    }, this.refreshIntervalMs);

    // Wait longer for startup recovery to complete before first check
    // This prevents overlap with the unified token manager's immediate refreshes
    setTimeout(() => {
      this.refreshExpiredTokens().catch(error => {
        logger.error('Error in initial token refresh', { error });
      });
    }, this.startupRecoveryWaitTime);

    this.isStarted = true;
    logger.info('Enhanced token refresh service started successfully');
  }

  /**
   * Stop the background token refresh service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isStarted = false;
      logger.info('Token refresh service stopped');
    }
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; nextCheckIn: number | null } {
    return {
      isRunning: this.isStarted && this.intervalId !== null,
      nextCheckIn: this.intervalId ? this.refreshIntervalMs : null,
    };
  }

  /**
   * Check for and refresh tokens that are expiring soon
   */
  private async refreshExpiredTokens(): Promise<void> {
    try {
      const db = DatabaseService.getInstance();
      const workspaceService = new WorkspaceService();

      // Clean up old entries from recent refreshes map
      const now = Date.now();
      const cutoffTime = now - this.refreshCooldownMs;
      for (const [connectionId, timestamp] of this.recentRefreshes.entries()) {
        if (timestamp < cutoffTime) {
          this.recentRefreshes.delete(connectionId);
        }
      }

      // Get all active connections
      const activeConnections = await db.findWorkspaceConnections({
        status: ConnectionStatus.ACTIVE
      });

      if (activeConnections.length === 0) {
        logger.debug('No active workspace connections found');
        return;
      }

      logger.debug(`Checking ${activeConnections.length} active workspace connections for token expiration...`);

      const refreshThreshold = new Date(now + this.refreshThresholdMs);
      const immediateThreshold = new Date(now + this.immediateRefreshThresholdMs);

      let refreshedCount = 0;
      let scheduledCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let rateLimitedCount = 0;
      let cooledDownCount = 0;

      for (const connection of activeConnections) {
        try {
          // Skip connections without refresh tokens
          if (!connection.refreshToken) {
            skippedCount++;
            continue;
          }

          // Skip connections without expiry dates
          if (!connection.tokenExpiresAt) {
            skippedCount++;
            continue;
          }

          // Check if this connection was recently refreshed (by any system)
          // First check database (persistent across restarts), then fallback to memory
          let lastRefreshTime: number | null = null;
          if (connection.lastRefreshedAt) {
            lastRefreshTime = connection.lastRefreshedAt.getTime();
          } else {
            const memoryRefresh = this.recentRefreshes.get(connection.id);
            if (memoryRefresh) {
              lastRefreshTime = memoryRefresh;
            }
          }

          if (lastRefreshTime && (now - lastRefreshTime) < this.refreshCooldownMs) {
            cooledDownCount++;
            const minutesAgo = Math.round((now - lastRefreshTime) / 1000 / 60);
            logger.debug(`Skipping ${connection.email} - refreshed ${minutesAgo} minutes ago`, {
              connectionId: connection.id,
              provider: connection.provider,
              lastRefreshedAt: connection.lastRefreshedAt,
            });
            continue;
          }

          // Determine refresh urgency
          const tokenTime = connection.tokenExpiresAt.getTime();
          const isImmediate = tokenTime < immediateThreshold.getTime();
          const needsRefresh = tokenTime < refreshThreshold.getTime();

          if (isImmediate) {
            // Token expires very soon - refresh immediately
            logger.warn(`Token expires very soon, refreshing immediately`, {
              connectionId: connection.id,
              email: connection.email,
              provider: connection.provider,
              expiresAt: connection.tokenExpiresAt,
              minutesLeft: Math.round((tokenTime - now) / 1000 / 60)
            });

            const refreshResult = await this.attemptTokenRefresh(workspaceService, connection, 'immediate');

            if (refreshResult.success) {
              refreshedCount++;
              this.recentRefreshes.set(connection.id, now); // Track this refresh
            } else if (refreshResult.rateLimited) {
              rateLimitedCount++;
            } else {
              errorCount++;
              // Mark connection as expired if immediate refresh fails
              await db.updateWorkspaceConnection(connection.id, {
                status: ConnectionStatus.EXPIRED
              });
            }

          } else if (needsRefresh) {
            // Token expires within 2 hours - refresh proactively
            logger.info(`Token expires within refresh threshold, refreshing proactively`, {
              connectionId: connection.id,
              email: connection.email,
              provider: connection.provider,
              expiresAt: connection.tokenExpiresAt,
              hoursLeft: Math.round((tokenTime - now) / 1000 / 60 / 60 * 10) / 10
            });

            const refreshResult = await this.attemptTokenRefresh(workspaceService, connection, 'proactive');

            if (refreshResult.success) {
              refreshedCount++;
              this.recentRefreshes.set(connection.id, now); // Track this refresh
            } else if (refreshResult.rateLimited) {
              rateLimitedCount++;
              // Don't mark as expired for rate limiting - will retry later
            } else {
              errorCount++;
              // Don't mark as expired yet for proactive refreshes - might succeed later
            }

          } else {
            // Token is still good, just track it
            scheduledCount++;

            // Debug-level logging for token status
            const hoursLeft = Math.round((tokenTime - now) / 1000 / 60 / 60 * 10) / 10;
            logger.debug(`Token still valid for ${connection.email}`, {
              connectionId: connection.id,
              provider: connection.provider,
              hoursLeft: hoursLeft
            });
          }

        } catch (error) {
          errorCount++;
          logger.error(`Error processing connection ${connection.id}`, {
            connectionId: connection.id,
            email: connection.email,
            provider: connection.provider,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (refreshedCount > 0 || errorCount > 0 || rateLimitedCount > 0 || cooledDownCount > 0) {
        logger.info(`Token refresh cycle completed`, {
          total: activeConnections.length,
          refreshed: refreshedCount,
          scheduled: scheduledCount,
          skipped: skippedCount,
          cooledDown: cooledDownCount,
          errors: errorCount,
          rateLimited: rateLimitedCount
        });
      }
    } catch (error) {
      logger.error('Error in refreshExpiredTokens', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Attempt to refresh a token with enhanced error handling for rate limiting
   */
  private async attemptTokenRefresh(
    workspaceService: any,
    connection: any,
    urgency: 'immediate' | 'proactive'
  ): Promise<{ success: boolean; rateLimited: boolean }> {
    try {
      const refreshResult = await workspaceService.refreshConnection(connection.id);

      if (refreshResult.success) {
        // Update database with refresh timestamp
        // Note: This will fail until lastRefreshedAt field is added to database schema
        try {
          const db = DatabaseService.getInstance();
          await db.updateWorkspaceConnection(connection.id, {
            lastRefreshedAt: new Date()
          });
          logger.debug('Updated lastRefreshedAt in database', { connectionId: connection.id });
        } catch (dbError) {
          // Log but don't fail the refresh for a database update error
          logger.debug('Could not update lastRefreshedAt in database (field may not exist yet)', {
            connectionId: connection.id,
            error: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }

        logger.info(`✓ Successfully refreshed token for ${connection.email}`, {
          connectionId: connection.id,
          provider: connection.provider,
          urgency
        });
        return { success: true, rateLimited: false };
      } else {
        logger.error(`✗ Failed to refresh token for ${connection.email}`, {
          connectionId: connection.id,
          provider: connection.provider,
          error: refreshResult.error,
          urgency
        });
        return { success: false, rateLimited: false };
      }
    } catch (error) {
      // Check if this is a rate limiting error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRateLimited = errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('RATE_LIMIT_EXCEEDED');

      if (isRateLimited) {
        logger.warn(`⏱ Token refresh rate limited for ${connection.email}`, {
          connectionId: connection.id,
          provider: connection.provider,
          urgency,
          error: errorMessage
        });
        return { success: false, rateLimited: true };
      } else {
        logger.error(`✗ Token refresh failed for ${connection.email}`, {
          connectionId: connection.id,
          provider: connection.provider,
          urgency,
          error: errorMessage
        });
        return { success: false, rateLimited: false };
      }
    }
  }

  /**
   * Manually trigger a token refresh check
   */
  async triggerRefresh(): Promise<{ refreshed: number; errors: number }> {
    logger.info('Manually triggering token refresh...');

    const initialCounts = { refreshed: 0, errors: 0 };

    try {
      await this.refreshExpiredTokens();
      logger.info('Manual token refresh completed successfully');
    } catch (error) {
      logger.error('Manual token refresh failed', { error });
      return { refreshed: 0, errors: 1 };
    }

    return initialCounts;
  }

  /**
   * Get connection health summary
   */
  async getHealthSummary(): Promise<{
    total: number;
    active: number;
    expired: number;
    expiringWithin1Hour: number;
    expiringWithin2Hours: number;
    missingRefreshToken: number;
  }> {
    try {
      const db = DatabaseService.getInstance();
      const allConnections = await db.findWorkspaceConnections({});

      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      let active = 0;
      let expired = 0;
      let expiringWithin1Hour = 0;
      let expiringWithin2Hours = 0;
      let missingRefreshToken = 0;

      for (const connection of allConnections) {
        if (connection.status === ConnectionStatus.ACTIVE) {
          active++;

          if (!connection.refreshToken) {
            missingRefreshToken++;
          } else if (connection.tokenExpiresAt) {
            if (connection.tokenExpiresAt < now) {
              expired++;
            } else if (connection.tokenExpiresAt < oneHourFromNow) {
              expiringWithin1Hour++;
            } else if (connection.tokenExpiresAt < twoHoursFromNow) {
              expiringWithin2Hours++;
            }
          }
        } else if (connection.status === ConnectionStatus.EXPIRED) {
          expired++;
        }
      }

      return {
        total: allConnections.length,
        active,
        expired,
        expiringWithin1Hour,
        expiringWithin2Hours,
        missingRefreshToken,
      };
    } catch (error) {
      logger.error('Error getting health summary', { error });
      return {
        total: 0,
        active: 0,
        expired: 0,
        expiringWithin1Hour: 0,
        expiringWithin2Hours: 0,
        missingRefreshToken: 0,
      };
    }
  }
}
