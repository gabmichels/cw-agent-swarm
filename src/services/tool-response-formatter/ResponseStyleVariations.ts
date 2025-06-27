/**
 * Response Style Variations
 * 
 * Handles different response styles based on execution results (success, partial, error)
 * and integrates persona-specific communication patterns.
 */

import { ULID } from 'ulid';
import { PersonaInfo } from '../../agents/shared/messaging/PromptFormatter';
import { ToolExecutionResult } from '../../lib/tools/types';
import { ResponseStyleType, ToolCategory, ToolResponseContext } from './types';

/**
 * Response style configuration for different execution outcomes
 */
export interface ResponseStyleConfig {
  readonly id: ULID;
  readonly style: ResponseStyleType;
  readonly category: ToolCategory;
  readonly successPattern: ResponsePattern;
  readonly errorPattern: ResponsePattern;
  readonly partialSuccessPattern: ResponsePattern;
  readonly personaAdaptations: PersonaAdaptation[];
}

/**
 * Response pattern template for specific execution outcomes
 */
export interface ResponsePattern {
  readonly tone: ResponseTone;
  readonly structure: ResponseStructure;
  readonly contentFocus: ContentFocus[];
  readonly languagePatterns: LanguagePattern[];
  readonly emojiUsage: EmojiUsage;
  readonly lengthGuideline: LengthGuideline;
}

/**
 * Persona-specific adaptations for response styles
 */
export interface PersonaAdaptation {
  readonly personaType: string;
  readonly toneAdjustments: ToneAdjustment[];
  readonly vocabularyPreferences: VocabularyPreference[];
  readonly communicationPatterns: CommunicationPattern[];
}

/**
 * Response tone characteristics
 */
export enum ResponseTone {
  CELEBRATORY = 'celebratory',
  PROFESSIONAL = 'professional',
  ENCOURAGING = 'encouraging',
  ANALYTICAL = 'analytical',
  SUPPORTIVE = 'supportive',
  ENTHUSIASTIC = 'enthusiastic',
  CONFIDENT = 'confident',
  EMPATHETIC = 'empathetic',
  STRATEGIC = 'strategic',
  TECHNICAL = 'technical'
}

/**
 * Response structure patterns
 */
export enum ResponseStructure {
  SUMMARY_FIRST = 'summary_first',
  CHRONOLOGICAL = 'chronological',
  PROBLEM_SOLUTION = 'problem_solution',
  ACHIEVEMENT_IMPACT = 'achievement_impact',
  CONTEXT_ACTION_RESULT = 'context_action_result',
  TECHNICAL_ANALYSIS = 'technical_analysis'
}

/**
 * Content focus areas for responses
 */
export enum ContentFocus {
  ACHIEVEMENT_CELEBRATION = 'achievement_celebration',
  TECHNICAL_DETAILS = 'technical_details',
  BUSINESS_IMPACT = 'business_impact',
  USER_EMPOWERMENT = 'user_empowerment',
  NEXT_STEPS = 'next_steps',
  PROBLEM_RESOLUTION = 'problem_resolution',
  METRICS_PERFORMANCE = 'metrics_performance',
  STRATEGIC_INSIGHTS = 'strategic_insights'
}

/**
 * Language pattern preferences
 */
export enum LanguagePattern {
  ACTION_ORIENTED = 'action_oriented',
  OUTCOME_FOCUSED = 'outcome_focused',
  PROCESS_DESCRIPTIVE = 'process_descriptive',
  BENEFIT_HIGHLIGHTING = 'benefit_highlighting',
  TECHNICAL_PRECISE = 'technical_precise',
  CONVERSATIONAL_FLOW = 'conversational_flow',
  BUSINESS_STRATEGIC = 'business_strategic'
}

/**
 * Emoji usage guidelines
 */
export enum EmojiUsage {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  ENTHUSIASTIC = 'enthusiastic'
}

/**
 * Response length guidelines
 */
export interface LengthGuideline {
  readonly minWords: number;
  readonly maxWords: number;
  readonly idealWords: number;
  readonly allowLongerForComplex: boolean;
}

/**
 * Tone adjustment for persona integration
 */
export interface ToneAdjustment {
  readonly fromTone: ResponseTone;
  readonly toTone: ResponseTone;
  readonly conditions: string[];
}

/**
 * Vocabulary preferences for persona integration
 */
export interface VocabularyPreference {
  readonly preferredTerms: string[];
  readonly avoidedTerms: string[];
  readonly context: string;
}

/**
 * Communication pattern for persona integration
 */
export interface CommunicationPattern {
  readonly pattern: string;
  readonly application: string;
  readonly examples: string[];
}

/**
 * Success response style variations
 */
export const SUCCESS_RESPONSE_STYLES: Record<ResponseStyleType, ResponsePattern> = {
  conversational: {
    tone: ResponseTone.CELEBRATORY,
    structure: ResponseStructure.ACHIEVEMENT_IMPACT,
    contentFocus: [
      ContentFocus.ACHIEVEMENT_CELEBRATION,
      ContentFocus.USER_EMPOWERMENT,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.OUTCOME_FOCUSED,
      LanguagePattern.BENEFIT_HIGHLIGHTING,
      LanguagePattern.CONVERSATIONAL_FLOW
    ],
    emojiUsage: EmojiUsage.MODERATE,
    lengthGuideline: {
      minWords: 30,
      maxWords: 150,
      idealWords: 75,
      allowLongerForComplex: true
    }
  },
  business: {
    tone: ResponseTone.PROFESSIONAL,
    structure: ResponseStructure.SUMMARY_FIRST,
    contentFocus: [
      ContentFocus.BUSINESS_IMPACT,
      ContentFocus.METRICS_PERFORMANCE,
      ContentFocus.STRATEGIC_INSIGHTS
    ],
    languagePatterns: [
      LanguagePattern.OUTCOME_FOCUSED,
      LanguagePattern.BUSINESS_STRATEGIC,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.MINIMAL,
    lengthGuideline: {
      minWords: 25,
      maxWords: 120,
      idealWords: 60,
      allowLongerForComplex: true
    }
  },
  technical: {
    tone: ResponseTone.ANALYTICAL,
    structure: ResponseStructure.TECHNICAL_ANALYSIS,
    contentFocus: [
      ContentFocus.TECHNICAL_DETAILS,
      ContentFocus.METRICS_PERFORMANCE,
      ContentFocus.PROBLEM_RESOLUTION
    ],
    languagePatterns: [
      LanguagePattern.TECHNICAL_PRECISE,
      LanguagePattern.PROCESS_DESCRIPTIVE,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.NONE,
    lengthGuideline: {
      minWords: 40,
      maxWords: 200,
      idealWords: 100,
      allowLongerForComplex: true
    }
  },
  casual: {
    tone: ResponseTone.ENTHUSIASTIC,
    structure: ResponseStructure.CHRONOLOGICAL,
    contentFocus: [
      ContentFocus.ACHIEVEMENT_CELEBRATION,
      ContentFocus.USER_EMPOWERMENT,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.CONVERSATIONAL_FLOW,
      LanguagePattern.BENEFIT_HIGHLIGHTING,
      LanguagePattern.OUTCOME_FOCUSED
    ],
    emojiUsage: EmojiUsage.ENTHUSIASTIC,
    lengthGuideline: {
      minWords: 20,
      maxWords: 100,
      idealWords: 50,
      allowLongerForComplex: false
    }
  }
};

/**
 * Partial success response style variations
 */
export const PARTIAL_SUCCESS_RESPONSE_STYLES: Record<ResponseStyleType, ResponsePattern> = {
  conversational: {
    tone: ResponseTone.ENCOURAGING,
    structure: ResponseStructure.ACHIEVEMENT_IMPACT,
    contentFocus: [
      ContentFocus.ACHIEVEMENT_CELEBRATION,
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.OUTCOME_FOCUSED,
      LanguagePattern.BENEFIT_HIGHLIGHTING,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.MODERATE,
    lengthGuideline: {
      minWords: 40,
      maxWords: 180,
      idealWords: 90,
      allowLongerForComplex: true
    }
  },
  business: {
    tone: ResponseTone.STRATEGIC,
    structure: ResponseStructure.CONTEXT_ACTION_RESULT,
    contentFocus: [
      ContentFocus.BUSINESS_IMPACT,
      ContentFocus.STRATEGIC_INSIGHTS,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.BUSINESS_STRATEGIC,
      LanguagePattern.ACTION_ORIENTED,
      LanguagePattern.OUTCOME_FOCUSED
    ],
    emojiUsage: EmojiUsage.MINIMAL,
    lengthGuideline: {
      minWords: 35,
      maxWords: 150,
      idealWords: 75,
      allowLongerForComplex: true
    }
  },
  technical: {
    tone: ResponseTone.ANALYTICAL,
    structure: ResponseStructure.PROBLEM_SOLUTION,
    contentFocus: [
      ContentFocus.TECHNICAL_DETAILS,
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.METRICS_PERFORMANCE
    ],
    languagePatterns: [
      LanguagePattern.TECHNICAL_PRECISE,
      LanguagePattern.PROCESS_DESCRIPTIVE,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.NONE,
    lengthGuideline: {
      minWords: 50,
      maxWords: 250,
      idealWords: 125,
      allowLongerForComplex: true
    }
  },
  casual: {
    tone: ResponseTone.SUPPORTIVE,
    structure: ResponseStructure.CHRONOLOGICAL,
    contentFocus: [
      ContentFocus.ACHIEVEMENT_CELEBRATION,
      ContentFocus.USER_EMPOWERMENT,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.CONVERSATIONAL_FLOW,
      LanguagePattern.BENEFIT_HIGHLIGHTING,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.MODERATE,
    lengthGuideline: {
      minWords: 25,
      maxWords: 120,
      idealWords: 60,
      allowLongerForComplex: false
    }
  }
};

/**
 * Error response style variations
 */
export const ERROR_RESPONSE_STYLES: Record<ResponseStyleType, ResponsePattern> = {
  conversational: {
    tone: ResponseTone.EMPATHETIC,
    structure: ResponseStructure.PROBLEM_SOLUTION,
    contentFocus: [
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.USER_EMPOWERMENT,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.ACTION_ORIENTED,
      LanguagePattern.CONVERSATIONAL_FLOW,
      LanguagePattern.BENEFIT_HIGHLIGHTING
    ],
    emojiUsage: EmojiUsage.MINIMAL,
    lengthGuideline: {
      minWords: 35,
      maxWords: 160,
      idealWords: 80,
      allowLongerForComplex: true
    }
  },
  business: {
    tone: ResponseTone.PROFESSIONAL,
    structure: ResponseStructure.CONTEXT_ACTION_RESULT,
    contentFocus: [
      ContentFocus.BUSINESS_IMPACT,
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.STRATEGIC_INSIGHTS
    ],
    languagePatterns: [
      LanguagePattern.BUSINESS_STRATEGIC,
      LanguagePattern.ACTION_ORIENTED,
      LanguagePattern.PROCESS_DESCRIPTIVE
    ],
    emojiUsage: EmojiUsage.NONE,
    lengthGuideline: {
      minWords: 30,
      maxWords: 140,
      idealWords: 70,
      allowLongerForComplex: true
    }
  },
  technical: {
    tone: ResponseTone.TECHNICAL,
    structure: ResponseStructure.TECHNICAL_ANALYSIS,
    contentFocus: [
      ContentFocus.TECHNICAL_DETAILS,
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.TECHNICAL_PRECISE,
      LanguagePattern.PROCESS_DESCRIPTIVE,
      LanguagePattern.ACTION_ORIENTED
    ],
    emojiUsage: EmojiUsage.NONE,
    lengthGuideline: {
      minWords: 45,
      maxWords: 220,
      idealWords: 110,
      allowLongerForComplex: true
    }
  },
  casual: {
    tone: ResponseTone.SUPPORTIVE,
    structure: ResponseStructure.PROBLEM_SOLUTION,
    contentFocus: [
      ContentFocus.PROBLEM_RESOLUTION,
      ContentFocus.USER_EMPOWERMENT,
      ContentFocus.NEXT_STEPS
    ],
    languagePatterns: [
      LanguagePattern.CONVERSATIONAL_FLOW,
      LanguagePattern.ACTION_ORIENTED,
      LanguagePattern.BENEFIT_HIGHLIGHTING
    ],
    emojiUsage: EmojiUsage.MINIMAL,
    lengthGuideline: {
      minWords: 20,
      maxWords: 100,
      idealWords: 50,
      allowLongerForComplex: false
    }
  }
};

/**
 * Response Style Variations Service
 */
export class ResponseStyleVariations {

  /**
   * Get response pattern based on execution result and style
   */
  static getResponsePattern(
    result: ToolExecutionResult,
    style: ResponseStyleType
  ): ResponsePattern {
    if (result.success) {
      return SUCCESS_RESPONSE_STYLES[style];
    } else if (result.data && result.error) {
      // Partial success: has some data but also an error
      return PARTIAL_SUCCESS_RESPONSE_STYLES[style];
    } else {
      return ERROR_RESPONSE_STYLES[style];
    }
  }

  /**
   * Adapt response pattern based on persona
   */
  static adaptForPersona(
    pattern: ResponsePattern,
    persona: PersonaInfo
  ): ResponsePattern {
    // Apply persona-specific tone adjustments
    let adaptedTone = pattern.tone;

    // Adjust tone based on persona communication style
    if (persona.communicationStyle) {
      adaptedTone = this.adjustToneForCommunicationStyle(
        pattern.tone,
        persona.communicationStyle
      );
    }

    // Adjust emoji usage based on persona personality
    let adaptedEmojiUsage = pattern.emojiUsage;
    if (persona.personality && this.isPersonalityFormal(persona.personality)) {
      adaptedEmojiUsage = this.reduceEmojiUsage(pattern.emojiUsage);
    }

    return {
      ...pattern,
      tone: adaptedTone,
      emojiUsage: adaptedEmojiUsage
    };
  }

  /**
   * Get content focus guidelines for context
   */
  static getContentFocusGuidelines(
    context: ToolResponseContext,
    pattern: ResponsePattern
  ): string[] {
    const guidelines: string[] = [];

    pattern.contentFocus.forEach(focus => {
      switch (focus) {
        case ContentFocus.ACHIEVEMENT_CELEBRATION:
          guidelines.push('Celebrate the successful completion and positive outcome');
          break;
        case ContentFocus.TECHNICAL_DETAILS:
          guidelines.push('Include relevant technical specifications and metrics');
          break;
        case ContentFocus.BUSINESS_IMPACT:
          guidelines.push('Emphasize business value and operational impact');
          break;
        case ContentFocus.USER_EMPOWERMENT:
          guidelines.push('Focus on user capability and empowerment');
          break;
        case ContentFocus.NEXT_STEPS:
          guidelines.push('Provide clear, actionable next step recommendations');
          break;
        case ContentFocus.PROBLEM_RESOLUTION:
          guidelines.push('Address the issue with solution-focused guidance');
          break;
        case ContentFocus.METRICS_PERFORMANCE:
          guidelines.push('Include relevant performance metrics and benchmarks');
          break;
        case ContentFocus.STRATEGIC_INSIGHTS:
          guidelines.push('Provide strategic context and business intelligence');
          break;
      }
    });

    return guidelines;
  }

  /**
   * Get language pattern instructions
   */
  static getLanguagePatternInstructions(pattern: ResponsePattern): string[] {
    const instructions: string[] = [];

    pattern.languagePatterns.forEach(languagePattern => {
      switch (languagePattern) {
        case LanguagePattern.ACTION_ORIENTED:
          instructions.push('Use active voice and action-oriented language');
          break;
        case LanguagePattern.OUTCOME_FOCUSED:
          instructions.push('Focus on results and outcomes achieved');
          break;
        case LanguagePattern.PROCESS_DESCRIPTIVE:
          instructions.push('Describe processes and methodologies clearly');
          break;
        case LanguagePattern.BENEFIT_HIGHLIGHTING:
          instructions.push('Highlight benefits and positive impacts');
          break;
        case LanguagePattern.TECHNICAL_PRECISE:
          instructions.push('Use precise technical terminology and specifications');
          break;
        case LanguagePattern.CONVERSATIONAL_FLOW:
          instructions.push('Maintain natural, conversational flow and rhythm');
          break;
        case LanguagePattern.BUSINESS_STRATEGIC:
          instructions.push('Use strategic business language and frameworks');
          break;
      }
    });

    return instructions;
  }

  /**
   * Adjust tone based on communication style
   */
  private static adjustToneForCommunicationStyle(
    baseTone: ResponseTone,
    communicationStyle: string
  ): ResponseTone {
    const style = communicationStyle.toLowerCase();

    if (style.includes('formal') || style.includes('professional')) {
      if (baseTone === ResponseTone.ENTHUSIASTIC) return ResponseTone.CONFIDENT;
      if (baseTone === ResponseTone.CELEBRATORY) return ResponseTone.PROFESSIONAL;
    }

    if (style.includes('casual') || style.includes('friendly')) {
      if (baseTone === ResponseTone.PROFESSIONAL) return ResponseTone.ENCOURAGING;
      if (baseTone === ResponseTone.TECHNICAL) return ResponseTone.ANALYTICAL;
    }

    return baseTone;
  }

  /**
   * Check if personality indicates formal communication
   */
  private static isPersonalityFormal(personality: string): boolean {
    const formalIndicators = ['professional', 'formal', 'serious', 'analytical', 'technical'];
    return formalIndicators.some(indicator =>
      personality.toLowerCase().includes(indicator)
    );
  }

  /**
   * Reduce emoji usage for formal personas
   */
  private static reduceEmojiUsage(emojiUsage: EmojiUsage): EmojiUsage {
    switch (emojiUsage) {
      case EmojiUsage.ENTHUSIASTIC:
        return EmojiUsage.MODERATE;
      case EmojiUsage.MODERATE:
        return EmojiUsage.MINIMAL;
      case EmojiUsage.MINIMAL:
        return EmojiUsage.NONE;
      default:
        return emojiUsage;
    }
  }
} 