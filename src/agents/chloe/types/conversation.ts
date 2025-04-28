import { Message } from './message';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
  status: 'active' | 'archived' | 'deleted';
} 