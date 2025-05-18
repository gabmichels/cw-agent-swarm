import { ThinkingState } from '../types';
import { getMemoryServices } from '../../../../server/memory/services';
import { ImportanceLevel } from '../../../../constants/memory';
import { WorkingMemoryItem } from '../../types';
import { SearchResult } from '../../../../server/memory/services/search/types';
import { BaseMemorySchema } from '../../../../server/memory/models/base-schema';
import { MemoryFormatter } from '../../memory/MemoryFormatter';
import { ContentSummaryGenerator } from '../../../../services/importance/ContentSummaryGenerator';
import { MemoryRetriever, MemoryRetrievalOptions } from '../../memory/MemoryRetriever';

/**
 * Node for retrieving relevant context for the thinking process
 * Fetches memories, files, and other relevant context based on the user's input
 */
export async function retrieveContextNode(state: ThinkingState): Promise<ThinkingState> {
  try {
    if (!state.userId || !state.input) {
      console.warn('Missing userId or input, skipping context retrieval');
      return state;
    }
    
    // Get memory service and create utility instances
    const { memoryService, searchService } = await getMemoryServices();
    const memoryRetriever = new MemoryRetriever();
    const contentSummaryGenerator = new ContentSummaryGenerator();
    const memoryFormatter = new MemoryFormatter();
    
    // Create updated state to hold context
    const updatedState: ThinkingState = {
      ...state,
      contextMemories: state.contextMemories || [],
      contextFiles: state.contextFiles || []
    };
    
    // Extract topics from the input to enhance retrieval
    const topics = contentSummaryGenerator.extractTopics(state.input);
    console.log(`Extracted topics from input: ${topics.join(', ')}`);
    
    // Create memory retrieval options with enhanced importance weighting
    const retrievalOptions: MemoryRetrievalOptions = {
      query: state.input,
      userId: state.userId,
      limit: 15, // Retrieve more memories for better context
      semanticSearch: true, // Enable semantic search
      tags: topics, // Use extracted topics as tags
      importanceWeighting: {
        enabled: true,
        priorityWeight: 1.2,
        confidenceWeight: 1.0,
        useTypeWeights: true,
        importanceScoreWeight: 1.5 // Give high weight to importance score
      },
      includeMetadata: true // Include all metadata
    };
    
    try {
      // Retrieve memories using enhanced retriever
      const { memories, memoryIds } = await memoryRetriever.retrieveMemories(retrievalOptions);
      
      if (memories.length > 0) {
        // Set context memories in state
        updatedState.contextMemories = memories;
        console.log(`Retrieved ${memories.length} memories with importance weighting`);
        
        // Format memories for inclusion in state context
        updatedState.formattedMemoryContext = memoryFormatter.formatMemoriesForContext(
          memories,
          { 
            sortBy: 'importance',
            groupByType: true,
            includeDetailedDescriptions: true,
            includeImportance: true,
            maxTokens: 3000
          }
        );
        
        // Log importance scores for debugging
        console.log('Top 3 memories by importance:');
        memories.slice(0, 3).forEach((memory, i) => {
          console.log(`  #${i+1}: Score=${memory.metadata?.importance_score?.toFixed(2) || 'N/A'}, Type=${memory.type}, Tags=${memory.tags.join(',')}`);
        });
      } else {
        updatedState.contextMemories = [];
        updatedState.formattedMemoryContext = 'No relevant memories found.';
      }
    } catch (searchError) {
      console.error('Error retrieving memories:', searchError);
      updatedState.contextMemories = [];
      updatedState.formattedMemoryContext = 'Error retrieving memories.';
    }
    
    // Retrieve relevant files if a document service is available
    try {
      // Sample implementation - would be replaced with actual document service
      // const documentService = await getDocumentService();
      // const relevantFiles = await documentService.findRelevantFiles(state.input, state.userId);
      // updatedState.contextFiles = relevantFiles;
      
      // For now, use empty array to prevent null errors
      updatedState.contextFiles = [];
      
      // If we have files, format them for context
      if (updatedState.contextFiles.length > 0) {
        const formattedFiles = memoryFormatter.formatFilesForContext(
          updatedState.contextFiles,
          { maxFiles: 5, maxContentLength: 1000 }
        );
        
        // Add formatted file content to context
        if (updatedState.formattedMemoryContext) {
          updatedState.formattedMemoryContext += '\n\n' + formattedFiles;
        } else {
          updatedState.formattedMemoryContext = formattedFiles;
        }
      }
    } catch (error) {
      console.error('Error retrieving relevant files:', error);
      updatedState.contextFiles = [];
    }
    
    const contextMemoryCount = updatedState.contextMemories?.length || 0;
    console.log(`Retrieved ${contextMemoryCount} memories for context`);
    return updatedState;
  } catch (error) {
    console.error('Error in retrieveContextNode:', error);
    // Don't fail the workflow - return state as is
    return {
      ...state,
      contextMemories: [],
      contextFiles: [],
      formattedMemoryContext: 'Error retrieving context.'
    };
  }
}

/**
 * Extract a brief summary from content
 */
function extractSummary(content: string): string {
  if (!content) return '';
  
  // Get first 100 characters or first sentence, whichever is shorter
  const firstSentenceMatch = content.match(/^[^.!?]+[.!?]/);
  if (firstSentenceMatch && firstSentenceMatch[0].length < 100) {
    return firstSentenceMatch[0].trim();
  }
  
  return content.substring(0, 100).trim() + '...';
} 