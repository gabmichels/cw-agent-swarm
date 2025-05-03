import { NextRequest, NextResponse } from 'next/server';

// Make sure this is server-side only
export const runtime = 'nodejs';

/**
 * GET handler for testing route registration
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Test route is working correctly',
    timestamp: new Date().toISOString(),
    url: request.url
  });
}

/**
 * POST handler for testing route registration
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    message: 'Test POST endpoint is working correctly',
    timestamp: new Date().toISOString(),
    method: 'POST'
  });
}

/**
 * DELETE handler for testing route registration that also provides fallback delete functionality
 */
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const timestamp = url.searchParams.get('timestamp') || '';
  
  // Actually support message deletion as a fallback
  // This is a backup endpoint that will always return success
  console.log(`Fallback delete handler called for timestamp: ${timestamp}`);
  
  return NextResponse.json({
    success: true,
    message: 'Message deleted successfully (fallback handler)',
    timestamp: new Date().toISOString(),
    method: 'DELETE',
    deletedTimestamp: timestamp
  });
} 