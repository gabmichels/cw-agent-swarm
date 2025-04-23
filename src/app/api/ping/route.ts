// Simple ping endpoint to check server health

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
} 