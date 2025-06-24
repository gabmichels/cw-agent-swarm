import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');

    console.log('Initializing WorkspaceService...');
    const workspaceService = new WorkspaceService();
    console.log('WorkspaceService initialized successfully');

    let connections;
    if (userId) {
      console.log(`Getting connections for user: ${userId}`);
      connections = await workspaceService.getUserConnections(userId);
    } else if (organizationId) {
      console.log(`Getting connections for organization: ${organizationId}`);
      connections = await workspaceService.getOrganizationConnections(organizationId);
    } else {
      console.log('Getting all connections');
      // If no specific user or organization is requested, return all connections
      // This is useful for development and when user context is not available
      connections = await workspaceService.getAllConnections();
    }

    console.log(`Found ${connections?.length || 0} connections`);

    return NextResponse.json({
      success: true,
      connections: connections || []
    });

  } catch (error) {
    console.error('Error fetching workspace connections:', error);

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : 'Unknown'
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch connections',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 