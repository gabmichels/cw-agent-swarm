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
  }
}

// Extend ChloeAgent prototype with methods needed by tasks
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

export default ChloeAgent; 