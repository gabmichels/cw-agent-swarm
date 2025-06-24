import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/agents/[agentId]/workflows/[workflowId] - Remove a workflow from an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string; workflowId: string } }
) {
  try {
    const { agentId, workflowId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    // For now, just return success
    // TODO: Implement actual workflow removal from storage when ready
    console.log(`Removing workflow ${workflowId} from agent ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'Workflow removed successfully',
      agentId,
      workflowId,
      removedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error removing workflow from agent:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to remove workflow',
        success: false
      },
      { status: 500 }
    );
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 