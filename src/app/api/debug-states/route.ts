import { NextResponse } from 'next/server';
import { fileStateStorage } from '@/services/social-media/providers/base/FileStateStorage';

export async function GET() {
  const entries = fileStateStorage.entries();
  const now = Date.now();
  
  const statesWithAge = entries.map(([state, data]) => ({
    state,
    data,
    ageMinutes: Math.round((now - data.timestamp) / (1000 * 60))
  }));
  
  return NextResponse.json({
    success: true,
    states: statesWithAge,
    count: entries.length,
    currentTime: new Date().toISOString()
  });
} 