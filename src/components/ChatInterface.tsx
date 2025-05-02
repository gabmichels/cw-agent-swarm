'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, ImagePlus, Maximize2, Minimize2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import TabsNavigation from './TabsNavigation';
import ChatMessages from './ChatMessages';
import { Message, FileAttachment } from '../types';
import { MessageType } from '../constants/message';

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

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState('gab'); // Hardcoded for now, could come from auth context later
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInternalMessages, setShowInternalMessages] = useState(false);
  const [imageViewer, setImageViewer] = useState<{
    open: boolean;
    attachment: FileAttachment | null;
  }>({
    open: false,
    attachment: null
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history when component mounts
  useEffect(() => {
    async function loadChatHistory() {
      try {
        setIsLoadingHistory(true);
        const response = await fetch(`/api/chat?userId=${userId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.history && data.history.length > 0) {
            // Convert history to Message objects
            const historyMessages: Message[] = data.history.map((msg: HistoryMessage) => ({
              sender: msg.role === 'user' ? 'You' : 'Chloe',
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              messageType: msg.role === 'user' ? MessageType.USER : MessageType.AGENT,
            }));
            
            setMessages(historyMessages);
          } else {
            // Add mock messages for testing
            setMessages([
              {
                sender: 'Chloe',
                content: "Hello! I'm Chloe, and I'm now connected to the API.",
                timestamp: new Date(),
                messageType: MessageType.AGENT,
              },
              {
                sender: 'You',
                content: "I need help with search functionality.",
                timestamp: new Date(Date.now() - 5000),
                messageType: MessageType.USER,
              },
              {
                sender: 'Chloe',
                content: "I can help you implement a smart search with fuzzy matching and highlighting capabilities.",
                timestamp: new Date(Date.now() - 4000),
                messageType: MessageType.AGENT,
              },
              {
                sender: 'You',
                content: "How do we handle misspellings?",
                timestamp: new Date(Date.now() - 3000),
                messageType: MessageType.USER,
              },
              {
                sender: 'Chloe',
                content: "We can use Levenshtein distance algorithm to detect and match misspelled words.",
                timestamp: new Date(Date.now() - 2000),
                messageType: MessageType.AGENT,
              }
            ]);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        // Show error state with a message that clearly isn't hardcoded
        setMessages([{
          sender: 'Chloe',
          content: "Error loading chat history. But this message is coming from the client.",
          timestamp: new Date(),
          messageType: MessageType.AGENT,
        }]);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    
    loadChatHistory();
  }, [userId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, searchQuery]);

  // Function to handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage: Message = {
      sender: 'You',
      content: input.trim(),
      timestamp: new Date(),
      messageType: MessageType.USER,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    console.log('Sending message to Chloe:', userMessage.content);

    try {
      // Call the API with the user's message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId,
        }),
      });
      
      if (!response.ok) {
        console.error('API response not OK:', response.status, response.statusText);
        throw new Error('Failed to get response from Chloe');
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
      
      const botResponse: Message = {
        sender: 'Chloe',
        content: replyText,
        timestamp: new Date(),
        memory: messageMemory,
        thoughts: messageThoughts,
        messageType: MessageType.AGENT,
      };
      
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          sender: 'Chloe',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
          messageType: MessageType.AGENT,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleSearch = (query: string) => {
    console.log('ChatInterface handleSearch called with:', query);
    // Set the search query directly
    setSearchQuery(query);
    
    // Force a re-render by setting state
    setMessages(prevMessages => [...prevMessages]);
    
    // If we're not already on the chat tab, switch to it
    if (selectedTab !== 'chat') {
      console.log('Switching tab from', selectedTab, 'to chat');
      setSelectedTab('chat');
    }
    
    console.log('Current messages:', messages.length, 'Search query:', query);
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
      {/* Header with tabs */}
      <TabsNavigation
        selectedTab={selectedTab}
        setSelectedTab={setSelectedTab}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        onSearch={handleSearch}
      />

      {/* Search status indicator - disabled for now 
      {searchQuery && (
        <div className="bg-blue-600 text-white p-2 text-center">
          Search active: "{searchQuery}" - {messages.length} total messages
        </div>
      )}
      */}

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
      <div className="flex-1 overflow-y-auto p-4">
        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            onImageClick={handleImageViewerOpen}
            showInternalMessages={showInternalMessages}
            searchQuery={searchQuery}
          />
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