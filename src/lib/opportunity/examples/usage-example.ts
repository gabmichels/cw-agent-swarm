// @ts-nocheck
/**
 * Opportunity Management System - Usage Example
 * 
 * This file demonstrates how to directly use the Opportunity Management System
 * without adapters, showing key functionality and patterns.
 */

import * as path from 'path';
import {
  createOpportunitySystem,
  OpportunityStorageType,
  OpportunityType,
  OpportunityPriority,
  OpportunityStatus,
  TimeSensitivity,
  OpportunitySource
} from '../index';

async function runExample() {
  console.log('Initializing Opportunity Management System...');
  
  // Create the opportunity system with file-based storage
  const opportunitySystem = createOpportunitySystem({
    storage: {
      type: OpportunityStorageType.FILE,
      storageDir: path.join(process.cwd(), 'data', 'opportunities-example'),
      saveOnMutation: true
    },
    autoEvaluate: true
  });
  
  // Initialize the system
  await opportunitySystem.initialize();
  
  // Get system status
  const status = await opportunitySystem.getStatus();
  console.log('System status:', status);
  
  // Create an opportunity
  console.log('Creating an opportunity...');
  const opportunity = await opportunitySystem.createOpportunity({
    title: 'Example Task Opportunity',
    description: 'This is an example opportunity for demonstration purposes',
    type: OpportunityType.TASK_OPTIMIZATION,
    priority: OpportunityPriority.MEDIUM,
    source: OpportunitySource.USER_INTERACTION,
    trigger: {
      type: 'example',
      source: OpportunitySource.USER_INTERACTION,
      content: 'Sample trigger content',
      confidence: 0.85,
      timestamp: new Date(),
      context: {}
    },
    context: {
      agentId: 'example-agent',
      source: 'example-source',
      metadata: {}
    },
    timeSensitivity: TimeSensitivity.STANDARD,
    tags: ['example', 'demo']
  });
  
  console.log('Created opportunity:', opportunity.id);
  
  // Evaluate the opportunity
  console.log('Evaluating opportunity...');
  const evaluation = await opportunitySystem.evaluateOpportunity(opportunity.id);
  console.log('Evaluation result:', evaluation);
  
  // Find opportunities
  console.log('Finding opportunities...');
  const opportunities = await opportunitySystem.findOpportunities({
    types: [OpportunityType.TASK_OPTIMIZATION],
    statuses: [OpportunityStatus.DETECTED, OpportunityStatus.EVALUATING]
  });
  
  console.log(`Found ${opportunities.length} opportunities`);
  
  // Update opportunity status
  console.log('Updating opportunity status...');
  const updated = await opportunitySystem.updateOpportunityStatus(
    opportunity.id,
    OpportunityStatus.COMPLETED,
    {
      completedAt: new Date(),
      successful: true,
      outcomeDescription: 'Example opportunity successfully completed'
    }
  );
  
  console.log('Updated opportunity status:', updated?.status);
  
  // Get health status
  const health = await opportunitySystem.getHealth();
  console.log('System health:', health);
  
  // Process an opportunity into tasks
  try {
    const processingResult = await opportunitySystem.processOpportunity(opportunity.id);
    console.log('Processing result:', processingResult);
  } catch (error) {
    console.error('Processing error:', error);
  }
  
  // Clean up expired opportunities
  const cleared = await opportunitySystem.clearExpiredOpportunities();
  console.log(`Cleared ${cleared} expired opportunities`);
  
  console.log('Example completed successfully');
}

// Run the example
runExample().catch(error => {
  console.error('Error in example:', error);
}); 