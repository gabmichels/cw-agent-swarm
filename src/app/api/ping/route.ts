import { NextResponse } from 'next/server';

export async function GET() {
  // Simple ping endpoint that doesn't depend on any imports
  return NextResponse.json({
    status: 'success',
    message: 'API server is running',
    timestamp: new Date().toISOString(),
    source: 'server'
  });
} 