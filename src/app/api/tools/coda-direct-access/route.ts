import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/shared/tools/integrations/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;
    const url = body.url;
    
    if (!id && !url) {
      return NextResponse.json({ 
        success: false, 
        error: "Either document ID or URL is required" 
      });
    }
    
    try {
      let docId = id;
      
      // If URL is provided, resolve it first
      if (url) {
        const resource = await codaIntegration.resolveBrowserLink(url);
        docId = resource.id;
      }
      
      // Try to read the document with the ID
      const content = await codaIntegration.readDoc(docId);
      
      return NextResponse.json({ 
        success: true, 
        docId,
        content,
        message: "Successfully accessed Coda document with direct ID"
      });
    } catch (error) {
      console.error('Error accessing Coda document:', error);
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
        error: "Failed to access Coda document. " + errorMessage
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