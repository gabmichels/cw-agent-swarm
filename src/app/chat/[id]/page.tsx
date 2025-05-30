'use client';

import React, { useEffect, useState, useRef, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import TabsNavigation from '@/components/TabsNavigation';
import ChatInput from '@/components/ChatInput';
import ChatMessages from '@/components/ChatMessages';
import DevModeToggle from '@/components/DevModeToggle';
import { Message as ChatMessage, MessageType, MessageRole, MessageStatus, MessageAttachment } from '@/lib/multi-agent/types/message';
import { ParticipantType } from '@/lib/multi-agent/types/chat';
import { FileMetadata, FileAttachmentType as StorageFileType, FileProcessingStatus, FileAttachment as StorageFileAttachment } from '@/types/files';
import { Message as HandlerMessage, MessageType as HandlerMessageType, MessageStatus as HandlerMessageStatus, MessageHandlerOptions } from '@/services/message/MessageHandlerService';
import { Message as DisplayMessage } from '@/types';
import { FileAttachmentType } from '@/constants/file';
import { getCurrentUser } from '@/lib/user';
import { FileUploadImplementation } from '@/services/upload/FileUploadImplementation';
import { IndexedDBFileStorage } from '@/services/storage/IndexedDBFileStorage';
import { MessageHandlerImplementation } from '@/services/message/MessageHandlerImplementation';
import { FilePreview } from '@/components/file/FilePreview';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ErrorMessage } from '@/components/ui/error-message';
import { ImageModal } from '@/components/modals/ImageModal';
import { FileAttachmentHandler, FileHandlerOptions } from '@/services/handlers/FileAttachmentHandler';
import { ClipboardHandler } from '@/services/handlers/ClipboardHandler';
import { DragDropHandler } from '@/services/handlers/DragDropHandler';
import { generateMessageId } from '@/lib/multi-agent/types/message';
import { UploadInfo } from '@/services/upload/FileUploadService';
import { ImportanceLevel } from '@/constants/memory';
import MemoryTab from '@/components/tabs/MemoryTab';
import TasksTab from '@/components/tabs/TasksTab';
import KnowledgeTab from '@/components/tabs/KnowledgeTab';
import ToolsTab from '@/components/tabs/ToolsTab';

// Define message priority enum
enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Define message sensitivity enum
enum MessageSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

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

// Define the FileAttachment interface
interface FileAttachment {
  id: string;
  type: string;
  url: string;
  preview?: string;
  metadata: FileMetadata;
}

// Define UIFileAttachment interface for use in the UI
interface UIFileAttachment {
  file?: File | null; // Make file optional for attachments received from server
  type: FileAttachmentType;
  preview: string;
  filename: string;
  fileId?: string;
  size: number;
  mimeType: string;
}

// Create a MessageSender type that matches what DisplayMessage expects
interface MessageSender {
  id: string;
  name: string;
  role: "user" | "assistant" | "system";
}

// Define message metadata interface for type safety
interface MessageMetadata {
  tags?: string[];
  priority?: string;
  sensitivity?: string;
  language?: string[];
  version?: string;
  userId?: string;
  agentId?: string;
  thinking?: boolean;
  thoughts?: string[];
  agentName?: string;
  [key: string]: any;
}

// Update MessageWithId interface to use our UIFileAttachment
interface MessageWithId extends Omit<DisplayMessage, 'sender' | 'attachments'> {
  id: string;
  sender: MessageSender;
  timestamp: Date;
  attachments?: UIFileAttachment[];
  tags?: string[]; 
  importance?: ImportanceLevel;
  metadata?: MessageMetadata;
}

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

export default function ChatPage({ params }: { params: { id?: string } }) {
  // Use nextjs navigation hook for route params
  const routeParams = useParams();
  // Convert route params to expected type and provide default
  const routeId = (routeParams && typeof routeParams.id === 'string' ? routeParams.id : params?.id) || 'default';
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [agentId, setAgentId] = useState<string>('');
  const [messages, setMessages] = useState<MessageWithId[]>([]);
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
  const [pendingAttachments, setPendingAttachments] = useState<UIFileAttachment[]>([]);

  // Add new state for file handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Initialize services
  const fileStorageService = useRef<IndexedDBFileStorage>();
  const fileUploadService = useRef<FileUploadImplementation>();
  const fileAttachmentHandler = useRef<FileAttachmentHandler>();
  const clipboardHandler = useRef<ClipboardHandler>();
  const dragDropHandler = useRef<DragDropHandler>();
  const messageHandler = useRef<MessageHandlerImplementation>();

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

  // Initialize services on mount
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // Initialize storage and upload services
        fileStorageService.current = new IndexedDBFileStorage();
        await fileStorageService.current.initialize();

        fileUploadService.current = new FileUploadImplementation(fileStorageService.current);
        await fileUploadService.current.initialize();

        // Initialize message handler with storage
        messageHandler.current = new MessageHandlerImplementation(fileStorageService.current);
        await messageHandler.current.initialize({
          enableFileAttachments: true,
          maxFilesPerMessage: 10,
          maxFileSize: 50 * 1024 * 1024,
          allowedFileTypes: ['image/*', 'application/pdf', 'text/*', 'audio/*', 'video/*']
        });

        // Initialize file handlers
        fileAttachmentHandler.current = new FileAttachmentHandler(
          fileUploadService.current,
          fileStorageService.current
        );
        
        clipboardHandler.current = new ClipboardHandler(fileAttachmentHandler.current);
        dragDropHandler.current = new DragDropHandler(fileAttachmentHandler.current);
        
        // Setup event listeners
        clipboardHandler.current.initialize();
        dragDropHandler.current.initialize();
      } catch (error) {
        console.error('Failed to initialize services:', error);
        setError('Failed to initialize services');
      }
    };

    initializeServices();

    // Cleanup
    return () => {
      clipboardHandler.current?.cleanup();
      dragDropHandler.current?.cleanup();
    };
  }, []);

  // Modify the existing useEffect for fetchOrCreateChat
  useEffect(() => {
    const fetchOrCreateChat = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Interpret routeId as a chatId only
        const chatRes = await fetch(`/api/multi-agent/chats?id=${routeId}`);
        const chatData = await chatRes.json();
        
        if (!chatRes.ok || !chatData.success || !chatData.chats || chatData.chats.length === 0) {
          setError('Chat not found. Please select a valid chat from the sidebar.');
          setIsLoading(false);
          return;
        }
        
        // Found chat by ID - extract agentId from chat object
        const chatObj = chatData.chats[0];
        console.log('Chat object from API:', chatObj);
        console.log('Chat object agentId:', chatObj?.metadata?.agentId);
        console.log('Chat object keys:', Object.keys(chatObj || {}));
        
        setChat(chatObj);
        
        if (chatObj && chatObj.metadata && chatObj.metadata.agentId) {
          console.log(`Setting agentId to: ${chatObj.metadata.agentId}`);
          setAgentId(chatObj.metadata.agentId);
        } else {
          console.log('No agentId found in chat object metadata or chat object is null');
          console.log('Chat object:', chatObj);
          console.log('Chat metadata:', chatObj?.metadata);
        }
        
        // Load messages for this chat
        if (chatObj) {
          await fetchMessages(chatObj.id);
        }
        
        // Set loading to false
        setIsLoading(false);
      } catch (error) {
        console.error('Error setting up chat:', error);
        setError('Failed to load chat');
        setIsLoading(false);
      }
    };

    fetchOrCreateChat();
  }, [routeId, userId]);

  // Add polling for message updates instead of using WebSockets
  useEffect(() => {
    // Poll for new messages every 15 seconds
    const pollInterval = 15000;
    let pollingTimer: NodeJS.Timeout | null = null;

    // Only start polling if we have a chat ID and currently on the chat tab
    if (chat?.id && selectedTab === 'chat') {
      // Define polling function
      const pollMessages = async () => {
        try {
          // Only poll if we're not already loading
          if (!isLoading) {
            await fetchMessages(chat.id);
          }
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      };
      
      // Start polling
      pollingTimer = setInterval(pollMessages, pollInterval);
    }

    // Cleanup on unmount or tab change
    return () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
      }
    };
  }, [chat?.id, isLoading, selectedTab]);

  // Convert MessageAttachment to UIFileAttachment
  const convertMessageToUIAttachment = (att: MessageAttachment): UIFileAttachment => {
    return {
      file: new File([new Blob()], att.filename || 'file'),
      type: att.type.startsWith('image/') ? FileAttachmentType.IMAGE : FileAttachmentType.OTHER,
      preview: att.url || '',
      filename: att.filename || '',
      fileId: att.id,
      size: att.size || 0,
      mimeType: att.type
    };
  };

  // Update handleSendMessage to use polling instead of WebSockets
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chat?.id || (!inputMessage.trim() && pendingAttachments.length === 0)) return;

    try {
      // Save current values to avoid race conditions
      const currentMessage = inputMessage.trim();
      const currentAttachments = [...pendingAttachments];
      
      // Create message object for UI update
      const tempMessageId = generateMessageId();
      const messageWithId: MessageWithId = {
        id: tempMessageId,
        content: currentMessage,
        sender: {
          id: userId,
          name: 'You',
          role: 'user' as const
        },
        timestamp: new Date(),
        attachments: currentAttachments,
        tags: []
      };

      // Clear input and attachments immediately for better UX
      setInputMessage('');
      setPendingAttachments([]);
      
      // Optimistically update UI with the user message
      setMessages(prev => [...prev, messageWithId]);
      
      // Set loading state to show "thinking..." bubble
      setIsLoading(true);

      // Different handling for messages with vs. without attachments
      let response;
      if (currentAttachments.length > 0) {
        // Prepare FormData for file attachments
        const formData = new FormData();
        formData.append('message', currentMessage);
        formData.append('userId', userId);
        formData.append('agentId', agentId);
        formData.append('thinking', 'true'); // Enable thinking mode

        // Add each attachment to the form
        currentAttachments.forEach((attachment, index) => {
          if (attachment.file) {
            formData.append(`file_${index}`, attachment.file);
            formData.append(`metadata_${index}_type`, attachment.type);
            formData.append(`metadata_${index}_fileId`, attachment.fileId || '');
          }
        });

        // Log the form data being sent (for debugging)
        console.log('Sending message with attachments', {
          message: currentMessage,
          attachmentsCount: currentAttachments.length,
          chatId: chat.id
        });

        // Send to file upload endpoint
        response = await fetch(`/api/multi-agent/chats/${chat.id}/files`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Send text-only message
        response = await fetch(`/api/multi-agent/chats/${chat.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: currentMessage,
            metadata: {
              userId,
              agentId,
              thinking: true // Enable thinking mode
            }
          })
        });
      }

      if (!response.ok) {
        // Handle error response
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      console.log('Message sent successfully:', data);
      
      // After successful send, refresh messages to get the real message from the server
      // We'll also get the agent's response on the next poll
      await fetchMessages(chat.id);
      
      // Keep polling active to load the agent response
      
    } catch (error) {
      console.error('Error sending message:', error);
      setIsLoading(false);
      // Add error notification to the chat
      setMessages(prev => [
        ...prev, 
        {
          id: generateMessageId(),
          content: 'There was an error sending your message. Please try again.',
          sender: {
            id: 'system',
            name: 'System',
            role: 'system'
          },
          timestamp: new Date(),
          tags: []
        }
      ]);
    }
  };

  // Update handleFileSelect to match the new FileAttachment type
  const handleFileSelect = async (file: File) => {
    try {
      setSelectedFile(file);
      setUploadError(null);
      setUploadProgress(0);

      const options: FileHandlerOptions = {
        onProgress: (progress: number) => setUploadProgress(progress),
        onError: (error: Error) => setUploadError(error.message)
      };

      const attachment = await fileAttachmentHandler.current?.handleFile(file, options);

      if (attachment) {
        const uiAttachment: UIFileAttachment = {
          file,
          type: file.type.startsWith('image/') ? FileAttachmentType.IMAGE : FileAttachmentType.OTHER,
          preview: URL.createObjectURL(file),
          filename: file.name,
          fileId: attachment.id,
          size: file.size,
          mimeType: file.type
        };
        setPendingAttachments(prev => [...prev, uiAttachment]);
      }
    } catch (error) {
      console.error('Error handling file:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setSelectedFile(null);
      setUploadProgress(0);
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

  // Add file preview click handler
  const handleFilePreviewClick = (attachment: any, e: React.MouseEvent) => {
    // Check if the attachment has the properties we need
    if (attachment && attachment.url) {
      setSelectedImage(attachment.url);
      setShowImageModal(true);
    }
  };

  // Modify the formattedAttachments to match exactly what ChatMessages component expects
  const formatAttachmentForDisplay = (att: UIFileAttachment) => {
    return {
      id: att.fileId || '',
      type: att.mimeType,
      url: att.preview,
      preview: att.preview,
      file: new File([new Blob()], att.filename), // Create dummy File object to satisfy type
      metadata: {
        filename: att.filename,
        size: att.size,
        type: att.mimeType,
        attachmentType: att.type === FileAttachmentType.IMAGE ? StorageFileType.IMAGE : StorageFileType.DOCUMENT
      }
    };
  };

  // Function to fetch messages for a chat
  const fetchMessages = async (chatId: string) => {
    try {
      console.log(`Fetching messages for chat: ${chatId}`);
      const msgRes = await fetch(`/api/multi-agent/chats/${chatId}/messages`);
      
      if (!msgRes.ok) {
        const errorText = await msgRes.text();
        console.error(`Failed to fetch messages: ${msgRes.status} ${msgRes.statusText}`, errorText);
        setError(`Failed to load messages: ${msgRes.status}`);
        setIsLoading(false);
        return;
      }
      
      const msgData = await msgRes.json();
      console.log('Raw API response:', msgData);
      
      if (msgData.error) {
        console.error('API returned error:', msgData.error);
        setError(msgData.error);
        setIsLoading(false);
        return;
      }
      
      // Check if we have messages (even if empty array)
      if (msgData.messages && Array.isArray(msgData.messages)) {
        console.log(`Found ${msgData.messages.length} messages to display`);
        
        if (msgData.messages.length === 0) {
          console.log('No messages found for this chat');
          setMessages([]);
          setIsLoading(false);
          return;
        }
        
        // Format messages to match expected structure
        const formattedMessages: MessageWithId[] = msgData.messages.map((msg: {
          id: string;
          content: string;
          sender: MessageSender;
          timestamp: string | number;
          attachments?: any[]; // Use any[] to accommodate different attachment formats
          tags?: string[];
          metadata?: MessageMetadata;
        }) => {
          // Process attachments if they exist
          const processedAttachments: UIFileAttachment[] = [];
          if (msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            // Log attachment data for debugging
            console.log(`Processing ${msg.attachments.length} attachments for message ${msg.id}`);
            
            msg.attachments.forEach((attachment, index) => {
              try {
                // Handle different attachment formats from the API
                if (attachment.type || attachment.mimeType) {
                  // Create a UIFileAttachment object
                  const uiAttachment: UIFileAttachment = {
                    file: null, // We don't have the actual file object on load
                    filename: attachment.filename || `file-${index}`,
                    fileId: attachment.id || attachment.fileId || `attachment-${index}`,
                    size: attachment.size || 0,
                    mimeType: attachment.type || attachment.mimeType || 'application/octet-stream',
                    preview: attachment.url || attachment.preview || '',
                    type: (attachment.type || attachment.mimeType || '').startsWith('image/') 
                      ? FileAttachmentType.IMAGE 
                      : FileAttachmentType.OTHER
                  };
                  
                  processedAttachments.push(uiAttachment);
                  console.log(`Processed attachment: ${uiAttachment.filename}, type: ${uiAttachment.type}`);
                }
              } catch (attachError) {
                console.error(`Error processing attachment ${index}:`, attachError);
              }
            });
          }
          
          // Handle timestamp parsing more robustly
          let parsedTimestamp: Date;
          try {
            if (typeof msg.timestamp === 'number') {
              parsedTimestamp = new Date(msg.timestamp);
            } else if (typeof msg.timestamp === 'string') {
              // Handle both ISO strings and numeric strings
              if (/^\d+$/.test(msg.timestamp)) {
                parsedTimestamp = new Date(parseInt(msg.timestamp, 10));
              } else {
                parsedTimestamp = new Date(msg.timestamp);
              }
            } else {
              parsedTimestamp = new Date(); // Fallback to current time
            }
            
            // Validate the parsed date
            if (isNaN(parsedTimestamp.getTime())) {
              console.warn(`Invalid timestamp for message ${msg.id}:`, msg.timestamp);
              parsedTimestamp = new Date(); // Fallback to current time
            }
          } catch (timestampError) {
            console.error(`Error parsing timestamp for message ${msg.id}:`, timestampError);
            parsedTimestamp = new Date(); // Fallback to current time
          }
          
          return {
            id: msg.id,
            content: msg.content,
            sender: msg.sender,
            timestamp: parsedTimestamp,
            attachments: processedAttachments,
            tags: msg.tags || [],
            metadata: msg.metadata || {}
          };
        });
        
        console.log('Formatted messages with processed attachments:', 
          formattedMessages.map(m => ({
            id: m.id, 
            attachmentsCount: m.attachments?.length || 0,
            timestamp: m.timestamp.toISOString()
          }))
        );
        
        console.log(`Page.tsx: Successfully processed ${formattedMessages.length} messages`);
        
        setMessages(formattedMessages);
        setIsLoading(false);
      } else {
        console.warn('API response missing messages array:', msgData);
        setMessages([]);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
      setIsLoading(false);
    }
  };

  // Add a helper function to convert our UIFileAttachment to the format expected by ChatInput
  const convertToInputFileAttachment = (attachment: UIFileAttachment): any => {
    return {
      file: attachment.file || new File([new Blob()], attachment.filename),
      preview: attachment.preview,
      type: attachment.type === FileAttachmentType.IMAGE ? 'image' : 'other'
    };
  };

  // --- Add state for tasks ---
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);

  // --- Fetch tasks for the selected agent when tab is 'tasks' ---
  useEffect(() => {
    const fetchTasks = async () => {
      if (selectedTab !== 'tasks' || !agentId) return;
      setIsLoadingTasks(true);
      try {
        // Example endpoint, adjust as needed
        const res = await fetch(`/api/tasks?agentId=${agentId}`);
        const data = await res.json();
        if (data && data.tasks) {
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setIsLoadingTasks(false);
      }
    };
    fetchTasks();
  }, [agentId, selectedTab]);

  // --- Task actions ---
  const runTaskNow = async (taskId: string) => {
    await fetch('/api/tasks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, taskId })
    });
    // Optionally refresh tasks
    setIsLoadingTasks(true);
    const res = await fetch(`/api/tasks?agentId=${agentId}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setIsLoadingTasks(false);
  };

  const toggleTaskEnabled = async (taskId: string, enabled: boolean) => {
    await fetch('/api/tasks/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, taskId, enabled })
    });
    setIsLoadingTasks(true);
    const res = await fetch(`/api/tasks?agentId=${agentId}`);
    const data = await res.json();
    setTasks(data.tasks || []);
    setIsLoadingTasks(false);
  };

  const formatCronExpression = (cronExp: string) => cronExp; // TODO: implement pretty formatting

  // Implement tabs content based on selected tab
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'chat':
        console.log('Render condition check:', {
          agentId,
          agentIdIncludesSoon: agentId?.includes('Soon'),
          messagesLength: messages.length,
          shouldShowWelcome: (!agentId || agentId.includes('Soon') || messages.length === 0),
          messagesPreview: messages.slice(0, 2).map(m => ({ id: m.id, content: m.content.substring(0, 50) }))
        });
        
        return (
          <div className="flex flex-col h-full">
            {(!agentId || agentId.includes('Soon') || messages.length === 0) ? (
              <WelcomeScreen />
            ) : (
              <ChatMessages
                messages={messages.map((msg: MessageWithId) => {
                  // Ensure sender is properly formatted as an object with correct properties
                  let sender: MessageSender;
                  if (typeof msg.sender === 'string') {
                    sender = { 
                      id: msg.sender, 
                      name: msg.sender, 
                      role: msg.sender === 'You' ? 'user' : 'assistant' as 'user' | 'assistant' | 'system' 
                    };
                  } else if (msg.sender && typeof msg.sender === 'object') {
                    // Make sure the sender object has all required fields
                    sender = {
                      id: msg.sender.id || '',
                      name: msg.sender.name || '',
                      role: msg.sender.role || 'assistant' as 'user' | 'assistant' | 'system'
                    };
                  } else {
                    // Default sender if missing or invalid
                    sender = { id: 'unknown', name: 'Unknown', role: 'assistant' as 'user' | 'assistant' | 'system' };
                  }
                  
                  // Convert our attachments to the format expected by ChatMessages
                  const formattedAttachments = msg.attachments?.map(att => formatAttachmentForDisplay(att)) || [];
                  
                  return { 
                    ...msg, 
                    sender,
                    tags: msg.tags || [], // Ensure tags are included
                    attachments: formattedAttachments as any[] // Use type assertion to bypass type checking
                  };
                })}
                isLoading={isLoading}
                onImageClick={handleFilePreviewClick}
                showInternalMessages={showInternalMessages}
                pageSize={20}
                preloadCount={10}
                searchQuery={''}
                initialMessageId={''}
              />
            )}
          </div>
        );
      case 'memory':
        return (
          <MemoryTab 
            selectedAgentId={agentId}
            availableAgents={[{id: agentId, name: chat?.name || 'Agent'}]}
            onAgentChange={(id) => console.log('Agent changed to:', id)}
            showAllMemories={false}
            onViewChange={(showAll) => console.log(`View changed to ${showAll ? 'all memories' : 'agent memories'}`)}
            isLoadingMemories={isLoading}
            allMemories={messages.map(msg => {
              return {
                id: msg.id,
                type: 'message',
                content: msg.content,
                text: msg.content,
                timestamp: msg.timestamp.toISOString(),
                created: msg.timestamp.toISOString(),
                thought: msg.metadata?.thinking ? msg.content : undefined,
                message: msg.content,
                payload: {
                  text: msg.content || '',
                  type: 'message',
                  timestamp: msg.timestamp.toISOString(),
                  metadata: {
                    tags: msg.tags || [],
                    context: `Chat: ${chat?.name || 'Unknown'}`,
                    thinking: msg.metadata?.thinking,
                    ...msg.metadata
                  }
                },
                metadata: {
                  tags: msg.tags || [],
                  context: `Chat: ${chat?.name || 'Unknown'}`,
                  thinking: msg.metadata?.thinking,
                  ...msg.metadata
                }
              };
            })}
            onRefresh={async () => {
              if (chat?.id) {
                await fetchMessages(chat.id);
              }
            }}
          />
        );
      case 'tasks':
        return (
          <TasksTab
            isLoadingTasks={isLoadingTasks}
            scheduledTasks={tasks}
            runTaskNow={runTaskNow}
            toggleTaskEnabled={toggleTaskEnabled}
            formatCronExpression={formatCronExpression}
          />
        );
      case 'knowledge':
        return <KnowledgeTab />;
      case 'tools':
        return (
          <ToolsTab
            isLoading={isLoading}
            checkChloe={() => console.log('Check Chloe')}
            runDiagnostics={() => console.log('Run Diagnostics')}
            inspectChloeMemory={() => console.log('Inspect Memory')}
            resetChatHistory={() => console.log('Reset Chat')}
            testChloeAgent={() => console.log('Test Agent')}
            showFixInstructions={() => console.log('Show Instructions')}
            runDirectMarketScan={() => console.log('Market Scan')}
            diagnosticResults={{}}
            chloeCheckResults={{}}
            fixInstructions={{}}
            isDebugMode={false}
          />
        );
      case 'visualizations':
        // Use an iframe to embed the visualizations page with loading state
        return (
          <div className="w-full h-full relative">
            <div className="absolute inset-0 flex items-center justify-center" id="visualization-loading">
              <div className="flex flex-col items-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-600">Loading visualization...</p>
              </div>
            </div>
            <iframe 
              src={`/visualizations?chatId=${chat?.id || ''}&messageId=`}
              className="w-full h-full border-none"
              title="Thinking Process Visualizations"
              sandbox="allow-scripts allow-same-origin allow-popups allow-modals"
              onLoad={() => {
                const loader = document.getElementById('visualization-loading');
                if (loader) {
                  loader.style.display = 'none';
                }
              }}
            />
          </div>
        );
      default:
        return <WelcomeScreen />;
    }
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
            setSelectedTab={(tab) => {
              console.log(`Changing tab to: ${tab}`);
              setSelectedTab(tab);
            }}
            isFullscreen={false}
            toggleFullscreen={() => {}}
            onSearch={() => {}}
            searchResults={[]}
            searchQuery=""
            onSelectResult={(id) => console.log(`Selected result: ${id}`)}
            agentId={agentId}
            agentName={chat?.name || 'Agent'}
            onViewAgent={(id) => {
              window.location.href = `/agents/${id}`;
            }}
            onDeleteChatHistory={async () => {
              const confirmed = window.confirm('Are you sure you want to delete the chat history? This action cannot be undone.');
              if (!confirmed) return false;
              
              try {
                const response = await fetch(`/api/multi-agent/chats/${chat?.id}`, {
                  method: 'DELETE',
                });
                
                if (response.ok) {
                  setMessages([]);
                  return true;
                }
                return false;
              } catch (error) {
                console.error('Error deleting chat history:', error);
                return false;
              }
            }}
          />
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {renderTabContent()}
          </div>
          <div className="border-t border-gray-700 p-4 relative z-10 bg-gray-800">
            <ChatInput
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              pendingAttachments={pendingAttachments.map(convertToInputFileAttachment)}
              removePendingAttachment={removePendingAttachment}
              handleSendMessage={handleSendMessage}
              isLoading={isLoading}
              handleFileSelect={handleFileSelect}
              inputRef={inputRef}
            />
          </div>
          <DevModeToggle showInternalMessages={showInternalMessages} setShowInternalMessages={setShowInternalMessages} />
        </main>
      </div>

      {/* Upload Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
          <ProgressBar progress={uploadProgress} />
        </div>
      )}

      {/* Error Display */}
      {uploadError && (
        <ErrorMessage message={uploadError} />
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <ImageModal
          isOpen={showImageModal}
          imageUrl={selectedImage}
          metadata={pendingAttachments.find(a => a.preview === selectedImage) ? {
            id: pendingAttachments.find(a => a.preview === selectedImage)?.fileId || '',
            filename: pendingAttachments.find(a => a.preview === selectedImage)?.filename || '',
            type: pendingAttachments.find(a => a.preview === selectedImage)?.mimeType || '',
            attachmentType: StorageFileType.IMAGE,
            size: pendingAttachments.find(a => a.preview === selectedImage)?.size || 0,
            timestamp: Date.now(),
            processingStatus: FileProcessingStatus.COMPLETED
          } : {
            id: '',
            filename: selectedFile?.name || '',
            type: selectedFile?.type || '',
            attachmentType: StorageFileType.IMAGE,
            size: selectedFile?.size || 0,
            timestamp: Date.now(),
            processingStatus: FileProcessingStatus.COMPLETED
          }}
          onClose={() => {
            setShowImageModal(false);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
}