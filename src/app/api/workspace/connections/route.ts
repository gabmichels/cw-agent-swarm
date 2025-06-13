import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');

    const workspaceService = new WorkspaceService();

    let connections;
    if (userId) {
      connections = await workspaceService.getUserConnections(userId);
    } else if (organizationId) {
      connections = await workspaceService.getOrganizationConnections(organizationId);
    } else {
      // If no specific user or organization is requested, return all connections
      // This is useful for development and when user context is not available
      connections = await workspaceService.getAllConnections();
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