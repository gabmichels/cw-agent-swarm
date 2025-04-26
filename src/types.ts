// Define message type for better type safety
export interface Message {
  sender: string;
  content: string;
  timestamp: Date;
  memory?: string[];
  thoughts?: string[];
}

// Define interface for file attachment
export interface FileAttachment {
  file: File;
  preview: string;
  type: 'image' | 'document' | 'text' | 'pdf' | 'other';
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