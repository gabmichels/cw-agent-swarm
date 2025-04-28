import { KnowledgeLoader } from './knowledgeLoader';
import { KnowledgeEmbedder } from './knowledgeEmbedder';

/**
 * Example of using the knowledge embedding system
 */
export async function exampleKnowledgeUsage(): Promise<void> {
  try {
    // Step 1: Initialize the knowledge loader
    console.log('Initializing knowledge loader...');
    const knowledgeLoader = new KnowledgeLoader();
    await knowledgeLoader.loadAllKnowledge();
    console.log('Knowledge loaded successfully!');
    
    // Step 2: Initialize the knowledge embedder
    const knowledgeEmbedder = new KnowledgeEmbedder(knowledgeLoader);
    
    // Example 1: Manual knowledge embedding
    console.log('\nExample 1: Manual knowledge embedding');
    const request1 = "Create a marketing campaign for our new product";
    const enhanced1 = await knowledgeEmbedder.embedKnowledge(request1, {
      includeCompany: true,
      includeDomains: ['marketing'],
      includeAgent: 'chloe',
      maxTokens: 4000
    });
    
    console.log('Original request:', request1);
    console.log('Enhanced request (first 200 chars):', enhanced1.substring(0, 200) + '...');
    
    // Example 2: Automatic knowledge embedding based on agent
    console.log('\nExample 2: Automatic knowledge embedding');
    const request2 = "Analyze our Q2 marketing performance";
    
    // For Chloe (marketing agent)
    const chloeEnhanced = await knowledgeEmbedder.embedKnowledgeForAgent('chloe', request2);
    console.log('Chloe enhanced request (first 200 chars):', chloeEnhanced.substring(0, 200) + '...');
    
    // For Lance (sales agent)
    const lanceEnhanced = await knowledgeEmbedder.embedKnowledgeForAgent('lance', request2);
    console.log('Lance enhanced request (first 200 chars):', lanceEnhanced.substring(0, 200) + '...');
    
    // Note the differences between the two - Chloe will have marketing knowledge, Lance will have sales knowledge
    
  } catch (error) {
    console.error('Error using knowledge embedding:', error);
  }
}

/**
 * How to use in an agent
 */
export async function agentRequestExample(agentId: string, userRequest: string): Promise<string> {
  // Step 1: Initialize knowledge system (do this once, not per request)
  const knowledgeLoader = new KnowledgeLoader();
  await knowledgeLoader.loadAllKnowledge();
  const knowledgeEmbedder = new KnowledgeEmbedder(knowledgeLoader);
  
  // Step 2: Enhance the user request with relevant knowledge
  const enhancedRequest = await knowledgeEmbedder.embedKnowledgeForAgent(agentId, userRequest);
  
  // Step 3: Process the enhanced request through your AI model
  // const response = await yourAIModel.process(enhancedRequest);
  
  // Step 4: Return the AI response
  return `AI response to: ${enhancedRequest.substring(0, 50)}...`;
} 