import React, { useState } from 'react';

// Manager configuration types
export interface ManagerConfig {
  enabled: boolean;
  [key: string]: any;
}

export interface MemoryManagerConfig extends ManagerConfig {
  consolidationSchedule?: string;
  decayRate?: number;
  contextWindow?: number;
  usePineconeVectorStorage?: boolean;
  useChunking?: boolean;
}

export interface PlanningManagerConfig extends ManagerConfig {
  planningStrategy?: 'simple' | 'advanced' | 'adaptive';
  maxSteps?: number;
  useRecovery?: boolean;
  validatePlans?: boolean;
}

export interface ToolManagerConfig extends ManagerConfig {
  allowExternalTools?: boolean;
  maxToolCalls?: number;
  toolTimeout?: number;
  securityLevel?: 'strict' | 'moderate' | 'permissive';
}

export interface KnowledgeManagerConfig extends ManagerConfig {
  useKnowledgeGraph?: boolean;
  cacheResults?: boolean;
  useRag?: boolean;
}

export interface SchedulerManagerConfig extends ManagerConfig {
  maxConcurrentTasks?: number;
  defaultTaskTimeout?: number;
  useBackgroundProcessing?: boolean;
}

export interface AgentManagersConfig {
  memoryManager?: MemoryManagerConfig;
  planningManager?: PlanningManagerConfig;
  toolManager?: ToolManagerConfig;
  knowledgeManager?: KnowledgeManagerConfig;
  schedulerManager?: SchedulerManagerConfig;
}

interface ManagerConfigPanelProps {
  initialConfig?: AgentManagersConfig;
  onChange: (config: AgentManagersConfig) => void;
}

const ManagerConfigPanel: React.FC<ManagerConfigPanelProps> = ({
  initialConfig = {
    memoryManager: { enabled: true },
    planningManager: { enabled: true },
    toolManager: { enabled: true },
    knowledgeManager: { enabled: true },
    schedulerManager: { enabled: true }
  },
  onChange
}) => {
  const [config, setConfig] = useState<AgentManagersConfig>(initialConfig);
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({
    memory: false,
    planning: false,
    tool: false,
    knowledge: false,
    scheduler: false
  });
  
  // Handle toggle manager
  const handleToggleManager = (manager: keyof AgentManagersConfig) => {
    const newConfig = { 
      ...config,
      [manager]: {
        ...config[manager],
        enabled: !config[manager]?.enabled
      }
    };
    
    setConfig(newConfig);
    onChange(newConfig);
  };
  
  // Handle config value change
  const handleConfigChange = (
    manager: keyof AgentManagersConfig, 
    field: string, 
    value: any
  ) => {
    const newConfig = { 
      ...config,
      [manager]: {
        ...config[manager],
        [field]: value
      }
    };
    
    setConfig(newConfig);
    onChange(newConfig);
  };
  
  // Toggle panel expansion
  const togglePanel = (panel: string) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 my-4">
      <h2 className="text-xl font-semibold mb-4">Agent Managers Configuration</h2>
      <p className="text-sm text-gray-400 mb-6">
        Configure the managers that control different aspects of the agent's behavior.
      </p>
      
      {/* Memory Manager */}
      <div className="mb-4 border border-gray-700 rounded overflow-hidden">
        <div 
          className="flex items-center justify-between p-3 bg-gray-700 cursor-pointer"
          onClick={() => togglePanel('memory')}
        >
          <div className="flex items-center">
            <div className="mr-3">
              <input
                type="checkbox"
                id="memory-manager-toggle"
                checked={config.memoryManager?.enabled ?? true}
                onChange={() => handleToggleManager('memoryManager')}
                className="sr-only peer"
              />
              <label
                htmlFor="memory-manager-toggle"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600 cursor-pointer transition-colors ease-in-out duration-200 peer-checked:bg-blue-600"
                onClick={e => e.stopPropagation()}
              >
                <span className={`${config.memoryManager?.enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition ease-in-out duration-200`}></span>
              </label>
            </div>
            <h3 className="font-medium">Memory Manager</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transition-transform duration-200 ${expandedPanels.memory ? 'rotate-180' : ''}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        
        {expandedPanels.memory && config.memoryManager?.enabled && (
          <div className="p-4 bg-gray-800">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Memory Decay Rate</label>
                <select
                  value={config.memoryManager?.decayRate?.toString() || '0.1'}
                  onChange={e => handleConfigChange('memoryManager', 'decayRate', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  <option value="0">None</option>
                  <option value="0.05">Slow (0.05)</option>
                  <option value="0.1">Normal (0.1)</option>
                  <option value="0.2">Fast (0.2)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Controls how quickly memories fade in importance over time</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Context Window Size</label>
                <select
                  value={config.memoryManager?.contextWindow?.toString() || '10'}
                  onChange={e => handleConfigChange('memoryManager', 'contextWindow', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  <option value="5">Small (5)</option>
                  <option value="10">Medium (10)</option>
                  <option value="20">Large (20)</option>
                  <option value="50">Extra Large (50)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">How many memories to include in each conversation context</p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="use-chunking"
                  checked={config.memoryManager?.useChunking ?? true}
                  onChange={e => handleConfigChange('memoryManager', 'useChunking', e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="use-chunking" className="text-sm">Use memory chunking for long content</label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="use-vector-storage"
                  checked={config.memoryManager?.usePineconeVectorStorage ?? false}
                  onChange={e => handleConfigChange('memoryManager', 'usePineconeVectorStorage', e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="use-vector-storage" className="text-sm">Use Pinecone vector storage</label>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Planning Manager */}
      <div className="mb-4 border border-gray-700 rounded overflow-hidden">
        <div 
          className="flex items-center justify-between p-3 bg-gray-700 cursor-pointer"
          onClick={() => togglePanel('planning')}
        >
          <div className="flex items-center">
            <div className="mr-3">
              <input
                type="checkbox"
                id="planning-manager-toggle"
                checked={config.planningManager?.enabled ?? true}
                onChange={() => handleToggleManager('planningManager')}
                className="sr-only peer"
              />
              <label
                htmlFor="planning-manager-toggle"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600 cursor-pointer transition-colors ease-in-out duration-200 peer-checked:bg-blue-600"
                onClick={e => e.stopPropagation()}
              >
                <span className={`${config.planningManager?.enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition ease-in-out duration-200`}></span>
              </label>
            </div>
            <h3 className="font-medium">Planning Manager</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 transition-transform duration-200 ${expandedPanels.planning ? 'rotate-180' : ''}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
        
        {expandedPanels.planning && config.planningManager?.enabled && (
          <div className="p-4 bg-gray-800">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Planning Strategy</label>
                <select
                  value={config.planningManager?.planningStrategy || 'adaptive'}
                  onChange={e => handleConfigChange('planningManager', 'planningStrategy', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                >
                  <option value="simple">Simple</option>
                  <option value="advanced">Advanced</option>
                  <option value="adaptive">Adaptive</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Strategy for creating and executing plans</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Maximum Plan Steps</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.planningManager?.maxSteps || 5}
                  onChange={e => handleConfigChange('planningManager', 'maxSteps', parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Maximum number of steps in a plan</p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="use-recovery"
                  checked={config.planningManager?.useRecovery ?? true}
                  onChange={e => handleConfigChange('planningManager', 'useRecovery', e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="use-recovery" className="text-sm">Use plan recovery for failures</label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="validate-plans"
                  checked={config.planningManager?.validatePlans ?? true}
                  onChange={e => handleConfigChange('planningManager', 'validatePlans', e.target.checked)}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="validate-plans" className="text-sm">Validate plans before execution</label>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* More manager panels would be added here for Tool, Knowledge, and Scheduler */}
      {/* For brevity, I'm only including Memory and Planning as examples */}
    </div>
  );
};

export default ManagerConfigPanel; 