'use client';

import React, { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import TabsNavigation from '@/components/TabsNavigation';
import ChatInput from '@/components/ChatInput';
import ChatMessages from '@/components/ChatMessages';
import DevModeToggle from '@/components/DevModeToggle';
import { Message, FileAttachment } from '@/types';
import { getCurrentUser } from '@/lib/user';
import MessageHandlerService from '@/services/MessageHandlerService';

const user = getCurrentUser();
const userId = user.id;

interface Chat {
  id: string;
  agentId: string;
  userId: string;
  name: string;
}

const departments = ['Marketing', 'HR', 'Finance', 'Sales'];
const agentsByDepartment: Record<string, string[]> = {
  Marketing: [],
  HR: ['Emma (Soon)'],
  Finance: ['Alex (Soon)'],
  Sales: ['Sam (Soon)'],
};

// Add WelcomeScreen component at the top level of the file
const WelcomeScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Chat</h1>
      <p className="text-xl text-gray-400 mb-8 max-w-2xl">
        Start a conversation with your AI assistant.
      </p>
    </div>
  );
};

const ChatPage: React.FC = () => {
  const params = useParams();
  const agentId = params.id as string;
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [showInternalMessages, setShowInternalMessages] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Marketing');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState<boolean>(false);
  const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);

  // Get message handler instance
  const messageHandler = MessageHandlerService.getInstance();

  // Sidebar agent selection handler (optional, can be a no-op here)
  const setSelectedAgent = () => {};
  const toggleSidebarPin = () => setIsSidebarPinned((prev) => !prev);

  // Dropdown handlers
  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const toggleDeptDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeptDropdownOpen((prev) => !prev);
    setIsAgentDropdownOpen(false);
  };
  const toggleAgentDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentDropdownOpen((prev) => !prev);
    setIsDeptDropdownOpen(false);
  };
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setIsDeptDropdownOpen(false);
  };
  const handleAgentChange = (agent: string) => {
    setIsAgentDropdownOpen(false);
  };

  // Fetch or create chat, then load messages
  useEffect(() => {
    const fetchOrCreateChat = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Try to get chat between user and agent
        let chatRes = await fetch(`/api/multi-agent/chats?userId=${userId}&agentId=${agentId}`);
        let chatData = await chatRes.json();
        let chatObj: Chat | null = null;
        if (chatRes.ok && chatData.chats && chatData.chats.length > 0) {
          chatObj = chatData.chats[0];
        } else {
          // 2. If not found, fetch agent profile for chat creation fields
          let agentProfile: any = null;
          try {
            const agentRes = await fetch(`/api/multi-agent/agents/${agentId}`);
            const agentJson = await agentRes.json();
            if (!agentRes.ok || !agentJson.success || !agentJson.agent) {
              setError('Agent not found. Please select a valid agent.');
              setIsLoading(false);
              return;
            }
            agentProfile = agentJson.agent;
          } catch {
            setError('Agent not found. Please select a valid agent.');
            setIsLoading(false);
            return;
          }
          // Fallbacks if agentProfile is missing
          const chatName = agentProfile?.name ? `Chat with ${agentProfile.name}` : `Chat with ${agentId}`;
          const chatDescription = agentProfile?.description || 'Direct chat';
          const chatSettings = {
            visibility: 'private',
            allowAnonymousMessages: false,
            enableBranching: false,
            recordTranscript: true
          };
          const chatMetadata = {
            tags: agentProfile?.metadata?.tags || [],
            category: agentProfile?.metadata?.domain || [],
            priority: 'medium',
            sensitivity: 'internal',
            language: ['en'],
            version: '1.0',
            userId,
            agentId
          };
          const createRes = await fetch(`/api/multi-agent/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: chatName,
              description: chatDescription,
              settings: chatSettings,
              metadata: chatMetadata
            }),
          });
          const createData = await createRes.json();
          if (createRes.ok && createData.chat) {
            chatObj = createData.chat;
          } else {
            throw new Error(createData.error || 'Failed to create chat');
          }
        }
        setChat(chatObj);
        // 3. Load messages for this chat
        if (chatObj) {
          const msgRes = await fetch(`/api/multi-agent/chats/${chatObj.id}/messages`);
          const msgData = await msgRes.json();
          if (msgRes.ok && msgData.messages && msgData.messages.length > 0) {
            setMessages(msgData.messages);
          } else {
            // 4. If no messages, create dummy welcome message
            // Always try to use the agent's name for the welcome message
            let agentName = '';
            try {
              const agentRes = await fetch(`/api/multi-agent/agents/${agentId}`);
              const agentJson = await agentRes.json();
              if (agentRes.ok && agentJson.success && agentJson.agent) {
                agentName = agentJson.agent.name;
              }
            } catch {}
            if (!agentName) {
              agentName = agentId;
            }
            setMessages([
              {
                sender: agentName,
                content: `Hi, I am ${agentName}. How can I assist you?`,
                timestamp: new Date(),
              },
            ]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    if (agentId) fetchOrCreateChat();
  }, [agentId]);

  // Update handleSendMessage to use the service
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      await messageHandler.handleSendMessage(
        inputMessage,
        pendingAttachments,
        messages,
        userId,
        agentId,
        setMessages,
        setIsLoading,
        setInputMessage,
        setPendingAttachments,
        chat?.id
      );
    } catch (error) {
      console.error('Error sending message:', error);
      // Error is handled by the service
    }
  };

  // Update handleFileSelect to use the service
  const handleFileSelect = async (file: File) => {
    try {
      await messageHandler.handleFileSelect(file, setPendingAttachments, inputRef);
    } catch (error) {
      console.error('Error handling file:', error);
      // Handle error appropriately
    }
  };

  // Add removePendingAttachment handler
  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const updated = [...prev];
      // Revoke the object URL if it's an image to prevent memory leaks
      if (updated[index].preview) {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };

  // UI matches main page
  return (
    <div className="flex flex-col h-screen">
      <Header
        selectedDepartment={selectedDepartment}
        selectedAgent={agentId}
        isDeptDropdownOpen={isDeptDropdownOpen}
        isAgentDropdownOpen={isAgentDropdownOpen}
        isDebugMode={isDebugMode}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        toggleDeptDropdown={toggleDeptDropdown}
        toggleAgentDropdown={toggleAgentDropdown}
        handleDepartmentChange={handleDepartmentChange}
        handleAgentChange={handleAgentChange}
        setIsDebugMode={setIsDebugMode}
        departments={departments}
        agentsByDepartment={agentsByDepartment}
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className={`transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'} bg-gray-900 border-r border-gray-800 flex-shrink-0`}>
          <Sidebar
            isSidebarOpen={isSidebarOpen}
            isSidebarPinned={isSidebarPinned}
            selectedAgent={agentId}
            toggleSidebarPin={toggleSidebarPin}
            setSelectedAgent={setSelectedAgent}
          />
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">
          <TabsNavigation
            selectedTab={selectedTab}
            setSelectedTab={setSelectedTab}
            isFullscreen={false}
            toggleFullscreen={() => {}}
            onSearch={() => {}}
          />
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedTab === 'chat' && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 h-full">
                  {(!agentId || agentId.includes('Soon') || messages.length === 0) ? (
                    <WelcomeScreen />
                  ) : (
                    <>
                      {process.env.NODE_ENV !== 'production' && messages.length > 0 && (
                        <div className="text-xs text-gray-500 mb-2 p-2 border border-gray-700 rounded">
                          Passing {messages.length} messages to ChatMessages component
                          {chat?.id && <div>Chat ID: {chat.id}</div>}
                        </div>
                      )}
                      
                      <ChatMessages 
                        messages={messages} 
                        isLoading={isLoading}
                        onImageClick={() => {}}
                        showInternalMessages={showInternalMessages}
                        pageSize={20}
                        preloadCount={10}
                        searchQuery={''}
                        initialMessageId={''}
                      />
                    </>
                  )}
                  
                  <div ref={messagesEndRef} className="h-1" />
                </div>
                <div className="border-t border-gray-700 p-4">
                  <ChatInput
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    pendingAttachments={pendingAttachments}
                    removePendingAttachment={removePendingAttachment}
                    handleSendMessage={handleSendMessage}
                    isLoading={isLoading}
                    handleFileSelect={handleFileSelect}
                    inputRef={inputRef}
                  />
                </div>
              </div>
            )}
          </div>
          <DevModeToggle showInternalMessages={showInternalMessages} setShowInternalMessages={setShowInternalMessages} />
        </main>
      </div>
    </div>
  );
};

export default ChatPage;