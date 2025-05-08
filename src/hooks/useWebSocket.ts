import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientEvent, ServerEvent } from '../server/websocket/types';

/**
 * Custom hook for connecting to the WebSocket server
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [lastEvent, setLastEvent] = useState<{type: string; payload: any} | null>(null);
  
  // Initialize WebSocket connection
  useEffect(() => {
    const socket = io({
      path: '/api/ws',
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    
    socket.on('connect', () => {
      console.log('WebSocket connected!');
      setIsConnected(true);
      
      // Notify server that client is ready
      socket.emit(ClientEvent.CLIENT_READY);
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected!');
      setIsConnected(false);
    });
    
    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setIsConnected(false);
    });
    
    // Store socket reference
    socketRef.current = socket;
    
    // Clean up on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);
  
  // Helper function to subscribe to events
  const subscribeToEvent = useCallback((event: ServerEvent, callback: (payload: any) => void) => {
    if (!socketRef.current) return;
    
    socketRef.current.on(event, (payload) => {
      setLastEvent({ type: event, payload });
      callback(payload);
    });
    
    return () => {
      socketRef.current?.off(event);
    };
  }, []);
  
  // Subscribe to agent events
  const subscribeToAgent = useCallback((agentId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.SUBSCRIBE_AGENT, agentId);
  }, []);
  
  const unsubscribeFromAgent = useCallback((agentId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.UNSUBSCRIBE_AGENT, agentId);
  }, []);
  
  // Subscribe to chat events
  const subscribeToChat = useCallback((chatId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.SUBSCRIBE_CHAT, chatId);
  }, []);
  
  const unsubscribeFromChat = useCallback((chatId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.UNSUBSCRIBE_CHAT, chatId);
  }, []);
  
  // Subscribe to collection events
  const subscribeToCollection = useCallback((collectionId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.SUBSCRIBE_COLLECTION, collectionId);
  }, []);
  
  const unsubscribeFromCollection = useCallback((collectionId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.UNSUBSCRIBE_COLLECTION, collectionId);
  }, []);
  
  // Acknowledge message received
  const acknowledgeMessageReceived = useCallback((messageId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.MESSAGE_RECEIVED, { messageId });
  }, []);
  
  // Acknowledge message read
  const acknowledgeMessageRead = useCallback((messageId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit(ClientEvent.MESSAGE_READ, { messageId });
  }, []);
  
  return {
    isConnected,
    lastEvent,
    socket: socketRef.current,
    subscribeToEvent,
    subscribeToAgent,
    unsubscribeFromAgent,
    subscribeToChat,
    unsubscribeFromChat,
    subscribeToCollection,
    unsubscribeFromCollection,
    acknowledgeMessageReceived,
    acknowledgeMessageRead
  };
}