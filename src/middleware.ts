import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware function to handle API route compatibility 
 * between Next.js Pages Router and App Router
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Only process API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  console.log(`[Middleware] Processing API request to: ${pathname}`);
  
  // Check for memory API routes that were moved to App Router
  if (pathname === '/api/memory' || pathname.startsWith('/api/memory/')) {
    console.log(`[Middleware] Memory API request to ${pathname}`);
    
    // Get the request headers
    const hasAppRouterHeader = request.headers.get('x-use-app-router') === 'true';
    
    if (hasAppRouterHeader) {
      console.log(`[Middleware] Request has x-use-app-router header, forwarding to App Router`);
      
      // If we have the special header, modify the request URL to ensure it gets routed to App Router
      // This works together with the rewrites in next.config.js
      const url = request.nextUrl.clone();
      url.pathname = `/src/app${pathname}/route`;
      
      return NextResponse.rewrite(url);
    } else {
      console.log(`[Middleware] Standard memory request, letting Next.js decide routing`);
    }
  }
  
  // For all other API routes, proceed normally
  return NextResponse.next();
}

// Configure middleware to run on specific paths
export const config = {
  matcher: ['/api/:path*'],
}; 