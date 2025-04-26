import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../../lib/file-processing';

/**
 * POST handler for deleting a file
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Get file ID from request body
    const { fileId } = await request.json();
    
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'No file ID provided' },
        { status: 400 }
      );
    }
    
    // Check if file exists
    const file = fileProcessor.getFileById(fileId);
    if (!file) {
      return NextResponse.json(
        { success: false, error: `File not found: ${fileId}` },
        { status: 404 }
      );
    }
    
    // Delete the file
    const deleted = await fileProcessor.deleteFile(fileId);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `Failed to delete file: ${fileId}` },
        { status: 500 }
      );
    }
    
    // Return success
    return NextResponse.json({
      success: true,
      message: `File deleted: ${fileId}`
    });
  } catch (error: any) {
    console.error('Error deleting file:', error);
    
    return NextResponse.json(
      { success: false, error: `Failed to delete file: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 