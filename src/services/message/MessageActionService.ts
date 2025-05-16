import { Message } from '@/types';

export enum MessageImportance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum MessageReliability {
  RELIABLE = 'reliable',
  UNRELIABLE = 'unreliable',
  UNKNOWN = 'unknown'
}

export interface MessageActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface MessageActionOptions {
  messageId: string;
  timestamp: Date;
  content: string;
}

export interface MessageActionService {
  // Flag message importance
  flagImportance(options: MessageActionOptions & { importance: MessageImportance }): Promise<MessageActionResult>;
  
  // Flag message reliability
  flagReliability(options: MessageActionOptions & { reliability: MessageReliability }): Promise<MessageActionResult>;
  
  // Add to knowledge base
  addToKnowledge(options: MessageActionOptions & { 
    tags?: string[];
    category?: string;
  }): Promise<MessageActionResult>;
  
  // Regenerate message
  regenerateMessage(options: MessageActionOptions & {
    avoidContent?: string;
    instructions?: string;
  }): Promise<MessageActionResult>;
  
  // Export to Coda
  exportToCoda(options: MessageActionOptions & {
    title?: string;
    format?: 'markdown' | 'plain';
  }): Promise<MessageActionResult>;
  
  // Delete message
  deleteMessage(options: Pick<MessageActionOptions, 'messageId' | 'timestamp'>): Promise<MessageActionResult>;
  
  // Copy message
  copyMessage(options: Pick<MessageActionOptions, 'content'>): Promise<MessageActionResult>;
} 