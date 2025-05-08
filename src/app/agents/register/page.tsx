'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AgentRegistrationForm from '@/components/agent/AgentRegistrationForm';
import { AgentRegistrationRequest, AgentRegistrationResponse } from '@/lib/multi-agent/types/agent';

const RegisterAgentPage: React.FC = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: AgentRegistrationRequest) => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/multi-agent/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      const result: AgentRegistrationResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to register agent');
      }
      
      // Navigate to the agent detail page or list page
      router.push(`/agents/${result.agent?.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Register New Agent</h1>
        <p className="text-gray-300">
          Create a new agent profile to integrate with the multi-agent system. Define capabilities,
          parameters, and metadata to ensure proper functionality.
        </p>
      </div>
      
      {error && (
        <div className="bg-red-900 border border-red-700 text-white px-4 py-3 rounded mb-6">
          <p className="font-bold">Registration Failed</p>
          <p>{error}</p>
        </div>
      )}
      
      <AgentRegistrationForm 
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default RegisterAgentPage; 