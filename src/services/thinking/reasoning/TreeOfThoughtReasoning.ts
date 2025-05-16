import { ReasoningService, ReasoningStep, ReasoningResult, ReasoningStepType, ReasoningOptions } from './ReasoningService';
import { ClassifiedIntent } from '../intent/IntentClassifier';
import { ExtractedEntity } from '../memory/EntityExtractor';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { IdGenerator } from '@/utils/ulid';

/**
 * Node in the reasoning tree
 */
interface TreeNode {
  step: ReasoningStep;
  children: TreeNode[];
  parent?: TreeNode;
  score: number;
}

interface ExpansionData {
  type: string;
  content: string;
  confidence: number;
  score: number;
}

/**
 * Implementation of Tree-of-Thought reasoning strategy
 */
export class TreeOfThoughtReasoning extends ReasoningService {
  private maxBranchingFactor = 3;
  private maxDepth = 4;
  
  /**
   * Apply Tree-of-Thought reasoning strategy
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
      minConfidence = 0.6,
      timeout = 60000,
      validateSteps = true
    } = options;
    
    const startTime = Date.now();
    const steps: ReasoningStep[] = [];
    
    try {
      // Build system prompt
      const systemPrompt = `You are an AI assistant that uses Tree-of-Thought reasoning to solve problems.
Follow this process:
1. Consider multiple possible approaches to the problem
2. For each approach, think through potential next steps
3. Evaluate the promise of each branch
4. Focus on the most promising paths
5. Draw conclusions from the best reasoning path

For each thought or step, provide:
1. Step type: "thought", "evaluation", or "conclusion"
2. Content: Your reasoning, evaluation, or conclusion
3. Confidence: How confident you are in this step (0.0 to 1.0)
4. Score: How promising this path seems (0.0 to 1.0)

Context provided:
${context.intent ? `Intent: ${context.intent.name} (${context.intent.description})` : ''}
${context.entities ? `Entities: ${context.entities.map(e => `${e.type}:${e.value}`).join(', ')}` : ''}
${context.relevantText ? `Relevant information:\n${context.relevantText.join('\n')}` : ''}

Respond in JSON format for each step:
{
  "type": "thought",
  "content": "One approach would be...",
  "confidence": 0.9,
  "score": 0.8,
  "alternatives": [
    {
      "content": "Another possibility is...",
      "score": 0.6
    }
  ]
}`;

      // Initialize tree with root node
      const rootStep: ReasoningStep = {
        id: String(IdGenerator.generate('step')),
        type: ReasoningStepType.THOUGHT,
        content: 'Initial analysis of the problem',
        confidence: 1.0,
        metadata: {
          timestamp: new Date().toISOString()
        }
      };
      
      const root: TreeNode = {
        step: rootStep,
        children: [],
        score: 1.0
      };
      
      steps.push(rootStep);
      
      // Explore tree using beam search
      let currentLevel: TreeNode[] = [root];
      let depth = 0;
      
      while (depth < this.maxDepth && Date.now() - startTime < timeout) {
        const nextLevel: TreeNode[] = [];
        
        // Expand each node at current level
        for (const node of currentLevel) {
          // Get next steps from LLM
          const expansions = await this.expandNode(node, query, context);
          
          // Add valid expansions to tree
          for (const expansion of expansions) {
            if (validateSteps) {
              const validation = await this.validateStep(expansion.step, steps);
              if (!validation.isValid || validation.confidence < minConfidence) {
                continue;
              }
            }
            
            steps.push(expansion.step);
            node.children.push(expansion);
            expansion.parent = node;
            nextLevel.push(expansion);
            
            // Check if we've reached a conclusion
            if (expansion.step.type === ReasoningStepType.CONCLUSION) {
              // Return path to this conclusion if it's good enough
              if (expansion.score >= minConfidence) {
                const pathSteps = this.getPathToNode(expansion);
                const endTime = Date.now();
                
                return {
                  id: String(IdGenerator.generate('reasoning')),
                  steps: pathSteps,
                  conclusion: expansion.step.content,
                  confidence: expansion.score,
                  metadata: {
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    duration: endTime - startTime,
                    strategy: 'tot'
                  }
                };
              }
            }
          }
        }
        
        // Select best nodes for next level using beam search
        currentLevel = nextLevel
          .sort((a, b) => b.score - a.score)
          .slice(0, this.maxBranchingFactor);
          
        depth++;
      }
      
      // If no conclusion reached, return best path found
      const bestNode = this.findBestNode(root);
      const bestPath = this.getPathToNode(bestNode);
      
      const endTime = Date.now();
      return {
        id: String(IdGenerator.generate('reasoning')),
        steps: bestPath,
        conclusion: bestNode.step.content,
        confidence: bestNode.score,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          duration: endTime - startTime,
          strategy: 'tot'
        }
      };
      
    } catch (error) {
      console.error('Error in Tree-of-Thought reasoning:', error);
      throw error;
    }
  }
  
  /**
   * Expand a node in the reasoning tree
   */
  private async expandNode(
    node: TreeNode,
    query: string,
    context: {
      intent?: ClassifiedIntent;
      entities?: ExtractedEntity[];
      relevantText?: string[];
    }
  ): Promise<TreeNode[]> {
    try {
      // Build expansion prompt
      const expansionPrompt = `Current reasoning path:
${this.getPathToNode(node).map(step => 
  `${step.type}: ${step.content}`
).join('\n')}

Generate ${this.maxBranchingFactor} possible next steps for this reasoning path.
Consider different approaches and evaluate their promise.

Respond in JSON format:
{
  "expansions": [
    {
      "type": "thought|evaluation|conclusion",
      "content": "Next step content...",
      "confidence": 0.9,
      "score": 0.8
    }
  ]
}`;

      // Call LLM for expansions
      const messages = [
        new SystemMessage(expansionPrompt),
        new HumanMessage(`Query: "${query}"`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      
      // Parse response
      const responseContent = response.content.toString();
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Invalid expansion response format');
      }
      
      const data = JSON.parse(jsonMatch[0]);
      
      if (!data.expansions || !Array.isArray(data.expansions)) {
        throw new Error('Invalid expansions data structure');
      }
      
      // Create tree nodes from expansions
      return data.expansions.map((exp: ExpansionData) => ({
        step: {
          id: String(IdGenerator.generate('step')),
          type: exp.type as ReasoningStepType,
          content: exp.content,
          confidence: exp.confidence,
          metadata: {
            timestamp: new Date().toISOString(),
            dependencies: [node.step.id]
          }
        },
        children: [],
        score: exp.score
      }));
      
    } catch (error) {
      console.error('Error expanding node:', error);
      return [];
    }
  }
  
  /**
   * Get the path from root to a node
   */
  private getPathToNode(node: TreeNode): ReasoningStep[] {
    const path: ReasoningStep[] = [];
    let current: TreeNode | undefined = node;
    
    while (current) {
      path.unshift(current.step);
      current = current.parent;
    }
    
    return path;
  }
  
  /**
   * Find the best node in the tree
   */
  private findBestNode(root: TreeNode): TreeNode {
    let bestNode = root;
    let bestScore = root.score;
    
    // Recursive search
    const search = (node: TreeNode) => {
      if (node.score > bestScore) {
        bestNode = node;
        bestScore = node.score;
      }
      
      for (const child of node.children) {
        search(child);
      }
    };
    
    search(root);
    return bestNode;
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
      const systemPrompt = `You are an AI assistant that validates Tree-of-Thought reasoning steps.
Your task is to check if a reasoning step is valid and contributes meaningfully to the solution.

Previous steps:
${previousSteps.map(s => `${s.type}: ${s.content}`).join('\n')}

Current step to validate:
Type: ${step.type}
Content: ${step.content}

Check for:
1. Logical consistency with previous steps
2. Novel contribution to the reasoning process
3. Clear and actionable insights
4. Appropriate step type
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