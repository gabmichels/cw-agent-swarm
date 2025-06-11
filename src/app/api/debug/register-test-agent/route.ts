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
    
    // Import DefaultAgent to create a real agent instance
    const { DefaultAgent } = await import('../../../../agents/shared/DefaultAgent');
    
    // Create a real DefaultAgent instance
    const testAgent = new DefaultAgent({
      id: 'manual-test-agent',
      name: 'Manual Test Agent',
      description: 'A test agent created for debugging purposes',
      type: 'test-agent',
      enableMemoryManager: true,
      enablePlanningManager: true,
      enableToolManager: true,
      enableSchedulerManager: true,
      enableInputProcessor: true,
      enableOutputProcessor: true,
      systemPrompt: 'You are a helpful test agent. Respond to user messages in a friendly and helpful manner.',
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000
    });
    
    // Initialize the agent
    console.log('🔄 Initializing test agent...');
    const initResult = await testAgent.initialize();
    
    if (!initResult) {
      throw new Error('Failed to initialize test agent');
    }
    
    console.log('✅ Test agent initialized successfully');
    
    // Register the test agent
    registerAgent(testAgent);
    
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
      agentType: 'DefaultAgent',
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