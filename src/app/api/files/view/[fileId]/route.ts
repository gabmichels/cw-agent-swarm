import { NextRequest, NextResponse } from 'next/server';
import { fileProcessor } from '../../../../../lib/file-processing/index';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GET handler for serving file content
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    // Access params safely by ensuring the context.params is awaited if it's a promise
    const params = await context.params;
    const fileId = params?.fileId ? String(params.fileId) : null;
    
    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'No file ID provided' },
        { status: 400 }
      );
    }
    
    // Initialize file processor if needed
    if (!fileProcessor.isInitialized) {
      await fileProcessor.initialize();
    }
    
    // Get file metadata
    const fileMetadata = fileProcessor.getFileById(fileId);
    
    if (!fileMetadata) {
      return NextResponse.json(
        { success: false, error: `File not found: ${fileId}` },
        { status: 404 }
      );
    }
    
    // Check if we have a local file for this ID
    const fileStoragePath = path.join(process.cwd(), 'data', 'files', 'storage', fileId);
    
    if (fs.existsSync(fileStoragePath)) {
      // Read the file
      const fileContent = fs.readFileSync(fileStoragePath);
      
      // Set appropriate content type
      const headers = new Headers();
      headers.set('Content-Type', fileMetadata.mimeType);
      headers.set('Content-Disposition', `inline; filename="${fileMetadata.filename}"`);
      
      // Return the file content
      return new NextResponse(fileContent, {
        status: 200,
        headers
      });
    }
    
    // For now, return a placeholder for images if we don't have the actual file
    if (fileMetadata.mimeType.startsWith('image/')) {
      const placeholderImage = `
        <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="300" fill="#f0f0f0"/>
          <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle">
            Image: ${fileMetadata.filename}
          </text>
        </svg>
      `;
      
      const headers = new Headers();
      headers.set('Content-Type', 'image/svg+xml');
      
      return new NextResponse(placeholderImage, {
        status: 200,
        headers
      });
    }
    
    // For other file types, return metadata
    return NextResponse.json({
      success: true,
      fileId: fileMetadata.fileId,
      filename: fileMetadata.filename,
      mimeType: fileMetadata.mimeType,
      size: fileMetadata.size,
      uploadDate: fileMetadata.uploadDate,
      message: "File content is not directly accessible"
    });
  } catch (error: any) {
    console.error('Error serving file:', error);
    
    return NextResponse.json(
      { success: false, error: `Failed to serve file: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 