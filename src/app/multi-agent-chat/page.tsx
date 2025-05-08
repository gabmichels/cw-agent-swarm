'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import MultiAgentChatInterface from '../../components/MultiAgentChatInterface';
import AgentRelationshipGraph from '../../components/AgentRelationshipGraph';

export default function MultiAgentChatPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState('user_admin');
  const [chatId, setChatId] = useState<string>('');
  
  // Use a chatId from URL if available, otherwise generate a new one
  useEffect(() => {
    const paramChatId = searchParams.get('chatId');
    if (paramChatId) {
      setChatId(paramChatId);
    } else {
      // Generate a new chat ID if none is provided
      const generatedChatId = `chat_${new Date().getTime()}`;
      setChatId(generatedChatId);
      
      // Create a new chat via API
      createNewChat(generatedChatId);
    }
  }, [searchParams]);
  
  // Function to create a new chat
  const createNewChat = async (newChatId: string) => {
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
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