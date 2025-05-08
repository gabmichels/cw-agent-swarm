'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, ImagePlus, Maximize2, Minimize2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import MarkdownRenderer from './MarkdownRenderer';
import TabsNavigation from './TabsNavigation';
import ChatMessages from './ChatMessages';
import { Message, FileAttachment } from '../types';
import { MessageType } from '../constants/message';
import SearchResults from './SearchResults';
import { smartSearchMessages } from '../utils/smartSearch';
import useChatMemory from '../hooks/useChatMemory';
import { useWebSocket } from '../hooks/useWebSocket';
import { ServerEvent } from '../server/websocket/types';

// Simple auth hook that returns a hardcoded user ID
// This will be replaced with a proper auth system later
const useAuth = () => {
  return {
    userId: 'user_gab'
  };
};

interface HistoryMessage {
  role: string;
  content: string;
  timestamp: string;
}

// Define participant interface
interface ChatParticipant {
  participantId: string;
  participantType: string;
  role: string;
}

function ClientTime({ timestamp }: { timestamp: Date }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // During SSR and first render, return the ISO time to match server exactly
  if (!mounted) {
    return <>{timestamp.toISOString().substring(11, 16)}</>;
  }
  
  // After hydration, render the nicely formatted time
  return <>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>;
}

// Add agent-related imports
interface AgentInitializeResponse {
  success: boolean;
  isInitialized: boolean;
  message?: string;
}

// Add a function to initialize the selected agent
async function initializeAgent(agentId: string): Promise<AgentInitializeResponse> {
  console.log(`[ChatInterface] Initializing agent: ${agentId}`);
  
  try {
    const response = await fetch(`/api/multi-agent/agents/${agentId}/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`[ChatInterface] Failed to initialize agent: ${response.status}`);
      return { 
        success: false, 
        isInitialized: false,
        message: `Failed to initialize agent: ${response.statusText}`
      };
    }
    
    const data = await response.json();
    console.log(`[ChatInterface] Agent initialization response:`, data);
    
    return {
      success: true,
      isInitialized: data.isInitialized || false,
      message: data.message
    };
  } catch (error) {
    console.error(`[ChatInterface] Error initializing agent:`, error);
    return {
      success: false,
      isInitialized: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Add a separate interface extension for FileAttachment to include url property
interface EnhancedFileAttachment extends FileAttachment {
  url?: string;
}

export default function ChatInterface() {
  // Get the chat ID from route parameters
  const params = useParams();
  const chatId = params.chatId as string;
  
  // Get the user ID from auth context or use a fallback
  const { userId = 'user_gab' } = useAuth?.() || {};
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInternalMessages, setShowInternalMessages] = useState(false);
  
  // State for chat participants
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  
  // State for agents in the chat
  const [agentParticipants, setAgentParticipants] = useState<string[]>([]);
  
  // State for selected agent
  const [selectedAgent, setSelectedAgent] = useState('');
  
  const [agentInitStatus, setAgentInitStatus] = useState<{
    initialized: boolean;
    message: string;
  }>({
    initialized: false,
    message: ''
  });
  
  // State for image viewer
  const [imageViewer, setImageViewer] = useState<{
    open: boolean;
    attachment: EnhancedFileAttachment | null;
  }>({
    open: false,
    attachment: null
  });
  
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  
  // Use our chat memory hook with dynamic chat ID
  const {
    chatHistory: messages,
    isLoadingHistory,
    historyError,
    addChatMessage,
    deleteChatMessage,
    loadChatHistory
  } = useChatMemory({
    userId,
    chatId, // Use chat ID from route parameters
    includeInternalMessages: showInternalMessages
  });
  
  // Local messages state for immediate UI updates before memory loads
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // Combine memory messages with local messages for display
  const displayMessages = useMemo(() => {
    return messages.length > 0 ? messages : localMessages;
  }, [messages, localMessages]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket integration
  const { 
    isConnected, 
    subscribeToChat, 
    unsubscribeFromChat,
    subscribeToEvent,
    acknowledgeMessageReceived
  } = useWebSocket();
  
  // Fetch initial messages
  useEffect(() => {
    async function fetchMessages() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/multi-agent/messages?chatId=${chatId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        
        const data = await response.json();
        if (data.success) {
          setLocalMessages(data.messages);
        } else {
          throw new Error(data.error || 'Failed to fetch messages');
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (chatId) {
      fetchMessages();
    }
  }, [chatId]);

  // Subscribe to chat events
  useEffect(() => {
    if (!chatId || !isConnected) return;
    
    // Subscribe to this chat's events
    subscribeToChat(chatId);
    
    // Listen for new messages
    const unsubscribeFromMessageCreated = subscribeToEvent(
      ServerEvent.MESSAGE_CREATED,
      (payload) => {
        if (payload.chatId === chatId) {
          // Fetch the new message
          fetch(`/api/multi-agent/messages?chatId=${chatId}&messageId=${payload.messageId}`)
            .then(response => response.json())
            .then(data => {
              if (data.success && data.messages.length > 0) {
                const newMessage = data.messages[0];
                setLocalMessages(prevMessages => [...prevMessages, newMessage]);
                acknowledgeMessageReceived(newMessage.id);
              }
            })
            .catch(error => {
              console.error('Error fetching new message:', error);
            });
        }
      }
    );
    
    return () => {
      unsubscribeFromChat(chatId);
      if (unsubscribeFromMessageCreated) {
        unsubscribeFromMessageCreated();
      }
    };
  }, [chatId, isConnected, subscribeToChat, unsubscribeFromChat, subscribeToEvent, acknowledgeMessageReceived]);

  // Add effect to load chat participants when chat ID changes
  useEffect(() => {
    if (!chatId) return;
    
    async function loadChatParticipants() {
      try {
        const response = await fetch(`/api/multi-agent/chats/${chatId}/participants`);
        
        if (!response.ok) {
          console.error(`Failed to load chat participants: ${response.status}`);
          return;
        }
        
        const data = await response.json();
        
        if (data.success && data.participants) {
          setParticipants(data.participants);
          
          // Extract agent participants
          const agents = data.participants
            .filter((p: ChatParticipant) => p.participantType === 'agent')
            .map((p: ChatParticipant) => p.participantId);
          
          setAgentParticipants(agents);
          
          // Set first agent as selected agent
          if (agents.length > 0 && !selectedAgent) {
            setSelectedAgent(agents[0]);
          }
        }
      } catch (error) {
        console.error('Error loading chat participants:', error);
      }
    }
    
    loadChatParticipants();
  }, [chatId, selectedAgent]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, searchQuery]);

  // Initialize agents when they are loaded
  useEffect(() => {
    async function initializeAgents() {
      if (agentParticipants.length === 0 || !selectedAgent) return;
      
      // Initialize the selected agent
      const initResult = await initializeAgent(selectedAgent);
      
      // Update status
      setAgentInitStatus({
        initialized: initResult.isInitialized,
        message: initResult.message || ''
      });
      
      if (initResult.success && initResult.isInitialized) {
        console.log(`[ChatInterface] Agent ${selectedAgent} initialized successfully`);
      } else {
        console.warn(`[ChatInterface] Agent initialization issue:`, initResult.message);
      }
    }
    
    initializeAgents();
  }, [agentParticipants, selectedAgent]);

  // Function to handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading || !chatId) return;
    
    // Get the current timestamp for the new message
    const messageTimestamp = new Date();
    
    // Add user message to chat - we'll create a temporary message object
    const userMessage: Message = {
      sender: 'You',
      content: input.trim(),
      timestamp: messageTimestamp,
      messageType: MessageType.USER,
      metadata: {
        chatId, // Use the dynamic chatId
        timestamp: messageTimestamp.toISOString(),
      }
    };
    
    // Display the message in UI immediately (it will be replaced by the stored version on next load)
    setLocalMessages(prevMessages => [...prevMessages, userMessage]);
    
    // Clear input
    setInput('');
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await fetch('/api/multi-agent/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          senderId: userId,
          senderType: 'user',
          content: userMessage.content,
          type: 'text'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }
      
      // Reload chat history to get the latest messages
      loadChatHistory();
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message to local messages
      const errorMessage: Message = {
        sender: 'System',
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        messageType: MessageType.SYSTEM,
        metadata: {
          chatId,
          timestamp: new Date().toISOString(),
          isError: true
        }
      };
      
      setLocalMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSearch = (query: string) => {
    console.log('ChatInterface handleSearch called with:', query);
    setSearchQuery(query);
    
    if (!query.trim()) {
      console.log('Empty query, clearing search results');
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    // If searching for "brand", add mock results for testing
    if (query.toLowerCase().includes('brand')) {
      console.log('Adding mock brand results');
      
      // Create mock brand messages
      const mockBrandMessages = [
        {
          id: 'brand-1',
          sender: 'Chloe',
          content: 'The Claro AI Brand Identity focuses on transparency, accessibility, and user-centric design.',
          timestamp: new Date(Date.now() - 3600000),
          messageType: MessageType.AGENT
        },
        {
          id: 'brand-2',
          sender: 'Chloe',
          content: 'Our brand values include Integrity, Innovation, and User-Centricity as core pillars.',
          timestamp: new Date(Date.now() - 7200000),
          messageType: MessageType.AGENT
        },
        {
          id: 'brand-3',
          sender: 'Chloe',
          content: 'The brand personality traits are: Insightful, Trustworthy, and Forward-Thinking.',
          timestamp: new Date(Date.now() - 10800000),
          messageType: MessageType.AGENT
        }
      ];
      
      setSearchResults(mockBrandMessages);
      setShowSearchResults(true);
      return;
    }
    
    // For other searches, use the smartSearch utility
    const messageResults = smartSearchMessages(messages, query, {
      threshold: 0.65,
      includeMetadata: true
    });
    
    // Add IDs to any messages that don't have them
    const resultsWithIds = messageResults.map((msg, index) => {
      if (!msg.id) {
        return { ...msg, id: `search-result-${index}` };
      }
      return msg;
    });
    
    console.log(`Found ${resultsWithIds.length} search results for "${query}"`, resultsWithIds);
    setSearchResults(resultsWithIds);
    setShowSearchResults(true);
  };

  const handleSearchFocus = () => {
    if (searchQuery.trim() && searchResults.length > 0) {
      setShowSearchResults(true);
    }
  };

  const handleCloseSearch = () => {
    setShowSearchResults(false);
  };

  const handleSelectSearchResult = (messageId: string) => {
    console.log(`Selecting message with ID: ${messageId}`);
    setSelectedMessageId(messageId);
    
    // Don't close the search results, just jump to the message
    // This will allow the user to continue clicking other results
  };

  const handleImageViewerOpen = (attachment: EnhancedFileAttachment, e: React.MouseEvent) => {
    e.preventDefault();
    setImageViewer({
      open: true,
      attachment
    });
  };

  const handleImageViewerClose = () => {
    setImageViewer({
      open: false,
      attachment: null
    });
  };

  // Add this new function
  const searchTest = () => {
    const testQuery = "help";
    console.log(`Running search test with query: "${testQuery}"`);
    
    // Log current state
    console.log("Current messages:", messages.length);
    console.log("Current search query:", searchQuery);
    
    // Update search query directly
    setSearchQuery(testQuery);
    
    // Force a re-render
    setTimeout(() => {
      console.log("Forced timeout - search query:", searchQuery);
      // Manually filter messages to verify filtering works
      const filtered = messages.filter(m => 
        m.content.toLowerCase().includes(testQuery.toLowerCase())
      );
      console.log(`Direct filtering found ${filtered.length} matches for "${testQuery}"`);
    }, 500);
  };

  // Debugging: Log chat history whenever it changes
  useEffect(() => {
    console.log(`ChatInterface: received ${messages.length} messages for chat ${chatId}`);
    if (messages.length > 0) {
      console.log('First message:', messages[0]);
      console.log('Last message:', messages[messages.length - 1]);
    }
  }, [messages, chatId]);

  // Reset loading state when agent changes
  useEffect(() => {
    setIsLoading(false);
  }, [selectedAgent]);

  // Add direct loading function to bypass useChatMemory hook issues
  const loadMessagesDirectly = async () => {
    try {
      console.log("Loading messages directly from API...");
      const response = await fetch("/api/chat/history");
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'success' && Array.isArray(data.history)) {
        console.log(`Loaded ${data.history.length} messages directly from API`);
        
        // Log the raw timestamps for debugging
        data.history.forEach((msg: any) => {
          console.log(`Message ${msg.id} API timestamp: ${msg.timestamp}`);
        });
        
        // Convert to the format our component expects, preserving the original timestamp
        const formattedMessages = data.history.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender,
          content: msg.content,
          timestamp: msg.timestamp, // Keep the original timestamp format
          messageType: msg.sender === 'You' ? MessageType.USER : MessageType.AGENT,
        }));
        
        // Sort messages by timestamp (oldest first)
        formattedMessages.sort((a: Message, b: Message) => {
          // Convert both timestamps to numbers for comparison
          const aTime = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp.getTime();
          const bTime = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp.getTime();
          return aTime - bTime;
        });
        console.log("Messages sorted by timestamp, oldest first");
        
        // Update our local messages state directly
        setLocalMessages(formattedMessages);
      } else {
        console.error("Invalid response format:", data);
      }
    } catch (error) {
      console.error("Error loading messages directly:", error);
    }
  };
  
  // Call our direct loading function on initial render
  useEffect(() => {
    loadMessagesDirectly();
  }, []);

  return (
    <div className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : 'h-full'}`}>
      {/* Chat header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-bold">
            {agentParticipants.length > 0 
              ? `Chat with ${agentParticipants.map(agent => agent.charAt(0).toUpperCase() + agent.slice(1)).join(', ')}`
              : 'Chat'}
          </h2>
          <p className="text-sm text-gray-400">
            {participants.length > 0 
              ? `${participants.length} participants`
              : 'Loading participants...'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white p-2 rounded hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Chat tabs */}
      <TabsNavigation 
        selectedTab={selectedTab} 
        setSelectedTab={setSelectedTab}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        onSearch={handleSearch}
        searchQuery={searchQuery}
        onSearchFocus={handleSearchFocus}
        searchResults={searchResults}
        onSelectResult={handleSelectSearchResult}
      />
      
      {/* Chat content area */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'chat' && (
          <div className="h-full flex flex-col overflow-y-auto px-4 py-2">
            {/* Show agent initialization status message */}
            {selectedAgent && !agentInitStatus.initialized && (
              <div className="bg-yellow-900 text-yellow-100 p-4 mb-4 rounded">
                <p>Agent initialization in progress...</p>
                {agentInitStatus.message && <p className="text-sm mt-2">{agentInitStatus.message}</p>}
              </div>
            )}
            
            {/* Show loading indicator */}
            {isLoadingHistory && displayMessages.length === 0 && (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            
            {/* Show error message if any */}
            {historyError && (
              <div className="bg-red-900 text-red-100 p-4 mb-4 rounded">
                <p>Error loading chat history: {historyError.message || String(historyError)}</p>
              </div>
            )}
          
            {/* Show search results */}
            {showSearchResults && (
              <SearchResults 
                results={searchResults} 
                onClose={handleCloseSearch}
                onSelectResult={handleSelectSearchResult}
                searchQuery={searchQuery}
                initialLimit={10}
              />
            )}
            
            {/* Show chat messages */}
            {!showSearchResults && (
              <ChatMessages 
                messages={displayMessages}
                initialMessageId={selectedMessageId}
                onImageClick={handleImageViewerOpen}
                showInternalMessages={showInternalMessages}
              />
            )}
            
            {/* Empty div for scrolling to the end */}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Other tabs content would go here */}
        {selectedTab === 'files' && (
          <div className="h-full overflow-y-auto p-4">
            <h3 className="text-lg font-medium mb-4">Files</h3>
            {/* Files tab content */}
          </div>
        )}
        
        {selectedTab === 'memory' && (
          <div className="h-full overflow-y-auto p-4">
            <h3 className="text-lg font-medium mb-4">Memory</h3>
            {/* Memory tab content */}
          </div>
        )}
      </div>
      
      {/* Image viewer */}
      {imageViewer.open && imageViewer.attachment && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={handleImageViewerClose}
        >
          <div className="relative max-w-4xl max-h-screen p-4">
            <button 
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-1 rounded-full"
              onClick={handleImageViewerClose}
            >
              <X size={24} />
            </button>
            <img 
              src={imageViewer.attachment.preview || imageViewer.attachment.url} 
              alt="Full size" 
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}
      
      {/* Chat input */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <div className="flex-1 flex bg-gray-700 rounded-lg">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none p-3 text-white placeholder-gray-400 focus:outline-none resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) handleSendMessage(e);
                }
              }}
            />
            <button 
              type="button"
              className="p-3 text-gray-400 hover:text-white"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <ImagePlus size={20} />
              <input 
                id="file-input" 
                type="file" 
                accept="image/*,.pdf,.doc,.docx,.txt,.csv" 
                className="hidden" 
                // File input handling would go here
              />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
} 