import { ChatOpenAI } from '@langchain/openai';
import { ChloeMemory } from '../memory';
import { TaskLogger } from '../task-logger';
import { IManager, BaseManagerOptions } from '../../../lib/shared/types/agentTypes';
import { logger } from '../../../lib/logging';
import { 
  ImportanceLevel, 
  MemorySource
} from '../../../constants/memory';
import { MemoryType as StandardMemoryType } from '../../../server/memory/config';
import { 
  ReflectionType, 
  PerformanceReviewType,
  CausalRelationshipType
} from '../../../constants/reflection';
import { MessageSender } from '../../../constants/message';
import { 
  establishCausalLink, 
  traceCausalChain, 
  getCausallyRelatedMemories,
  addCausalReflection 
} from '../../../server/qdrant';

/**
 * Options for initializing the reflection manager
 */
export interface ReflectionManagerOptions extends BaseManagerOptions {
  memory: ChloeMemory;
  model: ChatOpenAI;
  logger?: TaskLogger;
  notifyFunction?: (message: string) => Promise<void>;
}

/**
 * Manages reflection, review, and performance evaluation for the Chloe agent
 */
export class ReflectionManager implements IManager {
  // Required core properties
  private agentId: string;
  private initialized: boolean = false;
  private taskLogger: TaskLogger | null = null;
  
  // Manager-specific properties
  private memory: ChloeMemory;
  private model: ChatOpenAI;
  private notifyFunction?: (message: string) => Promise<void>;

  constructor(options: ReflectionManagerOptions) {
    this.agentId = options.agentId;
    this.memory = options.memory;
    this.model = options.model;
    this.taskLogger = options.logger || null;
    this.notifyFunction = options.notifyFunction;
  }

  /**
   * Get the agent ID this manager belongs to
   * Required by IManager interface
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Log an action performed by this manager
   * Required by IManager interface
   */
  logAction(action: string, metadata?: Record<string, unknown>): void {
    if (this.taskLogger) {
      this.taskLogger.logAction(`ReflectionManager: ${action}`, metadata);
    } else {
      logger.info(`ReflectionManager: ${action}`, metadata);
    }
  }

  /**
   * Initialize the reflection system
   * Required by IManager interface
   */
  async initialize(): Promise<void> {
    try {
      this.logAction('Initializing reflection system');
      this.initialized = true;
      this.logAction('Reflection system initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error initializing reflection system', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown and cleanup resources
   * Optional but recommended method in IManager interface
   */
  async shutdown(): Promise<void> {
    try {
      this.logAction('Shutting down reflection system');
      
      // Add cleanup logic here if needed
      
      this.logAction('Reflection system shutdown complete');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during reflection system shutdown', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the manager is initialized
   * Required by IManager interface
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Perform a reflection on a specific question
   */
  async reflect(question: string): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Reflecting on question', { question });
      
      // Get relevant memories for context
      const relevantMemories = await this.memory.getRelevantMemories(question, 10);
      const memoryContext = relevantMemories.join('\n');
      
      // Create a reflection prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, reflect on the following question with depth and insight:

Question: ${question}

Use the following context from your memory to inform your reflection:
${memoryContext}

Your reflection should be thoughtful, strategic, and provide nuanced marketing perspective. Consider both what you've done well and areas where you could improve.`;
      
      // Generate the reflection
      const response = await this.model.invoke(prompt);
      const reflection = response.content.toString();
      
      // Store the reflection in memory with the correct category
      await this.memory.addMemory(
        `Reflection on "${question}": ${reflection.substring(0, 200)}...`,
        StandardMemoryType.THOUGHT,
        ImportanceLevel.MEDIUM,
        MemorySource.AGENT,
        `Reflection task result: ${question}`
      );
      
      return reflection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during reflection', { error: errorMessage });
      return `Error generating reflection: ${errorMessage}`;
    }
  }

  /**
   * Run a weekly reflection exercise
   */
  async runWeeklyReflection(): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Running weekly reflection');
      
      // Get memories from the past week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Get different categories of memories for a comprehensive review
      const userInteractions = await this.memory.getMemoriesByDateRange(StandardMemoryType.MESSAGE, oneWeekAgo, new Date(), 20);
      const tasks = await this.memory.getMemoriesByDateRange(StandardMemoryType.TASK, oneWeekAgo, new Date(), 20);
      const thoughts = await this.memory.getMemoriesByDateRange(StandardMemoryType.THOUGHT, oneWeekAgo, new Date(), 20);
      
      // Format memories for the model
      const formatMemories = (memories: any[], category: string) => {
        return memories.length > 0 
          ? `${category.toUpperCase()}:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}`
          : `No ${category.toLowerCase()} recorded this week.`;
      };
      
      const userMemories = formatMemories(userInteractions, 'User Interactions');
      const taskMemories = formatMemories(tasks, 'Tasks');
      const thoughtMemories = formatMemories(thoughts, 'Thoughts');
      
      // Create a comprehensive reflection prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, conduct a thorough weekly review and reflection. Consider what happened this week, what went well, what could be improved, and strategic insights gained.

CONTEXT FROM THIS WEEK:
${userMemories}

${taskMemories}

${thoughtMemories}

Please structure your reflection with these sections:
1. Summary of Key Activities
2. Achievements and Successes
3. Challenges and Learnings
4. Strategic Insights
5. Goals for Next Week

Your reflection should be professional, insightful, and focused on continuous improvement as a CMO.`;
      
      // Generate the weekly reflection
      const response = await this.model.invoke(prompt);
      const reflection = response.content.toString();
      
      // Store the weekly reflection in memory
      await this.memory.addMemory(
        `Weekly Reflection: ${reflection.substring(0, 200)}...`,
        StandardMemoryType.THOUGHT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT
      );
      
      // Notify about the reflection if notification function is available
      if (this.notifyFunction) {
        await this.notifyFunction(`Completed weekly reflection: ${reflection.substring(0, 200)}...`);
      }
      
      return reflection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during weekly reflection', { error: errorMessage });
      
      if (this.notifyFunction) {
        await this.notifyFunction(`Error in weekly reflection: ${errorMessage}`);
      }
      
      return `Error generating weekly reflection: ${errorMessage}`;
    }
  }

  /**
   * Run a performance review
   */
  async runPerformanceReview(reviewType: PerformanceReviewType = PerformanceReviewType.DAILY): Promise<any> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction(`Running ${reviewType} performance review`);
      
      // Define the time range based on review type
      const startDate = new Date();
      switch (reviewType) {
        case PerformanceReviewType.MONTHLY:
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case PerformanceReviewType.WEEKLY:
          startDate.setDate(startDate.getDate() - 7);
          break;
        case PerformanceReviewType.DAILY:
        default:
          startDate.setDate(startDate.getDate() - 1);
          break;
      }
      
      // Get relevant memory entries for the period
      const tasks = await this.memory.getMemoriesByDateRange(StandardMemoryType.TASK, startDate, new Date(), 30);
      const userInteractions = await this.memory.getMemoriesByDateRange(StandardMemoryType.MESSAGE, startDate, new Date(), 30);
      
      // Format memories for the model
      const formatMemories = (memories: any[], category: string) => {
        return memories.length > 0 
          ? `${category.toUpperCase()}:\n${memories.map((m: any) => `- ${m.content}`).join('\n')}`
          : `No ${category.toLowerCase()} recorded.`;
      };
      
      const taskMemories = formatMemories(tasks, 'Tasks');
      const interactionMemories = formatMemories(userInteractions, 'User Interactions');
      
      // Create a performance review prompt
      const prompt = `As Chloe, the Chief Marketing Officer AI, conduct a ${reviewType} performance review. Analyze your effectiveness, impact, and areas for improvement.

CONTEXT FROM THE ${reviewType.toUpperCase()} PERIOD:
${taskMemories}

${interactionMemories}

Please structure your performance review with these sections:
1. Key Metrics and Outcomes
2. Strengths Demonstrated
3. Areas for Improvement
4. Action Items
5. Overall Assessment

Be objective, data-driven, and focused on continuous improvement as a CMO.`;
      
      // Generate the performance review
      const response = await this.model.invoke(prompt);
      const review = response.content.toString();
      
      // Create a well-formatted performance review
      const reviewContent = `${reviewType.charAt(0).toUpperCase() + reviewType.slice(1)} Performance Review: ${review.substring(0, 200)}...`;
      
      // Store the performance review in memory
      await this.memory.addMemory(
        reviewContent,
        StandardMemoryType.THOUGHT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        reviewType
      );
      
      // Log that this is an internal reflection, not a chat message
      console.log(`INTERNAL REFLECTION (NOT CHAT): Generated ${reviewType} performance review`);
      
      // Parse the review into structured data (simplified version)
      const sections = review.split(/\d\.\s+/).filter(Boolean);
      const structuredReview = {
        metrics: sections[0] || '',
        strengths: sections[1] || '',
        improvements: sections[2] || '',
        actionItems: sections[3] || '',
        assessment: sections[4] || '',
        fullText: review
      };
      
      return structuredReview;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during performance review', { error: errorMessage });
      return {
        error: `Error generating ${reviewType} performance review: ${errorMessage}`,
        fullText: `Failed to generate performance review due to an error: ${errorMessage}`
      };
    }
  }

  /**
   * Identify and establish potential causal relationships between events
   * This examines memories from a specific timeframe to find potential cause-effect relationships
   * 
   * @param options Configuration options for causal analysis
   * @returns Summary of identified causal relationships
   */
  async analyzeCausalRelationships(options: {
    timeframe?: { start: Date; end: Date; };
    maxRelationships?: number;
    minConfidence?: number;
    focusArea?: string;
  } = {}): Promise<{
    relationships: Array<{
      cause: { id: string; content: string; };
      effect: { id: string; content: string; };
      description: string;
      confidence: number;
      relationshipType: string;
      reflectionId?: string;
    }>;
    summary: string;
  }> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Analyzing causal relationships');
      
      // Set default options
      const timeframe = options.timeframe || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date()
      };
      
      const maxRelationships = options.maxRelationships || 5;
      const minConfidence = options.minConfidence || 0.7; // Minimum 70% confidence
      const focusArea = options.focusArea || '';
      
      // Get memories from the specified timeframe
      const memories = await this.memory.getMemoriesByDateRange(
        StandardMemoryType.MESSAGE, 
        timeframe.start, 
        timeframe.end, 
        50
      );
      
      // Also get task memories which often represent actions taken
      const taskMemories = await this.memory.getMemoriesByDateRange(
        StandardMemoryType.TASK,
        timeframe.start,
        timeframe.end,
        50
      );
      
      // Combine memories and sort by timestamp for chronological analysis
      const allMemories = [...memories, ...taskMemories]
        .sort((a, b) => a.created.getTime() - b.created.getTime());
      
      // If we have very few memories, we can't do meaningful analysis
      if (allMemories.length < 3) {
        return {
          relationships: [],
          summary: "Insufficient data for causal analysis."
        };
      }
      
      // Format memories for the model
      const formattedMemories = allMemories.map((memory, index) => {
        return `[${index}] [${memory.created.toISOString()}] ${memory.type}: ${memory.content}`;
      }).join('\n\n');
      
      // Create a prompt to analyze causal relationships
      const analysisPrompt = `As Chloe, the Chief Marketing Officer AI, analyze the following chronological events to identify clear cause-effect relationships. Your task is to detect when one event or action directly led to or strongly influenced a subsequent outcome.

CHRONOLOGICAL EVENTS:
${formattedMemories}

${focusArea ? `FOCUS AREA: ${focusArea}\n\n` : ''}

For each potential cause-effect relationship you identify:
1. Specify the index numbers of the cause and effect events
2. Describe the relationship in a clear sentence (e.g., "Redesigning the landing page led to a 23% increase in signups")
3. Categorize the relationship as one of: DIRECT (clear causation), CONTRIBUTING (partial cause), CORRELATED (related but causation uncertain), or SEQUENTIAL (temporal sequence only)
4. Assign a confidence score (0.0-1.0) for how certain you are about this causal relationship
5. Provide brief supporting evidence for why you believe this relationship exists

FORMAT YOUR RESPONSE AS JSON:
{
  "relationships": [
    {
      "causeIndex": 3,
      "effectIndex": 7,
      "description": "Clear description of the cause-effect relationship",
      "relationshipType": "DIRECT",
      "confidence": 0.85,
      "evidence": "Supporting evidence for this relationship"
    }
  ],
  "summary": "Brief overall summary of the causal patterns identified"
}

IMPORTANT: Only include relationships where your confidence is at least ${minConfidence}. Focus on quality over quantity. Limit your analysis to the ${maxRelationships} strongest causal relationships.`;
      
      // Generate the causal analysis
      const response = await this.model.invoke(analysisPrompt);
      const analysisText = response.content.toString();
      
      // Parse JSON response
      let analysisResult;
      try {
        // Extract JSON from response (handling cases where model might add explanatory text)
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON found in response");
        }
      } catch (parseError) {
        this.logAction('Error parsing causal analysis JSON', { error: parseError });
        return {
          relationships: [],
          summary: "Error parsing causal relationships."
        };
      }
      
      // Map the results to memory IDs instead of indices
      const relationships = await Promise.all(
        (analysisResult.relationships || []).map(async (rel: any) => {
          try {
            const causeMemory = allMemories[rel.causeIndex];
            const effectMemory = allMemories[rel.effectIndex];
            
            if (!causeMemory || !effectMemory) {
              return null; // Skip if memory references are invalid
            }
            
            // Create causal reflection with evidence
            const reflectionId = await this.createCausalReflection(
              causeMemory.id,
              effectMemory.id,
              rel.description,
              rel.relationshipType,
              rel.confidence,
              rel.evidence
            );
            
            return {
              cause: {
                id: causeMemory.id,
                content: causeMemory.content
              },
              effect: {
                id: effectMemory.id,
                content: effectMemory.content
              },
              description: rel.description,
              confidence: rel.confidence,
              relationshipType: rel.relationshipType,
              reflectionId
            };
          } catch (error) {
            this.logAction('Error processing relationship', { error });
            return null;
          }
        })
      );
      
      // Filter out null values from errors
      const validRelationships = relationships.filter(r => r !== null) as Array<{
        cause: { id: string; content: string; };
        effect: { id: string; content: string; };
        description: string;
        confidence: number;
        relationshipType: string;
        reflectionId?: string;
      }>;
      
      // Store the causal analysis summary as a high-importance thought
      const analysisSummary = analysisResult.summary || "Causal relationship analysis completed.";
      await this.memory.addMemory(
        `Causal Analysis: ${analysisSummary}`,
        StandardMemoryType.THOUGHT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        'causal_analysis'
      );
      
      return {
        relationships: validRelationships,
        summary: analysisSummary
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during causal relationship analysis', { error: errorMessage });
      return {
        relationships: [],
        summary: `Error during causal analysis: ${errorMessage}`
      };
    }
  }

  /**
   * Create a causal reflection and establish the link between cause-effect memories
   * 
   * @param causeId ID of the cause memory
   * @param effectId ID of the effect memory
   * @param description Description of the causal relationship
   * @param relationshipType Type of causal relationship (direct, contributing, etc.)
   * @param confidence Confidence score (0-1) in this relationship
   * @param evidence Supporting evidence for this causal relationship
   * @returns ID of the created reflection
   */
  private async createCausalReflection(
    causeId: string,
    effectId: string,
    description: string,
    relationshipType: string,
    confidence: number,
    evidence: string
  ): Promise<string | undefined> {
    try {
      // Format a detailed reflection including the evidence
      const reflectionContent = `
Causal Relationship Analysis:

Relationship: ${description}
Type: ${relationshipType}
Confidence: ${confidence.toFixed(2)} (${Math.round(confidence * 100)}%)

Supporting Evidence:
${evidence}

This causal relationship has been established in the memory system, linking the cause memory (${causeId}) with the effect memory (${effectId}).
      `.trim();
      
      // Create the causal link and reflection in the memory system
      const reflectionId = await addCausalReflection(
        causeId,
        effectId,
        reflectionContent
      );
      
      this.logAction('Created causal reflection', {
        causeId,
        effectId,
        reflectionId,
        confidence
      });
      
      return reflectionId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error creating causal reflection', { error: errorMessage });
      return undefined;
    }
  }

  /**
   * Trace a causal chain starting from a specific memory
   * 
   * @param memoryId ID of the memory to trace from
   * @param options Configuration options for the trace
   * @returns Visualization and analysis of the causal chain
   */
  async traceCausalChain(memoryId: string, options: {
    maxDepth?: number;
    direction?: 'forward' | 'backward' | 'both';
    analyze?: boolean;
  } = {}): Promise<{
    origin: { id: string; content: string; } | null;
    chain: string;
    analysis: string;
  }> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Tracing causal chain', { memoryId, options });
      
      // Set default options
      const maxDepth = options.maxDepth || 3;
      const direction = options.direction || 'both';
      const analyze = options.analyze !== false;
      
      // Get the causal chain from the memory system
      const chainResult = await traceCausalChain(memoryId, {
        maxDepth,
        direction,
        includeContent: true
      });
      
      if (!chainResult.origin) {
        return {
          origin: null,
          chain: "Memory not found or no causal relationships established.",
          analysis: "Unable to analyze non-existent causal chain."
        };
      }
      
      // Format the causal chain for visualization
      let chainVisualization = '';
      
      const origin = {
        id: chainResult.origin.id,
        content: chainResult.origin.text
      };
      
      // Format backward chain (causes)
      if (chainResult.causes.length > 0) {
        chainVisualization += "## CAUSES (What led to this)\n\n";
        
        // Group by depth for hierarchical display
        const byDepth: Record<number, typeof chainResult.causes> = {};
        for (const item of chainResult.causes) {
          byDepth[item.depth] = byDepth[item.depth] || [];
          byDepth[item.depth].push(item);
        }
        
        // Display in reverse order (deepest causes first)
        const depths = Object.keys(byDepth).map(Number).sort((a, b) => b - a);
        for (const depth of depths) {
          chainVisualization += `DEPTH ${depth}:\n`;
          for (const item of byDepth[depth]) {
            chainVisualization += `  • [${item.memory.id}] ${item.memory.text.substring(0, 100)}...\n`;
            chainVisualization += `    ↓ ${item.relationship.description}\n\n`;
          }
        }
      }
      
      // Add origin memory
      chainVisualization += "## ORIGIN MEMORY\n\n";
      chainVisualization += `[${origin.id}] ${origin.content}\n\n`;
      
      // Format forward chain (effects)
      if (chainResult.effects.length > 0) {
        chainVisualization += "## EFFECTS (What this led to)\n\n";
        
        // Group by depth for hierarchical display
        const byDepth: Record<number, typeof chainResult.effects> = {};
        for (const item of chainResult.effects) {
          byDepth[item.depth] = byDepth[item.depth] || [];
          byDepth[item.depth].push(item);
        }
        
        // Display in order (immediate effects first)
        const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
        for (const depth of depths) {
          chainVisualization += `DEPTH ${depth}:\n`;
          for (const item of byDepth[depth]) {
            chainVisualization += `  • ${item.relationship.description}\n`;
            chainVisualization += `    ↓ [${item.memory.id}] ${item.memory.text.substring(0, 100)}...\n\n`;
          }
        }
      }
      
      // If no relationships found in either direction
      if (chainResult.causes.length === 0 && chainResult.effects.length === 0) {
        chainVisualization += "No causal relationships established for this memory.\n";
      }
      
      // Generate an analysis if requested
      let analysis = "Analysis not requested.";
      if (analyze) {
        // Create a prompt for the analysis
        const analysisPrompt = `As Chloe, the Chief Marketing Officer AI, analyze the following causal chain to extract strategic insights and lessons:

${chainVisualization}

Provide a concise analysis addressing:
1. The key patterns or sequences observed in this causal chain
2. Important implications for marketing strategy
3. Lessons that could be applied to future decisions
4. Any recommended actions based on this causal understanding

Keep your analysis concise, strategic, and focused on actionable insights.`;
        
        // Generate the analysis
        const response = await this.model.invoke(analysisPrompt);
        analysis = response.content.toString();
        
        // Store the analysis as a thought
        await this.memory.addMemory(
          `Causal Chain Analysis: ${analysis.substring(0, 200)}...`,
          StandardMemoryType.THOUGHT,
          ImportanceLevel.MEDIUM,
          MemorySource.AGENT,
          'causal_chain_analysis'
        );
      }
      
      return {
        origin,
        chain: chainVisualization,
        analysis
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error tracing causal chain', { error: errorMessage });
      return {
        origin: null,
        chain: `Error tracing causal chain: ${errorMessage}`,
        analysis: "Unable to analyze due to error in causal chain retrieval."
      };
    }
  }

  /**
   * Enhanced weekly reflection that includes causal relationship analysis
   * This extends the regular weekly reflection with causal insights
   */
  async runEnhancedWeeklyReflection(): Promise<string> {
    try {
      if (!this.isInitialized()) {
        await this.initialize();
      }
      
      this.logAction('Running enhanced weekly reflection with causal analysis');
      
      // First run standard weekly reflection
      const standardReflection = await this.runWeeklyReflection();
      
      // Then run causal analysis for the week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const causalAnalysis = await this.analyzeCausalRelationships({
        timeframe: {
          start: oneWeekAgo,
          end: new Date()
        },
        maxRelationships: 3,
        minConfidence: 0.7
      });
      
      // Format causal relationships for the enhanced reflection
      let causalInsights = '';
      if (causalAnalysis.relationships.length > 0) {
        causalInsights = '\n\n## CAUSAL INSIGHTS\n\n';
        causalInsights += causalAnalysis.summary + '\n\n';
        
        causalInsights += 'Key Cause-Effect Relationships Identified:\n';
        for (const rel of causalAnalysis.relationships) {
          causalInsights += `• ${rel.description} (${rel.relationshipType}, ${Math.round(rel.confidence * 100)}% confidence)\n`;
        }
      } else {
        causalInsights = '\n\nNo significant causal relationships identified this week.\n';
      }
      
      // Combine standard reflection with causal insights
      const enhancedReflection = standardReflection + causalInsights;
      
      // Store the enhanced reflection
      await this.memory.addMemory(
        `Enhanced Weekly Reflection with Causal Analysis: ${enhancedReflection.substring(0, 200)}...`,
        StandardMemoryType.THOUGHT,
        ImportanceLevel.HIGH,
        MemorySource.AGENT,
        'enhanced_weekly_reflection'
      );
      
      return enhancedReflection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logAction('Error during enhanced weekly reflection', { error: errorMessage });
      
      if (this.notifyFunction) {
        await this.notifyFunction(`Error in enhanced weekly reflection: ${errorMessage}`);
      }
      
      return `Error generating enhanced weekly reflection: ${errorMessage}`;
    }
  }
} 