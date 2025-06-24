import { NextResponse } from 'next/server';

/**
 * Debug API endpoint to manually trigger agent bootstrap
 */
export async function POST() {
  try {
    console.log('🚀 Manual bootstrap triggered via API...');
    
    // Import and call the bootstrap function
    const { bootstrapAgentsFromDatabase } = await import('../../../../server/agent/bootstrap-agents');
    
    console.log('📋 Starting bootstrap process...');
    const agentCount = await bootstrapAgentsFromDatabase();
    
    console.log(`✅ Bootstrap completed: ${agentCount} agents loaded`);
    
    // Get registry stats after bootstrap
    const { getAllAgents, getRegistryStats, debugAgentRegistry } = await import('../../../../server/agent/agent-service');
    const agents = getAllAgents();
    const stats = getRegistryStats();
    const debugInfo = debugAgentRegistry();
    
    return NextResponse.json({
      success: true,
      message: `Successfully bootstrapped ${agentCount} agents`,
      agentCount,
      registryStats: stats,
      agents: agents.map((agent: any) => ({
        id: agent.getAgentId(),
        type: agent.constructor.name,
        hasProcessUserInput: typeof (agent as any).processUserInput === 'function'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Manual bootstrap failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Get current bootstrap status
 */
export async function GET() {
  try {
    // Get current registry status
    const { getAllAgents, getRegistryStats } = await import('../../../../server/agent/agent-service');
    const agents = getAllAgents();
    const stats = getRegistryStats();
    
    return NextResponse.json({
      success: true,
      currentAgentCount: agents.length,
      registryStats: stats,
      agents: agents.map((agent: any) => ({
        id: agent.getAgentId(),
        type: agent.constructor.name,
        hasProcessUserInput: typeof (agent as any).processUserInput === 'function'
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 