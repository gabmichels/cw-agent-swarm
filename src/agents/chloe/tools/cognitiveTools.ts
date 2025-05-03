import { CognitiveMemory } from '../../../lib/memory/src/cognitive-memory';
import { KnowledgeGraph } from '../../../lib/memory/src/knowledge-graph';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ImportanceLevel, ChloeMemoryType } from '../../../constants/memory';

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
 * Cognitive Memory Tool for accessing and manipulating memory using LangChain's StructuredTool
 */
export class MemoryRetrievalToolLC extends StructuredTool {
  private cognitiveMemory: CognitiveMemory;
  
  constructor(cognitiveMemory: CognitiveMemory) {
    super({
      name: 'memory_retrieval',
      description: 'Retrieve memories based on content, emotions, or time periods',
      schema: z.object({
        query: z.string().describe('Content to search for in memories'),
        emotion: z.string().optional().describe('Optional emotion to filter memories by'),
        limit: z.number().optional().describe('Maximum number of memories to retrieve')
      }),
      func: async ({ query, emotion, limit = 5 }: { 
        query: string; 
        emotion?: string; 
        limit?: number 
      }) => {
        try {
          let memories: any[] = [];
          
          // Retrieve by emotion if specified
          if (emotion && emotion.length > 0) {
            memories = await cognitiveMemory.getMemoriesByEmotion(
              emotion as any,
              limit
            );
          } else {
            // Otherwise retrieve by content
            memories = await cognitiveMemory.getRelevantMemories(
              query,
              limit,
              [ChloeMemoryType.DOCUMENT, ChloeMemoryType.THOUGHT, ChloeMemoryType.MESSAGE, ChloeMemoryType.TASK]
            );
          }
          
          // Format the response
          const formattedMemories = memories.map(memory => {
            return {
              content: memory.text || memory.content,
              type: memory.metadata?.type || 'unknown',
              created: memory.metadata?.created || 'unknown date',
              importance: memory.metadata?.importance || ImportanceLevel.MEDIUM,
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
            display: `I had trouble retrieving memories.`
          };
        }
      }
    });
    
    this.cognitiveMemory = cognitiveMemory;
  }
}

/**
 * Knowledge Graph Tool for LangChain StructuredTool
 */
export class KnowledgeGraphToolLC extends StructuredTool {
  private knowledgeGraph: KnowledgeGraph;
  
  constructor(knowledgeGraph: KnowledgeGraph) {
    super({
      name: 'knowledge_graph',
      description: 'Query the knowledge graph for concepts and relationships',
      schema: z.object({
        concept: z.string().describe('Concept or entity to find in the knowledge graph'),
        relationshipType: z.string().optional().describe('Optional relationship type to filter by'),
        findConnections: z.boolean().optional().describe('Whether to find connections to other concepts')
      }),
      func: async ({ concept, relationshipType, findConnections = false }: {
        concept: string;
        relationshipType?: string;
        findConnections?: boolean;
      }) => {
        try {
          // First, find nodes matching the concept
          const nodes = await knowledgeGraph.findNodes(concept, undefined, 5);
          
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
          const edges = await knowledgeGraph.getEdges(
            mainNode.id,
            'both',
            relationshipType ? [relationshipType as any] : undefined
          );
          
          // Get related node details
          const relatedNodePromises = edges.map(async edge => {
            const otherId = edge.source === mainNode.id ? edge.target : edge.source;
            const direction = edge.source === mainNode.id ? 'outgoing' : 'incoming';
            
            // Find node details
            const relatedNodes = await knowledgeGraph.findNodes('', undefined, 100);
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
                  ? `${mainNode.label} ${related.relationship} ${related.node.label}`
                  : `${related.node.label} ${related.relationship} ${mainNode.label}`;
                  
              displayMessage += `${i+1}. ${related.node.label} (${related.node.type}): ${relationshipDesc}\n`;
            });
          }
          
          return {
            success: true,
            mainNode,
            relatedNodes,
            count: relatedNodes.length,
            display: displayMessage
          };
        } catch (error) {
          console.error('Error querying knowledge graph:', error);
          return {
            success: false,
            message: `Error querying knowledge graph: ${error instanceof Error ? error.message : String(error)}`,
            display: `I had trouble finding information about "${concept}" in my knowledge graph.`
          };
        }
      }
    });
    
    this.knowledgeGraph = knowledgeGraph;
  }
}

/**
 * Working Memory Tool for LangChain StructuredTool
 */
export class WorkingMemoryToolLC extends StructuredTool {
  private cognitiveMemory: CognitiveMemory;
  
  constructor(cognitiveMemory: CognitiveMemory) {
    super({
      name: 'working_memory',
      description: 'Manage working memory - get, add, or clear items',
      schema: z.object({
        action: z.enum(['get', 'add', 'clear']).describe('Action to perform on working memory'),
        content: z.string().optional().describe('Content to add to working memory (only for add action)'),
        importance: z.enum([ImportanceLevel.LOW, ImportanceLevel.MEDIUM, ImportanceLevel.HIGH, ImportanceLevel.CRITICAL]).optional().describe('Importance of the content (only for add action)')
      }),
      func: async ({ action, content, importance = ImportanceLevel.MEDIUM }: {
        action: 'get' | 'add' | 'clear';
        content?: string;
        importance?: ImportanceLevel;
      }) => {
        try {
          switch (action) {
            case 'get': {
              const workingMemory = cognitiveMemory.getWorkingMemory();
              
              if (workingMemory.length === 0) {
                return {
                  success: true,
                  items: [],
                  count: 0,
                  display: "I don't have anything in my working memory right now."
                };
              }
              
              const displayMessage = "Here's what I'm currently keeping in mind:\n\n" +
                workingMemory.map((item, i) => 
                  `${i+1}. ${item.content} (priority: ${item.priority})`
                ).join('\n\n');
              
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
                  message: "No content provided to add to working memory.",
                  display: "I need some content to add to my working memory."
                };
              }
              
              // Use the proper method based on the CognitiveMemory interface
              cognitiveMemory.addItemToWorkingMemory({
                id: `wm_${Date.now()}`,
                content,
                addedAt: new Date(),
                priority: importance === ImportanceLevel.HIGH ? 3 : importance === ImportanceLevel.MEDIUM ? 2 : 1,
                source: 'external',
                relatedIds: []
              });
              
              return {
                success: true,
                message: "Added to working memory.",
                display: `I've added "${content}" to my working memory with ${importance} importance.`
              };
            }
            
            case 'clear': {
              // There's no clearWorkingMemory method, so we'll set working memory to empty
              // We can do this by tracking current items and removing them one by one
              const workingMemory = cognitiveMemory.getWorkingMemory();
              
              // Clear all items by overwriting them with low priority items that will be discarded
              for (let i = 0; i < workingMemory.length; i++) {
                // Add a placeholder item with lowest priority (should replace all existing items)
                cognitiveMemory.addItemToWorkingMemory({
                  id: `clear_${i}_${Date.now()}`,
                  content: ``,
                  addedAt: new Date(),
                  priority: -1, // Lowest priority
                  source: 'external',
                  relatedIds: []
                });
              }
              
              return {
                success: true,
                message: "Working memory cleared.",
                display: "I've cleared my working memory."
              };
            }
            
            default:
              return {
                success: false,
                message: `Invalid action: ${action}`,
                display: "I'm not sure what you want me to do with my working memory."
              };
          }
        } catch (error) {
          console.error('Error with working memory operation:', error);
          return {
            success: false,
            message: `Error with working memory: ${error instanceof Error ? error.message : String(error)}`,
            display: "I had trouble managing my working memory."
          };
        }
      }
    });
    
    this.cognitiveMemory = cognitiveMemory;
  }
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
    try {
      const query = params.query || '';
      const emotion = params.emotion;
      const limit = params.limit || 5;
      
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
          [ChloeMemoryType.DOCUMENT, ChloeMemoryType.THOUGHT, ChloeMemoryType.MESSAGE, ChloeMemoryType.TASK]
        );
      }
      
      // Format the response
      const formattedMemories = memories.map(memory => {
        return {
          content: memory.text || memory.content,
          type: memory.metadata?.type || 'unknown',
          created: memory.metadata?.created || 'unknown date',
          importance: memory.metadata?.importance || ImportanceLevel.MEDIUM,
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
        display: `I had trouble retrieving memories.`
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
              ? `${mainNode.label} ${related.relationship} ${related.node.label}`
              : `${related.node.label} ${related.relationship} ${mainNode.label}`;
              
          displayMessage += `${i+1}. ${related.node.label} (${related.node.type}): ${relationshipDesc}\n`;
        });
      }
      
      return {
        success: true,
        mainNode,
        relatedNodes,
        count: relatedNodes.length,
        display: displayMessage
      };
    } catch (error) {
      console.error('Error querying knowledge graph:', error);
      return {
        success: false,
        message: `Error querying knowledge graph: ${error instanceof Error ? error.message : String(error)}`,
        display: `I had trouble finding information about "${concept}" in my knowledge graph.`
      };
    }
  }
}

/**
 * Working Memory Tool
 */
export class WorkingMemoryTool extends BaseTool {
  private cognitiveMemory: CognitiveMemory;
  
  constructor(cognitiveMemory: CognitiveMemory) {
    super(
      'working_memory',
      'Manage working memory - get, add, or clear items',
      {
        action: {
          type: 'string',
          description: 'Action to perform on working memory',
          enum: ['get', 'add', 'clear']
        },
        content: {
          type: 'string',
          description: 'Content to add to working memory (only for add action)',
          default: ''
        },
        importance: {
          type: 'string',
          description: 'Importance of the content (only for add action)',
          enum: ['low', 'medium', 'high'],
          default: 'medium'
        }
      }
    );
    this.cognitiveMemory = cognitiveMemory;
  }
  
  async execute(params: Record<string, any>): Promise<any> {
    const { action, content, importance = 'medium' } = params;
    
    try {
      switch (action) {
        case 'get': {
          const workingMemory = this.cognitiveMemory.getWorkingMemory();
          
          if (workingMemory.length === 0) {
            return {
              success: true,
              items: [],
              count: 0,
              display: "I don't have anything in my working memory right now."
            };
          }
          
          const displayMessage = "Here's what I'm currently keeping in mind:\n\n" +
            workingMemory.map((item, i) => 
              `${i+1}. ${item.content} (priority: ${item.priority})`
            ).join('\n\n');
          
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
              message: "No content provided to add to working memory.",
              display: "I need some content to add to my working memory."
            };
          }
          
          this.cognitiveMemory.addItemToWorkingMemory({
            id: `wm_${Date.now()}`,
            content,
            addedAt: new Date(),
            priority: importance === ImportanceLevel.HIGH ? 3 : importance === ImportanceLevel.MEDIUM ? 2 : 1,
            source: 'external',
            relatedIds: []
          });
          
          return {
            success: true,
            message: "Added to working memory.",
            display: `I've added "${content}" to my working memory with ${importance} importance.`
          };
        }
        
        case 'clear': {
          // There's no clearWorkingMemory method, so we'll set working memory to empty
          // We can do this by tracking current items and removing them one by one
          const workingMemory = this.cognitiveMemory.getWorkingMemory();
              
          // Clear all items by overwriting them with low priority items that will be discarded
          for (let i = 0; i < workingMemory.length; i++) {
            // Add a placeholder item with lowest priority (should replace all existing items)
            this.cognitiveMemory.addItemToWorkingMemory({
              id: `clear_${i}_${Date.now()}`,
              content: ``,
              addedAt: new Date(),
              priority: -1, // Lowest priority
              source: 'external',
              relatedIds: []
            });
          }
          
          return {
            success: true,
            message: "Working memory cleared.",
            display: "I've cleared my working memory."
          };
        }
        
        default:
          return {
            success: false,
            message: `Invalid action: ${action}`,
            display: "I'm not sure what you want me to do with my working memory."
          };
      }
    } catch (error) {
      console.error('Error with working memory operation:', error);
      return {
        success: false,
        message: `Error with working memory: ${error instanceof Error ? error.message : String(error)}`,
        display: "I had trouble managing my working memory."
      };
    }
  }
}

/**
 * Creates cognitive tools for an agent
 */
export const createCognitiveTools = (
  cognitiveMemory: CognitiveMemory,
  knowledgeGraph: KnowledgeGraph
): { [key: string]: BaseTool } => {
  return {
    memoryRetrieval: new MemoryRetrievalTool(cognitiveMemory),
    knowledgeGraph: new KnowledgeGraphTool(knowledgeGraph),
    workingMemory: new WorkingMemoryTool(cognitiveMemory)
  };
};

/**
 * Creates LangChain compatible cognitive tools for an agent
 */
export const createLangChainCognitiveTools = (
  cognitiveMemory: CognitiveMemory,
  knowledgeGraph: KnowledgeGraph
): { [key: string]: StructuredTool } => {
  return {
    memoryRetrieval: new MemoryRetrievalToolLC(cognitiveMemory),
    knowledgeGraph: new KnowledgeGraphToolLC(knowledgeGraph),
    workingMemory: new WorkingMemoryToolLC(cognitiveMemory)
  };
}; 