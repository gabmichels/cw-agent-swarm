import { FileReference } from '../types';
import { ExtractedEntity } from '../memory/EntityExtractor';
import { FileMetadata } from '../../../types/metadata';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Scoring factors for file relevance
 */
export interface RelevanceFactors {
  semanticSimilarity: number;
  keywordMatch: number;
  recency: number;
  entityOverlap: number;
  fileType: number;
  fileSize: number;
  accessFrequency: number;
  userFeedback: number;
}

/**
 * Options for file relevance scoring
 */
export interface ScoringOptions {
  query: string;
  queryEntities?: ExtractedEntity[];
  weights?: Partial<Record<keyof RelevanceFactors, number>>;
  minScore?: number;
  considerFileType?: boolean;
  considerRecency?: boolean;
  considerUserFeedback?: boolean;
  useSemanticScoring?: boolean;
}

/**
 * Service for scoring file relevance using multiple factors
 */
export class FileRelevanceScorer {
  private llm: ChatOpenAI;
  
  // Default weights for scoring factors
  private defaultWeights: Record<keyof RelevanceFactors, number> = {
    semanticSimilarity: 0.3,
    keywordMatch: 0.2,
    recency: 0.1,
    entityOverlap: 0.15,
    fileType: 0.05,
    fileSize: 0.05,
    accessFrequency: 0.1,
    userFeedback: 0.05
  };
  
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.2
    });
  }
  
  /**
   * Score file relevance using multiple factors
   */
  async scoreFileRelevance(
    file: FileReference,
    options: ScoringOptions
  ): Promise<{
    score: number;
    factors: RelevanceFactors;
  }> {
    try {
      const weights = {
        ...this.defaultWeights,
        ...options.weights
      };
      
      // Calculate individual factors
      const semanticSimilarity = options.useSemanticScoring
        ? await this.calculateSemanticSimilarity(file, options.query)
        : 0;
        
      const keywordMatch = this.calculateKeywordMatch(file, options.query);
      
      const recency = options.considerRecency
        ? this.calculateRecency(file)
        : 0;
        
      const entityOverlap = options.queryEntities
        ? await this.calculateEntityOverlap(file, options.queryEntities)
        : 0;
        
      const fileType = options.considerFileType
        ? this.calculateFileTypeRelevance(file, options.query)
        : 0;
        
      const fileSize = this.calculateFileSizeScore(file);
      
      const accessFrequency = this.calculateAccessFrequency(file);
      
      const userFeedback = options.considerUserFeedback
        ? this.calculateUserFeedback(file)
        : 0;
      
      // Combine factors with weights
      const factors: RelevanceFactors = {
        semanticSimilarity,
        keywordMatch,
        recency,
        entityOverlap,
        fileType,
        fileSize,
        accessFrequency,
        userFeedback
      };
      
      // Calculate final score
      const score = Object.entries(factors).reduce(
        (total, [factor, value]) => total + value * weights[factor as keyof RelevanceFactors],
        0
      );
      
      return { score, factors };
      
    } catch (error) {
      console.error('Error scoring file relevance:', error);
      return {
        score: 0,
        factors: {
          semanticSimilarity: 0,
          keywordMatch: 0,
          recency: 0,
          entityOverlap: 0,
          fileType: 0,
          fileSize: 0,
          accessFrequency: 0,
          userFeedback: 0
        }
      };
    }
  }
  
  /**
   * Calculate semantic similarity using LLM
   */
  private async calculateSemanticSimilarity(
    file: FileReference,
    query: string
  ): Promise<number> {
    try {
      const systemPrompt = `You are an AI assistant that evaluates the semantic similarity between a search query and a file.
Your task is to rate how relevant the file is to the query on a scale from 0.0 to 1.0.

Consider:
- How well the file content matches the query intent
- Whether the file would help answer the query
- The overall relevance of the file

Respond with ONLY a number between 0.0 and 1.0.`;

      const metadata = file.metadata as unknown as FileMetadata;
      const fileDescription = `File: ${file.name}
Type: ${file.type}
Content: ${Array.isArray(metadata?.contentSnippets) ? metadata.contentSnippets.join('\n') : 'No content available'}
Tags: ${Array.isArray(metadata?.tags) ? metadata.tags.join(', ') : 'No tags'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Query: "${query}"\n\n${fileDescription}`)
      ];
      
      // @ts-ignore - LangChain types may not be up to date
      const response = await this.llm.call(messages);
      const score = parseFloat(response.content);
      
      return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
      
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      return 0;
    }
  }
  
  /**
   * Calculate keyword match score
   */
  private calculateKeywordMatch(file: FileReference, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    let matches = 0;
    
    // Check filename
    const filename = file.name.toLowerCase();
    matches += queryTerms.filter(term => filename.includes(term)).length;
    
    // Check content snippets
    const metadata = file.metadata as unknown as FileMetadata;
    if (Array.isArray(metadata?.contentSnippets)) {
      const content = metadata.contentSnippets.join(' ').toLowerCase();
      matches += queryTerms.filter(term => content.includes(term)).length;
    }
    
    // Check tags
    if (Array.isArray(metadata?.tags)) {
      const tagContent = metadata.tags.join(' ').toLowerCase();
      matches += queryTerms.filter(term => tagContent.includes(term)).length;
    }
    
    // Normalize score
    return Math.min(1, matches / (queryTerms.length * 2));
  }
  
  /**
   * Calculate recency score
   */
  private calculateRecency(file: FileReference): number {
    const now = new Date().getTime();
    const metadata = file.metadata as unknown as FileMetadata;
    const createdAt = metadata?.createdAt;
    
    let fileDate: number;
    if (typeof createdAt === 'string' || typeof createdAt === 'number' || createdAt instanceof Date) {
      fileDate = new Date(createdAt).getTime();
    } else {
      fileDate = now; // Use current time if no valid date
    }
    
    const age = now - fileDate;
    
    // Score decreases with age, with a half-life of 30 days
    const halfLife = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    return Math.exp(-Math.log(2) * age / halfLife);
  }
  
  /**
   * Calculate entity overlap score
   */
  private async calculateEntityOverlap(
    file: FileReference,
    queryEntities: ExtractedEntity[]
  ): Promise<number> {
    const metadata = file.metadata as unknown as FileMetadata;
    if (!Array.isArray(metadata?.contentSnippets) || queryEntities.length === 0) {
      return 0;
    }
    
    // Extract entities from file content
    const fileContent = metadata.contentSnippets.join('\n');
    const fileEntities = queryEntities.filter(entity => 
      fileContent.toLowerCase().includes(entity.value.toLowerCase())
    );
    
    return fileEntities.length / queryEntities.length;
  }
  
  /**
   * Calculate file type relevance
   */
  private calculateFileTypeRelevance(file: FileReference, query: string): number {
    // Map of query keywords to relevant file types
    const fileTypeRelevance: Record<string, string[]> = {
      'document': ['pdf', 'doc', 'docx', 'txt'],
      'spreadsheet': ['xls', 'xlsx', 'csv'],
      'presentation': ['ppt', 'pptx'],
      'image': ['jpg', 'jpeg', 'png', 'gif'],
      'code': ['js', 'ts', 'py', 'java', 'cpp'],
      'data': ['json', 'xml', 'yaml', 'csv']
    };
    
    // Check if query mentions any file type keywords
    const queryLower = query.toLowerCase();
    for (const [keyword, types] of Object.entries(fileTypeRelevance)) {
      if (queryLower.includes(keyword)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        return fileExt && types.includes(fileExt) ? 1 : 0;
      }
    }
    
    return 0.5; // Neutral score if no specific file type is mentioned
  }
  
  /**
   * Calculate file size score
   * Prefers medium-sized files over very small or very large ones
   */
  private calculateFileSizeScore(file: FileReference): number {
    const metadata = file.metadata as unknown as FileMetadata;
    const size = typeof metadata?.fileSize === 'number' ? metadata.fileSize : 0;
    
    // Size ranges in bytes
    const tooSmall = 100; // 100B
    const idealMin = 1000; // 1KB
    const idealMax = 1000000; // 1MB
    const tooLarge = 10000000; // 10MB
    
    if (size < tooSmall) {
      return 0.3; // Probably too small to be useful
    } else if (size > tooLarge) {
      return 0.5; // Large files might be less relevant
    } else if (size >= idealMin && size <= idealMax) {
      return 1.0; // Ideal size range
    } else {
      // Linear interpolation for sizes between ranges
      if (size < idealMin) {
        return 0.3 + 0.7 * (size - tooSmall) / (idealMin - tooSmall);
      } else {
        return 1.0 - 0.5 * (size - idealMax) / (tooLarge - idealMax);
      }
    }
  }
  
  /**
   * Calculate access frequency score
   */
  private calculateAccessFrequency(file: FileReference): number {
    const metadata = file.metadata as unknown as FileMetadata;
    const accessCount = typeof metadata?.accessCount === 'number' ? metadata.accessCount : 0;
    // Score increases with access count but has diminishing returns
    return 1 - Math.exp(-accessCount / 10);
  }
  
  /**
   * Calculate user feedback score
   */
  private calculateUserFeedback(file: FileReference): number {
    const metadata = file.metadata as unknown as FileMetadata;
    const feedback = metadata?.userFeedback;
    if (!feedback || typeof feedback !== 'object') return 0.5; // Neutral score if no feedback
    
    // Normalize feedback to 0-1 range
    const upvotes = typeof feedback.upvotes === 'number' ? feedback.upvotes : 0;
    const downvotes = typeof feedback.downvotes === 'number' ? feedback.downvotes : 0;
    
    if (upvotes + downvotes === 0) return 0.5;
    
    return upvotes / (upvotes + downvotes);
  }
} 