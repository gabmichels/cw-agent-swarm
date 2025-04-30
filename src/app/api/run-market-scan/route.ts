import { NextRequest, NextResponse } from 'next/server';
import { createMarketScanner } from '../../../agents/chloe/tools/marketScanner';

export const dynamic = 'force-dynamic';

/**
 * POST handler to run a market scan directly
 * 
 * Request body:
 * {
 *   "categories": ["Travel", "Marketing"] // optional array of categories to scan
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categories = body.categories || undefined;
    
    console.log('Starting market scan with categories:', categories || 'all');
    
    const scanner = createMarketScanner();
    const scanCount = await scanner.runMarketScan(categories);
    
    console.log('Market scan complete, processed signals:', scanCount);
    
    return NextResponse.json({
      success: true,
      message: `Market scan complete! Processed ${scanCount} signals${categories ? ` in categories: ${categories.join(', ')}` : ''}.`,
      count: scanCount
    });
  } catch (error) {
    console.error('Error running market scan:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to run market scan',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 