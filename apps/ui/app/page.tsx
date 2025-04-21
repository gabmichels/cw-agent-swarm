'use client';

import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Send, Menu, X } from 'lucide-react';

// Define message type for better type safety
interface Message {
  sender: string;
  content: string;
  timestamp: Date;
}

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('Chloe');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([
    { 
      sender: 'Chloe', 
      content: 'Hello! I\'m Chloe, your marketing expert. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input field when component mounts or after sending message
  useEffect(() => {
    // Focus the input field with a slight delay to ensure DOM has updated
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        console.log('Input auto-focused by useEffect');
      }
    }, 100);
  }, [messages]);

  // Add a separate useEffect for initial focus
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      console.log('Input focused on mount');
    }
  }, []);

  const handleSendMessage = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // For debugging - just use client-side responses
    console.log("Form submitted with:", inputMessage);
    
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      sender: 'You',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Store and clear input
    const sentMessage = inputMessage;
    setInputMessage('');
    
    // Simulate response
    setTimeout(() => {
      const agentResponse: Message = {
        sender: selectedAgent,
        content: `You said: "${sentMessage}". This is a client-side echo for debugging.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, agentResponse]);
    }, 1000);
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Top Navigation Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-3 md:px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center">
          <button 
            className="mr-2 p-1 rounded-full hover:bg-gray-700 block md:hidden" 
            onClick={toggleSidebar}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="text-xl font-bold text-gray-100">Crowd Wisdom</div>
        </div>
        <nav>
          <ul className="hidden md:flex space-x-6">
            <li><a href="/" className="text-gray-300 hover:text-indigo-400">Dashboard</a></li>
            <li><a href="/employees" className="text-gray-300 hover:text-indigo-400">Employees</a></li>
            <li><a href="/settings" className="text-gray-300 hover:text-indigo-400">Settings</a></li>
          </ul>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side Panel - hide on mobile unless toggled */}
        <aside 
          className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transform transition-transform duration-300 ease-in-out fixed md:relative z-20 md:translate-x-0 bg-gray-800 border-r border-gray-700 h-[calc(100vh-58px)] w-64 md:w-64 flex flex-col`}
        >
          <div className="p-4 md:p-5 border-b border-gray-700">
            <div className="relative">
              <div className="flex items-center justify-between p-2.5 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 text-gray-200">
                <span className="font-medium">{selectedDepartment}</span>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
          
          <div className="p-4 md:p-5 flex-1 overflow-y-auto">
            <h3 className="text-xs uppercase font-semibold text-gray-400 mb-3 tracking-wider">AGENTS</h3>
            <ul className="space-y-1">
              <li 
                className={`p-2.5 rounded-md cursor-pointer flex items-center ${selectedAgent === 'Chloe' ? 'bg-indigo-900 text-indigo-300' : 'hover:bg-gray-700 text-gray-300'}`}
                onClick={() => setSelectedAgent('Chloe')}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-900 text-indigo-300 mr-3 flex items-center justify-center font-medium">C</div>
                <span>Chloe</span>
              </li>
              {/* Disabled agent examples */}
              <li className="p-2.5 rounded-md cursor-not-allowed text-gray-500 flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-500 mr-3 flex items-center justify-center font-medium">M</div>
                <span>Maxwell</span>
                <span className="ml-auto text-xs bg-gray-700 rounded-full px-2 py-0.5">Coming soon</span>
              </li>
              <li className="p-2.5 rounded-md cursor-not-allowed text-gray-500 flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-700 text-gray-500 mr-3 flex items-center justify-center font-medium">S</div>
                <span>Stella</span>
                <span className="ml-auto text-xs bg-gray-700 rounded-full px-2 py-0.5">Coming soon</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col overflow-hidden ${isSidebarOpen ? 'md:ml-0 ml-0' : 'ml-0'} w-full bg-gray-900`}>
          {/* Info Section */}
          <div className="bg-gray-800 border-b border-gray-700 p-3 md:p-4">
            <h1 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 text-gray-100">{selectedAgent}</h1>
            <div className="flex border-b border-gray-700 overflow-x-auto hide-scrollbar">
              <button 
                className={`px-3 md:px-4 py-2 whitespace-nowrap ${selectedTab === 'chat' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}
                onClick={() => setSelectedTab('chat')}
              >
                Chat
              </button>
              <button 
                className={`px-3 md:px-4 py-2 whitespace-nowrap ${selectedTab === 'reflection' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}
                onClick={() => setSelectedTab('reflection')}
              >
                Reflection
              </button>
              <button 
                className={`px-3 md:px-4 py-2 whitespace-nowrap ${selectedTab === 'tasks' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}
                onClick={() => setSelectedTab('tasks')}
              >
                Tasks
              </button>
              <button 
                className={`px-3 md:px-4 py-2 whitespace-nowrap ${selectedTab === 'memory' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}
                onClick={() => setSelectedTab('memory')}
              >
                Memory
              </button>
              <button 
                className={`px-3 md:px-4 py-2 whitespace-nowrap ${selectedTab === 'thoughts' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400'}`}
                onClick={() => setSelectedTab('thoughts')}
              >
                Thoughts
              </button>
            </div>
          </div>

          {/* Content based on selected tab */}
          {selectedTab === 'chat' ? (
            <>
              {/* Chat History */}
              <div className="flex-1 overflow-y-auto p-3 md:p-4 bg-gray-900 pb-4">
                <div className="flex flex-col space-y-3 mb-2">
                  {messages.map((message, index) => (
                    <div 
                      key={index} 
                      className={`flex ${message.sender === 'You' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[85%] md:max-w-[70%] rounded-lg p-3 ${
                          message.sender === 'You' 
                            ? 'bg-indigo-700 text-gray-100 rounded-br-none' 
                            : 'bg-gray-800 text-gray-100 rounded-bl-none shadow-md'
                        }`}
                      >
                        {message.sender !== 'You' && (
                          <div className="font-medium text-xs md:text-sm text-gray-400 mb-1">{message.sender}</div>
                        )}
                        <div className="text-sm md:text-base">{message.content}</div>
                        <div className={`text-xs mt-1 ${message.sender === 'You' ? 'text-indigo-300' : 'text-gray-500'}`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Typing indicator */}
                {isLoading && (
                  <div className="mb-3 flex justify-start">
                    <div className="bg-gray-800 rounded-lg p-3 shadow-md rounded-bl-none max-w-[85%] md:max-w-[70%]">
                      <div className="font-medium text-xs md:text-sm text-gray-400 mb-1">{selectedAgent}</div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Empty div for scrolling to bottom */}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Chat Input - fixed at bottom */}
              <div className="bg-gray-800 border-t border-gray-700 p-3 md:p-4 relative z-10">
                <form 
                  onSubmit={handleSendMessage} 
                  className="flex items-center gap-2 relative z-20"
                  onClick={(e) => {
                    console.log('Form clicked');
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                    e.stopPropagation();
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onClick={(e) => {
                      console.log('Input clicked');
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      console.log('Input touch started');
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }}
                    onFocus={() => {
                      console.log('Input focused');
                    }}
                    className="flex-1 border border-gray-600 bg-gray-700 text-gray-100 rounded-full px-3 md:px-4 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-text placeholder-gray-400"
                    placeholder={isLoading ? "Waiting for response..." : "Type a message..."}
                    disabled={isLoading}
                    autoComplete="off"
                    aria-label="Message input"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isLoading}
                    className={`p-2 rounded-full cursor-pointer ${
                      !inputMessage.trim() || isLoading ? 'bg-gray-600 text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                    aria-label="Send message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </button>
                </form>
              </div>
            </>
          ) : selectedTab === 'reflection' ? (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-900">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-100">Reflections</h2>
              <p className="text-sm md:text-base text-gray-400">
                View {selectedAgent}'s self-reflections and insights learned over time.
              </p>
              <div className="mt-3 md:mt-4 p-3 md:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <p className="italic text-sm text-gray-500">No reflections available yet.</p>
              </div>
            </div>
          ) : selectedTab === 'tasks' ? (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-900">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-100">Tasks</h2>
              <p className="text-sm md:text-base text-gray-400">
                View and manage {selectedAgent}'s current and scheduled tasks.
              </p>
              <div className="mt-3 md:mt-4 p-3 md:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <p className="italic text-sm text-gray-500">No tasks available yet.</p>
              </div>
            </div>
          ) : selectedTab === 'memory' ? (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-900">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-100">Memory</h2>
              <p className="text-sm md:text-base text-gray-400">
                Browse {selectedAgent}'s long-term memory and knowledge base.
              </p>
              <div className="mt-3 md:mt-4 p-3 md:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <p className="italic text-sm text-gray-500">Memory browser coming soon.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-900">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-100">Thoughts</h2>
              <p className="text-sm md:text-base text-gray-400">
                See what {selectedAgent} is currently thinking about.
              </p>
              <div className="mt-3 md:mt-4 p-3 md:p-4 border border-gray-700 rounded-lg bg-gray-800">
                <p className="italic text-sm text-gray-500">Thought visualization coming soon.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
} 