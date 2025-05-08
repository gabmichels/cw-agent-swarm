# Multi-Agent UI Integration Guide

This document provides guidance on integrating the multi-agent system UI components into your application. It covers the key components, their props, and usage patterns.

## Overview

The multi-agent system UI consists of several components that work together to provide a comprehensive interface for agent-to-agent communication and visualization:

1. **MultiAgentChatInterface**: A specialized chat interface supporting multiple agents and directed messaging
2. **AgentRelationshipGraph**: A visualization of agent relationships and their strengths
3. **MultiAgentChatPage**: A complete page combining both interfaces with analytics

## Prerequisites

Before using these components, ensure you have:

1. Implemented the WebSocket server for real-time communication
2. Set up the necessary API endpoints for agent and chat management
3. Configured the memory system for agent and chat data storage
4. Installed required dependencies:
   - `socket.io-client` for WebSocket communication
   - `vis-network` for relationship visualization

## Component Integration

### MultiAgentChatInterface

This component provides a complete chat interface for multi-agent interactions.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| chatId | string | Yes | Unique identifier for the chat |
| userId | string | Yes | Identifier for the current user |
| initialAgents | Agent[] | No | Optional list of pre-loaded agents |

#### Example Usage

```tsx
import MultiAgentChatInterface from '../components/MultiAgentChatInterface';

// In your component
return (
  <div className="container">
    <h1>Multi-Agent Chat</h1>
    <MultiAgentChatInterface 
      chatId="chat_collaboration_123"
      userId="user_admin"
    />
  </div>
);
```

#### Features

- Direct messaging to specific agents
- Agent capability inspection
- Dynamic agent addition to chats
- Real-time status indicators
- Participant tracking
- WebSocket-based real-time updates

### AgentRelationshipGraph

This component visualizes relationships between agents as an interactive graph.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| initialAgents | Agent[] | No | Pre-loaded agents |
| initialRelationships | Relationship[] | No | Pre-loaded relationships |
| height | string | No | Height of the graph (default: "500px") |
| width | string | No | Width of the graph (default: "100%") |
| interactive | boolean | No | Enable interaction with the graph (default: true) |

#### Example Usage

```tsx
import AgentRelationshipGraph from '../components/AgentRelationshipGraph';

// In your component
return (
  <div className="container">
    <h1>Agent Relationships</h1>
    <AgentRelationshipGraph 
      height="400px"
      width="100%"
    />
  </div>
);
```

#### Features

- Visual representation of agent relationships
- Color-coded relationship types
- Relationship strength visualization
- Real-time updates via WebSocket
- Interactive graph exploration

## Integrating Complete Multi-Agent Page

For a complete solution, use the `MultiAgentChatPage` component which combines all elements:

```tsx
import MultiAgentChatPage from '../app/multi-agent-chat/page';

// Simply include the page in your router or as a component
// The page handles creating new chats or joining existing ones
```

Or create a custom page by combining components:

```tsx
import MultiAgentChatInterface from '../components/MultiAgentChatInterface';
import AgentRelationshipGraph from '../components/AgentRelationshipGraph';

function CustomMultiAgentPage() {
  const [chatId, setChatId] = useState('chat_123');
  const [userId, setUserId] = useState('user_admin');
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <MultiAgentChatInterface chatId={chatId} userId={userId} />
      </div>
      <div>
        <AgentRelationshipGraph height="300px" />
        {/* Add your own custom analytics here */}
      </div>
    </div>
  );
}
```

## WebSocket Configuration

The UI components require WebSocket support for real-time updates. This is handled by the `useWebSocket` hook, which connects to the server:

```tsx
// The hook is already integrated in the components, but you can configure
// WebSocket settings in your environment variables:

// .env.local
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3000
NEXT_PUBLIC_WEBSOCKET_PATH=/api/ws
```

## API Integration

The UI components make calls to the following API endpoints:

1. `/api/agents` - For fetching available agents
2. `/api/agent-relationships` - For fetching relationship data
3. `/api/chats` - For chat management
4. `/api/chats/message` - For sending messages
5. `/api/chats/participants` - For managing chat participants

Ensure these endpoints are implemented according to the API specifications in `/docs/api/multi-agent/API_DOCUMENTATION.md`.

## Styling and Customization

The components use Tailwind CSS by default. You can customize the appearance by:

1. **Passing custom className props** where supported
2. **Overriding Tailwind classes** in your CSS
3. **Creating wrapper components** with your own styling

Example of styling customization:

```tsx
<MultiAgentChatInterface 
  chatId={chatId} 
  userId={userId}
  className="my-custom-chat-container" // Custom container class
/>
```

## Error Handling

The components include basic error handling, but we recommend implementing additional error boundaries:

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<div>Something went wrong with the chat</div>}>
  <MultiAgentChatInterface chatId={chatId} userId={userId} />
</ErrorBoundary>
```

## Performance Considerations

For optimal performance:

1. Use the `initialAgents` prop to avoid loading delays
2. Consider pagination for chats with many messages
3. Use memoization for expensive computations
4. Implement virtualization for long chat histories

## Browser Compatibility

The components are tested and compatible with:

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Common Issues and Solutions

### WebSocket Connection Failures

If WebSocket connections fail:

1. Check that the WebSocket server is running
2. Verify CORS settings on your server
3. Check network connectivity
4. Ensure proper WebSocket URL configuration

### Agent Relationship Graph Not Displaying

If the graph doesn't appear:

1. Check that `vis-network` is installed
2. Verify you have relationship data
3. Ensure the container has a specified height
4. Check console for any errors

## Next Steps

After integration, consider these enhancements:

1. Add custom analytics for agent performance
2. Implement agent capability filtering
3. Create specialized visualization for task delegation flows
4. Add conversation export functionality

## Example Integration Code

Here's a complete example of how to integrate both components into a Next.js application:

```tsx
// pages/agent-collaboration.tsx
'use client';

import { useState, useEffect } from 'react';
import MultiAgentChatInterface from '../components/MultiAgentChatInterface';
import AgentRelationshipGraph from '../components/AgentRelationshipGraph';

export default function AgentCollaborationPage() {
  const [chatId, setChatId] = useState('');
  const [userId, setUserId] = useState('user_admin');
  
  // Create or load a chat
  useEffect(() => {
    async function initializeChat() {
      // Either load existing chat or create a new one
      const newChatId = `chat_${Date.now()}`;
      setChatId(newChatId);
      
      // Create the chat via API
      await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newChatId,
          name: 'Collaboration Session',
          createdBy: userId
        })
      });
    }
    
    initializeChat();
  }, [userId]);
  
  if (!chatId) {
    return <div>Initializing chat...</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Agent Collaboration</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MultiAgentChatInterface chatId={chatId} userId={userId} />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Agent Relationships</h2>
          <AgentRelationshipGraph height="400px" />
        </div>
      </div>
    </div>
  );
}
```

## Conclusion

The multi-agent UI components provide a comprehensive interface for agent-to-agent communication and relationship visualization. By following this guide, you should be able to successfully integrate these components into your application and provide users with a powerful tool for multi-agent collaboration. 