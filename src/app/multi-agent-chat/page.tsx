'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import MultiAgentChatInterface from '../../components/MultiAgentChatInterface';
import AgentRelationshipGraph from '../../components/AgentRelationshipGraph';

// Define interface for chat object
interface Chat {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  settings: {
    visibility: string;
    allowAnonymousMessages: boolean;
    enableBranching: boolean;
    recordTranscript: boolean;
  };
  purpose: string;
}

export default function MultiAgentChatPage({ 
  searchParams 
}: { 
  searchParams?: { [key: string]: string | string[] | undefined } 
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const router = useRouter();
  const [userId, setUserId] = useState('user_admin');
  const [chatId, setChatId] = useState<string>('');
  
  // Use a chatId from URL if available, otherwise generate a new one
  useEffect(() => {
    // Extract chatId from searchParams
    const paramChatId = searchParams && 'chatId' in searchParams ? 
                        Array.isArray(searchParams.chatId) ? 
                        searchParams.chatId[0] : 
                        searchParams.chatId : null;

    if (paramChatId) {
      setChatId(paramChatId);
    } else {
      // Generate random chatId
      const newChatId = `chat_${Math.random().toString(36).substring(2, 15)}`;
      setChatId(newChatId);
    }
  }, [searchParams]);
  
  // Function to create a new chat
  const createNewChat = async (newChatId: string) => {
    try {
      const chatData: Chat = {
        id: newChatId,
        name: 'Multi-Agent Collaboration',
        description: 'A collaborative chat for multiple agents',
        createdBy: userId,
        settings: {
          visibility: 'public',
          allowAnonymousMessages: false,
          enableBranching: true,
          recordTranscript: true
        },
        purpose: 'Agent collaboration and task delegation'
      };
      
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData),
      });
      
      if (!response.ok) {
        console.error('Failed to create chat:', await response.text());
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Multi-Agent Collaboration</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Create, monitor, and participate in conversations between multiple specialized agents.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Interface - Takes up 2/3 of the space on larger screens */}
        <div className="lg:col-span-2">
          {chatId && <MultiAgentChatInterface chatId={chatId} userId={userId} />}
        </div>
        
        {/* Relationship Graph and Analytics - Takes up 1/3 of the space */}
        <div className="flex flex-col space-y-4">
          {/* Agent Relationship Visualization */}
          <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-3">Agent Relationships</h2>
            <AgentRelationshipGraph height="300px" />
          </div>
          
          {/* Agent Activity Analytics */}
          <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-3">Activity Analytics</h2>
            <div className="space-y-3">
              <div className="bg-gray-800 p-3 rounded">
                <h3 className="text-sm font-medium text-gray-400">Most Active Agent</h3>
                <p className="text-lg">Research Agent</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              
              <div className="bg-gray-800 p-3 rounded">
                <h3 className="text-sm font-medium text-gray-400">Strongest Collaboration</h3>
                <p className="text-lg">Research Agent ↔ Analysis Agent</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                  <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              
              <div className="bg-gray-800 p-3 rounded">
                <h3 className="text-sm font-medium text-gray-400">Task Completion Rate</h3>
                <p className="text-lg">92%</p>
                <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                  <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 