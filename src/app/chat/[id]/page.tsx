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
import { Message as DisplayMessage, FileAttachment as UIFileAttachment } from '@/types';
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

interface MessageWithId extends Omit<DisplayMessage, 'sender'> {
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
  const agentId = (routeParams && typeof routeParams.id === 'string' ? routeParams.id : params?.id) || 'default';
  
  const [chat, setChat] = useState<Chat | null>(null);
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

  // Fetch or create chat, then load messages
  useEffect(() => {
    const fetchOrCreateChat = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // 1. Try to get chat between user and agent
        let chatRes = await fetch(`/api/multi-agent/chats?userId=${userId}&agentId=${agentId}`);
        let chatData = await chatRes.json();
        let chatObj: Chat | null = null;
        if (chatRes.ok && chatData.chats && chatData.chats.length > 0) {
          chatObj = chatData.chats[0];
        } else {
          // 2. If not found, fetch agent profile for chat creation fields
          let agentProfile: {
            name?: string;
            description?: string;
            metadata?: {
              tags?: string[];
              domain?: string[];
            }
          } | null = null;
          try {
            const agentRes = await fetch(`/api/multi-agent/agents/${agentId}`);
            const agentJson = await agentRes.json();
            if (!agentRes.ok || !agentJson.success || !agentJson.agent) {
              setError('Agent not found. Please select a valid agent.');
              setIsLoading(false);
              return;
            }
            agentProfile = agentJson.agent;
          } catch {
            setError('Agent not found. Please select a valid agent.');
            setIsLoading(false);
            return;
          }
          // Fallbacks if agentProfile is missing
          const chatName = agentProfile?.name ? `Chat with ${agentProfile.name}` : `Chat with ${agentId}`;
          const chatDescription = agentProfile?.description || 'Direct chat';
          const chatSettings = {
            visibility: 'private',
            allowAnonymousMessages: false,
            enableBranching: false,
            recordTranscript: true
          };
          const chatMetadata = {
            tags: agentProfile?.metadata?.tags || [],
            category: agentProfile?.metadata?.domain || [],
            priority: 'medium',
            sensitivity: 'internal',
            language: ['en'],
            version: '1.0',
            userId,
            agentId
          };
          const createRes = await fetch(`/api/multi-agent/chats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: chatName,
              description: chatDescription,
              settings: chatSettings,
              metadata: chatMetadata
            }),
          });
          const createData = await createRes.json();
          if (createRes.ok && createData.chat) {
            chatObj = createData.chat;
          } else {
            throw new Error(createData.error || 'Failed to create chat');
          }
        }
        setChat(chatObj);
        // 3. Load messages for this chat
        if (chatObj) {
          console.log(`Loading messages for chat: ${chatObj.id}`);
          const msgRes = await fetch(`/api/multi-agent/chats/${chatObj.id}/messages`);
          const msgData = await msgRes.json();
          console.log('Message loading response:', msgData);
          
          if (msgRes.ok && msgData.messages && msgData.messages.length > 0) {
            console.log(`Found ${msgData.messages.length} messages to display`);
            // Format messages to match expected structure
            const formattedMessages: MessageWithId[] = msgData.messages.map((msg: {
              id: string;
              content: string;
              sender: MessageSender;
              timestamp: string;
              attachments?: UIFileAttachment[];
              tags?: string[];
              metadata?: MessageMetadata;
            }) => ({
              id: msg.id,
              content: msg.content,
              sender: msg.sender,
              timestamp: new Date(msg.timestamp),
              attachments: msg.attachments || [],
              tags: msg.tags || []
            }));
            console.log('Formatted messages:', formattedMessages);
            setMessages(formattedMessages);
          } else {
            console.log('No existing messages found, creating welcome message');
            // 4. If no messages, create dummy welcome message
            // Always try to use the agent's name for the welcome message
            let agentName = '';
            try {
              const agentRes = await fetch(`/api/multi-agent/agents/${agentId}`);
              const agentJson = await agentRes.json();
              if (agentRes.ok && agentJson.success && agentJson.agent) {
                agentName = agentJson.agent.name;
              }
            } catch {}
            if (!agentName) {
              agentName = agentId;
            }
            setMessages([
              {
                id: generateMessageId(),
                content: `Hi, I am ${agentName}. How can I assist you?`,
                sender: { id: agentId, name: agentName, role: 'assistant' },
                timestamp: new Date(),
                attachments: [],
                tags: []
              },
            ]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };
    if (agentId) fetchOrCreateChat();
  }, [agentId]);

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

  // Update handleSendMessage to convert attachments
  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chat?.id || (!inputMessage.trim() && pendingAttachments.length === 0)) return;

    try {
      // Create message object for UI update
      const messageWithId: MessageWithId = {
        id: generateMessageId(),
        content: inputMessage.trim(),
        sender: {
          id: userId,
          name: 'You',
          role: 'user' as const
        },
        timestamp: new Date(),
        attachments: pendingAttachments,
        tags: [] // Initialize empty tags array that will be populated by backend
      };

      // Update UI immediately
      setMessages(prev => [...prev, messageWithId]);
      setInputMessage('');
      setPendingAttachments([]);
      
      // Set loading state to show "thinking..." bubble
      setIsLoading(true);

      // Different handling for messages with vs. without attachments
      let response;
      if (pendingAttachments.length > 0) {
        // Handle file attachments via multi-part form
        const formData = new FormData();
        formData.append('message', inputMessage.trim());
        formData.append('userId', userId);
        formData.append('agentId', agentId);
        formData.append('thinking', 'true'); // Enable thinking mode

        // Add each attachment to the form
        pendingAttachments.forEach((attachment, index) => {
          if (attachment.file) {
            formData.append(`file_${index}`, attachment.file);
            formData.append(`metadata_${index}_type`, attachment.type);
            formData.append(`metadata_${index}_fileId`, attachment.fileId || '');
          }
        });

        response = await fetch(`/api/multi-agent/chats/${chat.id}/files`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Normal message without attachments
        response = await fetch(`/api/multi-agent/chats/${chat.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: inputMessage.trim(),
            senderId: userId,
            senderType: ParticipantType.USER,
            type: MessageType.TEXT,
            metadata: {
              userId,
              agentId,
              thinking: true // Enable thinking mode
            }
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      // If there's an agent response, add it
      if (data.message) {
        // If there are thoughts, add them as separate messages with system role
        if (data.message.metadata?.thoughts && Array.isArray(data.message.metadata.thoughts)) {
          // Only show thoughts in debug mode
          if (isDebugMode) {
            data.message.metadata.thoughts.forEach((thought: string) => {
              setMessages(prev => [...prev, {
                id: generateMessageId(),
                content: thought,
                sender: {
                  id: 'system',
                  name: 'System (Thinking)',
                  role: 'system' as const
                },
                timestamp: new Date(),
                attachments: [],
                tags: []
              }]);
            });
          }
        }

        // Add the actual agent response
        const agentResponse: MessageWithId = {
          id: data.message.id,
          content: data.message.content,
          sender: {
            id: agentId,
            name: data.message.metadata?.agentName || 'Assistant',
            role: 'assistant' as const
          },
          timestamp: new Date(data.message.timestamp || Date.now()),
          attachments: data.message.attachments?.map(convertMessageToUIAttachment) || [],
          tags: data.message.metadata?.tags || []
        };

        setMessages(prev => [...prev, agentResponse]);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: generateMessageId(),
        content: "Failed to send message. Please try again.",
        sender: {
          id: 'system',
          name: 'System',
          role: 'system' as const
        },
        timestamp: new Date(),
        attachments: [],
        tags: []
      }]);
    } finally {
      // Always reset loading state
      setIsLoading(false);
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
  const handleFilePreviewClick = (file: UIFileAttachment) => {
    if (file.type === FileAttachmentType.IMAGE) {
      setSelectedImage(file.preview);
      setShowImageModal(true);
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
            setSelectedTab={setSelectedTab}
            isFullscreen={false}
            toggleFullscreen={() => {}}
            onSearch={() => {}}
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
            {selectedTab === 'chat' && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                  {(!agentId || agentId.includes('Soon') || messages.length === 0) ? (
                    <WelcomeScreen />
                  ) : (
                    <>
                      {process.env.NODE_ENV !== 'production' && messages.length > 0 && (
                        <div className="text-xs text-gray-500 mb-2 p-2 border border-gray-700 rounded">
                          Passing {messages.length} messages to ChatMessages component
                          {chat?.id && <div>Chat ID: {chat.id}</div>}
                        </div>
                      )}
                      
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
                          return { 
                            ...msg, 
                            sender,
                            tags: msg.tags || [] // Ensure tags are included
                          };
                        })} 
                        isLoading={isLoading}
                        onImageClick={() => {}}
                        showInternalMessages={showInternalMessages}
                        pageSize={20}
                        preloadCount={10}
                        searchQuery={''}
                        initialMessageId={''}
                      />
                    </>
                  )}
                  
                  <div ref={messagesEndRef} className="h-8" />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-700 p-4 relative z-10 bg-gray-800">
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