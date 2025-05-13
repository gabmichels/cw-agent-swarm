import React, { useState } from 'react';
import { AgentType, AgentMode } from '../../constants/agent';
import { CapabilityLevel } from '../../agents/shared/capability-system';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: AgentType;
  mode: AgentMode;
  systemPrompt: string;
  capabilities: {
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags: string[];
  };
  parameters: {
    model: string;
    temperature: number;
    maxTokens: number;
    tools: string[];
  };
  metadata: {
    background?: string;
    personality?: string;
    communicationStyle?: string;
  };
}

// Built-in templates
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    description: 'A versatile assistant that can help with a wide range of tasks.',
    type: AgentType.ASSISTANT,
    mode: AgentMode.SUPERVISED,
    systemPrompt: 'You are a helpful, intelligent, and versatile assistant. You provide accurate, informative, and helpful responses to user queries while avoiding harmful, misleading, or unethical content. You maintain a respectful and professional tone, adapting to the user\'s needs, and admitting when you don\'t know something rather than making up information.',
    capabilities: {
      skills: {
        'skill.problem_solving': CapabilityLevel.ADVANCED,
        'skill.creative_thinking': CapabilityLevel.INTERMEDIATE,
        'skill.research': CapabilityLevel.INTERMEDIATE,
        'skill.communication': CapabilityLevel.ADVANCED
      },
      domains: ['general'],
      roles: ['assistant'],
      tags: ['versatile', 'helpful', 'balanced']
    },
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      tools: []
    },
    metadata: {
      personality: 'Balanced, helpful, and adaptable',
      communicationStyle: 'Clear, concise, and professional'
    }
  },
  {
    id: 'marketing-specialist',
    name: 'Marketing Specialist',
    description: 'A specialized agent focused on marketing strategies and growth tactics.',
    type: AgentType.SPECIALIST,
    mode: AgentMode.COLLABORATIVE,
    systemPrompt: 'You are a marketing specialist with expertise in digital marketing, brand strategy, market research, and growth tactics. You focus on providing actionable advice for businesses looking to grow their audience and increase engagement. Your recommendations are data-driven while recognizing the importance of creative approaches. You communicate clearly without unnecessary jargon and focus on measurable outcomes and ROI.',
    capabilities: {
      skills: {
        'skill.marketing': CapabilityLevel.EXPERT,
        'skill.market_analysis': CapabilityLevel.ADVANCED,
        'skill.content_strategy': CapabilityLevel.ADVANCED,
        'skill.communication': CapabilityLevel.ADVANCED
      },
      domains: ['marketing', 'business'],
      roles: ['specialist', 'advisor'],
      tags: ['marketing', 'growth', 'strategy']
    },
    parameters: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
      tools: []
    },
    metadata: {
      background: 'Marketing expert with focus on growth strategies and digital marketing',
      personality: 'Strategic, creative, data-driven',
      communicationStyle: 'Clear, persuasive, and actionable'
    }
  },
  {
    id: 'developer-agent',
    name: 'Developer Assistant',
    description: 'A specialized agent for software development and technical problem-solving.',
    type: AgentType.SPECIALIST,
    mode: AgentMode.SUPERVISED,
    systemPrompt: 'You are an expert software developer with deep knowledge across multiple programming languages, frameworks, and software development practices. Your primary goal is to help with coding problems, architecture decisions, debugging, and explaining technical concepts. You provide clear, well-commented code examples when appropriate, and explain complex technical concepts in an accessible way without oversimplifying. You follow best practices including clean code principles, appropriate design patterns, and security considerations.',
    capabilities: {
      skills: {
        'skill.programming': CapabilityLevel.EXPERT,
        'skill.problem_solving': CapabilityLevel.EXPERT,
        'skill.debugging': CapabilityLevel.ADVANCED,
        'skill.system_design': CapabilityLevel.ADVANCED
      },
      domains: ['technology', 'software', 'computer science'],
      roles: ['developer', 'advisor'],
      tags: ['technical', 'coding', 'development']
    },
    parameters: {
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 2500,
      tools: []
    },
    metadata: {
      background: 'Software development expert with broad technical knowledge',
      personality: 'Logical, precise, pragmatic',
      communicationStyle: 'Clear, technical yet accessible'
    }
  },
  {
    id: 'research-agent',
    name: 'Research Assistant',
    description: 'A specialized agent focused on research, analysis, and knowledge synthesis.',
    type: AgentType.SPECIALIST,
    mode: AgentMode.COLLABORATIVE,
    systemPrompt: 'You are a highly skilled research assistant with expertise across multiple academic disciplines. Your primary function is to help with research-related tasks including literature reviews, methodology development, data analysis, and academic writing. You maintain high standards of academic integrity, providing balanced perspectives on complex topics and citing reputable sources where possible. You excel at breaking down complex research questions into manageable components, suggesting appropriate methodologies, and synthesizing information from diverse sources.',
    capabilities: {
      skills: {
        'skill.research': CapabilityLevel.EXPERT,
        'skill.critical_thinking': CapabilityLevel.EXPERT,
        'skill.data_analysis': CapabilityLevel.ADVANCED,
        'skill.knowledge_synthesis': CapabilityLevel.ADVANCED
      },
      domains: ['academia', 'research', 'science'],
      roles: ['researcher', 'analyst'],
      tags: ['research', 'analysis', 'academic']
    },
    parameters: {
      model: 'gpt-4',
      temperature: 0.4,
      maxTokens: 3000,
      tools: []
    },
    metadata: {
      background: 'Research specialist with cross-disciplinary expertise',
      personality: 'Analytical, thorough, objective',
      communicationStyle: 'Precise, balanced, well-structured'
    }
  }
];

interface AgentTemplateSelectorProps {
  onChange: (template: AgentTemplate) => void;
  initialTemplateId?: string;
}

const AgentTemplateSelector: React.FC<AgentTemplateSelectorProps> = ({
  onChange,
  initialTemplateId
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>(initialTemplateId || '');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  
  // Find the selected template object
  const selectedTemplateObject = AGENT_TEMPLATES.find(template => template.id === selectedTemplate);
  
  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Find the selected template
    const template = AGENT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      onChange(template);
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">Agent Template</h2>
      <p className="text-sm text-gray-400 mb-4">
        Choose a template to quickly configure your agent with predefined settings
      </p>
      
      {/* Template List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {AGENT_TEMPLATES.map(template => (
          <div 
            key={template.id}
            className={`p-4 border rounded cursor-pointer transition-colors ${
              selectedTemplate === template.id 
                ? 'border-blue-500 bg-gray-700' 
                : 'border-gray-700 bg-gray-800 hover:bg-gray-750'
            }`}
            onClick={() => handleTemplateChange(template.id)}
          >
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-medium">{template.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{template.description}</p>
                <div className="flex flex-wrap mt-2 gap-2">
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                    {template.type}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                    {template.mode}
                  </span>
                  {template.metadata.personality && (
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                      {template.metadata.personality}
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-2">
                <div className={`w-5 h-5 rounded-full ${
                  selectedTemplate === template.id ? 'bg-blue-500' : 'bg-gray-600'
                }`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Template Details Toggle */}
      {selectedTemplateObject && (
        <div className="mt-4 mb-2">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-400 hover:text-blue-300 text-sm flex items-center"
          >
            {showDetails ? 'Hide' : 'Show'} template details
            <svg 
              xmlns="http://www.w3.org/2000/svg"
              className={`ml-1 w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Template Details */}
      {selectedTemplateObject && showDetails && (
        <div className="mt-4 p-4 bg-gray-700 rounded">
          <h3 className="font-medium mb-3">{selectedTemplateObject.name} Details</h3>
          
          <div className="space-y-4">
            {/* System Prompt Preview */}
            <div>
              <h4 className="text-sm font-medium">System Prompt</h4>
              <div className="mt-1 p-3 bg-gray-800 rounded text-sm font-mono text-gray-300 max-h-40 overflow-y-auto">
                {selectedTemplateObject.systemPrompt}
              </div>
            </div>
            
            {/* Capabilities Preview */}
            <div>
              <h4 className="text-sm font-medium">Capabilities</h4>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div>
                  <h5 className="text-xs font-medium text-gray-400">Skills</h5>
                  <ul className="text-xs">
                    {Object.entries(selectedTemplateObject.capabilities.skills).map(([skill, level]) => (
                      <li key={skill} className="my-1">
                        {skill.split('.')[1]}: <span className="text-blue-400">{level}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-gray-400">Domains & Roles</h5>
                  <p className="text-xs">
                    <span className="font-medium">Domains:</span> {selectedTemplateObject.capabilities.domains.join(', ')}
                  </p>
                  <p className="text-xs mt-1">
                    <span className="font-medium">Roles:</span> {selectedTemplateObject.capabilities.roles.join(', ')}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Parameters Preview */}
            <div>
              <h4 className="text-sm font-medium">Parameters</h4>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="font-medium">Model:</span> {selectedTemplateObject.parameters.model}
                </div>
                <div>
                  <span className="font-medium">Temperature:</span> {selectedTemplateObject.parameters.temperature}
                </div>
                <div>
                  <span className="font-medium">Max Tokens:</span> {selectedTemplateObject.parameters.maxTokens}
                </div>
              </div>
            </div>
            
            {/* Personality Preview */}
            <div>
              <h4 className="text-sm font-medium">Personality</h4>
              <div className="mt-1 text-xs">
                {selectedTemplateObject.metadata.background && (
                  <p><span className="font-medium">Background:</span> {selectedTemplateObject.metadata.background}</p>
                )}
                {selectedTemplateObject.metadata.personality && (
                  <p className="mt-1"><span className="font-medium">Personality:</span> {selectedTemplateObject.metadata.personality}</p>
                )}
                {selectedTemplateObject.metadata.communicationStyle && (
                  <p className="mt-1"><span className="font-medium">Communication Style:</span> {selectedTemplateObject.metadata.communicationStyle}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentTemplateSelector;
export { AGENT_TEMPLATES }; 