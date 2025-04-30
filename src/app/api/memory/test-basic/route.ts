// Simple test endpoint for memory

import { NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Basic memory test endpoint is working',
    timestamp: new Date().toISOString()
  });
} 