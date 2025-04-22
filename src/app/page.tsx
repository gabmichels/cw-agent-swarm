'use client';

import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Send, Menu, X } from 'lucide-react';
import { marked } from 'marked';

// Configure marked options for better formatting
marked.setOptions({
  gfm: true,    // GitHub Flavored Markdown
  breaks: true  // Add <br> on single line breaks
});

// Define message type for better type safety
interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  memory?: string[];
  thoughts?: string[];
}

// Function to safely parse markdown
const renderMarkdown = (content: string) => {
  try {
    // Pre-process the content to handle escaped newlines and improve markdown formatting
    let processedContent = content
      .replace(/\\n/g, '\n') // Replace escaped newlines with actual newlines
      .replace(/\\"/g, '"'); // Handle escaped quotes
      
    // Special case: Check if this is a numbered list with indented descriptions
    // This pattern is common in responses like marketing rules
    if (processedContent.includes("1. **") && processedContent.includes("\n   ")) {
      try {
        // Split into introduction and list items
        const parts = processedContent.split("\n\n1. ");
        const intro = parts[0].trim();
        
        // Start building the HTML
        let result = intro ? `<p>${intro}</p>\n` : '';
        result += '<ol class="list-decimal pl-5">';
        
        // Process list items
        const listText = "1. " + parts.slice(1).join("\n\n1. ");
        const listItems = listText.split(/\n\n\d+\.\s+/);
        
        for (let i = 0; i < listItems.length; i++) {
          if (!listItems[i].trim()) continue;
          
          let item = listItems[i].trim();
          
          // Check if this item has a bold title and a description
          if (item.startsWith('**') && item.includes('**\n')) {
            const titleEndIndex = item.indexOf('**\n');
            const title = item.substring(2, titleEndIndex);
            const rest = item.substring(titleEndIndex + 3).trim();
            
            result += `\n  <li class="mb-2">
    <strong class="text-indigo-300">${title}</strong>
    <br>
    <span class="text-gray-300">${rest}</span>
  </li>`;
          } else if (item.startsWith('**')) {
            // Item with just a bold title
            const endBoldIndex = item.indexOf('**', 2);
            if (endBoldIndex !== -1) {
              const title = item.substring(2, endBoldIndex);
              const rest = item.substring(endBoldIndex + 2).trim();
              
              result += `\n  <li class="mb-2">
    <strong class="text-indigo-300">${title}</strong>
    ${rest ? `<span class="text-gray-300">${rest}</span>` : ''}
  </li>`;
            } else {
              // Just add the item as is
              result += `\n  <li class="mb-2">${item}</li>`;
            }
          } else {
            // Regular list item
            result += `\n  <li class="mb-2">${item}</li>`;
          }
        }
        
        result += '\n</ol>';
        return result;
      } catch (err) {
        console.error('Error in special list parsing:', err);
        // Fall back to standard markdown if our special parsing fails
        return marked(processedContent);
      }
    }
    
    // For all other content, use regular markdown parsing
    return marked(processedContent);
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return content;
  }
};

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('Chloe');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [chloeCheckResults, setChloeCheckResults] = useState<any>(null);
  const [fixInstructions, setFixInstructions] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial chat history from the server
  useEffect(() => {
    async function loadInitialChat() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/chat?userId=default-user');
        
        if (!response.ok) {
          throw new Error(`Failed to load chat history: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.history && data.history.length > 0) {
          // Convert server messages to our client format
          const formattedMessages = data.history.map((msg: any) => ({
            sender: msg.role === 'user' ? 'You' : selectedAgent,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            memory: msg.memory || [],
            thoughts: msg.thoughts || []
          }));
          
          setMessages(formattedMessages);
        } else {
          // Fallback to default welcome message if no history
          setMessages([{
            sender: selectedAgent,
            content: `Hello! I'm ${selectedAgent}, your marketing expert. How can I help you today?`,
            timestamp: new Date()
          }]);
        }
      } catch (error) {
        console.error("Error loading initial chat:", error);
        // Set a basic welcome message on error
        setMessages([{
          sender: selectedAgent,
          content: `Hello! I'm ${selectedAgent}. There was an error loading our previous conversation.`,
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadInitialChat();
  }, [selectedAgent]);

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

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
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
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Call the actual API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: sentMessage,
          userId: 'default-user', // We can improve this later
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Use the actual response from the API
      const agentResponse: Message = {
        sender: selectedAgent,
        content: data.reply,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      // Log memory and thoughts for debugging
      if (data.memory && data.memory.length > 0) {
        console.log('Memory context used:', data.memory);
      }
      
      if (data.thoughts && data.thoughts.length > 0) {
        console.log('Agent thoughts:', data.thoughts);
      }
      
      setMessages(prev => [...prev, agentResponse]);
    } catch (error) {
      console.error("Error calling API:", error);
      
      // Show error message
      const errorResponse: Message = {
        sender: selectedAgent,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Test connection to the API and check if Chloe is loading
  const testChloeAgent = async () => {
    console.log("Testing Chloe agent connection...");
    setIsLoading(true);
    
    try {
      // Call chat API with a test message
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "TEST_CONNECTION: Check if Chloe agent is working",
          userId: 'debug-user',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show debug message
      const debugMessage: Message = {
        sender: 'Debug',
        content: `Agent Status: ${data.reply.includes('SIMULATED') ? '❌ Using simulated response' : '✅ Real agent connected'}\n\nResponse: ${data.reply}`,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      setMessages(prev => [...prev, debugMessage]);
      
      // Log details
      console.log("Chloe agent test response:", data);
    } catch (error) {
      console.error("Error testing Chloe agent:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Debug',
        content: `Failed to test Chloe agent: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debug function to examine Chloe's memory
  const inspectChloeMemory = async () => {
    console.log("Inspecting Chloe's memory...");
    setIsLoading(true);
    
    try {
      // Call chat API with a special command to inspect memory
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "DEBUG_COMMAND: What memories do you have about our conversation so far?",
          userId: 'debug-user',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Show memory inspection results
      const memoryMessage: Message = {
        sender: 'Debug',
        content: `Memory Inspection: ${data.reply}`,
        timestamp: new Date(),
        memory: data.memory,
        thoughts: data.thoughts
      };
      
      setMessages(prev => [...prev, memoryMessage]);
      
      // Log details
      console.log("Chloe memory inspection:", data);
    } catch (error) {
      console.error("Error inspecting Chloe memory:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Debug',
        content: `Failed to inspect Chloe memory: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Run diagnostics to check why Chloe isn't loading
  const runDiagnostics = async () => {
    console.log("Running system diagnostics...");
    setIsLoading(true);
    
    try {
      // Call diagnostics API
      const response = await fetch('/api/diagnostics');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setDiagnosticResults(data);
      
      // Show diagnostic results
      const diagnosticMessage: Message = {
        sender: 'Diagnostics',
        content: `System Diagnostics Results:
        
${formatDiagnosticSummary(data)}

Check the Debug panel for full details.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, diagnosticMessage]);
      
      // Log details
      console.log("Diagnostics results:", data);
    } catch (error) {
      console.error("Error running diagnostics:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to run diagnostics: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format diagnostic results for display
  const formatDiagnosticSummary = (data: any): string => {
    if (!data || !data.diagnostics) {
      return "No diagnostic data available";
    }
    
    const { diagnostics } = data;
    const summary = [];
    
    // Check Chloe package
    if (diagnostics.chloePackage) {
      summary.push(`Chloe Package: ${diagnostics.chloePackage.success ? '✅' : '❌'} ${diagnostics.chloePackage.message}`);
    }
    
    // Check Chloe exports
    if (diagnostics.chloeExports) {
      const hasChloeAgent = diagnostics.chloeExports.details?.hasChloeAgent;
      summary.push(`Chloe Exports: ${diagnostics.chloeExports.success ? '✅' : '❌'} ${hasChloeAgent ? 'ChloeAgent found' : 'ChloeAgent not found'}`);
    }
    
    // Check environment variables
    if (diagnostics.environmentVars) {
      const missingVars = diagnostics.environmentVars.details?.missing || [];
      summary.push(`Environment Variables: ${diagnostics.environmentVars.success ? '✅ All set' : `❌ Missing: ${missingVars.join(', ')}`}`);
    }
    
    // Check required packages
    const packages = [
      { name: 'LangChain Core', result: diagnostics.langchainPackage },
      { name: 'LangChain OpenAI', result: diagnostics.openaiPackage },
      { name: 'LangGraph', result: diagnostics.langgraphPackage }
    ];
    
    summary.push('Required Packages:');
    packages.forEach(pkg => {
      if (pkg.result) {
        summary.push(`  - ${pkg.name}: ${pkg.result.success ? '✅' : '❌'}`);
      }
    });
    
    return summary.join('\n');
  };

  // Check Chloe's functionality directly
  const checkChloe = async () => {
    console.log("Checking Chloe agent...");
    setIsLoading(true);
    
    try {
      // Call check-chloe API
      const response = await fetch('/api/check-chloe');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setChloeCheckResults(data);
      
      // Format the steps for display
      const stepsMessage = data.steps ? data.steps.join('\n') : 'No steps recorded';
      
      // Show results
      const checkMessage: Message = {
        sender: 'Diagnostics',
        content: `Chloe Agent Check ${data.success ? '✅' : '❌'}:

${stepsMessage}

${data.error ? `Error: ${data.error}` : ''}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, checkMessage]);
      
      // Log details
      console.log("Chloe check results:", data);
    } catch (error) {
      console.error("Error checking Chloe:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to check Chloe: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show instructions to fix Chloe agent
  const showFixInstructions = async () => {
    console.log("Fetching fix instructions...");
    setIsLoading(true);
    
    try {
      // Call fix-instructions API
      const response = await fetch('/api/fix-instructions');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setFixInstructions(data);
      
      // Show a summary of the instructions
      const instructionMessage: Message = {
        sender: 'Diagnostics',
        content: `📋 ${data.title}

Here are the main steps to check:
1. Package Installation: Make sure @crowd-wisdom/agents-chloe is installed
2. Environment Variables: Check .env.local for required API keys
3. API Keys: Verify OpenRouter and Qdrant API keys are valid
4. Export Format: Ensure correct exports in the package
5. Rebuild and Restart: Try rebuilding and restarting the server

For detailed instructions, see the Debug panel.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, instructionMessage]);
      
      // Log details
      console.log("Fix instructions:", data);
    } catch (error) {
      console.error("Error fetching fix instructions:", error);
      
      // Show error message
      const errorMessage: Message = {
        sender: 'Diagnostics',
        content: `Failed to fetch fix instructions: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
            <li>
              <button 
                className="text-gray-300 hover:text-indigo-400"
                onClick={() => setIsDebugMode(!isDebugMode)}
              >
                {isDebugMode ? 'Hide Debug' : 'Debug'}
              </button>
            </li>
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
                        <div 
                          className="text-sm md:text-base prose prose-invert prose-ul:pl-5 prose-ul:my-1 prose-ol:pl-5 prose-ol:my-1 prose-ol:list-decimal prose-li:my-0.5 prose-li:pl-1 prose-li:marker:text-indigo-400 prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-strong:text-indigo-300 max-w-none" 
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        />
                        <div className={`text-xs mt-1 flex items-center justify-between ${message.sender === 'You' ? 'text-indigo-300' : 'text-gray-500'}`}>
                          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {message.sender !== 'You' && (
                            <div className="flex space-x-1">
                              {message.memory && message.memory.length > 0 && (
                                <span 
                                  title="Used memory context"
                                  className="cursor-pointer text-indigo-400 hover:text-indigo-300"
                                  onClick={() => setSelectedTab('memory')}
                                >
                                  📚
                                </span>
                              )}
                              {message.thoughts && message.thoughts.length > 0 && (
                                <span 
                                  title="Has reasoning thoughts"
                                  className="cursor-pointer text-indigo-400 hover:text-indigo-300"
                                  onClick={() => setSelectedTab('thoughts')}
                                >
                                  💭
                                </span>
                              )}
                            </div>
                          )}
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
                {isDebugMode && (
                  <div className="flex justify-end mb-2 space-x-2">
                    <button
                      onClick={testChloeAgent}
                      disabled={isLoading}
                      className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      Test Chloe Agent
                    </button>
                    <button
                      onClick={inspectChloeMemory}
                      disabled={isLoading}
                      className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      Inspect Memory
                    </button>
                    <button
                      onClick={runDiagnostics}
                      disabled={isLoading}
                      className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      Run Diagnostics
                    </button>
                    <button
                      onClick={checkChloe}
                      disabled={isLoading}
                      className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      Check Chloe
                    </button>
                    <button
                      onClick={showFixInstructions}
                      disabled={isLoading}
                      className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 disabled:opacity-50"
                    >
                      Fix Instructions
                    </button>
                  </div>
                )}
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
              <p className="text-sm md:text-base text-gray-400 mb-4">
                Browse {selectedAgent}'s long-term memory and knowledge base. This shows what context is retrieved when answering your questions.
              </p>
              
              {!isDebugMode && (
                <div className="mb-4">
                  <button
                    onClick={() => setIsDebugMode(true)}
                    className="px-3 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 flex items-center"
                  >
                    <span className="mr-1">🪲</span> Enable Debug Mode
                  </button>
                </div>
              )}
              
              <div className="space-y-6">
                {messages.some(m => m.memory && m.memory.length > 0) ? (
                  messages.filter(m => m.memory && m.memory.length > 0).map((message, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-start mb-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-900 text-indigo-300 mr-3 flex items-center justify-center font-medium">
                          {message.sender === 'You' ? 'Y' : message.sender.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-200">Memory context used for response</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content}
                          </p>
                          <div className="text-xs text-gray-500 mt-1">
                            {message.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-700 pt-3 mt-3">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Memory items used:</h4>
                        <div className="space-y-2">
                          {message.memory?.map((mem, memIdx) => (
                            <div key={memIdx} className="text-sm bg-gray-700 p-3 rounded text-gray-200">
                              {mem}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                    <p className="italic text-sm text-gray-400 my-6">
                      No memory context has been used yet. As you have more conversation with {selectedAgent}, 
                      she will start drawing on past interactions to provide more relevant answers.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-gray-900">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-gray-100">Thoughts</h2>
              <p className="text-sm md:text-base text-gray-400 mb-4">
                See how {selectedAgent} reasons about your questions. These are internal thought processes that help generate the response.
              </p>
              
              {!isDebugMode && (
                <div className="mb-4">
                  <button
                    onClick={() => setIsDebugMode(true)}
                    className="px-3 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 flex items-center"
                  >
                    <span className="mr-1">🪲</span> Enable Debug Mode
                  </button>
                </div>
              )}
              
              <div className="space-y-6">
                {messages.some(m => m.thoughts && m.thoughts.length > 0) ? (
                  messages.filter(m => m.thoughts && m.thoughts.length > 0).map((message, idx) => (
                    <div key={idx} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-start mb-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-900 text-indigo-300 mr-3 flex items-center justify-center font-medium">
                          {message.sender === 'You' ? 'Y' : message.sender.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-200">Thought process for response</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content}
                          </p>
                          <div className="text-xs text-gray-500 mt-1">
                            {message.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-700 pt-3 mt-3">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Thinking steps:</h4>
                        <div className="space-y-2">
                          {message.thoughts?.map((thought, thoughtIdx) => (
                            <div key={thoughtIdx} className="text-sm bg-gray-700 p-3 rounded text-gray-200 overflow-auto">
                              <pre className="whitespace-pre-wrap">{thought}</pre>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-center">
                    <p className="italic text-sm text-gray-400 my-6">
                      No thought processes have been captured yet. As you interact with {selectedAgent},
                      her reasoning process will be displayed here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Debug panel */}
      {isDebugMode && (diagnosticResults || chloeCheckResults || fixInstructions) && (
        <div className="bg-gray-900 border-t border-gray-700 p-3 text-xs overflow-auto max-h-[200px]">
          <h3 className="text-gray-300 font-medium mb-2">Debug Results</h3>
          
          {diagnosticResults && (
            <div className="mb-3">
              <h4 className="text-gray-400 font-medium mb-1">System Diagnostics:</h4>
              <pre className="text-gray-400 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(diagnosticResults, null, 2)}
              </pre>
            </div>
          )}
          
          {chloeCheckResults && (
            <div className="mb-3">
              <h4 className="text-gray-400 font-medium mb-1">Chloe Check:</h4>
              <pre className="text-gray-400 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(chloeCheckResults, null, 2)}
              </pre>
            </div>
          )}
          
          {fixInstructions && (
            <div>
              <h4 className="text-gray-400 font-medium mb-1">Fix Instructions:</h4>
              <div className="text-gray-400">
                <h5 className="font-medium">{fixInstructions.title}</h5>
                {fixInstructions.instructions?.map((section: any, i: number) => (
                  <div key={i} className="mt-2">
                    <div className="font-medium">{section.title}</div>
                    {section.steps && (
                      <ul className="list-disc list-inside pl-2 mt-1">
                        {section.steps.map((step: string, j: number) => (
                          <li key={j}>{step}</li>
                        ))}
                      </ul>
                    )}
                    {section.issues && (
                      <div className="pl-2 mt-1">
                        {section.issues.map((issue: any, k: number) => (
                          <div key={k} className="mt-1">
                            <div className="text-red-400">{issue.error}</div>
                            <div className="pl-2">Fix: {issue.fix}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 