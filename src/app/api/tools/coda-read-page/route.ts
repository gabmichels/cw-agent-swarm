import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pageId = body.pageId || 'canvas-12gCwjgwEO'; // Default to the specified page if none provided
    
    if (!pageId) {
      return NextResponse.json({ 
        success: false, 
        error: "Page ID is required" 
      });
    }
    
    try {
      const content = await codaIntegration.readDoc(pageId);
      
      return NextResponse.json({ 
        success: true, 
        pageId,
        content,
        message: "Successfully read Coda page"
      });
    } catch (error) {
      console.error('Error reading Coda page:', error);
      // If the error is about Coda integration being disabled, provide a clearer message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Coda integration is disabled')) {
        return NextResponse.json({ 
          success: false, 
          error: "Coda integration is not enabled. Please check your CODA_API_KEY."
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: "Failed to read Coda page. " + errorMessage
      });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ 
      success: false, 
      error: "Error processing request" 
    });
  }
} 