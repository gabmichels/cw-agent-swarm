/**
 * Persona Integration Service
 * 
 * Integrates PersonaInfo (background, personality, communicationStyle) into prompt
 * templates with tone adaptation, capability context, and user preference integration.
 */

import { PersonaInfo } from '../../agents/shared/messaging/PromptFormatter';
import { ResponseTone } from './ResponseStyleVariations';
import { ToolCategory, ToolResponseContext } from './types';

/**
 * Persona integration configuration
 */
export interface PersonaIntegrationConfig {
  readonly enablePersonaAdaptation: boolean;
  readonly enableToneAdjustment: boolean;
  readonly enableCapabilityContext: boolean;
  readonly enableCommunicationStyleOverride: boolean;
  readonly preferenceWeight: number; // 0-1, how much to weight user preferences
}

/**
 * Persona tone mapping for different personalities
 */
export interface PersonaToneMapping {
  readonly personalityKeywords: string[];
  readonly preferredTones: ResponseTone[];
  readonly avoidedTones: ResponseTone[];
  readonly toneAdjustments: Record<ResponseTone, ResponseTone>;
}

/**
 * Communication style adaptations
 */
export interface CommunicationStyleAdaptation {
  readonly style: string;
  readonly tonePreferences: ResponseTone[];
  readonly languagePatterns: string[];
  readonly structuralPreferences: string[];
  readonly emojiPreference: 'increase' | 'decrease' | 'maintain';
}

/**
 * Capability context integration
 */
export interface CapabilityContext {
  readonly capabilityCategories: string[];
  readonly relevantCapabilities: string[];
  readonly suggestedNextActions: string[];
  readonly contextualRecommendations: string[];
}

/**
 * Default persona tone mappings
 */
export const PERSONA_TONE_MAPPINGS: PersonaToneMapping[] = [
  {
    personalityKeywords: ['professional', 'formal', 'business', 'executive'],
    preferredTones: [ResponseTone.PROFESSIONAL, ResponseTone.CONFIDENT, ResponseTone.STRATEGIC],
    avoidedTones: [ResponseTone.ENTHUSIASTIC],
    toneAdjustments: {
      [ResponseTone.ENTHUSIASTIC]: ResponseTone.CONFIDENT,
      [ResponseTone.CELEBRATORY]: ResponseTone.PROFESSIONAL,
      [ResponseTone.EMPATHETIC]: ResponseTone.SUPPORTIVE,
      [ResponseTone.PROFESSIONAL]: ResponseTone.PROFESSIONAL,
      [ResponseTone.ENCOURAGING]: ResponseTone.CONFIDENT,
      [ResponseTone.ANALYTICAL]: ResponseTone.PROFESSIONAL,
      [ResponseTone.SUPPORTIVE]: ResponseTone.PROFESSIONAL,
      [ResponseTone.CONFIDENT]: ResponseTone.CONFIDENT,
      [ResponseTone.STRATEGIC]: ResponseTone.STRATEGIC,
      [ResponseTone.TECHNICAL]: ResponseTone.PROFESSIONAL
    }
  },
  {
    personalityKeywords: ['friendly', 'casual', 'approachable', 'warm'],
    preferredTones: [ResponseTone.ENCOURAGING, ResponseTone.ENTHUSIASTIC, ResponseTone.SUPPORTIVE],
    avoidedTones: [ResponseTone.TECHNICAL, ResponseTone.ANALYTICAL],
    toneAdjustments: {} as Record<ResponseTone, ResponseTone>
  },
  {
    personalityKeywords: ['technical', 'analytical', 'precise', 'detailed'],
    preferredTones: [ResponseTone.ANALYTICAL, ResponseTone.TECHNICAL, ResponseTone.CONFIDENT],
    avoidedTones: [ResponseTone.ENTHUSIASTIC, ResponseTone.CELEBRATORY],
    toneAdjustments: {} as Record<ResponseTone, ResponseTone>
  },
  {
    personalityKeywords: ['creative', 'innovative', 'artistic', 'imaginative'],
    preferredTones: [ResponseTone.ENTHUSIASTIC, ResponseTone.ENCOURAGING, ResponseTone.CELEBRATORY],
    avoidedTones: [ResponseTone.TECHNICAL, ResponseTone.ANALYTICAL],
    toneAdjustments: {} as Record<ResponseTone, ResponseTone>
  },
  {
    personalityKeywords: ['strategic', 'leadership', 'visionary', 'executive'],
    preferredTones: [ResponseTone.STRATEGIC, ResponseTone.CONFIDENT, ResponseTone.PROFESSIONAL],
    avoidedTones: [ResponseTone.EMPATHETIC, ResponseTone.SUPPORTIVE],
    toneAdjustments: {} as Record<ResponseTone, ResponseTone>
  }
];

/**
 * Communication style adaptations
 */
export const COMMUNICATION_STYLE_ADAPTATIONS: CommunicationStyleAdaptation[] = [
  {
    style: 'direct',
    tonePreferences: [ResponseTone.CONFIDENT, ResponseTone.PROFESSIONAL],
    languagePatterns: ['concise sentences', 'clear action items', 'minimal elaboration'],
    structuralPreferences: ['summary first', 'bullet points', 'numbered steps'],
    emojiPreference: 'decrease'
  },
  {
    style: 'collaborative',
    tonePreferences: [ResponseTone.ENCOURAGING, ResponseTone.SUPPORTIVE],
    languagePatterns: ['inclusive language', 'team-oriented', 'shared achievements'],
    structuralPreferences: ['collaborative framing', 'shared outcomes', 'team impact'],
    emojiPreference: 'maintain'
  },
  {
    style: 'detailed',
    tonePreferences: [ResponseTone.ANALYTICAL, ResponseTone.TECHNICAL],
    languagePatterns: ['comprehensive explanations', 'methodology descriptions', 'context provision'],
    structuralPreferences: ['detailed breakdown', 'step-by-step process', 'thorough analysis'],
    emojiPreference: 'decrease'
  },
  {
    style: 'enthusiastic',
    tonePreferences: [ResponseTone.ENTHUSIASTIC, ResponseTone.CELEBRATORY],
    languagePatterns: ['positive reinforcement', 'achievement celebration', 'energy expression'],
    structuralPreferences: ['achievement highlights', 'positive framing', 'momentum building'],
    emojiPreference: 'increase'
  },
  {
    style: 'empathetic',
    tonePreferences: [ResponseTone.EMPATHETIC, ResponseTone.SUPPORTIVE],
    languagePatterns: ['understanding acknowledgment', 'supportive guidance', 'reassurance'],
    structuralPreferences: ['empathy first', 'supportive context', 'gentle guidance'],
    emojiPreference: 'maintain'
  }
];

/**
 * Persona Integration Service
 */
export class PersonaIntegration {

  /**
   * Build persona-integrated system prompt
   */
  static buildPersonaIntegratedPrompt(
    baseSystemPrompt: string,
    context: ToolResponseContext,
    config: PersonaIntegrationConfig
  ): string {
    if (!config.enablePersonaAdaptation) {
      return baseSystemPrompt;
    }

    const persona = context.agentPersona;
    const personaInstructions = this.generatePersonaInstructions(persona, context, config);
    const capabilityContext = this.generateCapabilityContext(context.agentCapabilities, context.toolCategory);
    const communicationGuidance = this.generateCommunicationGuidance(persona, context, config);

    return `${baseSystemPrompt}

PERSONA INTEGRATION:
${personaInstructions}

AGENT CAPABILITIES CONTEXT:
${capabilityContext}

COMMUNICATION ADAPTATION:
${communicationGuidance}

Remember to maintain character consistency while adapting to the specific tool execution context and user preferences.`;
  }

  /**
   * Adapt response tone based on persona
   */
  static adaptToneForPersona(
    baseTone: ResponseTone,
    persona: PersonaInfo,
    config: PersonaIntegrationConfig
  ): ResponseTone {
    if (!config.enableToneAdjustment) {
      return baseTone;
    }

    // Find matching persona tone mapping
    const mapping = this.findPersonaToneMapping(persona);
    if (mapping?.toneAdjustments[baseTone]) {
      return mapping.toneAdjustments[baseTone];
    }

    // Check communication style adaptations
    if (persona.communicationStyle) {
      const styleAdaptation = this.findCommunicationStyleAdaptation(persona.communicationStyle);
      if (styleAdaptation && !styleAdaptation.tonePreferences.includes(baseTone)) {
        return styleAdaptation.tonePreferences[0] || baseTone;
      }
    }

    return baseTone;
  }

  /**
   * Generate persona-specific instructions
   */
  private static generatePersonaInstructions(
    persona: PersonaInfo,
    context: ToolResponseContext,
    config: PersonaIntegrationConfig
  ): string {
    const instructions: string[] = [];

    // Background integration
    if (persona.background) {
      instructions.push(`- Draw upon your background as ${persona.background} to provide contextually relevant responses`);
    }

    // Personality integration
    if (persona.personality) {
      const personalityGuidance = this.generatePersonalityGuidance(persona.personality);
      instructions.push(`- Reflect your personality: ${personalityGuidance}`);
    }

    // Background-specific guidance
    if (persona.background) {
      instructions.push(`- Draw from your background: ${persona.background}`);
    }

    // Communication style integration
    if (persona.communicationStyle && config.enableCommunicationStyleOverride) {
      const styleGuidance = this.generateCommunicationStyleGuidance(persona.communicationStyle);
      instructions.push(`- Adapt communication style: ${styleGuidance}`);
    }

    return instructions.length > 0 ? instructions.join('\n') : '- Maintain authentic character voice throughout the response';
  }

  /**
   * Generate capability context for relevant suggestions
   */
  private static generateCapabilityContext(
    capabilities: readonly string[],
    toolCategory: ToolCategory
  ): string {
    if (!capabilities || capabilities.length === 0) {
      return '- No specific agent capabilities available for context';
    }

    // Filter capabilities relevant to the tool category
    const relevantCapabilities = this.filterRelevantCapabilities(capabilities, toolCategory);

    if (relevantCapabilities.length === 0) {
      return `- Agent has ${capabilities.length} capabilities, though none directly related to ${toolCategory} tools`;
    }

    const contextLines: string[] = [
      `- Agent capabilities relevant to ${toolCategory} operations: ${relevantCapabilities.join(', ')}`,
      '- Suggest logical next steps that leverage these capabilities when appropriate',
      '- Mention complementary capabilities that could enhance the user\'s workflow'
    ];

    return contextLines.join('\n');
  }

  /**
   * Generate communication adaptation guidance
   */
  private static generateCommunicationGuidance(
    persona: PersonaInfo,
    context: ToolResponseContext,
    config: PersonaIntegrationConfig
  ): string {
    const guidance: string[] = [];

    // User preference integration
    if (context.userPreferences) {
      const userGuidance = this.generateUserPreferenceGuidance(context.userPreferences);
      if (userGuidance) {
        guidance.push(`- User preferences: ${userGuidance}`);
      }
    }

    // Persona-based communication adaptations
    if (persona.communicationStyle) {
      const styleAdaptation = this.findCommunicationStyleAdaptation(persona.communicationStyle);
      if (styleAdaptation) {
        guidance.push(`- Language patterns: ${styleAdaptation.languagePatterns.join(', ')}`);
        guidance.push(`- Structural preferences: ${styleAdaptation.structuralPreferences.join(', ')}`);
      }
    }

    // Conversation history context
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      guidance.push('- Maintain consistency with recent conversation tone and topics');
      guidance.push('- Reference previous interactions when relevant to current tool operation');
    }

    return guidance.length > 0 ? guidance.join('\n') : '- Use standard communication patterns for the response style';
  }

  /**
   * Generate personality-specific guidance
   */
  private static generatePersonalityGuidance(personality: string): string {
    const personalityLower = personality.toLowerCase();

    if (personalityLower.includes('professional') || personalityLower.includes('formal')) {
      return 'professional, polished, and business-focused demeanor';
    }
    if (personalityLower.includes('friendly') || personalityLower.includes('warm')) {
      return 'warm, approachable, and personally engaging manner';
    }
    if (personalityLower.includes('technical') || personalityLower.includes('analytical')) {
      return 'precise, detail-oriented, and analytically rigorous approach';
    }
    if (personalityLower.includes('creative') || personalityLower.includes('innovative')) {
      return 'creative, innovative, and imaginatively expressive style';
    }
    if (personalityLower.includes('strategic') || personalityLower.includes('visionary')) {
      return 'strategic, forward-thinking, and big-picture oriented perspective';
    }

    return `${personality} characteristics while maintaining authenticity`;
  }

  /**
   * Generate communication style guidance
   */
  private static generateCommunicationStyleGuidance(communicationStyle: string): string {
    const style = communicationStyle.toLowerCase();

    if (style.includes('direct') || style.includes('concise')) {
      return 'clear, direct, and concise communication without unnecessary elaboration';
    }
    if (style.includes('collaborative') || style.includes('team')) {
      return 'collaborative, inclusive, and team-oriented language';
    }
    if (style.includes('detailed') || style.includes('thorough')) {
      return 'comprehensive, detailed, and thoroughly explanatory approach';
    }
    if (style.includes('enthusiastic') || style.includes('energetic')) {
      return 'enthusiastic, energetic, and motivationally positive tone';
    }
    if (style.includes('empathetic') || style.includes('supportive')) {
      return 'empathetic, supportive, and emotionally intelligent communication';
    }

    return `${communicationStyle} communication patterns`;
  }

  /**
   * Generate user preference guidance
   */
  private static generateUserPreferenceGuidance(userPreferences: any): string | null {
    const preferences: string[] = [];

    if (userPreferences.preferredTone) {
      preferences.push(`tone: ${userPreferences.preferredTone}`);
    }
    if (userPreferences.maxMessageLength) {
      preferences.push(`keep under ${userPreferences.maxMessageLength} characters`);
    }
    if (userPreferences.enableEmojis !== undefined) {
      preferences.push(userPreferences.enableEmojis ? 'include emojis' : 'avoid emojis');
    }
    if (userPreferences.includeMetrics !== undefined) {
      preferences.push(userPreferences.includeMetrics ? 'include metrics' : 'focus on outcomes over metrics');
    }
    if (userPreferences.communicationStyle) {
      preferences.push(`style: ${userPreferences.communicationStyle}`);
    }

    return preferences.length > 0 ? preferences.join(', ') : null;
  }

  /**
   * Find persona tone mapping
   */
  private static findPersonaToneMapping(persona: PersonaInfo): PersonaToneMapping | null {
    if (!persona.personality) return null;

    const personalityLower = persona.personality.toLowerCase();

    return PERSONA_TONE_MAPPINGS.find(mapping =>
      mapping.personalityKeywords.some(keyword =>
        personalityLower.includes(keyword)
      )
    ) || null;
  }

  /**
   * Find communication style adaptation
   */
  private static findCommunicationStyleAdaptation(communicationStyle: string): CommunicationStyleAdaptation | null {
    const styleLower = communicationStyle.toLowerCase();

    return COMMUNICATION_STYLE_ADAPTATIONS.find(adaptation =>
      styleLower.includes(adaptation.style) ||
      adaptation.style.includes(styleLower)
    ) || null;
  }

  /**
   * Filter capabilities relevant to tool category
   */
  private static filterRelevantCapabilities(
    capabilities: readonly string[],
    toolCategory: ToolCategory
  ): string[] {
    const categoryKeywords: Record<ToolCategory, string[]> = {
      [ToolCategory.WORKSPACE]: ['email', 'calendar', 'drive', 'document', 'spreadsheet', 'office'],
      [ToolCategory.SOCIAL_MEDIA]: ['twitter', 'linkedin', 'instagram', 'social', 'post', 'content'],
      [ToolCategory.EXTERNAL_API]: ['api', 'web', 'scraping', 'data', 'integration', 'external'],
      [ToolCategory.WORKFLOW]: ['automation', 'workflow', 'n8n', 'zapier', 'integration', 'process'],
      [ToolCategory.RESEARCH]: ['research', 'analysis', 'market', 'competitive', 'data', 'insights'],
      [ToolCategory.CUSTOM]: [] // No specific filtering for custom tools
    };

    const keywords = categoryKeywords[toolCategory] || [];
    if (keywords.length === 0) return [...capabilities];

    return capabilities.filter(capability =>
      keywords.some(keyword =>
        capability.toLowerCase().includes(keyword)
      )
    );
  }

  /**
   * Validate persona integration configuration
   */
  static validatePersonaIntegration(persona: PersonaInfo): {
    isValid: boolean;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!persona.personality) {
      warnings.push('No personality defined - responses may lack character consistency');
      suggestions.push('Add personality description for better response adaptation');
    }

    if (!persona.communicationStyle) {
      warnings.push('No communication style defined - tone adaptation will be limited');
      suggestions.push('Define communication style for optimal response tone');
    }

    if (!persona.background) {
      suggestions.push('Consider adding background for more contextual responses');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      suggestions
    };
  }
} 