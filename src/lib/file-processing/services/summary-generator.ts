/**
 * Summary Generator Service
 * 
 * Generates summaries for processed files.
 */

import { ISummaryGenerator, ProcessedFile } from '../types';
import { AppError } from '../../../lib/errors/base';

/**
 * Error codes for summary generation operations
 */
export enum SummaryGeneratorErrorCode {
  INVALID_INPUT = 'SUMMARY_GENERATOR_INVALID_INPUT',
  GENERATION_FAILED = 'SUMMARY_GENERATOR_GENERATION_FAILED',
  MODEL_NOT_AVAILABLE = 'SUMMARY_GENERATOR_MODEL_NOT_AVAILABLE',
  API_ERROR = 'SUMMARY_GENERATOR_API_ERROR',
}

/**
 * Configuration for the summary generator
 */
export interface SummaryGeneratorConfig {
  /**
   * Maximum length of the summary in characters
   */
  maxLength?: number;
  
  /**
   * Model to use for summarization
   */
  model?: string;
  
  /**
   * Whether to include metadata in the summary
   */
  includeMetadata?: boolean;
  
  /**
   * Maximum number of chunks to include in the summary input
   */
  maxChunks?: number;
}

/**
 * Basic implementation of the ISummaryGenerator interface using rules-based summarization
 */
export class BasicSummaryGenerator implements ISummaryGenerator {
  /**
   * Configuration for the summary generator
   */
  private config: SummaryGeneratorConfig;
  
  /**
   * Constructor
   * 
   * @param config Configuration options
   */
  constructor(config: SummaryGeneratorConfig = {}) {
    this.config = {
      maxLength: config.maxLength || 500,
      includeMetadata: config.includeMetadata !== undefined ? config.includeMetadata : true,
      maxChunks: config.maxChunks || 10
    };
  }
  
  /**
   * Generate a summary of the file
   * 
   * @param file The processed file
   * @returns A summary of the file
   * @throws AppError if summarization fails
   */
  async generateSummary(file: ProcessedFile): Promise<string> {
    // Validate input
    if (!file || !file.fullText) {
      throw new AppError(
        'Invalid file input for summary generation',
        SummaryGeneratorErrorCode.INVALID_INPUT,
        { provided: file ? 'ProcessedFile with empty text' : 'null' }
      );
    }
    
    try {
      // Get a sample of the text for summarization
      let textToSummarize = '';
      
      // Determine whether to use chunks or full text
      if (file.chunks && file.chunks.length > 0) {
        // Take up to maxChunks chunks for summary
        const chunksToUse = file.chunks.slice(0, this.config.maxChunks);
        textToSummarize = chunksToUse.map(chunk => chunk.text).join(' ');
      } else {
        // Use full text, but limit to first 5000 characters
        textToSummarize = file.fullText.substring(0, 5000);
      }
      
      // Rule-based summarization approach
      const sentences = this.extractSentences(textToSummarize);
      const importantSentences = this.rankSentences(sentences).slice(0, 5);
      
      // Assemble the summary
      let summary = importantSentences.join(' ');
      
      // Add metadata if requested
      if (this.config.includeMetadata) {
        const { filename, documentType, language, size } = file.metadata;
        const metadataSummary = `${filename || 'Unnamed file'}${documentType ? ` (${documentType})` : ''}, ${this.formatFileSize(size || 0)}${language ? `, in ${language}` : ''}.`;
        summary = `${metadataSummary} ${summary}`;
      }
      
      // Truncate to max length if needed
      const maxLength = this.config.maxLength || 500;
      if (summary.length > maxLength) {
        summary = summary.substring(0, maxLength - 3) + '...';
      }
      
      return summary;
    } catch (error) {
      throw new AppError(
        `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
        SummaryGeneratorErrorCode.GENERATION_FAILED,
        { filename: file.metadata.filename }
      );
    }
  }
  
  /**
   * Extract sentences from text
   * 
   * @param text Text to extract sentences from
   * @returns Array of sentences
   */
  private extractSentences(text: string): string[] {
    // Simplified sentence extraction with basic period/question mark/exclamation detection
    const sentenceDelimiters = /[.!?]+/g;
    const sentences = text.split(sentenceDelimiters)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short segments
    
    return sentences;
  }
  
  /**
   * Rank sentences by importance
   * 
   * @param sentences Array of sentences
   * @returns Array of sentences ranked by importance
   */
  private rankSentences(sentences: string[]): string[] {
    // Simple ranking algorithm based on sentence length and position
    const rankedSentences = sentences.map((sentence, index) => ({
      text: sentence,
      score: this.calculateSentenceScore(sentence, index, sentences.length)
    }));
    
    // Sort by score (highest first)
    rankedSentences.sort((a, b) => b.score - a.score);
    
    // Return just the text
    return rankedSentences.map(s => s.text);
  }
  
  /**
   * Calculate importance score for a sentence
   * 
   * @param sentence The sentence text
   * @param position Position in the text
   * @param totalSentences Total number of sentences
   * @returns Importance score
   */
  private calculateSentenceScore(sentence: string, position: number, totalSentences: number): number {
    let score = 0;
    
    // Position score - sentences at the beginning are usually more important
    const positionScore = (totalSentences - position) / totalSentences;
    score += positionScore * 2;
    
    // Length score - moderate length sentences are usually more informative
    const words = sentence.split(/\s+/).length;
    const lengthScore = words > 5 && words < 25 ? 1 : 0;
    score += lengthScore;
    
    // Keyword score - sentences with key terms are more important
    const keywordScore = this.countKeywords(sentence);
    score += keywordScore;
    
    return score;
  }
  
  /**
   * Count important keywords in a sentence
   * 
   * @param sentence The sentence text
   * @returns Number of keywords found
   */
  private countKeywords(sentence: string): number {
    const keywords = [
      'important', 'significant', 'key', 'main', 'primary', 'essential',
      'critical', 'crucial', 'fundamental', 'major', 'conclusion',
      'result', 'finding', 'discovered', 'shows', 'demonstrates'
    ];
    
    let count = 0;
    for (const keyword of keywords) {
      if (sentence.toLowerCase().includes(keyword)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Format file size in human-readable format
   * 
   * @param bytes File size in bytes
   * @returns Formatted file size
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

/**
 * Advanced summary generator that can use AI models for better summaries
 */
export class AdvancedSummaryGenerator implements ISummaryGenerator {
  /**
   * Configuration for the summary generator
   */
  private config: SummaryGeneratorConfig;
  
  /**
   * Basic summary generator as fallback
   */
  private basicGenerator: BasicSummaryGenerator;
  
  /**
   * Constructor
   * 
   * @param config Configuration options
   */
  constructor(config: SummaryGeneratorConfig = {}) {
    this.config = {
      maxLength: config.maxLength || 1000,
      model: config.model || 'default',
      includeMetadata: config.includeMetadata !== undefined ? config.includeMetadata : true,
      maxChunks: config.maxChunks || 10
    };
    
    this.basicGenerator = new BasicSummaryGenerator(config);
  }
  
  /**
   * Generate a summary of the file using advanced techniques
   * 
   * @param file The processed file
   * @returns A summary of the file
   */
  async generateSummary(file: ProcessedFile): Promise<string> {
    try {
      // Feature flag check for AI summary generation
      const useAiSummary = this.config.model !== 'basic';
      
      if (useAiSummary) {
        // Try to generate an AI summary
        try {
          return await this.generateAiSummary(file);
        } catch (error) {
          // If AI summary fails, fall back to basic summary
          console.warn('AI summary generation failed, falling back to basic summary', error);
          return await this.basicGenerator.generateSummary(file);
        }
      } else {
        // Use basic summary generator
        return await this.basicGenerator.generateSummary(file);
      }
    } catch (error) {
      throw new AppError(
        `Advanced summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
        SummaryGeneratorErrorCode.GENERATION_FAILED,
        { filename: file.metadata.filename }
      );
    }
  }
  
  /**
   * Generate a summary using AI models
   * 
   * @param file The processed file
   * @returns AI-generated summary
   */
  private async generateAiSummary(file: ProcessedFile): Promise<string> {
    // This is a placeholder for AI summarization
    // In a real implementation, this would call an AI service
    
    // For now, use the basic generator but add a note
    const basicSummary = await this.basicGenerator.generateSummary(file);
    
    // In a real implementation, this would be replaced with actual AI summarization
    // using the specified model in this.config.model
    
    return `${basicSummary} (This summary would be generated using the ${this.config.model} model in a production environment.)`;
  }
} 