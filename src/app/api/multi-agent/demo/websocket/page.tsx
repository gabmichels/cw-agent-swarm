'use client';

import React from 'react';
import WebSocketDemo from '../../../../../components/WebSocketDemo';

export default function WebSocketDemoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Multi-Agent System WebSocket Demo</h1>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-900 shadow-lg rounded-lg overflow-hidden">
          <div className="p-4">
            <WebSocketDemo />
          </div>
        </div>
        
        <div className="bg-gray-900 shadow-lg rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">How to Test WebSocket Functionality</h2>
            
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Create a new agent</strong> using the API endpoint:
                <pre className="bg-gray-800 p-2 my-2 rounded overflow-x-auto text-sm">
                  POST /api/multi-agent/system/agents<br />
                  &#123;<br />
                  &nbsp;&nbsp;"name": "Test Agent",<br />
                  &nbsp;&nbsp;"description": "Testing WebSocket notifications",<br />
                  &nbsp;&nbsp;"capabilities": []<br />
                  &#125;
                </pre>
              </li>
              
              <li>
                <strong>Subscribe to an agent</strong> by entering the agent ID and clicking "Subscribe".
              </li>
              
              <li>
                <strong>Update the agent</strong> to see real-time notifications:
                <pre className="bg-gray-800 p-2 my-2 rounded overflow-x-auto text-sm">
                  PATCH /api/multi-agent/system/agents/&#123;agentId&#125;<br />
                  &#123;<br />
                  &nbsp;&nbsp;"status": "busy"<br />
                  &#125;
                </pre>
              </li>
              
              <li>
                <strong>Delete the agent</strong> to see the delete notification:
                <pre className="bg-gray-800 p-2 my-2 rounded overflow-x-auto text-sm">
                  DELETE /api/multi-agent/system/agents/&#123;agentId&#125;
                </pre>
              </li>
              
              <li>
                <strong>Create a new chat</strong> and subscribe to it to see chat-related events.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
} 