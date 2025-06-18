import { NextResponse } from 'next/server';
// FileStateStorage import removed - not available

export async function GET() {
  // FileStateStorage service not available - return empty state following arch-refactor-guidelines
  const now = Date.now();
  
  const statesWithAge: Array<{
    state: string;
    data: any;
    ageMinutes: number;
  }> = [];
  
  return NextResponse.json({
    success: true,
    states: statesWithAge,
    count: 0,
    currentTime: new Date().toISOString(),
    note: 'FileStateStorage service not available'
  });
} 