'use client';

import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TabsNavigation from '../components/TabsNavigation';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';
import ToolsTab from '../components/tabs/ToolsTab';
import TasksTab from '../components/tabs/TasksTab';
import MemoryTab from '../components/tabs/MemoryTab';
import SocialMediaTable from '../components/SocialMediaTable';
import FilesTable from '../components/FilesTable';
import { formatCronExpression } from '../utils/cronFormatter';
import { Message, FileAttachment, MemoryItem, Task, ScheduledTask } from '../types';

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState('Marketing');
  const [selectedAgent, setSelectedAgent] = useState('Chloe');
  const [selectedTab, setSelectedTab] = useState('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [chloeCheckResults, setChloeCheckResults] = useState<any>(null);
  const [fixInstructions, setFixInstructions] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [memoryViewMode, setMemoryViewMode] = useState('context');
  const [allMemories, setAllMemories] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isSocialDataLoading, setIsSocialDataLoading] = useState(false);
  
  // Toggle functions for new UI features
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // Toggle sidebar pin state
  const toggleSidebarPin = () => setIsSidebarPinned(!isSidebarPinned);
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);
  
  // Toggle department dropdown
  const toggleDeptDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeptDropdownOpen(!isDeptDropdownOpen);
    setIsAgentDropdownOpen(false);
  };
  
  // Toggle agent dropdown
  const toggleAgentDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAgentDropdownOpen(!isAgentDropdownOpen);
    setIsDeptDropdownOpen(false);
  };
  
  // Close all dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsDeptDropdownOpen(false);
      setIsAgentDropdownOpen(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  // Available departments
  const departments = ['Marketing', 'HR', 'Finance', 'Sales'];
  
  // Available agents per department
  const agentsByDepartment = {
    Marketing: ['Chloe'],
    HR: ['Emma (Soon)'],
    Finance: ['Alex (Soon)'],
    Sales: ['Sam (Soon)']
  };
  
  // Handle department change
  const handleDepartmentChange = (dept: string) => {
    setSelectedDepartment(dept);
    setIsDeptDropdownOpen(false);
    
    // Select first agent from new department
    const availableAgents = agentsByDepartment[dept as keyof typeof agentsByDepartment] || [];
    if (availableAgents.length > 0 && !availableAgents[0].includes('Soon')) {
      setSelectedAgent(availableAgents[0]);
    }
  };
  
  // Handle agent change
  const handleAgentChange = (agent: string) => {
    if (!agent.includes('Soon')) {
      setSelectedAgent(agent);
    }
    setIsAgentDropdownOpen(false);
  };

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

  // Handle file selection for preview
  const handleFileSelect = async (file: File) => {
    try {
      // Determine file type for appropriate handling
      let fileType: FileAttachment['type'] = 'other';
      let preview = '';
      
      if (file.type.startsWith('image/')) {
        fileType = 'image';
        preview = URL.createObjectURL(file);
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
        preview = URL.createObjectURL(file);
      } else if (file.type.includes('document') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        fileType = 'document';
      } else if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        fileType = 'text';
        // For text files, we can read and preview the content
        const text = await file.text();
        preview = text.substring(0, 150) + (text.length > 150 ? '...' : '');
      }
      
      // Add to pending attachments
      setPendingAttachments(prev => [...prev, {
        file,
        preview,
        type: fileType
      }]);

      // Focus the input field for user to add context
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Error processing file:', error);
      handleFileUploadError('Failed to process file for preview');
    }
  };
  
  // Remove a pending attachment
  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => {
      const updated = [...prev];
      // Revoke the object URL if it's an image to prevent memory leaks
      if (updated[index].preview && updated[index].type === 'image') {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
  };
  
  // Handle clipboard paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Check if the input is focused
      if (document.activeElement !== inputRef.current) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      let foundImage = false;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // If it's an image, create a File and add it to pending attachments
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault(); // Prevent the default paste behavior
            // Generate a unique name for the pasted image
            const timestamp = new Date().getTime();
            const modifiedFile = new File([file], `pasted-image-${timestamp}.png`, { type: file.type });
            handleFileSelect(modifiedFile);
            foundImage = true;
          }
        }
      }
      
      // If we found and processed an image, stop here
      if (foundImage) {
        console.log('Image pasted from clipboard and added to pending attachments');
      }
    };
    
    // Add the paste event listener to the document
    document.addEventListener('paste', handlePaste as EventListener);
    
    // Clean up
    return () => {
      document.removeEventListener('paste', handlePaste as EventListener);
    };
  }, []);
  
  // Handle drag and drop on the input area
  useEffect(() => {
    const handleDrop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      
      const dragEvent = e as DragEvent;
      if (dragEvent.dataTransfer?.files) {
        const files = Array.from(dragEvent.dataTransfer.files);
        files.forEach(file => handleFileSelect(file));
      }
    };
    
    const handleDragOver = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    const inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
      inputArea.addEventListener('drop', handleDrop);
      inputArea.addEventListener('dragover', handleDragOver);
    }
    
    return () => {
      if (inputArea) {
        inputArea.removeEventListener('drop', handleDrop);
        inputArea.removeEventListener('dragover', handleDragOver);
      }
    };
  }, []);

  // Handle file upload completion
  const handleFileUploadComplete = async (result: any) => {
    // Create a system message about the file
    const fileMessage: Message = {
      sender: 'System',
      content: `📁 File uploaded: ${result.filename}\n${result.summary ? `\nSummary: ${result.summary}` : ''}\n\nThe file has been processed and added to memory. You can reference it in your conversation or view it in the Files tab.`,
        timestamp: new Date()
      };
      
    // Add to messages
    setMessages(prevMessages => [...prevMessages, fileMessage]);
    
    // Refresh the Files list
    if (selectedTab === 'files') {
      fetchAllMemories();
    }
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Test Chloe agent directly
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

  // New function to reset chat history
  const resetChatHistory = async () => {
    if (!confirm('Are you sure you want to reset the chat history? This will clear all messages.')) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      // First try to reset the database schema
      const resetResponse = await fetch('/api/memory/reset-schema');
      
      if (!resetResponse.ok) {
        console.error('Error resetting memory schema:', await resetResponse.text());
      } else {
        console.log('Reset memory schema successfully');
      }
      
      // Set a new welcome message
      setMessages([{
        sender: selectedAgent,
        content: `Hello! I'm ${selectedAgent}. Our conversation has been reset.`,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error resetting chat history:', error);
      
      setMessages([{
        sender: selectedAgent,
        content: `Hello! I'm ${selectedAgent}. There was an error resetting our conversation.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all memories
  const fetchAllMemories = async () => {
    setIsLoadingMemories(true);
    
    try {
      const response = await fetch('/api/memory/all');
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      setAllMemories(data);
    } catch (error) {
      console.error("Error fetching all memories:", error);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Fetch scheduled tasks
  const fetchScheduledTasks = async (): Promise<void> => {
    setIsLoadingTasks(true);
    try {
      const res = await fetch('/api/scheduler-tasks');
      if (!res.ok) {
        throw new Error('Failed to fetch scheduled tasks');
      }
      const data = await res.json();
      
      // Log the actual data returned to help debug
      console.log("Scheduler tasks response received");
      console.log("Number of tasks:", Array.isArray(data) ? data.length : 0);
      if (Array.isArray(data) && data.length > 0) {
        console.log("First task sample:", data[0]);
      }
      
      // Set the tasks directly as the API now returns the array format we need
      setScheduledTasks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching scheduled tasks:', error);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Run a scheduled task immediately
  const runTaskNow = async (taskId: string): Promise<void> => {
    try {
      const response = await fetch('/api/run-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run task: ${response.statusText}`);
      }
      
      // Refresh task list after running a task
      console.log(`Task ${taskId} ran successfully`);
    } catch (error) {
      console.error('Error running task:', error);
      throw error;
    }
  };

  // Toggle task enabled status
  const toggleTaskEnabled = async (taskId: string, enabled: boolean): Promise<void> => {
    try {
      const response = await fetch('/api/toggle-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, enabled }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to toggle task: ${response.statusText}`);
      }
      
      setScheduledTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId ? { ...task, enabled } : task
        )
      );
    } catch (error) {
      console.error('Error toggling task:', error);
      throw error;
    }
  };

  // Fetch tasks when tab changes to 'tasks'
  useEffect(() => {
    if (selectedTab === 'tasks') {
      fetchScheduledTasks();
    }
    if (selectedTab === 'memory') {
      fetchAllMemories();
    }
  }, [selectedTab]);

  // Add this function to the Home component
  const runDirectMarketScan = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/run-market-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run market scan: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Display result to user
      setMessages([
        ...messages,
        {
          sender: 'Chloe',
          content: data.message || 'Market scan completed',
          timestamp: new Date(),
        },
      ]);
      
      console.log('Market scan result:', data);
    } catch (error) {
      console.error('Error running direct market scan:', error);
      
      // Display error to user
      setMessages([
        ...messages,
        {
          sender: 'Chloe',
          content: `Error running market scan: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add function to handle file upload errors
  const handleFileUploadError = (error: string) => {
    // Create an error message
    const errorMessage: Message = {
      sender: 'System',
      content: `❌ Error uploading file: ${error}`,
      timestamp: new Date()
    };
    
    // Add to messages
    setMessages(prevMessages => [...prevMessages, errorMessage]);
    
    // Scroll to bottom
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Enhanced to include file attachments
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    console.log("Form submitted with:", inputMessage);
    
    if (!inputMessage.trim() && pendingAttachments.length === 0) return;

    // Add user message with file context if attachments exist
    const messageContent = pendingAttachments.length > 0 
      ? inputMessage || "(Attached file without context)"
      : inputMessage;
      
    const userMessage: Message = {
      sender: 'You',
      content: messageContent,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Store and clear input
    const sentMessage = inputMessage;
    setInputMessage('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Prepare form data if we have attachments
      let response;
      
      if (pendingAttachments.length > 0) {
        const formData = new FormData();
        formData.append('message', sentMessage); // Send user's context about the file
        formData.append('userId', 'default-user');
        
        // Log the context being sent with files
        console.log("Sending files with context:", sentMessage);
        
        // Add each file to the formData
        pendingAttachments.forEach((attachment, index) => {
          formData.append(`file_${index}`, attachment.file);
        });
        
        // Send to server with multipart/form-data
        response = await fetch('/api/chat-with-files', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Standard JSON request without files
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: sentMessage,
            userId: 'default-user', // We can improve this later
          }),
        });
      }
      
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
      
      // Clear pending attachments after sending
      setPendingAttachments([]);
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header - hide in fullscreen mode */}
      {!isFullscreen && (
        <Header
          selectedDepartment={selectedDepartment}
          selectedAgent={selectedAgent}
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
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - conditionally show based on state */}
        <div 
          className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 
            ${isSidebarOpen ? 'w-64' : 'w-0'} 
            ${isFullscreen ? 'hidden' : 'block'}`}
        >
          {isSidebarOpen && (
            <Sidebar
              isSidebarOpen={isSidebarOpen}
              isSidebarPinned={isSidebarPinned}
              selectedAgent={selectedAgent}
              toggleSidebarPin={toggleSidebarPin}
              setSelectedAgent={setSelectedAgent}
            />
          )}
        </div>

        {/* Chat container */}
        <div className={`flex-1 flex flex-col ${isFullscreen ? 'w-full' : ''}`}>
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat header with tabs and fullscreen toggle */}
            <TabsNavigation
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
            />

            {/* Main chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedTab === 'chat' && <ChatMessages messages={messages} />}
              
              {selectedTab === 'tasks' && (
                <TasksTab
                  isLoadingTasks={isLoadingTasks}
                  scheduledTasks={scheduledTasks}
                  runTaskNow={runTaskNow}
                  toggleTaskEnabled={toggleTaskEnabled}
                  formatCronExpression={formatCronExpression}
                />
              )}
              
              {selectedTab === 'memory' && (
                <MemoryTab
                  isLoadingMemories={isLoadingMemories}
                  allMemories={allMemories}
                />
              )}
              
              {selectedTab === 'tools' && (
                <ToolsTab
                  isLoading={isLoading}
                  checkChloe={checkChloe}
                  runDiagnostics={runDiagnostics}
                  inspectChloeMemory={inspectChloeMemory}
                  resetChatHistory={resetChatHistory}
                  testChloeAgent={testChloeAgent}
                  showFixInstructions={showFixInstructions}
                  runDirectMarketScan={runDirectMarketScan}
                  diagnosticResults={diagnosticResults}
                  chloeCheckResults={chloeCheckResults}
                  fixInstructions={fixInstructions}
                  isDebugMode={isDebugMode}
                />
              )}
              
              {selectedTab === 'social' && <SocialMediaTable />}
              
              {selectedTab === 'files' && <FilesTable onRefresh={fetchAllMemories} />}
            </div>

            {/* Input area */}
            <div className="border-t border-gray-700 p-4">
              {selectedTab === 'chat' && (
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
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
