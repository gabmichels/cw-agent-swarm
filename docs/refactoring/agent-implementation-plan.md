# Agent Implementation Plan

> ⚠️ **CRITICAL IMPLEMENTATION PROMPT - READ BEFORE ANY WORK**
>
> **CORE PRINCIPLE**: The architecture is in place, but the FUNCTIONALITY MUST MATCH CHLOE'S IMPLEMENTATION 100%
>
> **WHAT WE HAVE**:
> - ✅ Clean architecture with proper interfaces
> - ✅ Manager system with dependency injection
> - ✅ Type-safe implementation structure
> - ✅ Proper inheritance patterns
> - ✅ Many components already implemented but not connected
>
> **WHAT WE'RE MISSING**:
> - ❌ PROPER COMPONENT CONNECTION (THE WIRING)
> - ✅ ACTUAL LLM INTEGRATION (NOT JUST INTERFACES)
> - ❌ Connecting existing memory tagging to active memory systems
> - ❌ Proper activation of existing planning/execution logic
> - ❌ Integration of the EnhancedReflectionManager
>
> **IMPLEMENTATION RULES**:
> 1. **SEARCH BEFORE IMPLEMENTING**: Always search if functionality already exists before implementing new code
> 2. **CONNECT, DON'T RECREATE**: Many components already exist but aren't connected - focus on connecting them
> 3. **MATCH CHLOE**: When implementing any method, reference Chloe's implementation and match its capabilities
> 4. **TEST AGAINST CHLOE**: Every implemented feature must be tested against Chloe's behavior
> 5. **PRESERVE ARCHITECTURE**: Follow IMPLEMENTATION_GUIDELINES.md while implementing real functionality
> 6. **USE COMPOSITION**: Follow the refactoring plan's emphasis on composition over inheritance
>
> **VALIDATION CHECKLIST**:
> For each component implementation:
> - [x] Did we search for existing functionality first?
> - [x] Is the component properly connected to the DefaultAgent?
> - [x] Does it actually call the LLM when needed?
> - [ ] Does it process results like Chloe did?
> - [ ] Does it handle errors and edge cases?
> - [ ] Does it integrate with other components properly?
> - [ ] Does it match Chloe's output quality?
>
> **REMEMBER**: We have a beautiful skeleton and many functional components. Now we need to wire everything together properly to match Chloe's capabilities.

## Overview

This document outlines the detailed technical implementation plan for completing the DefaultAgent implementation to match Chloe's functionality. This plan is based on a thorough audit of both codebases and follows the IMPLEMENTATION_GUIDELINES.md principles.

## 1. LLM Integration and Connection (HIGHEST PRIORITY)

### Current Status
- ✅ DefaultAgent now has LLM initialization and connection
- ✅ Most infrastructure (ChatOpenAI initialization, message formatting) is now connected
- Many components like Executor and MarketScanner already have LLM integration

### Implementation Tasks

1. ✅ **Connect DefaultAgent to Existing LLM Infrastructure**
   ```typescript
   // Add to DefaultAgent class
   private model: ChatOpenAI;
   
   // Update constructor to initialize LLM
   constructor(config: ExtendedAgentConfig) {
     super(agentConfig);
     
     // Use existing createChatOpenAI function from src/lib/core/llm.ts
     this.model = createChatOpenAI({
       modelName: config.modelName || 'gpt-4',
       temperature: config.temperature || 0.7,
       maxTokens: config.maxTokens || 4096
     });
   }
   ```

2. ✅ **Update `processInput` Method to Use LLM**
   ```typescript
   async processInput(input: string, context?: Record<string, unknown>): Promise<string | null> {
     try {
       // Get memory manager
       const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
       if (!memoryManager) {
         throw new Error('Memory manager not initialized');
       }
       
       // Store input with existing memory manager
       await memoryManager.addMemory(input, { type: 'user_input', ...context || {} });
       
       // Create a prompt template to handle interaction with the model
       const prompt = ChatPromptTemplate.fromMessages([
         ["system", "You are a helpful assistant. Provide concise, accurate, and helpful responses."],
         ["human", "{input}"]
       ]);
       
       // Create a chain with the model
       const chain = prompt.pipe(this.model).pipe(new StringOutputParser());
       
       // Process with LLM
       const response = await chain.invoke({ input });
       
       // Store response in memory
       await memoryManager.addMemory(response, { type: 'agent_response', ...context || {} });
       
       return response;
     } catch (error) {
       console.error('Error processing input:', error);
       return null;
     }
   }
   ```

3. ✅ **Connect to Existing Message Formatting Utilities**
   - We implemented a simpler approach using ChatPromptTemplate from LangChain
   - This bypasses the type issues with manual message formatting

### Next Steps
1. ✅ **Fix remaining TypeScript typing issues**
   - ✅ Fixed TypeScript compatibility issues between our local implementation and imported types using type assertions
   - We addressed two main issues:
     1. ✅ AgentStatus enum vs string literal typing - resolved with type assertions (`as any`)
     2. ✅ AgentMemoryEntity type compatibility - resolved with type assertion (`as unknown as AgentBaseConfig`) 
   - ✅ Fixed LangChain model invoke type issues by:
     1. Using a properly typed Chain API with `pipe()` method
     2. Using `@ts-ignore` and type assertions where necessary in helper functions

2. ✅ **Enhance conversation context**
   - ✅ Added support for memory retrieval in processInput
   - ✅ Implemented conversation history in the prompt template
   - Example implementation:
     ```typescript
     async processInput(input: string, context?: Record<string, unknown>): Promise<string | null> {
       // ...existing code...
      
       // Get conversation history from memory manager
       const conversationHistory = await memoryManager.searchMemories('', { 
         metadata: { 
           type: ['user_input', 'agent_response'] 
         },
         limit: 5 
       });
      
       // Format conversation history for the prompt
       const historyMessages = [];
       for (const memory of conversationHistory) {
         if (memory.metadata.type === 'user_input') {
           historyMessages.push(["human", memory.content]);
         } else if (memory.metadata.type === 'agent_response') {
           historyMessages.push(["assistant", memory.content]);
         }
       }
      
       // Create improved prompt template with history
       const prompt = ChatPromptTemplate.fromMessages([
         ["system", "You are a helpful assistant. Provide concise, accurate, and helpful responses."],
         ...historyMessages,
         ["human", "{input}"]
       ]);
      
       // Rest of the method...
     }
     ```

3. **Connect to Tag Extractor**
   - Integrate the existing tag extractor to enhance memory storage
   - This will allow semantic search and better context management

4. **Implement Planner and Executor Integration**
   - Connect DefaultAgent to the existing Planner implementation
   - Integrate with tools through the tool manager

## 2. Executor and Planner Integration (HIGH PRIORITY)

### Current Status
- Planner implementation exists in `src/agents/shared/planning/Planner.ts`
- Executor exists with LLM integration in `src/agents/shared/execution/Executor.ts`
- PlanningManager interface exists with DefaultPlanningManager implementation
- These components aren't properly connected to DefaultAgent

### Implementation Tasks

1. **Connect Planner and Executor to DefaultAgent**
   ```typescript
   // Add to DefaultAgent initialization in initialize() method
   private executor: Executor;
   
   async initialize(): Promise<boolean> {
     // Existing initialization code...
     
     // Initialize Executor with the agent's model
     const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
     if (toolManager) {
       this.executor = new Executor(this.model, toolManager.getToolRouter());
     }
     
     // Connect Planner with memory context
     const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
     if (memoryManager) {
       const planner = new Planner(this.model);
       planner.setMemoryProvider(() => memoryManager.getRecentMemories(10)); 
     }
     
     // ...rest of initialization
   }
   ```

2. **Implement Planning and Execution Methods**
   ```typescript
   async planAndExecute(goal: string, options?: Record<string, unknown>): Promise<PlanAndExecuteResult> {
     try {
       const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
       if (!planningManager) {
         throw new Error('Planning manager not initialized');
       }
       
       // Create plan using existing planning manager
       const plan = await planningManager.createPlan({ goal, context: options || {} });
       
       if (!plan || !plan.planId) {
         throw new Error('Failed to create plan');
       }
       
       // Execute plan using existing execution infrastructure
       return await planningManager.executePlan(plan.planId, options);
     } catch (error) {
       console.error('Error in planAndExecute:', error);
       return {
         success: false,
         error: error instanceof Error ? error.message : String(error)
       };
     }
   }
   ```

3. **Connect to Execution Error Handling and Recovery**
   - Ensure proper error handling using existing mechanisms
   - Add context tracking and state management for complex executions

## 3. Memory System Enhancement and TagExtractor Integration (HIGH PRIORITY)

### Current Status
- Basic memory manager exists and is connected
- TagExtractor exists in `src/utils/tagExtractor.ts` but isn't integrated
- Enhanced memory features exist but aren't properly connected

### Implementation Tasks

1. **Connect TagExtractor to DefaultAgent**
   ```typescript
   import { tagExtractor } from '../../utils/tagExtractor';
   
   // Inside DefaultAgent class
   async addTaggedMemory(content: string, metadata: Record<string, unknown> = {}): Promise<void> {
     const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
     if (!memoryManager) {
       throw new Error('Memory manager not initialized');
     }
     
     // Extract tags using existing tagExtractor
     const taggingResult = await tagExtractor.extractTags(content);
     
     // Add memory with extracted tags
     await memoryManager.addMemory({
       content,
       metadata: {
         ...metadata,
         tags: taggingResult.tags.map(t => t.text),
         entities: taggingResult.entities?.map(e => e.name) || []
       }
     });
   }
   ```

2. **Activate EnhancedMemoryManager**
   ```typescript
   // In DefaultAgent's initialize method
   if (this.extendedConfig.enableMemoryManager) {
     // Check if enhanced memory is enabled
     if (this.extendedConfig.useEnhancedMemory) {
       // Use EnhancedMemoryManager instead of DefaultMemoryManager
       const enhancedMemoryManager = new EnhancedMemoryManager(
         this,
         this.extendedConfig.managersConfig?.memoryManager || {}
       );
       await enhancedMemoryManager.initialize();
       this.registerManager(enhancedMemoryManager);
     } else {
       // Use DefaultMemoryManager (current code)
       const memoryManager = new DefaultMemoryManager(
         this,
         this.extendedConfig.managersConfig?.memoryManager || {}
       );
       await memoryManager.initialize();
       this.registerManager(memoryManager);
     }
   }
   ```

3. **Add Tag-Based and Semantic Retrieval Methods**
   ```typescript
   async getMemoriesByTags(tags: string[], options: { limit?: number } = {}): Promise<AgentMemory[]> {
     const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
     if (!memoryManager) {
       throw new Error('Memory manager not initialized');
     }
     
     // Use enhanced memory search capabilities
     return memoryManager.searchMemories({
       tags,
       limit: options.limit || 10
     });
   }
   ```

## 4. Reflection System Integration (MEDIUM PRIORITY)

### Current Status
- EnhancedReflectionManager exists with full implementation
- DefaultReflectionManager also exists
- Neither is properly connected to the DefaultAgent

### Implementation Tasks

1. **Activate EnhancedReflectionManager**
   ```typescript
   // In DefaultAgent's initialize method
   if (this.extendedConfig.enableReflectionManager) {
     let reflectionManager;
     
     // Check if enhanced reflection is enabled
     if (this.extendedConfig.useEnhancedReflection) {
       // Use EnhancedReflectionManager 
       reflectionManager = new EnhancedReflectionManager(
         this,
         this.extendedConfig.managersConfig?.reflectionManager || {}
       );
     } else {
       // Use DefaultReflectionManager
       reflectionManager = new DefaultReflectionManager(
         this,
         this.extendedConfig.managersConfig?.reflectionManager || {}
       );
     }
     
     await reflectionManager.initialize();
     this.registerManager(reflectionManager);
   }
   ```

2. **Add Reflection Integration Methods**
   ```typescript
   async reflect(options: ReflectionOptions = {}): Promise<ReflectionResult> {
     const reflectionManager = this.getManager<ReflectionManager>(ManagerType.REFLECTION);
     if (!reflectionManager) {
       throw new Error('Reflection manager not initialized');
     }
     
     // Use ReflectionTrigger from the ReflectionManager interface
     return await reflectionManager.reflect(
       options.trigger || ReflectionTrigger.MANUAL,
       options.context || {}
     );
   }
   
   async schedulePeriodicReflection(options: {
     schedule: string;
     name?: string;
     depth?: 'light' | 'standard' | 'deep';
     focusAreas?: string[];
   }): Promise<boolean> {
     const reflectionManager = this.getManager<ReflectionManager>(ManagerType.REFLECTION);
     if (!reflectionManager) {
       throw new Error('Reflection manager not initialized');
     }
     
     // Check if enhanced reflection manager is being used
     if ('schedulePeriodicReflection' in reflectionManager) {
       await (reflectionManager as any).schedulePeriodicReflection(
         options.schedule,
         {
           name: options.name,
           depth: options.depth,
           focusAreas: options.focusAreas
         }
       );
       return true;
     }
     
     return false;
   }
   ```

## 5. Conversation Summarization (MEDIUM PRIORITY)

### Current Status
- Existing components have some summarization capabilities
- No proper LLM-based summarization in DefaultAgent

### Implementation Tasks

1. **Connect DefaultAgent to Existing Summarization Utilities**
   ```typescript
   async summarizeConversation(options: {
     maxEntries?: number;
     format?: 'brief' | 'detailed';
   } = {}): Promise<string> {
     try {
       // Search for existing summarization utilities first
       // Look in reflection manager, memory manager, etc.
       
       // Get memory manager for conversation history
       const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
       if (!memoryManager) {
         throw new Error('Memory manager not initialized');
       }
       
       // Retrieve conversation entries
       const entries = await memoryManager.getMemoriesByTypes(
         ['user_input', 'agent_response'],
         { limit: options.maxEntries || 50 }
       );
       
       if (entries.length === 0) {
         return "No conversation to summarize.";
       }
       
       // Format conversation into proper format for the model
       const conversationText = formatConversationForSummary(entries);
       
       // Use the LLM to generate a summary
       const format = options.format || 'brief';
       const summarizationPrompt = this.createSummarizationPrompt(
         conversationText, 
         format === 'detailed' ? 'detailed' : 'concise'
       );
       
       const response = await this.model.invoke(summarizationPrompt);
       return response.content;
     } catch (error) {
       console.error('Error summarizing conversation:', error);
       return `Error summarizing conversation: ${error instanceof Error ? error.message : String(error)}`;
     }
   }
   
   private createSummarizationPrompt(
     conversationText: string, 
     detailLevel: 'concise' | 'detailed'
   ): ChatMessage[] {
     return [
       { 
         role: 'system', 
         content: `You are an expert summarizer. Create a ${detailLevel} summary of the following conversation. Focus on key points, decisions, and outcomes.` 
       },
       { role: 'user', content: conversationText }
     ];
   }
   ```

## 6. Tool Management Integration (MEDIUM PRIORITY)

### Current Status
- DefaultToolManager exists and is initialized
- ToolRouter exists in src/agents/shared/tools/ToolRouter.ts
- Connection between DefaultAgent and tool selection is incomplete

### Implementation Tasks

1. **Connect DefaultAgent to Existing Tool Infrastructure**
   ```typescript
   async selectToolForTask(task: string, availableTools?: AgentTool[]): Promise<AgentTool | null> {
     const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
     if (!toolManager) {
       return null;
     }
     
     // Get available tools if not provided
     const tools = availableTools || await toolManager.getTools();
     
     // LLM-based tool selection using existing infrastructure
     // First look for any existing implementations in the codebase
     
     // Use ToolRouter's selection capabilities if available
     if (toolManager.getToolRouter && typeof toolManager.getToolRouter === 'function') {
       const toolRouter = toolManager.getToolRouter();
       if (toolRouter && typeof toolRouter.selectToolForTask === 'function') {
         return await toolRouter.selectToolForTask(task, tools);
       }
     }
     
     // Fallback to direct LLM-based selection
     return await this.selectToolWithLLM(task, tools);
   }
   
   private async selectToolWithLLM(task: string, tools: AgentTool[]): Promise<AgentTool | null> {
     try {
       // Format tools into a prompt for the LLM
       const toolDescriptions = tools.map(tool => 
         `${tool.name}: ${tool.description}`
       ).join('\n');
       
       const messages = [
         {
           role: 'system',
           content: 'Select the most appropriate tool for the given task. Respond with just the tool name.'
         },
         {
           role: 'user',
           content: `Task: ${task}\n\nAvailable tools:\n${toolDescriptions}`
         }
       ];
       
       const response = await this.model.invoke(messages);
       const selectedToolName = response.content.trim();
       
       // Find the selected tool
       return tools.find(tool => 
         tool.name.toLowerCase() === selectedToolName.toLowerCase()
       ) || null;
     } catch (error) {
       console.error('Error selecting tool with LLM:', error);
       return null;
     }
   }
   ```

2. **Connect to Existing Tool Execution Infrastructure**
   ```typescript
   async executeTool(toolId: string, params: Record<string, any>): Promise<ToolExecutionResult> {
     const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
     if (!toolManager) {
       throw new Error('Tool manager not initialized');
     }
     
     try {
       // Use existing tool execution infrastructure
       return await toolManager.executeTool(toolId, params);
     } catch (error) {
       // Handle tool execution errors
       console.error(`Error executing tool ${toolId}:`, error);
       return {
         success: false,
         toolId,
         error: {
           message: error instanceof Error ? error.message : String(error),
           code: error instanceof AppError ? error.code : 'EXECUTION_ERROR'
         }
       };
     }
   }
   ```

## 7. Knowledge Management Integration (MEDIUM PRIORITY)

### Current Status
- DefaultKnowledgeManager exists and is initialized
- Knowledge integration needs enhancement
- Connection to DefaultAgent is incomplete

### Implementation Tasks

1. **Connect DefaultAgent to Existing Knowledge Infrastructure**
   ```typescript
   async retrieveRelevantKnowledge(
     query: string, 
     options: { limit?: number; threshold?: number } = {}
   ): Promise<KnowledgeItem[]> {
     const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
     if (!knowledgeManager) {
       throw new Error('Knowledge manager not initialized');
     }
     
     // Use existing knowledge search
     return await knowledgeManager.searchKnowledge(query, {
       limit: options.limit || 5,
       threshold: options.threshold || 0.7
     });
   }
   
   async addKnowledgeWithTags(
     item: Omit<KnowledgeItem, 'id' | 'tags'>
   ): Promise<string> {
     const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
     if (!knowledgeManager) {
       throw new Error('Knowledge manager not initialized');
     }
     
     // Extract tags using tagExtractor
     const taggingResult = await tagExtractor.extractTags(item.content);
     
     // Add knowledge with extracted tags
     return await knowledgeManager.addKnowledgeItem({
       ...item,
       tags: taggingResult.tags.map(t => t.text)
     });
   }
   ```

## 8. Component Wiring and Verification (HIGH PRIORITY)

### Current Status
- Interfaces and implementations exist but connections are incomplete
- Components don't share state and context properly
- Missing integration between components

### Implementation Tasks

1. **Setup Manager Communication Channels**
   ```typescript
   // In DefaultAgent initialization
   async initialize(): Promise<boolean> {
     try {
       // Initialize all managers first
       // ...existing initialization code...
       
       // Now set up communication channels between managers
       this.wireManagersTogether();
       
       this.initialized = true;
       return true;
     } catch (error) {
       console.error('Error initializing agent:', error);
       return false;
     }
   }
   
   private wireManagersTogether(): void {
     // Connect memory manager to reflection manager
     const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
     const reflectionManager = this.getManager<ReflectionManager>(ManagerType.REFLECTION);
     
     if (memoryManager && reflectionManager) {
       // If EnhancedReflectionManager has setMemoryProvider method, use it
       if ('setMemoryProvider' in reflectionManager) {
         (reflectionManager as any).setMemoryProvider(() => 
           memoryManager.getRecentMemories(50)
         );
       }
     }
     
     // Connect knowledge manager to memory manager
     const knowledgeManager = this.getManager<KnowledgeManager>(ManagerType.KNOWLEDGE);
     if (memoryManager && knowledgeManager) {
       // Connect memory search to knowledge retrieval if possible
       // ...
     }
     
     // Connect planning manager to tool manager
     const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
     const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
     
     if (planningManager && toolManager) {
       // Provide planning manager with tool access if needed
       if ('setToolProvider' in planningManager) {
         (planningManager as any).setToolProvider(() => 
           toolManager.getTools()
         );
       }
     }
     
     // Wire scheduler with other components
     const schedulerManager = this.getManager<SchedulerManager>(ManagerType.SCHEDULER);
     if (schedulerManager) {
       // Connect scheduler to other managers as needed
     }
   }
   ```

2. **Create Verification Method**
   ```typescript
   async verifyComponentConnections(): Promise<Record<string, boolean>> {
     const results: Record<string, boolean> = {};
     
     // Verify memory manager
     try {
       const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
       if (memoryManager) {
         await memoryManager.addMemory({ content: 'Test memory', metadata: {} });
         const memories = await memoryManager.getRecentMemories(1);
         results['memoryManager'] = memories.length > 0;
       } else {
         results['memoryManager'] = false;
       }
     } catch (error) {
       console.error('Memory manager verification failed:', error);
       results['memoryManager'] = false;
     }
     
     // Verify other components in a similar way
     // ...verification code for other managers...
     
     return results;
   }
   ```

## 9. Testing and Validation (REQUIRED)

### Implementation Tasks

1. **Create Testing Scripts**
   ```typescript
   // In a test file
   describe('DefaultAgent Integration Tests', () => {
     let agent: DefaultAgent;
     
     beforeEach(async () => {
       agent = new DefaultAgent({
         enableMemoryManager: true,
         enablePlanningManager: true,
         enableToolManager: true,
         enableKnowledgeManager: true,
         enableReflectionManager: true,
         enableSchedulerManager: true,
         useEnhancedMemory: true,
         useEnhancedReflection: true
       });
       
       await agent.initialize();
     });
     
     test('LLM integration works properly', async () => {
       const response = await agent.processInput('Hello, how are you?');
       expect(response).toBeTruthy();
       expect(typeof response).toBe('string');
     });
     
     test('Memory tagging works correctly', async () => {
       await agent.addTaggedMemory('This is about artificial intelligence and machine learning.');
       
       const memories = await agent.getMemoriesByTags(['artificial intelligence']);
       expect(memories.length).toBeGreaterThan(0);
     });
     
     // Add more tests for other component integrations
   });
   ```

2. **Validation against Chloe**
   - Create comparison tests between DefaultAgent and Chloe
   - Verify that outputs match in quality and functionality
   - Test error handling and edge cases

## Implementation Phases and Priorities

### Phase 1: Core Wiring and LLM Integration
- Connect DefaultAgent to existing LLM infrastructure in the codebase
- Wire DefaultAgent to the Executor and Planner
- Set up proper message handling and conversation context

### Phase 2: Manager Activation and Integration
- Activate EnhancedMemoryManager with tagExtractor integration
- Connect EnhancedReflectionManager
- Set up communication channels between managers

### Phase 3: Component Connection Verification
- Implement verification methods to test connections
- Fix any missing connections or integration issues
- Create comprehensive tests for all connections

### Phase 4: Feature Parity Testing
- Test DefaultAgent against Chloe for functionality matching
- Address any missing functionality or performance gaps
- Fine-tune connections for optimal performance

## Conclusion

This updated implementation plan focuses on connecting existing components rather than reimplementing what already exists. By following the architecture established in the AGENT_MANAGER_REFACTORING.md and leveraging the comprehensive components already built, we can efficiently create a fully functional DefaultAgent that matches Chloe's capabilities while maintaining the clean architecture principles.

The emphasis is on proper wiring of components, following composition over inheritance principles, and ensuring that all managers work together seamlessly. This approach saves development time while ensuring that the DefaultAgent delivers all the functionality that Chloe provides. 