import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { title } = await request.json();
    const docTitle = title || `Test Document - ${new Date().toLocaleString()}`;
    
    try {
      const content = `# ${docTitle}\n\nThis is a test document created on ${new Date().toLocaleString()}.\n\n## Content\nThis document was created using the Coda API integration test tool.`;
      
      const doc = await codaIntegration.createDoc(docTitle, content);
      
      return NextResponse.json({ 
        success: true, 
        docId: doc.id,
        browserLink: doc.browserLink,
        name: doc.name,
        message: "Successfully created Coda document"
      });
    } catch (error) {
      console.error('Error creating Coda document:', error);
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
        error: "Failed to create Coda document. " + errorMessage
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