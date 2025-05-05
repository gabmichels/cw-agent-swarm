import { NextRequest, NextResponse } from 'next/server';
import { getMemoryServices } from '../../../server/memory/services';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET handler for memory system health check
 */
export async function GET(request: NextRequest) {
  try {
    // Try to initialize memory services
    const services = await getMemoryServices();
    
    // Check if all services are available
    const checks = {
      client: !!services.client,
      embeddingService: !!services.embeddingService,
      memoryService: !!services.memoryService,
      searchService: !!services.searchService
    };
    
    const allServicesAvailable = Object.values(checks).every(Boolean);
    
    if (!allServicesAvailable) {
      return NextResponse.json({
        status: 'error',
        message: 'Not all memory services are available',
        checks
      }, { status: 500 });
    }
    
    // Try to perform a simple database operation
    try {
      // Attempt a basic search with empty query
      const searchResults = await services.searchService.search('', { limit: 1 });
      
      return NextResponse.json({
        status: 'ok',
        message: 'Memory system is functioning properly',
        checks,
        searchResults: {
          success: true,
          count: searchResults.length
        }
      });
    } catch (dbError) {
      console.error('Error performing database check:', dbError);
      
      return NextResponse.json({
        status: 'error',
        message: 'Memory services initialized but database operation failed',
        error: dbError instanceof Error ? dbError.message : String(dbError),
        checks
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error initializing memory services:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to initialize memory services',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 