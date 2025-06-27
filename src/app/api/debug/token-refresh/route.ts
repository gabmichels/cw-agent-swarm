import { NextRequest, NextResponse } from 'next/server';
import { TokenRefreshService } from '../../../../services/workspace/TokenRefreshService';
import { logger } from '../../../../lib/logging';

/**
 * Debug endpoint for monitoring and controlling the enhanced token refresh system
 * GET: Returns service status, connection health, and intelligent refresh information
 * POST: Manually triggers token refresh with intelligent cooldown checks
 */

export async function GET() {
  try {
    const tokenRefreshService = TokenRefreshService.getInstance();

    // Get service status
    const status = tokenRefreshService.getStatus();

    // Get connection health summary
    const healthSummary = await tokenRefreshService.getHealthSummary();

    // Format check interval and next check timing
    const formatTime = (ms: number | null) => {
      if (ms === null) return null;
      const minutes = Math.round(ms / 1000 / 60);
      return `${minutes} minutes`;
    };

    const formatSeconds = (ms: number | null) => {
      if (ms === null) return null;
      return `${Math.round(ms / 1000)} seconds`;
    };

    // Calculate summary metrics
    const healthyConnections = Math.max(0,
      healthSummary.active - healthSummary.expiringWithin2Hours - healthSummary.missingRefreshToken
    );
    const needsAttention =
      healthSummary.expiringWithin2Hours + healthSummary.missingRefreshToken + healthSummary.expired;

    const response = {
      timestamp: new Date().toISOString(),
      service: {
        isRunning: status.isRunning,
        checkInterval: formatTime(status.nextCheckIn),
        nextCheckIn: formatSeconds(status.nextCheckIn),
      },
      connections: healthSummary,
      summary: {
        healthyConnections,
        needsAttention,
      },
      intelligentRefresh: {
        cooldownPeriodMinutes: 5,
        immediateThresholdMinutes: 10,
        proactiveThresholdHours: 2,
        memoryTrackingEnabled: true,
        databaseFieldAvailable: 'pending', // Will be 'available' once lastRefreshedAt field is added
        hotReloadingProtection: true,
      }
    };

    logger.info('Token refresh status requested', {
      isRunning: status.isRunning,
      totalConnections: healthSummary.total,
      activeConnections: healthSummary.active,
      expiredConnections: healthSummary.expired,
      healthyConnections,
      needsAttention,
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error getting token refresh status', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        error: 'Failed to get token refresh status',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    logger.info('Manual token refresh triggered via API');

    const tokenRefreshService = TokenRefreshService.getInstance();
    const result = await tokenRefreshService.triggerRefresh();

    logger.info('Manual token refresh completed via API', result);

    return NextResponse.json({
      success: true,
      message: 'Token refresh completed',
      result,
      timestamp: new Date().toISOString(),
      note: 'Intelligent cooldown checks prevent unnecessary refreshes during development hot reloading'
    });

  } catch (error) {
    logger.error('Error triggering token refresh', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger token refresh',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 