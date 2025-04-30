import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const line = body.line;
    const pageId = body.pageId || 'canvas-12gCwjgwEO'; // Default to the specified page if none provided
    
    if (!line) {
      return NextResponse.json({ 
        success: false, 
        error: "Line content is required" 
      });
    }
    
    try {
      // First read the existing document
      const existingContent = await codaIntegration.readDoc(pageId);
      
      if (!existingContent) {
        return NextResponse.json({ 
          success: false, 
          error: "Could not read existing document content" 
        });
      }
      
      // Append the new line with timestamp
      const timestamp = new Date().toLocaleString();
      const newContent = `${existingContent}\n\n[${timestamp}] ${line}`;
      
      // Update the document with the new content
      await codaIntegration.updateDoc(pageId, newContent);
      
      return NextResponse.json({ 
        success: true, 
        pageId,
        message: "Successfully appended line to Coda document"
      });
    } catch (error) {
      console.error('Error appending to Coda document:', error);
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
        error: "Failed to append line to Coda document. " + errorMessage
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