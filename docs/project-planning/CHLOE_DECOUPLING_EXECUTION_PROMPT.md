# Chloe Decoupling Execution Prompt

## Context

We need to decouple the Chloe agent from our codebase to create a generic agent architecture that supports multiple agents. After reviewing the codebase, we discovered we already have `AgentBase` and `AgentFactory` implementations we can leverage. This prompt provides a structured approach to executing this project efficiently.

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
   - Add fields for all agent configuration options
   - Include system prompt customization
   - Support capability selection
   - Add knowledge upload functionality

2. Create agent instance creation flow:
   - Connect registration form to agent factory
   - Implement configuration validation
   - Create proper error handling

3. Implement Chloe recreation feature:
   - Create a "Load Chloe Template" option
   - Pre-populate form with Chloe's configuration
   - Allow customization of Chloe template

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