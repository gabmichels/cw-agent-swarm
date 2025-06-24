import { NextResponse } from 'next/server';
import { getStorageConfig } from '@/lib/storage/config';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';

// Cache of base64 encoded files to improve performance
interface Base64Cache {
  [key: string]: {
    data: string;
    timestamp: Date;
    mimeType: string;
  }
}

// In-memory cache for base64 encoded images - expires after 1 hour
const base64Cache: Base64Cache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Optimize image for vision processing
 * @param buffer Image buffer
 * @param mimeType Original MIME type
 * @returns Optimized image buffer
 */
async function optimizeImageForVision(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer, mimeType: string }> {
  try {
    // Don't optimize non-image files
    if (!mimeType.startsWith('image/')) {
      return { buffer, mimeType };
    }
    
    // Use sharp to resize large images and convert to webp for better compression
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    // If image is larger than 4000px in any dimension, resize it while maintaining aspect ratio
    if ((metadata.width && metadata.width > 4000) || (metadata.height && metadata.height > 4000)) {
      image.resize({ 
        width: Math.min(metadata.width || 4000, 4000),
        height: Math.min(metadata.height || 4000, 4000),
        fit: 'inside'
      });
    }
    
    // Convert to WebP for better compression
    const webpBuffer = await image.webp({ quality: 80 }).toBuffer();
    
    return { 
      buffer: webpBuffer,
      mimeType: 'image/webp'
    };
  } catch (error) {
    console.error('Error optimizing image:', error);
    // Return original on any error
    return { buffer, mimeType };
  }
}

/**
 * Make sure storage directory exists
 * @param config Storage configuration
 * @returns Object with paths to storage directories
 */
function ensureStorageDirectoryExists(config: {localStoragePath?: string}): {localStoragePath: string, bucketPath: string} {
  try {
    const localStoragePath = config.localStoragePath || path.join(process.cwd(), 'storage');
    const bucketPath = path.join(localStoragePath, 'chat-attachments');
    
    // Create parent directory if it doesn't exist
    if (!fs.existsSync(localStoragePath)) {
      console.log(`Creating storage directory: ${localStoragePath}`);
      fs.mkdirSync(localStoragePath, { recursive: true });
    }
    
    // Create bucket directory if it doesn't exist
    if (!fs.existsSync(bucketPath)) {
      console.log(`Creating chat attachments directory: ${bucketPath}`);
      fs.mkdirSync(bucketPath, { recursive: true });
    }
    
    return { localStoragePath, bucketPath };
  } catch (error) {
    console.error('Error ensuring storage directory exists:', error);
    // Return default paths even if creation failed
    const localStoragePath = path.join(process.cwd(), 'storage');
    const bucketPath = path.join(localStoragePath, 'chat-attachments');
    return { localStoragePath, bucketPath };
  }
}

/**
 * Get cached base64 data for file or generate and cache it
 * @param fileId File ID to get base64 data for
 * @returns Object with base64 data and mimeType
 */
async function getOrCreateBase64Data(fileId: string): Promise<{ base64: string, mimeType: string } | null> {
  try {
    // Check if we have a valid cache entry that hasn't expired
    const cacheEntry = base64Cache[fileId];
    if (cacheEntry) {
      const now = new Date();
      const expirationTime = new Date(cacheEntry.timestamp.getTime() + CACHE_TTL_MS);
      
      if (now < expirationTime) {
        return { 
          base64: cacheEntry.data,
          mimeType: cacheEntry.mimeType
        };
      }
      
      // Clear expired entry
      delete base64Cache[fileId];
    }
    
    // Get storage configuration
    const config = getStorageConfig();
    
    // Ensure storage directory exists and get paths
    const { bucketPath } = ensureStorageDirectoryExists(config);
    const filePath = path.join(bucketPath, fileId);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // If file doesn't exist and we're in local development, create a placeholder for testing
      if (process.env.NODE_ENV === 'development') {
        console.warn(`File not found, creating placeholder for testing: ${filePath}`);
        
        // Create a 1x1 transparent PNG as placeholder
        const placeholderBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        
        // Generate a placeholder image for testing
        const placeholderBuffer = Buffer.from(placeholderBase64, 'base64');
        
        try {
          await fs.promises.writeFile(filePath, placeholderBuffer);
          console.log(`Created placeholder file for testing: ${filePath}`);
        } catch (writeError) {
          console.error(`Failed to create placeholder file: ${writeError}`);
        }
      } else {
        console.warn(`File not found for base64 encoding: ${filePath}`);
        return null;
      }
    }
    
    // Get file from database to determine MIME type
    const attachment = await prisma.chatAttachment.findFirst({
      where: { 
        url: { contains: fileId }
      }
    });
    
    // Default MIME type if not found in database
    const defaultMimeType = 'image/png';
    
    // Read the file
    const fileBuffer = await fs.promises.readFile(filePath);
    
    // Optimize if it's an image
    const { buffer: optimizedBuffer, mimeType } = await optimizeImageForVision(
      fileBuffer, 
      attachment?.type || defaultMimeType
    );
    
    // Convert to base64
    const base64Data = optimizedBuffer.toString('base64');
    
    // Cache the result
    base64Cache[fileId] = {
      data: base64Data,
      timestamp: new Date(),
      mimeType
    };
    
    return { 
      base64: base64Data,
      mimeType
    };
  } catch (error) {
    console.error('Error creating base64 data:', error);
    
    // Return a simple placeholder in case of error
    try {
      // Create minimal base64 data for a 1x1 transparent PNG as emergency fallback
      const placeholderBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      return {
        base64: placeholderBase64,
        mimeType: 'image/png'
      };
    } catch (fallbackError) {
      console.error('Error creating fallback placeholder:', fallbackError);
      return null;
    }
  }
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
      'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

/**
 * API route to directly serve files from local storage
 * This is a fallback for when MinIO/cloud storage is not configured
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> | { fileId: string } }
) {
  try {
    // Properly await the params object
    const params = await context.params;
    const fileId = (await params).fileId;
    
    // Check if the request wants base64 data (for direct vision API usage)
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    const isBase64Request = format === 'base64';
    
    // If base64 is requested, use the cached or generated base64 data
    if (isBase64Request) {
      const base64Data = await getOrCreateBase64Data(fileId);
      
      if (!base64Data) {
        return NextResponse.json(
          { error: 'File not found or could not be converted to base64' },
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
      
      // Return the base64 data
      return NextResponse.json(
        { 
          base64: base64Data.base64,
          mimeType: base64Data.mimeType
        },
        { 
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          }
        }
      );
    }
    
    // Verify this is a valid file request by checking in the database
    const attachment = await prisma.chatAttachment.findFirst({
      where: { 
        url: { contains: fileId }
      }
    });
    
    if (!attachment) {
      return NextResponse.json(
        { error: 'File not found in database' },
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
    const config = getStorageConfig();
    
    // Determine file path in local storage
    const localStoragePath = config.localStoragePath || path.join(process.cwd(), 'storage');
    const bucketPath = path.join(localStoragePath, 'chat-attachments');
    const filePath = path.join(bucketPath, fileId);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found in local storage' },
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
    
    // Read the file
    const fileBuffer = await fs.promises.readFile(filePath);
    
    // Return the file with appropriate content type
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': attachment.type || 'application/octet-stream',
        'Content-Disposition': `inline; filename="file-${fileId}"`,
        // Add cache control headers to improve performance
        'Cache-Control': 'public, max-age=86400',
        // Add CORS headers to allow access from OpenAI's vision API
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error: unknown) {
    console.error('Error serving local file:', error);
    return NextResponse.json(
      { error: `Error serving file: ${error instanceof Error ? error.message : String(error)}` },
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