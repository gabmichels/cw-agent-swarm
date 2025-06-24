import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { AddParticipantsRequest, ChatParticipant } from '@/lib/multi-agent/types/chat';

/**
 * POST /api/multi-agent/chats/{chatId}/participants
 * Adds participants to a chat
 */
export async function POST(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const chatId = (await params).chatId;
    
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // Parse request body
    const requestData: AddParticipantsRequest = await request.json();
    
    if (!requestData.participants || !Array.isArray(requestData.participants) || requestData.participants.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one participant is required' },
        { status: 400 }
      );
    }
    
    // TODO: Check if the chat exists
    // This will be implemented when the database infrastructure is ready
    
    // Create participant records
    const timestamp = new Date();
    const participants: ChatParticipant[] = requestData.participants.map(participant => ({
      id: `participant_${ulid()}`,
      chatId,
      participantId: participant.participantId,
      participantType: participant.participantType,
      role: participant.role,
      joinedAt: timestamp,
      lastActiveAt: timestamp
    }));
    
    // TODO: Store participants in the database
    // This will be implemented when the database infrastructure is ready
    
    return NextResponse.json({
      success: true,
      message: 'Participants added successfully',
      participants
    });
  } catch (error) {
    console.error('Error adding participants:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/multi-agent/chats/{chatId}/participants
 * Gets participants of a chat
 */
export async function GET(
  request: Request,
  { params }: { params: { chatId: string } }
) {
  try {
    const chatId = (await params).chatId;
    
    if (!chatId) {
      return NextResponse.json(
        { success: false, error: 'Chat ID is required' },
        { status: 400 }
      );
    }
    
    // TODO: Fetch participants from the database
    // This will be implemented when the database infrastructure is ready
    // For now, return an empty array
    
    return NextResponse.json({
      success: true,
      participants: []
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      },
      { status: 500 }
    );
  }
} 