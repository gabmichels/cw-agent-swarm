import { NextResponse } from 'next/server';
import { fileProcessor } from '../../../../lib/file-processing';

/**
 * GET handler for listing all files
 */
export async function GET() {
  try {
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Get all files
    const files = fileProcessor.getAllFiles();
    
    // Sort by upload date (newest first)
    files.sort((a, b) => {
      const dateA = new Date(a.uploadDate);
      const dateB = new Date(b.uploadDate);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Return file list
    return NextResponse.json({
      success: true,
      files: files.map(file => ({
        fileId: file.fileId,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.uploadDate,
        processingStatus: file.processingStatus,
        summary: file.summary,
        tags: file.tags
      }))
    });
  } catch (error: any) {
    console.error('Error listing files:', error);
    
    return NextResponse.json(
      { success: false, error: `Failed to list files: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 