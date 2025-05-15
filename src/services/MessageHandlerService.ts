import { Message, FileAttachment, MemoryItem } from '../types';
import { MessageType } from '../constants/message';
import { FileAttachmentType } from '../constants/file';

/**
 * MessageHandlerService
 * Handles sending messages and file attachments to the multi-agent API
 */
export class MessageHandlerService {
  private static instance: MessageHandlerService;
  private readonly IMAGE_DATA_STORAGE_KEY = 'crowd-wisdom-image-data';
  private readonly SAVED_ATTACHMENTS_KEY = 'crowd-wisdom-saved-attachments';

  private constructor() {}

  public static getInstance(): MessageHandlerService {
    if (!MessageHandlerService.instance) {
      MessageHandlerService.instance = new MessageHandlerService();
    }
    return MessageHandlerService.instance;
  }

  /**
   * Send a message to the multi-agent system
   * With support for file attachments
   */
  public async handleSendMessage(
    inputMessage: string,
    pendingAttachments: FileAttachment[],
    messages: Message[],
    userId: string,
    agentId: string,
    setMessages: (messages: Message[]) => void,
    setIsLoading: (loading: boolean) => void,
    setInputMessage: (message: string) => void,
    setPendingAttachments: (attachments: FileAttachment[]) => void,
    chatId?: string
  ): Promise<void> {
    if (!inputMessage.trim() && pendingAttachments.length === 0) return;

    // Add user message with file context if attachments exist
    const messageContent = pendingAttachments.length > 0 
      ? inputMessage || "(Attached file without context)"
      : inputMessage;
      
    // Make a local copy of pendingAttachments to avoid race conditions
    const currentAttachments = [...pendingAttachments];
    
    // Create user message
    const userMessage: Message = {
      sender: 'You',
      content: messageContent,
      timestamp: new Date(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      messageType: MessageType.USER
    };
    
    // Update UI immediately with user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Clear input and attachments early
    setInputMessage('');
    setPendingAttachments([]);
    
    // Set loading state
    setIsLoading(true);
    
    try {
      if (!chatId) {
        throw new Error('Chat ID is required');
      }

      let response;
      let data;

      // Different handling for messages with vs. without attachments
      if (currentAttachments.length > 0) {
        // Handle file attachments via multi-part form
        const formData = new FormData();
        formData.append('message', messageContent);
        formData.append('userId', userId);
        formData.append('agentId', agentId);
        formData.append('chatId', chatId);

        // Add each attachment to the form
        currentAttachments.forEach((attachment, index) => {
          if (attachment.file) {
            formData.append(`file_${index}`, attachment.file);
            formData.append(`metadata_${index}_type`, attachment.type);
            formData.append(`metadata_${index}_fileId`, attachment.fileId || '');
          }
        });

        // Call multi-agent files endpoint directly instead of compatibility endpoint
        response = await fetch(`/api/multi-agent/chats/${chatId}/files`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Normal message without attachments
        response = await fetch(`/api/multi-agent/chats/${chatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: messageContent,
            metadata: {
              userId,
              agentId
            }
          })
        });
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      data = await response.json();
      
      if (!data.success || !data.message) {
        throw new Error('Invalid response format from server');
      }

      // Create agent response from multi-agent data
      const agentResponse: Message = {
        sender: data.message.metadata?.agentName || 'Assistant',
        content: data.message.content,
        timestamp: new Date(data.message.timestamp || Date.now()),
        messageType: MessageType.AGENT,
        metadata: data.message.metadata
      };

      // If there are thoughts in metadata, add them
      const thoughts = data.message.metadata?.thoughts || [];
      
      // Add thought messages if available
      const allMessages = [...updatedMessages, agentResponse];
      thoughts.forEach((thought: string) => {
        allMessages.push({
          sender: agentResponse.sender,
          content: thought,
          timestamp: new Date(),
          messageType: MessageType.THOUGHT,
          isInternalMessage: true
        });
      });

      // Update messages state
      setMessages(allMessages);
    } catch (error) {
      console.error("Error calling API:", error);
      
      // Show error message
      const errorResponse: Message = {
        sender: 'System',
        content: "I apologize, but I'm having trouble responding right now. Please try again.",
        timestamp: new Date(),
        messageType: MessageType.SYSTEM
      };
      
      setMessages([...updatedMessages, errorResponse]);
    } finally {
      // Clear loading state
      setIsLoading(false);
    }
  }

  /**
   * Handle file attachment selection
   * Processes files for preview and storage
   */
  public async handleFileSelect(
    file: File,
    setPendingAttachments: (attachments: FileAttachment[] | ((prev: FileAttachment[]) => FileAttachment[])) => void,
    inputRef: React.RefObject<HTMLTextAreaElement>
  ): Promise<void> {
    try {
      let fileType: FileAttachment['type'] = FileAttachmentType.OTHER;
      let preview = '';
      
      if (file.type.startsWith('image/')) {
        fileType = FileAttachmentType.IMAGE;
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        preview = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await this.saveFileToIndexedDB({
          id: imageId,
          data: preview,
          type: file.type,
          filename: file.name,
          timestamp: Date.now()
        });

        const thumbnail = await this.createThumbnail(preview);
        
        const newAttachment: FileAttachment = {
          file,
          preview: thumbnail,
          type: fileType,
          filename: file.name,
          fileId: imageId
        };
        setPendingAttachments((prevAttachments: FileAttachment[]) => [...prevAttachments, newAttachment]);
      } else {
        // Handle other file types similarly to the original implementation
        const newAttachment: FileAttachment = {
          file,
          preview: '',
          type: fileType
        };
        setPendingAttachments((prevAttachments: FileAttachment[]) => [...prevAttachments, newAttachment]);
      }

      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Error processing file:', error);
      throw new Error('Failed to process file for preview');
    }
  }

  private async saveFileToIndexedDB(fileData: { 
    id: string; 
    data: string; 
    type: string; 
    filename: string; 
    timestamp: number; 
  }): Promise<string> {
    const request = indexedDB.open('crowd-wisdom-storage', 1);
    
    return new Promise((resolve, reject) => {
      request.onerror = () => reject("Failed to open IndexedDB");
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('file-attachments')) {
          db.createObjectStore('file-attachments', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['file-attachments'], 'readwrite');
        const store = transaction.objectStore('file-attachments');
        
        const storeRequest = store.put(fileData);
        
        storeRequest.onsuccess = () => resolve(fileData.id);
        storeRequest.onerror = () => reject("Failed to save file");
      };
    });
  }

  private async createThumbnail(dataUrl: string, maxDimension = 100): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
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
    });
  }
}

export default MessageHandlerService; 