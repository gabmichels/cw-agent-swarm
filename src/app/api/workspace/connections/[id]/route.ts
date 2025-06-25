import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceService } from '../../../../../services/workspace/WorkspaceService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    console.log('DELETE request received for connection revocation');

    const { id } = await params;
    console.log('Connection ID from params:', id);

    if (!id) {
      console.error('Missing connection ID in request');
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    console.log('Initializing WorkspaceService...');
    const workspaceService = new WorkspaceService();

    console.log('Calling revokeConnection with ID:', id);
    // Revoke the connection
    const result = await workspaceService.revokeConnection(id);
    console.log('RevokeConnection result:', result);

    if (result.success) {
      console.log('Connection revoked successfully');
      return NextResponse.json({
        success: true,
        message: 'Connection revoked successfully'
      });
    } else {
      console.error('RevokeConnection returned failure:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to revoke connection'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in DELETE endpoint:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
      stringified: String(error)
    });

    if (error instanceof Error && error.message === 'Connection not found') {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to revoke connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const workspaceService = new WorkspaceService();

    // Validate the connection
    const validation = await workspaceService.validateConnection(id);

    return NextResponse.json({
      success: true,
      validation
    });

  } catch (error) {
    console.error('Error validating workspace connection:', error);
    return NextResponse.json(
      { error: 'Failed to validate connection' },
      { status: 500 }
    );
  }
} 