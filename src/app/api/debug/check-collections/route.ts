import { NextResponse } from 'next/server';
import { checkCollections } from '@/server/memory/scripts/check-collections';

/**
 * GET /api/debug/check-collections
 * Debug endpoint to check collection status
 */
export async function GET() {
  try {
    // Capture logs 
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    // Override console methods to capture logs
    console.log = (...args) => {
      logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
      originalConsoleLog(...args);
    };
    
    console.error = (...args) => {
      logs.push(`ERROR: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
      originalConsoleError(...args);
    };
    
    // Run collection check
    await checkCollections();
    
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    // Return results
    return NextResponse.json({ 
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error checking collections:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 