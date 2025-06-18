import { NextResponse } from 'next/server';
import { getFileService } from '@/lib/storage';
import { getStorageConfig } from '@/lib/storage/config';
import { StorageProvider } from '@/lib/storage/StorageService';
import { prisma } from '@/lib/prisma';

// Helper function to create a response with CORS headers
function createCorsResponse(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

/**
 * GET handler for retrieving stored files
 * This endpoint tries multiple strategies to serve files:
 * 1. Generate a signed URL for cloud storage (MinIO, GCP, AWS, Azure)
 * 2. Redirect to local API endpoint for local storage
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ bucket: string; fileId: string }> | { bucket: string; fileId: string } }
) {
  try {
    // Extract params - properly await the params object
    const params = await context.params;
    const bucket = params.bucket;
    const fileId = params.fileId;
    
    // Verify this is a valid file request
    const attachment = await prisma.chatAttachment.findFirst({
      where: { 
        url: { contains: fileId }
      }
    });
    
    if (!attachment) {
      return NextResponse.json(
        { error: 'File not found' },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }
    
    // Get storage configuration
    const storageConfig = getStorageConfig();
    
    // For local storage provider, redirect to our local file serving endpoint
    if (storageConfig.provider === StorageProvider.LOCAL) {
      const localEndpoint = `/api/files/local/${fileId}`;
      const response = NextResponse.redirect(new URL(localEndpoint, request.url));
      
      // Add CORS headers to the response
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return response;
    }
    
    // For MinIO and other cloud providers, use presigned URLs
    const fileService = getFileService();
    
    try {
      // Generate a signed URL with short expiry (15 minutes)
      const url = await fileService.getPublicUrl(fileId, 15);
      
      // Redirect to the signed URL
      const response = NextResponse.redirect(url);
      
      // Add CORS headers to the response
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      return response;
    } catch (storageError) {
      console.error('Error generating signed URL:', storageError);
      
      // If MinIO fails, try falling back to local storage if the file exists there
      if (storageConfig.provider === StorageProvider.MINIO) {
        const localEndpoint = `/api/files/local/${fileId}`;
        console.log(`MinIO URL generation failed. Falling back to local storage: ${localEndpoint}`);
        
        const response = NextResponse.redirect(new URL(localEndpoint, request.url));
        
        // Add CORS headers to the response
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return response;
      }
      
      throw storageError; // Re-throw to be caught by outer try/catch
    }
  } catch (error: unknown) {
    console.error('Error retrieving file:', error);
    return NextResponse.json(
      { error: `Error retrieving file: ${error instanceof Error ? error.message : String(error)}` },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
} 