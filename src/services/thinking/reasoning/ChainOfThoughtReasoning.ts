import { ReasoningService, ReasoningStep, ReasoningResult, ReasoningStepType, ReasoningOptions } from './ReasoningService';
import { ClassifiedIntent } from '../intent/IntentClassifier';
import { ExtractedEntity } from '../memory/EntityExtractor';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';

/**
 * Implementation of Chain-of-Thought reasoning strategy
 */
export class ChainOfThoughtReasoning extends ReasoningService {
  /**
   * Apply Chain-of-Thought reasoning strategy
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
      maxSteps = 5,
      minConfidence = 0.6,
      timeout = 30000,
      validateSteps = true
    } = options;
    
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    
    try {
      // Build system prompt
      const systemPrompt = `You are an AI assistant that uses Chain-of-Thought reasoning to solve problems.
Follow this process:
1. Break down the problem into logical steps
2. Think through each step carefully
3. Show your reasoning process
4. Draw a conclusion based on your chain of thoughts

For each step in your thinking process, provide:
1. Step type: "thought" or "conclusion"
2. Content: Your reasoning or conclusion
3. Confidence: How confident you are in this step (0.0 to 1.0)

Context provided:
${context.intent ? `Intent: ${context.intent.name} (${context.intent.description})` : ''}
${context.entities ? `Entities: ${context.entities.map(e => `${e.type}:${e.value}`).join(', ')}` : ''}
${context.relevantText ? `Relevant information:\n${context.relevantText.join('\n')}` : ''}

Respond in JSON format for each step:
{
  "type": "thought",
  "content": "First, let's consider...",
  "confidence": 0.9
}`;

      // Initialize conversation
      let messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Think through this problem: "${query}"`)
      ];
      
      // Chain-of-Thought loop
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
        
        // Prompt for next step
        messages.push(new HumanMessage('Continue your chain of thought...'));
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
          strategy: 'cot'
        }
      };
      
    } catch (error) {
      console.error('Error in Chain-of-Thought reasoning:', error);
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
      const systemPrompt = `You are an AI assistant that validates Chain-of-Thought reasoning steps.
Your task is to check if a reasoning step is valid and follows logically from previous steps.

Previous steps:
${previousSteps.map(s => `${s.type}: ${s.content}`).join('\n')}

Current step to validate:
Type: ${step.type}
Content: ${step.content}

Check for:
1. Logical flow from previous steps
2. Clear and coherent reasoning
3. Appropriate level of detail
4. No logical fallacies
5. Reasonable confidence level

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