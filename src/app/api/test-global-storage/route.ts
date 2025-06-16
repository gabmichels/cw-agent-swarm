import { NextRequest, NextResponse } from 'next/server';
import { globalStateStorage } from '@/services/social-media/providers/base/GlobalStateStorage';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'test') {
      // Test storing and retrieving
      const testKey = 'test_' + Date.now();
      const testData = {
        tenantId: 'test_tenant',
        userId: 'test_user',
        timestamp: Date.now()
      };
      
      console.log('Before set - storage entries:', Array.from(globalStateStorage.entries()).length);
      
      globalStateStorage.set(testKey, testData);
      
      console.log('After set - storage entries:', Array.from(globalStateStorage.entries()).length);
      
      const retrieved = globalStateStorage.get(testKey);
      
      console.log('Retrieved data:', retrieved);
      
      return NextResponse.json({
        success: true,
        testKey,
        stored: testData,
        retrieved,
        match: JSON.stringify(testData) === JSON.stringify(retrieved),
        allEntries: Array.from(globalStateStorage.entries())
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 