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
    <div className="py-8 px-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold mb-2">Register New Agent</h1>
        <p className="text-gray-300 text-lg">
          Create a new agent profile in 4 simple steps. Define the agent&apos;s basic information, 
          persona, knowledge, and capabilities.
        </p>
        <p className="text-gray-400 mt-2">
          Your progress is automatically saved so you can come back and continue later.
        </p>
      </div>
      
      {error && (
        <div className="wizard-alert wizard-alert-danger max-w-4xl mx-auto mb-6">
          <p className="font-bold">Registration Failed</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="pb-20">
        <AgentRegistrationForm 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
};

export default RegisterAgentPage; 