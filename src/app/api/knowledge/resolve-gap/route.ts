import { NextRequest, NextResponse } from 'next/server';
import { AgentService } from '../../../../services/AgentService';

export const runtime = 'nodejs';

/**
 * POST handler for resolving a knowledge gap
 * 
 * Body parameters:
 * - id: The ID of the knowledge gap to resolve (required)
 * - resolution: The resolution text (required)
 */
export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();
    const { gapId, agentId = 'chloe' } = requestData;
    
    if (!gapId) {
      return NextResponse.json({ 
        error: 'Missing required gapId field' 
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
        error: `Agent ${agentId} does not support knowledge gap resolution` 
      }, { status: 400 });
    }
    
    // Resolve the knowledge gap
    const result = await agent.knowledgeGapsManager.resolveKnowledgeGap(gapId);
    
    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error resolving knowledge gap:', error);
    return NextResponse.json({ 
      error: 'Internal server error resolving knowledge gap' 
    }, { status: 500 });
  }
} 