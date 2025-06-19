import React, { useState } from 'react';
import { AgentProfile } from '@/lib/multi-agent/types/agent';

interface AgentDataDebuggerProps {
  agent: AgentProfile;
}

const AgentDataDebugger: React.FC<AgentDataDebuggerProps> = ({ agent }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check the current data structure
  const currentStructure = {
    hasSystemPrompt: !!agent.parameters?.systemPrompt,
    hasStructuredPersona: !!agent.metadata?.persona,
    systemPromptLength: agent.parameters?.systemPrompt?.length || 0,
    personaFields: agent.metadata?.persona ? Object.keys(agent.metadata.persona).filter(key => 
      agent.metadata?.persona?.[key as keyof typeof agent.metadata.persona]
    ) : []
  };

  const isCleanStructure = currentStructure.hasSystemPrompt || currentStructure.hasStructuredPersona;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-green-400 flex items-center">
          ✅ Clean Data Structure
          {isCleanStructure && (
            <span className="ml-2 text-sm bg-green-900 text-green-300 px-2 py-1 rounded">
              Migrated
            </span>
          )}
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-300 text-sm"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      <div className="mt-2 text-sm text-gray-300">
        Using modern structure: <code>parameters.systemPrompt</code> and <code>metadata.persona</code>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Current Structure */}
          <div>
            <h4 className="font-medium text-green-400 mb-2">✅ Current Structure</h4>
            <div className="bg-gray-900 p-3 rounded space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">System Prompt:</span>
                <span className="text-green-400">
                  {currentStructure.hasSystemPrompt 
                    ? `${currentStructure.systemPromptLength} chars`
                    : 'Not configured'
                  }
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Structured Persona:</span>
                <span className="text-green-400">
                  {currentStructure.hasStructuredPersona 
                    ? `${currentStructure.personaFields.length} fields: ${currentStructure.personaFields.join(', ')}`
                    : 'Not configured'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Structured Persona Details */}
          {currentStructure.hasStructuredPersona && (
            <div>
              <h4 className="font-medium text-blue-400 mb-2">📝 Persona Data</h4>
              <div className="bg-gray-900 p-3 rounded space-y-2">
                {agent.metadata?.persona && Object.entries(agent.metadata.persona).map(([key, value]) => (
                  value && (
                    <div key={key} className="space-y-1">
                      <span className="text-gray-400 text-xs uppercase tracking-wide">{key}</span>
                      <div className="text-gray-300 text-sm bg-gray-800 p-2 rounded">
                        {String(value).substring(0, 100)}
                        {String(value).length > 100 && '...'}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Architecture Info */}
          <div>
            <h4 className="font-medium text-blue-400 mb-2">🏗️ Architecture Benefits</h4>
            <div className="bg-gray-900 p-3 rounded">
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• <strong>Clean separation:</strong> System prompt in parameters, persona in metadata</li>
                <li>• <strong>Structured data:</strong> No more concatenated strings</li>
                <li>• <strong>Type safety:</strong> Proper TypeScript interfaces</li>
                <li>• <strong>API efficiency:</strong> No duplicate or legacy fields</li>
                <li>• <strong>Maintainable:</strong> Easy to extend and modify</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDataDebugger; 