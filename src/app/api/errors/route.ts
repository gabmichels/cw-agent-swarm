import { logger } from '@/lib/core/logger';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// Configuration: Set to true to use mock data for testing
const USE_MOCK_DATA = false;

// Interface for error data returned to frontend
interface ErrorData {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  timestamp: string;
  status: 'open' | 'resolved' | 'ignored';
  agent?: string;
  operation?: string;
  metadata?: any;
  stackTrace?: string;
  resolutionNotes?: string;
}

interface ErrorStatistics {
  totalErrors: number;
  resolvedErrors: number;
  criticalErrors: number;
  newErrorsToday: number;
  averageResolutionTime: string;
  resolutionRate: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsOverTime: Array<{ date: string; count: number }>;
}

// Real database functions
async function getErrorsFromDatabase(filters: {
  severity?: string;
  status?: string;
  errorType?: string;
  dateRange?: string;
  searchQuery?: string;
}): Promise<ErrorData[]> {
  try {
    // Safety check: verify database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (connectionError) {
      console.log('Database connection failed, falling back to empty array');
      return [];
    }

    // Check if ErrorLog table exists and has data
    let errorCount = 0;
    try {
      errorCount = await prisma.errorLog.count();
    } catch (tableError) {
      console.log('ErrorLog table not accessible, returning empty array');
      return [];
    }

    if (errorCount === 0) {
      console.log('No errors found in database, returning empty array');
      return [];
    }

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (filters.dateRange) {
      const now = new Date();
      switch (filters.dateRange) {
        case '1h':
          dateFilter = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Build where clause
    const whereClause: any = {};

    if (dateFilter) {
      whereClause.createdAt = { gte: dateFilter };
    }

    if (filters.severity && filters.severity !== 'all') {
      whereClause.severity = filters.severity.toUpperCase();
    }

    if (filters.status && filters.status !== 'all') {
      // Map frontend status to database status
      const statusMap: Record<string, string> = {
        'open': 'NEW',
        'resolved': 'RESOLVED',
        'ignored': 'IGNORED'
      };
      whereClause.status = statusMap[filters.status] || filters.status.toUpperCase();
    }

    if (filters.errorType && filters.errorType !== 'all') {
      whereClause.errorType = filters.errorType;
    }

    if (filters.searchQuery) {
      whereClause.OR = [
        { message: { contains: filters.searchQuery, mode: 'insensitive' } },
        { agentId: { contains: filters.searchQuery, mode: 'insensitive' } },
        { operation: { contains: filters.searchQuery, mode: 'insensitive' } }
      ];
    }

    const errors = await prisma.errorLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to prevent large responses
      include: {
        resolutions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Map database errors to frontend format
    return errors.map(error => ({
      id: error.id,
      type: error.errorType,
      severity: mapSeverityToFrontend(error.severity),
      message: error.message,
      timestamp: error.createdAt.toISOString(),
      status: mapStatusToFrontend(error.status),
      agent: error.agentId || undefined,
      operation: error.operation || undefined,
      metadata: error.errorData ? JSON.parse(error.errorData) : undefined,
      stackTrace: error.stackTrace || undefined,
      resolutionNotes: error.resolutionNotes || (error.resolutions[0]?.description) || undefined
    }));

  } catch (error: any) {
    logger.error('Error fetching errors from database:', { error: error.message, stack: error.stack });
    // Return empty array instead of throwing to gracefully handle database issues
    return [];
  }
}

async function getStatisticsFromDatabase(): Promise<ErrorStatistics> {
  try {
    // Safety check: verify database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (connectionError) {
      console.log('Database connection failed, returning zero statistics');
      return {
        totalErrors: 0,
        resolvedErrors: 0,
        criticalErrors: 0,
        newErrorsToday: 0,
        averageResolutionTime: '0h',
        resolutionRate: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsOverTime: []
      };
    }

    // Check if ErrorLog table exists
    let errorCount = 0;
    try {
      errorCount = await prisma.errorLog.count();
    } catch (tableError) {
      console.log('ErrorLog table not accessible, returning zero statistics');
      return {
        totalErrors: 0,
        resolvedErrors: 0,
        criticalErrors: 0,
        newErrorsToday: 0,
        averageResolutionTime: '0h',
        resolutionRate: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsOverTime: []
      };
    }

    if (errorCount === 0) {
      console.log('No errors in database, returning zero statistics');
      return {
        totalErrors: 0,
        resolvedErrors: 0,
        criticalErrors: 0,
        newErrorsToday: 0,
        averageResolutionTime: '0h',
        resolutionRate: 0,
        errorsByType: {},
        errorsBySeverity: {},
        errorsOverTime: []
      };
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel queries for better performance
    const [
      totalErrors,
      resolvedErrors,
      criticalErrors,
      newErrorsToday,
      errorsByType,
      errorsBySeverity,
      errorsOverTime,
      avgResolutionTime
    ] = await Promise.all([
      // Total errors
      prisma.errorLog.count(),

      // Resolved errors
      prisma.errorLog.count({
        where: { status: 'RESOLVED' }
      }),

      // Critical errors
      prisma.errorLog.count({
        where: { severity: 'CRITICAL' }
      }),

      // New errors today
      prisma.errorLog.count({
        where: {
          createdAt: { gte: oneDayAgo }
        }
      }),

      // Errors by type
      prisma.errorLog.groupBy({
        by: ['errorType'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),

      // Errors by severity
      prisma.errorLog.groupBy({
        by: ['severity'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),

      // Errors over time (last 7 days)
      prisma.errorLog.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        _count: { id: true },
        orderBy: { createdAt: 'asc' }
      }),

      // Average resolution time
      prisma.errorLog.findMany({
        where: {
          AND: [
            { resolvedAt: { not: null } },
            { createdAt: { gte: sevenDaysAgo } }
          ]
        },
        select: {
          createdAt: true,
          resolvedAt: true
        }
      })
    ]);

    // Calculate resolution rate
    const resolutionRate = totalErrors > 0 ? (resolvedErrors / totalErrors) * 100 : 0;

    // Calculate average resolution time
    let averageResolutionTimeHours = 0;
    if (avgResolutionTime.length > 0) {
      const totalResolutionTime = avgResolutionTime.reduce((sum, error) => {
        if (error.resolvedAt) {
          const resolutionTime = error.resolvedAt.getTime() - error.createdAt.getTime();
          return sum + resolutionTime;
        }
        return sum;
      }, 0);
      averageResolutionTimeHours = totalResolutionTime / avgResolutionTime.length / (1000 * 60 * 60);
    }

    // Format errors by type
    const errorsByTypeFormatted: Record<string, number> = {};
    errorsByType.forEach(item => {
      errorsByTypeFormatted[item.errorType] = item._count.id;
    });

    // Format errors by severity
    const errorsBySeverityFormatted: Record<string, number> = {};
    errorsBySeverity.forEach(item => {
      errorsBySeverityFormatted[item.severity.toLowerCase()] = item._count.id;
    });

    // Format errors over time (group by day)
    const errorsOverTimeFormatted: Array<{ date: string; count: number }> = [];
    const dailyCounts: Record<string, number> = {};

    errorsOverTime.forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + item._count.id;
    });

    // Create array for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      errorsOverTimeFormatted.push({
        date: dateStr,
        count: dailyCounts[dateStr] || 0
      });
    }

    return {
      totalErrors,
      resolvedErrors,
      criticalErrors,
      newErrorsToday,
      averageResolutionTime: averageResolutionTimeHours > 0 ? `${averageResolutionTimeHours.toFixed(1)}h` : '0h',
      resolutionRate,
      errorsByType: errorsByTypeFormatted,
      errorsBySeverity: errorsBySeverityFormatted,
      errorsOverTime: errorsOverTimeFormatted
    };

  } catch (error: any) {
    logger.error('Error fetching statistics from database:', { error: error.message, stack: error.stack });
    // Return zero statistics instead of throwing
    return {
      totalErrors: 0,
      resolvedErrors: 0,
      criticalErrors: 0,
      newErrorsToday: 0,
      averageResolutionTime: '0h',
      resolutionRate: 0,
      errorsByType: {},
      errorsBySeverity: {},
      errorsOverTime: []
    };
  }
}

// Helper functions to map database values to frontend values
function mapSeverityToFrontend(severity: string): 'critical' | 'high' | 'medium' | 'low' {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
    case 'EMERGENCY':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
    default:
      return 'low';
  }
}

function mapStatusToFrontend(status: string): 'open' | 'resolved' | 'ignored' {
  switch (status.toUpperCase()) {
    case 'RESOLVED':
      return 'resolved';
    case 'IGNORED':
      return 'ignored';
    case 'NEW':
    case 'IN_PROGRESS':
    case 'RETRYING':
    default:
      return 'open';
  }
}

// Enhanced mock data with more realistic examples (for fallback)
function getMockErrors() {
  return [
    {
      id: '01JYMBD840FH8W65DJGECJN252',
      type: 'EMAIL_SERVICE_ERROR',
      severity: 'critical' as const,
      message: 'Email service connection failed - SMTP authentication rejected',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'open' as const,
      agent: 'Aria',
      operation: 'sendEmail',
      metadata: {
        recipient: 'gab@crowd-wisdom.com',
        subject: 'Important Update',
        smtpServer: 'smtp.gmail.com',
        errorCode: 'AUTH_REJECTED'
      },
      stackTrace: 'SMTPAuthenticationError: 535-5.7.8 Username and Password not accepted\n    at EmailService.sendEmail (/src/services/EmailService.ts:124)\n    at Agent.executeTool (/src/agents/base/AgentBase.ts:89)'
    },
    {
      id: '01JYMBD8409D5QHHQJZAG1H7X5',
      type: 'API_RATE_LIMIT',
      severity: 'high' as const,
      message: 'Rate limit exceeded for CoinGecko API',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      status: 'open' as const,
      agent: 'MarketAnalyst',
      operation: 'fetchCryptoPrice',
      metadata: {
        apiEndpoint: 'https://api.coingecko.com/api/v3/simple/price',
        rateLimitRemaining: 0,
        resetTime: '2025-01-16T10:00:00Z'
      }
    },
    {
      id: '01JYMBD8455WORKSPACE98765',
      type: 'OAUTH_TOKEN_EXPIRED',
      severity: 'medium' as const,
      message: 'Google Workspace access token expired',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'open' as const,
      agent: 'WorkspaceManager',
      operation: 'accessGoogleDrive',
      metadata: {
        service: 'Google Drive',
        tokenExpiresAt: '2025-01-16T08:44:32Z',
        refreshAttempted: true
      }
    },
    {
      id: '01JYMBD8456NETWORK123456',
      type: 'NETWORK_TIMEOUT',
      severity: 'medium' as const,
      message: 'Connection timeout to GitHub API',
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      status: 'resolved' as const,
      agent: 'CodeAnalyzer',
      operation: 'fetchRepository',
      metadata: {
        repository: 'microsoft/vscode',
        timeoutDuration: '30s',
        retryAttempts: 3
      },
      resolutionNotes: 'Resolved after GitHub API maintenance window ended'
    },
    {
      id: '01JYMBD8457VALIDATION789',
      type: 'VALIDATION_ERROR',
      severity: 'low' as const,
      message: 'Invalid webhook payload format from Slack',
      timestamp: new Date(Date.now() - 18000000).toISOString(),
      status: 'ignored' as const,
      agent: 'SlackIntegration',
      operation: 'processWebhook',
      metadata: {
        expectedFormat: 'application/json',
        receivedFormat: 'text/plain',
        payloadSize: '1.2KB'
      },
      resolutionNotes: 'Known issue with Slack test webhooks, not affecting production'
    }
  ];
}

function getMockStatistics(): ErrorStatistics {
  return {
    totalErrors: 187,
    resolvedErrors: 155,
    criticalErrors: 8,
    newErrorsToday: 31,
    averageResolutionTime: '4.1h',
    resolutionRate: 83.0,
    errorsByType: {
      'API_ERROR': 45,
      'DATABASE_ERROR': 32,
      'NETWORK_ERROR': 28,
      'AUTHENTICATION_ERROR': 23,
      'VALIDATION_ERROR': 18,
      'SYSTEM_ERROR': 15,
      'EMAIL_SERVICE_ERROR': 12,
      'OTHER': 14
    },
    errorsBySeverity: {
      'critical': 8,
      'high': 34,
      'medium': 89,
      'low': 56
    },
    errorsOverTime: [
      { date: '2025-01-10', count: 12 },
      { date: '2025-01-11', count: 18 },
      { date: '2025-01-12', count: 15 },
      { date: '2025-01-13', count: 22 },
      { date: '2025-01-14', count: 28 },
      { date: '2025-01-15', count: 34 },
      { date: '2025-01-16', count: 31 }
    ]
  };
}

// API Route Handlers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('dateRange') || '24h';
    const action = searchParams.get('action');
    const severityFilter = searchParams.get('severity');
    const statusFilter = searchParams.get('status');
    const typeFilter = searchParams.get('errorType');
    const searchQuery = searchParams.get('search');

    logger.info('Error API GET request', { dateRange, action, severityFilter, statusFilter, typeFilter, searchQuery });

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
        mockErrors = mockErrors.filter(error => error.type === typeFilter);
      }
      if (searchQuery) {
        mockErrors = mockErrors.filter(error =>
          error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
          error.agent?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          error.operation?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Handle statistics request separately
      if (action === 'statistics') {
        return NextResponse.json({
          success: true,
          statistics: mockStats
        });
      }

      // Handle regular error list request
      return NextResponse.json({
        success: true,
        errors: mockErrors
      });
    } else {
      // Using real database data
      if (action === 'statistics') {
        const statistics = await getStatisticsFromDatabase();
        return NextResponse.json({
          success: true,
          statistics
        });
      }

      const errors = await getErrorsFromDatabase({
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        errorType: typeFilter || undefined,
        dateRange,
        searchQuery: searchQuery || undefined
      });

      return NextResponse.json({
        success: true,
        errors
      });
    }

  } catch (error: any) {
    logger.error('Error in GET /api/errors:', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, errorId, resolutionNotes } = body;

    logger.info('Error API POST request', { action, errorId, resolutionNotes });

    if (USE_MOCK_DATA) {
      // Mock response for actions
      return NextResponse.json({
        success: true,
        message: `Error ${errorId} ${action} successfully (mock)`,
        data: { errorId, action, timestamp: new Date().toISOString() }
      });
    } else {
      // Real database operations
      try {
        // Safety check: verify database connection
        await prisma.$queryRaw`SELECT 1`;

        // Check if the error exists before trying to update it
        const existingError = await prisma.errorLog.findUnique({
          where: { id: errorId }
        });

        if (!existingError) {
          return NextResponse.json(
            { success: false, error: 'Error not found in database' },
            { status: 404 }
          );
        }
      } catch (connectionError) {
        return NextResponse.json(
          { success: false, error: 'Database connection failed' },
          { status: 503 }
        );
      }

      switch (action) {
        case 'resolve':
          await prisma.errorLog.update({
            where: { id: errorId },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date(),
              resolvedBy: 'admin', // TODO: Get from auth context
              resolutionNotes: resolutionNotes || 'Manually resolved',
              resolutionMethod: 'MANUAL_FIX'
            }
          });

          // Create resolution record
          await prisma.errorResolution.create({
            data: {
              errorLogId: errorId,
              resolutionType: 'MANUAL_FIX',
              description: resolutionNotes || 'Manually resolved via dashboard',
              appliedBy: 'admin', // TODO: Get from auth context
              timeToResolve: 0 // TODO: Calculate based on creation time
            }
          });
          break;

        case 'ignore':
          await prisma.errorLog.update({
            where: { id: errorId },
            data: {
              status: 'IGNORED',
              resolvedAt: new Date(),
              resolvedBy: 'admin', // TODO: Get from auth context
              resolutionNotes: resolutionNotes || 'Manually ignored',
              resolutionMethod: 'IGNORE'
            }
          });
          break;

        case 'retry':
          await prisma.errorLog.update({
            where: { id: errorId },
            data: {
              status: 'RETRYING',
              retryAttempt: { increment: 1 },
              lastRetryAt: new Date()
            }
          });
          break;

        default:
          return NextResponse.json(
            { success: false, error: 'Invalid action' },
            { status: 400 }
          );
      }

      return NextResponse.json({
        success: true,
        message: `Error ${errorId} ${action} successfully`,
        data: { errorId, action, timestamp: new Date().toISOString() }
      });
    }

  } catch (error: any) {
    logger.error('Error in POST /api/errors:', { error: error.message, stack: error.stack });
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    );
  }
} 