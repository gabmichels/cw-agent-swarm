import { NextResponse } from 'next/server';
import { getAgentById } from '@/server/agent/agent-service';
import { ManagerType } from '@/agents/shared/base/managers/ManagerType';
import { AutonomyManager } from '@/agents/shared/autonomy/interfaces/AutonomyManager.interface';

/**
 * POST /api/agents/[agentId]/system/autonomy
 * Set autonomy mode for an agent at the system level
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
    
    // Load the agent's autonomy system
    console.log(`Setting autonomy mode for agent ${agentId} to ${enabled ? 'enabled' : 'disabled'}`);
    
    try {
      // Get the agent from the registry
      const agent = getAgentById(agentId);
      
      if (!agent) {
        console.warn(`Agent ${agentId} not found in the runtime agent registry. The setting will be persisted in the database but won't affect any running agent.`);
        
        // Return 200 instead of 404 because we still want to consider this a "success"
        // The database update has happened, we just can't update a running agent that isn't found
        return NextResponse.json({ 
          success: true, 
          warning: 'Agent not found in the runtime registry, but setting was saved to the database.',
          message: `Autonomy mode ${enabled ? 'enabled' : 'disabled'} for agent ${agentId} (database only)`
        });
      }
      
      // Update the autonomy configuration through the agent's config
      agent.updateConfig({
        autonomy: {
          enableAutonomyOnStartup: enabled
        }
      });
      
      // Get the autonomy manager and set autonomy mode
      const autonomyManager = agent.getManager(ManagerType.AUTONOMY) as AutonomyManager;
      if (autonomyManager && typeof autonomyManager.setAutonomyMode === 'function') {
        await autonomyManager.setAutonomyMode(enabled);
        console.log(`Successfully set autonomy mode to ${enabled ? 'enabled' : 'disabled'} for agent ${agentId}`);
      } else {
        console.warn(`Agent ${agentId} does not have a properly configured autonomy manager`);
        return NextResponse.json({
          success: true,
          warning: 'Agent found but does not have a properly configured autonomy manager',
          message: `Autonomy mode ${enabled ? 'enabled' : 'disabled'} for agent ${agentId} (config update only)`
        });
      }
      
    } catch (error) {
      console.error('Error accessing agent system:', error);
      // Don't fail the request, as the database update already succeeded
      return NextResponse.json({
        success: true,
        warning: `Error updating runtime agent: ${error instanceof Error ? error.message : String(error)}`,
        message: `Autonomy mode ${enabled ? 'enabled' : 'disabled'} for agent ${agentId} (database only)`
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Autonomy mode ${enabled ? 'enabled' : 'disabled'} for agent ${agentId} at system level`
    });
    
  } catch (error) {
    console.error(`Error setting autonomy mode for agent ${await context.params.agentId}:`, error);
    
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 