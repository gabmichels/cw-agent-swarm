import { NextRequest, NextResponse } from 'next/server';
import * as serverQdrant from '../../../../server/qdrant';

// Mark as server-side only
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { userId = 'default-user' } = data;

    console.log(`Attempting to reset chat history for user: ${userId}`);

    // Initialize Qdrant if needed
    if (!serverQdrant.isInitialized()) {
      await serverQdrant.initMemory();
    }

    // First get all messages for this user
    const allMessages = await serverQdrant.getRecentMemories('message', 1000);
    const userMessages = allMessages.filter(msg => 
      msg.metadata && msg.metadata.userId === userId
    );

    console.log(`Found ${userMessages.length} messages for user ${userId}`);

    // We don't have a specific function to delete by userId, so we'll reset the whole collection
    // and then re-add messages for other users if there are any
    await serverQdrant.resetCollection('message');
    console.log('Reset message collection');

    // Re-add messages for other users if there are any
    const otherUserMessages = allMessages.filter(msg => 
      msg.metadata && msg.metadata.userId !== userId
    );

    console.log(`Re-adding ${otherUserMessages.length} messages for other users`);
    
    // Re-add in batches to avoid timeouts
    const batchSize = 20;
    for (let i = 0; i < otherUserMessages.length; i += batchSize) {
      const batch = otherUserMessages.slice(i, i + batchSize);
      await Promise.all(batch.map(msg => 
        serverQdrant.addMemory('message', msg.text, msg.metadata)
      ));
      console.log(`Re-added batch ${i/batchSize + 1}/${Math.ceil(otherUserMessages.length/batchSize)}`);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully reset chat history for user ${userId}`,
      deletedMessageCount: userMessages.length
    });
  } catch (error) {
    console.error('Error resetting chat history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 