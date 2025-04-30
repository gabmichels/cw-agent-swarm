/**
 * Stakeholder-aware communication module for Chloe
 * 
 * This module provides functionality to adjust Chloe's communication style
 * based on the stakeholder profile, allowing for personalized interactions.
 */

/**
 * Interface representing a stakeholder profile with communication preferences
 */
export interface StakeholderProfile {
  id: string;
  name?: string;
  tone?: "formal" | "casual" | "neutral";
  expertiseLevel?: "beginner" | "intermediate" | "expert";
  preferredFormat?: "concise" | "detailed";
  language?: string;
}

/**
 * Default profile to use when no specific profile is provided
 */
export const DEFAULT_PROFILE: StakeholderProfile = {
  id: "default",
  tone: "neutral",
  expertiseLevel: "intermediate",
  preferredFormat: "concise",
  language: "en"
};

/**
 * Adjusts the tone and content of a message based on stakeholder profile
 * 
 * @param input The original message text
 * @param profile The stakeholder profile to adjust for
 * @returns The adjusted message text
 */
export function adjustTone(input: string, profile: StakeholderProfile = DEFAULT_PROFILE): string {
  let result = input;
  
  // Apply tone adjustments
  result = adjustForTone(result, profile.tone || "neutral");
  
  // Apply expertise level adjustments
  result = adjustForExpertise(result, profile.expertiseLevel || "intermediate");
  
  // Apply format preference adjustments
  result = adjustForFormat(result, profile.preferredFormat || "concise");
  
  return result;
}

/**
 * Adjusts the tone of a message based on the specified formality level
 */
function adjustForTone(input: string, tone: "formal" | "casual" | "neutral"): string {
  switch (tone) {
    case "formal":
      return formalizeText(input);
    case "casual":
      return casualizeText(input);
    case "neutral":
    default:
      return input;
  }
}

/**
 * Makes text more formal
 */
function formalizeText(input: string): string {
  let result = input;
  
  // Replace casual phrases with more formal equivalents
  const formalReplacements: [RegExp, string][] = [
    [/\bI need\b/gi, "I require"],
    [/\bI want\b/gi, "I would like"],
    [/\bI think\b/gi, "I believe"],
    [/\bhey\b/gi, "Greetings"],
    [/\bneed to\b/gi, "must"],
    [/\blet's\b/gi, "let us"],
    [/\bcan't\b/gi, "cannot"],
    [/\bdon't\b/gi, "do not"],
    [/\bwon't\b/gi, "will not"],
    [/\bgot\b/gi, "received"],
    [/\bget\b/gi, "obtain"],
    [/\bplease\b/gi, "kindly"],
    [/\bcould you\b/gi, "would you kindly"],
    [/\bwe need\b/gi, "we require"],
    [/\bthanks\b/gi, "thank you"]
  ];
  
  formalReplacements.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  
  // Add formal opener and closer if response seems like a standalone message
  if (result.length > 100 && !result.includes("Greetings") && !result.includes("Dear")) {
    result = `Dear Stakeholder,\n\n${result}`;
  }
  
  if (result.length > 100 && !result.includes("Sincerely") && !result.includes("Regards")) {
    result = `${result}\n\nKind regards,\nChloe`;
  }
  
  return result;
}

/**
 * Makes text more casual
 */
function casualizeText(input: string): string {
  let result = input;
  
  // Replace formal phrases with more casual equivalents
  const casualReplacements: [RegExp, string][] = [
    [/\bI require\b/gi, "I need"],
    [/\bI would like\b/gi, "I want"],
    [/\bI believe\b/gi, "I think"],
    [/\bgreetings\b/gi, "Hey"],
    [/\bmust\b/gi, "need to"],
    [/\blet us\b/gi, "let's"],
    [/\bcannot\b/gi, "can't"],
    [/\bdo not\b/gi, "don't"],
    [/\bwill not\b/gi, "won't"],
    [/\breceived\b/gi, "got"],
    [/\bobtain\b/gi, "get"],
    [/\bkindly\b/gi, "please"],
    [/\bwould you kindly\b/gi, "could you"],
    [/\bwe require\b/gi, "we need"],
    [/\bthank you\b/gi, "thanks"]
  ];
  
  casualReplacements.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  
  // Remove formal openers and closers
  result = result.replace(/^Dear .*?,\s*/gi, "Hey! ");
  result = result.replace(/\s*Kind regards,\s*Chloe\s*$/gi, "\n\nCheers,\nChloe");
  result = result.replace(/\s*Sincerely,\s*Chloe\s*$/gi, "\n\nCheers,\nChloe");
  
  return result;
}

/**
 * Adjusts content based on expertise level
 */
function adjustForExpertise(input: string, expertiseLevel: "beginner" | "intermediate" | "expert"): string {
  switch (expertiseLevel) {
    case "beginner":
      return simplifyForBeginners(input);
    case "expert":
      return enhanceForExperts(input);
    case "intermediate":
    default:
      return input;
  }
}

/**
 * Simplifies explanations for beginners
 */
function simplifyForBeginners(input: string): string {
  let result = input;
  
  // Add explanatory notes for technical terms
  const technicalTerms: [RegExp, string][] = [
    [/\b(API)\b/g, "$1 (a way for systems to talk to each other)"],
    [/\b(algorithm)\b/gi, "$1 (a set of steps to solve a problem)"],
    [/\b(database)\b/gi, "$1 (a system to store information)"],
    [/\b(parameter)\b/gi, "$1 (a specific value needed for a task)"],
    [/\b(function)\b/gi, "$1 (a piece of code that performs a specific task)"],
    [/\b(query)\b/gi, "$1 (a request for information)"]
  ];
  
  technicalTerms.forEach(([pattern, replacement]) => {
    // Only replace the first occurrence to avoid cluttering
    const match = result.match(pattern);
    if (match && match.length > 0) {
      result = result.replace(match[0], replacement.replace("$1", match[0]));
    }
  });
  
  // Add reassuring language
  if (!result.includes("Don't worry") && !result.includes("don't worry")) {
    result = result.replace(/\.([\s\n]+)/g, ". Don't worry, I'll guide you through this.$1");
  }
  
  return result;
}

/**
 * Enhances content for expert stakeholders
 */
function enhanceForExperts(input: string): string {
  let result = input;
  
  // Remove explanations that might be redundant for experts
  result = result.replace(/\s*\([^)]*beginner[^)]*\)/gi, "");
  result = result.replace(/\s*\([^)]*explanation[^)]*\)/gi, "");
  result = result.replace(/Don't worry, I'll guide you through this\./gi, "");
  
  // Remove unnecessary reassurances
  result = result.replace(/This might sound complicated, but/gi, "");
  
  return result;
}

/**
 * Adjusts the format of content based on preferred format
 */
function adjustForFormat(input: string, preferredFormat: "concise" | "detailed"): string {
  switch (preferredFormat) {
    case "concise":
      return makeConcise(input);
    case "detailed":
      return makeDetailed(input);
    default:
      return input;
  }
}

/**
 * Makes content more concise
 */
function makeConcise(input: string): string {
  let result = input;
  
  // Remove filler words and phrases
  const fillerPhrases: RegExp[] = [
    /\bbasically\b/gi,
    /\bactually\b/gi,
    /\bin order to\b/gi,
    /\bjust\b/gi,
    /\bvery\b/gi,
    /\bquite\b/gi,
    /\bin my opinion\b/gi,
    /\bas you may know\b/gi,
    /\bneedless to say\b/gi,
    /\bfor what it's worth\b/gi
  ];
  
  fillerPhrases.forEach(pattern => {
    result = result.replace(pattern, "");
  });
  
  // Replace verbose phrases with concise alternatives
  const conciseReplacements: [RegExp, string][] = [
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bat this point in time\b/gi, "now"],
    [/\bin the event that\b/gi, "if"],
    [/\bin the near future\b/gi, "soon"],
    [/\bfor the purpose of\b/gi, "for"]
  ];
  
  conciseReplacements.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  
  // Simplify multiple sentences with similar meaning
  result = result.replace(/\b(This is important)\b.*?\b(This is crucial)\b/gi, "$1");
  
  return result;
}

/**
 * Makes content more detailed
 */
function makeDetailed(input: string): string {
  // This is a simplified implementation - in a real system,
  // you might want to use an LLM to expand content appropriately
  
  // For now, we'll just add context to certain keywords
  let result = input;
  
  // Add more detail to key phrases if they appear
  if (result.includes("clarify")) {
    result = result.replace(
      /\bclarify\b/gi, 
      "clarify (providing specific details will help ensure accurate execution)"
    );
  }
  
  if (result.includes("approval")) {
    result = result.replace(
      /\bapproval\b/gi, 
      "approval (this ensures the task meets organizational standards and objectives)"
    );
  }
  
  // Add explanatory notes where appropriate
  if (!result.includes("details")) {
    result += "\n\nPlease note that providing detailed information helps ensure the task is completed correctly and efficiently.";
  }
  
  return result;
}

/**
 * Generates a message with appropriate tone for a specific stakeholder
 * 
 * @param messageKey The type of message to generate
 * @param params Message-specific parameters
 * @param profile The stakeholder profile
 * @returns A formatted message adjusted for the stakeholder
 */
export function generateStakeholderMessage(
  messageKey: "clarification" | "approval" | "status" | "completion",
  params: Record<string, any>,
  profile: StakeholderProfile = DEFAULT_PROFILE
): string {
  // Get base message template
  const baseMessage = getMessageTemplate(messageKey, params);
  
  // Adjust tone based on profile
  return adjustTone(baseMessage, profile);
}

/**
 * Returns a base message template for different message types
 */
function getMessageTemplate(messageKey: string, params: Record<string, any>): string {
  switch (messageKey) {
    case "clarification":
      return `I need to clarify some aspects of this task before proceeding:\n\n${
        params.questions?.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n\n') || "Please provide more details."
      }\n\nPlease provide more information so I can proceed with confidence.`;
      
    case "approval":
      return `This task requires approval before execution:\n\n` +
        `**Task**: ${params.taskDescription || "[Task Description]"}\n\n` +
        `**Goal**: ${params.goal || "[Overall Goal]"}\n\n` +
        `**Reason for approval**: ${params.reason || "This task requires approval based on defined rules"}`;
      
    case "status":
      return `Current status update on task "${params.taskDescription || "[Task Description]"}":\n\n` +
        `**Progress**: ${params.progress || "0%"}\n` +
        `**Status**: ${params.status || "In progress"}\n` +
        `**Next Steps**: ${params.nextSteps || "Continuing execution"}\n\n` +
        `${params.additionalDetails || ""}`;
      
    case "completion":
      return `Task completed: "${params.taskDescription || "[Task Description]"}"\n\n` +
        `**Result**: ${params.result || "Task was completed successfully."}\n\n` +
        `**Summary**: ${params.summary || "All steps were completed as planned."}\n\n` +
        `${params.nextActions ? `**Next Actions**: ${params.nextActions}` : ""}`;
      
    default:
      return params.message || "No message content provided.";
  }
}

/**
 * Export a stakeholder management utility object
 */
export const StakeholderManager = {
  adjustTone,
  generateStakeholderMessage,
  DEFAULT_PROFILE
}; 