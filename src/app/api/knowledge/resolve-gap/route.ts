import { NextRequest, NextResponse } from 'next/server';
import { getChloeInstance } from '../../../../agents/chloe';
import { logger } from '../../../../lib/logging';

/**
 * POST handler for resolving a knowledge gap
 * 
 * Body parameters:
 * - id: The ID of the knowledge gap to resolve (required)
 * - resolution: The resolution text (required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, resolution } = body;
    
    if (!id || !resolution) {
      return NextResponse.json(
        { error: 'Knowledge gap ID and resolution are required' },
        { status: 400 }
      );
    }
    
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
    
    // Resolve the knowledge gap
    const result = await knowledgeGapsManager.resolveKnowledgeGap(id, resolution);
    
    if (!result) {
      return NextResponse.json(
        { error: `Failed to resolve knowledge gap with ID: ${id}` },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: `Knowledge gap resolved successfully`
    });
    
  } catch (error) {
    logger.error(`Error resolving knowledge gap: ${error}`);
    return NextResponse.json(
      { error: 'Failed to resolve knowledge gap' },
      { status: 500 }
    );
  }
} 