import React, { useState, useEffect, useRef } from 'react';

interface SystemPromptEditorProps {
  initialPrompt?: string;
  onChange: (prompt: string) => void;
  error?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  description?: string;
}

interface ExamplePrompt {
  title: string;
  description: string;
  prompt: string;
}

/**
 * Component for editing system prompts with templates
 */
const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  initialPrompt = '',
  onChange,
  error
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showExamples, setShowExamples] = useState(false);
  // Store previous initialPrompt to detect changes
  const prevInitialPromptRef = useRef(initialPrompt);
  // Track internal changes to avoid update loops
  const isInternalChangeRef = useRef(false);

  // Available templates
  const templates: PromptTemplate[] = [
    {
      id: 'general-assistant',
      name: 'General Assistant',
      description: 'Standard helpful assistant that responds to user queries',
      prompt: 'You are a helpful, intelligent, and versatile assistant. You provide accurate, informative, and helpful responses to user queries while avoiding harmful, misleading, or unethical content. You maintain a respectful and professional tone, adapting to the user\'s needs, and admitting when you don\'t know something rather than making up information.'
    },
    {
      id: 'chloe',
      name: 'Chloe (Marketing CMO)',
      description: 'Marketing expert focused on growth strategies',
      prompt: 'You are Chloe, Chief Marketing Officer (CMO) of Crowd Wisdom, focused on early-to-mid stage growth strategies with limited resources. You specialize in helping startups scale from 0 to 100k monthly active users through innovative, cost-effective approaches. Your expertise covers growth marketing, viral loops, content strategy, and user acquisition. You communicate with a blend of professional expertise and approachable warmth, presenting marketing concepts clearly without unnecessary jargon. You are direct about what strategies will work, while remaining supportive and encouraging. You prefer data-backed marketing approaches but recognize the value of creative experimentation, focusing on measurable outcomes and ROI. You excel at finding high-leverage, low-cost growth opportunities.'
    },
    {
      id: 'developer',
      name: 'Developer',
      description: 'Software developer focused on coding and technical problems',
      prompt: 'You are an expert software developer with deep knowledge across multiple programming languages, frameworks, and software development practices. Your primary goal is to help with coding problems, architecture decisions, debugging, and explaining technical concepts. You provide clear, well-commented code examples when appropriate, and explain complex technical concepts in an accessible way without oversimplifying. You follow best practices including clean code principles, appropriate design patterns, and security considerations. When you don\'t know something, you clearly indicate this rather than guessing. You focus on practical, implementable solutions rather than theoretical ideals when helping with real-world development problems.'
    },
    {
      id: 'researcher',
      name: 'Researcher',
      description: 'Academic researcher focused on thorough analysis',
      prompt: 'You are a highly skilled research assistant with expertise across multiple academic disciplines. Your primary function is to help with research-related tasks including literature reviews, methodology development, data analysis, and academic writing. You maintain high standards of academic integrity, providing balanced perspectives on complex topics and citing reputable sources where possible. You excel at breaking down complex research questions into manageable components, suggesting appropriate methodologies, and synthesizing information from diverse sources. You communicate with precision and clarity, avoiding unnecessary jargon while maintaining technical accuracy. You acknowledge limitations in current research and highlight areas where more investigation is needed.'
    }
  ];

  // Example prompts for custom agents
  const examplePrompts: ExamplePrompt[] = [
    {
      title: "Basic Task-Oriented Assistant",
      description: "A simple framework for a focused assistant with clear boundaries",
      prompt: `You are a helpful assistant with expertise in [SPECIFIC DOMAIN].
Your primary goal is to [MAIN OBJECTIVE].

When interacting with users:
- Prioritize clarity and accuracy in your responses
- Focus on providing practical, actionable information
- Acknowledge when you don't know something rather than guessing
- Maintain a [TONE: professional/friendly/technical] communication style

Your expertise includes: [LIST SPECIFIC KNOWLEDGE AREAS]
You should avoid: [LIST BOUNDARIES OR LIMITATIONS]`
    },
    {
      title: "Expert Professional Persona",
      description: "Detailed prompt for creating a specialized professional agent",
      prompt: `You are [NAME], a [PROFESSION] with [X YEARS] of experience in [INDUSTRY/FIELD].

EXPERTISE:
- Deep knowledge of [SPECIFIC AREA 1]
- Specialized understanding of [SPECIFIC AREA 2]
- Practical experience with [SPECIFIC AREA 3]

COMMUNICATION STYLE:
- You communicate in a [TONE: authoritative but approachable/technical but clear/etc.]
- You explain complex concepts by [APPROACH TO EXPLANATIONS]
- When appropriate, you use [METAPHORS/EXAMPLES/CASE STUDIES] to illustrate points

APPROACH:
- When giving advice, you consider [KEY FACTORS]
- You prioritize [SPECIFIC VALUES OR PRINCIPLES]
- You acknowledge limitations by [HOW TO HANDLE UNCERTAINTY]

BOUNDARIES:
- You do not provide [TYPE OF ADVICE TO AVOID]
- When asked about topics outside your expertise, you [HOW TO RESPOND]`
    },
    {
      title: "Specialized Tool Agent",
      description: "Prompt for an agent designed to help with specific tools or processes",
      prompt: `You are a specialized assistant focused on helping users with [SPECIFIC TOOL/PROCESS/METHODOLOGY].

Your primary functions are:
1. Guiding users through [SPECIFIC PROCESSES]
2. Troubleshooting common issues with [TOOL/SYSTEM]
3. Providing best practices for [SPECIFIC USE CASES]

When helping users:
- Ask clarifying questions when their requirements are unclear
- Provide step-by-step instructions that are easy to follow
- Include examples of correct usage when relevant
- Offer alternatives when appropriate

You have deep knowledge of:
- [FEATURE/ASPECT 1] and how to leverage it effectively
- [FEATURE/ASPECT 2] including advanced configurations
- Common pitfalls and how to avoid them

You should reference official documentation when appropriate, but translate technical concepts into practical advice.`
    }
  ];

  // Update prompt when initialPrompt changes from parent
  useEffect(() => {
    if (initialPrompt !== prevInitialPromptRef.current) {
      isInternalChangeRef.current = true;
      setPrompt(initialPrompt);
      prevInitialPromptRef.current = initialPrompt;
    }
  }, [initialPrompt]);

  // Update parent when prompt changes, but only if it's from user input
  useEffect(() => {
    if (prompt !== prevInitialPromptRef.current && !isInternalChangeRef.current) {
      onChange(prompt);
    }
    isInternalChangeRef.current = false;
  }, [prompt, onChange]);

  // Load a template
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    
    if (!templateId) return;
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setPrompt(template.prompt);
      // Update ref to prevent onChange from being called
      prevInitialPromptRef.current = template.prompt;
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPrompt(content);
      // Update ref to prevent onChange from being called
      prevInitialPromptRef.current = content;
    };
    
    reader.readAsText(file);
  };

  // Copy example prompt to clipboard and to editor
  const copyExamplePrompt = (examplePrompt: string) => {
    navigator.clipboard.writeText(examplePrompt).then(() => {
      setPrompt(examplePrompt);
      // Update ref to prevent onChange from being called
      prevInitialPromptRef.current = examplePrompt;
    });
  };

  // Handle direct textarea changes
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
      
      {/* Template Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Prompt Template</label>
        <select 
          value={selectedTemplate}
          onChange={handleTemplateChange}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2"
        >
          <option value="">Custom Prompt</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        
        {selectedTemplate && (
          <p className="mt-1 text-sm text-gray-400">
            {templates.find(t => t.id === selectedTemplate)?.description}
          </p>
        )}
        
        {/* Link to examples when custom prompt is selected */}
        {!selectedTemplate && (
          <button 
            onClick={() => setShowExamples(!showExamples)}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300 flex items-center"
          >
            {showExamples ? 'Hide Example Prompts' : 'Show Example Prompts'} 
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`ml-1 h-4 w-4 transition-transform ${showExamples ? 'rotate-180' : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Example Prompts Section */}
      {showExamples && (
        <div className="mb-6 space-y-4">
          <h3 className="text-md font-medium">Example Prompt Templates</h3>
          <p className="text-sm text-gray-400">
            Select any example below to use as a starting point for your custom agent.
          </p>
          
          <div className="space-y-3">
            {examplePrompts.map((example, index) => (
              <div key={index} className="bg-gray-700 p-3 rounded border border-gray-600">
                <div className="flex justify-between">
                  <h4 className="font-medium text-sm">{example.title}</h4>
                  <button 
                    onClick={() => copyExamplePrompt(example.prompt)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                  >
                    Use This Template
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">{example.description}</p>
                <div className="mt-2 text-xs bg-gray-800 p-2 rounded max-h-24 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-gray-300">{example.prompt}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Prompt Editor */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">System Prompt</label>
          <span className="text-xs text-gray-400">{prompt.length} characters</span>
        </div>
        <textarea
          value={prompt}
          onChange={handlePromptChange}
          placeholder="Enter the system prompt that defines the agent's behavior and capabilities..."
          className={`w-full bg-gray-700 border ${error ? 'border-red-500' : 'border-gray-600'} rounded p-3 font-mono text-sm min-h-[200px]`}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
      
      {/* File Upload */}
      <div className="mb-4">
        <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded cursor-pointer">
          Upload Prompt File
          <input 
            type="file" 
            className="hidden" 
            accept=".txt,.md"
            onChange={handleFileUpload}
          />
        </label>
        <span className="text-xs text-gray-400 ml-2">Upload a text file with your system prompt</span>
      </div>
      
      {/* Preview Toggle */}
      <div className="mb-4">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>
      
      {/* Preview */}
      {showPreview && (
        <div className="border border-gray-700 rounded p-4 bg-gray-900">
          <h3 className="text-md font-medium mb-2">Preview:</h3>
          <div className="text-sm whitespace-pre-wrap">
            {prompt || 'No system prompt provided yet'}
          </div>
        </div>
      )}
      
      {/* Best Practices */}
      <div className="mt-6 bg-gray-700 p-4 rounded">
        <h3 className="text-md font-medium mb-2">System Prompt Best Practices</h3>
        <ul className="text-sm space-y-1 text-gray-300">
          <li>• Clearly define the agent's role, expertise, and limitations</li>
          <li>• Specify communication style and tone</li>
          <li>• Include important constraints or ethical guidelines</li>
          <li>• Keep prompts concise but informative</li>
          <li>• Include examples of ideal responses when helpful</li>
        </ul>
      </div>
    </div>
  );
};

export default SystemPromptEditor; 