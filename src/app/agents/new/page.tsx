'use client';

import { useState } from 'react';
import { MCPRuntime } from '@/agents/mcp/MCPRuntime';
import { AgentSuggestion } from '@/agents/chloe/systems/AgentGenerator';
import { useRouter } from 'next/navigation';
import fs from 'fs/promises';
import path from 'path';

export default function AgentCreationPage() {
  const router = useRouter();
  const [form, setForm] = useState<AgentSuggestion>({
    id: '',
    name: '',
    reason: '',
    capabilities: [],
    roles: [],
    persona: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (field: keyof AgentSuggestion, value: string | string[]) => {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleChangeArray = (field: 'capabilities' | 'roles', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(Boolean);
    handleChange(field, items);
  };

  const handleSubmit = async () => {
    // Reset states
    setError(null);
    setSuccess(null);
    setCopied(false);

    // Validate form
    if (!form.id || !form.name || !form.persona || form.capabilities.length === 0) {
      setError("Please fill all required fields (ID, Name, Persona, and at least one Capability)");
      return;
    }

    // Generate agent manifest markdown
    const mdConfig = generateAgentManifest(form);

    try {
      // Register agent to MCP
      MCPRuntime.registerAgent({
        id: form.id,
        name: form.name,
        capabilities: form.capabilities,
        roles: form.roles,
        tags: [],
        execute: async () => ({ success: false, error: 'Unimplemented' })
      });

      // Try to save the file (may not work in browser context)
      try {
        const agentDir = `src/agents/subagents/${form.id}`;
        // This will only work in a Node.js context, not in browser
        await fs.mkdir(path.join(process.cwd(), agentDir), { recursive: true });
        await fs.writeFile(
          path.join(process.cwd(), agentDir, 'AgentManifest.md'),
          mdConfig
        );
        
        setSuccess(`Agent ${form.name} created and registered! Manifest saved to ${agentDir}/AgentManifest.md`);
      } catch (e) {
        // Browser fallback - offer to copy to clipboard
        copyToClipboard(mdConfig);
        setCopied(true);
        setSuccess(`Agent ${form.name} registered with MCP! Manifest copied to clipboard.`);
      }
    } catch (e) {
      setError(`Error creating agent: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const generateAgentManifest = (agent: AgentSuggestion): string => {
    return `# ${agent.name}
**ID**: ${agent.id}  
**Persona**: ${agent.persona}  
**Capabilities**: ${agent.capabilities.join(', ')}  
**Roles**: ${agent.roles.join(', ')}  
${agent.reason ? `**Reason for Creation**: ${agent.reason}` : ''}

## Implementation Notes
This agent was auto-generated and needs implementation logic.

\`\`\`typescript
// Example implementation in src/agents/subagents/${agent.id}/index.ts
import { SubAgent } from '@/agents/mcp/MCPRuntime';

export const ${form.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}Agent: SubAgent = {
  id: "${agent.id}",
  name: "${agent.name}",
  capabilities: ${JSON.stringify(agent.capabilities)},
  roles: ${JSON.stringify(agent.roles)},
  execute: async (task) => {
    // TODO: Implement agent logic
    return {
      success: true,
      data: "Not yet implemented"
    };
  }
};
\`\`\`
`;
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .catch(err => console.error('Failed to copy: ', err));
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Could not copy text: ', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">🛠️ Create New Agent</h1>
      
      {error && (
        <div className="p-3 mb-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-3 mb-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 rounded-md">
          {success}
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Agent ID*
          </label>
          <input 
            type="text"
            placeholder="agent-id-in-kebab-case"
            value={form.id}
            onChange={(e) => handleChange('id', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name*
          </label>
          <input 
            type="text"
            placeholder="Agent display name"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Persona*
          </label>
          <textarea 
            placeholder="Describe the agent's personality and behavior"
            value={form.persona}
            onChange={(e) => handleChange('persona', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Capabilities* (comma-separated)
          </label>
          <input 
            type="text"
            placeholder="e.g., code-generation,data-analysis,planning"
            value={form.capabilities.join(',')}
            onChange={(e) => handleChangeArray('capabilities', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Roles (comma-separated)
          </label>
          <input 
            type="text"
            placeholder="e.g., specialist,assistant,planner"
            value={form.roles.join(',')}
            onChange={(e) => handleChangeArray('roles', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Reason for Creation
          </label>
          <textarea 
            placeholder="Why this agent is needed"
            value={form.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="pt-4">
          <button 
            onClick={handleSubmit}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Create & Register Agent
          </button>
        </div>
        
        {copied && (
          <div className="mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-md">
            <p className="font-medium">Agent Manifest copied to clipboard!</p>
            <p className="text-sm">
              Paste the manifest into src/agents/subagents/{form.id}/AgentManifest.md
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 