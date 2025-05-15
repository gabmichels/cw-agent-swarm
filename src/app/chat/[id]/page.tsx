'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import TabsNavigation from '@/components/TabsNavigation';
import ChatInput from '@/components/ChatInput';
import ChatMessages from '@/components/ChatMessages';
import DevModeToggle from '@/components/DevModeToggle';
import { Message } from '@/types';
import { getCurrentUser } from '@/lib/user';

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
            const agentRes = await fetch(`/api/multi-agent/agents?id=${agentId}`);
            const agentJson = await agentRes.json();
            if (!agentRes.ok || !agentJson.agents || agentJson.agents.length === 0) {
              setError('Agent not found. Please select a valid agent.');
              setIsLoading(false);
              return;
            }
            agentProfile = agentJson.agents[0];
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
              const agentRes = await fetch(`/api/multi-agent/agents?id=${agentId}`);
              const agentJson = await agentRes.json();
              if (agentRes.ok && agentJson.agents && agentJson.agents.length > 0) {
                agentName = agentJson.agents[0].name;
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
                  {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : error ? (
                    <div className="text-red-500">{error}</div>
                  ) : (
                    <ChatMessages
                      messages={messages}
                      isLoading={isLoading}
                      onImageClick={() => {}}
                      showInternalMessages={showInternalMessages}
                    />
                  )}
                </div>
                <div className="border-t border-gray-700 p-4">
                  <ChatInput
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    pendingAttachments={[]}
                    removePendingAttachment={() => {}}
                    handleSendMessage={() => {}}
                    isLoading={isLoading}
                    handleFileSelect={() => {}}
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