'use client';

import ChatInput from '@/components/ChatInput';
import ChatMessages from '@/components/ChatMessages';
import DevModeToggle from '@/components/DevModeToggle';
import Header from '@/components/Header';
import { ImageModal } from '@/components/modals/ImageModal';
import { NotificationToastProvider } from '@/components/notifications/NotificationToastProvider';
import Sidebar from '@/components/Sidebar';
import BookmarksTab from '@/components/tabs/BookmarksTab';
import KnowledgeTab from '@/components/tabs/KnowledgeTab';
import MemoryTab from '@/components/tabs/MemoryTab';
import TasksTab from '@/components/tabs/TasksTab';
import ToolsTab from '@/components/tabs/ToolsTab';
import WorkflowsTab from '@/components/tabs/WorkflowsTab';
import TabsNavigation from '@/components/TabsNavigation';
import { ErrorMessage } from '@/components/ui/error-message';
import { ProgressBar } from '@/components/ui/progress-bar';
import { VisualizationDashboard } from '@/components/visualization/VisualizationDashboard';
import { FileAttachmentType } from '@/constants/file';
import { ImportanceLevel } from '@/constants/memory';
import { useChatSSE } from '@/hooks/useChatSSE';
import { useMultiChannelSSE } from '@/hooks/useMultiChannelSSE';
import { createReplyContextFromMessage } from '@/lib/metadata/reply-context-factory';
import { generateMessageId, MessageAttachment } from '@/lib/multi-agent/types/message';
import { getCurrentUser } from '@/lib/user';
import { ClipboardHandler } from '@/services/handlers/ClipboardHandler';
import { DragDropHandler } from '@/services/handlers/DragDropHandler';
import { FileAttachmentHandler, FileHandlerOptions } from '@/services/handlers/FileAttachmentHandler';
import { MessageHandlerImplementation } from '@/services/message/MessageHandlerImplementation';
import { IndexedDBFileStorage } from '@/services/storage/IndexedDBFileStorage';
import { FileUploadImplementation } from '@/services/upload/FileUploadImplementation';
import { Message as DisplayMessage, Message } from '@/types';
import { createStructuredId, EntityNamespace, EntityType } from '@/types/entity-identifier';
import { FileMetadata, FileProcessingStatus, FileAttachmentType as StorageFileType } from '@/types/files';
import { MessageMetadata } from '@/types/metadata';
import { useParams } from 'next/navigation';
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkflows } from '../../../hooks/useWorkflows';

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

// Extend the standardized MessageMetadata for local chat usage
// Making some fields optional for backward compatibility
interface ChatMessageMetadata extends Omit<Partial<MessageMetadata>, 'priority'> {
  // Legacy fields for backward compatibility
  thinking?: boolean;
  thoughts?: string[];
  agentName?: string;
  priority?: string; // Keep as string for backward compatibility
  sensitivity?: string;
  language?: string[];
  version?: string;
  // Allow any additional fields for flexibility
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
  metadata?: ChatMessageMetadata;
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

// Loading component for initial message fetching
const InitialLoadingScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
      <div className="flex items-center space-x-2 mb-4">
        <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce"></div>
        <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-4 h-4 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <h2 className="text-xl font-semibold mb-2">Loading Messages</h2>
      <p className="text-gray-400">Please wait while we fetch your conversation...</p>
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
  const [isLoading, setIsLoading] = useState<boolean>(false); // For AI response generation
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true); // For initial message fetching
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

  // Add new state for reply functionality
  const [attachedMessage, setAttachedMessage] = useState<MessageWithId | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string>('');
  const [pendingNavigateToMessage, setPendingNavigateToMessage] = useState<string>('');

  // User context - for now using same pattern as home page
  const userId = "test-user";
  const organizationId = undefined; // Can be added later when org context is available

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
      setIsInitialLoading(true);
      setError(null);
      try {
        // Interpret routeId as a chatId only
        const chatRes = await fetch(`/api/multi-agent/chats?id=${routeId}`);
        const chatData = await chatRes.json();
        
        if (!chatRes.ok || !chatData.success || !chatData.chats || chatData.chats.length === 0) {
          setError('Chat not found. Please select a valid chat from the sidebar.');
          setIsInitialLoading(false);
          return;
        }
        
        // Found chat by ID - extract agentId from chat object
        const chatObj = chatData.chats[0];
        
        setChat(chatObj);
        
        if (chatObj && chatObj.metadata && chatObj.metadata.agentId) {
          setAgentId(chatObj.metadata.agentId);
        }
        
        // Load messages for this chat
        if (chatObj) {
          await fetchMessages(chatObj.id);
        }
        
        // Set initial loading to false
        setIsInitialLoading(false);
      } catch (error) {
        console.error('Error setting up chat:', error);
        setError('Failed to load chat');
        setIsInitialLoading(false);
      }
    };

    fetchOrCreateChat();
  }, [routeId, userId]);

  // Use SSE for real-time message updates
  const sseData = useChatSSE(chat?.id || '', {
    userId,
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // Use multi-channel SSE for global notifications
  const notificationSSE = useMultiChannelSSE(userId, {
    enableTaskNotifications: true,
    enableAgentStatusNotifications: true,
    enableSystemNotifications: true,
    enableFileNotifications: true
  });

  // Update messages from SSE when new messages arrive
  useEffect(() => {
    if (sseData.messages.length > 0 && selectedTab === 'chat') {
      // Convert SSE messages to MessageWithId format
      const convertedMessages = sseData.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          role: msg.sender.role
        },
        timestamp: msg.timestamp,
        attachments: [],
        tags: []
      }));
      
      setMessages(prev => {
        // Merge new messages with existing ones, avoiding duplicates
        const existingIds = new Set(prev.map(m => m.id));
        const newMessages = convertedMessages.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMessages];
      });
      
      // Clear loading state when we get new messages
      if (isLoading) {
        setIsLoading(false);
      }
    }
  }, [sseData.messages, selectedTab, isLoading]);

  // Handle pending navigation to message after tab switch and messages load
  useEffect(() => {
    console.log('Navigation useEffect:', {
      pendingNavigateToMessage,
      selectedTab,
      messagesLength: messages.length,
      isLoading,
      isInitialLoading
    });
    
    if (pendingNavigateToMessage && selectedTab === 'chat' && messages.length > 0 && !isLoading && !isInitialLoading) {
      console.log('All conditions met, navigating to message:', pendingNavigateToMessage);
      // Increase delay to ensure ChatMessages component is fully rendered
      setTimeout(() => {
        console.log('Setting highlightedMessageId:', pendingNavigateToMessage);
        setHighlightedMessageId(pendingNavigateToMessage);
        setPendingNavigateToMessage('');
      }, 500); // Increased from 200ms to 500ms
    }
  }, [pendingNavigateToMessage, selectedTab, messages.length, isLoading, isInitialLoading]);

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

  // Update handleSendMessage to include attached message context
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chat?.id || (!inputMessage.trim() && pendingAttachments.length === 0 && !attachedMessage)) return;

    try {
      // Save current values to avoid race conditions
      const currentMessage = inputMessage.trim();
      const currentAttachments = [...pendingAttachments];
      const currentAttachedMessage = attachedMessage;
      
      // Store current message count to detect when agent responds
      const currentMessageCount = messages.length;
      
      // Create message object for UI update
      const tempMessageId = `temp_${generateMessageId()}_${Date.now()}`;
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
      setAttachedMessage(null); // Clear attached message
      setHighlightedMessageId(''); // Clear highlight
      
      // Optimistically update UI with the user message
      setMessages(prev => [...prev, messageWithId]);
      
      // Set loading state to show "thinking..." bubble
      setIsLoading(true);

      // Prepare metadata with reply context
      const baseMetadata: ChatMessageMetadata = {
        userId: createStructuredId(EntityNamespace.USER, EntityType.USER, userId),  // Keep as EntityIdentifier object
        agentId: createStructuredId(EntityNamespace.AGENT, EntityType.AGENT, agentId), // Keep as EntityIdentifier object
        thinking: true // Enable thinking mode
      };

      // Add standardized reply context if we have an attached message
      if (currentAttachedMessage) {
        const replyContext = createReplyContextFromMessage(currentAttachedMessage);
        if (replyContext) {
          baseMetadata.replyTo = replyContext;
          // Note: The referenced message will be prioritized by the memory retrieval system
          // rather than marking this message as high importance
        }
      }

      // Different handling for messages with vs. without attachments
      let response;
      if (currentAttachments.length > 0) {
        // Prepare FormData for file attachments
        const formData = new FormData();
        formData.append('message', currentMessage);
        formData.append('userId', userId);
        formData.append('agentId', agentId);
        formData.append('thinking', 'true'); // Enable thinking mode

        // Add standardized reply context to form data if present
        if (currentAttachedMessage) {
          const replyContext = createReplyContextFromMessage(currentAttachedMessage);
          if (replyContext) {
            formData.append('replyContext', JSON.stringify(replyContext));
          }
        }

        // Add each attachment to the form
        currentAttachments.forEach((attachment, index) => {
          if (attachment.file) {
            formData.append(`file_${index}`, attachment.file);
            formData.append(`metadata_${index}_type`, attachment.type);
            formData.append(`metadata_${index}_fileId`, attachment.fileId || '');
          }
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
            metadata: baseMetadata
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
      
      // Fetch messages immediately to get the real user message from server, but don't clear loading
      // The thinking bubble will stay until polling detects the agent's response
      await fetchMessages(chat.id, false);
      
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

  // Add reply functionality handlers
  const handleReplyToMessage = (message: Message) => {
    // Convert Message to MessageWithId if needed
    const messageWithId: MessageWithId = {
      ...message,
      id: message.id || '', // Ensure id is always a string
      sender: typeof message.sender === 'string' 
        ? { id: message.sender, name: message.sender, role: message.sender === 'You' ? 'user' : 'assistant' as 'user' | 'assistant' | 'system' }
        : message.sender,
      timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
      attachments: message.attachments ? message.attachments.map(att => ({
        file: null,
        type: att.type?.startsWith('image/') ? FileAttachmentType.IMAGE : FileAttachmentType.OTHER,
        preview: att.url || att.preview || '',
        filename: (att as any).filename || 'Unknown file',
        fileId: (att as any).id || '',
        size: (att as any).size || 0,
        mimeType: att.type || 'application/octet-stream'
      })) : undefined,
      tags: (message as any).tags || [],
      importance: (message as any).importance,
      metadata: message.metadata
    };
    
    setAttachedMessage(messageWithId);
  };

  const handleRemoveAttachedMessage = () => {
    setAttachedMessage(null);
    setHighlightedMessageId('');
  };

  const handleNavigateToMessage = (messageId: string) => {
    console.log('handleNavigateToMessage called with:', messageId, 'currentTab:', selectedTab);
    
    if (selectedTab === 'chat') {
      // We're already on chat tab, navigate immediately
      console.log('Already on chat tab, setting highlightedMessageId immediately');
      setHighlightedMessageId(messageId);
    } else {
      // We need to switch tabs first, set pending navigation
      console.log('Switching to chat tab and setting pending navigation');
      setPendingNavigateToMessage(messageId);
      setSelectedTab('chat');
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
  const fetchMessages = async (chatId: string, shouldClearLoading: boolean = true) => {
    try {
      const msgRes = await fetch(`/api/multi-agent/chats/${chatId}/messages`);
      
      if (!msgRes.ok) {
        const errorText = await msgRes.text();
        console.error(`Failed to fetch messages: ${msgRes.status} ${msgRes.statusText}`, errorText);
        setError(`Failed to load messages: ${msgRes.status}`);
        if (shouldClearLoading) {
          setIsLoading(false);
          setIsInitialLoading(false);
        }
        return;
      }
      
      const msgData = await msgRes.json();
      
      if (msgData.error) {
        console.error('API returned error:', msgData.error);
        setError(msgData.error);
        if (shouldClearLoading) {
          setIsLoading(false);
          setIsInitialLoading(false);
        }
        return;
      }
      
      // Check if we have messages (even if empty array)
      if (msgData.messages && Array.isArray(msgData.messages)) {
        if (msgData.messages.length === 0) {
          setMessages([]);
          if (shouldClearLoading) {
            setIsLoading(false);
            setIsInitialLoading(false);
          }
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
        
        // Intelligent message merging: preserve temp messages that aren't on the server yet
        // Temp messages have IDs that start with 'temp_' or are not found in server response
        const tempMessages = messages.filter(msg => 
          msg.id.startsWith('temp_') || msg.id.includes('temp-') || 
          !formattedMessages.find(serverMsg => serverMsg.id === msg.id)
        );
        
        // Only preserve temp messages if we're in loading state (thinking) or if shouldClearLoading is false
        const shouldPreserveTempMessages = isLoading || !shouldClearLoading;
        const messagesToPreserve = shouldPreserveTempMessages ? tempMessages : [];
        
        // Combine server messages with temp messages, sorted by timestamp
        const allMessages = [...formattedMessages, ...messagesToPreserve].sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        
        setMessages(allMessages);
        
        // Clear initial loading state - this is the initial message fetch
        if (shouldClearLoading) {
          setIsInitialLoading(false);
          
          // For polling: only clear AI thinking loading if we detect an agent response
          const hasAgentResponse = formattedMessages.some(msg => 
            msg.sender.role === 'assistant' && 
            !messages.find(existingMsg => existingMsg.id === msg.id)
          );
          
          console.log('fetchMessages debug:', {
            shouldClearLoading,
            isLoading,
            formattedMessagesCount: formattedMessages.length,
            currentMessagesCount: messages.length,
            hasAgentResponse,
            lastFormattedMessage: formattedMessages[formattedMessages.length - 1]?.sender?.role
          });
          
          // Clear AI thinking loading if we have agent response - temp messages are handled separately
          if (hasAgentResponse) {
            console.log('Clearing AI thinking loading state due to agent response');
            setIsLoading(false);
          }
        }
      } else {
        console.warn('API response missing messages array:', msgData);
        setMessages([]);
        if (shouldClearLoading) {
          setIsLoading(false);
          setIsInitialLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
      if (shouldClearLoading) {
        setIsLoading(false);
        setIsInitialLoading(false);
      }
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

  // Memoize the transformed messages to prevent unnecessary re-renders
  const transformedMessages = useMemo(() => {
    return messages.map((msg: MessageWithId) => {
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
    });
  }, [messages]); // Only recalculate when messages actually change

  // Implement tabs content based on selected tab
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'chat':
        return (
          <div className="flex flex-col h-full">
            {isInitialLoading ? (
              <InitialLoadingScreen />
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                <h2 className="text-xl font-semibold mb-2 text-red-400">Error</h2>
                <p className="text-gray-400 mb-4">{error}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : !agentId || agentId.includes('Soon') ? (
              <WelcomeScreen />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                <h2 className="text-xl font-semibold mb-2">No Messages Yet</h2>
                <p className="text-gray-400 mb-8">Start a conversation with your AI assistant below.</p>
              </div>
            ) : (
              <ChatMessages
                messages={transformedMessages}
                isLoading={isLoading}
                isInitialLoading={isInitialLoading}
                onImageClick={memoizedFilePreviewClick}
                onReplyToMessage={memoizedReplyToMessage}
                onNavigateToMessage={memoizedNavigateToMessage}
                highlightedMessageId={highlightedMessageId}
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
            onAgentChange={() => {}}
            showAllMemories={false}
            onViewChange={() => {}}
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
            chatId={chat?.id}
            userId={userId}
          />
        );
      case 'knowledge':
        return <KnowledgeTab />;
      case 'tools':
        return (
          <ToolsTab
            isLoading={isLoading}
            checkChloe={() => {}}
            runDiagnostics={() => {}}
            inspectChloeMemory={() => {}}
            resetChatHistory={() => {}}
            testChloeAgent={() => {}}
            showFixInstructions={() => {}}
            runDirectMarketScan={() => {}}
            diagnosticResults={{}}
            chloeCheckResults={{}}
            fixInstructions={{}}
            isDebugMode={false}
          />
        );
      case 'visualizations':
        // Use the new VisualizationDashboard component for integrated experience
        return (
          <div className="w-full h-full">
            <VisualizationDashboard />
          </div>
        );
      case 'bookmarks':
        return <BookmarksTab onSelectMessage={memoizedNavigateToMessage} />;
      case 'workflows':
        return <WorkflowsTab agentId={agentId} agentName={chat?.name || 'Agent'} />;
      default:
        return <WelcomeScreen />;
    }
  };

  // Optimize setInputMessage with useCallback to prevent ChatInput re-renders
  const optimizedSetInputMessage = useCallback((message: string) => {
    setInputMessage(message);
  }, []);

  // Optimize handleFileSelect with useCallback
  const optimizedHandleFileSelect = useCallback(async (file: File) => {
    await handleFileSelect(file);
  }, []);

  // Optimize removePendingAttachment with useCallback  
  const optimizedRemovePendingAttachment = useCallback((index: number) => {
    removePendingAttachment(index);
  }, []);

  // Optimize handleSendMessage with useCallback
  const optimizedHandleSendMessage = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    await handleSendMessage(e);
  }, [inputMessage, pendingAttachments, attachedMessage, chat?.id, userId, agentId]);

  // Optimize other handlers
  const optimizedHandleRemoveAttachedMessage = useCallback(() => {
    handleRemoveAttachedMessage();
  }, []);

  const optimizedHandleNavigateToMessage = useCallback((messageId: string) => {
    handleNavigateToMessage(messageId);
  }, [selectedTab]);

  // Memoize the file preview click handler to prevent recreation
  const memoizedFilePreviewClick = useCallback((attachment: any, e: React.MouseEvent) => {
    handleFilePreviewClick(attachment, e);
  }, []);

  // Memoize the reply handler to prevent recreation
  const memoizedReplyToMessage = useCallback((message: Message) => {
    handleReplyToMessage(message);
  }, []);

  // Memoize the navigation handler to prevent recreation
  const memoizedNavigateToMessage = useCallback((messageId: string) => {
    handleNavigateToMessage(messageId);
  }, [selectedTab]);

  // Memoize the converted pending attachments to prevent recreation
  const memoizedPendingAttachments = useMemo(() => {
    return pendingAttachments.map(convertToInputFileAttachment);
  }, [pendingAttachments]);

  // Memoize the formatted attached message to prevent recreation
  const memoizedAttachedMessage = useMemo(() => {
    if (!attachedMessage) return null;
    
    return {
      ...attachedMessage,
      attachments: attachedMessage.attachments?.map(att => ({
        id: att.fileId || '',
        type: att.mimeType,
        url: att.preview,
        preview: att.preview,
        metadata: {
          filename: att.filename,
          size: att.size,
          type: att.mimeType,
          attachmentType: att.type,
          timestamp: Date.now(),
          processingStatus: 'completed' as any
        }
      })) || []
    };
  }, [attachedMessage]);

  // Workflow management
  const {
    agentWorkflows,
    availableWorkflows,
    assignWorkflowToAgent
  } = useWorkflows({ agentId, autoFetch: true });

  // Handle workflow selection
  const handleWorkflowSelect = useCallback((workflow: any) => {
    console.log('Workflow selected:', workflow);
    // TODO: Handle workflow execution logic
  }, []);

  // Handle workflow addition
  const handleAddWorkflow = useCallback(async (workflow: any) => {
    try {
      const success = await assignWorkflowToAgent(workflow.id);
      if (success) {
        console.log('Workflow added successfully:', workflow.name);
        // TODO: Show success notification
      }
    } catch (error) {
      console.error('Failed to add workflow:', error);
      // TODO: Show error notification
    }
  }, [assignWorkflowToAgent]);

  // Handle navigate to workflows tab
  const handleNavigateToWorkflowsTab = useCallback(() => {
    setSelectedTab('workflows');
  }, [setSelectedTab]);

  // UI matches main page
  return (
    <NotificationToastProvider
      enableSounds={true}
      enableBrowserNotifications={true}
      maxToasts={5}
    >
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
        userId={userId}
        organizationId={organizationId}
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
            searchResults={[]}
            searchQuery=""
            onSelectResult={() => {}}
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
              setInputMessage={optimizedSetInputMessage}
              pendingAttachments={memoizedPendingAttachments}
              removePendingAttachment={optimizedRemovePendingAttachment}
              handleSendMessage={optimizedHandleSendMessage}
              isLoading={isLoading}
              handleFileSelect={optimizedHandleFileSelect}
              inputRef={inputRef}
              attachedMessage={memoizedAttachedMessage}
              onRemoveAttachedMessage={optimizedHandleRemoveAttachedMessage}
              onNavigateToMessage={optimizedHandleNavigateToMessage}
              availableWorkflows={agentWorkflows}
              availableWorkflowsFromDiscovery={availableWorkflows}
              onWorkflowSelect={handleWorkflowSelect}
              onAddWorkflow={handleAddWorkflow}
              onNavigateToWorkflowsTab={handleNavigateToWorkflowsTab}
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
    </NotificationToastProvider>
  );
}