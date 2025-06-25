import { NextRequest, NextResponse } from 'next/server';
import { WorkflowImportService } from '../../../../../services/workflow/WorkflowImportService';
import { logger } from '../../../../../lib/logging';

/**
 * GET /api/workflows/user-workflows/[connectionId]
 * Discover workflows in user's N8N account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
): Promise<NextResponse> {
  try {
    const { connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    logger.info('Starting workflow discovery for user account', { connectionId });

    // Initialize the import service
    const importService = new WorkflowImportService();

    // Discover workflows in user's account
    const result = await importService.discoverUserWorkflows(connectionId);

    logger.info('Workflow discovery completed', {
      connectionId,
      workflowCount: result.totalCount
    });

    return NextResponse.json({
      success: true,
      workflows: result.workflows,
      totalCount: result.totalCount,
      lastSyncAt: result.lastSyncAt,
      connectionId
    });

  } catch (error) {
    logger.error('Workflow discovery API error', {
      connectionId: (await params).connectionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
        workflows: [],
        totalCount: 0
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows/user-workflows/[connectionId]
 * Sync workflows between user's N8N account and our platform
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
): Promise<NextResponse> {
  try {
    const { connectionId } = await params;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    logger.info('Starting workflow sync for user account', { connectionId });

    // Initialize the import service
    const importService = new WorkflowImportService();

    // Sync workflows
    const result = await importService.syncUserWorkflows(connectionId);

    logger.info('Workflow sync completed', {
      connectionId,
      workflowCount: result.totalCount
    });

    return NextResponse.json({
      success: true,
      workflows: result.workflows,
      totalCount: result.totalCount,
      lastSyncAt: result.lastSyncAt,
      connectionId,
      message: 'Workflows synced successfully'
    });

  } catch (error) {
    logger.error('Workflow sync API error', {
      connectionId: (await params).connectionId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
        workflows: [],
        totalCount: 0
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
} 