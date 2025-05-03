// Define all the necessary types
import { ImportanceLevel } from '../../../constants/memory';

export interface ChloeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'system' | 'error';
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
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
  importance: ImportanceLevel;
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
  timestamp: Date;
  type: 'success' | 'failure' | 'improvement';
  metadata?: Record<string, any>;
}

export type ChannelValue<T> = 'array' | 'single';

export interface ChloeState {
  messages: ChloeMessage[];
  memory: Memory[];
  tasks: Task[];
  reflections: Reflection[];
  response?: string;
  error?: string;
  currentTask?: Task;
  metadata?: Record<string, any>;
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