import { NextRequest, NextResponse } from 'next/server';
import { OpenAISearchService } from '../../../../lib/search/OpenAISearchService';
import { logger } from '../../../../lib/logging';

// Initialize the search service
const searchService = new OpenAISearchService();

/**
 * POST handler for performing advanced searches using OpenAI
 * 
 * Body parameters:
 * - query: The search query (required)
 * - type: The type of search ("standard", "research", "factCheck", "currentInfo") (optional, default: "standard")
 * - maxTokens: Maximum tokens for the response (optional)
 * - temperature: Temperature for the response (optional)
 * - detailedResults: Whether to return detailed results (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, type = 'standard', maxTokens, temperature, detailedResults } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }
    
    let result;
    
    // Use the appropriate search method based on the type
    switch (type) {
      case 'research':
        result = await searchService.researchTopic(query);
        break;
      case 'factCheck':
        result = await searchService.factCheck(query);
        break;
      case 'currentInfo':
        result = await searchService.getCurrentInfo(query);
        break;
      case 'standard':
      default:
        result = await searchService.search(query, {
          maxTokens,
          temperature,
          detailedResults
        });
        break;
    }
    
    // If there was an error in the search, return an error response
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      ...result,
      type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error in advanced search API: ${error}`);
    return NextResponse.json(
      { error: 'Failed to perform advanced search' },
      { status: 500 }
    );
  }
} 