import { NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Test agent initialization
export async function GET() {
  try {
    console.log('Testing agent imports and initialization');
    
    return NextResponse.json({
      success: true,
      message: "Agent system has been refactored. Use MCP system for agent creation.",
      info: "Check the documentation for using the new Multi-Agent Control Plane.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in agent debug route:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, {
      status: 500
    });
  }
} 