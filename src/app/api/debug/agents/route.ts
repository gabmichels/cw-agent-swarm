import { NextResponse } from 'next/server';

/**
 * Debug API endpoint to check agent registration status
 */
export async function GET() {
  try {
    // Import agent service functions
    const { getAllAgents, getRegistryStats, debugAgentRegistry } = await import('../../../../server/agent/agent-service');
    
    // Get current agent status
    const agents = getAllAgents();
    const stats = getRegistryStats();
    
    // Run debug function (this will also log to console)
    const debugInfo = debugAgentRegistry();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      agentCount: agents.length,
      registryStats: stats,
      debugInfo,
      agents: agents.map(agent => {
        try {
          return {
            id: agent.getId ? agent.getId() : agent.getAgentId(),
            type: agent.constructor.name,
            hasGetId: typeof agent.getId === 'function',
            hasGetHealth: typeof agent.getHealth === 'function',
            hasPlanAndExecute: typeof (agent as any).planAndExecute === 'function'
          };
        } catch (error) {
          return {
            error: 'Failed to examine agent',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      })
    });
  } catch (error) {
    console.error('Debug agents endpoint error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 