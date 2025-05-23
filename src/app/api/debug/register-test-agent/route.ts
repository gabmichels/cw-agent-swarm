import { NextResponse } from 'next/server';

/**
 * Debug API endpoint to manually register a test agent
 */
export async function POST() {
  try {
    console.log('🔧 Manual agent registration requested...');
    
    // Import agent service functions
    const { registerAgent, getAllAgents } = await import('../../../../server/agent/agent-service');
    
    // Check current agent count
    const existingAgents = getAllAgents();
    console.log(`📊 Current agents in registry: ${existingAgents.length}`);
    
    // Create a functional test agent
    const testAgent = {
      getId: () => 'manual-test-agent',
      getAgentId: () => 'manual-test-agent',
      getHealth: async () => ({ 
        status: 'healthy' as const,
        message: 'Test agent is healthy',
        timestamp: new Date()
      }),
      planAndExecute: async (options: any) => {
        console.log('🤖 Test agent executing task:', options.goal || 'No goal provided');
        
        // Simulate task execution
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          task: { 
            status: 'complete',
            id: options.taskId || 'test-task'
          },
          finalResult: { 
            success: true, 
            message: 'Test agent execution successful',
            executedAt: new Date(),
            goal: options.goal
          }
        };
      },
      constructor: { name: 'ManualTestAgent' },
      
      // Additional methods that might be expected
      getName: () => 'Manual Test Agent',
      getType: () => 'test-agent',
      initialize: async () => {
        console.log('✅ Test agent initialized');
        return true;
      }
    };
    
    // Register the test agent
    registerAgent(testAgent as any);
    
    // Verify registration
    const updatedAgents = getAllAgents();
    const registered = updatedAgents.find(a => {
      try {
        return a.getId() === 'manual-test-agent';
      } catch (e) {
        return false;
      }
    });
    
    console.log(`✅ Test agent registration complete. Total agents: ${updatedAgents.length}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test agent registered successfully',
      agentId: 'manual-test-agent',
      agentType: 'ManualTestAgent',
      previousAgentCount: existingAgents.length,
      currentAgentCount: updatedAgents.length,
      registered: !!registered,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Failed to register test agent:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 