import { WorkingMemoryItem, FileReference } from '../types';
import { ImportanceLevel } from '../../../constants/memory';

/**
 * Options for formatting memories for context
 */
export interface MemoryFormattingOptions {
  /**
   * Maximum number of tokens for formatted memories
   */
  maxTokens?: number;
  
  /**
   * Whether to group memories by type
   */
  groupByType?: boolean;
  
  /**
   * Sort order for memories
   */
  sortBy?: 'relevance' | 'time' | 'importance';
  
  /**
   * Whether to include detailed descriptions
   */
  includeDetailedDescriptions?: boolean;
  
  /**
   * Whether to include memory metadata
   */
  includeMetadata?: boolean;
  
  /**
   * Include importance ratings in the output
   */
  includeImportance?: boolean;
}

/**
 * Default formatting options
 */
const DEFAULT_OPTIONS: MemoryFormattingOptions = {
  maxTokens: 3000,
  groupByType: true,
  sortBy: 'relevance',
  includeDetailedDescriptions: false,
  includeMetadata: false,
  includeImportance: true
};

/**
 * Service for formatting memories for LLM context
 */
export class MemoryFormatter {
  /**
   * Format memories for inclusion in LLM context
   */
  formatMemoriesForContext(
    memories: WorkingMemoryItem[], 
    options: MemoryFormattingOptions = DEFAULT_OPTIONS
  ): string {
    if (!memories || memories.length === 0) {
      return "No relevant memories available.";
    }
    
    // Apply provided options with defaults
    const formatOptions = { ...DEFAULT_OPTIONS, ...options };
    
    // Clone memories to avoid modifying the original
    let memoriesToFormat = [...memories];
    
    // Sort memories appropriately
    memoriesToFormat = this.sortMemories(memoriesToFormat, formatOptions.sortBy);
    
    // Format according to grouping preference
    let formattedResult: string;
    if (formatOptions.groupByType) {
      formattedResult = this.formatGroupedMemories(memoriesToFormat, formatOptions);
    } else {
      formattedResult = this.formatFlatMemories(memoriesToFormat, formatOptions);
    }
    
    // Limit tokens (approximate calculation)
    if (formatOptions.maxTokens) {
      formattedResult = this.limitTokens(formattedResult, formatOptions.maxTokens);
    }
    
    return formattedResult;
  }
  
  /**
   * Sort memories based on specified criteria
   */
  private sortMemories(
    memories: WorkingMemoryItem[], 
    sortBy: 'relevance' | 'time' | 'importance' = 'relevance'
  ): WorkingMemoryItem[] {
    switch (sortBy) {
      case 'time':
        return [...memories].sort((a, b) => 
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
        
      case 'importance':
        return [...memories].sort((a, b) => {
          // Compare by importance_score if available
          const aScore = a.metadata?.importance_score ?? 0;
          const bScore = b.metadata?.importance_score ?? 0;
          
          if (aScore !== bScore) {
            return bScore - aScore; // Higher score first
          }
          
          // Fall back to relevance score
          return (b._relevanceScore ?? 0) - (a._relevanceScore ?? 0);
        });
        
      case 'relevance':
      default:
        return [...memories].sort((a, b) => 
          (b._relevanceScore ?? 0) - (a._relevanceScore ?? 0)
        );
    }
  }
  
  /**
   * Format memories as a flat list
   */
  private formatFlatMemories(
    memories: WorkingMemoryItem[], 
    options: MemoryFormattingOptions
  ): string {
    let result = "# Relevant Context\n\n";
    
    memories.forEach((memory, index) => {
      result += this.formatSingleMemory(memory, index + 1, options);
      result += "\n\n";
    });
    
    return result.trim();
  }
  
  /**
   * Format memories grouped by type
   */
  private formatGroupedMemories(
    memories: WorkingMemoryItem[], 
    options: MemoryFormattingOptions
  ): string {
    let result = "# Relevant Context\n\n";
    
    // Group memories by type
    const groupedMemories: Record<string, WorkingMemoryItem[]> = {};
    
    // Establish priority for memory types to control order
    const typePriorities: Record<string, number> = {
      'goal': 10,
      'fact': 8,
      'entity': 7,
      'preference': 9,
      'task': 6,
      'message': 5
    };
    
    // Group memories by type
    memories.forEach(memory => {
      const type = memory.type || 'unknown';
      if (!groupedMemories[type]) {
        groupedMemories[type] = [];
      }
      groupedMemories[type].push(memory);
    });
    
    // Sort types by priority
    const sortedTypes = Object.keys(groupedMemories).sort((a, b) => 
      (typePriorities[b] || 0) - (typePriorities[a] || 0)
    );
    
    // Format each group of memories
    sortedTypes.forEach(type => {
      // Apply readable type name with first letter capitalized
      const typeName = type.charAt(0).toUpperCase() + type.slice(1);
      result += `## ${typeName}s\n\n`;
      
      // Sort memories within each type
      const sortedMemories = this.sortMemories(groupedMemories[type], options.sortBy);
      
      // Format each memory in the group
      sortedMemories.forEach((memory, index) => {
        result += this.formatSingleMemory(memory, index + 1, options);
        result += "\n\n";
      });
    });
    
    return result.trim();
  }
  
  /**
   * Format a single memory item
   */
  private formatSingleMemory(
    memory: WorkingMemoryItem, 
    index: number, 
    options: MemoryFormattingOptions
  ): string {
    let result = "";
    
    // Format based on memory type
    switch (memory.type) {
      case 'fact':
        result += `### Fact ${index}\n`;
        result += memory.content;
        break;
        
      case 'entity':
        result += `### Entity ${index}\n`;
        result += memory.content;
        break;
        
      case 'preference':
        result += `### User Preference ${index}\n`;
        result += memory.content;
        break;
        
      case 'goal':
        result += `### Goal ${index}\n`;
        result += memory.content;
        break;
        
      case 'task':
        result += `### Task ${index}\n`;
        result += memory.content;
        break;
        
      case 'message':
        result += `### Previous Message ${index}\n`;
        
        // For messages, add content summary if available
        if (memory.metadata?.contentSummary) {
          result += `Summary: ${memory.metadata.contentSummary}\n\n`;
        }
        
        result += memory.content;
        break;
        
      default:
        result += `### Memory ${index}\n`;
        result += memory.content;
    }
    
    // Include importance information if requested
    if (options.includeImportance) {
      let importanceText = '';
      
      if (memory.metadata?.importance_score !== undefined) {
        const score = memory.metadata.importance_score;
        let importanceLevel = 'Low';
        
        if (score >= 0.9) importanceLevel = 'Critical';
        else if (score >= 0.6) importanceLevel = 'High';
        else if (score >= 0.3) importanceLevel = 'Medium';
        
        importanceText = `Importance: ${importanceLevel} (${(score * 100).toFixed(0)}%)`;
      }
      else if (memory.metadata?.importance) {
        importanceText = `Importance: ${memory.metadata.importance}`;
      }
      
      if (importanceText) {
        result += `\n\n${importanceText}`;
      }
    }
    
    // Add tags if present and if detailed descriptions are enabled
    if (options.includeDetailedDescriptions && memory.tags && memory.tags.length > 0) {
      result += `\nTags: ${memory.tags.join(', ')}`;
    }
    
    return result;
  }
  
  /**
   * Limit the token count of the formatted output (approximated)
   */
  private limitTokens(text: string, maxTokens: number): string {
    // Simple approximation: 1 token ≈ 4 characters for English text
    const approximateCharacterLimit = maxTokens * 4;
    
    if (text.length <= approximateCharacterLimit) {
      return text;
    }
    
    // Find the last complete memory entry before the limit
    // Look for memory headers
    const headerRegex = /^#+\s.*$/mg;
    let match;
    let lastHeaderPosition = 0;
    let lastValidPosition = 0;
    
    while ((match = headerRegex.exec(text)) !== null) {
      if (match.index < approximateCharacterLimit) {
        lastHeaderPosition = match.index;
        lastValidPosition = match.index;
      } else {
        break;
      }
    }
    
    // If we found a header, cut at the last header position
    if (lastValidPosition > 0) {
      return text.substring(0, lastValidPosition) + 
        "\n\n[Additional memories truncated due to token limit]";
    }
    
    // Fallback: just cut at the character limit
    return text.substring(0, approximateCharacterLimit) + "...";
  }
  
  /**
   * Format file references for context
   */
  formatFilesForContext(
    files: FileReference[], 
    options: { maxFiles?: number; maxContentLength?: number } = {}
  ): string {
    if (!files || files.length === 0) {
      return "";
    }
    
    const maxFiles = options.maxFiles || 5;
    const maxContentLength = options.maxContentLength || 1000;
    
    let result = "# Relevant Files\n\n";
    
    // Limit to max files
    const limitedFiles = files.slice(0, maxFiles);
    
    limitedFiles.forEach((file, index) => {
      result += `## File ${index + 1}: ${file.name || 'Untitled'}\n`;
      
      if (file.path) {
        result += `Path: ${file.path}\n`;
      }
      
      // Access content safely through metadata
      const fileContent = file.metadata?.content as string | undefined;
      
      if (fileContent) {
        result += "\n```\n";
        
        // Limit content length
        const content = fileContent.length > maxContentLength
          ? fileContent.substring(0, maxContentLength) + "...[truncated]"
          : fileContent;
        
        result += content;
        result += "\n```\n\n";
      } else {
        result += "\n[Content not available]\n\n";
      }
    });
    
    if (files.length > maxFiles) {
      result += `\n[${files.length - maxFiles} additional files omitted due to length constraints]\n`;
    }
    
    return result;
  }
} 