import { NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test agent initialization
export async function GET() {
  try {
    console.log('Testing agent imports and initialization');
    
    // Import the agent dynamically
    const { ChloeAgent } = await import('../../../../agents/chloe');
    
    // Create a test agent instance with minimal config
    const testAgent = new ChloeAgent({
      config: {
        systemPrompt: 'You are a test assistant for debugging purposes.',
        model: 'openai/gpt-4.1-2025-04-14',
        temperature: 0.5,
        maxTokens: 2000
      }
    });
    
    // Check if agent instance was created correctly
    let initializationSuccessful = false;
    let errorMessage = null;
    
    try {
      // Just initialize the agent to test imports
      await testAgent.initialize();
      initializationSuccessful = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error initializing test agent:', error);
    }
    
    return NextResponse.json({
      success: true,
      agentCreated: !!testAgent,
      initializationSuccessful,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error testing agent imports:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
} 