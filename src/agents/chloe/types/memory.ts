export interface Memory {
  id: string;
  content: string;
  type: 'message' | 'thought' | 'insight' | 'fact' | 'reflection' | 'task' | 'document';
  importance: 'low' | 'medium' | 'high';
  source: 'user' | 'chloe' | 'system' | 'tool' | 'web';
  context?: string;
  created: Date;
  lastAccessed?: Date;
  accessCount?: number;
  tags?: string[];
  metadata?: Record<string, any>;
} 