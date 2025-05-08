import React, { useState } from 'react';

interface AgentPersonaFormProps {
  initialBackground?: string;
  initialPersonality?: string;
  initialCommunicationStyle?: string;
  initialPreferences?: string;
  onChange: (personaData: {
    background: string;
    personality: string;
    communicationStyle: string;
    preferences: string;
  }) => void;
}

/**
 * Component for configuring an agent's persona
 * Uses a memory-based approach where text fields become critical memories
 */
const AgentPersonaForm: React.FC<AgentPersonaFormProps> = ({
  initialBackground = '',
  initialPersonality = '',
  initialCommunicationStyle = '',
  initialPreferences = '',
  onChange
}) => {
  const [background, setBackground] = useState(initialBackground);
  const [personality, setPersonality] = useState(initialPersonality);
  const [communicationStyle, setCommunicationStyle] = useState(initialCommunicationStyle);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Update parent component when form data changes
  const handleChange = () => {
    onChange({
      background,
      personality,
      communicationStyle,
      preferences
    });
  };

  // Generate a simple memory ID for preview purposes
  const generateId = (prefix: string): string => {
    return `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
  };

  // Templates for quick persona configuration
  const templates = {
    professional: {
      background: 'I am an experienced professional with expertise in my field. I have a wealth of knowledge and practical experience that informs my approach to problem-solving.',
      personality: 'I am analytical, precise, and thorough. I value accuracy and reliability in all communications. I am focused on delivering results and providing clear, factual information.',
      communicationStyle: 'I communicate in a direct, clear, and professional manner. I prefer concise, well-structured information and respond with carefully considered insights. I use formal language and maintain a respectful tone.',
      preferences: 'I prefer structured approaches to problems, with clear goals and parameters. I value data-driven decision making and logical reasoning. I am comfortable deep-diving into technical details when needed.'
    },
    friendly: {
      background: 'I am a friendly, approachable assistant with a diverse knowledge base. I enjoy helping people find solutions and learning about new topics.',
      personality: 'I am warm, empathetic, and patient. I have a positive outlook and enjoy engaging with people in a conversational way. I am adaptable and responsive to the needs of others.',
      communicationStyle: 'I communicate in a friendly, conversational tone. I use accessible language and avoid unnecessary jargon. I am encouraging and supportive, with a touch of appropriate humor when the situation allows.',
      preferences: 'I prefer collaborative approaches and enjoy building rapport. I aim to make complex information accessible and engaging. I try to balance thoroughness with clarity and conciseness.'
    },
    chloe: {
      background: 'I am Chloe, the Chief Marketing Officer (CMO) of Crowd Wisdom, focused on early-to-mid stage growth strategies with limited resources. I specialize in helping startups scale from 0 to 100k monthly active users through innovative, cost-effective approaches.',
      personality: 'I am creative, strategic, and results-oriented. I balance analytical thinking with intuitive insights about market trends and user psychology. I am enthusiastic about growth opportunities and confident in my marketing expertise, while remaining adaptable to new information.',
      communicationStyle: 'I communicate with a blend of professional expertise and approachable warmth. I present marketing concepts clearly without unnecessary jargon, though I can dive into technical details when appropriate. I am direct about what strategies will work and which won\'t, while remaining supportive and encouraging.',
      preferences: 'I prefer data-backed marketing approaches but recognize the value of creative experimentation. I focus on measurable outcomes and ROI. I excel at finding high-leverage, low-cost growth opportunities and creating sustainable user acquisition systems rather than one-off campaigns.'
    }
  };

  // Load a template
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const template = e.target.value;
    setSelectedTemplate(template);
    
    if (template && template in templates) {
      const templateData = templates[template as keyof typeof templates];
      setBackground(templateData.background);
      setPersonality(templateData.personality);
      setCommunicationStyle(templateData.communicationStyle);
      setPreferences(templateData.preferences);
      
      // Notify parent component
      onChange(templateData);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'background' | 'personality' | 'communicationStyle' | 'preferences') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      
      switch (field) {
        case 'background':
          setBackground(content);
          break;
        case 'personality':
          setPersonality(content);
          break;
        case 'communicationStyle':
          setCommunicationStyle(content);
          break;
        case 'preferences':
          setPreferences(content);
          break;
      }
      
      // Update parent with new data
      onChange({
        background: field === 'background' ? content : background,
        personality: field === 'personality' ? content : personality,
        communicationStyle: field === 'communicationStyle' ? content : communicationStyle,
        preferences: field === 'preferences' ? content : preferences
      });
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">Agent Persona</h2>
      
      {/* Persona Template Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Persona Template</label>
        <select 
          value={selectedTemplate} 
          onChange={handleTemplateChange}
          className="w-full bg-gray-700 border border-gray-600 rounded p-2"
        >
          <option value="">Custom Persona</option>
          <option value="professional">Professional Expert</option>
          <option value="friendly">Friendly Assistant</option>
          <option value="chloe">Chloe (Marketing CMO)</option>
        </select>
      </div>
      
      {/* Background Field */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">Background & Role</label>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
            <span className="text-xs text-gray-400">Critical Memory</span>
          </div>
        </div>
        <textarea
          value={background}
          onChange={(e) => {
            setBackground(e.target.value);
            handleChange();
          }}
          placeholder="Describe the agent's background, role, and expertise..."
          className="w-full bg-gray-700 border border-gray-600 rounded p-3 min-h-[100px]"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">What is the agent's background, experience, and role?</span>
          <span className="text-xs text-gray-400">{background.length} chars</span>
        </div>
        
        <div className="mt-2">
          <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded cursor-pointer">
            Upload File
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.md"
              onChange={(e) => handleFileUpload(e, 'background')} 
            />
          </label>
        </div>
      </div>
      
      {/* Personality Traits Field */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">Personality Traits</label>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
            <span className="text-xs text-gray-400">Critical Memory</span>
          </div>
        </div>
        <textarea
          value={personality}
          onChange={(e) => {
            setPersonality(e.target.value);
            handleChange();
          }}
          placeholder="Describe the agent's personality traits, character, and temperament..."
          className="w-full bg-gray-700 border border-gray-600 rounded p-3 min-h-[100px]"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">How would you describe the agent's character and personality?</span>
          <span className="text-xs text-gray-400">{personality.length} chars</span>
        </div>
        
        <div className="mt-2">
          <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded cursor-pointer">
            Upload File
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.md"
              onChange={(e) => handleFileUpload(e, 'personality')} 
            />
          </label>
        </div>
      </div>
      
      {/* Communication Style Field */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">Communication Style</label>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
            <span className="text-xs text-gray-400">Critical Memory</span>
          </div>
        </div>
        <textarea
          value={communicationStyle}
          onChange={(e) => {
            setCommunicationStyle(e.target.value);
            handleChange();
          }}
          placeholder="Describe how the agent communicates, their tone, language style..."
          className="w-full bg-gray-700 border border-gray-600 rounded p-3 min-h-[100px]"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">How does the agent communicate? Formal/casual? Verbose/concise?</span>
          <span className="text-xs text-gray-400">{communicationStyle.length} chars</span>
        </div>
        
        <div className="mt-2">
          <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded cursor-pointer">
            Upload File
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.md"
              onChange={(e) => handleFileUpload(e, 'communicationStyle')} 
            />
          </label>
        </div>
      </div>
      
      {/* Preferences Field */}
      <div className="mb-6">
        <div className="flex justify-between mb-1">
          <label className="block text-sm font-medium">Preferences & Biases</label>
          <div className="flex items-center">
            <div className="h-2 w-2 rounded-full bg-amber-500 mr-1"></div>
            <span className="text-xs text-gray-400">Important Memory</span>
          </div>
        </div>
        <textarea
          value={preferences}
          onChange={(e) => {
            setPreferences(e.target.value);
            handleChange();
          }}
          placeholder="Describe the agent's preferences, biases, and tendencies..."
          className="w-full bg-gray-700 border border-gray-600 rounded p-3 min-h-[100px]"
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">What approaches does the agent prefer or tend toward?</span>
          <span className="text-xs text-gray-400">{preferences.length} chars</span>
        </div>
        
        <div className="mt-2">
          <label className="text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded cursor-pointer">
            Upload File
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.md"
              onChange={(e) => handleFileUpload(e, 'preferences')} 
            />
          </label>
        </div>
      </div>
      
      {/* Memory Preview */}
      <div>
        <h3 className="text-md font-medium mb-2">How Agent Will Process This Information</h3>
        <div className="bg-gray-700 border border-gray-600 rounded p-3 text-xs font-mono">
          <div className="mb-2">
            <span className="text-pink-400">// Critical Memory: Background & Role</span><br/>
            <span className="text-gray-200">memoryId: "{generateId('background')}"</span><br/>
            <span className="text-gray-200">importance: "critical"</span><br/>
            <span className="text-gray-200">tags: ["personality", "background", "core"]</span><br/>
            <span className="text-gray-200">content: "{background.substring(0, 50)}..."</span>
          </div>
          <div className="mb-2">
            <span className="text-pink-400">// Critical Memory: Personality Traits</span><br/>
            <span className="text-gray-200">memoryId: "{generateId('personality')}"</span><br/>
            <span className="text-gray-200">importance: "critical"</span><br/>
            <span className="text-gray-200">tags: ["personality", "traits", "core"]</span><br/>
            <span className="text-gray-200">content: "{personality.substring(0, 50)}..."</span>
          </div>
          <div className="mb-2">
            <span className="text-pink-400">// Critical Memory: Communication Style</span><br/>
            <span className="text-gray-200">memoryId: "{generateId('communication')}"</span><br/>
            <span className="text-gray-200">importance: "critical"</span><br/>
            <span className="text-gray-200">tags: ["personality", "communication", "core"]</span><br/>
            <span className="text-gray-200">content: "{communicationStyle.substring(0, 50)}..."</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPersonaForm; 