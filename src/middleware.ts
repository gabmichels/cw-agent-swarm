import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware function for API request logging
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Log memory API requests for debugging
  if (pathname === '/api/memory' || pathname.startsWith('/api/memory/')) {
    console.log(`[Middleware] Memory API request to ${pathname}`);
  }
  
  // Proceed with the request normally
  return NextResponse.next();
}

// Configure middleware to run on specific paths
export const config = {
  matcher: ['/api/:path*'],
}; 