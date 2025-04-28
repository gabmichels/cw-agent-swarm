export interface Reflection {
  id: string;
  content: string;
  type: 'daily' | 'weekly' | 'monthly' | 'task' | 'error';
  insights: string[];
  recommendations: string[];
  created: Date;
  metadata?: Record<string, any>;
  relatedTasks?: string[];
  relatedMemories?: string[];
} 