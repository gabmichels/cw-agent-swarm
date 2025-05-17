import { NextRequest, NextResponse } from 'next/server';
import { extractTags, TagExtractionOptions } from '@/utils/tagExtractor';

/**
 * POST /api/debug/tag-extraction
 * Debug endpoint to test tag extraction
 */
export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    
    if (!body.content) {
      return NextResponse.json({ 
        success: false, 
        error: 'Content is required' 
      }, { status: 400 });
    }
    
    // Configure extraction options
    const options: TagExtractionOptions = {
      maxTags: body.maxTags || 20,
      minConfidence: body.minConfidence || 0.4,
      existingTags: body.existingTags || []
    };
    
    // Extract tags
    const result = await extractTags(body.content, options);
    
    // Return results
    return NextResponse.json({
      success: true,
      tagResult: result,
      extractedTags: result.tags.map(tag => tag.text),
      content: body.content.substring(0, 100) + (body.content.length > 100 ? '...' : '')
    });
  } catch (error) {
    console.error('Error during tag extraction:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 