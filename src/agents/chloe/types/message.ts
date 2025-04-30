export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: Record<string, any>;
  timestamp: Date;
  parent_id?: string;
  conversation_id: string;
} 