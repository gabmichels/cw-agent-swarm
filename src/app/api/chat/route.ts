import { NextRequest, NextResponse } from 'next/server';
import { getChloeInstance } from '../../../agents/chloe';
import * as serverQdrant from '../../../server/qdrant';
import { GET } from './proxy';

// Add server-only markers to prevent client-side execution
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Handler function to process messages through Chloe
async function handler(message: string, options: {
  userId: string;
  rememberMessage: boolean;
  attachments?: any[];
  visionResponseFor?: string;
}) {
  // Initialize Chloe agent if needed
  const agent = await getChloeInstance();
  
  if (!agent) {
    throw new Error('Failed to initialize Chloe agent');
  }
  
  // Process the message
  const response = await agent.processMessage(message, { 
    userId: options.userId, 
    attachments: options.attachments 
  });
  
  return response;
}

// Use our own implementation for POST
export async function POST(req: NextRequest) {
  // Check if Qdrant is initialized
  if (!serverQdrant.isInitialized()) {
    try {
      await serverQdrant.initMemory();
    } catch (error) {
      console.error('Failed to initialize Qdrant:', error);
      return NextResponse.json(
        { error: 'Failed to initialize memory system' },
        { status: 500 }
      );
    }
  }

  try {
    const data = await req.json();
    const { message, userId, attachments } = data;

    console.log(`Chat request from user ${userId}`, {
      messageLength: message?.length || 0,
      hasAttachments: !!attachments && attachments.length > 0,
      attachmentsCount: attachments?.length || 0
    });

    // Get Chloe instance
    const agent = await getChloeInstance();
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Failed to initialize agent' },
        { status: 500 }
      );
    }

    // Process the message through the Chloe agent
    const response = await agent.processMessage(message, {
      userId,
      attachments
    });

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

// Export the GET function from the proxy
export { GET }; 