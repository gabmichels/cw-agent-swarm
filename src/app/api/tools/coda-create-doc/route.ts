import { codaIntegration } from '../../../../agents/shared/tools/integrations/coda';
import { NextRequest, NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';

/**
 * API endpoint to create a new Coda doc
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content } = body;
    
    if (!title || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields: title and content must be provided' 
      }, { status: 400 });
    }
    
    const docId = await codaIntegration.createDoc(title, content);
    
    return NextResponse.json({ success: true, docId });
  } catch (error) {
    console.error('Error creating Coda doc:', error);
    return NextResponse.json({ 
      error: 'Failed to create Coda doc',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 