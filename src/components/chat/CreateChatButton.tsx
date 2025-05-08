import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatCreationRequest, ChatVisibility } from '@/lib/multi-agent/types/chat';
import { AgentProfile } from '@/lib/multi-agent/types/agent';

interface CreateChatButtonProps {
  agent: AgentProfile;
  userId: string;
  className?: string;
}

const CreateChatButton: React.FC<CreateChatButtonProps> = ({
  agent,
  userId,
  className = ''
}) => {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateChat = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Prepare chat creation data
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
          tags: [...agent.metadata.tags.slice(0, 3)], // Take up to 3 tags from agent
          category: ['one-on-one'],
          priority: 'medium',
          sensitivity: 'internal',
          language: ['en'],
          version: '1.0'
        }
      };

      // Create the chat
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

      // Navigate to the new chat
      router.push(`/chat/${chatId}`);
    } catch (err) {
      console.error('Error creating chat:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsCreating(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="text-red-500 mb-2 text-sm">{error}</div>
      )}
      
      <button
        onClick={handleCreateChat}
        disabled={isCreating}
        className={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 ${className}`}
      >
        {isCreating ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating Chat...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
            </svg>
            Start Chat
          </>
        )}
      </button>
    </div>
  );
};

export default CreateChatButton; 