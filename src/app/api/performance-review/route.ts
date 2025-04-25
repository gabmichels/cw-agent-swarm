import { NextRequest, NextResponse } from 'next/server';

// Dynamically import the Chloe agent to avoid import errors
async function getChloeAgent() {
  try {
    // Try to dynamically import the agent
    const agentModule = await import('../../../agents/chloe/agent');
    
    if (!agentModule.ChloeAgent) {
      console.error('ChloeAgent not found in the imported module');
      return null;
    }
    
    // Check if we already have an instance
    let agent = (global as any).chloeAgent;
    
    if (!agent) {
      console.log('Creating new Chloe agent instance');
      const Agent = agentModule.ChloeAgent;
      agent = new Agent();
      await agent.initialize();
      (global as any).chloeAgent = agent;
    }
    
    return agent;
  } catch (error) {
    console.error('Error importing Chloe agent:', error);
    return null;
  }
}

/**
 * API endpoint to trigger a performance review manually
 */
export async function POST(request: NextRequest) {
  try {
    const agent = await getChloeAgent();
    
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not initialized' },
        { status: 500 }
      );
    }
    
    // Get review type from request
    const { reviewType } = await request.json();
    
    // Validate review type
    if (!reviewType || !['daily', 'weekly', 'monthly'].includes(reviewType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid review type. Must be one of: daily, weekly, monthly' 
        },
        { status: 400 }
      );
    }
    
    // Run the performance review
    const result = await agent.runPerformanceReview(reviewType);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in performance review endpoint:', error);
    
    return NextResponse.json(
      { success: false, error: `Failed to run performance review: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 