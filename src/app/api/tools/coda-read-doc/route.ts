import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get docId from the request body
    const { docId } = await request.json();
    
    if (!docId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      );
    }
    
    try {
      const docContent = await codaIntegration.readDoc(docId);
      
      return NextResponse.json({
        success: true,
        content: docContent
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
    console.error('Error reading Coda document:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 