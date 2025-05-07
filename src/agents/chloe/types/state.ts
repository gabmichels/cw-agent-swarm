// Define all the necessary types
import { ImportanceLevel } from '../../../constants/memory';
import { MemoryType, ExtendedMemorySource } from '../../../server/memory/config/types';

// Define role enum for Message
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

// Define message type enum for ChloeMessage
export enum ChloeMessageType {
  USER = 'user',
  SYSTEM = 'system',
  ERROR = 'error'
}

export interface ChloeMessage {
  id: string;
  content: string;
  timestamp: Date;
  type: ChloeMessageType;
  metadata?: Record<string, any>;
}

// Define task status enum
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  created_at: Date;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  content: string;
  role: MessageRole;
  metadata?: Record<string, any>;
  timestamp: Date;
  parent_id?: string;
  conversation_id: string;
}

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  importance: ImportanceLevel;
  source: ExtendedMemorySource;
  context?: string;
  created: Date;
  lastAccessed?: Date;
  accessCount?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Define reflection type enum
export enum ReflectionType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  IMPROVEMENT = 'improvement'
}

export interface Reflection {
  id: string;
  content: string;
  timestamp: Date;
  type: ReflectionType;
  metadata?: Record<string, any>;
}

// Define channel value enum
export enum ChannelValueType {
  ARRAY = 'array',
  SINGLE = 'single'
}

export type ChannelValue<T> = ChannelValueType;

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

// Define plan step priority levels
export enum PlanStepPriority {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high'
}

export interface MessageOptions {
  userId: string;
  attachments?: any[];
  visionResponseFor?: string;
  userMessageId?: string; // ID of the user message if already stored
} 