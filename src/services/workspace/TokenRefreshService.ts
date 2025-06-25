import { logger } from '../../lib/logging';
import { unifiedTokenManager } from '../../lib/security/unified-token-manager';
import { DatabaseService } from '../database/DatabaseService';
import { ConnectionStatus } from '../database/types';
import { WorkspaceService } from './WorkspaceService';

/**
 * Enhanced background service that automatically refreshes workspace tokens before they expire
 * - Runs more frequent checks (every 10 minutes instead of 30)
 * - Refreshes tokens 1-2 hours before expiry instead of 10 minutes
 * - Integrates with unified token manager for startup recovery
 */
export class TokenRefreshService {
  private static instance: TokenRefreshService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly refreshIntervalMs = 10 * 60 * 1000; // Check every 10 minutes (down from 30)
  private readonly refreshThresholdMs = 2 * 60 * 60 * 1000; // Refresh if expiring within 2 hours (up from 10 minutes)
  private readonly immediateRefreshThresholdMs = 10 * 60 * 1000; // Immediate refresh if expiring within 10 minutes
  private isStarted = false;

  private constructor() { }

  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService();
    }
    return TokenRefreshService.instance;
  }

  /**
   * Start the background token refresh service with startup recovery
   */
  async start(): Promise<void> {
    if (this.intervalId) {
      logger.info('Token refresh service is already running');
      return;
    }

    logger.info('Starting enhanced token refresh service...', {
      checkInterval: this.refreshIntervalMs / 1000 / 60,
      refreshThreshold: this.refreshThresholdMs / 1000 / 60 / 60,
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

    // Run initial check after a short delay
    setTimeout(() => {
      this.refreshExpiredTokens().catch(error => {
        logger.error('Error in initial token refresh', { error });
      });
    }, 5000); // 5 second delay to let server finish starting

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

      // Get all active connections
      const activeConnections = await db.findWorkspaceConnections({
        status: ConnectionStatus.ACTIVE
      });

      if (activeConnections.length === 0) {
        logger.debug('No active workspace connections found');
        return;
      }

      logger.debug(`Checking ${activeConnections.length} active workspace connections for token expiration...`);

      const now = new Date();
      const refreshThreshold = new Date(now.getTime() + this.refreshThresholdMs);
      const immediateThreshold = new Date(now.getTime() + this.immediateRefreshThresholdMs);

      let refreshedCount = 0;
      let scheduledCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

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

          // Determine refresh urgency
          const isImmediate = connection.tokenExpiresAt < immediateThreshold;
          const needsRefresh = connection.tokenExpiresAt < refreshThreshold;

          if (isImmediate) {
            // Token expires very soon - refresh immediately
            logger.warn(`Token expires very soon, refreshing immediately`, {
              connectionId: connection.id,
              email: connection.email,
              expiresAt: connection.tokenExpiresAt,
              minutesLeft: Math.round((connection.tokenExpiresAt.getTime() - now.getTime()) / 1000 / 60)
            });

            const refreshResult = await workspaceService.refreshConnection(connection.id);

            if (refreshResult.success) {
              refreshedCount++;
              logger.info(`✓ Successfully refreshed token for ${connection.email}`, {
                connectionId: connection.id,
                urgency: 'immediate'
              });
            } else {
              errorCount++;
              logger.error(`✗ Failed to refresh token for ${connection.email}`, {
                connectionId: connection.id,
                error: refreshResult.error,
                urgency: 'immediate'
              });

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
              expiresAt: connection.tokenExpiresAt,
              hoursLeft: Math.round((connection.tokenExpiresAt.getTime() - now.getTime()) / 1000 / 60 / 60 * 10) / 10
            });

            const refreshResult = await workspaceService.refreshConnection(connection.id);

            if (refreshResult.success) {
              refreshedCount++;
              logger.info(`✓ Successfully refreshed token for ${connection.email}`, {
                connectionId: connection.id,
                urgency: 'proactive'
              });
            } else {
              errorCount++;
              logger.error(`✗ Failed to refresh token for ${connection.email}`, {
                connectionId: connection.id,
                error: refreshResult.error,
                urgency: 'proactive'
              });

              // Don't mark as expired yet for proactive refreshes - might succeed later
            }

          } else {
            // Token is still good, just track it
            scheduledCount++;

            // Debug-level logging for token status
            const hoursLeft = Math.round((connection.tokenExpiresAt.getTime() - now.getTime()) / 1000 / 60 / 60 * 10) / 10;
            logger.debug(`Token still valid for ${connection.email}`, {
              connectionId: connection.id,
              hoursLeft: hoursLeft
            });
          }

        } catch (error) {
          errorCount++;
          logger.error(`Error processing connection ${connection.id}`, {
            connectionId: connection.id,
            email: connection.email,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (refreshedCount > 0 || errorCount > 0) {
        logger.info(`Token refresh cycle completed`, {
          total: activeConnections.length,
          refreshed: refreshedCount,
          scheduled: scheduledCount,
          skipped: skippedCount,
          errors: errorCount
        });
      }
    } catch (error) {
      logger.error('Error in refreshExpiredTokens', {
        error: error instanceof Error ? error.message : String(error)
      });
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
