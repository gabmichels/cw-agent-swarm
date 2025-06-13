import { DatabaseService } from '../database/DatabaseService';
import { WorkspaceService } from './WorkspaceService';
import { ConnectionStatus } from '../database/types';

/**
 * Background service that automatically refreshes workspace tokens before they expire
 */
export class TokenRefreshService {
  private static instance: TokenRefreshService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly refreshIntervalMs = 30 * 60 * 1000; // Check every 30 minutes
  private readonly refreshThresholdMs = 10 * 60 * 1000; // Refresh if expiring within 10 minutes

  private constructor() {}

  static getInstance(): TokenRefreshService {
    if (!TokenRefreshService.instance) {
      TokenRefreshService.instance = new TokenRefreshService();
    }
    return TokenRefreshService.instance;
  }

  /**
   * Start the background token refresh service
   */
  start(): void {
    if (this.intervalId) {
      console.log('Token refresh service is already running');
      return;
    }

    console.log('Starting token refresh service...');
    this.intervalId = setInterval(() => {
      this.refreshExpiredTokens().catch(error => {
        console.error('Error in token refresh service:', error);
      });
    }, this.refreshIntervalMs);

    // Run immediately on start
    this.refreshExpiredTokens().catch(error => {
      console.error('Error in initial token refresh:', error);
    });
  }

  /**
   * Stop the background token refresh service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Token refresh service stopped');
    }
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

      console.log(`Checking ${activeConnections.length} active workspace connections for token expiration...`);

      const now = new Date();
      const refreshThreshold = new Date(now.getTime() + this.refreshThresholdMs);

      let refreshedCount = 0;
      let errorCount = 0;

      for (const connection of activeConnections) {
        try {
          // Skip connections without refresh tokens
          if (!connection.refreshToken) {
            continue;
          }

          // Check if token is expiring soon
          if (connection.tokenExpiresAt && connection.tokenExpiresAt < refreshThreshold) {
            console.log(`Refreshing token for connection ${connection.id} (${connection.email}) - expires at ${connection.tokenExpiresAt}`);
            
            const refreshResult = await workspaceService.refreshConnection(connection.id);
            
            if (refreshResult.success) {
              refreshedCount++;
              console.log(`✓ Successfully refreshed token for ${connection.email}`);
            } else {
              errorCount++;
              console.error(`✗ Failed to refresh token for ${connection.email}:`, refreshResult.error);
              
              // Mark connection as expired if refresh fails
              await db.updateWorkspaceConnection(connection.id, {
                status: ConnectionStatus.EXPIRED
              });
            }
          }
        } catch (error) {
          errorCount++;
          console.error(`Error processing connection ${connection.id}:`, error);
        }
      }

      if (refreshedCount > 0 || errorCount > 0) {
        console.log(`Token refresh completed: ${refreshedCount} refreshed, ${errorCount} errors`);
      }
    } catch (error) {
      console.error('Error in refreshExpiredTokens:', error);
    }
  }

  /**
   * Manually trigger a token refresh check
   */
  async triggerRefresh(): Promise<void> {
    console.log('Manually triggering token refresh...');
    await this.refreshExpiredTokens();
  }
}
