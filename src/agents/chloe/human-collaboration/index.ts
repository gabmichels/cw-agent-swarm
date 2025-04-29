import { PlanningTask } from '../graph/nodes/types';
import { StakeholderProfile, StakeholderManager, DEFAULT_PROFILE } from './stakeholder';

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
  stakeholderProfile?: StakeholderProfile;
  // Correction-related fields
  wasCorrected?: boolean;
  correctionNotes?: string[];
  correctionCategory?: 'misunderstanding' | 'tool_misuse' | 'missed_context' | 'wrong_approach' | 'other';
  correctionTimestamp?: number;
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
 * @param stakeholderProfile Optional stakeholder profile for tone adjustment
 * @returns An array of questions to ask the user
 */
export async function generateClarificationQuestions(
  task: PlannedTask,
  stakeholderProfile?: StakeholderProfile
): Promise<string[]> {
  const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
  const questions: string[] = [];
  const ambiguities = findAmbiguities(task);
  
  // Generate questions for missing parameters
  if (ambiguities.missingParams.length > 0) {
    for (const param of ambiguities.missingParams.slice(0, 2)) { // Limit to 2 param questions
      const baseQuestion = `Could you provide a value for the "${param}" parameter?`;
      questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
    }
    
    // If there are more missing params, create a combined question
    if (ambiguities.missingParams.length > 2) {
      const remainingParams = ambiguities.missingParams.slice(2).join('", "');
      const baseQuestion = `Could you also provide values for the "${remainingParams}" parameters?`;
      questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
    }
  }
  
  // Generate questions for uncertainty phrases
  if (ambiguities.uncertainPhrases.length > 0) {
    // Deduplicate and limit to 2 phrases
    const uniquePhrases = Array.from(new Set(ambiguities.uncertainPhrases)).slice(0, 2);
    
    for (const phrase of uniquePhrases) {
      // Extract the uncertain part and create a question
      const cleanPhrase = phrase.trim().replace(/^[.!?,\s]+|[.!?,\s]+$/g, '');
      const baseQuestion = `Could you clarify what you mean by "${cleanPhrase}"?`;
      questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
    }
  }
  
  // If no specific questions were generated but clarification is needed
  if (questions.length === 0 && task.confidenceScore !== undefined && task.confidenceScore < 0.6) {
    const baseQuestion = "I'm not entirely confident about this task. Could you provide more details?";
    questions.push(StakeholderManager.adjustTone(baseQuestion, profile));
  }
  
  // Limit to 3 questions at most
  return questions.slice(0, 3);
}

/**
 * Formats a clarification request message with appropriate tone for the stakeholder
 * 
 * @param task The task requiring clarification
 * @param questions Array of clarification questions
 * @param stakeholderProfile Optional stakeholder profile
 * @returns A formatted message adjusted for the stakeholder
 */
export function formatClarificationRequest(
  task: PlannedTask,
  questions: string[],
  stakeholderProfile?: StakeholderProfile
): string {
  const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
  
  // Generate the base clarification message
  const baseMessage = StakeholderManager.generateStakeholderMessage(
    "clarification",
    { questions },
    profile
  );
  
  return baseMessage;
}

/**
 * Formats an approval request message with appropriate tone for the stakeholder
 * 
 * @param task The task requiring approval
 * @param stakeholderProfile Optional stakeholder profile
 * @returns A formatted message adjusted for the stakeholder
 */
export function formatApprovalRequest(
  task: PlannedTask,
  stakeholderProfile?: StakeholderProfile
): string {
  const profile = stakeholderProfile || task.stakeholderProfile || DEFAULT_PROFILE;
  
  // Determine the reason for approval
  let approvalReason = "This task requires approval based on defined rules";
  if (task.type === 'external_post') {
    approvalReason = "This task involves posting content externally";
  } else if (task.isStrategic === true) {
    approvalReason = "This is a strategic task that requires review";
  } else if (task.toolName === 'new_tool') {
    approvalReason = "This task uses a tool that requires approval";
  }
  
  // Generate the base approval message
  const baseMessage = StakeholderManager.generateStakeholderMessage(
    "approval",
    {
      taskDescription: task.subGoals.find(sg => sg.id === task.currentSubGoalId)?.description || task.goal,
      goal: task.goal,
      reason: approvalReason
    },
    profile
  );
  
  return baseMessage;
}

/**
 * Sets a stakeholder profile for a task
 * 
 * @param task The task to update
 * @param profile The stakeholder profile to apply
 * @returns The updated task with stakeholder profile
 */
export function setStakeholderProfile(
  task: PlannedTask,
  profile: StakeholderProfile
): PlannedTask {
  return {
    ...task,
    stakeholderProfile: profile
  };
}

// Export both functions in a named object
export const HumanCollaboration = {
  checkNeedClarification,
  generateClarificationQuestions,
  checkIfApprovalRequired,
  formatClarificationRequest,
  formatApprovalRequest,
  setStakeholderProfile
}; 