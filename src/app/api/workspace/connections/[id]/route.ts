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
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const workspaceService = new WorkspaceService();

    // Revoke the connection
    await workspaceService.revokeConnection(id);

    return NextResponse.json({
      success: true,
      message: 'Connection revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking workspace connection:', error);

    if (error instanceof Error && error.message === 'Connection not found') {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to revoke connection' },
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