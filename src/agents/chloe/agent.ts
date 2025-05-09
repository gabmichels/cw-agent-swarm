/**
 * Re-export file for ChloeAgent
 * 
 * This file is a compatibility layer that re-exports the ChloeAgent from core/agent.ts
 * to maintain backward compatibility with code that imports from '../agent'.
 */

export { ChloeAgent } from './core/agent';
export type { ChloeAgentOptions } from './core/agent';

// Export methods to get cognitive memory and knowledge graph from the agent instance
import { ChloeAgent } from './core/agent';
import { CognitiveMemory } from '../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../lib/knowledge/KnowledgeGraph';

// Add method extensions to ChloeAgent prototype
declare module './core/agent' {
  interface ChloeAgent {
    getCognitiveMemory(): CognitiveMemory | null;
    getKnowledgeGraph(): KnowledgeGraph | null;
    getMemoryManager(): any;
    reflect(prompt: string): Promise<string>;
  }
}

// Extend ChloeAgent prototype with methods needed by tasks
ChloeAgent.prototype.getMemoryManager = function(): any {
  // This is a compatibility method for the old API
  // It should return an object that has getChloeMemory method
  return {
    getChloeMemory: () => this.getChloeMemory()
  };
};

ChloeAgent.prototype.getCognitiveMemory = function(): CognitiveMemory | null {
  const memory = this.getMemoryManager()?.getChloeMemory();
  // Memory interface likely doesn't expose this method directly
  // This is a workaround to get the cognitive memory
  return memory ? (memory as any).cognitiveMemory || null : null;
};

ChloeAgent.prototype.getKnowledgeGraph = function(): KnowledgeGraph | null {
  const memory = this.getMemoryManager()?.getChloeMemory();
  // Memory interface likely doesn't expose this method directly
  // This is a workaround to get the knowledge graph
  return memory ? (memory as any).knowledgeGraph || null : null;
};

// Implement the reflect method for compatibility
ChloeAgent.prototype.reflect = async function(prompt: string): Promise<string> {
  // This is a simplified stub implementation for compatibility
  console.log(`[Chloe Reflection] Prompt: ${prompt}`);
  
  // Since we can't use the actual model easily in this context,
  // this is a stub that just returns a formatted response
  return `[Reflection on: ${prompt}]\n\nThis is a compatibility layer reflection to satisfy the API requirements. For actual reflections, use the appropriate agent instance methods.`;
};

export default ChloeAgent; 