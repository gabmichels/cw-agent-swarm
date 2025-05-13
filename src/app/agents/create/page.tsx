'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AgentRegistrationForm from '@/components/agent/AgentRegistrationForm';
import { AgentRegistrationRequest } from '@/lib/multi-agent/types/agent';

// Helper function to construct proper API URLs
function getApiUrl(path: string): string {
  // Determine if we're running in a browser
  const isBrowser = typeof window !== 'undefined';
  
  // Get the base URL from the browser if available, otherwise use a default
  const baseUrl = isBrowser 
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:3000'; // Default for server-side

  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseUrl}${normalizedPath}`;
}

export default function CreateAgentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (data: AgentRegistrationRequest) => {
    try {
      setIsSubmitting(true);
      
      console.log('Creating agent with data:', data);
      
      // Submit agent registration
      const response = await fetch(getApiUrl('/api/multi-agent/agents'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to register agent');
      }
      
      const result = await response.json();
      
      // Redirect to the agents page on success
      router.push('/agents');
      
      // Show success notification (optional)
      console.log('Agent created successfully:', result.agent);
    } catch (error) {
      console.error('Error creating agent:', error);
      
      // Show error notification (optional)
      alert(`Error creating agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Agent</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Configure and create a new specialized agent
        </p>
      </div>
      
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <AgentRegistrationForm 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
} 