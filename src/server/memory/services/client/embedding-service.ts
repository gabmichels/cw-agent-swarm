/**
 * Service for generating text embeddings
 */
import { OpenAI } from 'openai';
import { DEFAULTS, MemoryErrorCode } from '../../config';
import { handleMemoryError } from '../../utils';

/**
 * Options for embedding service
 */
export interface EmbeddingServiceOptions {
  // OpenAI options
  openAIApiKey?: string;
  embeddingModel?: string;
  
  // Fallback options
  useRandomFallback?: boolean;
  dimensions?: number;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  embedding: number[];
  model?: string;
  usedFallback?: boolean;
}

/**
 * Service for generating text embeddings
 */
export class EmbeddingService {
  private openai: OpenAI | null = null;
  private embeddingModel: string;
  private dimensions: number;
  private useRandomFallback: boolean;
  
  /**
   * Create a new embedding service
   */
  constructor(options?: EmbeddingServiceOptions) {
    this.embeddingModel = options?.embeddingModel || 
      process.env.OPENAI_EMBEDDING_MODEL || 
      DEFAULTS.EMBEDDING_MODEL;
    
    this.dimensions = options?.dimensions || DEFAULTS.DIMENSIONS;
    this.useRandomFallback = options?.useRandomFallback ?? true;
    
    // Initialize OpenAI if API key is provided
    const openAIApiKey = options?.openAIApiKey || process.env.OPENAI_API_KEY;
    
    if (openAIApiKey) {
      try {
        this.openai = new OpenAI({
          apiKey: openAIApiKey
        });
        console.log(`Initialized embedding service with model: ${this.embeddingModel}`);
      } catch (error) {
        console.error('Error initializing OpenAI client:', error);
        this.openai = null;
      }
    } else {
      console.warn('No OpenAI API key provided, using random fallback embeddings');
      this.openai = null;
    }
  }
  
  /**
   * Generate an embedding for the given text
   */
  async getEmbedding(text: string): Promise<EmbeddingResult> {
    try {
      // Check if text is empty or too short
      if (!text || text.trim().length === 0) {
        return this.getRandomEmbedding('Empty text provided');
      }
      
      // If OpenAI isn't initialized, use fallback
      if (!this.openai) {
        return this.getRandomEmbedding('OpenAI not initialized');
      }
      
      // Generate embeddings using OpenAI
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
        encoding_format: 'float'
      });
      
      const embedding = response.data[0].embedding;
      
      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        return this.getRandomEmbedding('Invalid embedding received from API');
      }
      
      // Update dimensions if needed
      if (embedding.length !== this.dimensions) {
        console.log(`Updating embedding dimensions from ${this.dimensions} to ${embedding.length}`);
        this.dimensions = embedding.length;
      }
      
      // Normalize vector
      const normalizedEmbedding = this.normalizeVector(embedding);
      
      return {
        embedding: normalizedEmbedding,
        model: this.embeddingModel
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      
      // Use fallback if enabled
      if (this.useRandomFallback) {
        return this.getRandomEmbedding(`API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Otherwise, throw error
      throw handleMemoryError(error, 'getEmbedding');
    }
  }
  
  /**
   * Generate batch embeddings for multiple texts
   */
  async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    try {
      // If OpenAI isn't initialized or batch is empty, use fallback
      if (!this.openai || texts.length === 0) {
        return texts.map(() => this.getRandomEmbedding('Batch fallback'));
      }
      
      // Generate embeddings using OpenAI
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: texts,
        encoding_format: 'float'
      });
      
      // Process and validate results
      return response.data.map(item => {
        const embedding = item.embedding;
        
        // Validate embedding
        if (!Array.isArray(embedding) || embedding.length === 0) {
          return this.getRandomEmbedding('Invalid embedding in batch response');
        }
        
        // Normalize vector
        const normalizedEmbedding = this.normalizeVector(embedding);
        
        return {
          embedding: normalizedEmbedding,
          model: this.embeddingModel
        };
      });
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      
      // Use fallback if enabled
      if (this.useRandomFallback) {
        return texts.map(() => this.getRandomEmbedding('Batch API error'));
      }
      
      // Otherwise, throw error
      throw handleMemoryError(error, 'getBatchEmbeddings');
    }
  }
  
  /**
   * Generate a random embedding (fallback)
   */
  private getRandomEmbedding(reason: string): EmbeddingResult {
    console.warn(`Using random embedding fallback: ${reason}`);
    
    // Generate random vector
    const randomVector = Array.from(
      { length: this.dimensions },
      () => (Math.random() * 2) - 1
    );
    
    // Normalize to unit length
    const normalizedVector = this.normalizeVector(randomVector);
    
    return {
      embedding: normalizedVector,
      usedFallback: true
    };
  }
  
  /**
   * Normalize a vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    try {
      // Calculate magnitude
      const squaredSum = vector.reduce((sum, val) => sum + val * val, 0);
      const magnitude = Math.sqrt(squaredSum);
      
      // Avoid division by zero
      if (magnitude === 0 || !isFinite(magnitude)) {
        console.warn('Vector has zero magnitude, returning random unit vector');
        return Array.from(
          { length: this.dimensions },
          () => (Math.random() * 2 - 1) / Math.sqrt(this.dimensions)
        );
      }
      
      // Normalize each component
      return vector.map(val => {
        const normalized = val / magnitude;
        
        // Handle any NaN or Infinity values
        if (!isFinite(normalized)) {
          return (Math.random() * 2 - 1) / Math.sqrt(this.dimensions);
        }
        
        return normalized;
      });
    } catch (error) {
      console.error('Error normalizing vector:', error);
      
      // Return fallback random unit vector
      return Array.from(
        { length: this.dimensions },
        () => (Math.random() * 2 - 1) / Math.sqrt(this.dimensions)
      );
    }
  }
} 