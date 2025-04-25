import { CognitiveMemory } from '../../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../../lib/memory/src/knowledge-graph';

// Define BaseTool abstract class since it's not exported from intentRouter
abstract class BaseTool {
  public name: string;
  public description: string;
  public schema: Record<string, any>;

  constructor(
    name: string,
    description: string,
    schema: Record<string, any> = {}
  ) {
    this.name = name;
    this.description = description;
    this.schema = schema;
  }

  abstract execute(params: Record<string, any>): Promise<any>;
}

/**
 * Cognitive Memory Tool for accessing and manipulating memory
 */
export class MemoryRetrievalTool extends BaseTool {
  private cognitiveMemory: CognitiveMemory;
  
  constructor(cognitiveMemory: CognitiveMemory) {
    super(
      'memory_retrieval',
      'Retrieve memories based on content, emotions, or time periods',
      {
        query: {
          type: 'string',
          description: 'Content to search for in memories'
        },
        emotion: {
          type: 'string',
          description: 'Optional emotion to filter memories by',
          default: ''
        },
        limit: {
          type: 'number',
          description: 'Maximum number of memories to retrieve',
          default: 5
        }
      }
    );
    this.cognitiveMemory = cognitiveMemory;
  }
  
  async execute(params: Record<string, any>): Promise<any> {
    const { query, emotion, limit = 5 } = params;
    
    try {
      let memories: any[] = [];
      
      // Retrieve by emotion if specified
      if (emotion && emotion.length > 0) {
        memories = await this.cognitiveMemory.getMemoriesByEmotion(
          emotion as any,
          limit
        );
      } else {
        // Otherwise retrieve by content
        memories = await this.cognitiveMemory.getRelevantMemories(
          query,
          limit,
          ['document', 'thought', 'message', 'task']
        );
      }
      
      // Format the response
      const formattedMemories = memories.map(memory => {
        return {
          content: memory.text || memory.content,
          type: memory.metadata?.type || 'unknown',
          created: memory.metadata?.created || 'unknown date',
          importance: memory.metadata?.importance || 'medium',
          emotions: memory.metadata?.emotions || ['neutral']
        };
      });
      
      const displayMessage = `Here's what I remember about "${query}":\n\n` +
        formattedMemories.map((m, i) => `${i+1}. ${m.content} (${m.type}, ${m.importance} importance)`).join('\n\n');
      
      return {
        success: true,
        memories: formattedMemories,
        count: formattedMemories.length,
        display: displayMessage
      };
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return {
        success: false,
        message: `Error retrieving memories: ${error instanceof Error ? error.message : String(error)}`,
        display: `I had trouble retrieving memories about "${query}".`
      };
    }
  }
}

/**
 * Knowledge Graph Query Tool
 */
export class KnowledgeGraphTool extends BaseTool {
  private knowledgeGraph: KnowledgeGraph;
  
  constructor(knowledgeGraph: KnowledgeGraph) {
    super(
      'knowledge_graph',
      'Query the knowledge graph for concepts and relationships',
      {
        concept: {
          type: 'string',
          description: 'Concept or entity to find in the knowledge graph'
        },
        relationshipType: {
          type: 'string',
          description: 'Optional relationship type to filter by',
          default: ''
        },
        findConnections: {
          type: 'boolean',
          description: 'Whether to find connections to other concepts',
          default: false
        }
      }
    );
    this.knowledgeGraph = knowledgeGraph;
  }
  
  async execute(params: Record<string, any>): Promise<any> {
    const { concept, relationshipType, findConnections = false } = params;
    
    try {
      // First, find nodes matching the concept
      const nodes = await this.knowledgeGraph.findNodes(concept, undefined, 5);
      
      if (nodes.length === 0) {
        return {
          success: false,
          message: `No knowledge found about "${concept}".`,
          display: `I don't have any knowledge about "${concept}" in my memory yet.`
        };
      }
      
      // If we're not looking for connections, just return the nodes
      if (!findConnections) {
        const displayMessage = `Here's what I know about "${concept}":\n\n` +
          nodes.map((node, i) => `${i+1}. ${node.label} (${node.type})`).join('\n');
        
        return {
          success: true,
          nodes,
          count: nodes.length,
          display: displayMessage
        };
      }
      
      // Otherwise, find connections for the first node
      const mainNode = nodes[0];
      const edges = await this.knowledgeGraph.getEdges(
        mainNode.id,
        'both',
        relationshipType ? [relationshipType as any] : undefined
      );
      
      // Get related node details
      const relatedNodePromises = edges.map(async edge => {
        const otherId = edge.source === mainNode.id ? edge.target : edge.source;
        const direction = edge.source === mainNode.id ? 'outgoing' : 'incoming';
        
        // Find node details
        const relatedNodes = await this.knowledgeGraph.findNodes('', undefined, 100);
        const relatedNode = relatedNodes.find(n => n.id === otherId);
        
        return {
          node: relatedNode || { id: otherId, label: 'Unknown', type: 'unknown' },
          relationship: edge.type,
          direction,
          strength: edge.strength
        };
      });
      
      const relatedNodes = await Promise.all(relatedNodePromises);
      
      // Format response
      let displayMessage = `Here's what I know about "${mainNode.label}":\n\n`;
      
      if (relatedNodes.length === 0) {
        displayMessage += `I know about "${mainNode.label}" (${mainNode.type}), but don't have information about how it relates to other concepts yet.`;
      } else {
        displayMessage += `"${mainNode.label}" (${mainNode.type}) is connected to:\n\n`;
        
        relatedNodes.forEach((related, i) => {
          const relationshipDesc = 
            related.direction === 'outgoing' 
              ? `${related.relationship} →` 
              : `← ${related.relationship}`;
              
          displayMessage += `${i+1}. ${related.node.label} (${relationshipDesc}, ${Math.round(related.strength * 100)}% confidence)\n`;
        });
      }
      
      return {
        success: true,
        concept: mainNode,
        relationships: relatedNodes,
        count: relatedNodes.length,
        display: displayMessage
      };
    } catch (error) {
      console.error('Error querying knowledge graph:', error);
      return {
        success: false,
        message: `Error querying knowledge graph: ${error instanceof Error ? error.message : String(error)}`,
        display: `I had trouble retrieving knowledge about "${concept}".`
      };
    }
  }
}

/**
 * Working Memory Management Tool
 */
export class WorkingMemoryTool extends BaseTool {
  private cognitiveMemory: CognitiveMemory;
  
  constructor(cognitiveMemory: CognitiveMemory) {
    super(
      'working_memory',
      'Retrieve or manipulate the working memory (currently active thoughts)',
      {
        action: {
          type: 'string',
          description: 'Action to perform (get, add, clear)',
          default: 'get'
        },
        content: {
          type: 'string',
          description: 'Content to add to working memory (for add action)',
          default: ''
        },
        priority: {
          type: 'number',
          description: 'Priority of the item (for add action)',
          default: 1
        }
      }
    );
    this.cognitiveMemory = cognitiveMemory;
  }
  
  async execute(params: Record<string, any>): Promise<any> {
    const { action = 'get', content = '', priority = 1 } = params;
    
    try {
      switch (action) {
        case 'get': {
          const workingMemory = this.cognitiveMemory.getWorkingMemory();
          
          const displayMessage = workingMemory.length === 0
            ? "My working memory is currently empty."
            : "Here's what I'm currently thinking about:\n\n" +
              workingMemory
                .sort((a, b) => b.priority - a.priority)
                .map((item, i) => `${i+1}. ${item.content} (priority: ${item.priority})`).join('\n');
          
          return {
            success: true,
            items: workingMemory,
            count: workingMemory.length,
            display: displayMessage
          };
        }
        
        case 'add': {
          if (!content) {
            return {
              success: false,
              message: "No content provided to add to working memory",
              display: "I need content to add to my working memory."
            };
          }
          
          // Use the public method for adding to working memory
          this.cognitiveMemory.addItemToWorkingMemory({
            id: `wm_${Date.now()}`,
            content,
            addedAt: new Date(),
            priority: priority,
            source: 'external',
            relatedIds: []
          });
          
          return {
            success: true,
            message: "Added to working memory",
            display: `I'll keep "${content}" in mind. It's now in my working memory.`
          };
        }
        
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`,
            display: `I don't know how to ${action} working memory.`
          };
      }
    } catch (error) {
      console.error('Error managing working memory:', error);
      return {
        success: false,
        message: `Error managing working memory: ${error instanceof Error ? error.message : String(error)}`,
        display: "I encountered an error while managing my working memory."
      };
    }
  }
}

/**
 * Factory function to create cognitive tools for a given cognitive memory system
 */
export const createCognitiveTools = (
  cognitiveMemory: CognitiveMemory,
  knowledgeGraph: KnowledgeGraph
): { [key: string]: BaseTool } => {
  return {
    memory_retrieval: new MemoryRetrievalTool(cognitiveMemory),
    knowledge_graph: new KnowledgeGraphTool(knowledgeGraph),
    working_memory: new WorkingMemoryTool(cognitiveMemory)
  };
}; 