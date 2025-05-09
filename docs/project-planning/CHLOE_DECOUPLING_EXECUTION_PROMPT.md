# Chloe Decoupling Execution Prompt

## Context

We need to decouple the Chloe agent from our codebase to create a generic agent architecture that supports multiple agents. After reviewing the codebase, we discovered we already have `AgentBase` and `AgentFactory` implementations we can leverage. This prompt provides a structured approach to executing this project efficiently.

## Revised Implementation Strategy: Using Chloe as the Base Agent

Rather than making Chloe extend AgentBase, we've determined a more efficient approach is to rename and move Chloe's implementation to become our base agent framework. This approach leverages Chloe's sophisticated architecture while making it agent-agnostic.

### Step 1: Directory Reorganization

1. Move the entire `agents/chloe` directory structure to `lib/agents/base`
2. Create a new minimal `agents/chloe` implementation that extends the base agent
3. Update all imports throughout the codebase to reflect this new structure

```typescript
// Example directory structure
- lib/
  - agents/
    - base/ (formerly agents/chloe/)
      - core/
      - managers/
      - utils/
      - scheduler.ts (renamed to agent-scheduler.ts)
    - registry/
- agents/
  - chloe/ (new minimal implementation)
    - index.ts
  - shared/
```

### Step 2: Generalization

1. Replace all hardcoded "chloe" references with configurable values:

```typescript
// BEFORE
class ChloeAgent {
  readonly agentId = 'chloe';
  readonly department = 'marketing';
  // ...
}

// AFTER
class BaseAgent {
  readonly agentId: string;
  readonly department: string;
  
  constructor(options: BaseAgentOptions) {
    this.agentId = options.agentId || 'agent';
    this.department = options.department || 'general';
    // ...
  }
}
```

2. Create the minimal Chloe implementation:

```typescript
import { BaseAgent } from '../lib/agents/base/core/agent';

export class ChloeAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      agentId: 'chloe',
      department: 'marketing',
      role: 'cmo',
      // Other Chloe-specific settings
      ...options
    });
  }
  
  // Any Chloe-specific methods not in BaseAgent
}
```

### Step 3: Manager System Refactoring

Make all managers agent-agnostic and configurable:

```typescript
// lib/agents/base/managers/manager-factory.ts
export class ManagerFactory {
  static createManagers(agent: BaseAgent, config: AgentConfig): Map<string, AgentManager> {
    const managers = new Map();
    
    if (config.enableMemoryManager) {
      managers.set('memory', new MemoryManager(agent, config.memoryOptions));
    }
    
    if (config.enableKnowledgeManager) {
      managers.set('knowledge', new KnowledgeManager(agent, config.knowledgeOptions));
    }
    
    if (config.enablePlanningManager) {
      managers.set('planning', new PlanningManager(agent, config.planningOptions));
    }
    
    // More managers...
    
    return managers;
  }
}
```

### Step 4: Scheduler System Refactoring

Rename and refactor the scheduler to be agent-agnostic:

```typescript
// BEFORE: agents/chloe/scheduler.ts
export class ChloeScheduler {
  private agent: ChloeAgent;
  // ...
}

// AFTER: lib/agents/base/agent-scheduler.ts
export class AgentScheduler {
  private agent: BaseAgent;
  private tasks: AgentTask[];
  private registry: SchedulerRegistry;
  
  constructor(agent: BaseAgent, options: SchedulerOptions = {}) {
    this.agent = agent;
    this.tasks = options.tasks || [];
    this.registry = SchedulerRegistry.getInstance();
    
    // Register this scheduler
    this.registry.registerScheduler(agent.agentId, this);
  }
  
  // Methods for task scheduling, execution, etc.
}

// lib/agents/base/scheduler-registry.ts
export class SchedulerRegistry {
  private static instance: SchedulerRegistry;
  private schedulers: Map<string, AgentScheduler> = new Map();
  
  static getInstance(): SchedulerRegistry {
    if (!this.instance) {
      this.instance = new SchedulerRegistry();
    }
    return this.instance;
  }
  
  registerScheduler(agentId: string, scheduler: AgentScheduler): void {
    this.schedulers.set(agentId, scheduler);
  }
  
  getScheduler(agentId: string): AgentScheduler | undefined {
    return this.schedulers.get(agentId);
  }
  
  getAllSchedulers(): Map<string, AgentScheduler> {
    return this.schedulers;
  }
}
```

### Step 5: UI Registration Form Updates

Update the AgentRegistrationForm to include manager configuration:

```tsx
const ManagerConfiguration = () => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Manager Configuration</h2>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Memory Manager</h3>
            <p className="text-sm text-gray-400">Remembers conversations and important information</p>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enableMemoryManager"
              name="config.enableMemoryManager"
              checked={formData.config.enableMemoryManager}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="enableMemoryManager">Enable</label>
          </div>
        </div>
        
        {formData.config.enableMemoryManager && (
          <div className="ml-6 mt-2 space-y-3">
            <div>
              <label htmlFor="config.memoryOptions.importanceThreshold" className="block text-sm font-medium mb-1">
                Importance Threshold
              </label>
              <input
                type="number"
                id="config.memoryOptions.importanceThreshold"
                name="config.memoryOptions.importanceThreshold"
                value={formData.config.memoryOptions?.importanceThreshold || 0.7}
                onChange={handleNumberChange}
                min="0"
                max="1"
                step="0.1"
                className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
              />
            </div>
            
            {/* Other memory options */}
          </div>
        )}
        
        {/* Similar sections for other managers */}
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Scheduler</h3>
            <p className="text-sm text-gray-400">Enables autonomous scheduled tasks</p>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enableScheduler"
              name="config.enableScheduler"
              checked={formData.config.enableScheduler}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="enableScheduler">Enable</label>
          </div>
        </div>
        
        {formData.config.enableScheduler && (
          <div className="ml-6 mt-2">
            <TaskTemplateSelector
              capabilities={selectedCapabilities}
              onChange={handleTaskTemplatesChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};
```

## Testing Strategy

When testing this new approach, we need to validate:

1. Existing code referencing Chloe still works properly
2. Multiple agents can be created with different configurations
3. Agents can selectively enable or disable different managers
4. The scheduler properly supports multiple agents
5. No functionality is lost in the transition

Add these additional test cases to your existing testing plan:

```typescript
describe('BaseAgent Implementation', () => {
  it('should work with minimal configuration', async () => {
    const agent = new BaseAgent({ agentId: 'test-agent' });
    await agent.initialize();
    expect(agent.getAgentId()).toBe('test-agent');
  });
  
  it('should support selective manager initialization', async () => {
    const agent = new BaseAgent({
      agentId: 'test-agent',
      config: {
        enableMemoryManager: true,
        enableKnowledgeManager: false
      }
    });
    await agent.initialize();
    
    expect(agent.getManager('memory')).toBeDefined();
    expect(agent.getManager('knowledge')).toBeUndefined();
  });
  
  it('should support multiple agent instances with different configs', async () => {
    const agent1 = new BaseAgent({
      agentId: 'agent1',
      config: { department: 'marketing' }
    });
    
    const agent2 = new BaseAgent({
      agentId: 'agent2',
      config: { department: 'engineering' }
    });
    
    await Promise.all([agent1.initialize(), agent2.initialize()]);
    
    expect(agent1.getDepartment()).toBe('marketing');
    expect(agent2.getDepartment()).toBe('engineering');
    expect(agent1).not.toBe(agent2);
  });
});

// Test Chloe still works with new implementation
describe('ChloeAgent with new implementation', () => {
  it('should still have all Chloe functionality', async () => {
    const chloe = new ChloeAgent();
    await chloe.initialize();
    
    // Test Chloe-specific functionality
    expect(chloe.getAgentId()).toBe('chloe');
    expect(chloe.getDepartment()).toBe('marketing');
    
    // Test Chloe-specific methods still work
    const result = await chloe.runMarketingAnalysis('test topic');
    expect(result).toBeDefined();
  });
});

describe('Scheduler Registry', () => {
  it('should manage multiple agent schedulers', async () => {
    const registry = SchedulerRegistry.getInstance();
    
    const agent1 = new BaseAgent({ agentId: 'agent1' });
    const agent2 = new BaseAgent({ agentId: 'agent2' });
    
    await Promise.all([agent1.initialize(), agent2.initialize()]);
    
    const scheduler1 = new AgentScheduler(agent1);
    const scheduler2 = new AgentScheduler(agent2);
    
    expect(registry.getScheduler('agent1')).toBe(scheduler1);
    expect(registry.getScheduler('agent2')).toBe(scheduler2);
    expect(registry.getAllSchedulers().size).toBe(2);
  });
});
```

## Search and Replace Patterns

Use these patterns to find and replace hardcoded references:

1. Import statements:
   - Search: `from '../../../agents/chloe`
   - Replace: `from '../../../lib/agents/base`

2. Agent ID references:
   - Search: `'chloe'`, `"chloe"`, `agentId: 'chloe'`
   - Replace: `this.agentId`, `options.agentId`, `this.config.agentId`

3. Scheduler references:
   - Search: `ChloeScheduler`, `new ChloeScheduler`
   - Replace: `AgentScheduler`, `new AgentScheduler`

4. Manager access:
   - Search: `this.memoryManager`, `this.knowledgeManager`
   - Replace: `this.getManager('memory')`, `this.getManager('knowledge')`

## Rollout Plan

1. Create a feature branch for this refactoring: `feature/chloe-to-base`
2. Move and rename the directory structure
3. Update import references
4. Replace hardcoded values with configuration
5. Create the minimal Chloe implementation 
6. Update the agent registration form
7. Run tests and fix any issues
8. Perform thorough manual testing
9. Create a PR with detailed documentation
10. Deploy to staging for validation
11. Roll out to production with feature flags

## Execution Strategy

### Phase 1: Agent Architecture Integration

1. Examine and understand the existing implementation:
   ```
   src/agents/shared/base/AgentBase.ts          # Generic base agent
   src/server/memory/services/multi-agent/agent-factory.ts # Existing agent factory
   ```

2. Refactor `ChloeAgent` to extend the existing `AgentBase`:
   - Make Chloe inherit from AgentBase
   - Ensure all Chloe-specific functionality is properly encapsulated
   - Map Chloe's interface to the AgentBase interface

3. Remove Chloe-specific hardcoded values:
   - Move hardcoded values to configuration objects
   - Create a clear separation between base functionality and agent-specific extensions

4. Update the agent singleton pattern:
   - Integrate Chloe with existing agent registry
   - Create backward-compatible accessor methods
   - Ensure existing code can still access Chloe

### Phase 2: Knowledge System Refactoring

1. Make the `MarkdownManager` agent-agnostic:
   - Accept configurable file paths and directories
   - Remove hardcoded department values ("marketing")
   - Support dynamic configuration of knowledge sources

2. Implement a knowledge upload system:
   - Create API endpoints for uploading markdown files
   - Store files in agent-specific directories
   - Index uploaded knowledge into memory

3. Refactor knowledge directory structure:
   - Move from hardcoded paths to configurable paths
   - Create a consistent structure for agent-specific knowledge

### Phase 3: UI Registration Flow Enhancement

1. Update the `AgentRegistrationForm` component:
   - Add critical missing fields for complete agent configuration
   - Implement system prompt customization with rich editing
   - Support capability level selection
   - Add department selection and configuration
   - Add knowledge upload functionality 
   - Create template system for quick agent setup

2. Create agent instance creation flow:
   - Connect registration form to agent factory
   - Implement configuration validation
   - Create proper error handling

3. Implement Chloe recreation feature:
   - Create a "Load Chloe Template" option
   - Pre-populate form with Chloe's configuration
   - Allow customization of Chloe template

#### AgentRegistrationForm Enhancement Details

1. **System Prompt Configuration Component**:
   ```tsx
   const SystemPromptEditor = () => {
     return (
       <div className="bg-gray-800 p-6 rounded-lg shadow-md">
         <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
         
         <div className="mb-4">
           <label htmlFor="systemPromptTemplate" className="block text-sm font-medium mb-1">
             Template
           </label>
           <select
             id="systemPromptTemplate"
             onChange={(e) => loadSystemPromptTemplate(e.target.value)}
             className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
           >
             <option value="">Select a template or create custom</option>
             <option value="chloe">Chloe (Marketing Expert)</option>
             <option value="assistant">General Assistant</option>
             <option value="researcher">Researcher</option>
             <option value="coder">Coding Expert</option>
           </select>
         </div>
         
         <div>
           <label htmlFor="parameters.systemPrompt" className="block text-sm font-medium mb-1">
             System Prompt
           </label>
           <textarea
             id="parameters.systemPrompt"
             name="parameters.systemPrompt"
             value={formData.parameters.systemPrompt || ''}
             onChange={handleChange}
             rows={10}
             className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white monospace"
             placeholder="You are an AI assistant with expertise in..."
           />
         </div>
         
         <div className="mt-2">
           <button
             type="button"
             onClick={() => setShowSystemPromptPreview(!showSystemPromptPreview)}
             className="text-blue-400 hover:text-blue-300 text-sm"
           >
             {showSystemPromptPreview ? 'Hide Preview' : 'Show Preview'}
           </button>
           
           {showSystemPromptPreview && (
             <div className="mt-4 p-4 bg-gray-700 rounded border border-gray-600">
               <h3 className="text-md font-medium mb-2">Preview:</h3>
               <div className="text-sm whitespace-pre-wrap">
                 {formData.parameters.systemPrompt || 'No system prompt provided yet'}
               </div>
             </div>
           )}
         </div>
       </div>
     );
   };
   ```

2. **Department Configuration**:
   ```tsx
   const DepartmentSelector = () => {
     return (
       <div className="mb-4">
         <label htmlFor="department" className="block text-sm font-medium mb-1">
           Department
         </label>
         <select
           id="department"
           name="config.department"
           value={formData.config.department || ''}
           onChange={handleChange}
           className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
         >
           <option value="">Select a department</option>
           <option value="marketing">Marketing</option>
           <option value="sales">Sales</option>
           <option value="hr">Human Resources</option>
           <option value="finance">Finance</option>
           <option value="engineering">Engineering</option>
           <option value="support">Customer Support</option>
           <option value="general">General</option>
           <option value="custom">Custom...</option>
         </select>
         
         {formData.config.department === 'custom' && (
           <input
             type="text"
             name="config.customDepartment"
             value={formData.config.customDepartment || ''}
             onChange={handleChange}
             className="mt-2 w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
             placeholder="Enter custom department"
           />
         )}
       </div>
     );
   };
   ```

3. **Knowledge Upload Component**:
   ```tsx
   const KnowledgeUploader = () => {
     return (
       <div className="bg-gray-800 p-6 rounded-lg shadow-md">
         <h2 className="text-xl font-semibold mb-4">Knowledge Sources</h2>
         
         <div className="mb-4">
           <h3 className="text-md font-medium mb-2">Upload Markdown Files</h3>
           <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
             <input
               type="file"
               id="markdown-upload"
               accept=".md"
               multiple
               onChange={handleFileUpload}
               className="hidden"
             />
             <label
               htmlFor="markdown-upload"
               className="cursor-pointer bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded text-white inline-block"
             >
               Select Files
             </label>
             <p className="mt-2 text-sm text-gray-400">
               Or drag and drop markdown files here
             </p>
           </div>
         </div>
         
         {uploadedFiles.length > 0 && (
           <div className="mb-4">
             <h3 className="text-md font-medium mb-2">Uploaded Files:</h3>
             <ul className="space-y-1">
               {uploadedFiles.map((file, index) => (
                 <li key={index} className="bg-gray-700 p-2 rounded flex justify-between items-center">
                   <span>{file.name}</span>
                   <button
                     type="button"
                     onClick={() => removeFile(index)}
                     className="text-red-400 hover:text-red-300"
                   >
                     Remove
                   </button>
                 </li>
               ))}
             </ul>
           </div>
         )}
         
         <div className="mb-4">
           <h3 className="text-md font-medium mb-2">Knowledge Directories</h3>
           <div className="space-y-2">
             {formData.config.knowledgePaths?.map((path, index) => (
               <div key={index} className="flex items-center">
                 <input
                   type="text"
                   value={path}
                   onChange={(e) => updateKnowledgePath(index, e.target.value)}
                   className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                 />
                 <button
                   type="button"
                   onClick={() => removeKnowledgePath(index)}
                   className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-r text-white"
                 >
                   Remove
                 </button>
               </div>
             ))}
             
             <button
               type="button"
               onClick={addKnowledgePath}
               className="bg-blue-600 hover:bg-blue-700 py-1 px-3 rounded text-white text-sm"
             >
               Add Path
             </button>
           </div>
         </div>
       </div>
     );
   };
   ```

4. **Advanced Parameters Component**:
   ```tsx
   const AdvancedParameters = () => {
     return (
       <div className="bg-gray-800 p-6 rounded-lg shadow-md">
         <div className="flex justify-between items-center mb-4">
           <h2 className="text-xl font-semibold">Advanced Parameters</h2>
           <button
             type="button"
             onClick={() => setShowAdvancedParams(!showAdvancedParams)}
             className="text-blue-400 hover:text-blue-300 text-sm"
           >
             {showAdvancedParams ? 'Hide' : 'Show'}
           </button>
         </div>
         
         {showAdvancedParams && (
           <div className="space-y-4">
             <div>
               <label htmlFor="parameters.contextWindow" className="block text-sm font-medium mb-1">
                 Context Window Size
               </label>
               <input
                 type="number"
                 id="parameters.contextWindow"
                 name="parameters.contextWindow"
                 value={formData.parameters.contextWindow || 4000}
                 onChange={handleNumberChange}
                 min="1000"
                 max="32000"
                 step="1000"
                 className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
               />
             </div>
             
             <div>
               <label htmlFor="parameters.customInstructions" className="block text-sm font-medium mb-1">
                 Custom Instructions
               </label>
               <textarea
                 id="parameters.customInstructions"
                 name="parameters.customInstructions"
                 value={formData.parameters.customInstructions || ''}
                 onChange={handleChange}
                 rows={4}
                 className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
                 placeholder="Additional custom instructions..."
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium mb-1">
                 System Messages
               </label>
               <div className="space-y-2">
                 {formData.parameters.systemMessages?.map((message, index) => (
                   <div key={index} className="flex items-start">
                     <textarea
                       value={message}
                       onChange={(e) => updateSystemMessage(index, e.target.value)}
                       rows={2}
                       className="flex-1 bg-gray-700 border border-gray-600 rounded-l py-2 px-3 text-white"
                     />
                     <button
                       type="button"
                       onClick={() => removeSystemMessage(index)}
                       className="bg-red-600 hover:bg-red-700 px-3 py-2 h-full rounded-r text-white"
                     >
                       Remove
                     </button>
                   </div>
                 ))}
                 
                 <button
                   type="button"
                   onClick={addSystemMessage}
                   className="bg-blue-600 hover:bg-blue-700 py-1 px-3 rounded text-white text-sm"
                 >
                   Add System Message
                 </button>
               </div>
             </div>
             
             <div>
               <label className="block text-sm font-medium mb-1">
                 Tool Permissions
               </label>
               <div className="grid grid-cols-2 gap-2">
                 {availableTools.map(tool => (
                   <div key={tool.id} className="flex items-center">
                     <input
                       type="checkbox"
                       id={`tool-${tool.id}`}
                       checked={formData.toolPermissions?.includes(tool.id) || false}
                       onChange={(e) => toggleToolPermission(tool.id, e.target.checked)}
                       className="mr-2"
                     />
                     <label htmlFor={`tool-${tool.id}`} className="text-sm">
                       {tool.name}
                     </label>
                   </div>
                 ))}
               </div>
             </div>
           </div>
         )}
       </div>
     );
   };
   ```

5. **Capability Level Configuration**:
   ```tsx
   const CapabilityLevelEditor = () => {
     return (
       <div className="mt-6">
         <h3 className="text-md font-medium mb-2">Capability Levels</h3>
         
         {formData.capabilities.length > 0 ? (
           <div className="space-y-4">
             {formData.capabilities.map((capability) => (
               <div key={capability.id} className="bg-gray-700 p-3 rounded">
                 <div className="flex justify-between items-center mb-2">
                   <h4 className="font-medium">{capability.name}</h4>
                   <span className="text-xs text-gray-400">{capability.id}</span>
                 </div>
                 
                 <p className="text-sm text-gray-300 mb-2">{capability.description}</p>
                 
                 <div>
                   <label htmlFor={`level-${capability.id}`} className="block text-sm mb-1">
                     Proficiency Level
                   </label>
                   <select
                     id={`level-${capability.id}`}
                     value={getCapabilityLevel(capability.id) || 'basic'}
                     onChange={(e) => setCapabilityLevel(capability.id, e.target.value)}
                     className="w-full bg-gray-600 border border-gray-500 rounded py-1 px-2 text-white text-sm"
                   >
                     <option value="basic">Basic</option>
                     <option value="intermediate">Intermediate</option>
                     <option value="advanced">Advanced</option>
                     <option value="expert">Expert</option>
                   </select>
                   
                   <div className="mt-2 bg-gray-600 rounded-full h-2">
                     <div 
                       className="bg-blue-500 h-2 rounded-full" 
                       style={{ 
                         width: getLevelPercentage(getCapabilityLevel(capability.id)) 
                       }}
                     ></div>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         ) : (
           <p className="text-sm text-gray-400">
             Add capabilities first to configure their levels
           </p>
         )}
       </div>
     );
   };
   ```

### Phase 4: Testing and Validation

1. Create automated tests for agent creation:
   - Test creation of multiple agent types
   - Validate configuration persistence
   - Test capability loading

2. Set up integration tests:
   - Test API endpoints
   - Test UI flow
   - Test agent interaction

3. Validate Chloe recreation:
   - Ensure all Chloe functionality works with new architecture
   - Verify performance matches original implementation

## Implementation Steps

1. First, refactor ChloeAgent to inherit from AgentBase:
   ```typescript
   import { AgentBase, AgentBaseOptions, AgentCapabilityLevel } from '../shared/base/AgentBase';
   
   export class ChloeAgent extends AgentBase {
     constructor(options: Partial<AgentBaseOptions> = {}) {
       // Merge Chloe-specific config with provided options
       const chloeOptions: AgentBaseOptions = {
         config: {
           agentId: 'chloe',
           name: 'Chloe',
           description: 'CMO of Crowd Wisdom focused on marketing strategy',
           systemPrompt: SYSTEM_PROMPTS.CHLOE,
           model: process.env.OPENAI_MODEL_NAME || 'gpt-4o',
           temperature: 0.7,
           department: 'marketing',
           capabilities: {
             skills: {
               'marketing_strategy': 'advanced',
               'growth_optimization': 'expert',
               'viral_marketing': 'advanced',
               'low_budget_acquisition': 'expert'
             },
             domains: ['marketing', 'growth', 'strategy'],
             roles: ['cmo', 'advisor', 'strategist']
           },
           ...(options.config || {})
         },
         capabilityLevel: options.capabilityLevel || AgentCapabilityLevel.ADVANCED,
         toolPermissions: options.toolPermissions || [
           'web_search', 'document_creation', 'social_media_analysis'
         ]
       };
       
       super(chloeOptions);
       
       // Add any Chloe-specific initialization
     }
     
     // Implement Chloe-specific methods that aren't part of AgentBase
     async runMarketingAnalysis(topic: string): Promise<any> {
       // Implement using AgentBase capabilities
     }
     
     // More Chloe-specific methods...
   }
   ```

2. Update the existing singleton pattern:
   ```typescript
   import { AgentRegistry } from '../registry/AgentRegistry';
   import { ChloeAgent } from './core/agent';
   
   // Keep backward compatibility by wrapping the registry call
   export async function getChloeInstance(): Promise<ChloeAgent> {
     // Check if Chloe exists in registry
     const agent = await AgentRegistry.getAgent('chloe');
     
     if (agent) {
       return agent as ChloeAgent;
     }
     
     // If not found, create and register a new Chloe agent
     console.log('Creating new Chloe instance via registry...');
     const chloeAgent = new ChloeAgent();
     await chloeAgent.initialize();
     
     // Register with the agent registry
     AgentRegistry.registerAgent('chloe', chloeAgent);
     
     return chloeAgent;
   }
   ```

3. Refactor the knowledge manager:
   ```typescript
   export class KnowledgeManager {
     private agentId: string;
     private department: string;
     private directories: string[];
     
     constructor(options: KnowledgeManagerOptions) {
       this.agentId = options.agentId;
       this.department = options.department || 'general';
       this.directories = options.directories || this.getDefaultDirectories();
     }
     
     private getDefaultDirectories(): string[] {
       const dirs = ['data/knowledge/company', 'data/knowledge/agents/shared'];
       
       if (this.agentId) {
         dirs.push(`data/knowledge/agents/${this.agentId}`);
       }
       
       if (this.department) {
         dirs.push(`data/knowledge/domains/${this.department}`);
       }
       
       return dirs;
     }
     
     async loadKnowledge(): Promise<void> {
       // Load knowledge from configured directories
     }
   }
   ```

4. Create a Chloe template for the registration form:
   ```typescript
   export const CHLOE_TEMPLATE: AgentTemplate = {
     name: "Chloe",
     description: "CMO of Crowd Wisdom focused on early-to-mid stage growth with limited resources",
     capabilities: [
       {
         id: "cap_marketing_strategy",
         name: "Marketing Strategy",
         description: "Creating and implementing marketing strategies for startups",
         version: "1.0"
       },
       {
         id: "cap_growth_optimization",
         name: "Growth Optimization",
         description: "Strategies to scale from 0 → 10k MAUs in 2025 and 100k MAUs in 2026",
         version: "1.0"
       },
       {
         id: "cap_viral_marketing",
         name: "Viral Marketing",
         description: "Designing viral loops and referral systems",
         version: "1.0"
       },
       {
         id: "cap_low_budget_acquisition",
         name: "Low-Budget Acquisition",
         description: "User acquisition strategies with minimal budget",
         version: "1.0"
       }
     ],
     parameters: {
       model: process.env.OPENAI_MODEL_NAME || "gpt-4o",
       temperature: 0.7,
       maxTokens: 2000,
       customInstructions: SYSTEM_PROMPTS.CHLOE,
       tools: []
     },
     metadata: {
       tags: ["marketing", "cmo", "growth", "startup", "user-acquisition", "viral"],
       domain: ["marketing"],
       specialization: ["growth-strategy", "viral-marketing", "user-acquisition"],
       isPublic: true
     }
   };
   ```

5. Add template-loading functionality to the registration form:
   ```typescript
   import { useState, useEffect } from 'react';
   import { CHLOE_TEMPLATE } from '../../lib/templates/agent-templates';
   
   // Inside the AgentRegistrationForm component
   const [templates, setTemplates] = useState([
     { id: 'blank', name: 'Blank Agent' },
     { id: 'chloe', name: 'Chloe (Marketing)' },
     { id: 'researcher', name: 'Researcher' },
     { id: 'assistant', name: 'General Assistant' }
   ]);
   
   const loadTemplate = (templateId: string) => {
     switch (templateId) {
       case 'chloe':
         setFormData({
           name: CHLOE_TEMPLATE.name,
           description: CHLOE_TEMPLATE.description,
           capabilities: CHLOE_TEMPLATE.capabilities,
           parameters: CHLOE_TEMPLATE.parameters,
           metadata: CHLOE_TEMPLATE.metadata,
           status: 'available'
         });
         break;
       // Other templates...
       default:
         // Reset to blank
         setFormData({ /* blank form data */ });
     }
   };
   
   // Add a select dropdown for templates
   <div className="mb-4">
     <label className="block text-sm font-medium mb-1">
       Template
     </label>
     <select 
       onChange={(e) => loadTemplate(e.target.value)} 
       className="w-full bg-gray-700 border border-gray-600 rounded py-2 px-3 text-white"
     >
       {templates.map(template => (
         <option key={template.id} value={template.id}>
           {template.name}
         </option>
       ))}
     </select>
   </div>
   ```

## Search and Replace Patterns

Use these patterns to identify and replace hardcoded references:

1. Find agent ID references:
   - Search: `'chloe'`, `"chloe"`, `agentId: 'chloe'`, `agentId: "chloe"`
   - Replace: `this.agentId`, `options.agentId`, `config.agentId`

2. Find system prompt references:
   - Search: `SYSTEM_PROMPTS.CHLOE`
   - Replace: `this.config.systemPrompt`

3. Find knowledge path references:
   - Search: `'data/knowledge/agents/chloe'`
   - Replace: Dynamic paths based on agent ID

4. Find department references:
   - Search: `department: 'marketing'`
   - Replace: `department: this.config.department || 'marketing'`

## Testing Strategy

1. Create unit tests for the Chloe adaptation of AgentBase:
   ```typescript
   describe('ChloeAgent extending AgentBase', () => {
     it('should initialize with Chloe-specific defaults', async () => {
       const agent = new ChloeAgent();
       await agent.initialize();
       expect(agent.getAgentId()).toBe('chloe');
       expect(agent.getDomains()).toContain('marketing');
     });
     
     it('should maintain backward compatibility with existing code', async () => {
       const agent = new ChloeAgent();
       await agent.initialize();
       
       // Test Chloe-specific methods still work
       const analysis = await agent.runMarketingAnalysis('test topic');
       expect(analysis).toBeDefined();
     });
     
     it('should use custom system prompt when provided', async () => {
       const customPrompt = 'Custom prompt for testing';
       const agent = new ChloeAgent({ 
         config: {
           systemPrompt: customPrompt 
         }
       });
       await agent.initialize();
       
       // Use any method that would reflect this change
       expect(agent.getConfig().systemPrompt).toBe(customPrompt);
     });
   });
   ```

2. Test the registry integration:
   ```typescript
   describe('Chloe Registry Integration', () => {
     it('should retrieve the same Chloe instance via registry', async () => {
       // Get via singleton pattern (backward compatibility)
       const agent1 = await getChloeInstance();
       
       // Get via registry directly
       const agent2 = await AgentRegistry.getAgent('chloe');
       
       expect(agent1).toBe(agent2);
     });
     
     it('should create new instance if not in registry', async () => {
       // Clear registry first
       AgentRegistry.clearAgents();
       
       const agent = await getChloeInstance();
       expect(agent).toBeDefined();
       expect(agent.getAgentId()).toBe('chloe');
       
       // Verify it's now in the registry
       const registryAgent = await AgentRegistry.getAgent('chloe');
       expect(registryAgent).toBe(agent);
     });
   });
   ```

## Compatibility Checks

After implementation, verify:

1. All existing API endpoints work correctly
2. UI components display agent data properly
3. Chat functionality works with the refactored Chloe agent
4. Knowledge system continues to work with existing content
5. All Chloe-specific functionality remains accessible through the new class structure

## Rollout Plan

1. Implement changes in a feature branch
2. Create comprehensive tests comparing original and refactored Chloe
3. Deploy to staging environment for validation
4. Roll out to production with feature flags
5. Gradually migrate existing code to the new architecture
6. Monitor for any regression issues after deployment 