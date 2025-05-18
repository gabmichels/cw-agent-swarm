/**
 * Summary Generator Service
 * 
 * Generates summaries for processed files.
 */

import { ISummaryGenerator, ProcessedFile } from '../types';
import { AppError } from '../../../lib/errors/base';
import { ImportanceCalculatorService } from '../../../services/importance/ImportanceCalculatorService';
import { ImportanceCalculationMode } from '../../../services/importance/ImportanceCalculatorService';

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
   * Configuration options
   */
  private readonly config: SummaryGeneratorConfig;
  
  /**
   * Constructor
   * 
   * @param config Configuration options
   * @param importanceCalculator Importance calculator service
   */
  constructor(
    config: SummaryGeneratorConfig = {},
    private readonly importanceCalculator: ImportanceCalculatorService
  ) {
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
      const rankedSentences = await this.rankSentences(sentences);
      const importantSentences = rankedSentences.slice(0, 5);
      
      // Assemble the summary
      let summary = importantSentences.join(' ');
      
      // Add metadata if configured
      if (this.config.includeMetadata && file.metadata) {
        summary += `\n\nFile: ${file.metadata.filename}`;
        if (file.metadata.size) {
          summary += ` (${this.formatFileSize(file.metadata.size)})`;
        }
      }
      
      return summary;
    } catch (error) {
      throw new AppError(
        `Summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
        SummaryGeneratorErrorCode.GENERATION_FAILED,
        { filename: file.metadata?.filename }
      );
    }
  }
  
  /**
   * Calculate importance score for a sentence
   * 
   * @param sentence The sentence text
   * @param position Position in the text
   * @param totalSentences Total number of sentences
   * @returns Importance score
   */
  private async calculateSentenceScore(sentence: string, position: number, totalSentences: number): Promise<number> {
    // Position score - sentences at the beginning are usually more important
    const positionScore = (totalSentences - Math.min(position, totalSentences)) / totalSentences;
    
    // Calculate importance using the service
    const result = await this.importanceCalculator.calculateImportance({
      content: sentence,
      contentType: 'sentence',
      source: 'document',
      tags: ['summary_generation'],
      existingScore: positionScore * 0.5 // Use position as initial score
    }, ImportanceCalculationMode.RULE_BASED);

    return result.importance_score;
  }
  
  /**
   * Rank sentences by importance
   * 
   * @param sentences Array of sentences
   * @returns Array of sentences ranked by importance
   */
  private async rankSentences(sentences: string[]): Promise<string[]> {
    // Calculate importance scores for each sentence
    const scoredSentences = await Promise.all(
      sentences.map(async (sentence, index) => ({
        sentence,
        score: await this.calculateSentenceScore(sentence, index, sentences.length)
      }))
    );
    
    // Sort by score in descending order
    return scoredSentences
      .sort((a, b) => b.score - a.score)
      .map(s => s.sentence);
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
  private readonly config: SummaryGeneratorConfig;
  
  /**
   * Basic summary generator as fallback
   */
  private readonly basicGenerator: BasicSummaryGenerator;
  
  /**
   * Constructor
   * 
   * @param importanceCalculator Importance calculator service
   * @param config Configuration options
   */
  constructor(
    private readonly importanceCalculator: ImportanceCalculatorService,
    config: SummaryGeneratorConfig = {}
  ) {
    this.config = {
      maxLength: config.maxLength || 1000,
      model: config.model || 'default',
      includeMetadata: config.includeMetadata !== undefined ? config.includeMetadata : true,
      maxChunks: config.maxChunks || 10
    };
    
    this.basicGenerator = new BasicSummaryGenerator(config, importanceCalculator);
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