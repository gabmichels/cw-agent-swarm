import { ClientEvent, EventHandler, EventHandlerRegistry } from './types';
import { Socket } from 'socket.io';

/**
 * Implementation of the EventHandlerRegistry interface for managing event handlers
 */
export class DefaultEventHandlerRegistry implements EventHandlerRegistry {
  private handlers: Map<ClientEvent, EventHandler<unknown>> = new Map();
  
  /**
   * Register a handler for a client event
   */
  registerHandler<T>(event: ClientEvent, handler: EventHandler<T>): void {
    this.handlers.set(event, handler as EventHandler<unknown>);
  }
  
  /**
   * Get the handler for a client event
   */
  getHandler<T>(event: ClientEvent): EventHandler<T> | null {
    const handler = this.handlers.get(event);
    return handler ? (handler as EventHandler<T>) : null;
  }
  
  /**
   * Remove a handler for a client event
   */
  removeHandler(event: ClientEvent): void {
    this.handlers.delete(event);
  }
  
  /**
   * Register default handlers for common events
   * @param subscriptionManager - The client subscription manager to use for subscription events
   */
  registerDefaultHandlers(socket: Socket): void {
    // Register standard disconnect handler if not already registered
    if (!this.getHandler(ClientEvent.CLIENT_DISCONNECT)) {
      this.registerHandler<void>(ClientEvent.CLIENT_DISCONNECT, () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    }
    
    // Register ready handler
    if (!this.getHandler(ClientEvent.CLIENT_READY)) {
      this.registerHandler<void>(ClientEvent.CLIENT_READY, () => {
        console.log(`Client ready: ${socket.id}`);
        // Send initial state if needed
      });
    }
    
    // Register message acknowledgement handlers
    if (!this.getHandler(ClientEvent.MESSAGE_RECEIVED)) {
      this.registerHandler<{ messageId: string }>(
        ClientEvent.MESSAGE_RECEIVED,
        (payload) => {
          console.log(`Message received acknowledgement: ${payload.messageId}`);
        }
      );
    }
    
    if (!this.getHandler(ClientEvent.MESSAGE_READ)) {
      this.registerHandler<{ messageId: string }>(
        ClientEvent.MESSAGE_READ,
        (payload) => {
          console.log(`Message read acknowledgement: ${payload.messageId}`);
        }
      );
    }
  }
} 