'use client';

import React, { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import TabsNavigation from '../components/TabsNavigation';
import ChatInput from '../components/ChatInput';
import ToolsTab from '../components/tabs/ToolsTab';
import TasksTab from '../components/tabs/TasksTab';
import MemoryTab from '../components/tabs/MemoryTab';
import KnowledgeTab from '../components/tabs/KnowledgeTab';
import SocialMediaTable from '../components/SocialMediaTable';
import FilesTable from '../components/FilesTable';
import { formatCronExpression } from '../utils/cronFormatter';
import { Message, FileAttachment, MemoryItem, Task, ScheduledTask } from '../types';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ChatMessages from '../components/ChatMessages';
import { TASK_IDS } from '../lib/shared/constants';
import DevModeToggle from '../components/DevModeToggle';
import { filterChatVisibleMessages } from '../utils/messageFilters';
import { MessageType } from '../constants/message';
import { analyzeMessageTypes, exportDebugMessages, toggleMessageDebugging } from '../utils/messageDebug';

// Add constants for storage
const SAVED_ATTACHMENTS_KEY = 'crowd-wisdom-saved-attachments';
const IMAGE_DATA_STORAGE_KEY = 'crowd-wisdom-image-data';
const INDEXED_DB_NAME = 'crowd-wisdom-storage';
const ATTACHMENT_STORE = 'file-attachments';
const DEV_SHOW_INTERNAL_MESSAGES_KEY = 'DEV_SHOW_INTERNAL_MESSAGES';

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [memoryViewMode, setMemoryViewMode] = useState('context');
  const [allMemories, setAllMemories] = useState<any[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [isSocialDataLoading, setIsSocialDataLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState<string>('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [showInternalMessages, setShowInternalMessages] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  
  // Initialize showInternalMessages from localStorage
  useEffect(() => {
    // First check if there's a localStorage setting
    const devModeEnabled = localStorage.getItem(DEV_SHOW_INTERNAL_MESSAGES_KEY) === 'true';
    
    console.log(`[DEBUG] Dev mode from localStorage: ${devModeEnabled}`);
    console.log(`[DEBUG] Current internal messages flag: ${showInternalMessages}`);
    
    // Set the state based on localStorage value
    setShowInternalMessages(devModeEnabled);
    
    // Provide a way to reset it from console if needed
    (window as any).resetDevMode = () => {
      localStorage.removeItem(DEV_SHOW_INTERNAL_MESSAGES_KEY);
      setShowInternalMessages(false);
      console.log('Dev mode reset to false');
    };
  }, []);
  
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

  // Define function to initialize IndexedDB for file storage
  const initializeDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(INDEXED_DB_NAME, 1);
      
      request.onerror = (event) => {
        console.error("Error opening IndexedDB", event);
        reject("Failed to open IndexedDB");
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("IndexedDB opened successfully");
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("Creating attachment store in IndexedDB");
        
        // Create object store for attachments if it doesn't exist
        if (!db.objectStoreNames.contains(ATTACHMENT_STORE)) {
          const store = db.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log("Attachment store created");
        }
      };
    });
  };

  // Function to save file data to IndexedDB
  const saveFileToIndexedDB = async (fileData: { id: string, data: string, type: string, filename: string, timestamp: number }): Promise<string> => {
    try {
      const db = await initializeDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ATTACHMENT_STORE], 'readwrite');
        const store = transaction.objectStore(ATTACHMENT_STORE);
        
        const request = store.put(fileData);
        
        request.onsuccess = () => {
          console.log(`File ${fileData.filename} saved to IndexedDB`);
          resolve(fileData.id);
        };
        
        request.onerror = (event) => {
          console.error("Error saving file to IndexedDB", event);
          reject("Failed to save file");
        };
      });
    } catch (error) {
      console.error("IndexedDB error:", error);
      throw error;
    }
  };

  // Function to retrieve file data from IndexedDB
  const getFileFromIndexedDB = async (id: string): Promise<string | null> => {
    try {
      // Validate ID parameter
      if (!id || id.trim() === '') {
        console.warn('Empty or invalid ID provided to getFileFromIndexedDB');
        return null;
      }
      
      const db = await initializeDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([ATTACHMENT_STORE], 'readonly');
        const store = transaction.objectStore(ATTACHMENT_STORE);
        
        const request = store.get(id);
        
        request.onsuccess = () => {
          const file = request.result;
          if (file) {
            console.log(`File ${id} retrieved from IndexedDB`);
            resolve(file.data);
          } else {
            console.log(`File ${id} not found in IndexedDB`);
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          console.error("Error retrieving file from IndexedDB", event);
          reject("Failed to retrieve file");
        };
      });
    } catch (error) {
      console.error("IndexedDB error:", error);
      return null;
    }
  };

  // Get image data from separate storage
  const getImageDataFromStorage = async (id: string): Promise<string | null> => {
    try {
      // Check if ID is valid
      if (!id) {
        console.warn('Empty image ID provided to getImageDataFromStorage');
        return null;
      }
      
      // First try to get it from IndexedDB
      const imageData = await getFileFromIndexedDB(id);
      return imageData;
    } catch (error) {
      console.error('Error getting image data from IndexedDB:', error);
      
      // Legacy fallback: Try to get from localStorage if it exists there
      try {
        const imageStorage = JSON.parse(localStorage.getItem(IMAGE_DATA_STORAGE_KEY) || '{}');
        return imageStorage[id] || null;
      } catch (storageError) {
        console.error('Error getting image data from localStorage fallback:', storageError);
        return null;
      }
    }
  };

  // Create a thumbnail from an image data URL
  const createThumbnail = (dataUrl: string, maxDimension = 100): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round(height * (maxDimension / width));
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round(width * (maxDimension / height));
              height = maxDimension;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.5));
          } else {
            reject(new Error('Failed to get canvas context'));
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  // Enhanced file selection that creates and stores thumbnails
  const handleFileSelect = async (file: File) => {
    try {
      // Determine file type for appropriate handling
      let fileType: FileAttachment['type'] = 'other';
      let preview = '';
      
      if (file.type.startsWith('image/')) {
        fileType = 'image';
        
        // Create a unique ID for this image
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Read as data URL
        preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        try {
          // Save full image data to IndexedDB
          await saveFileToIndexedDB({
            id: imageId,
            data: preview, // Save the full image data
            type: file.type,
            filename: file.name,
            timestamp: Date.now()
          });
          console.log(`Full image data successfully stored in IndexedDB for ID: ${imageId}`);
          
          // Create a thumbnail for preview in chat
          const thumbnail = await createThumbnail(preview);
          console.log(`Created thumbnail: ${thumbnail.substring(0, 50)}...`);
          
          // Add to pending attachments with both thumbnail and reference to full image
          setPendingAttachments(prev => [...prev, {
            file,
            preview: thumbnail, // Use the thumbnail for preview
            type: fileType,
            filename: file.name,
            fileId: imageId // Store image ID to reference the full data
          }]);
        } catch (thumbError) {
          console.error('Error creating thumbnail or storing image:', thumbError);
          // Fall back to the original preview if thumbnail creation fails
          setPendingAttachments(prev => [...prev, {
            file,
            preview,
            type: fileType,
            fileId: imageId // Still store the ID even if thumbnail creation fails
          }]);
        }
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
        preview = URL.createObjectURL(file);
        
        // Add to pending attachments
        setPendingAttachments(prev => [...prev, {
          file,
          preview,
          type: fileType
        }]);
      } else if (file.type.includes('document') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
        fileType = 'document';
        
        // Add to pending attachments
        setPendingAttachments(prev => [...prev, {
          file,
          preview: '',
          type: fileType
        }]);
      } else if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        fileType = 'text';
        // For text files, we can read and preview the content
        const text = await file.text();
        preview = text.substring(0, 150) + (text.length > 150 ? '...' : '');
        
        // Add to pending attachments
        setPendingAttachments(prev => [...prev, {
          file,
          preview,
          type: fileType
        }]);
      } else {
        // Add to pending attachments for other file types
        setPendingAttachments(prev => [...prev, {
          file,
          preview: '',
          type: fileType
        }]);
      }

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
            
            // Handle file with special flag to ensure data URL is created
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
          userId: 'gab',
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
          userId: 'gab',
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
    console.log('Fetching all memories...');
    setIsLoadingMemories(true);
    setAllMemories([]); // Clear existing memories while loading
    
    try {
      // Use the correct API endpoint URL (without /route)
      const response = await fetch(`/api/memory/all?_=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`API error: ${response.status} - ${response.statusText}`);
        throw new Error(`API error: ${response.status}`);
      }
      
      // Log the raw response for debugging
      const responseText = await response.text();
      console.log(`Memory API response (first 100 chars): ${responseText.substring(0, 100)}...`);
      
      let data;
      try {
        // Try to parse the response as JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse memory API response:', parseError);
        console.error('Raw response:', responseText.substring(0, 200));
        setAllMemories([]);
        return;
      }
      
      // Determine if we have a valid data structure
      if (Array.isArray(data)) {
        console.log(`Fetched ${data.length} memories (array format)`);
        
        // Filter out any null or invalid entries
        const validMemories = data.filter((item: any) => item && typeof item === 'object');
        console.log(`Valid memories: ${validMemories.length} out of ${data.length}`);
        
        setAllMemories(validMemories);
      } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
        // Handle response format with items array
        console.log(`Fetched ${data.items.length} memories (object.items format)`);
        setAllMemories(data.items);
      } else {
        console.error('Memory API did not return a recognized format:', typeof data, data);
        setAllMemories([]);
      }
    } catch (error) {
      console.error("Error fetching all memories:", error);
      setAllMemories([]);
    } finally {
      setIsLoadingMemories(false);
    }
  };

  // Add an automatic fetch when the app loads
  useEffect(() => {
    // Initial fetch of memories when the app loads
    fetchAllMemories();
  }, []);

  // Fetch scheduled tasks
  const fetchScheduledTasks = async (retryAttempt = 0, maxRetries = 5): Promise<void> => {
    setIsLoadingTasks(true);
    try {
      console.log(`Fetching scheduled tasks from API... (attempt ${retryAttempt + 1}/${maxRetries + 1})`);
      
      // Add timeout to prevent long-running requests
      const controller = new AbortController();
      // Increase timeout on each retry - increase base timeout to 15s
      const timeoutMs = 15000 + (retryAttempt * 10000); // 15s, 25s, 35s, 45s, 55s, 65s
      let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
        console.log(`Fetch timeout reached after ${timeoutMs}ms`);
        controller.abort();
      }, timeoutMs);
      
      // Function to clear timeout safely
      const clearTimeoutSafe = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };
      
      try {
        // First make a preflight request to wake up the API if needed
        if (retryAttempt === 0) {
          try {
            const preflight = await fetch('/api/healthcheck', { 
              method: 'HEAD',
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache'
              },
              // Add timeout to preflight request
              signal: AbortSignal.timeout(10000)
            });
            console.log('Preflight check status:', preflight.status);
          } catch (preflightError) {
            console.warn('Preflight check failed, continuing with main request');
          }
        }
        
        // Main request
        const res = await fetch('/api/scheduler-tasks', {
          // Prevent caching
          cache: 'no-store',
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeoutSafe();
        
        if (!res.ok) {
          console.error('Failed to fetch scheduled tasks - response not OK:', res.status, res.statusText);
          throw new Error(`Failed to fetch scheduled tasks: ${res.status} ${res.statusText}`);
        }
        
        // Log the raw response for debugging
        const rawText = await res.text();
        console.log('Raw API response:', rawText.substring(0, 200) + (rawText.length > 200 ? '...' : ''));
        
        // Parse the response as JSON
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          console.error('Error parsing JSON response:', parseError);
          console.error('Raw response was:', rawText.substring(0, 100) + '...');
          throw new Error('Failed to parse response as JSON');
        }
        
        // Log the actual data returned to help debug
        console.log("Scheduler tasks response received");
        console.log("Number of tasks:", Array.isArray(data) ? data.length : 0);
        if (Array.isArray(data) && data.length > 0) {
          console.log("First task sample:", data[0]);
          
          // Set the tasks directly as the API now returns the array format we need
          setScheduledTasks(data);
          
          // Cache successful response in sessionStorage for fallback
          try {
            sessionStorage.setItem('cached_tasks', JSON.stringify(data));
            sessionStorage.setItem('cached_tasks_timestamp', Date.now().toString());
          } catch (storageError) {
            console.warn('Failed to cache tasks in sessionStorage:', storageError);
          }
        } else {
          console.log("No tasks returned or data is not an array:", data);
          
          // Try to retrieve from cache first
          let cachedTasks = null;
          try {
            const cachedData = sessionStorage.getItem('cached_tasks');
            if (cachedData) {
              cachedTasks = JSON.parse(cachedData);
              const timestamp = parseInt(sessionStorage.getItem('cached_tasks_timestamp') || '0');
              const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
              console.log(`Using cached tasks from ${Math.round(ageInMinutes)} minutes ago`);
              
              if (Array.isArray(cachedTasks) && cachedTasks.length > 0) {
                setScheduledTasks(cachedTasks);
                return;
              }
            }
          } catch (cacheError) {
            console.warn('Failed to retrieve cached tasks:', cacheError);
          }
          
          // Fall back to default tasks if no cached data
          console.log("Using fallback tasks");
          setScheduledTasks([
            {
              id: TASK_IDS.MARKET_SCAN,
              name: 'Market Scanner',
              description: 'Scan for market trends, news, and insights',
              cronExpression: '0 7,15 * * *',
              enabled: true,
              lastRun: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
              nextRun: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString()
            },
            {
              id: TASK_IDS.DAILY_PLANNING,
              name: 'Daily Planning',
              description: 'Create a daily plan for marketing tasks',
              cronExpression: '0 8 * * *',
              enabled: true,
              lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
              nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
            },
            {
              id: TASK_IDS.WEEKLY_MARKETING_REVIEW,
              name: 'Weekly Reflection',
              description: 'Reflect on weekly performance and achievements',
              cronExpression: '0 18 * * 0',
              enabled: true,
              lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
              nextRun: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString()
            }
          ]);
        }
      } catch (fetchError) {
        console.error('Error during fetch operation:', fetchError);
        clearTimeoutSafe();
        
        // Handle AbortController errors
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Fetch request timed out');
          
          // Try again if we haven't exceeded max retries
          if (retryAttempt < maxRetries) {
            console.log(`Retrying fetch (${retryAttempt + 1}/${maxRetries})...`);
            setIsLoadingTasks(false);
            // Add a slight delay before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchScheduledTasks(retryAttempt + 1, maxRetries);
          }
          
          throw new Error('Request timed out after multiple attempts. Please try again later.');
        }
        
        // For other errors, if we haven't exceeded max retries, try again
        if (retryAttempt < maxRetries) {
          console.log(`Retrying fetch after error (${retryAttempt + 1}/${maxRetries})...`);
          setIsLoadingTasks(false);
          // Add a slightly longer delay before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
          return fetchScheduledTasks(retryAttempt + 1, maxRetries);
        }
        
        // Try to get cached tasks if we've exhausted retries
        try {
          const cachedData = sessionStorage.getItem('cached_tasks');
          if (cachedData) {
            const cachedTasks = JSON.parse(cachedData);
            const timestamp = parseInt(sessionStorage.getItem('cached_tasks_timestamp') || '0');
            const ageInMinutes = (Date.now() - timestamp) / (1000 * 60);
            console.log(`Using cached tasks from ${Math.round(ageInMinutes)} minutes ago after fetch failure`);
            
            if (Array.isArray(cachedTasks) && cachedTasks.length > 0) {
              setScheduledTasks(cachedTasks);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('Failed to retrieve cached tasks:', cacheError);
        }
        
        // If we've exhausted retries and have no cache, use fallback data instead of throwing error
        console.log("Using fallback tasks after fetch failure");
        setScheduledTasks([
          {
            id: TASK_IDS.MARKET_SCAN,
            name: 'Market Scanner (Fallback)',
            description: 'Scan for market trends, news, and insights',
            cronExpression: '0 7,15 * * *',
            enabled: true,
            lastRun: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
            nextRun: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString()
          },
          {
            id: TASK_IDS.DAILY_PLANNING,
            name: 'Daily Planning (Fallback)',
            description: 'Create a daily plan for marketing tasks',
            cronExpression: '0 8 * * *',
            enabled: true,
            lastRun: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            nextRun: new Date(Date.now() + 1000 * 60 * 60 * 16).toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error fetching scheduled tasks:', error);
      // Show error state in UI if needed
      setScheduledTasks([
        {
          id: 'error',
          name: 'Error Loading Tasks',
          description: error instanceof Error ? error.message : String(error),
          cronExpression: '* * * * *',
          enabled: false
        }
      ]);
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

  // Modified to use our enhanced image storage
  const saveAttachmentsToLocalStorage = (newMessages: Message[]) => {
    try {
      // Find messages with attachments
      const messagesWithAttachments = newMessages.filter(msg => 
        msg.attachments && msg.attachments.length > 0
      );

      // Also find AI responses to messages with images
      let lastImageMessageTimestamp: string | null = null;
      const allSavedMessages = [...messagesWithAttachments];
      
      // Go through messages in order to match responses to image uploads
      for (let i = 0; i < newMessages.length; i++) {
        const msg = newMessages[i];
        
        // If this is a user message with image attachments, remember its timestamp
        if (msg.sender === 'You' && msg.attachments && msg.attachments.some(att => att.type === 'image')) {
          lastImageMessageTimestamp = msg.timestamp.toISOString();
          console.log(`Found image message with timestamp: ${lastImageMessageTimestamp}`);
        } 
        // If this is an AI response and the previous message had image attachments
        else if (lastImageMessageTimestamp && msg.sender === selectedAgent) {
          // Create a copy of the message and add a reference to the image message
          const visionResponseMsg = {
            ...msg,
            visionResponseFor: lastImageMessageTimestamp
          };
          
          // Make sure we're not adding duplicates
          const isDuplicate = allSavedMessages.some(existing => 
            existing.sender === msg.sender && 
            existing.content === msg.content &&
            existing.visionResponseFor === lastImageMessageTimestamp
          );
          
          if (!isDuplicate) {
            console.log(`Adding vision response for message with timestamp: ${lastImageMessageTimestamp}`);
            allSavedMessages.push(visionResponseMsg);
          }
          
          lastImageMessageTimestamp = null; // Reset after finding a response
        }
      }
      
      if (allSavedMessages.length > 0) {
        // Before saving, ensure all saved messages have proper Date timestamps
        // that will be correctly restored when loaded
        allSavedMessages.forEach(msg => {
          // Create a fresh copy that will serialize properly
          if (msg.timestamp instanceof Date) {
            // Keep the timestamp as an ISO string for storage
            (msg as any).timestampString = msg.timestamp.toISOString();
          }
        });
        
        localStorage.setItem(SAVED_ATTACHMENTS_KEY, JSON.stringify(allSavedMessages));
        console.log(`Saved ${messagesWithAttachments.length} messages with attachments and ${allSavedMessages.length - messagesWithAttachments.length} vision responses to localStorage`);
      }
    } catch (error) {
      console.error('Error saving attachments to local storage:', error);
    }
  };

  // Modified to restore image data from our separate storage and handle vision responses
  const loadAttachmentsFromLocalStorage = async () => {
    try {
      const savedAttachmentsJson = localStorage.getItem(SAVED_ATTACHMENTS_KEY);
      if (savedAttachmentsJson) {
        const savedAttachments = JSON.parse(savedAttachmentsJson);
        console.log(`Found ${Object.keys(savedAttachments).length} saved messages with attachments`);
        
        // Convert to array of Message objects
        const savedMessages: Message[] = Object.values(savedAttachments).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          attachments: msg.attachments ? msg.attachments.map((att: any) => ({
            ...att,
            truncated: !att.preview
          })) : undefined
        }));
        
        // For each message with image attachments, restore the full image data
        for (const msg of savedMessages) {
          if (msg.attachments) {
            for (const att of msg.attachments) {
              if (att.type === 'image' && att.fileId && (!att.preview || att.preview === '')) {
                try {
                  // Try to get the full image data from storage
                  const fullImageData = await getImageDataFromStorage(att.fileId);
                  if (fullImageData) {
                    console.log(`Restored full image data for ${att.fileId}`);
                    att.preview = fullImageData;
                  } else {
                    console.log(`Could not restore image data for ${att.fileId}`);
                  }
                } catch (error) {
                  console.error(`Error restoring image ${att.fileId}:`, error);
                }
              }
            }
          }
        }
        
        return savedMessages;
      }
    } catch (error) {
      console.error('Error loading attachments from local storage:', error);
    }
    return [];
  };

  // Listen for storage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SAVED_ATTACHMENTS_KEY || e.key === IMAGE_DATA_STORAGE_KEY) {
        // Force a reload of the page when storage changes in another tab
        window.location.reload();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load initial chat history from the server
  useEffect(() => {
    // Define the function inside to have access to state
    async function loadInitialChat() {
      setIsLoading(true);
      try {
        console.log("Loading chat history from server...");
        const response = await fetch('/api/chat?userId=gab');
        
        if (!response.ok) {
          throw new Error(`Failed to load chat history: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Received chat history data:", data);
        
        // Load attachments from local storage - now async
        const savedAttachmentMessages = await loadAttachmentsFromLocalStorage();
        console.log(`Loaded ${savedAttachmentMessages.length} messages with attachments from localStorage`);
        
        // Track vision response messages separately
        const visionResponses = savedAttachmentMessages.filter(msg => 
          msg.sender === selectedAgent && 
          msg.attachments === undefined &&
          msg.visionResponseFor !== undefined
        );
        
        if (visionResponses.length > 0) {
          console.log(`Found ${visionResponses.length} vision response messages in localStorage`);
        }
        
        // Create a map of user messages with attachments by timestamp (as string)
        const userAttachmentMap = new Map();
        savedAttachmentMessages.forEach(msg => {
          if (msg.sender === 'You' && msg.attachments && msg.attachments.length > 0) {
            const key = msg.timestamp.toISOString();
            userAttachmentMap.set(key, msg);
          }
        });
        
        // Create a map of vision responses by their reference timestamp
        const visionResponseMap = new Map();
        visionResponses.forEach(msg => {
          if (msg.visionResponseFor) {
            visionResponseMap.set(msg.visionResponseFor, msg);
          }
        });
        
        if (data.history && data.history.length > 0) {
          console.log("Raw history from server:", JSON.stringify(data.history).substring(0, 200) + "...");
          
          // Convert server messages to our client format
          const formattedMessages = data.history.map((msg: any) => {
            return {
              sender: msg.role === 'user' ? 'You' : selectedAgent,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
              memory: msg.memory || [],
              thoughts: msg.thoughts || [],
              attachments: undefined
            };
          });
          
          // Now let's add saved messages with attachments and their responses
          savedAttachmentMessages.forEach(savedMsg => {
            if (savedMsg.sender === 'You' && savedMsg.attachments && savedMsg.attachments.length > 0) {
              // Check if this message is already in our formatted messages (match by timestamp)
              const matchingIndex = formattedMessages.findIndex((m: Message) => 
                m.sender === 'You' && 
                Math.abs(new Date(m.timestamp).getTime() - new Date(savedMsg.timestamp).getTime()) < 5000 &&
                m.content === savedMsg.content
              );
              
              if (matchingIndex >= 0) {
                // Add attachments to the existing message
                formattedMessages[matchingIndex].attachments = savedMsg.attachments;
                console.log(`Added attachments to existing message at index ${matchingIndex}`);
              } else {
                // This is a new message with attachments, add it
                formattedMessages.push(savedMsg);
                console.log(`Added new message with attachments: "${savedMsg.content.substring(0, 20)}..."`);
              }
              
              // Find corresponding vision response
              const visionResponse = visionResponseMap.get(savedMsg.timestamp.toISOString());
              if (visionResponse) {
                // Check if we already have this response
                const hasResponse = formattedMessages.some((m: Message) => 
                  m.sender === selectedAgent && 
                  m.content === visionResponse.content &&
                  Math.abs(new Date(m.timestamp).getTime() - new Date(visionResponse.timestamp).getTime()) < 10000
                );
                
                if (!hasResponse) {
                  // Create proper vision response message with correct reference
                  const responseMsg: Message = {
                    ...visionResponse,
                    // Ensure timestamp is a Date object
                    timestamp: new Date(visionResponse.timestamp),
                    // Store reference to the originating message
                    visionResponseFor: savedMsg.timestamp.toISOString()
                  };
                  
                  // Insert the vision response right after the message with attachment
                  const insertIndex = matchingIndex >= 0 ? matchingIndex + 1 : formattedMessages.length;
                  formattedMessages.splice(insertIndex, 0, responseMsg);
                  console.log(`Added vision response for message at index ${insertIndex}: "${savedMsg.content.substring(0, 20)}..."`);
                }
              }
            }
          });
          
          // Sort messages by timestamp
          formattedMessages.sort((a: Message, b: Message) => {
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          });
          
          console.log(`Setting ${formattedMessages.length} formatted messages`);
          setMessages(formattedMessages);
        } else {
          console.log("No history found, using welcome message");
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

  // Auto-scroll to bottom when messages change or when switching to chat tab
  useEffect(() => {
    if (selectedTab === 'chat') {
      // Use a shorter timeout to make it feel more responsive
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    }
  }, [messages, selectedTab, isLoading]);

  // Ensure scroll to bottom after initial chat is loaded
  useEffect(() => {
    if (!isLoading && messages.length > 0 && selectedTab === 'chat') {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
      }, 100);
    }
  }, [isLoading, messages.length, selectedTab]);

  // Function to handle file viewing from the Files tab
  const handleFileImageClick = async (fileId: string, filename: string) => {
    try {
      // Construct the file view URL
      const fileViewUrl = `/api/files/view/${fileId}`;
      setImageCaption(filename);
      
      // Set the modal image directly to the file URL
      setModalImage(fileViewUrl);
      
      // Open the modal dialog
      setIsImageModalOpen(true);
    } catch (error) {
      console.error('Error loading image:', error);
    }
  };

  // Enhanced to include file attachments and use our improved storage system
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    console.log("Form submitted with:", inputMessage);
    
    if (!inputMessage.trim() && pendingAttachments.length === 0) return;

    // Add user message with file context if attachments exist
    const messageContent = pendingAttachments.length > 0 
      ? inputMessage || "(Attached file without context)"
      : inputMessage;
      
    // Make a local copy of pendingAttachments to avoid race conditions
    const currentAttachments = [...pendingAttachments];
    
    // Use the attachments directly - we've already created thumbnails and stored full images
    const userMessage: Message = {
      sender: 'You',
      content: messageContent,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      messageType: MessageType.USER
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save user message with attachments to local storage
    if (currentAttachments.length > 0) {
      saveAttachmentsToLocalStorage(updatedMessages);
    }
    
    // Scroll to bottom immediately after adding user message
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
    
    // Store and clear input
    const sentMessage = inputMessage;
    setInputMessage('');
    
    // Clear pending attachments early to avoid race conditions
    setPendingAttachments([]);
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Prepare form data if we have attachments
      let response;
      let data;
      
      if (currentAttachments.length > 0) {
        const formData = new FormData();
        formData.append('message', sentMessage); // Send user's context about the file
        formData.append('userId', 'gab');
        
        // Log the context being sent with files
        console.log("Sending files with context:", sentMessage);
        
        // Add each file to the formData with proper metadata
        for (let index = 0; index < currentAttachments.length; index++) {
          const attachment = currentAttachments[index];
          
          // Only add the file if it exists
          if (attachment.file) {
            // Add the actual file
            formData.append(`file_${index}`, attachment.file);
            
            // Add metadata as regular string values (not files)
            formData.append(`metadata_${index}_type`, attachment.type);
            formData.append(`metadata_${index}_fileId`, attachment.fileId || '');
            
            // Don't send the full preview data URLs to the server - they're too large
            // The server doesn't need them, and we already store them in IndexedDB
            console.log(`Adding file ${index}: ${attachment.filename || attachment.file.name}`);
          } else {
            console.warn(`Warning: Attachment ${index} has no file property`);
          }
        }
        
        // Send to server with multipart/form-data
        response = await fetch('/api/chat-with-files', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Standard JSON request without files
        const requestBody: any = {
          message: sentMessage,
          userId: 'gab',
        };
        
        // Check the previous message to see if this is a reply to a message with images
        // Find the most recent message before this one that has image attachments
        const previousImageMessage = messages.slice().reverse().find(msg => 
          msg.sender === 'You' && 
          msg.attachments && 
          msg.attachments.some(att => att.type === 'image')
        );
        
        if (previousImageMessage && previousImageMessage.timestamp) {
          // If the previous message was recent (within last 2 messages), consider this a vision response
          const messageIndex = messages.findIndex(m => 
            m.timestamp && m.timestamp.getTime() === previousImageMessage.timestamp.getTime()
          );
          
          if (messageIndex >= messages.length - 3) {
            requestBody.visionResponseFor = previousImageMessage.timestamp.toISOString();
            console.log(`Including visionResponseFor in request: ${requestBody.visionResponseFor}`);
          }
        }
        
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Process the response and add the assistant message
      data = await response.json();
      
      // Check if this is a vision response (has containsImageRequest flag)
      const isVisionResponse = data.containsImageRequest === true;
      console.log(`Received ${isVisionResponse ? 'vision' : 'standard'} response from API`);
      
      // Make sure data properties exist and are in the correct format
      // First check if we have data.reply or data.response.reply
      const replyText = data.reply || (data.response ? data.response.reply : "I couldn't generate a response.");
      
      // Handle memory context - could be in different places based on API endpoint
      const messageMemory = data.memory 
        ? (Array.isArray(data.memory) ? data.memory : [data.memory]) 
        : data.response && data.response.memory 
          ? (Array.isArray(data.response.memory) ? data.response.memory : [data.response.memory])
          : [];
      
      // Handle thoughts - could be in different places based on API endpoint  
      const messageThoughts = data.thoughts 
        ? (Array.isArray(data.thoughts) ? data.thoughts : [data.thoughts]) 
        : data.response && data.response.thoughts
          ? (Array.isArray(data.response.thoughts) ? data.response.thoughts : [data.response.thoughts])
          : [];
      
      // For vision responses, add a reference to the original image message timestamp
      // but DON'T include the attachments in the AI response
      const agentResponse: Message = {
        sender: selectedAgent,
        content: replyText,
        timestamp: new Date(),
        memory: messageMemory,
        thoughts: messageThoughts,
        visionResponseFor: isVisionResponse 
          ? (data.requestTimestamp || userMessage.timestamp.toISOString()) 
          : undefined,
        messageType: MessageType.AGENT
      };
      
      // Log memory and thoughts for debugging
      if (data.memory && data.memory.length > 0) {
        console.log('Memory context used:', data.memory);
      }
      
      if (data.thoughts && data.thoughts.length > 0) {
        console.log('Agent thoughts:', data.thoughts);
      }
      
      // Combine previous messages with the new response
      const messagesWithResponse = [...updatedMessages, agentResponse];

      // Create separate thought messages for dev mode viewing
      const allMessages = [...messagesWithResponse];
      if (data.thoughts && data.thoughts.length > 0) {
        data.thoughts.forEach((thought: string) => {
          allMessages.push({
            sender: selectedAgent,
            content: thought,
            timestamp: new Date(),
            messageType: MessageType.THOUGHT,
            isInternalMessage: true
          });
        });
      }

      // Update state with all messages
      setMessages(allMessages);

      // Save to localStorage if there were attachments or if this was a vision response
      if (currentAttachments.length > 0 || isVisionResponse) {
        console.log("Saving messages with attachments to localStorage, including vision API response");
        saveAttachmentsToLocalStorage(messagesWithResponse);
      }
    } catch (error) {
      console.error("Error calling API:", error);
      
      // Show error message but make it look normal like an agent response
      const errorResponse: Message = {
        sender: selectedAgent,
        content: "I apologize, but I'm having trouble responding right now. Please try asking again or try a different question.",
        timestamp: new Date(),
        messageType: MessageType.AGENT
      };
      
      const errorMessages = [...updatedMessages, errorResponse];
      setMessages(errorMessages);
      
      // Save error messages to local storage if there are attachments
      if (currentAttachments.length > 0) {
        saveAttachmentsToLocalStorage(errorMessages);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add this mapping function just before the return statement
  const handleImageClick = async (attachment: FileAttachment, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Try to get the full-sized image from storage
      const fullImage = await getImageDataFromStorage(attachment.fileId || '');
      
      if (fullImage) {
        setModalImage(fullImage);
        setImageCaption(attachment.filename || '');
        setIsImageModalOpen(true);
        return;
      }
      
      // Fall back to preview if full image not found
      setModalImage(attachment.preview);
      setImageCaption(attachment.filename || '');
      setIsImageModalOpen(true);
    } catch (error) {
      console.error("Error retrieving full image:", error);
      // Fall back to the preview
      setModalImage(attachment.preview);
      setImageCaption(attachment.filename || '');
      setIsImageModalOpen(true);
    }
  };

  // Save image data separately from chat messages - LEGACY FUNCTION
  // This is kept for backward compatibility, but now uses IndexedDB
  const saveImageDataToStorage = (id: string, data: string) => {
    console.warn('saveImageDataToStorage is deprecated, using IndexedDB instead');
    // Save to IndexedDB instead
    saveFileToIndexedDB({
      id: id,
      data: data,
      type: 'image/png', // Default type if not known
      filename: `image_${id}.png`,
      timestamp: Date.now()
    }).catch(err => console.error('Error saving to IndexedDB:', err));
    return true; // Return true to maintain backward compatibility
  };

  // Image modal component
  const ImageModal = ({ isOpen, imageUrl, onClose, caption }: { isOpen: boolean; imageUrl: string | null; onClose: () => void; caption?: string }) => {
    if (!isOpen || !imageUrl) return null;

    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
        onClick={onClose}
      >
        <div 
          className="relative flex flex-col items-center max-w-[90vw] max-h-[85vh]"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking on the modal content
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-10 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div className="overflow-auto max-w-[90vw] max-h-[85vh]">
            <img 
              src={imageUrl} 
              alt={caption || "Full size image"} 
              className="object-contain max-w-[90vw] max-h-[85vh]"
              style={{
                objectFit: 'contain',
                width: 'auto',
                height: 'auto'
              }}
            />
          </div>
          
          {caption && (
            <div className="mt-2 px-4 py-2 bg-black bg-opacity-70 text-white rounded text-center max-w-full">
              {caption}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Add keyboard shortcut handler inside the component, near other useEffect hooks
  useEffect(() => {
    // Keyboard shortcuts for dev tools
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only in development environment
      if (process.env.NODE_ENV !== 'development') {
        return;
      }
      
      // Alt+D: Debug message types
      if (e.altKey && e.key === 'd') {
        analyzeMessageTypes(messages);
        e.preventDefault();
      }
      
      // Alt+E: Export messages for debugging
      if (e.altKey && e.key === 'e') {
        exportDebugMessages(messages);
        e.preventDefault();
      }
      
      // Alt+T: Toggle internal message display
      if (e.altKey && e.key === 't') {
        const newValue = !showInternalMessages;
        console.log(`Alt+T pressed: Toggling dev mode to ${newValue}`);
        setShowInternalMessages(newValue);
        toggleMessageDebugging(newValue);
        e.preventDefault();
        
        // Force reload if turning dev mode off to ensure clean state
        if (!newValue) {
          console.log('Reloading to clear internal messages...');
          setTimeout(() => window.location.reload(), 100);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [messages, showInternalMessages]);

  // Search messages
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedMessageId(''); // Reset selected message when performing a new search
  };
  
  // Jump to a specific message
  const jumpToMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    // Clear search when jumping to a message
    if (searchQuery) setSearchQuery('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Image Modal */}
      <ImageModal isOpen={isImageModalOpen} imageUrl={modalImage} onClose={() => setIsImageModalOpen(false)} caption={imageCaption} />

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
            {/* Chat header with tabs, fullscreen toggle, and search */}
            <TabsNavigation
              selectedTab={selectedTab}
              setSelectedTab={setSelectedTab}
              isFullscreen={isFullscreen}
              toggleFullscreen={toggleFullscreen}
              onSearch={handleSearch}
            />

            {/* Main chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedTab === 'chat' && (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex-1 h-full">
                    {/* Use the new ChatMessages component */}
                    {messages.length > 0 && (
                      <ChatMessages 
                        messages={messages} 
                        isLoading={isLoading}
                        onImageClick={handleImageClick}
                        showInternalMessages={showInternalMessages}
                        pageSize={20}
                        preloadCount={10}
                        searchQuery={searchQuery}
                        initialMessageId={selectedMessageId}
                      />
                    )}
                    
                    {/* Scroll anchor div - always place at the end of messages */}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                </div>
              )}
              
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
                  onRefresh={fetchAllMemories}
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
              
              {selectedTab === 'files' && (
                <FilesTable 
                  onRefresh={fetchAllMemories} 
                  onImageClick={handleFileImageClick}
                />
              )}
              
              {selectedTab === 'knowledge' && <KnowledgeTab />}
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
            </div>
          </div>
        </div>
      </div>

      {/* Add DevModeToggle component */}
      <DevModeToggle 
        showInternalMessages={showInternalMessages}
        setShowInternalMessages={setShowInternalMessages}
      />
    </div>
  );
} 
