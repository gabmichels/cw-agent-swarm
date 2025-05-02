// Import MessageType enum
import { MessageType } from './constants/message';

// Define message type for better type safety
export interface Message {
  id?: string; // Unique identifier for the message
  sender: string;
  content: string;
  timestamp: Date;
  memory?: MemoryItem[];
  thoughts?: string[];
  attachments?: FileAttachment[];
  visionResponseFor?: string; // Timestamp string of the message this is a vision response for
  messageType?: MessageType; // Type of message for proper routing
  isInternalMessage?: boolean; // Flag to indicate if message should be shown in chat UI
  metadata?: Record<string, any>; // Additional message metadata
}

// Define interface for file attachment
export interface FileAttachment {
  file: File;
  type: 'image' | 'pdf' | 'document' | 'text' | 'other';
  preview: string;
  filename?: string;
  fileId?: string;
  size?: number;
  mimeType?: string;
  truncated?: boolean;
  originalPreviewSize?: number;
}

// Define interface for memory item
export interface MemoryItem {
  id?: string;
  timestamp?: string;
  created?: string;
  content?: string;
  category?: string;
  importance?: number;
  tags?: string[];
}

// Define interfaces for Task and ScheduledTask
export interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  date?: string;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// Define interface for social media data
export interface SocialMediaItem {
  id: string;
  text: string;
  timestamp: string;
  source: string;
  topic: string;
  author: string;
  url: string | null;
  engagement: Record<string, any>;
  sentiment: string | null;
} 