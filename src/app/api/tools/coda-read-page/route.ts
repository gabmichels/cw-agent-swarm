import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the pageId or browserLink from the request body
    const { pageId, browserLink } = await request.json();
    
    // Check if we have either a pageId or browserLink
    if (!pageId && !browserLink) {
      return NextResponse.json(
        { success: false, error: 'Either Page ID or Browser Link is required' },
        { status: 400 }
      );
    }
    
    try {
      let docId = pageId;
      let pageIdentifier = null;
      
      // If a browser link is provided, resolve it first
      if (browserLink) {
        try {
          const resource = await codaIntegration.resolveBrowserLink(browserLink);
          
          // Extract the document ID from the href URL
          // Format is typically: https://coda.io/apis/v1/docs/{docId}/pages/{pageId}
          const hrefParts = resource.href.split('/');
          const docsIndex = hrefParts.indexOf('docs');
          
          if (docsIndex !== -1 && docsIndex + 1 < hrefParts.length) {
            docId = hrefParts[docsIndex + 1];
            
            // If it's a page type, store the page ID too
            if (resource.type === 'page') {
              pageIdentifier = resource.id;
            }
          } else {
            docId = resource.id; // Fallback to the resource ID
          }
        } catch (error) {
          return NextResponse.json(
            { success: false, error: `Failed to resolve browser link: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 400 }
          );
        }
      }
      
      console.log(`Reading Coda doc with ID: ${docId}, pageId: ${pageIdentifier || 'N/A'}`);
      const document = await codaIntegration.readDoc(docId);
      
      return NextResponse.json({
        success: true,
        document,
        docId,
        pageId: pageIdentifier,
        note: "Successfully read document. Note that Coda API requires document IDs without leading underscore."
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
    console.error('Error reading Coda page:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 