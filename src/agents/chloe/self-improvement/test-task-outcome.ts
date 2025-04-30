/**
 * Test file for TaskOutcomeAnalyzer
 * 
 * This demonstrates how the TaskOutcomeAnalyzer works with different types of tasks
 */

import { PlannedTask } from '../human-collaboration';
import { ExecutionTraceEntry } from '../graph/nodes/types';
import { ChloeMemory } from '../memory';
import { analyzeTaskOutcome } from './taskOutcomeAnalyzer';
import { extractLessons } from './lessonExtractor';
import { onTaskStateChange } from '../hooks/taskCompletionHook';

/**
 * Sample successful task
 */
const successfulTask: PlannedTask = {
  goal: "Research recent marketing trends for social media",
  type: "research",
  reasoning: "Need to understand current social media marketing landscape for strategy development",
  subGoals: [
    { 
      id: "sg1", 
      description: "Find latest statistics on social media usage", 
      status: "complete",
      priority: 1
    },
    { 
      id: "sg2", 
      description: "Identify top 3 marketing trends", 
      status: "complete",
      priority: 2 
    },
    { 
      id: "sg3", 
      description: "Summarize findings", 
      status: "complete",
      priority: 3
    }
  ],
  status: "complete",
  wasCorrected: false,
  needsClarification: false
};

/**
 * Sample task that was corrected
 */
const correctedTask: PlannedTask = {
  goal: "Create an email campaign for product launch",
  type: "creative",
  reasoning: "Need to announce the new product launch to our customer base",
  subGoals: [
    { 
      id: "sg1", 
      description: "Draft email content", 
      status: "complete",
      priority: 1
    },
    { 
      id: "sg2", 
      description: "Create subject lines", 
      status: "complete",
      priority: 2
    }
  ],
  status: "complete",
  wasCorrected: true,
  correctionCategory: "missed_context",
  correctionNotes: ["The email needs to target enterprise customers specifically"],
  needsClarification: false
};

/**
 * Sample failed task
 */
const failedTask: PlannedTask = {
  goal: "Analyze competitor website performance",
  type: "analysis",
  reasoning: "Need to benchmark our website against competitors to identify improvement areas",
  subGoals: [
    { 
      id: "sg1", 
      description: "Access competitor website data", 
      status: "failed",
      priority: 1
    },
    { 
      id: "sg2", 
      description: "Compare metrics with our site", 
      status: "pending",
      priority: 2
    }
  ],
  status: "failed",
  wasCorrected: false,
  needsClarification: false
};

/**
 * Sample execution trace
 */
const executionTrace: ExecutionTraceEntry[] = [
  {
    step: "Starting task execution",
    startTime: new Date(Date.now() - 5000),
    endTime: new Date(Date.now() - 4800),
    duration: 200,
    status: "success",
    details: {}
  },
  {
    step: "Executing sub-goal: Find latest statistics",
    startTime: new Date(Date.now() - 4500),
    endTime: new Date(Date.now() - 3500),
    duration: 1000,
    status: "success",
    details: {
      toolUsed: "web_search"
    }
  },
  {
    step: "Executing sub-goal: Identify trends",
    startTime: new Date(Date.now() - 3000),
    endTime: new Date(Date.now() - 1000),
    duration: 2000,
    status: "success",
    details: {
      toolUsed: "content_analysis"
    }
  }
];

/**
 * Run demo of TaskOutcomeAnalyzer
 */
async function runTaskOutcomeAnalyzerDemo() {
  console.log("===== TaskOutcomeAnalyzer Demo =====");
  
  // Initialize memory
  const memory = new ChloeMemory();
  await memory.initialize();
  
  console.log("\n1. Analyzing successful task...");
  const successResult = await analyzeTaskOutcome(successfulTask, executionTrace, memory);
  console.log("Success Result:", {
    status: successResult.status,
    score: successResult.score,
    patterns: successResult.patterns,
    reason: successResult.reason
  });
  
  console.log("\n2. Analyzing corrected task...");
  const correctionResult = await analyzeTaskOutcome(correctedTask, executionTrace, memory);
  console.log("Correction Result:", {
    status: correctionResult.status,
    score: correctionResult.score,
    patterns: correctionResult.patterns,
    reason: correctionResult.reason
  });
  
  console.log("\n3. Analyzing failed task...");
  const failureResult = await analyzeTaskOutcome(failedTask, executionTrace, memory);
  console.log("Failure Result:", {
    status: failureResult.status,
    score: failureResult.score,
    patterns: failureResult.patterns,
    reason: failureResult.reason
  });
  
  console.log("\n4. Testing task completion hook...");
  await onTaskStateChange(successfulTask, executionTrace, memory);
  
  console.log("\n5. Extracting lessons...");
  const lessons = await extractLessons(memory);
  console.log(`Extracted ${lessons.length} lessons`);
  if (lessons.length > 0) {
    console.log("Sample lesson:", lessons[0].content);
  }
  
  console.log("\n===== Demo Complete =====");
}

// Run the demo
if (require.main === module) {
  runTaskOutcomeAnalyzerDemo()
    .then(() => console.log("Demo completed successfully"))
    .catch(error => console.error("Error in demo:", error));
}

export { runTaskOutcomeAnalyzerDemo }; 