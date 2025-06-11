import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AgentCapability, AgentRegistrationRequest, AgentParameters, AgentMetadata } from '@/lib/multi-agent/types/agent';
import SystemPromptEditor from './SystemPromptEditor';
import KnowledgeUploader from './KnowledgeUploader';
import AgentPersonaForm from './AgentPersonaForm';
import AgentCapabilityManager from './AgentCapabilityManager';
import AgentTemplateSelector, { AgentTemplate, AGENT_TEMPLATES } from './AgentTemplateSelector';
import ManagerConfigPanel, { AgentManagersConfig } from './ManagerConfigPanel';
import AgentProcessingStatus, { ProcessingLog, ProcessingStep } from './AgentProcessingStatus';
import { CapabilityLevel } from '@/agents/shared/capability-system';
import './wizard.css';
import { AgentStatus } from '@/server/memory/schema/agent';

// Custom extensions to standard types
interface ExtendedAgentParameters extends AgentParameters {
  systemPrompt?: string;
}

interface ExtendedAgentMetadata extends AgentMetadata {
  // Additional metadata fields
  knowledgePaths?: string[];
  persona?: {
    background: string;
    personality: string;
    communicationStyle: string;
    preferences: string;
  };
}

interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  size: number;
  type: string;
  preview?: string;
}

interface PersonaData {
  background: string;
  personality: string;
  communicationStyle: string;
  preferences: string;
}

interface AgentConfig {
  knowledgePaths: string[];
  department?: string;
}

interface AgentRegistrationFormProps {
  onSubmit: (data: AgentRegistrationRequest) => Promise<void>;
  isSubmitting: boolean;
}

// Using our extended types
interface ExtendedAgentRegistrationRequest extends Omit<AgentRegistrationRequest, 'parameters' | 'metadata'> {
  parameters: ExtendedAgentParameters;
  metadata: ExtendedAgentMetadata;
}

// Wizard steps
enum FormStep {
  TEMPLATE = 0,
  INFO_AND_PROMPT = 1,
  PERSONA = 2,
  KNOWLEDGE = 3, 
  CAPABILITIES = 4,
  MANAGERS = 5
}

const STORAGE_KEY = 'agent_registration_form_data';

const AgentRegistrationForm: React.FC<AgentRegistrationFormProps> = ({
  onSubmit,
  isSubmitting
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<FormStep>(FormStep.TEMPLATE);
  
  // Add state to track template selection
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  
  // Use extended type for formData
  const [formData, setFormData] = useState<ExtendedAgentRegistrationRequest>({
    name: '',
    description: '',
    status: AgentStatus.AVAILABLE,
    capabilities: [],
    parameters: {
      model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || '',
      temperature: 0.7,
      maxTokens: 2000,
      tools: []
    },
    metadata: {
      tags: [],
      domain: [],
      specialization: [],
      performanceMetrics: {
        successRate: 0,
        averageResponseTime: 0,
        taskCompletionRate: 0
      },
      version: '1.0',
      isPublic: true
    }
  });

  // Add validation state
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    description?: string;
    systemPrompt?: string;
    capabilities?: string;
  }>({});

  // Form section states
  const [systemPrompt, setSystemPrompt] = useState('');
  const [knowledgeData, setKnowledgeData] = useState<{
    knowledgePaths: string[];
    files: KnowledgeFile[];
  }>({
    knowledgePaths: ['data/knowledge/company', 'data/knowledge/agents/shared'],
    files: []
  });
  const [personaData, setPersonaData] = useState<PersonaData>({
    background: '',
    personality: '',
    communicationStyle: '',
    preferences: ''
  });
  const [agentCapabilities, setAgentCapabilities] = useState<{
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags: string[];
    descriptions?: Record<string, string>;
  }>({
    skills: {},
    domains: [],
    roles: [],
    tags: [],
    descriptions: {}
  });
  
  const [managersConfig, setManagersConfig] = useState<AgentManagersConfig>({
    memoryManager: { enabled: true },
    planningManager: { enabled: true },
    toolManager: { enabled: true },
    knowledgeManager: { enabled: true },
    schedulerManager: { enabled: true }
  });
  
  // Add processing status state
  const [processingLog, setProcessingLog] = useState<ProcessingLog>({
    steps: [
      {
        id: 'validation',
        name: 'Validating Agent Configuration',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'capabilities',
        name: 'Processing Capabilities',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'knowledge',
        name: 'Processing Knowledge Files',
        status: 'pending',
        timestamp: new Date()
      },
      {
        id: 'registration',
        name: 'Registering Agent',
        status: 'pending',
        timestamp: new Date()
      }
    ]
  });

  // Load saved form data from localStorage on initial render
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        
        // Restore main form data
        setFormData(parsedData.formData);
        
        // Restore component-specific states
        if (parsedData.systemPrompt) setSystemPrompt(parsedData.systemPrompt);
        if (parsedData.knowledgeData) setKnowledgeData(parsedData.knowledgeData);
        if (parsedData.personaData) setPersonaData(parsedData.personaData);
        if (parsedData.agentCapabilities) setAgentCapabilities(parsedData.agentCapabilities);
        if (parsedData.managersConfig) setManagersConfig(parsedData.managersConfig);
        if (parsedData.currentStep !== undefined) setCurrentStep(parsedData.currentStep);
      } catch (error) {
        console.error('Error loading saved form data:', error);
      }
    }
  }, []);
  
  // Save form data to localStorage whenever it changes
  useEffect(() => {
    const dataToSave = {
      formData,
      systemPrompt,
      knowledgeData,
      personaData,
      agentCapabilities,
      managersConfig,
      currentStep
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [formData, systemPrompt, knowledgeData, personaData, agentCapabilities, managersConfig, currentStep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle nested properties
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      if (parent === 'parameters') {
        setFormData(prevFormData => ({
          ...prevFormData,
          parameters: {
            ...prevFormData.parameters,
            [child]: value
          }
        }));
      } else if (parent === 'metadata') {
        setFormData(prevFormData => ({
          ...prevFormData,
          metadata: {
            ...prevFormData.metadata,
            [child]: value
          }
        }));
      }
    } else {
      setFormData(prevFormData => ({
        ...prevFormData,
        [name]: value
      }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    
    // Handle nested properties
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      
      if (parent === 'parameters') {
        setFormData(prevFormData => ({
          ...prevFormData,
          parameters: {
            ...prevFormData.parameters,
            [child]: numValue
          }
        }));
      } else if (parent === 'metadata') {
        setFormData(prevFormData => ({
          ...prevFormData,
          metadata: {
            ...prevFormData.metadata,
            [child]: numValue
          }
        }));
      }
    } else {
      setFormData(prevFormData => ({
        ...prevFormData,
        [name]: numValue
      }));
    }
  };

  // Memoize the capability handler
  const handleCapabilityChange = useCallback((capabilities: {
    skills: Record<string, CapabilityLevel>;
    domains: string[];
    roles: string[];
    tags?: string[];
    descriptions?: Record<string, string>;
  }) => {
    // Prevent infinite updates by checking if values actually changed
    const isEqual = (
      JSON.stringify(capabilities.skills) === JSON.stringify(agentCapabilities.skills) &&
      JSON.stringify(capabilities.domains) === JSON.stringify(agentCapabilities.domains) &&
      JSON.stringify(capabilities.roles) === JSON.stringify(agentCapabilities.roles) &&
      JSON.stringify(capabilities.tags) === JSON.stringify(agentCapabilities.tags) &&
      JSON.stringify(capabilities.descriptions) === JSON.stringify(agentCapabilities.descriptions)
    );
    
    // Only update state if capabilities have actually changed
    if (!isEqual) {
      const safeCapabilities = {
        ...capabilities,
        tags: capabilities.tags || [],
        descriptions: capabilities.descriptions || {}
      };
      
      setAgentCapabilities(safeCapabilities);
      
      // Convert capabilities to the format expected by the API with complete information
      const mappedCapabilities: AgentCapability[] = [];
      
      // Add skill capabilities with level information
      Object.entries(safeCapabilities.skills).forEach(([id, level]) => {
        const name = id.split('.').slice(1).join(' ').replace(/_/g, ' ') || id;
        const description = safeCapabilities.descriptions?.[id] || `${name} capability at ${level} level`;
        
        mappedCapabilities.push({
          id,
          name: name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          description: description,
          version: '1.0.0',
          parameters: {
            type: 'skill',
            level: level,
            category: 'skill'
          }
        });
      });
      
      // Add domain capabilities
      safeCapabilities.domains.forEach(domain => {
        const id = `domain.${domain.toLowerCase().replace(/\s+/g, '_')}`;
        const description = safeCapabilities.descriptions?.[id] || `Knowledge and expertise in ${domain}`;
        
        mappedCapabilities.push({
          id,
          name: domain,
          description: description,
          version: '1.0.0',
          parameters: {
            type: 'domain',
            category: 'domain'
          }
        });
      });
      
      // Add role capabilities
      safeCapabilities.roles.forEach(role => {
        const id = `role.${role.toLowerCase().replace(/\s+/g, '_')}`;
        const description = safeCapabilities.descriptions?.[id] || `Ability to function as a ${role}`;
        
        mappedCapabilities.push({
          id,
          name: role,
          description: description,
          version: '1.0.0',
          parameters: {
            type: 'role',
            category: 'role'
          }
        });
      });
      
      // Add tag capabilities
      safeCapabilities.tags?.forEach(tag => {
        const id = `tag.${tag.toLowerCase().replace(/\s+/g, '_')}`;
        const description = safeCapabilities.descriptions?.[id] || `Tagged with ${tag} characteristic`;
        
        mappedCapabilities.push({
          id,
          name: tag,
          description: description,
          version: '1.0.0',
          parameters: {
            type: 'tag',
            category: 'tag'
          }
        });
      });
      
      // Use functional state update to avoid dependency on current formData
      setFormData(prevFormData => ({
        ...prevFormData,
        capabilities: mappedCapabilities,
        metadata: {
          ...prevFormData.metadata,
          domain: safeCapabilities.domains,
          // Don't append roles to existing specialization, replace them
          specialization: safeCapabilities.roles,
          // Don't append tags to existing tags, replace them
          tags: safeCapabilities.tags
        }
      }));
    }
  }, [agentCapabilities]);

  // Handle selecting a template
  const handleTemplateSelect = (template: AgentTemplate) => {
    // Store the selected template
    setSelectedTemplate(template);
    
    // If custom agent template is selected, reset the form to defaults
    if (template.id === 'custom-agent') {
      setFormData({
        name: '',
        description: '',
        status: AgentStatus.AVAILABLE,
        capabilities: [],
        parameters: {
          model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'gpt-4.1-2025-04-14',
          temperature: 0.7,
          maxTokens: 2000,
          tools: []
        },
        metadata: {
          tags: [],
          domain: [],
          specialization: [],
          performanceMetrics: {
            successRate: 0,
            averageResponseTime: 0,
            taskCompletionRate: 0
          },
          version: '1.0',
          isPublic: true
        }
      });

      // Clear system prompt
      setSystemPrompt('');

      // Reset persona data
      setPersonaData({
        background: '',
        personality: '',
        communicationStyle: '',
        preferences: ''
      });

      // Reset capabilities
      setAgentCapabilities({
        skills: {},
        domains: [],
        roles: [],
        tags: [],
        descriptions: {}
      });

      // Set default managers config
      setManagersConfig({
        memoryManager: { enabled: true },
        planningManager: { enabled: true },
        toolManager: { enabled: true },
        knowledgeManager: { enabled: true },
        schedulerManager: { enabled: true }
      });
      
      return;
    }

    // For predefined templates, update form data based on selected template
    setFormData(prevData => ({
      ...prevData,
      name: template.name,
      description: template.description,
      status: AgentStatus.AVAILABLE,
      capabilities: Object.entries(template.capabilities.skills).map(([id, level]) => ({
        id,
        name: id.split('.')[1] || id,
        description: `Capability level: ${level}`
      })),
      parameters: {
        ...prevData.parameters,
        model: template.parameters.model,
        temperature: template.parameters.temperature,
        maxTokens: template.parameters.maxTokens,
        tools: template.parameters.tools,
      },
      metadata: {
        ...prevData.metadata,
        domain: template.capabilities.domains,
        specialization: template.capabilities.roles,
        tags: template.capabilities.tags,
      }
    }));

    // Update system prompt
    setSystemPrompt(template.systemPrompt);

    // Update persona data if available
    if (template.metadata) {
      setPersonaData({
        background: template.metadata.background || '',
        personality: template.metadata.personality || '',
        communicationStyle: template.metadata.communicationStyle || '',
        preferences: ''
      });
    }

    // Update capabilities
    setAgentCapabilities({
      skills: template.capabilities.skills,
      domains: template.capabilities.domains,
      roles: template.capabilities.roles,
      tags: template.capabilities.tags,
      descriptions: template.capabilities.descriptions || {}
    });

    // Set default managers config based on template
    setManagersConfig({
      memoryManager: { 
        enabled: true,
        contextWindow: 10,
        decayRate: 0.1,
        useChunking: true,
        usePineconeVectorStorage: false
      },
      planningManager: { 
        enabled: true,
        planningStrategy: 'adaptive',
        maxSteps: 5,
        useRecovery: true,
        validatePlans: true
      },
      toolManager: { enabled: true },
      knowledgeManager: { enabled: true },
      schedulerManager: { enabled: true }
    });
  };

  // Handle managers configuration changes
  const handleManagersConfigChange = (config: AgentManagersConfig) => {
    setManagersConfig(config);
    
    // Update form data with managers config
    setFormData(prevData => ({
      ...prevData,
      parameters: {
        ...prevData.parameters,
        managersConfig: config
      }
    }));
  };

  // Helper to update step status
  const updateStepStatus = (
    stepId: string,
    status: ProcessingStep['status'],
    message?: string
  ) => {
    setProcessingLog(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId
          ? { ...step, status, message, timestamp: new Date() }
          : step
      ),
      currentStep: stepId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Start validation
      updateStepStatus('validation', 'processing');
      
      // Validate form data
      const errors: {
        name?: string;
        description?: string;
        systemPrompt?: string;
        capabilities?: string;
      } = {};
      
      if (!formData.name.trim()) {
        errors.name = 'Agent name is required';
      }
      
      if (!formData.description.trim()) {
        errors.description = 'Agent description is required';
      }
      
      if (!systemPrompt.trim()) {
        errors.systemPrompt = 'System prompt is required';
      }
      
      const totalCapabilities = 
        Object.keys(agentCapabilities.skills).length + 
        agentCapabilities.domains.length + 
        agentCapabilities.roles.length;
        
      if (totalCapabilities === 0) {
        errors.capabilities = 'At least one capability is required';
      }
      
      if (Object.keys(errors).length > 0) {
        updateStepStatus('validation', 'error', 'Validation failed: ' + Object.values(errors).join(', '));
        setFormErrors(errors);
        return;
      }
      
      updateStepStatus('validation', 'completed', 'All fields validated successfully');

      // Process capabilities
      updateStepStatus('capabilities', 'processing');
      handleCapabilityChange({
        skills: agentCapabilities.skills,
        domains: agentCapabilities.domains,
        roles: agentCapabilities.roles,
        tags: agentCapabilities.tags,
        descriptions: agentCapabilities.descriptions
      });
      updateStepStatus('capabilities', 'completed', `Processed ${totalCapabilities} capabilities`);

      // Process knowledge files
      updateStepStatus('knowledge', 'processing');
      const totalFiles = knowledgeData.files.length;
      if (totalFiles > 0) {
        updateStepStatus('knowledge', 'completed', `Processed ${totalFiles} knowledge files`);
      } else {
        updateStepStatus('knowledge', 'completed', 'No knowledge files to process');
      }

      // Start registration
      updateStepStatus('registration', 'processing');
      
      // Create the registration request
      const standardRequest: AgentRegistrationRequest = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        capabilities: formData.capabilities,
        parameters: {
          model: process.env.NEXT_PUBLIC_DEFAULT_MODEL || formData.parameters.model,
          temperature: formData.parameters.temperature,
          maxTokens: formData.parameters.maxTokens,
          tools: formData.parameters.tools,
          managersConfig: managersConfig
        },
        metadata: {
          tags: formData.metadata.tags,
          domain: formData.metadata.domain,
          specialization: formData.metadata.specialization,
          performanceMetrics: formData.metadata.performanceMetrics,
          version: '1.0',
          isPublic: formData.metadata.isPublic,
        }
      };
      
      const extendedRequest = {
        ...standardRequest,
        _extended: {
          systemPrompt,
          knowledgePaths: knowledgeData.knowledgePaths,
          persona: personaData
        }
      };
      
      await onSubmit(extendedRequest as any);
      
      updateStepStatus('registration', 'completed', 'Agent registered successfully');
      
      // Clear form data from storage
      localStorage.removeItem(STORAGE_KEY);
      
      // Navigate to agents page
      router.push('/agents');
    } catch (error) {
      console.error("Error submitting form:", error);
      
      // Update the current step to error
      const currentStepId = processingLog.currentStep;
      if (currentStepId) {
        updateStepStatus(
          currentStepId,
          'error',
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
      
      // Update processing log with error
      setProcessingLog(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unknown error"
      }));
    }
  };

  const goToNextStep = () => {
    if (currentStep < FormStep.MANAGERS) {
      setCurrentStep(prevStep => prevStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > FormStep.TEMPLATE) {
      setCurrentStep(prevStep => prevStep - 1);
    }
  };
  
  const resetForm = () => {
    if (confirm('Are you sure you want to reset the form? All your data will be lost.')) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="wizard-step-indicator">
        {[
          { step: FormStep.TEMPLATE, label: "Template" },
          { step: FormStep.INFO_AND_PROMPT, label: "Agent Info" },
          { step: FormStep.PERSONA, label: "Persona" },
          { step: FormStep.KNOWLEDGE, label: "Knowledge" },
          { step: FormStep.CAPABILITIES, label: "Capabilities" },
          { step: FormStep.MANAGERS, label: "Managers" }
        ].map(({ step, label }) => (
          <div 
            key={step} 
            className={`wizard-step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
          >
            <div className="wizard-step-circle">
              {currentStep > step ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step + 1
              )}
            </div>
            <span className="wizard-step-label">{label}</span>
          </div>
        ))}
        <div className="wizard-progress-bar">
          <div 
            className="wizard-progress-fill"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  const renderTemplateStep = () => (
    <>
      <div className="wizard-panel mb-4">
        <h2 className="wizard-panel-title">Agent Template</h2>
        <p className="text-gray-400 text-sm mb-4">
          Choose a template to configure your agent with predefined settings, or start from scratch with the Custom Agent option.
        </p>
        
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-400">Custom Agent Creation</h3>
              <p className="text-xs text-gray-300 mt-1">
                Select the "Custom Agent" template to create an agent from scratch. You'll be able to define all aspects of your agent including capabilities, personality, and system prompt.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <AgentTemplateSelector onChange={handleTemplateSelect} />
      
      {/* Show selection confirmation */}
      {selectedTemplate && (
        <div className="mt-4 p-4 bg-green-900/30 border border-green-800 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-400">Template Selected</h3>
              <p className="text-xs text-gray-300 mt-1">
                <strong>{selectedTemplate.name}</strong> - {selectedTemplate.description}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Click "Next" to continue with the agent configuration.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderAgentInfoStep = () => (
    <>
      <div className="wizard-panel">
        <h2 className="wizard-panel-title">Agent Information</h2>
        
        <div className="wizard-grid wizard-grid-2">
          <div className="wizard-form-group">
            <label htmlFor="name" className="wizard-label">
              Agent Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className={`wizard-input ${formErrors.name ? 'wizard-input-error' : ''}`}
              placeholder="Enter agent name"
            />
            {formErrors.name && <p className="wizard-error-text">{formErrors.name}</p>}
          </div>
          
          <div className="wizard-form-group">
            <label htmlFor="status" className="wizard-label">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="wizard-select"
            >
              <option value={AgentStatus.AVAILABLE}>Available</option>
              <option value={AgentStatus.BUSY}>Busy</option>
              <option value={AgentStatus.MAINTENANCE}>Maintenance</option>
              <option value={AgentStatus.OFFLINE}>Offline</option>
            </select>
          </div>
        </div>
        
        <div className="wizard-form-group">
          <label htmlFor="description" className="wizard-label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows={3}
            className={`wizard-input wizard-textarea ${formErrors.description ? 'wizard-input-error' : ''}`}
            placeholder="Describe the agent's purpose and capabilities"
          />
          {formErrors.description && <p className="wizard-error-text">{formErrors.description}</p>}
        </div>
      </div>
      
      {/* System Prompt Editor */}
      <SystemPromptEditor 
        initialPrompt={systemPrompt}
        onChange={(prompt) => {
          setSystemPrompt(prompt);
          setFormData(prevFormData => ({
            ...prevFormData,
            parameters: {
              ...prevFormData.parameters,
              systemPrompt: prompt
            }
          }));
        }}
        error={formErrors.systemPrompt}
      />
    </>
  );

  // Add error display to the capabilities step
  const renderCapabilitiesStep = () => (
    <div className="wizard-panel">
      <h2 className="wizard-panel-title">Agent Capabilities</h2>
      <p className="text-sm text-gray-400 mb-4">
        Define your agent's skills, knowledge domains, and roles
      </p>
      
      <AgentCapabilityManager
        initialCapabilities={agentCapabilities}
        onChange={handleCapabilityChange}
      />
      {formErrors.capabilities && (
        <p className="wizard-error-text mt-4">{formErrors.capabilities}</p>
      )}
    </div>
  );

  // Render Managers Configuration step
  const renderManagersStep = () => (
    <>
      <div className="wizard-panel mb-4">
        <h2 className="wizard-panel-title">Agent Managers Configuration</h2>
        <p className="text-gray-400 text-sm mb-4">
          Configure the managers that control different aspects of the agent's behavior.
        </p>
        
        <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-400">Default Managers</h3>
              <p className="text-xs text-gray-300 mt-1">
                All agents come with Memory, Planning, Tool, Knowledge, and Scheduler managers by default. You can configure their behavior or disable specific managers based on your agent's needs.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <ManagerConfigPanel 
        initialConfig={managersConfig}
        onChange={handleManagersConfigChange}
      />
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="wizard-container">
      {renderStepIndicator()}
      
      <div className="wizard-steps-container">
        {currentStep === FormStep.TEMPLATE && renderTemplateStep()}
        {currentStep === FormStep.INFO_AND_PROMPT && renderAgentInfoStep()}
        
        {currentStep === FormStep.PERSONA && (
          <AgentPersonaForm 
            initialBackground={personaData.background}
            initialPersonality={personaData.personality}
            initialCommunicationStyle={personaData.communicationStyle}
            initialPreferences={personaData.preferences}
            onChange={(data) => {
              setPersonaData(data);
              setFormData(prevFormData => ({
                ...prevFormData,
                metadata: {
                  ...prevFormData.metadata,
                  persona: data
                }
              }));
            }}
          />
        )}
        
        {currentStep === FormStep.KNOWLEDGE && (
          <KnowledgeUploader 
            initialKnowledgePaths={knowledgeData.knowledgePaths}
            initialFiles={knowledgeData.files}
            onChange={(data) => {
              setKnowledgeData(data);
              setFormData(prevFormData => ({
                ...prevFormData,
                metadata: {
                  ...prevFormData.metadata,
                  knowledgePaths: data.knowledgePaths
                }
              }));
            }}
          />
        )}
        
        {currentStep === FormStep.CAPABILITIES && renderCapabilitiesStep()}
        {currentStep === FormStep.MANAGERS && renderManagersStep()}
        
        {/* Show processing status when submitting */}
        {isSubmitting && (
          <AgentProcessingStatus
            processingLog={processingLog}
            isProcessing={isSubmitting}
          />
        )}
      </div>
      
      <div className="wizard-controls">
        <div className="wizard-controls-inner">
          <div>
            {currentStep > FormStep.TEMPLATE && (
              <button
                type="button"
                onClick={goToPreviousStep}
                className="wizard-btn wizard-btn-secondary mr-2"
              >
                Previous
              </button>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="wizard-btn wizard-btn-danger"
            >
              Reset
            </button>
          </div>
          
          {currentStep < FormStep.MANAGERS ? (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={isSubmitting || (currentStep === FormStep.TEMPLATE && !selectedTemplate)}
              className="wizard-btn wizard-btn-primary"
            >
              Next
            </button>
          ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="wizard-btn wizard-btn-primary"
          >
              {isSubmitting ? 'Registering...' : 'Finalize Agent'}
          </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default AgentRegistrationForm; 