'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  memory?: string[];
  thoughts?: string[];
}

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
  const [messages, setMessages] = useState<Message[]>([
    // We'll initialize with an empty array instead of a hardcoded message
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState('gab'); // Hardcoded for now, could come from auth context later
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
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
              id: new Date(msg.timestamp).getTime().toString(),
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }));
            
            setMessages(historyMessages);
          } else {
            // Add a welcome message if no history exists
            setMessages([{
              id: Date.now().toString(),
              role: 'assistant',
              content: "Hello! I'm Chloe, and I'm now connected to the API.",
              timestamp: new Date(),
            }]);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        // Show error state with a message that clearly isn't hardcoded
        setMessages([{
          id: Date.now().toString(),
          role: 'assistant',
          content: "Error loading chat history. But this message is coming from the client.",
          timestamp: new Date(),
        }]);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    
    loadChatHistory();
  }, [userId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
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
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: new Date(),
        memory: messageMemory,
        thoughts: messageThoughts,
      };
      
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const testAPIConnection = async () => {
    setIsLoading(true);
    try {
      // Call API directly
      const response = await fetch('/api/ping');
      const data = await response.json();
      
      // Add test message showing the API response
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ API Connection Test: ${JSON.stringify(data, null, 2)}`,
          timestamp: new Date(),
        },
      ]);
      
      // Now test the chat API
      const chatTest = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "This is a test message from the API debug button",
          userId,
        }),
      });
      
      if (chatTest.ok) {
        const chatData = await chatTest.json();
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "1",
            role: 'assistant',
            content: `✅ Chat API Test - Response: "${chatData.reply}"`,
            timestamp: new Date(),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString() + "1",
            role: 'assistant',
            content: `❌ Chat API Error: Status ${chatTest.status}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error testing API:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ API Connection Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[70vh] border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              <span className="text-sm text-gray-500 ml-2">Loading conversation history...</span>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`min-w-[75%] max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary-100 dark:bg-primary-900 text-gray-800 dark:text-gray-100'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
                  }`}
                >
                  <MarkdownRenderer 
                    content={message.content} 
                    className={`prose-sm w-full ${
                      message.role === 'user'
                        ? 'dark:prose-invert prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-strong:text-gray-800 dark:prose-strong:text-purple-300 prose-em:text-gray-700 dark:prose-em:text-gray-300'
                        : 'dark:prose-invert prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-strong:text-gray-800 dark:prose-strong:text-purple-300 prose-em:text-gray-700 dark:prose-em:text-gray-300'
                    }`} 
                  />
                  
                  {message.memory && message.memory.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-blue-500">View Memory Context</summary>
                      <div className="mt-2 p-2 bg-gray-200 dark:bg-gray-600 rounded text-sm">
                        {message.memory.map((mem, idx) => (
                          <div key={idx} className="mb-2 last:mb-0">
                            <MarkdownRenderer 
                              content={mem} 
                              className="prose-sm dark:prose-invert prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-100" 
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  {message.thoughts && message.thoughts.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-purple-500">View Thoughts</summary>
                      <div className="mt-2 p-2 bg-gray-200 dark:bg-gray-600 rounded text-sm">
                        {message.thoughts.map((thought, idx) => (
                          <div key={idx} className="mb-2 last:mb-0">
                            <MarkdownRenderer 
                              content={thought} 
                              className="prose-sm dark:prose-invert prose-headings:text-gray-800 dark:prose-headings:text-gray-100 prose-p:text-gray-800 dark:prose-p:text-gray-100" 
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  
                  <div
                    className={`text-xs mt-1 ${
                      message.role === 'user' 
                        ? 'text-gray-500 dark:text-gray-400 text-right' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <ClientTime timestamp={message.timestamp} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="min-w-[75%] max-w-[80%] bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-sm text-gray-500 ml-2">Chloe is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="border-t dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded border dark:border-gray-600 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white"
            disabled={isLoading || isLoadingHistory}
          />
          <button
            type="submit"
            className="btn btn-primary flex items-center justify-center"
            disabled={isLoading || isLoadingHistory || !input.trim()}
          >
            <Send size={16} className="mr-1" />
            Send
          </button>
          {process.env.NODE_ENV !== 'production' && (
            <button
              type="button"
              onClick={testAPIConnection}
              className="ml-2 btn btn-secondary flex items-center justify-center"
              disabled={isLoading || isLoadingHistory}
            >
              Test API
            </button>
          )}
        </form>
      </div>
    </div>
  );
} 