import { DefaultKnowledgeGraph } from '../../agents/shared/knowledge/DefaultKnowledgeGraph';

/**
 * Singleton instance of the knowledge graph
 */
class KnowledgeGraphSingleton {
  private static instance: DefaultKnowledgeGraph | null = null;
  private static initialized: boolean = false;

  /**
   * Get or create the singleton knowledge graph instance
   */
  static async getInstance(): Promise<DefaultKnowledgeGraph> {
    if (!KnowledgeGraphSingleton.instance) {
      console.log('🔧 Creating new knowledge graph singleton instance...');
      
      // Create the knowledge graph with in-memory storage for now
      KnowledgeGraphSingleton.instance = new DefaultKnowledgeGraph({ 
        useQdrant: false 
      });
    }

    if (!KnowledgeGraphSingleton.initialized) {
      console.log('🔧 Initializing knowledge graph singleton...');
      await KnowledgeGraphSingleton.instance.initialize();
      KnowledgeGraphSingleton.initialized = true;
    }

    return KnowledgeGraphSingleton.instance;
  }

  /**
   * Reset the singleton (for testing or rebuilding)
   */
  static reset(): void {
    console.log('🔄 Resetting knowledge graph singleton...');
    KnowledgeGraphSingleton.instance = null;
    KnowledgeGraphSingleton.initialized = false;
  }

  /**
   * Check if the singleton is initialized
   */
  static isInitialized(): boolean {
    return KnowledgeGraphSingleton.initialized && KnowledgeGraphSingleton.instance !== null;
  }
}

export default KnowledgeGraphSingleton; 