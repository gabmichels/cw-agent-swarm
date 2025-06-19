import React, { useState, useEffect } from 'react';
import { AgentProfile } from '@/lib/multi-agent/types/agent';
import SystemPromptEditor from './SystemPromptEditor';
import AgentPersonaForm from './AgentPersonaForm';

interface PersonaData {
  background: string;
  personality: string;
  communicationStyle: string;
  preferences: string;
}

interface AgentPromptEditorProps {
  agent: AgentProfile;
  onAgentUpdate: (updatedAgent: AgentProfile) => void;
  isEditing: boolean;
  onEditingChange: (editing: boolean) => void;
}

const AgentPromptEditor: React.FC<AgentPromptEditorProps> = ({
  agent,
  onAgentUpdate,
  isEditing,
  onEditingChange
}) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [personaData, setPersonaData] = useState<PersonaData>({
    background: '',
    personality: '',
    communicationStyle: '',
    preferences: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize data from agent when component mounts or agent changes
  useEffect(() => {
    if (agent) {
      // Get system prompt directly from parameters.systemPrompt
      const systemPromptText = agent.parameters?.systemPrompt || '';
      setSystemPrompt(systemPromptText);
      
      // Get persona data from metadata.persona
      const persona = agent.metadata?.persona;
      if (persona) {
        setPersonaData({
          background: persona.background || '',
          personality: persona.personality || '',
          communicationStyle: persona.communicationStyle || '',
          preferences: persona.preferences || ''
        });
      } else {
        // Initialize empty persona if none exists
        setPersonaData({
          background: '',
          personality: '',
          communicationStyle: '',
          preferences: ''
        });
      }
    }
  }, [agent]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Prepare clean updated parameters
      const updatedParameters = {
        ...agent.parameters,
        systemPrompt: systemPrompt.trim()
      };

      // Prepare updated metadata with persona
      const updatedMetadata = {
        ...agent.metadata,
        persona: {
          background: personaData.background.trim(),
          personality: personaData.personality.trim(),
          communicationStyle: personaData.communicationStyle.trim(),
          preferences: personaData.preferences.trim()
        }
      };

      // Create updated agent
      const updatedAgent: AgentProfile = {
        ...agent,
        parameters: updatedParameters,
        metadata: updatedMetadata
      };

      // Call the API to update the agent
      const response = await fetch(`/api/multi-agent/agents/${agent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedAgent),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update agent');
      }

      const responseData = await response.json();
      
      // Update the agent with the response data
      onAgentUpdate(responseData.agent);
      onEditingChange(false);
      
      console.log('Successfully saved agent prompt and persona updates');
      
    } catch (error) {
      console.error('Error saving agent updates:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save updates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditing = () => {
    // Reset to original values
    const systemPromptText = agent.parameters?.systemPrompt || '';
    setSystemPrompt(systemPromptText);

    // Reset persona data
    const persona = agent.metadata?.persona;
    if (persona) {
      setPersonaData({
        background: persona.background || '',
        personality: persona.personality || '',
        communicationStyle: persona.communicationStyle || '',
        preferences: persona.preferences || ''
      });
    } else {
      setPersonaData({
        background: '',
        personality: '',
        communicationStyle: '',
        preferences: ''
      });
    }

    onEditingChange(false);
    setSaveError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Edit/Save buttons */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Prompts & Persona</h2>
        
        {!isEditing ? (
          <button
            onClick={() => onEditingChange(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleCancelEditing}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {saveError && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          Error: {saveError}
        </div>
      )}

      {/* Content */}
      {!isEditing ? (
        <div className="space-y-6">
          {/* System Prompt Display */}
          <div>
            <h3 className="text-lg font-medium mb-3">System Prompt</h3>
            <div className="bg-gray-700 p-4 rounded">
              {systemPrompt ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-300 font-mono">
                  {systemPrompt}
                </pre>
              ) : (
                <p className="text-gray-400 italic">No system prompt configured</p>
              )}
            </div>
          </div>

          {/* Persona Display */}
          <div>
            <h3 className="text-lg font-medium mb-3">Persona</h3>
            <div className="bg-gray-700 p-4 rounded space-y-4">
              <div>
                <span className="text-gray-400 text-sm block mb-1">Background</span>
                <p className="text-gray-300 text-sm">
                  {personaData.background || 'No background specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm block mb-1">Personality</span>
                <p className="text-gray-300 text-sm">
                  {personaData.personality || 'No personality specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm block mb-1">Communication Style</span>
                <p className="text-gray-300 text-sm">
                  {personaData.communicationStyle || 'No communication style specified'}
                </p>
              </div>
              <div>
                <span className="text-gray-400 text-sm block mb-1">Preferences</span>
                <p className="text-gray-300 text-sm">
                  {personaData.preferences || 'No preferences specified'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Prompt Editor */}
          <div>
            <h3 className="text-lg font-medium mb-3">System Prompt</h3>
            <SystemPromptEditor
              initialPrompt={systemPrompt}
              onChange={setSystemPrompt}
            />
          </div>

          {/* Persona Editor */}
          <div>
            <h3 className="text-lg font-medium mb-3">Persona</h3>
            <AgentPersonaForm
              initialBackground={personaData.background}
              initialPersonality={personaData.personality}
              initialCommunicationStyle={personaData.communicationStyle}
              initialPreferences={personaData.preferences}
              onChange={setPersonaData}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentPromptEditor; 