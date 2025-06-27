import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '../../../../services/database/DatabaseService';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';
import { ZohoWorkspaceProvider } from '../../../../services/workspace/providers/ZohoWorkspaceProvider';
import { ConnectionStatus, WorkspaceProvider } from '../../../../services/database/types';
import { logger } from '../../../../lib/logging';

/**
 * Debug endpoint for monitoring Zoho rate limiting and token refresh status
 * GET: Returns current rate limit status and connection health
 * POST: Manually triggers token refresh for specific connections
 */

export async function GET() {
  try {
    const db = DatabaseService.getInstance();
    const workspaceService = new WorkspaceService();

    // Get all Zoho connections
    const zohoConnections = await db.findWorkspaceConnections({
      provider: WorkspaceProvider.ZOHO,
      status: ConnectionStatus.ACTIVE
    });

    // Check if Zoho provider is available
    const availableProviders = workspaceService.getAvailableProviders();
    const zohoAvailable = availableProviders.includes(WorkspaceProvider.ZOHO);

    // Analyze connection health
    const connectionHealth = await Promise.all(
      zohoConnections.map(async (connection) => {
        const now = new Date();
        const expiresAt = connection.tokenExpiresAt;
        const minutesUntilExpiry = expiresAt
          ? Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)
          : null;

        return {
          connectionId: connection.id,
          email: connection.email,
          domain: connection.domain,
          status: connection.status,
          expiresAt: expiresAt?.toISOString(),
          minutesUntilExpiry,
          needsRefresh: minutesUntilExpiry !== null && minutesUntilExpiry < 120, // 2 hours
          urgent: minutesUntilExpiry !== null && minutesUntilExpiry < 10, // 10 minutes
          hasRefreshToken: !!connection.refreshToken,
          createdAt: connection.createdAt,
          lastUpdated: connection.updatedAt
        };
      })
    );

    // Summary statistics
    const summary = {
      totalConnections: zohoConnections.length,
      needingRefresh: connectionHealth.filter(c => c.needsRefresh).length,
      urgent: connectionHealth.filter(c => c.urgent).length,
      withoutRefreshToken: connectionHealth.filter(c => !c.hasRefreshToken).length,
      healthyConnections: connectionHealth.filter(c =>
        !c.needsRefresh && c.hasRefreshToken && c.status === ConnectionStatus.ACTIVE
      ).length
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      rateLimitInfo: {
        provider: 'Zoho Workspace',
        region: process.env.ZOHO_REGION || 'com',
        configured: !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET),
        providerInitialized: zohoAvailable,
        healthCheckAvailable: true
      },
      summary,
      connections: connectionHealth,
      refreshConfiguration: {
        checkIntervalMinutes: 10,
        refreshThresholdHours: 2,
        immediateThresholdMinutes: 10,
        maxRetriesPerRefresh: 5,
        baseBackoffDelayMs: 5000,
        maxBackoffDelayMs: 300000
      }
    });

  } catch (error) {
    logger.error('Error in Zoho rate limit debug endpoint', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, action = 'refresh', force = false } = body;

    const db = DatabaseService.getInstance();
    const workspaceService = new WorkspaceService();

    if (action === 'refresh') {
      if (!connectionId) {
        return NextResponse.json(
          { success: false, error: 'connectionId is required for refresh action' },
          { status: 400 }
        );
      }

      // Get the connection details
      const connection = await db.getWorkspaceConnection(connectionId);
      if (!connection) {
        return NextResponse.json(
          { success: false, error: 'Connection not found' },
          { status: 404 }
        );
      }

      if (connection.provider !== WorkspaceProvider.ZOHO) {
        return NextResponse.json(
          { success: false, error: 'Connection is not a Zoho workspace connection' },
          { status: 400 }
        );
      }

      logger.info('Manual Zoho token refresh triggered', {
        connectionId,
        email: connection.email,
        force,
        triggeredBy: 'debug-endpoint'
      });

      // Attempt the refresh
      const startTime = Date.now();
      const refreshResult = await workspaceService.refreshConnection(connectionId);
      const duration = Date.now() - startTime;

      if (refreshResult.success) {
        // Get updated connection info
        const updatedConnection = await db.getWorkspaceConnection(connectionId);

        return NextResponse.json({
          success: true,
          message: 'Token refresh successful',
          connectionId,
          duration,
          result: {
            email: connection.email,
            oldExpiresAt: connection.tokenExpiresAt?.toISOString(),
            newExpiresAt: updatedConnection?.tokenExpiresAt?.toISOString(),
            refreshed: true
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Token refresh failed',
          connectionId,
          duration,
          error: refreshResult.error,
          result: {
            email: connection.email,
            expiresAt: connection.tokenExpiresAt?.toISOString(),
            refreshed: false
          }
        });
      }

    } else if (action === 'refresh-all') {
      // Refresh all Zoho connections
      const zohoConnections = await db.findWorkspaceConnections({
        provider: WorkspaceProvider.ZOHO,
        status: ConnectionStatus.ACTIVE
      });

      const results = await Promise.allSettled(
        zohoConnections
          .filter(conn => !!conn.refreshToken) // Only refresh connections with refresh tokens
          .map(async (connection) => {
            const startTime = Date.now();
            const refreshResult = await workspaceService.refreshConnection(connection.id);
            const duration = Date.now() - startTime;

            return {
              connectionId: connection.id,
              email: connection.email,
              success: refreshResult.success,
              error: refreshResult.error,
              duration
            };
          })
      );

      const summary = {
        totalAttempted: results.length,
        successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
        failed: results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: 'Promise rejected' })
      };

      logger.info('Bulk Zoho token refresh completed', {
        summary,
        triggeredBy: 'debug-endpoint'
      });

      return NextResponse.json({
        success: true,
        message: 'Bulk refresh completed',
        summary
      });

    } else {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.error('Error in Zoho rate limit debug POST endpoint', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 