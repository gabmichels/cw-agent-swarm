import { codaIntegration } from '../../../../agents/shared/tools/integrations/coda';
import { NextRequest, NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';

/**
 * API endpoint to read a Coda doc
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { docId } = body;
    
    if (!docId) {
      return NextResponse.json({ 
        error: 'Missing required field: docId must be provided' 
      }, { status: 400 });
    }
    
    const docContent = await codaIntegration.readDoc(docId);
    
    return NextResponse.json({ success: true, content: docContent });
  } catch (error) {
    console.error('Error reading Coda doc:', error);
    return NextResponse.json({ 
      error: 'Failed to read Coda doc',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 