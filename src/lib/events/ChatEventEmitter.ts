// Browser-compatible EventEmitter implementation
class SimpleEventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  setMaxListeners(_max: number): void {
    // No-op for browser compatibility
  }
}
import { ulid } from 'ulid';
import { createStructuredId, EntityNamespace, EntityType } from '../../types/entity-identifier';

// Event type definitions with strict typing
export enum ChatEventType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  TASK_COMPLETED = 'TASK_COMPLETED',
  AGENT_STATUS_CHANGED = 'AGENT_STATUS_CHANGED',
  SYSTEM_NOTIFICATION = 'SYSTEM_NOTIFICATION',
  FILE_PROCESSED = 'FILE_PROCESSED',
  TYPING_START = 'TYPING_START',
  TYPING_STOP = 'TYPING_STOP'
}

export interface BaseSSEEvent {
  readonly id: string;
  readonly type: ChatEventType;
  readonly timestamp: number;
  readonly chatId?: string;
  readonly userId?: string;
}

export interface NewMessageEvent extends BaseSSEEvent {
  readonly type: ChatEventType.NEW_MESSAGE;
  readonly chatId: string;
  readonly message: {
    readonly id: string;
    readonly content: string;
    readonly sender: {
      readonly id: string;
      readonly name: string;
      readonly role: 'user' | 'assistant' | 'system';
      readonly avatar?: string;
    };
    readonly timestamp: Date;
    readonly metadata?: Record<string, unknown>;
  };
}

export interface TaskCompletedEvent extends BaseSSEEvent {
  readonly type: ChatEventType.TASK_COMPLETED;
  readonly userId: string;
  readonly task: {
    readonly id: string;
    readonly name: string;
    readonly status: 'completed' | 'failed';
    readonly result?: unknown;
    readonly error?: string;
  };
}

export interface AgentStatusChangedEvent extends BaseSSEEvent {
  readonly type: ChatEventType.AGENT_STATUS_CHANGED;
  readonly agent: {
    readonly id: string;
    readonly name: string;
    readonly status: 'online' | 'offline' | 'busy';
    readonly avatar?: string;
  };
}

export interface SystemNotificationEvent extends BaseSSEEvent {
  readonly type: ChatEventType.SYSTEM_NOTIFICATION;
  readonly notification: {
    readonly level: 'info' | 'warning' | 'error' | 'success';
    readonly title: string;
    readonly message: string;
    readonly action?: {
      readonly label: string;
      readonly url: string;
    };
  };
}

export interface FileProcessedEvent extends BaseSSEEvent {
  readonly type: ChatEventType.FILE_PROCESSED;
  readonly userId: string;
  readonly file: {
    readonly id: string;
    readonly name: string;
    readonly status: 'processed' | 'failed';
    readonly url?: string;
    readonly error?: string;
  };
}

export interface TypingEvent extends BaseSSEEvent {
  readonly type: ChatEventType.TYPING_START | ChatEventType.TYPING_STOP;
  readonly chatId: string;
  readonly userId: string;
  readonly userName: string;
}

export type SSEEvent = 
  | NewMessageEvent 
  | TaskCompletedEvent 
  | AgentStatusChangedEvent 
  | SystemNotificationEvent 
  | FileProcessedEvent 
  | TypingEvent;

// Event listener type for type safety
export type EventListener<T extends SSEEvent> = (event: T) => void | Promise<void>;

// Interface for dependency injection
export interface IChatEventEmitter {
  emitNewMessage(chatId: string, message: NewMessageEvent['message']): void;
  emitTaskCompleted(userId: string, task: TaskCompletedEvent['task']): void;
  emitAgentStatusChanged(agent: AgentStatusChangedEvent['agent']): void;
  emitSystemNotification(notification: SystemNotificationEvent['notification']): void;
  emitFileProcessed(userId: string, file: FileProcessedEvent['file']): void;
  emitTypingStart(chatId: string, userId: string, userName: string): void;
  emitTypingStop(chatId: string, userId: string, userName: string): void;
  
  // Subscription methods
  onNewMessage(chatId: string, listener: EventListener<NewMessageEvent>): () => void;
  onTaskCompleted(userId: string, listener: EventListener<TaskCompletedEvent>): () => void;
  onAgentStatusChanged(listener: EventListener<AgentStatusChangedEvent>): () => void;
  onSystemNotification(listener: EventListener<SystemNotificationEvent>): () => void;
  onFileProcessed(userId: string, listener: EventListener<FileProcessedEvent>): () => void;
  onTypingEvent(chatId: string, listener: EventListener<TypingEvent>): () => void;
  
  // Cleanup
  removeAllListeners(): void;
  getConnectionCount(): number;
}

/**
 * Centralized event emitter for SSE chat events
 * Uses composition instead of inheritance for better type safety
 * Follows immutability and dependency injection principles
 */
export class ChatEventEmitter implements IChatEventEmitter {
  private static instance: ChatEventEmitter | null = null;
  private readonly eventEmitter: SimpleEventEmitter;
  private readonly connections = new Map<string, number>();

  private constructor() {
    this.eventEmitter = new SimpleEventEmitter();
    // Set max listeners to handle many SSE connections
    this.eventEmitter.setMaxListeners(1000);
  }

  /**
   * Get singleton instance with proper initialization
   */
  public static getInstance(): ChatEventEmitter {
    if (!ChatEventEmitter.instance) {
      ChatEventEmitter.instance = new ChatEventEmitter();
    }
    return ChatEventEmitter.instance;
  }

  /**
   * Pure function to create event ID
   */
  private createEventId(): string {
    return ulid();
  }

  /**
   * Pure function to create base event
   */
  private createBaseEvent(type: ChatEventType, chatId?: string, userId?: string): BaseSSEEvent {
    return Object.freeze({
      id: this.createEventId(),
      type,
      timestamp: Date.now(),
      ...(chatId && { chatId }),
      ...(userId && { userId })
    });
  }

  /**
   * Emit new message event with immutable data
   */
  emitNewMessage(chatId: string, message: NewMessageEvent['message']): void {
    const event: NewMessageEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.NEW_MESSAGE, chatId),
      type: ChatEventType.NEW_MESSAGE,
      chatId,
      message: Object.freeze({
        ...message,
        sender: Object.freeze(message.sender)
      })
    });

    this.eventEmitter.emit(`chat:${chatId}:message`, event);
    this.eventEmitter.emit('global:message', event);
  }

  /**
   * Emit task completed event with immutable data
   */
  emitTaskCompleted(userId: string, task: TaskCompletedEvent['task']): void {
    const event: TaskCompletedEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.TASK_COMPLETED, undefined, userId),
      type: ChatEventType.TASK_COMPLETED,
      userId,
      task: Object.freeze(task)
    });

    this.eventEmitter.emit(`user:${userId}:task`, event);
    this.eventEmitter.emit('global:task', event);
  }

  /**
   * Emit agent status changed event with immutable data
   */
  emitAgentStatusChanged(agent: AgentStatusChangedEvent['agent']): void {
    const event: AgentStatusChangedEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.AGENT_STATUS_CHANGED),
      type: ChatEventType.AGENT_STATUS_CHANGED,
      agent: Object.freeze(agent)
    });

    this.eventEmitter.emit('global:agent-status', event);
  }

  /**
   * Emit system notification event with immutable data
   */
  emitSystemNotification(notification: SystemNotificationEvent['notification']): void {
    const event: SystemNotificationEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.SYSTEM_NOTIFICATION),
      type: ChatEventType.SYSTEM_NOTIFICATION,
      notification: Object.freeze({
        ...notification,
        ...(notification.action && { action: Object.freeze(notification.action) })
      })
    });

    this.eventEmitter.emit('global:system-notification', event);
  }

  /**
   * Emit file processed event with immutable data
   */
  emitFileProcessed(userId: string, file: FileProcessedEvent['file']): void {
    const event: FileProcessedEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.FILE_PROCESSED, undefined, userId),
      type: ChatEventType.FILE_PROCESSED,
      userId,
      file: Object.freeze(file)
    });

    this.eventEmitter.emit(`user:${userId}:file`, event);
    this.eventEmitter.emit('global:file', event);
  }

  /**
   * Emit typing start event
   */
  emitTypingStart(chatId: string, userId: string, userName: string): void {
    const event: TypingEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.TYPING_START, chatId, userId),
      type: ChatEventType.TYPING_START,
      chatId,
      userId,
      userName
    });

    this.eventEmitter.emit(`chat:${chatId}:typing`, event);
  }

  /**
   * Emit typing stop event
   */
  emitTypingStop(chatId: string, userId: string, userName: string): void {
    const event: TypingEvent = Object.freeze({
      ...this.createBaseEvent(ChatEventType.TYPING_STOP, chatId, userId),
      type: ChatEventType.TYPING_STOP,
      chatId,
      userId,
      userName
    });

    this.eventEmitter.emit(`chat:${chatId}:typing`, event);
  }

  /**
   * Subscribe to new message events for a specific chat
   */
  onNewMessage(chatId: string, listener: EventListener<NewMessageEvent>): () => void {
    const eventName = `chat:${chatId}:message`;
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Subscribe to task completed events for a specific user
   */
  onTaskCompleted(userId: string, listener: EventListener<TaskCompletedEvent>): () => void {
    const eventName = `user:${userId}:task`;
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Subscribe to agent status change events
   */
  onAgentStatusChanged(listener: EventListener<AgentStatusChangedEvent>): () => void {
    const eventName = 'global:agent-status';
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Subscribe to system notification events
   */
  onSystemNotification(listener: EventListener<SystemNotificationEvent>): () => void {
    const eventName = 'global:system-notification';
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Subscribe to file processed events for a specific user
   */
  onFileProcessed(userId: string, listener: EventListener<FileProcessedEvent>): () => void {
    const eventName = `user:${userId}:file`;
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Subscribe to typing events for a specific chat
   */
  onTypingEvent(chatId: string, listener: EventListener<TypingEvent>): () => void {
    const eventName = `chat:${chatId}:typing`;
    this.eventEmitter.on(eventName, listener);
    this.trackConnection(eventName);
    
    return () => {
      this.eventEmitter.off(eventName, listener);
      this.untrackConnection(eventName);
    };
  }

  /**
   * Track connection for monitoring
   */
  private trackConnection(eventName: string): void {
    const count = this.connections.get(eventName) || 0;
    this.connections.set(eventName, count + 1);
  }

  /**
   * Untrack connection for monitoring
   */
  private untrackConnection(eventName: string): void {
    const count = this.connections.get(eventName) || 0;
    if (count <= 1) {
      this.connections.delete(eventName);
    } else {
      this.connections.set(eventName, count - 1);
    }
  }

  /**
   * Get total connection count for monitoring
   */
  getConnectionCount(): number {
    return Array.from(this.connections.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Remove all listeners and clean up
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
    this.connections.clear();
  }
}

// Export singleton instance for dependency injection
export const chatEventEmitter = ChatEventEmitter.getInstance(); 