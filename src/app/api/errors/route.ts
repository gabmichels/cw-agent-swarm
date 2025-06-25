import { logger } from '@/lib/core/logger';
import { NextRequest, NextResponse } from 'next/server';

// Configuration: Set to false to use real database data when implemented
const USE_MOCK_DATA = true;

// Enhanced mock data with more realistic examples
function getMockErrors() {
  return [
    {
      id: '01JYMBD840FH8W65DJGECJN252',
      errorType: 'TOOL_EXECUTION',
      severity: 'HIGH',
      status: 'NEW',
      message: 'Email service connection failed - SMTP authentication rejected',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      agentId: 'aria-001',
      userId: 'user-123',
      operation: 'send_email',
      retryAttempt: 0,
      maxRetries: 3,
      userNotified: false,
      stackTrace: 'Error: ECONNREFUSED 587 smtp.gmail.com',
      metadata: { recipientEmail: 'gab@crowd-wisdom.com', toolId: 'email_tool' }
    },
    {
      id: '01JYMBD8409D5QHHQJZAG1H7X5',
      errorType: 'API_FAILURE',
      severity: 'MEDIUM',
      status: 'IN_PROGRESS',
      message: 'Rate limit exceeded for CoinGecko API',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      agentId: 'chloe-002',
      userId: 'user-456',
      operation: 'fetch_crypto_prices',
      retryAttempt: 1,
      maxRetries: 5,
      userNotified: true,
      stackTrace: 'HTTPError: 429 Too Many Requests',
      metadata: { apiEndpoint: '/simple/price', rateLimit: '50/minute' }
    },
    {
      id: '01JYMBD8455WORKSPACE98765',
      errorType: 'WORKSPACE_PERMISSION',
      severity: 'CRITICAL',
      status: 'NEW',
      message: 'Google Workspace access token expired',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      agentId: 'system-003',
      userId: 'user-789',
      operation: 'sync_calendar',
      retryAttempt: 0,
      maxRetries: 2,
      userNotified: true,
      stackTrace: 'AuthError: invalid_grant',
      metadata: { workspaceId: 'ws-001', scope: 'calendar.readonly' }
    },
    {
      id: '01JYMBD8456NETWORK123456',
      errorType: 'NETWORK_ERROR',
      severity: 'LOW',
      status: 'RESOLVED',
      message: 'Connection timeout to GitHub API',
      createdAt: new Date(Date.now() - 14400000).toISOString(),
      resolvedAt: new Date(Date.now() - 13800000).toISOString(),
      agentId: 'github-bot',
      userId: 'user-111',
      operation: 'create_repository',
      retryAttempt: 2,
      maxRetries: 3,
      userNotified: false,
      resolutionNotes: 'Retry successful after timeout increase',
      metadata: { endpoint: 'https://api.github.com/user/repos', timeout: 5000 }
    },
    {
      id: '01JYMBD8457VALIDATION789',
      errorType: 'VALIDATION_ERROR',
      severity: 'MEDIUM',
      status: 'IGNORED',
      message: 'Invalid webhook payload format from Slack',
      createdAt: new Date(Date.now() - 18000000).toISOString(),
      agentId: 'slack-integration',
      userId: 'user-222',
      operation: 'process_webhook',
      retryAttempt: 0,
      maxRetries: 1,
      userNotified: true,
      metadata: { webhookId: 'wh_123', payloadSize: 2048 }
    }
  ];
}

function getMockStatistics() {
  return {
    totalErrors: 187,
    errorsByType: {
      TOOL_EXECUTION: 52,
      API_FAILURE: 41,
      WORKSPACE_PERMISSION: 28,
      VALIDATION_ERROR: 31,
      NETWORK_ERROR: 35
    },
    errorsBySeverity: {
      LOW: 48,
      MEDIUM: 73,
      HIGH: 52,
      CRITICAL: 14
    },
    errorsByStatus: {
      NEW: 31,
      IN_PROGRESS: 18,
      RESOLVED: 128,
      IGNORED: 10
    },
    resolutionRate: 0.83,
    averageResolutionTime: 4.1,
    topFailingComponents: [
      { component: 'Email Service', count: 34 },
      { component: 'CoinGecko API', count: 28 },
      { component: 'Google Workspace', count: 22 },
      { component: 'GitHub API', count: 18 },
      { component: 'Slack Integration', count: 15 }
    ],
    isLiveData: false,
    dataSource: 'Mock Data for Demo'
  };
}

// Simple error response handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '24h';
    const action = searchParams.get('action');
    const severityFilter = searchParams.get('severity');
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('errorType');

    logger.info('Error API GET request', { dateRange, action, severityFilter, statusFilter, typeFilter });

    if (USE_MOCK_DATA) {
      // Using mock data
      let mockErrors = getMockErrors();
      const mockStats = getMockStatistics();

      // Apply filters to mock data
      if (severityFilter && severityFilter !== 'all') {
        mockErrors = mockErrors.filter(error => error.severity === severityFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        mockErrors = mockErrors.filter(error => error.status === statusFilter);
      }
      if (typeFilter && typeFilter !== 'all') {
        mockErrors = mockErrors.filter(error => error.errorType === typeFilter);
      }

      // Handle statistics request separately
      if (action === 'statistics') {
        return NextResponse.json({
          success: true,
          data: mockStats
        });
      }

      // Handle regular error list request
      return NextResponse.json({
        success: true,
        data: {
          errors: mockErrors,
          dateRange,
          isLiveData: false,
          dataSource: 'Mock Data for Demo'
        }
      });
    } else {
      // TODO: Implement real database integration
      // This would use the error management services to fetch real data
      /*
      const errorManagementService = new DefaultErrorManagementService(
        logger,
        databaseProvider,
        notificationService
      );
      
      const criteria = {
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        errorType: typeFilter !== 'all' ? typeFilter : undefined,
        fromDate: calculateDateFromRange(dateRange),
        toDate: new Date()
      };
      
      if (action === 'statistics') {
        const stats = await errorManagementService.getErrorStatistics(criteria);
        return NextResponse.json({ success: true, data: stats });
      }
      
      const errors = await errorManagementService.searchErrors(criteria);
      return NextResponse.json({ 
        success: true, 
        data: { errors, dateRange, isLiveData: true, dataSource: 'Live Database' }
      });
      */

      return NextResponse.json({
        success: false,
        error: 'Real data integration not yet implemented'
      }, { status: 501 });
    }

  } catch (error) {
    logger.error('Error in GET /api/errors', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch errors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    logger.info('Error API POST request', { body });

    // Handle different actions
    const { action, errorId, ...params } = body;

    if (USE_MOCK_DATA) {
      // Mock responses for actions
      switch (action) {
        case 'resolve':
          logger.info('Mock: Resolving error', { errorId });
          return NextResponse.json({
            success: true,
            message: 'Error resolved (mock action)'
          });

        case 'ignore':
          logger.info('Mock: Ignoring error', { errorId });
          return NextResponse.json({
            success: true,
            message: 'Error ignored (mock action)'
          });

        case 'retry':
          logger.info('Mock: Retrying error', { errorId });
          return NextResponse.json({
            success: true,
            message: 'Error retry scheduled (mock action)'
          });

        default:
          return NextResponse.json(
            { success: false, error: 'Unknown action' },
            { status: 400 }
          );
      }
    } else {
      // TODO: Implement real error management actions
      /*
      const errorManagementService = new DefaultErrorManagementService(
        logger,
        databaseProvider,
        notificationService
      );
      
      switch (action) {
        case 'resolve':
          await errorManagementService.resolveError({
            errorId,
            resolutionType: 'manual',
            description: params.resolutionNotes || 'Manually resolved via dashboard',
            success: true
          });
          return NextResponse.json({ success: true, message: 'Error resolved' });
          
        case 'ignore':
          await errorManagementService.updateErrorStatus(errorId, 'IGNORED');
          return NextResponse.json({ success: true, message: 'Error ignored' });
          
        case 'retry':
          await errorManagementService.retryError(errorId);
          return NextResponse.json({ success: true, message: 'Error retry scheduled' });
      }
      */

      return NextResponse.json({
        success: false,
        error: 'Real error actions not yet implemented'
      }, { status: 501 });
    }

  } catch (error) {
    logger.error('Error in POST /api/errors', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 