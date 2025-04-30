import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const browserLink = body.browserLink;
    
    if (!browserLink) {
      return NextResponse.json({ 
        success: false, 
        error: "Browser link is required" 
      });
    }
    
    if (!browserLink.includes('coda.io')) {
      return NextResponse.json({ 
        success: false, 
        error: "Not a valid Coda URL" 
      });
    }
    
    try {
      const resource = await codaIntegration.resolveBrowserLink(browserLink);
      
      return NextResponse.json({ 
        success: true, 
        resource,
        message: "Successfully resolved Coda browser link"
      });
    } catch (error) {
      console.error('Error resolving Coda browser link:', error);
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
        error: "Failed to resolve Coda browser link. " + errorMessage
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