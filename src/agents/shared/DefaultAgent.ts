import { v4 as uuidv4 } from 'uuid';
import { AbstractAgentBase } from './base/AbstractAgentBase';
import { AgentBaseConfig } from './base/types';
import { DefaultMemoryManager } from '../../lib/agents/implementations/managers/DefaultMemoryManager';
import { DefaultPlanningManager } from '../../lib/agents/implementations/managers/DefaultPlanningManager';
import { DefaultToolManager } from '../../lib/agents/implementations/managers/DefaultToolManager';
import { DefaultKnowledgeManager } from '../../lib/agents/implementations/managers/DefaultKnowledgeManager';
import { DefaultSchedulerManager } from '../../lib/agents/implementations/managers/DefaultSchedulerManager';
import { BaseManager } from './base/managers/BaseManager';
import { ManagerConfig } from './base/managers/BaseManager';
import { ResourceUtilizationTracker, ResourceUtilizationTrackerOptions, ResourceUsageListener } from './scheduler/ResourceUtilization';
import { TaskCreationOptions, TaskCreationResult, ScheduledTask, TaskExecutionResult } from './base/managers/SchedulerManager.interface';
import { ManagerType } from './base/managers/ManagerType';
import { MemoryManager } from './base/managers/MemoryManager.interface';
import { ChatOpenAI } from '@langchain/openai';
import { createChatOpenAI } from '../../lib/core/llm';
import { formatConversationToMessages } from './messaging/formatters';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { tagExtractor } from '../../utils/tagExtractor';
import { EnhancedMemoryManager } from './memory/managers/EnhancedMemoryManager';
import { Executor } from './execution/Executor';
import { ToolManager } from './base/managers/ToolManager.interface';
import { Planner } from './planning/Planner';
import { PlanningManager } from './base/managers/PlanningManager.interface';
import { PlanCreationOptions, PlanCreationResult, PlanExecutionResult } from './base/managers/PlanningManager.interface';
import { ReflectionManager, ReflectionTrigger, ReflectionResult, ReflectionInsight } from './base/managers/ReflectionManager.interface';
import { EnhancedReflectionManager } from './reflection/managers/EnhancedReflectionManager';
import { DefaultReflectionManager } from './reflection/managers/DefaultReflectionManager';
import { ExecutionErrorHandler } from './execution/ExecutionErrorHandler';
import { ToolRouter, ToolDefinition } from './tools/ToolRouter';
import { PromptFormatter, PersonaInfo, SystemPromptOptions, InputPromptOptions, ScoredMemory } from '../../agents/shared/messaging/PromptFormatter';
import { RelevanceScorer, RelevantMemoryOptions } from './memory/RelevanceScorer';
import { AgentCapability, CapabilityType } from './capability-system/types';

// Define the necessary types that we need
const AGENT_STATUS = {
  AVAILABLE: 'available',
  BUSY: 'busy',
  OFFLINE: 'offline'
} as const;

// Simple implementation of agent memory entity for local usage
interface AgentMemoryEntity {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  capabilities: string[];
  parameters: Record<string, any>;
  status: string; // Using string type to bypass type checking
  lastActive: Date;
  chatIds: string[];
  teamIds: string[];
  metadata: Record<string, any>;
  content: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
  schemaVersion: string;
}

// Function to create agent ID for local usage
function createAgentId(): string {
  return uuidv4();
}

// Since we can't import the specific input/output processors directly due to type issues,
// we'll use more generic types to avoid linter errors
type InputProcessorConfig = ManagerConfig;
type OutputProcessorConfig = ManagerConfig;
type InputProcessor = BaseManager;
type OutputProcessor = BaseManager;

// Extended agent config with manager enablement and configuration
interface ExtendedAgentConfig {
  /** Optional agent name */
  name?: string;
  
  /** Optional agent description */
  description?: string;
  
  // LLM configuration
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Manager enablement flags
  enableMemoryManager?: boolean;
  enablePlanningManager?: boolean;
  enableToolManager?: boolean;
  enableKnowledgeManager?: boolean;
  enableSchedulerManager?: boolean;
  enableInputProcessor?: boolean;
  enableOutputProcessor?: boolean;
  enableResourceTracking?: boolean;
  enableReflectionManager?: boolean;
  
  // Enhanced manager flags
  useEnhancedMemory?: boolean;
  useEnhancedReflection?: boolean;
  
  // Behavior configuration
  adaptiveBehavior?: boolean;
  
  // Persona and system prompt configuration
  systemPrompt?: string;
  persona?: PersonaInfo;
  
  // Memory refresh configuration
  memoryRefresh?: {
    /** Enable periodic memory refreshing */
    enabled: boolean;
    /** Interval in milliseconds between refreshes */
    interval: number;
    /** Maximum number of critical memories to include */
    maxCriticalMemories: number;
  };
  
  // Manager configurations
  managersConfig?: {
    memoryManager?: ManagerConfig;
    planningManager?: ManagerConfig;
    toolManager?: ManagerConfig;
    knowledgeManager?: ManagerConfig;
    schedulerManager?: ManagerConfig;
    inputProcessor?: InputProcessorConfig;
    outputProcessor?: OutputProcessorConfig;
    resourceTracker?: Partial<ResourceUtilizationTrackerOptions>;
    reflectionManager?: ManagerConfig;
    [key: string]: ManagerConfig | Record<string, unknown> | undefined;
  };
}

/**
 * Default Agent implementation
 * A general-purpose agent that can be used for various tasks
 */
export class DefaultAgent extends AbstractAgentBase implements ResourceUsageListener {
  private extendedConfig: ExtendedAgentConfig;
  private resourceTracker: ResourceUtilizationTracker | null = null;
  private agentId: string;
  private agentType: string = 'default';
  private version: string = '1.0.0';
  private model: ChatOpenAI;
  private executor: Executor | null = null;
  private planner: Planner | null = null;
  protected schedulerManager?: DefaultSchedulerManager;
  protected initialized: boolean = false;
  private executionErrorHandler: ExecutionErrorHandler | null = null;
  private memoryRefreshInterval: NodeJS.Timeout | null = null;
  private lastMemoryRefreshTime: Date | null = null;
  
  /**
   * Create a new DefaultAgent
   * @param config Agent configuration
   */
  constructor(config: ExtendedAgentConfig) {
    // Create AgentMemoryEntity from ExtendedAgentConfig
    const agentId = createAgentId().toString();
    const agentConfig: AgentMemoryEntity = {
      id: agentId,
      name: 'Default Agent',
      description: 'A general-purpose agent that can be used for various tasks',
      createdBy: 'system',
      capabilities: [],
      parameters: {
        model: config.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
        temperature: config.temperature || 0.7,
        maxTokens: config.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000),
        tools: []
      },
      status: AGENT_STATUS.AVAILABLE,
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      metadata: {
        tags: [],
        domain: [],
        specialization: [],
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: '1.0.0',
        isPublic: false
      },
      content: '',
      type: 'agent',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: '1.0'
    };
    
    // Pass the base config to AbstractAgentBase with type assertion to bypass type checking
    super(agentConfig as unknown as AgentBaseConfig);
    
    // Store extended config for use in initialization
    this.extendedConfig = config;
    this.agentId = agentId;
    
    // Initialize LLM using existing createChatOpenAI from lib/core/llm.ts
    this.model = createChatOpenAI({
      model: config.modelName || process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || (process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000)
    });
  }

  /**
   * Get the agent's unique identifier
   */
  getId(): string {
    return this.agentId;
  }

  /**
   * Get the agent's type
   */
  getType(): string {
    return this.agentType;
  }

  /**
   * Get the agent's description
   */
  getDescription(): string {
    return 'A general-purpose agent that can be used for various tasks';
  }

  /**
   * Get the agent's version
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get the agent's capabilities
   */
  async getCapabilities(): Promise<string[]> {
    return [
      'memory_management',
      'planning',
      'tool_usage',
      'knowledge_management',
      'scheduling'
    ];
  }

  /**
   * Get the agent's configuration
   */
  getConfig(): Record<string, unknown> {
    return {
      id: this.agentId,
      name: this.agentType,
      description: this.getDescription(),
      version: this.version,
      capabilities: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      status: this.config.status,
      type: this.agentType,
      config: this.extendedConfig,
      metadata: {
        tags: [],
        domain: [],
        specialization: [],
        performanceMetrics: {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        version: this.version,
        isPublic: false
      },
      parameters: {
        model: process.env.OPENAI_MODEL_NAME || 'gpt-4.1-2025-04-14',
        temperature: this.extendedConfig.temperature || 0.7,
        maxTokens: process.env.OPENAI_MAX_TOKENS ? parseInt(process.env.OPENAI_MAX_TOKENS, 10) : 32000,
        tools: []
      },
      lastActive: new Date(),
      chatIds: [],
      teamIds: [],
      content: '',
      schemaVersion: '1.0'
    } as Record<string, unknown>;
  }

  /**
   * Get agent status
   */
  getStatus(): { status: string; message?: string } {
    if (!this.initialized) {
      return {
        status: AGENT_STATUS.OFFLINE,
        message: 'Agent not initialized'
      };
    }

    if (this.schedulerManager) {
      return {
        status: AGENT_STATUS.BUSY,
        message: 'Processing active tasks'
      };
    }

    return {
      status: AGENT_STATUS.AVAILABLE,
      message: 'Ready to process tasks'
    };
  }

  /**
   * Reset the agent to its initial state
   */
  async reset(): Promise<void> {
    try {
      // Reset all managers
      for (const manager of Array.from(this.managers.values())) {
        await manager.reset();
      }
      
      // Reset resource tracker
      if (this.resourceTracker) {
        this.resourceTracker.stop();
        this.resourceTracker = null;
      }
      
      // Reset status
      this.config.status = AGENT_STATUS.AVAILABLE as any;
    } catch (error) {
      console.error('Error resetting agent:', error);
      throw error;
    }
  }

  /**
   * Get a manager by type
   */
  getManager<T extends BaseManager>(managerType: ManagerType): T | null {
    const manager = this.managers.get(managerType);
    return manager ? manager as T : null;
  }

  /**
   * Get all managers
   */
  getManagers(): BaseManager[] {
    return Array.from(this.managers.values());
  }

  /**
   * Set a manager for the agent
   */
  setManager(manager: BaseManager): void {
    this.managers.set(manager.managerType, manager);
  }

  /**
   * Remove a manager from the agent
   */
  removeManager(managerType: ManagerType): void {
    this.managers.delete(managerType);
  }

  /**
   * Check if the agent has a specific manager
   */
  hasManager(managerType: ManagerType): boolean {
    return this.managers.has(managerType);
  }

  /**
   * Get all tasks for this agent
   */
  async getTasks(): Promise<Record<string, unknown>[]> {
    if (!this.schedulerManager) {
      return [];
    }
    const tasks = await this.schedulerManager.getAllTasks();
    return tasks.map(task => ({ ...task } as Record<string, unknown>));
  }

  /**
   * Initialize the agent by setting up required managers
   */
  async initialize(): Promise<boolean> {
    try {
      // Register all managers based on configuration
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
          // Use DefaultMemoryManager
          const memoryManager = new DefaultMemoryManager(
            this, 
            this.extendedConfig.managersConfig?.memoryManager || {}
          );
          await memoryManager.initialize();
          this.registerManager(memoryManager);
        }
      }

      if (this.extendedConfig.enablePlanningManager) {
        const planningManager = new DefaultPlanningManager(
          this,
          this.extendedConfig.managersConfig?.planningManager || {}
        );
        await planningManager.initialize();
        this.registerManager(planningManager);
        
        // Initialize the Planner with the agent's model
        this.planner = new Planner();
      }

      if (this.extendedConfig.enableToolManager) {
        const toolManager = new DefaultToolManager(
          this,
          this.extendedConfig.managersConfig?.toolManager || {}
        );
        await toolManager.initialize();
        this.registerManager(toolManager);
        
        // Initialize executor with error handling
        this.setupExecutor();
      }

      if (this.extendedConfig.enableKnowledgeManager) {
        const knowledgeManager = new DefaultKnowledgeManager(
          this,
          this.extendedConfig.managersConfig?.knowledgeManager || {}
        );
        await knowledgeManager.initialize();
        this.registerManager(knowledgeManager);
      }

      if (this.extendedConfig.enableReflectionManager) {
        // Check if enhanced reflection is enabled
        if (this.extendedConfig.useEnhancedReflection) {
          // Use EnhancedReflectionManager 
          const reflectionManager = new EnhancedReflectionManager(
            this,
            this.extendedConfig.managersConfig?.reflectionManager || {}
          );
          await reflectionManager.initialize();
          this.registerManager(reflectionManager);
        } else {
          // Use DefaultReflectionManager
          const reflectionManager = new DefaultReflectionManager(
            this,
            this.extendedConfig.managersConfig?.reflectionManager || {}
          );
          await reflectionManager.initialize();
          this.registerManager(reflectionManager);
        }
      }

      if (this.extendedConfig.enableSchedulerManager) {
        this.schedulerManager = new DefaultSchedulerManager(
          this,
          this.extendedConfig.managersConfig?.schedulerManager || {}
        );
        await this.schedulerManager.initialize();
        this.registerManager(this.schedulerManager);
        
        // Initialize resource utilization tracking if enabled
        if (this.extendedConfig.enableResourceTracking) {
          this.initializeResourceTracking();
        }
      }

      // For now we'll skip input/output processor initialization due to type issues
      // We'll implement them properly when needed for actual input/output processing

      // Wire managers together
      this.wireManagersTogether();

      // Set up memory refresh if enabled
      if (this.extendedConfig.memoryRefresh?.enabled) {
        this.setupMemoryRefresh();
      }

      return super.initialize();
    } catch (error) {
      console.error('Error initializing DefaultAgent:', error);
      return false;
    }
  }

  /**
   * Wire managers together to enable communication
   */
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
    
    // Connect planning manager with memory context
    // Note: Planner class in our system doesn't have setMemoryProvider method
    // We'll need to expand the Planner implementation later
    
    // Connect other managers as needed
  }

  /**
   * Initialize resource utilization tracking
   */
  private initializeResourceTracking(): void {
    if (!this.schedulerManager) {
      console.warn('Cannot initialize resource tracking: Scheduler manager not available');
      return;
    }
    
    try {
      // Create the resource tracker with config
      this.resourceTracker = new ResourceUtilizationTracker(
        this.extendedConfig.managersConfig?.resourceTracker || {}
      );
      
      // Register this agent as a listener
      this.resourceTracker.addListener(this);
      
      // Start tracking
      this.resourceTracker.start();
      
      console.log(`[${this.getAgentId()}] Resource utilization tracking initialized`);
    } catch (error) {
      console.error('Error initializing resource tracking:', error);
    }
  }

  /**
   * Set up periodic memory refreshing
   */
  private setupMemoryRefresh(): void {
    if (!this.extendedConfig.memoryRefresh?.enabled) {
      return;
    }
    
    const interval = this.extendedConfig.memoryRefresh.interval || 3600000; // Default to 1 hour
    
    // Clear any existing interval
    if (this.memoryRefreshInterval) {
      clearInterval(this.memoryRefreshInterval);
    }
    
    // Set up new interval
    this.memoryRefreshInterval = setInterval(async () => {
      try {
        await this.refreshCriticalMemories();
      } catch (error) {
        console.error('Error refreshing critical memories:', error);
      }
    }, interval);
    
    console.log(`Memory refresh scheduled every ${interval / 60000} minutes`);
  }
  
  /**
   * Refresh critical memories
   */
  async refreshCriticalMemories(): Promise<void> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      console.warn('Cannot refresh memories: Memory manager not initialized');
      return;
    }
    
    try {
      // Get critical memories
      const criticalMemories = await memoryManager.searchMemories('', {
        metadata: { type: 'critical_memory' },
        limit: this.extendedConfig.memoryRefresh?.maxCriticalMemories || 10
      });
      
      if (criticalMemories.length === 0) {
        console.log('No critical memories to refresh');
        return;
      }
      
      // Create a summary of critical memories
      const memorySummary = criticalMemories
        .map(memory => `- ${memory.content}`)
        .join('\n');
      
      // Store memory refresher as a system message
      await memoryManager.addMemory(
        `MEMORY REFRESH: The following critical information is important to remember:\n\n${memorySummary}`,
        {
          type: 'system_message',
          subtype: 'memory_refresh',
          timestamp: new Date(),
          critical: true
        }
      );
      
      this.lastMemoryRefreshTime = new Date();
      console.log(`Refreshed ${criticalMemories.length} critical memories`);
    } catch (error) {
      console.error('Error during memory refresh:', error);
    }
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    // Stop memory refresh if active
    if (this.memoryRefreshInterval) {
      clearInterval(this.memoryRefreshInterval);
      this.memoryRefreshInterval = null;
    }
    
    // Stop resource tracking if active
    if (this.resourceTracker) {
      this.resourceTracker.stop();
      this.resourceTracker = null;
    }
    
    // Shutdown the executor if initialized
    if (this.executor) {
      await this.executor.shutdown();
    }
    
    // Shutdown all registered managers
    await this.shutdownManagers();
    
    // Set agent status to offline
    this.config.status = AGENT_STATUS.OFFLINE as any;
  }

  /**
   * Format messages for vision model by converting image attachments
   * Uses base64 encoding to ensure OpenAI can directly access the images
   */
  private formatMessagesForVision(
    messages: Array<SystemMessage | HumanMessage | AIMessage>,
    attachments: Array<any> = []
  ): Array<SystemMessage | HumanMessage | AIMessage> {
    // We only need to modify the last user message (which should be the current input)
    const lastMessageIndex = messages.length - 1;
    
    if (lastMessageIndex < 0 || !(messages[lastMessageIndex] instanceof HumanMessage)) {
      return messages;
    }
    
    // Get image attachments
    const imageAttachments = attachments?.filter(att => att.is_image_for_vision) || [];
    
    if (imageAttachments.length === 0) {
      return messages;
    }
    
    // Get the text content from the last message
    const lastMessageText = messages[lastMessageIndex].content.toString();
    
    // Create new content array for the vision model
    const visionContent: any[] = [
      { type: 'text', text: lastMessageText }
    ];
    
    // Fallback placeholder image data URL (a 1x1 transparent PNG)
    const PLACEHOLDER_IMAGE_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    
    // Track if any image was successfully processed
    let anyImageProcessed = false;
    
    // Add image attachments with base64 data if available, falling back to URLs
    for (const image of imageAttachments) {
      // Check for base64 data first
      if (image.vision_data?.base64Data) {
        const mimeType = image.mimeType || 'image/png';
        visionContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${image.vision_data.base64Data}`,
            detail: image.vision_data.detail || 'high'
          }
        });
        console.log('Using base64 data for image processing');
        anyImageProcessed = true;
      } 
      // Fall back to URL if base64 is not available
      else if (image.vision_data?.url) {
        // Convert relative URLs to absolute URLs for OpenAI's vision API
        let imageUrl = image.vision_data.url;
        
        // Check if URL is relative (starts with /)
        if (imageUrl.startsWith('/')) {
          // Create an absolute URL using the origin from the environment
          // Use NEXTAUTH_URL, VERCEL_URL, or default to localhost
          const baseUrl = process.env.NEXTAUTH_URL || 
                         (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
          
          // Remove any trailing slash from baseUrl
          const baseUrlNormalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          
          // Create full absolute URL
          imageUrl = `${baseUrlNormalized}${imageUrl}`;
          
          console.log(`Converting relative URL to absolute: ${image.vision_data.url} -> ${imageUrl}`);
        }
        
        try {
          visionContent.push({
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: image.vision_data.detail || 'high'
            }
          });
          anyImageProcessed = true;
        } catch (error) {
          console.error(`Error adding image URL to vision content: ${error}`);
          // Continue to next image on error
        }
      }
    }
    
    // If no images were successfully processed, add a placeholder image with error message
    if (imageAttachments.length > 0 && !anyImageProcessed) {
      console.log('No images could be processed, adding placeholder image');
      visionContent.push({
        type: 'image_url',
        image_url: {
          url: PLACEHOLDER_IMAGE_DATA_URL,
          detail: 'low'
        }
      });
      
      // Also add a text explanation that the image couldn't be processed
      visionContent[0].text += "\n\n[NOTE: The image(s) you uploaded couldn't be processed properly, I'm seeing a placeholder instead. Could you please try uploading it again in a different format?]";
    }
    
    // Replace the last message with the new format
    const newMessages = [...messages];
    newMessages[lastMessageIndex] = new HumanMessage({ content: visionContent as any });
    
    return newMessages;
  }

  /**
   * Process an input message with vision model support
   * Properly handles image attachments and provides fallback mechanisms
   */
  private async processWithVisionModel(
    messages: Array<SystemMessage | HumanMessage | AIMessage>,
    attachments: Array<any> = []
  ): Promise<string> {
    try {
      // Format messages for vision API with proper error handling
      const visionMessages = this.formatMessagesForVision(messages, attachments);
      
      // Create a vision-capable model with appropriate configuration
      const visionModel = new ChatOpenAI({
        modelName: process.env.VISION_MODEL_NAME || 'gpt-4.1-mini-2025-04-14',
        temperature: this.extendedConfig.temperature || 0.7,
        maxTokens: this.extendedConfig.maxTokens || 1000,
        // Add timeout and retry options for robustness
        timeout: 120000, // 2 minute timeout for image processing
      });
      
      // Log the number of messages and presence of image data
      const imageCount = visionMessages.reduce((count, msg) => {
        if (msg instanceof HumanMessage && Array.isArray(msg.content)) {
          return count + msg.content.filter(c => c.type === 'image_url').length;
        }
        return count;
      }, 0);
      
      console.log(`Invoking vision model with ${imageCount} images`);
      
      // Process with vision model
      try {
        const visionResponse = await (visionModel as any).invoke(visionMessages);
        return visionResponse.content.toString();
      } catch (error) {
        console.error('Error during vision model call:', error);
        
        // Provide a proper fallback response
        if (error instanceof Error && 
            (error.message.includes('invalid_image_url') || 
             error.message.includes('downloading'))) {
          return "I received your image, but I'm having trouble accessing it. This might be due to an issue with the image format or server access. Could you try sending it again, possibly in a different format (like PNG or JPEG)?";
        }
        
        // Generic error response if error type is unknown
        return "I received your message with images, but encountered a technical issue while analyzing them. Please try again with a simpler image or a different format.";
      }
    } catch (error) {
      console.error('Error in vision processing:', error);
      return "I encountered an unexpected error while processing your message with images. Please try again with a simpler request or without images.";
    }
  }

  async processInput(input: string, context?: Record<string, unknown>): Promise<string | null> {
    try {
      // Get memory manager
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      if (!memoryManager) {
        throw new Error('Memory manager not initialized');
      }
      
      // Store input as a memory with tags
      await this.addTaggedMemory(input, { type: 'user_input', ...context || {} });
      
      // Create a relevance scorer
      const relevanceScorer = new RelevanceScorer(memoryManager, this.extendedConfig.modelName || process.env.OPENAI_MODEL_NAME);
      
      // Get relevant memories for this input
      const relevantMemoryOptions: RelevantMemoryOptions = {
        query: input,
        limit: 10,
        includeCritical: true,
        minRelevance: 0.3,
        tags: context?.tags as string[] || []
      };
      
      // Get relevant memories
      const relevantMemories = await relevanceScorer.getRelevantMemories(relevantMemoryOptions);
      
      // Get conversation history from memory manager
      const conversationHistory = await memoryManager.searchMemories('', { 
        metadata: { 
          type: ['user_input', 'agent_response'] 
        },
        limit: 10 
      });
      
      // Format conversation history using the PromptFormatter
      // Cast the conversationHistory to the expected format to fix type errors
      const formattedHistory = PromptFormatter.formatConversationHistory(
        conversationHistory.map(mem => ({
          content: mem.content,
          metadata: {
            ...mem.metadata as Record<string, any>,
            type: (mem.metadata as Record<string, unknown>).type as string
          }
        }))
      );
      
      // Get agent capabilities for context
      const capabilities = await this.getCapabilities();
      
      // Check for customInstructions in parameters
      const customInstructions = this.config.parameters?.customInstructions || 
                               (context?.persona as Record<string, any>)?.systemPrompt || 
                               this.extendedConfig.systemPrompt || 
                               "You are a helpful assistant. Provide concise, accurate, and helpful responses.";
      
      // Check for persona data in metadata
      const metadataPersona = this.config.metadata?.persona || {};
      
      // Merge persona information from all sources, prioritizing context
      const persona: PersonaInfo = {
        ...(metadataPersona as Record<string, any>),
        ...(this.extendedConfig.persona || {}),
        ...(context?.persona as Record<string, any> || {})
      };
      
      // Build the system prompt with persona information if available
      const systemPromptOptions: SystemPromptOptions = {
        basePrompt: customInstructions,
        persona: persona,
        includeCapabilities: true,
        additionalContext: [
          `Available capabilities: ${capabilities.join(', ')}`
        ]
      };
      
      // Format the system prompt
      let systemPrompt = PromptFormatter.formatSystemPrompt(systemPromptOptions);
      
      // Add thinking results to the system prompt if available
      if (context?.thinkingResults) {
        const thinkingResults = context.thinkingResults as Record<string, any>;
        systemPrompt += '\n\n## THINKING ANALYSIS RESULTS';
        
        if (thinkingResults.intent) {
          systemPrompt += `\n\nDetected intent: ${thinkingResults.intent}`;
        }
        
        if (thinkingResults.entities && Array.isArray(thinkingResults.entities)) {
          systemPrompt += '\n\nDetected entities:';
          for (const entity of thinkingResults.entities) {
            systemPrompt += `\n- ${entity.text} (${entity.type})`;
          }
        }
        
        if (thinkingResults.planSteps && Array.isArray(thinkingResults.planSteps)) {
          systemPrompt += '\n\nExecution plan:';
          for (const step of thinkingResults.planSteps) {
            systemPrompt += `\n- ${step}`;
          }
        }
        
        // Add memory context if available
        if (context.formattedMemoryContext) {
          systemPrompt += '\n\n## RELEVANT MEMORY CONTEXT';
          systemPrompt += `\n\n${context.formattedMemoryContext}`;
        }
        
        if (context.processingInstructions && Array.isArray(context.processingInstructions)) {
          systemPrompt += '\n\n## RESPONSE INSTRUCTIONS';
          for (const instruction of context.processingInstructions as string[]) {
            systemPrompt += `\n- ${instruction}`;
          }
        }

        // Make sure to reference original message for context
        if (context.originalMessage) {
          systemPrompt += `\n\nOriginal user message: "${context.originalMessage}"`;
        }
      }

      // Add vision-specific handling for image attachments
      const hasImageAttachments = context?.attachments && 
        Array.isArray(context.attachments) && 
        context.attachments.some(att => att.is_image_for_vision === true);
      
      // Add vision model capabilities to system prompt if needed
      if (hasImageAttachments || context?.useVisionModel) {
        systemPrompt += '\n\n## VISION CAPABILITIES\nYou have vision capabilities and can analyze images. When responding to images:' +
          '\n- Provide detailed descriptions of what you see in the images' +
          '\n- Pay attention to visual details, text, objects, people, and other elements' +
          '\n- Reference specific elements of the images when relevant to your response' +
          '\n- Be concise but thorough in your analysis';
      }
      
      // Create input prompt options
      const inputPromptOptions: InputPromptOptions = {
        input,
        conversationHistory: formattedHistory,
        maxHistoryMessages: 8, // Reduced to allow room for memories
        includeRelevantMemories: true,
        relevantMemories,
        inputContext: context
      };
      
      // Create chat messages using the formatter
      const messages = PromptFormatter.createChatMessages(systemPrompt, inputPromptOptions);
      
      // Handle response generation with vision processing if needed
      let responseContent: string;
      
      // Check if we need to use a vision-capable model
      if (hasImageAttachments || context?.useVisionModel) {
        console.log('Using vision model for image processing');
        responseContent = await this.processWithVisionModel(messages, context?.attachments as any[]);
      } else {
        // Use the standard model for non-vision requests
        const response = await (this.model as any).invoke(messages);
        
        // Extract the response content
        responseContent = response.content.toString();
      }
      
      // Store response in memory using tag extraction
      await this.addTaggedMemory(responseContent, { 
        type: 'agent_response', 
        vision_response: hasImageAttachments || context?.useVisionModel,
        ...context || {} 
      });
      
      return responseContent;
    } catch (error) {
      console.error('Error processing input:', error);
      return null;
    }
  }
  
  /**
   * Add memory with tags extracted from content
   * @param content Content to store
   * @param metadata Additional metadata
   * @returns Promise resolving to the added memory
   */
  async addTaggedMemory(content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      if (!memoryManager) {
        throw new Error('Memory manager not initialized');
      }
      
      // Extract tags using existing tagExtractor
      const taggingResult = await tagExtractor.extractTags(content);
      
      // Add memory with extracted tags
      await memoryManager.addMemory(content, {
        ...metadata,
        tags: taggingResult.tags.map(t => t.text),
        // The TagExtractionResult interface doesn't include entities
        // so we only add tags from the tags field
        analysis: {
          tags: taggingResult.tags,
          extractionSuccess: taggingResult.success
        }
      });
    } catch (error) {
      console.error('Error adding tagged memory:', error);
      // Fallback to storing memory without tags
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      if (memoryManager) {
        await memoryManager.addMemory(content, metadata);
      }
    }
  }
  
  /**
   * Retrieve memories by tags
   * @param tags Tags to search for
   * @param options Search options
   * @returns Matching memories
   */
  async getMemoriesByTags(tags: string[], options: { limit?: number } = {}): Promise<any[]> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      throw new Error('Memory manager not initialized');
    }
    
    // Use searchMemories method with tag filter
    return await memoryManager.searchMemories('', {
      metadata: { tags },
      limit: options.limit || 10
    });
  }
  
  /**
   * Create a new task
   */
  async createTask(options: Record<string, unknown>): Promise<TaskCreationResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.createTask(options as unknown as TaskCreationOptions);
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Record<string, unknown> | null> {
    if (!this.schedulerManager) {
      return null;
    }
    const task = await this.schedulerManager.getTask(taskId);
    return task ? { ...task } as Record<string, unknown> : null;
  }

  /**
   * Execute a task
   */
  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.executeTask(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.schedulerManager) {
      return false;
    }
    return this.schedulerManager.cancelTask(taskId);
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<TaskExecutionResult> {
    if (!this.schedulerManager) {
      throw new Error('Scheduler manager not initialized');
    }
    return this.schedulerManager.retryTask(taskId);
  }
  
  /**
   * Get all pending tasks
   * 
   * @returns Array of pending tasks
   */
  async getPendingTasks(): Promise<ScheduledTask[]> {
    if (!this.schedulerManager) {
      return [];
    }
    
    return await this.schedulerManager.getPendingTasks();
  }
  
  /**
   * Get all tasks that are due for execution
   * 
   * @returns Array of due tasks
   */
  async getDueTasks(): Promise<ScheduledTask[]> {
    if (!this.schedulerManager) {
      return [];
    }
    
    return await this.schedulerManager.getDueTasks();
  }
  
  /**
   * Update task utilization statistics
   * 
   * @param taskId Task ID
   * @param metrics Utilization metrics
   */
  updateTaskUtilization(
    taskId: string,
    metrics: Partial<{
      cpuUtilization: number;
      memoryBytes: number;
      tokensPerMinute: number;
      apiCallsPerMinute: number;
    }>
  ): void {
    if (this.resourceTracker) {
      this.resourceTracker.recordTaskUtilization(taskId, metrics);
    }
  }
  
  /**
   * Update task counts in resource utilization
   * 
   * @param activeTasks Number of active tasks
   * @param pendingTasks Number of pending tasks  
   */
  updateTaskCounts(activeTasks: number, pendingTasks: number): void {
    if (this.resourceTracker) {
      this.resourceTracker.updateTaskCounts(activeTasks, pendingTasks);
    }
  }
  
  /**
   * Get current resource utilization
   * 
   * @returns Current resource utilization or null if tracking is disabled
   */
  getResourceUtilization() {
    if (!this.resourceTracker) {
      return null;
    }
    
    return this.resourceTracker.getCurrentUtilization();
  }
  
  /**
   * Get resource utilization history
   * 
   * @param options Options for history retrieval
   * @returns Resource utilization history or empty array if tracking is disabled
   */
  getResourceUtilizationHistory(options?: {
    from?: Date;
    to?: Date;
    interval?: 'minute' | 'hour' | 'day';
    limit?: number;
  }) {
    if (!this.resourceTracker) {
      return [];
    }
    
    return this.resourceTracker.getUtilizationHistory(options);
  }
  
  // ResourceUsageListener implementation
  
  /**
   * Handle resource warning
   */
  onResourceWarning(metric: string, value: number, limit: number): void {
    if (this.schedulerManager) {
      // Pause scheduling by disabling the manager
      this.schedulerManager.setEnabled(false);
      console.warn(`Resource warning for ${metric}: ${value}/${limit}`);
    }
  }
  
  /**
   * Handle resource limit exceeded
   */
  onResourceLimitExceeded(metric: string, value: number, limit: number): void {
    if (this.schedulerManager) {
      // Pause scheduling by disabling the manager
      this.schedulerManager.setEnabled(false);
      console.error(`Resource limit exceeded for ${metric}: ${value}/${limit}`);
    }
  }
  
  /**
   * Handle resource usage normalized
   */
  onResourceUsageNormalized(metric: string): void {
    if (this.schedulerManager) {
      // Resume scheduling by enabling the manager
      this.schedulerManager.setEnabled(true);
      console.info(`Resource usage normalized for ${metric}`);
    }
  }

  /**
   * Rate the importance, novelty, and emotional content of a message
   * Uses EnhancedMemoryManager if available, otherwise returns default values
   * 
   * @param memoryId ID of the memory to rate
   * @returns Object containing importance, novelty, and emotion scores
   */
  async rateMessageImportance(memoryId: string): Promise<{
    importance: number;
    novelty: number;
    emotion: number;
  }> {
    try {
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      
      // Check if we have an EnhancedMemoryManager with rating capabilities
      if (memoryManager && 
          'rateMemoryImportance' in memoryManager && 
          'rateMemoryNovelty' in memoryManager && 
          'analyzeMemoryEmotion' in memoryManager) {
        
        // Cast to any to avoid TypeScript errors since these methods aren't in the base interface
        const enhancedManager = memoryManager as any;
        
        // Get the importance, novelty, and emotion scores
        const importance = await enhancedManager.rateMemoryImportance(memoryId);
        const novelty = await enhancedManager.rateMemoryNovelty(memoryId);
        const emotion = await enhancedManager.analyzeMemoryEmotion(memoryId);
        
        return { importance, novelty, emotion };
      }
      
      // Return default values if EnhancedMemoryManager is not available
      return { importance: 0.5, novelty: 0.5, emotion: 0.5 };
    } catch (error) {
      console.error('Error rating message importance:', error);
      return { importance: 0.5, novelty: 0.5, emotion: 0.5 };
    }
  }

  /**
   * Process a batch of memories to rate their importance, analyze patterns, etc.
   * Uses EnhancedMemoryManager's cognitive processing capabilities if available
   * 
   * @param memoryIds IDs of memories to process
   * @returns Enhanced memory entries or null if EnhancedMemoryManager is not available
   */
  async processMemoriesCognitively(memoryIds: string[]): Promise<any[] | null> {
    try {
      const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
      
      // Check if we have an EnhancedMemoryManager with cognitive processing capabilities
      if (memoryManager && 'batchProcessMemoriesCognitively' in memoryManager) {
        // Cast to any to avoid TypeScript errors
        const enhancedManager = memoryManager as any;
        
        // Process memories with all cognitive processing types
        return await enhancedManager.batchProcessMemoriesCognitively(
          memoryIds,
          {
            processingTypes: ['associations', 'importance', 'novelty', 'emotion', 'categorization'],
            forceReprocess: false,
            maxConcurrent: 5
          }
        );
      }
      
      return null;
    } catch (error) {
      console.error('Error in cognitive memory processing:', error);
      return null;
    }
  }

  /**
   * Plan and execute a task
   * @param goal The goal to achieve
   * @param options Additional options for planning and execution
   * @returns Result of the plan execution
   */
  async planAndExecute(goal: string, options: Record<string, unknown> = {}): Promise<PlanExecutionResult> {
    try {
      const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
      if (!planningManager) {
        throw new Error('Planning manager not initialized');
      }
      
      // Create plan creation options
      const planOptions: PlanCreationOptions = {
        name: `Plan for: ${goal}`,
        description: goal,
        goals: [goal],
        priority: options.priority as number || 1,
        metadata: options || {}
      };
      
      // Create plan using planning manager
      const planResult = await planningManager.createPlan(planOptions);
      
      if (!planResult.success || !planResult.plan) {
        throw new Error('Failed to create plan');
      }
      
      console.log(`Created plan ${planResult.plan.id} for goal: ${goal}`);
      
      // Execute plan using planning manager
      return await planningManager.executePlan(planResult.plan.id);
    } catch (error) {
      console.error('Error in planAndExecute:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Reflect on recent experiences, actions, and outcomes
   * @param options Reflection options
   * @returns Reflection results
   */
  async reflect(options: Record<string, unknown> = {}): Promise<ReflectionResult> {
    try {
      const reflectionManager = this.getManager<ReflectionManager>(ManagerType.REFLECTION);
      if (!reflectionManager) {
        throw new Error('Reflection manager not initialized');
      }
      
      // Use ReflectionTrigger from the ReflectionManager interface
      const result = await reflectionManager.reflect(
        options.trigger as ReflectionTrigger || ReflectionTrigger.MANUAL,
        options || {}
      );

      // If reflection was successful and adaptation is enabled, adapt behavior
      if (result.success && this.extendedConfig.adaptiveBehavior) {
        await this.adaptBehaviorFromReflection(result);
      }

      return result;
    } catch (error) {
      console.error('Error in reflect:', error);
      return {
        success: false,
        id: '',
        insights: [],
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Schedule a periodic reflection
   * @param options Options for periodic reflection scheduling
   * @returns Whether the reflection was scheduled successfully
   */
  async schedulePeriodicReflection(options: {
    schedule: string;
    name?: string;
    depth?: 'light' | 'standard' | 'deep';
    focusAreas?: string[];
  }): Promise<boolean> {
    try {
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
    } catch (error) {
      console.error('Error scheduling periodic reflection:', error);
      return false;
    }
  }

  /**
   * Initialize executor with error handling
   */
  private setupExecutor(): void {
    if (!this.model) {
      throw new Error('Cannot set up executor: Model not initialized');
    }

    try {
      const toolManager = this.getManager<ToolManager>(ManagerType.TOOL);
      
      if (!toolManager) {
        throw new Error('Tool manager not found');
      }
      
      // Create error handler with reference to this agent
      const errorHandler = new ExecutionErrorHandler(undefined, this);
      
      // Initialize error handler first
      errorHandler.initialize().catch(err => {
        console.error('Error initializing executor error handler:', err);
      });
      
      // Create tool router from tool manager
      const toolRouter = new ToolRouter();
      
      // Initialize tool router
      toolRouter.initialize().catch(err => {
        console.error('Error initializing tool router:', err);
      });
      
      // Get agent capabilities
      const agentCapabilities = this.config.capabilities || [];
      // Extract capability IDs for comparison
      const capabilityIds = agentCapabilities.map(cap => {
        if (typeof cap === 'string') return cap;
        // Handle the AgentCapability object
        if (typeof cap === 'object' && cap !== null) {
          // If it has an id property, use it
          if ('id' in cap && typeof cap.id === 'string') return cap.id;
          // Otherwise try to construct from type and name if available
          if ('type' in cap && 'name' in cap) {
            return `${cap.type}.${cap.name}`;
          }
        }
        // Fallback for unrecognized format
        return String(cap);
      });
      
      console.log(`Agent ${this.getId()} has capabilities:`, capabilityIds);
      
      // Register tools from tool manager with capability-aware filtering
      toolManager.getTools().then(tools => {
        // Filter tools based on agent capabilities if capabilities are specified
        const filteredTools = tools.filter(tool => {
          // Extract tool capabilities from metadata if available
          const toolRequiredCapabilities = (tool.metadata?.requiredCapabilities as string[]) || [];
          
          // If no required capabilities specified for the tool, include it
          if (toolRequiredCapabilities.length === 0) {
            return true;
          }
          
          // If agent has no capabilities, only include tools without requirements
          if (capabilityIds.length === 0) {
            return false;
          }
          
          // Check if the agent has any of the required capabilities
          return toolRequiredCapabilities.some((cap: string) => 
            capabilityIds.includes(cap)
          );
        });
        
        // Sort tools by capability match score
        filteredTools.sort((a, b) => {
          const scoreA = this.calculateToolCapabilityScore(a, capabilityIds);
          const scoreB = this.calculateToolCapabilityScore(b, capabilityIds);
          return scoreB - scoreA; // Higher scores first
        });
        
        console.log(`Agent has access to ${filteredTools.length} of ${tools.length} tools based on capabilities`);
        
        // Register the filtered and sorted tools
        filteredTools.forEach(tool => {
          // Convert Tool to ToolDefinition
          const toolDef: ToolDefinition = {
            name: tool.name,
            description: tool.description,
            parameters: (tool.metadata?.parameters as Record<string, unknown>) || {},
            requiredParams: (tool.metadata?.requiredParams as string[]) || [],
            execute: async (params: Record<string, unknown>, agentContext?: Record<string, unknown>) => {
              try {
                const result = await tool.execute(params);
                return {
                  success: true,
                  data: result
                };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : String(error)
                };
              }
            },
            category: tool.categories?.[0] || 'general',
            requiredCapabilityLevel: (tool.metadata?.requiredCapabilityLevel as string) || 'basic'
          };
          
          toolRouter.registerTool(toolDef);
        });
        
        // Set tool permissions for this agent
        toolRouter.setAgentToolPermissions(this.getId(), filteredTools.map(t => t.name));
      }).catch(err => {
        console.error('Error registering tools:', err);
      });
      
      // Initialize executor with tool router
      this.executor = new Executor(this.model, toolRouter);
      
      // Store error handler reference
      this.executionErrorHandler = errorHandler;
      
    } catch (error) {
      console.error('Error setting up executor:', error);
      throw error;
    }
  }

  /**
   * Calculate a capability match score for a tool
   * Higher scores mean better matches with the agent's capabilities
   */
  private calculateToolCapabilityScore(tool: any, capabilityIds: string[]): number {
    // Extract tool capabilities from metadata if available
    const toolRequiredCapabilities = (tool.metadata?.requiredCapabilities as string[]) || [];
    
    // If tool has no required capabilities, give it a baseline score
    if (toolRequiredCapabilities.length === 0) {
      return 0.5; // Medium priority
    }
    
    // If agent has no capabilities, tool gets lowest score
    if (capabilityIds.length === 0) {
      return 0;
    }
    
    // Count how many of the tool's required capabilities the agent has
    const matchingCapabilities = toolRequiredCapabilities.filter(
      (cap: string) => capabilityIds.includes(cap)
    );
    
    // Calculate match percentage
    const matchPercentage = matchingCapabilities.length / toolRequiredCapabilities.length;
    
    // Priority boost based on capability level
    let levelBoost = 0;
    const capabilityLevel = (tool.metadata?.requiredCapabilityLevel as string) || 'basic';
    switch (capabilityLevel) {
      case 'expert':
        levelBoost = 0.3;
        break;
      case 'intermediate':
        levelBoost = 0.2;
        break;
      case 'basic':
      default:
        levelBoost = 0.1;
        break;
    }
    
    // Final score: match percentage (0-1) plus level boost
    return matchPercentage + levelBoost;
  }

  // Add method to handle reflection-based behavior adaptation
  private async adaptBehaviorFromReflection(reflectionResult: ReflectionResult): Promise<void> {
    if (!reflectionResult.success || !reflectionResult.insights.length) {
      return;
    }

    try {
      const reflectionManager = this.getManager<ReflectionManager>(ManagerType.REFLECTION);
      if (!reflectionManager) {
        return;
      }

      // Process each insight for potential behavior adaptation
      for (const insight of reflectionResult.insights) {
        if (insight.metadata?.category === 'error_handling') {
          // Update error handling strategies based on insights
          await this.updateErrorHandlingStrategies(insight);
        } else if (insight.metadata?.category === 'improvement') {
          // Apply general improvements
          await this.applyImprovementInsight(insight);
        }
      }
    } catch (error) {
      console.error('Error adapting behavior from reflection:', error);
    }
  }

  // Add method to update error handling strategies
  private async updateErrorHandlingStrategies(insight: ReflectionInsight): Promise<void> {
    try {
      if (!this.executionErrorHandler) {
        return;
      }

      // Register new recovery strategies based on insights
      if (insight.metadata?.recoveryStrategy) {
        // Create recovery context from insight
        const recoveryContext = {
          taskId: insight.metadata.taskId as string || 'unknown',
          errorCategory: insight.metadata.errorCategory as string || 'unknown',
          originalError: new Error(insight.content),
          attemptCount: 0,
          previousActions: [],
          errorContext: insight.metadata
        };

        // Record the failure and get failure ID
        const failureId = await this.executionErrorHandler.handleError(
          new Error(insight.content),
          {
            taskId: insight.metadata.taskId as string || 'unknown',
            agentId: this.getId(),
            errorCategory: insight.metadata.errorCategory as string || 'unknown'
          }
        );

        // Apply any recovery actions from the insight
        if (insight.metadata.recoveryActions) {
          for (const action of insight.metadata.recoveryActions as Array<Record<string, unknown>>) {
            await this.executionErrorHandler.handleError(
              new Error(action.description as string || insight.content),
              {
                taskId: insight.metadata.taskId as string || 'unknown',
                agentId: this.getId(),
                errorCategory: insight.metadata.errorCategory as string || 'unknown',
                recoveryAction: action
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error updating error handling strategies:', error);
    }
  }

  // Add method to apply improvement insights
  private async applyImprovementInsight(insight: ReflectionInsight): Promise<void> {
    try {
      // Get relevant manager based on insight target area
      const targetArea = insight.metadata?.targetArea;
      if (!targetArea) {
        return;
      }

      switch (targetArea) {
        case 'memory':
          await this.updateMemorySystem(insight);
          break;
        case 'planning':
          await this.updatePlanningSystem(insight);
          break;
        case 'execution':
          await this.updateExecutionSystem(insight);
          break;
        default:
          console.log(`No implementation for target area: ${targetArea}`);
      }
    } catch (error) {
      console.error('Error applying improvement insight:', error);
    }
  }

  // Add system update methods
  private async updateMemorySystem(insight: ReflectionInsight): Promise<void> {
    const memoryManager = this.getManager<MemoryManager>(ManagerType.MEMORY);
    if (!memoryManager) {
      return;
    }
    
    // Apply memory system improvements based on insight
    if (insight.metadata?.improvements) {
      // Implementation would go here
      console.log('Applying memory system improvements:', insight.content);
    }
  }

  private async updatePlanningSystem(insight: ReflectionInsight): Promise<void> {
    const planningManager = this.getManager<PlanningManager>(ManagerType.PLANNING);
    if (!planningManager) {
      return;
    }
    
    // Apply planning system improvements based on insight
    if (insight.metadata?.improvements) {
      // Implementation would go here
      console.log('Applying planning system improvements:', insight.content);
    }
  }

  private async updateExecutionSystem(insight: ReflectionInsight): Promise<void> {
    if (!this.executor) {
      return;
    }
    
    // Apply execution system improvements based on insight
    if (insight.metadata?.improvements) {
      // Implementation would go here
      console.log('Applying execution system improvements:', insight.content);
    }
  }
} 