/**
 * Mock Embedding Service for testing
 */
import { EmbeddingService, EmbeddingResult, EmbeddingServiceOptions } from '../../services/client/embedding-service';

/**
 * Mock implementation of the Embedding Service that extends the real EmbeddingService
 * to ensure type compatibility while providing deterministic embeddings for testing
 */
export class MockEmbeddingService extends EmbeddingService {
  private defaultDimension: number = 1536;
  private defaultEmbedding: number[] = Array(this.defaultDimension).fill(0.1);
  
  /**
   * Creates a new mock embedding service
   */
  constructor(options?: { dimensions?: number }) {
    // Initialize parent class with empty options
    super({
      dimensions: options?.dimensions || 1536,
      useRandomFallback: true
    });
    
    if (options?.dimensions) {
      this.defaultDimension = options.dimensions;
      this.defaultEmbedding = Array(this.defaultDimension).fill(0.1);
    }
  }
  
  /**
   * Generate a deterministic embedding for a text input
   * 
   * This uses a simple hash function to create repeatable embeddings
   * based on the input string, which is useful for testing.
   */
  private generateDeterministicEmbedding(text: string): number[] {
    if (!text) {
      return this.defaultEmbedding;
    }
    
    // Generate a simple hash from the text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use the hash to seed a simple random-like sequence
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    
    // Generate embedding values using seeded random function
    const embedding = new Array(this.defaultDimension);
    for (let i = 0; i < this.defaultDimension; i++) {
      embedding[i] = seededRandom(hash + i);
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }
  
  /**
   * Override parent getEmbedding with deterministic implementation
   */
  async getEmbedding(text: string): Promise<EmbeddingResult> {
    const embedding = this.generateDeterministicEmbedding(text);
    
    return {
      embedding,
      model: 'mock-embedding-model',
      usedFallback: false
    };
  }
  
  /**
   * Get embeddings for multiple texts
   */
  async getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (const text of texts) {
      results.push(await this.getEmbedding(text));
    }
    
    return results;
  }
} 