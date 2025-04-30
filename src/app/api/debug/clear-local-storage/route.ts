import { NextRequest, NextResponse } from 'next/server';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This route just returns instructions for the client to clear local storage
// The actual clearing happens on the client side since localStorage is browser-specific
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Instructions for clearing local storage',
      storagesToClear: [
        'crowd-wisdom-saved-attachments',
        'crowd-wisdom-image-data'
      ],
      instructions: [
        "localStorage.removeItem('crowd-wisdom-saved-attachments')",
        "localStorage.removeItem('crowd-wisdom-image-data')"
      ]
    });
  } catch (error) {
    console.error('Error generating clear local storage instructions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 