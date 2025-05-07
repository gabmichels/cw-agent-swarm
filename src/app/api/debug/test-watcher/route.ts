import { NextRequest, NextResponse } from 'next/server';
import { getChloeInstance } from '../../../../agents/chloe';

/**
 * API endpoint to test the markdown file watcher
 */
export async function GET(request: NextRequest) {
  try {
    // Get Chloe instance
    const chloe = await getChloeInstance();
    
    if (!chloe) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to get Chloe instance' 
      }, { status: 500 });
    }
    
    // Get the markdown manager from the agent
    const markdownManager = chloe.getMarkdownManager?.();
    
    if (!markdownManager) {
      return NextResponse.json({ 
        success: false, 
        error: 'Markdown manager is not available' 
      }, { status: 500 });
    }
    
    // Test the file watcher
    console.log('Testing markdown file watcher...');
    const testResult = await markdownManager.testFileWatcher();
    
    return NextResponse.json({
      success: true,
      message: 'Test file watcher process started',
      result: testResult
    });
  } catch (error) {
    console.error('Error testing markdown watcher:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
} 