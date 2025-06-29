import { NextResponse } from 'next/server';
import { createAgentMemoryService } from '../../../../../../server/memory/services/multi-agent';
import { getMemoryServices } from '../../../../../../server/memory/services';
import { WebSocketNotificationService } from '../../../../../../server/websocket/notification-service';

/**
 * GET handler - get agent by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const awaitedParams = await params; const { agentId } = await params;

    console.log(`API DEBUG: GET multi-agent/system/agents/${agentId}`);

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const services = await getMemoryServices();
    const agentService = await createAgentMemoryService(services);
    const response = await agentService.getById(agentId);

    if (response.isError || !response.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ agent: response.data });
  } catch (error) {
    console.error(`Error getting agent:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler - update agent
 */
export async function PUT(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = await params;

    console.log(`API DEBUG: PUT multi-agent/system/agents/${agentId}`);
    const updateData = await request.json();

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const services = await getMemoryServices();
    const agentService = await createAgentMemoryService(services);

    // Check if agent exists
    const checkResponse = await agentService.getById(agentId);

    if (checkResponse.isError || !checkResponse.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Add updated timestamp
    const updatedData = {
      ...updateData,
      updatedAt: new Date()
    };

    const response = await agentService.update(agentId, updatedData);

    if (response.isError || !response.data) {
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }

    // Send WebSocket notification
    WebSocketNotificationService.notifyAgentUpdated(response.data, updateData.userId);

    return NextResponse.json({ agent: response.data });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler - partially update agent (status or capabilities)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = await params;

    console.log(`API DEBUG: PATCH multi-agent/system/agents/${agentId}`);
    const updateData = await request.json();

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const services = await getMemoryServices();
    const agentService = await createAgentMemoryService(services);

    // Check if agent exists
    const checkResponse = await agentService.getById(agentId);

    if (checkResponse.isError || !checkResponse.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    let response;

    // Update status if provided
    if (updateData.status) {
      response = await agentService.updateAgentStatus(agentId, updateData.status);
    }

    // Update capabilities if provided
    if (updateData.capabilities) {
      response = await agentService.updateAgentCapabilities(agentId, updateData.capabilities);
    }

    // General update for other fields
    if (!response && (Object.keys(updateData).length > 0)) {
      // Add updated timestamp
      const updatedData = {
        ...updateData,
        updatedAt: new Date()
      };

      response = await agentService.update(agentId, updatedData);
    }

    if (!response || response.isError || !response.data) {
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      );
    }

    // Send WebSocket notification
    if (updateData.status) {
      WebSocketNotificationService.notifyAgentStatusChanged(response.data, updateData.userId);
    } else {
      WebSocketNotificationService.notifyAgentUpdated(response.data, updateData.userId);
    }

    return NextResponse.json({ agent: response.data });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler - delete agent
 */
export async function DELETE(
  request: Request,
  { params }: { params: { agentId: string } }
) {
  try {
    const { agentId } = await params;

    console.log(`API DEBUG: DELETE multi-agent/system/agents/${agentId}`);

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    const services = await getMemoryServices();
    const agentService = await createAgentMemoryService(services);

    // Check if agent exists
    const checkResponse = await agentService.getById(agentId);

    if (checkResponse.isError || !checkResponse.data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    const response = await agentService.delete(agentId);

    if (response.isError || !response.data) {
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      );
    }

    // Send WebSocket notification - extract userId from the URL or request body if available
    let userId;
    try {
      const url = new URL(request.url);
      userId = url.searchParams.get('userId') || undefined;
    } catch (e) {
      // Ignore URL parsing errors
    }

    WebSocketNotificationService.notifyAgentDeleted(agentId, userId);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error(`Error in API operation:`, error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 