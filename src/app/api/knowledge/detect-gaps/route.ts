import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGapsManager } from '../../../../agents/chloe/core/knowledgeGapsManager';
import { getChloeInstance } from '../../../../agents/chloe';
import { logger } from '../../../../lib/logging';

/**
 * POST handler for detecting knowledge gaps in a conversation
 * 
 * Body parameters:
 * - messages: Array of conversation messages (required)
 * - samplingProbability: Probability to analyze this conversation (optional)
 * - minMessages: Minimum number of messages for analysis (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, samplingProbability, minMessages } = body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Valid conversation messages are required' },
        { status: 400 }
      );
    }
    
    // Get the Chloe agent instance
    const chloe = await getChloeInstance();
    
    // Access the knowledge gaps manager from Chloe
    // Note: In a production environment, we should check if this exists
    // and initialize it if needed
    const knowledgeGapsManager = chloe.getKnowledgeGapsManager();
    
    if (!knowledgeGapsManager) {
      return NextResponse.json(
        { error: 'Knowledge gaps manager not initialized' },
        { status: 500 }
      );
    }
    
    // Process the conversation for knowledge gaps
    const result = await knowledgeGapsManager.processConversation({ messages });
    
    // If knowledge gaps were detected, return them
    if (result) {
      const gaps = await knowledgeGapsManager.getUnresolvedKnowledgeGaps();
      
      return NextResponse.json({
        success: true,
        gapsDetected: true,
        gaps: gaps.slice(0, 5) // Return only the 5 most recent gaps
      });
    }
    
    // No gaps were detected
    return NextResponse.json({
      success: true,
      gapsDetected: false,
      gaps: []
    });
    
  } catch (error) {
    logger.error(`Error detecting knowledge gaps: ${error}`);
    return NextResponse.json(
      { error: 'Failed to detect knowledge gaps' },
      { status: 500 }
    );
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
    const chloe = await getChloeInstance();
    
    // Access the knowledge gaps manager
    const knowledgeGapsManager = chloe.getKnowledgeGapsManager();
    
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