import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/multi-agent/chats/[chatId]/messages
 * Returns all messages for a chat, or an empty array if none exist
 */
export async function GET(
  request: NextRequest,
  context: { params: { chatId: string } }
) {
  const params = await context.params;
  const chatId = params.chatId;
  try {
    // TODO: Replace with real message fetching logic
    // For now, always return an empty array for new chats
    // In production, fetch messages from your DB or memory service
    return NextResponse.json({ messages: [] });
  } catch (error) {
    return NextResponse.json({ messages: [] });
  }
} 