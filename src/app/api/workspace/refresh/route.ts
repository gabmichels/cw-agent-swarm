import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../services/workspace/WorkspaceService';
import { DatabaseService } from '../../../../services/database/DatabaseService';

interface RefreshRequest {
  connectionId: string;
  force?: boolean; // Allow refresh even for expired connections
}

export async function POST(request: NextRequest) {
  try {
    const body: RefreshRequest = await request.json();
    
    // Validate required fields
    if (!body.connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const workspaceService = new WorkspaceService();
    const db = DatabaseService.getInstance();

    // Get the connection to check its current status
    const connection = await db.getWorkspaceConnection(body.connectionId);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    if (!connection.refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available. Please reconnect.' },
        { status: 400 }
      );
    }

    console.log(`Manual refresh attempt for connection ${body.connectionId} (${connection.email}) - Status: ${connection.status}`);

    // Attempt to refresh the connection
    const refreshResult = await workspaceService.refreshConnection(body.connectionId);

    if (refreshResult.success) {
      console.log(`✓ Successfully refreshed expired connection for ${connection.email}`);
      
      // Get the updated connection
      const updatedConnection = await db.getWorkspaceConnection(body.connectionId);
      
      return NextResponse.json({
        success: true,
        message: 'Connection refreshed successfully',
        connection: {
          id: updatedConnection?.id,
          email: updatedConnection?.email,
          status: updatedConnection?.status,
          tokenExpiresAt: updatedConnection?.tokenExpiresAt,
          provider: updatedConnection?.provider
        }
      });
    } else {
      console.error(`✗ Failed to refresh connection for ${connection.email}:`, refreshResult.error);
      
      return NextResponse.json({
        success: false,
        error: refreshResult.error,
        message: 'Token refresh failed. You may need to reconnect.'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error refreshing workspace connection:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to refresh connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Use POST to refresh a workspace connection' },
    { status: 405 }
  );
} 