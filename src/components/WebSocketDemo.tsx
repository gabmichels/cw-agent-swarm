import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { ServerEvent } from '../server/websocket/types';

/**
 * A demo component that shows how to use the WebSocket functionality
 */
export default function WebSocketDemo() {
  const {
    isConnected,
    lastEvent,
    subscribeToEvent,
    subscribeToAgent,
    unsubscribeFromAgent,
    subscribeToChat,
    unsubscribeFromChat
  } = useWebSocket();
  
  const [events, setEvents] = useState<Array<{type: string; payload: any; timestamp: number}>>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedChatId, setSelectedChatId] = useState('');
  
  // Subscribe to all agent events
  useEffect(() => {
    const unsubscribeAgentCreated = subscribeToEvent(ServerEvent.AGENT_CREATED, (payload) => {
      console.log('Agent created:', payload);
      addEvent(ServerEvent.AGENT_CREATED, payload);
    });
    
    const unsubscribeAgentUpdated = subscribeToEvent(ServerEvent.AGENT_UPDATED, (payload) => {
      console.log('Agent updated:', payload);
      addEvent(ServerEvent.AGENT_UPDATED, payload);
    });
    
    const unsubscribeAgentDeleted = subscribeToEvent(ServerEvent.AGENT_DELETED, (payload) => {
      console.log('Agent deleted:', payload);
      addEvent(ServerEvent.AGENT_DELETED, payload);
    });
    
    const unsubscribeAgentStatusChanged = subscribeToEvent(ServerEvent.AGENT_STATUS_CHANGED, (payload) => {
      console.log('Agent status changed:', payload);
      addEvent(ServerEvent.AGENT_STATUS_CHANGED, payload);
    });
    
    // Chat events
    const unsubscribeChatCreated = subscribeToEvent(ServerEvent.CHAT_CREATED, (payload) => {
      console.log('Chat created:', payload);
      addEvent(ServerEvent.CHAT_CREATED, payload);
    });
    
    const unsubscribeChatUpdated = subscribeToEvent(ServerEvent.CHAT_UPDATED, (payload) => {
      console.log('Chat updated:', payload);
      addEvent(ServerEvent.CHAT_UPDATED, payload);
    });
    
    const unsubscribeChatDeleted = subscribeToEvent(ServerEvent.CHAT_DELETED, (payload) => {
      console.log('Chat deleted:', payload);
      addEvent(ServerEvent.CHAT_DELETED, payload);
    });
    
    const unsubscribeMessageCreated = subscribeToEvent(ServerEvent.MESSAGE_CREATED, (payload) => {
      console.log('Message created:', payload);
      addEvent(ServerEvent.MESSAGE_CREATED, payload);
    });
    
    // System notifications
    const unsubscribeSystemNotification = subscribeToEvent(ServerEvent.SYSTEM_NOTIFICATION, (payload) => {
      console.log('System notification:', payload);
      addEvent(ServerEvent.SYSTEM_NOTIFICATION, payload);
    });
    
    // Clean up subscriptions
    return () => {
      unsubscribeAgentCreated?.();
      unsubscribeAgentUpdated?.();
      unsubscribeAgentDeleted?.();
      unsubscribeAgentStatusChanged?.();
      unsubscribeChatCreated?.();
      unsubscribeChatUpdated?.();
      unsubscribeChatDeleted?.();
      unsubscribeMessageCreated?.();
      unsubscribeSystemNotification?.();
    };
  }, [subscribeToEvent]);
  
  // Add an event to the list
  const addEvent = (type: string, payload: any) => {
    setEvents((prev) => [
      { type, payload, timestamp: Date.now() },
      ...prev.slice(0, 19) // Keep only the last 20 events
    ]);
  };
  
  // Handle agent subscription
  const handleAgentSubscribe = () => {
    if (selectedAgentId) {
      subscribeToAgent(selectedAgentId);
      addEvent('CLIENT_ACTION', { message: `Subscribed to agent: ${selectedAgentId}` });
    }
  };
  
  const handleAgentUnsubscribe = () => {
    if (selectedAgentId) {
      unsubscribeFromAgent(selectedAgentId);
      addEvent('CLIENT_ACTION', { message: `Unsubscribed from agent: ${selectedAgentId}` });
    }
  };
  
  // Handle chat subscription
  const handleChatSubscribe = () => {
    if (selectedChatId) {
      subscribeToChat(selectedChatId);
      addEvent('CLIENT_ACTION', { message: `Subscribed to chat: ${selectedChatId}` });
    }
  };
  
  const handleChatUnsubscribe = () => {
    if (selectedChatId) {
      unsubscribeFromChat(selectedChatId);
      addEvent('CLIENT_ACTION', { message: `Unsubscribed from chat: ${selectedChatId}` });
    }
  };
  
  // Clear events
  const handleClearEvents = () => {
    setEvents([]);
  };
  
  return (
    <div className="p-4 rounded-lg bg-gray-800 text-white">
      <h2 className="text-xl font-bold mb-4">WebSocket Demo</h2>
      
      <div className="mb-4">
        <span className="inline-block px-2 py-1 rounded mr-2 text-sm" 
              style={{ backgroundColor: isConnected ? 'green' : 'red' }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Agent subscription */}
        <div className="p-3 border border-gray-700 rounded">
          <h3 className="text-lg font-semibold mb-2">Agent Subscription</h3>
          <div className="flex mb-2">
            <input
              type="text"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              placeholder="Enter agent ID"
              className="flex-1 px-2 py-1 rounded-l bg-gray-700 text-white border-r border-gray-600"
            />
            <button 
              onClick={handleAgentSubscribe}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-r"
              disabled={!selectedAgentId}
            >
              Subscribe
            </button>
          </div>
          <button 
            onClick={handleAgentUnsubscribe}
            className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
            disabled={!selectedAgentId}
          >
            Unsubscribe
          </button>
        </div>
        
        {/* Chat subscription */}
        <div className="p-3 border border-gray-700 rounded">
          <h3 className="text-lg font-semibold mb-2">Chat Subscription</h3>
          <div className="flex mb-2">
            <input
              type="text"
              value={selectedChatId}
              onChange={(e) => setSelectedChatId(e.target.value)}
              placeholder="Enter chat ID"
              className="flex-1 px-2 py-1 rounded-l bg-gray-700 text-white border-r border-gray-600"
            />
            <button 
              onClick={handleChatSubscribe}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-r"
              disabled={!selectedChatId}
            >
              Subscribe
            </button>
          </div>
          <button 
            onClick={handleChatUnsubscribe}
            className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 rounded"
            disabled={!selectedChatId}
          >
            Unsubscribe
          </button>
        </div>
      </div>
      
      {/* Events log */}
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-lg font-semibold">Events Log</h3>
        <button 
          onClick={handleClearEvents}
          className="px-2 py-1 text-sm bg-gray-600 hover:bg-gray-700 rounded"
        >
          Clear
        </button>
      </div>
      
      <div className="border border-gray-700 rounded p-2 h-64 overflow-auto">
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No events yet</div>
        ) : (
          <div className="space-y-2">
            {events.map((event, index) => (
              <div key={index} className="p-2 bg-gray-700 rounded text-sm">
                <div className="flex justify-between mb-1">
                  <span className="font-medium">{event.type}</span>
                  <span className="text-gray-400 text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 