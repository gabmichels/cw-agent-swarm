/**
 * Test script for Knowledge Graph Pipeline
 * Demonstrates Milestone 4.1 features:
 * - Knowledge addition pipeline
 * - Relationship suggestion between concepts
 * - Quality scoring for knowledge items
 */

import { 
  KnowledgeGraph, 
  KnowledgeFlaggingService,
  KnowledgeGraphService
} from '../lib/knowledge';
import { logger } from '../lib/logging';

async function testKnowledgePipeline() {
  try {
    logger.info('Starting Knowledge Pipeline Test');
    
    // Initialize services
    const knowledgeGraph = new KnowledgeGraph('marketing');
    const flaggingService = new KnowledgeFlaggingService(knowledgeGraph);
    const graphService = new KnowledgeGraphService(knowledgeGraph);
    
    // Load existing flagged items
    await flaggingService.load();
    
    // 1. Create test knowledge items
    logger.info('Creating test knowledge items');
    
    // Flag a concept
    const conceptResult = await flaggingService.flagManually(
      'Content Marketing Strategy',
      'A comprehensive approach to creating and distributing valuable content to attract and engage a target audience.',
      'concept',
      'digital-marketing',
      {
        type: 'concept',
        name: 'Content Marketing Strategy',
        description: 'A comprehensive approach to creating and distributing valuable content to attract and engage a target audience, ultimately driving profitable customer action.'
      }
    );
    
    if (conceptResult.success) {
      logger.info(`Created concept with ID: ${conceptResult.itemId}`);
    }
    
    // Flag a principle
    const principleResult = await flaggingService.flagManually(
      'Audience-First Principle',
      'Content should be created based on audience needs rather than brand objectives.',
      'principle',
      'content-marketing',
      {
        type: 'principle',
        name: 'Audience-First Principle',
        description: 'Content should be created based on audience needs and interests rather than solely on brand objectives.',
        examples: [
          'Creating educational blog posts based on common customer questions',
          'Developing how-to guides for solving customer pain points'
        ],
        applications: [
          'Content planning and ideation',
          'Editorial calendar development',
          'Content effectiveness measurement'
        ],
        importance: 9
      }
    );
    
    if (principleResult.success) {
      logger.info(`Created principle with ID: ${principleResult.itemId}`);
    }
    
    // Flag a relationship
    const relationshipResult = await flaggingService.flagManually(
      'Content Marketing Strategy implements Audience-First Principle',
      'The content marketing strategy implements the audience-first principle by prioritizing audience needs in content creation.',
      'relationship',
      'digital-marketing',
      {
        type: 'relationship',
        sourceConceptName: 'Content Marketing Strategy',
        targetConceptName: 'Audience-First Principle',
        relationshipType: 'implements',
        description: 'Content marketing strategy implements the audience-first principle by prioritizing audience needs in all content creation efforts',
        strength: 0.85
      }
    );
    
    if (relationshipResult.success) {
      logger.info(`Created relationship with ID: ${relationshipResult.itemId}`);
    }
    
    // 2. Process the flagged items
    logger.info('Processing flagged items');
    
    // Approve the items
    if (conceptResult.success) {
      await flaggingService.updateItemStatus(conceptResult.itemId!, 'approved');
    }
    
    if (principleResult.success) {
      await flaggingService.updateItemStatus(principleResult.itemId!, 'approved');
    }
    
    if (relationshipResult.success) {
      await flaggingService.updateItemStatus(relationshipResult.itemId!, 'approved');
    }
    
    // Process the approved items
    const processResults = await flaggingService.processAllApprovedItems();
    logger.info(`Processed ${processResults.length} items`);
    
    // 3. Generate relationship suggestions
    if (conceptResult.success) {
      logger.info('Generating relationship suggestions');
      const item = flaggingService.getFlaggedItem(conceptResult.itemId!);
      
      if (item && item.processedAt) {
        // Find the concept in the graph
        const concepts = knowledgeGraph.getAllConcepts();
        const conceptEntry = concepts.find(c => c.name === 'Content Marketing Strategy');
        
        if (conceptEntry) {
          // Generate suggestions
          const suggestions = await graphService.generateRelationshipSuggestions(conceptEntry.id);
          logger.info(`Generated ${suggestions.length} relationship suggestions`);
          
          // Apply first suggestion if any
          if (suggestions.length > 0) {
            const relationshipId = graphService.applyRelationshipSuggestion(suggestions[0]);
            logger.info(`Applied relationship suggestion: ${relationshipId}`);
          }
        }
      }
    }
    
    // 4. Get quality scores
    if (conceptResult.success) {
      logger.info('Getting quality scores');
      const item = flaggingService.getFlaggedItem(conceptResult.itemId!);
      
      if (item && item.processedAt) {
        // Find the concept in the graph
        const concepts = knowledgeGraph.getAllConcepts();
        const conceptEntry = concepts.find(c => c.name === 'Content Marketing Strategy');
        
        if (conceptEntry) {
          const score = graphService.getQualityScore(conceptEntry.id);
          logger.info(`Quality score for concept: ${JSON.stringify(score)}`);
        }
      }
    }
    
    logger.info('Knowledge Pipeline Test completed successfully');
  } catch (error) {
    logger.error('Error in knowledge pipeline test:', error);
  }
}

// Run the test
testKnowledgePipeline().catch(err => logger.error('Unhandled error:', err)); 