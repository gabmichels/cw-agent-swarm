import { NextResponse } from 'next/server';
import { getMemoryServices } from '@/server/memory/services';
import { createAgentMemoryService } from '@/server/memory/services/multi-agent';

/**
 * POST /api/multi-agent/agents/[agentId]/autonomy
 * Set autonomy mode for an agent
 */
export async function POST(
  request: Request,
  context: { params: { agentId: string } }
) {
  try {
    // Await params to address NextJS warning
    const params = await context.params;
    const agentId = params.agentId;
    const { enabled } = await request.json();

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Agent ID is required'
      }, { status: 400 });
    }

    // Get the agent
    const { memoryService } = await getMemoryServices();
    const agentService = await createAgentMemoryService(memoryService);

    const getResult = await agentService.getAgent(agentId);

    if (getResult.isError || !getResult.value) {
      return NextResponse.json({
        success: false,
        error: getResult.error?.message || 'Agent not found'
      }, { status: 404 });
    }

    const agent = getResult.value;

    // Update the agent with autonomous setting
    const updatedAgent = {
      ...agent,
      parameters: {
        ...agent.parameters,
        autonomous: enabled
      },
      updatedAt: new Date()
    };

    const updateResult = await agentService.updateAgent(updatedAgent);

    if (updateResult.isError) {
      return NextResponse.json({
        success: false,
        error: updateResult.error?.message || 'Failed to update agent'
      }, { status: 500 });
    }

    // Flag to track if runtime update succeeded
    let runtimeUpdateSucceeded = false;
    let runtimeWarning: string | null = null;

    // Trigger the autonomy system if needed
    try {
      // Use the current request URL to build the absolute URL for the system API
      const requestUrl = new URL(request.url);
      const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

      // Make a request to the agent system to set autonomy mode
      const agentSystemResponse = await fetch(`${baseUrl}/api/agents/${agentId}/system/autonomy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      // Check response
      if (agentSystemResponse.ok) {
        // Parse the response body
        const systemResponseData = await agentSystemResponse.json();

        // Check if there was a warning
        if (systemResponseData.warning) {
          runtimeWarning = systemResponseData.warning;
          console.warn(`Runtime update warning: ${runtimeWarning}`);
        } else {
          runtimeUpdateSucceeded = true;
        }
      } else {
        runtimeWarning = `Failed to set autonomy mode at the agent system level: ${agentSystemResponse.statusText}`;
        console.warn(runtimeWarning);
      }
    } catch (error) {
      runtimeWarning = `Error setting autonomy mode at agent system level: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(runtimeWarning);
      // Don't fail the entire request if just the agent system call fails
    }

    return NextResponse.json({
      success: true,
      agent: updateResult.value,
      message: `Autonomous mode ${enabled ? 'enabled' : 'disabled'} for agent ${agentId}`,
      runtimeUpdateSucceeded,
      ...(runtimeWarning ? { warning: runtimeWarning } : {})
    });

  } catch (error) {
    console.error(`Error setting autonomy mode for agent:`, error);

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 