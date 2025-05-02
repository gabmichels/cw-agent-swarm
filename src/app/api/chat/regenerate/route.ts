import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';
import { flagAsUnreliable } from '../../../utils/memory';
import { generateResponse } from '../../../utils/chatHandler';

export const runtime = 'nodejs';

/**
 * API endpoint to regenerate an AI response after flagging the previous one as unreliable
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messageId, avoidContent, timestamp } = body;

    if (!avoidContent) {
      return NextResponse.json(
        { success: false, error: 'Content to avoid is required' },
        { status: 400 }
      );
    }

    // First, flag the unreliable content if not already done
    await flagAsUnreliable(avoidContent, messageId, timestamp);
    
    // Get conversation context
    // This is a placeholder - in a real implementation, you'd retrieve recent conversation history
    // Either from a state manager or from the memory system
    
    // Generate new response
    // For this example, we'll just return success; in a real implementation, 
    // you would use your chat handler to generate a new response
    
    return NextResponse.json({
      success: true,
      message: 'Response will be regenerated',
      regenerating: true
    });
    
  } catch (error) {
    console.error('Error regenerating response:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate response' },
      { status: 500 }
    );
  }
} 