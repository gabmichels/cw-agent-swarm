import { MessageRole } from './state';

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  metadata?: Record<string, any>;
  timestamp: Date;
  parent_id?: string;
  conversation_id: string;
} 