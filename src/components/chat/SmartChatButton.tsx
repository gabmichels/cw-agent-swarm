import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatCreationRequest, ChatVisibility } from '@/lib/multi-agent/types/chat';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import { MessageSquare, Plus } from 'lucide-react';

interface SmartChatButtonProps {
  agent: AgentProfile;
  userId: string;
  className?: string;
}

const SmartChatButton: React.FC<SmartChatButtonProps> = ({
  agent,
  userId,
  className = ''
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Check if agent has an existing chatId in metadata
  const existingChatId = agent.metadata?.chatId || agent.chatId;
  const hasExistingChat = !!existingChatId;

  const createNewChat = async () => {
    const chatData: ChatCreationRequest = {
      name: `Chat with ${agent.name}`,
      description: `Discussion with ${agent.name} - ${agent.description.substring(0, 100)}${agent.description.length > 100 ? '...' : ''}`,
      settings: {
        visibility: ChatVisibility.PRIVATE,
        allowAnonymousMessages: false,
        enableBranching: false,
        recordTranscript: true
      },
      metadata: {
        tags: [...agent.metadata.tags.slice(0, 3)],
        category: ['one-on-one'],
        priority: 'medium',
        sensitivity: 'internal',
        language: ['en'],
        version: '1.0'
      }
    };

    const chatResponse = await fetch('/api/multi-agent/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatData),
    });

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json();
      throw new Error(errorData.error || 'Failed to create chat');
    }

    const chatResult = await chatResponse.json();
    const chatId = chatResult.chat.id;

    // Add participants to the chat
    const participantsResponse = await fetch(`/api/multi-agent/chats/${chatId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participants: [
          {
            participantId: userId,
            participantType: 'user',
            role: 'member'
          },
          {
            participantId: agent.id,
            participantType: 'agent',
            role: 'member'
          }
        ]
      }),
    });

    if (!participantsResponse.ok) {
      const errorData = await participantsResponse.json();
      throw new Error(errorData.error || 'Failed to add participants to chat');
    }

    return chatId;
  };

  const handleChatAction = async () => {
    setError(null);

    try {
      if (hasExistingChat) {
        // Navigate directly to existing chat
        router.push(`/chat/${existingChatId}`);
      } else {
        // Create a new chat and navigate to it
        const chatId = await createNewChat();
        router.push(`/chat/${chatId}`);
      }
    } catch (err) {
      console.error('Error with chat:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };

  return (
    <div>
      {error && (
        <div className="text-red-500 mb-2 text-sm">{error}</div>
      )}
      
      <button
        onClick={handleChatAction}
        className={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded ${className}`}
      >
        {hasExistingChat ? (
          <>
            <MessageSquare className="h-4 w-4 mr-2" />
            Go to Chat
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Create Chat
          </>
        )}
      </button>
    </div>
  );
};

export default SmartChatButton; 