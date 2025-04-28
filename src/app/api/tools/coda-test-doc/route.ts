import { NextRequest, NextResponse } from 'next/server';
import { codaIntegration } from '../../../../agents/chloe/tools/coda';

// Mark as server-side only
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the title from the request body
    const { title = "Test Document" } = await request.json();
    const content = `# ${title}\n\nThis is a test document created at ${new Date().toLocaleString()}.\n\n## Purpose\nThis document was created to test the Coda integration functionality.\n\n## Next Steps\nYou can edit this document or create new ones via the Coda API.`;
    
    try {
      const newDocId = await codaIntegration.createDoc(title, content);
      
      return NextResponse.json({
        success: true,
        docId: newDocId,
        title,
        message: 'Test document created successfully'
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
    console.error('Error creating Coda test document:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 