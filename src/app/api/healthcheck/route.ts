import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure this is never cached

export async function GET() {
  return NextResponse.json({ status: 'ok', time: new Date().toISOString() });
}

export async function HEAD() {
  // For HEAD requests, return a 200 OK status with no body
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
} 