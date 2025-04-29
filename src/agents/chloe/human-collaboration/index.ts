import { PlanningTask } from '../graph/nodes/types';

// Using PlanningTask as a base but extending with confidence score
export interface PlannedTask extends PlanningTask {
  confidenceScore?: number;
  params?: Record<string, any>;
  requiredParams?: string[];
  type?: string;
  isStrategic?: boolean;
  toolName?: string;
  requiresApproval?: boolean;
  approvalGranted?: boolean;
  blockedReason?: string;
}

/**
 * Determines whether Chloe should pause and ask the user for clarification.
 * 
 * @param task The planned task to evaluate
 * @returns True if clarification is needed, false otherwise
 */
export async function checkNeedClarification(task: PlannedTask): Promise<boolean> {
  // Check for low confidence score
  if (task.confidenceScore !== undefined && task.confidenceScore < 0.6) {
    return true;
  }

  // Check for missing required parameters
  if (task.requiredParams && task.params) {
    const missingParams = task.requiredParams.filter(param => 
      !task.params || task.params[param] === undefined || task.params[param] === null
    );
    if (missingParams.length > 0) {
      return true;
    }
  }

  // Check for uncertainty in the task description or reasoning
  const uncertaintyWords = [
    'maybe', 'somehow', 'not sure', 'uncertain', 'unclear', 
    'ambiguous', 'perhaps', 'possibly', 'might', 'could be'
  ];
  
  const textToCheck = `${task.goal} ${task.reasoning || ''}`;
  
  return uncertaintyWords.some(word => 
    textToCheck.toLowerCase().includes(word.toLowerCase())
  );
}

/**
 * Determines whether a task requires explicit user approval before execution.
 * 
 * @param task The planned task to evaluate
 * @returns True if approval is required, false otherwise
 */
export function checkIfApprovalRequired(task: PlannedTask): boolean {
  // Check for external posting tasks
  if (task.type === 'external_post') {
    return true;
  }
  
  // Check for strategic tasks
  if (task.isStrategic === true) {
    return true;
  }
  
  // Check for specific tools that require approval
  if (task.toolName === 'new_tool') {
    return true;
  }
  
  // TODO: Extend this to support admin-defined approval settings
  // This could check against a configurable list of task types,
  // tools, or other properties that require approval
  
  return false;
}

/**
 * Find ambiguous elements in a task
 * 
 * @param task The planned task to analyze
 * @returns An object containing different types of ambiguities
 */
function findAmbiguities(task: PlannedTask): {
  missingParams: string[];
  uncertainPhrases: string[];
} {
  const result = {
    missingParams: [] as string[],
    uncertainPhrases: [] as string[]
  };
  
  // Check for missing required parameters
  if (task.requiredParams && task.params) {
    result.missingParams = task.requiredParams.filter(param => 
      !task.params || task.params[param] === undefined || task.params[param] === null
    );
  }
  
  // Find uncertainty phrases in the task description or reasoning
  const uncertaintyWords = [
    'maybe', 'somehow', 'not sure', 'uncertain', 'unclear', 
    'ambiguous', 'perhaps', 'possibly', 'might', 'could be'
  ];
  
  const textToCheck = `${task.goal} ${task.reasoning || ''}`;
  
  // Find phrases containing uncertainty words (with surrounding context)
  for (const word of uncertaintyWords) {
    const regex = new RegExp(`[^.!?]*\\b${word}\\b[^.!?]*[.!?]`, 'gi');
    const matches = textToCheck.match(regex) || [];
    
    result.uncertainPhrases.push(...matches);
  }
  
  return result;
}

/**
 * Generates 1-3 clear questions to ask the user to clarify the task.
 * 
 * @param task The planned task that needs clarification
 * @returns An array of questions to ask the user
 */
export async function generateClarificationQuestions(task: PlannedTask): Promise<string[]> {
  const questions: string[] = [];
  const ambiguities = findAmbiguities(task);
  
  // Generate questions for missing parameters
  if (ambiguities.missingParams.length > 0) {
    for (const param of ambiguities.missingParams.slice(0, 2)) { // Limit to 2 param questions
      questions.push(`Could you provide a value for the "${param}" parameter?`);
    }
    
    // If there are more missing params, create a combined question
    if (ambiguities.missingParams.length > 2) {
      const remainingParams = ambiguities.missingParams.slice(2).join('", "');
      questions.push(`Could you also provide values for the "${remainingParams}" parameters?`);
    }
  }
  
  // Generate questions for uncertainty phrases
  if (ambiguities.uncertainPhrases.length > 0) {
    // Deduplicate and limit to 2 phrases
    const uniquePhrases = Array.from(new Set(ambiguities.uncertainPhrases)).slice(0, 2);
    
    for (const phrase of uniquePhrases) {
      // Extract the uncertain part and create a question
      const cleanPhrase = phrase.trim().replace(/^[.!?,\s]+|[.!?,\s]+$/g, '');
      questions.push(`Could you clarify what you mean by "${cleanPhrase}"?`);
    }
  }
  
  // If no specific questions were generated but clarification is needed
  if (questions.length === 0 && task.confidenceScore !== undefined && task.confidenceScore < 0.6) {
    questions.push("I'm not entirely confident about this task. Could you provide more details?");
  }
  
  // Limit to 3 questions at most
  return questions.slice(0, 3);
}

// Export both functions in a named object
export const HumanCollaboration = {
  checkNeedClarification,
  generateClarificationQuestions,
  checkIfApprovalRequired
}; 