import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');

    if (!userId && !organizationId) {
      return NextResponse.json(
        { error: 'Either userId or organizationId is required' },
        { status: 400 }
      );
    }

    const workspaceService = new WorkspaceService();

    let connections;
    if (userId) {
      connections = await workspaceService.getUserConnections(userId);
    } else if (organizationId) {
      connections = await workspaceService.getOrganizationConnections(organizationId);
    }

    return NextResponse.json({
      success: true,
      connections: connections || []
    });

  } catch (error) {
    console.error('Error fetching workspace connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
} 