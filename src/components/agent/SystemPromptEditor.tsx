import React, { useState, useEffect, useRef } from 'react';

interface SystemPromptEditorProps {
  initialPrompt?: string;
  onChange: (prompt: string) => void;
}

interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  description?: string;
}

/**
 * Component for editing system prompts with templates
 */
const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  initialPrompt = '',
  onChange
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  // Store previous initialPrompt to detect changes
  const prevInitialPromptRef = useRef(initialPrompt);

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

  // Update initialPrompt when it changes from parent
  useEffect(() => {
    if (initialPrompt !== prevInitialPromptRef.current) {
      setPrompt(initialPrompt);
      prevInitialPromptRef.current = initialPrompt;
    }
  }, [initialPrompt]);

  // Update parent when prompt changes, but only if different from initialPrompt
  useEffect(() => {
    // Only call onChange if prompt actually differs from the initialPrompt
    // This prevents infinite update loops
    if (prompt !== prevInitialPromptRef.current) {
      onChange(prompt);
    }
  }, [prompt, onChange]);

  // Load a template
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    
    if (!templateId) return;
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setPrompt(template.prompt);
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
    };
    
    reader.readAsText(file);
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
      </div>
      
      {/* Prompt Editor */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">System Prompt</label>
          <span className="text-xs text-gray-400">{prompt.length} characters</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter the system prompt that defines the agent's behavior and capabilities..."
          className="w-full bg-gray-700 border border-gray-600 rounded p-3 font-mono text-sm min-h-[200px]"
        />
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