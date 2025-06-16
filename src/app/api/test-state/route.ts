import { NextRequest, NextResponse } from 'next/server';
import { globalStateStorage } from '@/services/social-media/providers/base/GlobalStateStorage';

export async function POST(request: NextRequest) {
  try {
    const { action, key, value } = await request.json();
    
    if (action === 'set') {
      globalStateStorage.set(key, {
        tenantId: value.tenantId || 'test',
        userId: value.userId || 'test',
        timestamp: Date.now()
      });
      return NextResponse.json({ success: true, message: 'State set' });
    }
    
    if (action === 'get') {
      const data = globalStateStorage.get(key);
      return NextResponse.json({ success: true, data, found: !!data });
    }
    
    if (action === 'list') {
      const entries = Array.from(globalStateStorage.entries());
      return NextResponse.json({ success: true, entries, count: entries.length });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const entries = Array.from(globalStateStorage.entries());
  return NextResponse.json({ 
    success: true, 
    entries, 
    count: entries.length,
    message: 'Global state storage contents'
  });
} 