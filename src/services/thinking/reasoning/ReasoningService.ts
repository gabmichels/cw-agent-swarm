import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';
import { ClassifiedIntent } from '../intent/IntentClassifier';
import { ExtractedEntity } from '../memory/EntityExtractor';

/**
 * Types of reasoning steps
 */
export enum ReasoningStepType {
  THOUGHT = 'thought',
  ACTION = 'action',
  OBSERVATION = 'observation',
  CONCLUSION = 'conclusion'
}

/**
 * A single step in the reasoning process
 */
export interface ReasoningStep {
  id: string;
  type: ReasoningStepType;
  content: string;
  confidence?: number;
  metadata: {
    timestamp: string;
    duration?: number;
    dependencies?: string[];
  };
}

/**
 * Result of a reasoning process
 */
export interface ReasoningResult {
  id: string;
  steps: ReasoningStep[];
  conclusion: string;
  confidence: number;
  metadata: {
    startTime: string;
    endTime: string;
    duration: number;
    strategy: string;
  };
}

/**
 * Options for the reasoning process
 */
export interface ReasoningOptions {
  maxSteps?: number;
  minConfidence?: number;
  timeout?: number;
  strategy?: 'react' | 'cot' | 'tot';
  validateSteps?: boolean;
}

/**
 * Base class for reasoning services
 */
export abstract class ReasoningService {
  protected llm: ChatOpenAI;
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0.2
    });
  }
  
  /**
   * Apply reasoning to solve a problem or answer a question
   */
  abstract reason(
    query: string,
    context: {
      intent?: ClassifiedIntent;
      entities?: ExtractedEntity[];
      relevantText?: string[];
    },
    options?: ReasoningOptions
  ): Promise<ReasoningResult>;
  
  /**
   * Validate a reasoning step
   */
  protected abstract validateStep(
    step: ReasoningStep,
    previousSteps: ReasoningStep[]
  ): Promise<{
    isValid: boolean;
    confidence: number;
    reason?: string;
  }>;
}

/**
 * Implementation of ReAct (Reasoning + Acting) strategy
 */
export class ReActReasoning extends ReasoningService {
  /**
   * Apply ReAct reasoning strategy
   */
  async reason(
    query: string,
    context: {
      intent?: ClassifiedIntent;
      entities?: ExtractedEntity[];
      relevantText?: string[];
    },
    options: ReasoningOptions = {}
  ): Promise<ReasoningResult> {
    const {
      maxSteps = 10,
      minConfidence = 0.6,
      timeout = 30000,
      validateSteps = true
    } = options;
    
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    
    try {
      // Build system prompt
      const systemPrompt = `You are an AI assistant that uses the ReAct (Reasoning + Acting) framework to solve problems.
Follow this process:
1. Think: Analyze the current situation and form a thought about what to do
2. Act: Propose a specific action based on your thought
3. Observe: Describe what you observe from the action
4. Repeat until you reach a conclusion

For each step, provide:
1. Step type: "thought", "action", "observation", or "conclusion"
2. Content: Your reasoning, action, or observation
3. Confidence: How confident you are in this step (0.0 to 1.0)

Context provided:
${context.intent ? `Intent: ${context.intent.name} (${context.intent.description})` : ''}
${context.entities ? `Entities: ${context.entities.map(e => `${e.type}:${e.value}`).join(', ')}` : ''}
${context.relevantText ? `Relevant information:\n${context.relevantText.join('\n')}` : ''}

Respond in JSON format for each step:
{
  "type": "thought",
  "content": "I should first check...",
  "confidence": 0.9
}`;

      // Initialize conversation
      let messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Solve this problem: "${query}"`)
      ];
      
      // ReAct loop
      while (steps.length < maxSteps && Date.now() - startTime < timeout) {
        // Get next step from LLM
        // @ts-ignore - LangChain types may not be up to date
        const response = await this.llm.call(messages);
        const responseContent = response.content.toString();
        
        // Parse step
        const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid LLM response format');
        }
        
        const stepData = JSON.parse(jsonMatch[0]);
        
        // Create reasoning step
        const step: ReasoningStep = {
          id: String(IdGenerator.generate('step')),
          type: stepData.type as ReasoningStepType,
          content: stepData.content,
          confidence: stepData.confidence,
          metadata: {
            timestamp: new Date().toISOString(),
            dependencies: steps.length > 0 ? [steps[steps.length - 1].id] : []
          }
        };
        
        // Validate step if enabled
        if (validateSteps) {
          const validation = await this.validateStep(step, steps);
          if (!validation.isValid || validation.confidence < minConfidence) {
            throw new Error(`Invalid reasoning step: ${validation.reason}`);
          }
        }
        
        // Add step
        steps.push(step);
        
        // Add step to conversation
        messages.push(new HumanMessage(JSON.stringify(step)));
        
        // Check if we've reached a conclusion
        if (step.type === ReasoningStepType.CONCLUSION) {
          break;
        }
      }
      
      // Create final result
      const endTime = Date.now();
      return {
        id: String(IdGenerator.generate('reasoning')),
        steps,
        conclusion: steps[steps.length - 1].content,
        confidence: steps[steps.length - 1].confidence || 0,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: endTime - startTime,
          strategy: 'react'
        }
      };
      
    } catch (error) {
      console.error('Error in ReAct reasoning:', error);
      throw error;
    }
  }
  
  /**
   * Validate a reasoning step
   */
  protected async validateStep(
    step: ReasoningStep,
    previousSteps: ReasoningStep[]
  ): Promise<{
    isValid: boolean;
    confidence: number;
    reason?: string;
  }> {
    try {
      // Build validation prompt
      const systemPrompt = `You are an AI assistant that validates reasoning steps.
Your task is to check if a reasoning step is valid given the previous steps.

Previous steps:
${previousSteps.map(s => `${s.type}: ${s.content}`).join('\n')}

Current step to validate:
Type: ${step.type}
Content: ${step.content}

Check for:
1. Logical consistency with previous steps
2. Appropriate step type for the content
3. Reasonable confidence level
4. No circular reasoning
5. Clear and actionable content

Respond with a JSON object:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "reason": "Explanation of validation result"
}`;

      // Call LLM for validation
      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage('Validate this reasoning step.')
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid validation response format');
      }
      
      return JSON.parse(jsonMatch[0]);
      
    } catch (error) {
      console.error('Error validating reasoning step:', error);
      return {
        isValid: false,
        confidence: 0,
        reason: 'Error during validation'
      };
    }
  }
} 