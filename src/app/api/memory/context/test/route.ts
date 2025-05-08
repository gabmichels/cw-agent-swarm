/**
 * API test endpoint for memory context
 */
import { NextRequest, NextResponse } from 'next/server';
import { testMemoryContexts } from '../test';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET endpoint to test memory context functionality
 * This is a development/testing endpoint only
 * 
 * @param request The Next.js request object
 * @returns A JSON response with test results
 */
export async function GET(_request: NextRequest) {
  try {
    // Run the memory context tests
    const results = await testMemoryContexts();
    
    return NextResponse.json({
      success: results.success,
      results,
      message: 'Memory context tests completed'
    });
  } catch (error) {
    console.error('Error testing memory contexts:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 