import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';

/**
 * Intent classification result
 */
export interface ClassifiedIntent {
  id: string;
  name: string;
  confidence: number;
  description: string;
  parameters: Record<string, unknown>;
  parentIntent?: string;
  childIntents: string[];
  metadata: {
    extractedAt: string;
    source: string;
    context?: string;
  };
}

/**
 * Intent classification options
 */
export interface IntentClassificationOptions {
  minConfidence?: number;
  includeAlternatives?: boolean;
  maxAlternatives?: number;
  considerContext?: boolean;
  extractParameters?: boolean;
}

/**
 * Service for classifying user intents using LLM
 */
export class IntentClassifier {
  private llm: ChatOpenAI;
  
  // Intent hierarchy for better classification
  private intentHierarchy: Map<string, {
    description: string;
    parentIntent?: string;
    childIntents: string[];
    parameters: string[];
    examples: string[];
  }> = new Map([
    ['task_management', {
      description: 'Managing tasks, todos, and action items',
      childIntents: ['create_task', 'update_task', 'delete_task', 'list_tasks'],
      parameters: ['task_name', 'priority', 'due_date', 'assignee'],
      examples: [
        'Create a new task to review the code',
        'Update the priority of task ABC123',
        'What tasks are due today?'
      ]
    }],
    ['code_assistance', {
      description: 'Help with coding, debugging, and development',
      childIntents: ['write_code', 'debug_code', 'review_code', 'explain_code'],
      parameters: ['language', 'framework', 'file_path', 'error_message'],
      examples: [
        'Help me write a function to sort an array',
        'Debug this error in my React component',
        'Review this pull request'
      ]
    }],
    ['file_management', {
      description: 'Managing files, documents, and resources',
      childIntents: ['create_file', 'modify_file', 'delete_file', 'search_files'],
      parameters: ['file_path', 'file_type', 'content', 'search_query'],
      examples: [
        'Create a new configuration file',
        'Find all TypeScript files containing "api"',
        'Delete the temporary files'
      ]
    }],
    ['knowledge_query', {
      description: 'Querying for information and knowledge',
      childIntents: ['ask_question', 'get_explanation', 'find_examples'],
      parameters: ['topic', 'context', 'detail_level'],
      examples: [
        'How does React server components work?',
        'Explain the difference between var and let',
        'Show me examples of async/await'
      ]
    }],
    ['system_operation', {
      description: 'System and environment operations',
      childIntents: ['install_package', 'configure_system', 'run_command'],
      parameters: ['package_name', 'version', 'command', 'options'],
      examples: [
        'Install the latest version of TypeScript',
        'Configure ESLint for the project',
        'Run the build script'
      ]
    }]
  ]);
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL_NAME,
      temperature: 0.2
    });
  }
  
  /**
   * Classify user intent using LLM
   */
  async classifyIntent(
    message: string,
    options: IntentClassificationOptions = {}
  ): Promise<{
    primaryIntent: ClassifiedIntent;
    alternativeIntents?: ClassifiedIntent[];
  }> {
    try {
      const {
        minConfidence = 0.6,
        includeAlternatives = true,
        maxAlternatives = 2,
        considerContext = true,
        extractParameters = true
      } = options;
      
      // Build system prompt with intent hierarchy
      const systemPrompt = `You are an AI assistant that classifies user intents.
Your task is to analyze the user's message and identify their primary intent and any alternative intents.

Available intent categories:
${Array.from(this.intentHierarchy.entries()).map(([name, data]) => `
${name}:
- Description: ${data.description}
- Child intents: ${data.childIntents.join(', ')}
- Parameters: ${data.parameters.join(', ')}
- Examples: ${data.examples.join('; ')}
`).join('\n')}

For each intent, provide:
1. The most specific intent name (use child intents when applicable)
2. A confidence score (0.0 to 1.0)
3. A brief description of why this intent was chosen
4. Any relevant parameters extracted from the message
5. The parent intent category

Respond in JSON format:
{
  "primary": {
    "intent": "create_task",
    "confidence": 0.95,
    "description": "User wants to create a new task",
    "parameters": {
      "task_name": "Review code",
      "priority": "high"
    },
    "parentIntent": "task_management"
  },
  "alternatives": [
    {
      "intent": "review_code",
      "confidence": 0.4,
      "description": "Could be about code review",
      "parameters": {
        "language": "typescript"
      },
      "parentIntent": "code_assistance"
    }
  ]
}`;

      // Call LLM for classification
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Classify the intent in this message: "${message}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid LLM response format');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      if (!data.primary || !data.primary.intent) {
        throw new Error('Missing primary intent in response');
      }
      
      // Create primary intent result
      const primaryIntent: ClassifiedIntent = {
        id: String(IdGenerator.generate('intent')),
        name: data.primary.intent,
        confidence: data.primary.confidence,
        description: data.primary.description,
        parameters: data.primary.parameters || {},
        parentIntent: data.primary.parentIntent,
        childIntents: [],
        metadata: {
          extractedAt: new Date().toISOString(),
          source: 'llm_classification'
        }
      };
      
      // Process alternative intents if requested
      let alternativeIntents: ClassifiedIntent[] | undefined;
      
      if (includeAlternatives && data.alternatives) {
        alternativeIntents = data.alternatives
          .filter((alt: any) => alt.confidence >= minConfidence)
          .slice(0, maxAlternatives)
          .map((alt: any) => ({
            id: String(IdGenerator.generate('intent')),
            name: alt.intent,
            confidence: alt.confidence,
            description: alt.description,
            parameters: alt.parameters || {},
            parentIntent: alt.parentIntent,
            childIntents: [],
            metadata: {
              extractedAt: new Date().toISOString(),
              source: 'llm_classification'
            }
          }));
      }
      
      return {
        primaryIntent,
        alternativeIntents
      };
      
    } catch (error) {
      console.error('Error classifying intent:', error);
      throw error;
    }
  }
  
  /**
   * Validate an intent classification
   */
  async validateIntent(intent: ClassifiedIntent): Promise<{
    isValid: boolean;
    confidence: number;
    reason?: string;
  }> {
    try {
      // Get intent category data
      const parentData = intent.parentIntent ? 
        this.intentHierarchy.get(intent.parentIntent) : null;
      
      if (!parentData) {
        return {
          isValid: false,
          confidence: 0,
          reason: 'Unknown intent category'
        };
      }
      
      // Check if intent is a valid child intent
      if (!parentData.childIntents.includes(intent.name)) {
        return {
          isValid: false,
          confidence: 0,
          reason: 'Invalid intent for category'
        };
      }
      
      // Validate required parameters
      const missingParams = parentData.parameters.filter(
        param => !(param in intent.parameters)
      );
      
      if (missingParams.length > 0) {
        return {
          isValid: false,
          confidence: intent.confidence * 0.8,
          reason: `Missing required parameters: ${missingParams.join(', ')}`
        };
      }
      
      return {
        isValid: true,
        confidence: intent.confidence
      };
      
    } catch (error) {
      console.error('Error validating intent:', error);
      return {
        isValid: false,
        confidence: 0,
        reason: 'Error during validation'
      };
    }
  }
  
  /**
   * Get child intents for a parent intent
   */
  getChildIntents(parentIntent: string): string[] {
    const data = this.intentHierarchy.get(parentIntent);
    return data?.childIntents || [];
  }
  
  /**
   * Get intent hierarchy data
   */
  getIntentHierarchy(): Map<string, {
    description: string;
    parentIntent?: string;
    childIntents: string[];
    parameters: string[];
    examples: string[];
  }> {
    return new Map(this.intentHierarchy);
  }
} 