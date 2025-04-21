import { OpenAIEmbeddings } from '@langchain/openai';

// Default embedding model
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

// Create OpenAI embeddings
export function createEmbeddings(
  apiKey = process.env.OPENAI_API_KEY,
  model = DEFAULT_EMBEDDING_MODEL
) {
  return new OpenAIEmbeddings({
    modelName: model,
    openAIApiKey: apiKey,
  });
}

// Create a text embedding directly
export async function embedText(
  text: string, 
  embeddings?: OpenAIEmbeddings
) {
  const embeddingModel = embeddings || createEmbeddings();
  try {
    const result = await embeddingModel.embedQuery(text);
    return { success: true, embedding: result };
  } catch (error) {
    console.error('Error creating embedding:', error);
    return { success: false, error: error.message };
  }
}

// Create batch embeddings for multiple texts
export async function embedTexts(
  texts: string[],
  embeddings?: OpenAIEmbeddings
) {
  const embeddingModel = embeddings || createEmbeddings();
  try {
    const results = await embeddingModel.embedDocuments(texts);
    return { success: true, embeddings: results };
  } catch (error) {
    console.error('Error creating batch embeddings:', error);
    return { success: false, error: error.message };
  }
} 