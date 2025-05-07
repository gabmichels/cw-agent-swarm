'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, X, ImagePlus, Maximize2, Minimize2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import TabsNavigation from './TabsNavigation';
import ChatMessages from './ChatMessages';
import { Message, FileAttachment } from '../types';
import { MessageType } from '../constants/message';
import SearchResults from './SearchResults';
import { smartSearchMessages } from '../utils/smartSearch';
import useChatMemory from '../hooks/useChatMemory';

interface HistoryMessage {
  role: string;
  content: string;
  timestamp: string;
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
    const response = await fetch(`/api/agent/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agentId }),
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

export default function ChatInterface() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState('gab'); // Hardcoded for now, could come from auth context later
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInternalMessages, setShowInternalMessages] = useState(false);
  // Add selected agent state - default to "chloe"
  const [selectedAgent, setSelectedAgent] = useState('chloe');
  const [agentInitStatus, setAgentInitStatus] = useState<{
    initialized: boolean;
    message: string;
  }>({
    initialized: false,
    message: ''
  });
  const [imageViewer, setImageViewer] = useState<{
    open: boolean;
    attachment: FileAttachment | null;
  }>({
    open: false,
    attachment: null
  });
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  
  // Use our new chat memory hook
  const {
    chatHistory: messages,
    isLoadingHistory,
    historyError,
    addChatMessage,
    deleteChatMessage,
    loadChatHistory
  } = useChatMemory({
    userId,
    chatId: "chat-chloe-gab", // Use hardcoded chatId
    includeInternalMessages: showInternalMessages
  });
  
  // Local messages state for immediate UI updates before memory loads
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  
  // Combine memory messages with local messages for display
  const displayMessages = useMemo(() => {
    return messages.length > 0 ? messages : localMessages;
  }, [messages, localMessages]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add event listener for forced refreshes
  useEffect(() => {
    const handleRefreshMessages = () => {
      console.log('Received refreshMessages event, reloading chat history');
      loadChatHistory();
    };

    // Add event listener for refreshMessages event
    document.addEventListener('refreshMessages', handleRefreshMessages);

    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('refreshMessages', handleRefreshMessages);
    };
  }, [loadChatHistory]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayMessages, searchQuery]);

  // Add effect to initialize the selected agent when component mounts
  useEffect(() => {
    // Define a function to initialize the agent
    async function loadSelectedAgent() {
      // Load agent selection from localStorage or use default
      const storedAgent = localStorage.getItem('selectedAgent');
      const agentToLoad = storedAgent || selectedAgent;
      
      if (storedAgent && storedAgent !== selectedAgent) {
        setSelectedAgent(storedAgent);
      }
      
      console.log(`[ChatInterface] Loading agent: ${agentToLoad}`);
      
      // Initialize the agent
      const initResult = await initializeAgent(agentToLoad);
      
      // Update status
      setAgentInitStatus({
        initialized: initResult.isInitialized,
        message: initResult.message || ''
      });
      
      if (initResult.success && initResult.isInitialized) {
        console.log(`[ChatInterface] Agent ${agentToLoad} initialized successfully`);
      } else {
        console.warn(`[ChatInterface] Agent initialization issue:`, initResult.message);
      }
    }
    
    // Call the initialization function
    loadSelectedAgent();
    
    // Create a function to handle agent change events
    const handleAgentChange = (event: CustomEvent) => {
      if (event.detail && event.detail.agentId) {
        const newAgentId = event.detail.agentId;
        console.log(`[ChatInterface] Agent changed to: ${newAgentId}`);
        
        // Update selected agent
        setSelectedAgent(newAgentId);
        
        // Save to local storage
        localStorage.setItem('selectedAgent', newAgentId);
        
        // Initialize the new agent
        initializeAgent(newAgentId).then(result => {
          setAgentInitStatus({
            initialized: result.isInitialized,
            message: result.message || ''
          });
        });
      }
    };
    
    // Add event listener for agent change
    document.addEventListener('agentChanged', handleAgentChange as EventListener);
    
    // Cleanup
    return () => {
      document.removeEventListener('agentChanged', handleAgentChange as EventListener);
    };
  }, []);

  // Function to handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message to chat - we'll create a temporary message object
    // but we no longer need to add it to memory since the agent will handle that
    const userMessage: Message = {
      sender: 'You',
      content: input.trim(),
      timestamp: new Date(),
      messageType: MessageType.USER,
      metadata: {
        chatId: "chat-chloe-gab" // Add the hardcoded chatId
      }
    };
    
    // Display the message in UI immediately (it will be replaced by the stored version on next load)
    setLocalMessages(prev => [...prev, userMessage]);
    
    setInput('');
    setIsLoading(true);

    console.log(`Sending message to ${selectedAgent}:`, userMessage.content);

    try {
      // Call the API with the user's message and selected agent
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId,
          agentId: selectedAgent, // Include the agent ID
          chatId: "chat-chloe-gab" // Include the hardcoded chatId
        }),
      });
      
      if (!response.ok) {
        console.error('API response not OK:', response.status, response.statusText);
        throw new Error('Failed to get response from Assistant');
      }
      
      const data = await response.json();
      console.log('API response received:', data);
      
      // Add bot response - handle both direct reply and nested response structure
      let replyText = '';
      let messageMemory = [];
      let messageThoughts = [];
      
      // Check for both data structures to ensure compatibility
      if (data.reply) {
        replyText = data.reply;
        messageMemory = data.memory || [];
        messageThoughts = data.thoughts || [];
      } else if (data.response) {
        replyText = data.response;
        messageMemory = data.memory || [];
        messageThoughts = data.thoughts || [];
      } else {
        console.error('Unexpected API response format:', data);
        replyText = "I'm sorry, I encountered an issue with my response format. Please try again.";
      }
      
      // Display the bot's response in the UI immediately
      const botResponse: Message = {
        sender: 'Assistant',
        content: replyText,
        timestamp: new Date(),
        memory: messageMemory,
        thoughts: messageThoughts,
        messageType: MessageType.AGENT,
      };
      
      // Add to UI immediately - will be replaced by stored version on next refresh
      setLocalMessages(prev => [...prev, botResponse]);
      
      // Refresh messages from memory after a short delay
      setTimeout(() => {
        loadChatHistory();
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to UI
      const errorMessage: Message = {
        sender: 'Assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        messageType: MessageType.AGENT,
      };
      
      setLocalMessages(prev => [...prev, errorMessage]);
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

  const handleImageViewerOpen = (attachment: FileAttachment, e: React.MouseEvent) => {
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

  return (
    <div className={`flex flex-col h-screen bg-gray-900 text-white ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Agent initialization status indicator - only show if there's an issue */}
      {!agentInitStatus.initialized && agentInitStatus.message && (
        <div className="bg-amber-800 text-white text-sm px-4 py-1 text-center">
          {agentInitStatus.message}
        </div>
      )}
    
      {/* Header with tabs */}
      <TabsNavigation
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        onSearch={handleSearch}
        onSearchFocus={handleSearchFocus}
        onSearchClose={handleCloseSearch}
        searchResults={searchResults}
        searchQuery={searchQuery}
        onSelectResult={handleSelectSearchResult}
      />

      {/* Search status indicator */}
      {/* Removed - now showing results inline */}

      {/* Search test controls - disabled for now 
      <div className="bg-gray-800 p-2 flex justify-center space-x-2">
        <input 
          type="text" 
          placeholder="Test search..."
          className="px-2 py-1 rounded bg-gray-700 text-white border border-gray-600"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button 
          className="bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() => {
            console.log('Manual search test with:', searchQuery);
            // Force re-render by setting the same value
            setSearchQuery(prev => prev + ' ');
          }}
        >
          Test Search
        </button>
        <button 
          className="bg-red-600 text-white px-3 py-1 rounded"
          onClick={() => setSearchQuery('')}
        >
          Clear
        </button>
      </div>
      */}

      {/* Search test button - disabled for now 
      <button 
        className="bg-green-600 text-white px-4 py-2 rounded mx-auto block mt-2"
        onClick={searchTest}
      >
        Run Search Test
      </button>
      */}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-4 relative">
        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <ChatMessages
              messages={displayMessages}
              isLoading={isLoading}
              onImageClick={handleImageViewerOpen}
              onDeleteMessage={deleteChatMessage}
            />
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Message input */}
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? "Chloe is thinking..." : "Type your message..."}
            className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`p-2 rounded-lg ${
              isLoading || !input.trim()
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Image viewer modal */}
      {imageViewer.open && imageViewer.attachment && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="max-w-4xl max-h-screen p-4 relative">
            <button 
              onClick={handleImageViewerClose}
              className="absolute top-2 right-2 bg-gray-800 rounded-full p-2 text-white hover:bg-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
            
            <img 
              src={imageViewer.attachment.preview} 
              alt={imageViewer.attachment.filename || 'Image'} 
              className="max-h-[90vh] max-w-full rounded-lg shadow-xl" 
            />
            
            <div className="mt-2 text-center text-white">
              {imageViewer.attachment.filename && (
                <p className="text-sm opacity-80">{imageViewer.attachment.filename}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 