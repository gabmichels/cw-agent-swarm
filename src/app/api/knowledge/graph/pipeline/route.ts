import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeGraph } from '../../../../../lib/knowledge/KnowledgeGraph';
import { KnowledgeFlaggingService } from '../../../../../lib/knowledge/flagging/KnowledgeFlaggingService';
import { KnowledgeGraphService } from '../../../../../lib/knowledge/KnowledgeGraphService';
import { logger } from '../../../../../lib/logging';

/**
 * Process all approved flagged knowledge items and add them to the knowledge graph
 * Implements Milestone 4.1: Knowledge Addition Pipeline
 */
export async function POST(req: NextRequest) {
  try {
    // Get the request body to check for specific options
    const body = await req.json();
    const { itemId, processAll, generateRelationships } = body;
    
    // Initialize the knowledge graph and services
    const knowledgeGraph = new KnowledgeGraph('default');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    const graphService = new KnowledgeGraphService(knowledgeGraph);
    
    // Load flagged items
    await flaggingService.load();
    
    let results = [];
    
    // Process specific item if itemId is provided
    if (itemId) {
      logger.info(`Processing specific flagged item: ${itemId}`);
      const result = await flaggingService.processApprovedItem(itemId);
      results.push(result);
    }
    // Process all approved items if requested
    else if (processAll) {
      logger.info('Processing all approved flagged items');
      results = await flaggingService.processAllApprovedItems();
    }
    else {
      return NextResponse.json(
        { error: 'No action specified. Please provide itemId or set processAll to true' },
        { status: 400 }
      );
    }
    
    // Generate relationship suggestions if requested
    let relationshipSuggestions = [];
    if (generateRelationships) {
      logger.info('Generating relationship suggestions');
      
      // Get all concepts
      const concepts = knowledgeGraph.getAllConcepts();
      
      // Generate relationship suggestions for up to 5 recent concepts
      const recentConcepts = concepts.slice(0, 5);
      
      for (const concept of recentConcepts) {
        const suggestions = await graphService.generateRelationshipSuggestions(concept.id);
        relationshipSuggestions.push({
          conceptId: concept.id,
          conceptName: concept.name,
          suggestions
        });
      }
    }
    
    // Count successes and failures
    const successes = results.filter(result => result.success).length;
    const failures = results.filter(result => !result.success).length;
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      successes,
      failures,
      details: results,
      relationshipSuggestions: relationshipSuggestions.length > 0 ? relationshipSuggestions : undefined
    });
  } catch (error) {
    logger.error('Error processing knowledge items:', error);
    return NextResponse.json(
      { error: 'Failed to process knowledge items' },
      { status: 500 }
    );
  }
}

/**
 * Get quality scores for knowledge items
 */
export async function GET(req: NextRequest) {
  try {
    // Initialize services
    const knowledgeGraph = new KnowledgeGraph('default');
    const graphService = new KnowledgeGraphService(knowledgeGraph);
    
    // Get item ID from query params if provided
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    
    if (itemId) {
      // Get quality score for specific item
      const score = graphService.getQualityScore(itemId);
      
      if (!score) {
        return NextResponse.json(
          { error: `No quality score found for item ${itemId}` },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        itemId,
        qualityScore: score
      });
    }
    
    // Return overall stats if no specific item requested
    return NextResponse.json({
      success: true,
      message: "Use ?itemId=xxx to get quality score for a specific item"
    });
  } catch (error) {
    logger.error('Error retrieving quality scores:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve quality scores' },
      { status: 500 }
    );
  }
}

/**
 * Apply a suggested relationship to the knowledge graph
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { suggestion } = body;
    
    if (!suggestion || !suggestion.sourceId || !suggestion.targetId) {
      return NextResponse.json(
        { error: 'Invalid relationship suggestion' },
        { status: 400 }
      );
    }
    
    // Initialize services
    const knowledgeGraph = new KnowledgeGraph('default');
    const graphService = new KnowledgeGraphService(knowledgeGraph);
    
    // Apply the relationship suggestion
    const relationshipId = graphService.applyRelationshipSuggestion(suggestion);
    
    if (!relationshipId) {
      return NextResponse.json(
        { error: 'Failed to apply relationship suggestion' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      relationshipId,
      suggestion
    });
  } catch (error) {
    logger.error('Error applying relationship suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to apply relationship suggestion' },
      { status: 500 }
    );
  }
} 