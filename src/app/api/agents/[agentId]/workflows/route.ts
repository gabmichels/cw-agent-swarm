import { NextRequest, NextResponse } from 'next/server';

// GET /api/agents/[agentId]/workflows - Get all workflows assigned to an agent
export async function GET(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // For now, return empty array as we don't have workflow assignments in DB yet
    // TODO: Implement actual workflow assignment storage when ready
    const workflows: any[] = [];

    return NextResponse.json({
      success: true,
      workflows,
      count: workflows.length,
      agentId
    });

  } catch (error) {
    console.error('Error fetching agent workflows:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch workflows',
        success: false
      },
      { status: 500 }
    );
  }
}

// POST /api/agents/[agentId]/workflows - Assign a workflow to an agent
export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = await params;
    const body = await request.json();
    const { workflowId } = body;

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
    // TODO: Implement actual workflow assignment storage when ready
    console.log(`Assigning workflow ${workflowId} to agent ${agentId}`);

    return NextResponse.json({
      success: true,
      message: 'Workflow assigned successfully',
      agentId,
      workflowId,
      assignedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error assigning workflow to agent:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to assign workflow',
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
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 