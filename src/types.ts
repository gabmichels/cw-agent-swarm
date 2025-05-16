// Import MessageType enum
import { MessageType } from './constants/message';
import { FileAttachmentType } from './constants/file';

// Define message type for better type safety
export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  sender: {
    id: string;
    name: string;
    role: 'user' | 'assistant' | 'system';
  };
  metadata?: Record<string, unknown>;
}

// Define interface for file attachment
export interface FileAttachment {
  file: File;
  type: FileAttachmentType;
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

export interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  source: string;
  embedding: number[];
  metadata: any;
  importance?: number;
  importance_score?: number; // Numeric importance score between 0 and 1
  tags?: Array<string | { text: string, confidence: number, approved?: boolean }>; // Tags with optional confidence scores
  tag_confidence?: number; // Overall confidence in tag extraction
  created_at: string;
  updated_at: string;
} 