// Define all the necessary types
export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  dependencies?: string[];
  result?: any;
  error?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: Record<string, any>;
  timestamp: Date;
  parent_id?: string;
  conversation_id: string;
}

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

export type ChannelValue<T> = 'array' | 'single';

export interface ChloeState {
  messages: Message[];
  memory: Memory[];
  tasks: Task[];
  reflections: Reflection[];
  response?: string;
  error?: string;
  currentTask?: Task;
}

export interface StateGraphConfig {
  channels: {
    [key: string]: ChannelValue<any>;
  };
}

export class StateGraph<T> {
  constructor(config: StateGraphConfig) {
    // Implementation will be provided by LangGraph
  }

  addNode(name: string, handler: (state: T) => Promise<T>): void {
    // Implementation will be provided by LangGraph
  }

  addEdge(from: string, to: string): void {
    // Implementation will be provided by LangGraph
  }
} 