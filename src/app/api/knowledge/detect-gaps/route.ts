import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '../../../../services/AgentService';
import { logger } from '../../../../lib/logging';

/**
 * POST handler for detecting knowledge gaps in a conversation
 * 
 * Body parameters:
 * - messages: Array of conversation messages (required)
 * - samplingProbability: Probability to analyze this conversation (optional)
 * - minMessages: Minimum number of messages for analysis (optional)
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Extract the text from the request
    const requestData = await request.json();
    const { text, agentId = 'chloe' } = requestData;
    
    if (!text) {
      return NextResponse.json({ 
        error: 'Missing required text field' 
      }, { status: 400 });
    }
    
    // Get the agent instance
    const agent = await AgentService.getAgent(agentId);
    
    if (!agent) {
      return NextResponse.json({ 
        error: `Agent with ID ${agentId} not found` 
      }, { status: 404 });
    }
    
    // Check if the agent has a knowledge gaps manager
    if (!agent.knowledgeGapsManager) {
      return NextResponse.json({ 
        error: `Agent ${agentId} does not support knowledge gap detection` 
      }, { status: 400 });
    }
    
    // Detect knowledge gaps in the text
    const knowledgeGaps = await agent.knowledgeGapsManager.detectKnowledgeGaps(text);
    
    return NextResponse.json({
      knowledgeGaps,
      success: true
    });
  } catch (error) {
    console.error('Error detecting knowledge gaps:', error);
    return NextResponse.json({ 
      error: 'Internal server error detecting knowledge gaps' 
    }, { status: 500 });
  }
}

/**
 * GET handler for retrieving knowledge gaps
 * 
 * Query parameters:
 * - limit: Maximum number of gaps to return (optional)
 * - resolved: Whether to include resolved gaps (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit');
    const resolvedStr = searchParams.get('resolved');
    
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const includeResolved = resolvedStr === 'true';
    
    // Get the Chloe agent instance
    const chloe = await AgentService.getAgent('chloe');
    
    // Access the knowledge gaps manager
    const knowledgeGapsManager = chloe.knowledgeGapsManager;
    
    if (!knowledgeGapsManager) {
      return NextResponse.json(
        { error: 'Knowledge gaps manager not initialized' },
        { status: 500 }
      );
    }
    
    // Get the knowledge gaps
    const gaps = await knowledgeGapsManager.getUnresolvedKnowledgeGaps();
    
    // Generate a summary of the knowledge gaps
    const summary = await knowledgeGapsManager.generateKnowledgeGapSummary();
    
    return NextResponse.json({
      gaps: gaps.slice(0, limit),
      totalGaps: gaps.length,
      summary
    });
    
  } catch (error) {
    logger.error(`Error retrieving knowledge gaps: ${error}`);
    return NextResponse.json(
      { error: 'Failed to retrieve knowledge gaps' },
      { status: 500 }
    );
  }
} 