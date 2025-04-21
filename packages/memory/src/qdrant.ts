import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { Document } from '@langchain/core/documents';

interface QdrantOptions {
  url: string;
  apiKey?: string;
  collectionName: string;
  embeddingModel?: string;
}

// Create a Qdrant vector store instance
export async function createQdrantVectorStore({
  url = process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey = process.env.QDRANT_API_KEY,
  collectionName = 'chloe_memory',
  embeddingModel = 'text-embedding-3-small',
}: QdrantOptions) {
  const client = new QdrantClient({
    url,
    apiKey,
  });

  const embeddings = new OpenAIEmbeddings({
    modelName: embeddingModel,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Check if collection exists, create if not
    const collections = await client.getCollections();
    const collectionExists = collections.collections.some(
      (collection) => collection.name === collectionName
    );

    if (!collectionExists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: 1536, // Default size for OpenAI embeddings
          distance: 'Cosine',
        },
      });
    }

    // Return the vector store
    return new QdrantVectorStore(embeddings, {
      client,
      collectionName,
    });
  } catch (error) {
    console.error('Error initializing Qdrant vector store:', error);
    throw error;
  }
}

// Helper to add documents to the vector store
export async function addDocumentsToVectorStore(
  vectorStore: QdrantVectorStore,
  documents: Document[]
) {
  try {
    await vectorStore.addDocuments(documents);
    return { success: true, count: documents.length };
  } catch (error) {
    console.error('Error adding documents to vector store:', error);
    return { success: false, error: error.message };
  }
}

// Helper to search the vector store
export async function searchVectorStore(
  vectorStore: QdrantVectorStore,
  query: string,
  k: number = 5
) {
  try {
    const results = await vectorStore.similaritySearch(query, k);
    return { success: true, results };
  } catch (error) {
    console.error('Error searching vector store:', error);
    return { success: false, error: error.message };
  }
} 