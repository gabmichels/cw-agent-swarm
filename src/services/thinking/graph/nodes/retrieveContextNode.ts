import { ThinkingState } from '../types';
import { getMemoryServices } from '../../../../server/memory/services';
import { ImportanceLevel } from '../../../../constants/memory';
import { WorkingMemoryItem } from '../../types';
import { SearchResult } from '../../../../server/memory/services/search/types';
import { BaseMemorySchema } from '../../../../server/memory/models/base-schema';

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
    
    // Get memory service
    const { memoryService, searchService } = await getMemoryServices();
    
    // Create updated state to hold context
    const updatedState: ThinkingState = {
      ...state,
      contextMemories: state.contextMemories || [],
      contextFiles: state.contextFiles || []
    };
    
    // Retrieve relevant memories using semantic search
    try {
      // Use the search method with proper parameters based on signature
      const relevantMemories = await searchService.search(
        state.input, // query parameter
        {  
          limit: 10,
          minScore: 0.7,
          filter: { userId: state.userId }
        }
      );
      
      // Convert search results to working memory items
      const workingMemories: WorkingMemoryItem[] = relevantMemories.map((result: SearchResult<BaseMemorySchema>) => {
        // Get text and metadata from the search result
        const content = result.point.payload?.text || '';
        const metadata = result.point.payload?.metadata || {};
        const timestamp = result.point.payload?.timestamp ? new Date(result.point.payload.timestamp) : new Date();
        const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
        
        // Create working memory item
        return {
          id: result.point.id,
          content,
          type: 'fact', // Default type
          tags,
          addedAt: timestamp,
          priority: result.score * 10, // Convert score to priority
          expiresAt: null,
          confidence: result.score,
          userId: state.userId,
          _relevanceScore: result.score
        };
      });
      
      // Add retrieved memories to the state
      if (workingMemories && workingMemories.length > 0) {
        const highImportanceMemories = workingMemories
          .filter((memory: WorkingMemoryItem) => {
            // The metadata is in the original search result, but we've simplified in our conversion
            // We'd need to find the original result to check importance
            const originalResult = relevantMemories.find(r => r.point.id === memory.id);
            const metadata = originalResult?.point.payload?.metadata;
            return metadata?.importance === ImportanceLevel.HIGH;
          });
        
        const mediumImportanceMemories = workingMemories
          .filter((memory: WorkingMemoryItem) => {
            const originalResult = relevantMemories.find(r => r.point.id === memory.id);
            const metadata = originalResult?.point.payload?.metadata;
            return metadata?.importance === ImportanceLevel.MEDIUM;
          });
        
        // Prioritize high importance memories, then medium, up to a total of 10
        const prioritizedMemories = [
          ...highImportanceMemories,
          ...mediumImportanceMemories
        ].slice(0, 10);
        
        if (updatedState.contextMemories) {
          updatedState.contextMemories = prioritizedMemories;
        }
      }
    } catch (searchError) {
      console.error('Error retrieving memories:', searchError);
      updatedState.contextMemories = [];
    }
    
    // Retrieve relevant files if a document service is available
    // This is a placeholder for when document retrieval is implemented
    try {
      // Sample implementation - would be replaced with actual document service
      // const documentService = await getDocumentService();
      // const relevantFiles = await documentService.findRelevantFiles(state.input, state.userId);
      // updatedState.contextFiles = relevantFiles;
      
      // For now, use empty array to prevent null errors
      updatedState.contextFiles = [];
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
      contextFiles: []
    };
  }
} 