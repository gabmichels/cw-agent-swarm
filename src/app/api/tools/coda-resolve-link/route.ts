import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the browser link from the request body
    const { browserLink } = await request.json();
    
    if (!browserLink) {
      return NextResponse.json(
        { success: false, error: 'Browser link is required' },
        { status: 400 }
      );
    }
    
    try {
      const resolvedResource = await codaIntegration.resolveBrowserLink(browserLink);
      
      // Extract the document ID from the href URL
      // Format is typically: https://coda.io/apis/v1/docs/{docId}/pages/{pageId}
      let docId = resolvedResource.id;
      const hrefParts = resolvedResource.href.split('/');
      const docsIndex = hrefParts.indexOf('docs');
      
      if (docsIndex !== -1 && docsIndex + 1 < hrefParts.length) {
        docId = hrefParts[docsIndex + 1];
      }
      
      return NextResponse.json({
        success: true,
        resource: resolvedResource,
        docId: docId,
        pageId: resolvedResource.id,
        name: resolvedResource.name,
        type: resolvedResource.type,
        apiLink: resolvedResource.href,
        browserLink: browserLink
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
    console.error('Error resolving Coda browser link:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 