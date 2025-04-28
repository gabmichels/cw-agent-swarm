import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the line from the request body
    const { line, pageId = 'canvas-12gCwjgwEO' } = await request.json();
    
    if (!line) {
      return NextResponse.json(
        { success: false, error: 'Line content is required' },
        { status: 400 }
      );
    }
    
    try {
      // First read the existing content
      const existingContent = await codaIntegration.readDoc(pageId);
      
      if (!existingContent) {
        return NextResponse.json(
          { success: false, error: `No content found for page ID: ${pageId}` },
          { status: 404 }
        );
      }
      
      // Append the new line
      const timestamp = new Date().toLocaleString();
      const newLine = `${line} (Added at ${timestamp})`;
      const newContent = `${existingContent}\n\n${newLine}`;
      
      // Update the document
      await codaIntegration.updateDoc(pageId, newContent);
      
      return NextResponse.json({
        success: true,
        message: `Successfully appended line to Coda page ${pageId}`,
        pageId,
        lineAdded: newLine
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('disabled')) {
        return NextResponse.json(
          { success: false, error: 'Coda integration is not enabled. Check your API key.' },
          { status: 500 }
        );
      }
      throw error; // Re-throw for the outer catch
    }
  } catch (error) {
    console.error('Error appending line to Coda page:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 