#!/usr/bin/env node
/**
 * Test script for effort and time estimation in task planning
 * 
 * This script demonstrates how Chloe estimates effort, urgency, and 
 * suggested deadlines for different types of tasks
 */

import { ChatOpenAI } from '@langchain/openai';
import { PlanningTask } from '../agents/chloe/graph/nodes/types';
import { estimateEffortAndUrgency, EffortMetadata } from '../agents/chloe/strategy/taskEffortEstimator';

// Extend PlanningTask with optional properties for testing
interface ExtendedPlanningTask extends PlanningTask {
  type?: string;
  metadata?: {
    priorityScore?: number;
    priorityTags?: string[];
  };
}

// Sample tasks for testing
const sampleTasks: ExtendedPlanningTask[] = [
  {
    goal: "Create a simple Twitter post for our new product launch",
    subGoals: [
      { id: "1", description: "Draft tweet copy", priority: 1, status: 'pending' },
      { id: "2", description: "Select image", priority: 2, status: 'pending' },
      { id: "3", description: "Schedule tweet", priority: 3, status: 'pending' }
    ],
    type: "social_post", // Should be low effort
    reasoning: "Create social media presence for product launch",
    status: 'planning'
  },
  {
    goal: "Develop a comprehensive marketing strategy for Q3",
    subGoals: [
      { id: "1", description: "Analyze Q2 results", priority: 1, status: 'pending' },
      { id: "2", description: "Identify target audience segments", priority: 2, status: 'pending' },
      { id: "3", description: "Create channel strategy", priority: 3, status: 'pending' },
      { id: "4", description: "Define content calendar", priority: 4, status: 'pending' },
      { id: "5", description: "Plan budget allocation", priority: 5, status: 'pending' },
      { 
        id: "6", 
        description: "Develop KPIs", 
        priority: 6, 
        status: 'pending',
        children: [
          { id: "6.1", description: "Define success metrics", priority: 1, status: 'pending' },
          { id: "6.2", description: "Set up tracking system", priority: 2, status: 'pending' }
        ]
      }
    ],
    metadata: {
      priorityScore: 85, // High priority score
      priorityTags: ["revenue_growth", "strategic"]
    },
    reasoning: "Strategic planning for third quarter marketing initiatives",
    status: 'planning'
  },
  {
    goal: "Create an urgent blog post about recent industry changes",
    subGoals: [
      { id: "1", description: "Research changes", priority: 1, status: 'pending' },
      { id: "2", description: "Draft outline", priority: 2, status: 'pending' },
      { id: "3", description: "Write content", priority: 3, status: 'pending' },
      { id: "4", description: "Review and publish", priority: 4, status: 'pending' }
    ],
    type: "blog_post",
    reasoning: "Address recent industry changes with timely content",
    status: 'planning'
  }
];

/**
 * Test effort estimation for different types of tasks
 */
async function testEffortEstimation() {
  console.log('🧠 Testing Effort and Time Estimation\n');
  
  // Create the model for testing
  const model = new ChatOpenAI({
    temperature: 0.2,
    modelName: process.env.OPENAI_MODEL_NAME || 'gpt-4-turbo-preview'
  });
  
  // Test each sample task - using traditional for loop to avoid iterator issues
  for (let i = 0; i < sampleTasks.length; i++) {
    const task = sampleTasks[i];
    console.log(`\n📋 Task ${i + 1}: ${task.goal}`);
    console.log(`   Sub-goals: ${task.subGoals.length}`);
    console.log(`   Type: ${task.type || 'Not specified'}`);
    console.log(`   Priority Score: ${task.metadata?.priorityScore || 'Not specified'}`);
    
    // Run the estimation
    console.log('\n⏳ Estimating effort...');
    const effortMetadata = await estimateEffortAndUrgency(task, {
      model,
      useHeuristics: true
    });
    
    // Display the results
    console.log('\n✅ Estimation Results:');
    console.log(`   Estimated Effort: ${effortMetadata.estimatedEffort.toUpperCase()}`);
    console.log(`   Urgency: ${effortMetadata.urgency.toUpperCase()}`);
    
    if (effortMetadata.suggestedDeadline) {
      console.log(`   Suggested Deadline: ${effortMetadata.suggestedDeadline}`);
    }
    
    if (effortMetadata.estimatedHours) {
      console.log(`   Estimated Hours: ${effortMetadata.estimatedHours}`);
    }
    
    if (effortMetadata.reasoningForEstimate) {
      console.log(`\n💡 Reasoning: ${effortMetadata.reasoningForEstimate}`);
    }
    
    console.log('\n' + '-'.repeat(60));
  }
  
  console.log('\n🎉 Testing completed!');
}

// Run the test
testEffortEstimation().catch(error => {
  console.error('❌ Error during testing:', error);
  process.exit(1);
}); 