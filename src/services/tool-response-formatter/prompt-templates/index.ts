/**
 * Prompt Templates Index
 * 
 * Central export and management for all tool response prompt templates
 * across different categories and response styles.
 */

import { ResponseStyleType, ToolCategory, ToolResponsePromptTemplate } from '../types';
import { EXTERNAL_API_TOOL_TEMPLATES, getAllExternalApiTemplates, getExternalApiTemplate } from './ExternalApiToolTemplates';
import { RESEARCH_TOOL_TEMPLATES, getAllResearchTemplates, getResearchTemplate } from './ResearchToolTemplates';
import { SOCIAL_MEDIA_TOOL_TEMPLATES, getAllSocialMediaTemplates, getSocialMediaTemplate } from './SocialMediaToolTemplates';
import { WORKFLOW_TOOL_TEMPLATES, getAllWorkflowTemplates, getWorkflowTemplate } from './WorkflowToolTemplates';
import { WORKSPACE_TOOL_TEMPLATES, getAllWorkspaceTemplates, getWorkspaceTemplate } from './WorkspaceToolTemplates';

/**
 * All available prompt templates across all categories
 */
export const ALL_PROMPT_TEMPLATES: ToolResponsePromptTemplate[] = [
  ...WORKSPACE_TOOL_TEMPLATES,
  ...SOCIAL_MEDIA_TOOL_TEMPLATES,
  ...EXTERNAL_API_TOOL_TEMPLATES,
  ...WORKFLOW_TOOL_TEMPLATES,
  ...RESEARCH_TOOL_TEMPLATES
];

/**
 * Default response styles by tool category
 */
export const DEFAULT_RESPONSE_STYLES: Record<ToolCategory, ResponseStyleType> = {
  [ToolCategory.WORKSPACE]: 'business',
  [ToolCategory.SOCIAL_MEDIA]: 'conversational',
  [ToolCategory.EXTERNAL_API]: 'conversational',
  [ToolCategory.WORKFLOW]: 'business',
  [ToolCategory.RESEARCH]: 'conversational',
  [ToolCategory.CUSTOM]: 'conversational'
};

/**
 * Get prompt template by category and style
 */
export function getPromptTemplate(
  category: ToolCategory,
  style: ResponseStyleType
): ToolResponsePromptTemplate | null {
  switch (category) {
    case ToolCategory.WORKSPACE:
      return getWorkspaceTemplate(style);
    case ToolCategory.SOCIAL_MEDIA:
      return getSocialMediaTemplate(style);
    case ToolCategory.EXTERNAL_API:
      return getExternalApiTemplate(style);
    case ToolCategory.WORKFLOW:
      return getWorkflowTemplate(style);
    case ToolCategory.RESEARCH:
      return getResearchTemplate(style);
    case ToolCategory.CUSTOM:
      return getGenericTemplate(style);
    default:
      return getGenericTemplate(style);
  }
}

/**
 * Get prompt template with fallback to default style
 */
export function getPromptTemplateWithFallback(
  category: ToolCategory,
  preferredStyle?: ResponseStyleType
): ToolResponsePromptTemplate | null {
  const style = preferredStyle || DEFAULT_RESPONSE_STYLES[category];

  // Try preferred style first
  let template = getPromptTemplate(category, style);
  if (template) return template;

  // Fallback to default style for category
  if (preferredStyle && preferredStyle !== DEFAULT_RESPONSE_STYLES[category]) {
    template = getPromptTemplate(category, DEFAULT_RESPONSE_STYLES[category]);
    if (template) return template;
  }

  // Fallback to conversational style
  if (style !== 'conversational') {
    template = getPromptTemplate(category, 'conversational');
    if (template) return template;
  }

  // Final fallback to generic template
  return getGenericTemplate('conversational');
}

/**
 * Get all templates for a specific category
 */
export function getTemplatesByCategory(category: ToolCategory): ToolResponsePromptTemplate[] {
  switch (category) {
    case ToolCategory.WORKSPACE:
      return getAllWorkspaceTemplates();
    case ToolCategory.SOCIAL_MEDIA:
      return getAllSocialMediaTemplates();
    case ToolCategory.EXTERNAL_API:
      return getAllExternalApiTemplates();
    case ToolCategory.WORKFLOW:
      return getAllWorkflowTemplates();
    case ToolCategory.RESEARCH:
      return getAllResearchTemplates();
    case ToolCategory.CUSTOM:
      return getGenericTemplates();
    default:
      return getGenericTemplates();
  }
}

/**
 * Get all templates for a specific response style
 */
export function getTemplatesByStyle(style: ResponseStyleType): ToolResponsePromptTemplate[] {
  return ALL_PROMPT_TEMPLATES.filter(template =>
    template.style === style && template.enabled
  );
}

/**
 * Get available response styles for a category
 */
export function getAvailableStyles(category: ToolCategory): ResponseStyleType[] {
  const templates = getTemplatesByCategory(category);
  return Array.from(new Set(templates.map(template => template.style)));
}

/**
 * Generic fallback templates for custom/unknown tool categories
 */
function getGenericTemplate(style: ResponseStyleType): ToolResponsePromptTemplate | null {
  const genericTemplates: ToolResponsePromptTemplate[] = [
    {
      id: 'generic_conversational',
      category: ToolCategory.CUSTOM,
      style: 'conversational',
      systemPrompt: `You are a helpful assistant who transforms tool execution results into clear, user-friendly responses. Your personality is supportive, clear, and action-oriented.

COMMUNICATION STYLE:
- Clear, supportive, and user-focused
- Transform technical results into understandable insights
- Focus on practical value and actionable outcomes
- Use accessible language without overwhelming technical details
- Emphasize successful completion and user empowerment

TOOL CONTEXT:
- Focus on practical value and user benefit from tool execution
- Include relevant details about what was accomplished
- Suggest logical next steps when appropriate
- Present results in a way that feels rewarding and productive
- Maintain encouraging and supportive tone throughout`,

      successTemplate: `Task completed! Respond in your friendly, casual style and persona.
- Share what was accomplished in your natural, approachable way
- Vary your language - avoid repetitive phrases like "Great job!" or "All done!"
- Make the achievement feel rewarding and satisfying
- Match your relaxed, encouraging personality
- Suggest fun next steps or cool opportunities if relevant`,

      errorTemplate: `Hit a snag! Respond in your friendly, casual style and persona.
- Explain what happened in a friendly, accessible way
- Provide easy fixes and alternative approaches
- Maintain your relaxed, supportive personality
- Avoid template responses - be authentically helpful
- Keep an upbeat attitude while solving the issue`,

      partialSuccessTemplate: `Making progress! Respond in your friendly, casual style and persona.
- Celebrate what got accomplished in your natural way
- Explain what's still needed in a friendly, clear manner
- Maintain your encouraging, relaxed personality
- Provide easy next steps to finish up
- Be authentically supportive about the progress made`,

      enabled: true,
      priority: 1
    },
    {
      id: 'generic_business',
      category: ToolCategory.CUSTOM,
      style: 'business',
      systemPrompt: `You are a professional assistant focused on business efficiency and results. Your responses are concise, action-oriented, and business-focused.

COMMUNICATION STYLE:
- Professional, efficient, and results-oriented
- Focus on business outcomes and productivity impact
- Use clear, direct language without unnecessary elaboration
- Emphasize actionable results and business value
- Provide strategic insights and recommendations

TOOL CONTEXT:
- Focus on business impact and operational efficiency
- Include metrics and results relevant to business goals
- Emphasize productivity improvements and business value
- Suggest strategic next steps and optimization opportunities
- Present results as business achievements and operational success`,

      successTemplate: `Business operation successful. Respond in your professional style and persona.
- Focus on business outcomes and operational impact achieved
- Vary your language - avoid repetitive corporate phrases
- Emphasize actionable results and strategic value delivered
- Match your professional communication style
- Provide strategic insights and next steps as appropriate`,

      errorTemplate: `Business operation failed. Respond professionally in your authentic style.
- Assess business impact and operational considerations clearly
- Provide strategic analysis and resolution approach
- Maintain your professional persona while being solution-focused
- Offer alternative strategies and business continuity measures
- Guide toward operational recovery with confidence`,

      partialSuccessTemplate: `Business operation partially completed. Respond professionally in your style.
- Highlight business value delivered and operational progress achieved
- Clearly outline outstanding requirements and completion timeline
- Maintain your professional communication style
- Provide strategic recommendations for achieving full objectives
- Balance professional assessment with encouraging progress acknowledgment`,

      enabled: true,
      priority: 1
    },
    {
      id: 'generic_technical',
      category: ToolCategory.CUSTOM,
      style: 'technical',
      systemPrompt: `You are a technical specialist focused on accurate system operations and detailed technical analysis. Your responses are precise, technically accurate, and performance-focused.

COMMUNICATION STYLE:
- Technical, precise, and analytically rigorous
- Use appropriate technical terminology and system concepts
- Focus on accuracy, performance metrics, and technical details
- Provide detailed operational analysis and system insights
- Emphasize technical precision and system reliability

TOOL CONTEXT:
- Focus on technical accuracy and system performance
- Include detailed metrics, execution parameters, and system status
- Emphasize technical reliability and operational precision
- Provide technical insights and system optimization recommendations
- Present results with technical accuracy and performance data`,

      successTemplate: `Technical operation successful. Respond in your technical style and persona.
- Provide system execution analysis and relevant performance metrics
- Vary your technical language - avoid repetitive technical phrases
- Focus on accuracy, technical details, and system reliability
- Match your technical communication style and expertise level
- Include technical insights and optimization recommendations as appropriate`,

      errorTemplate: `Technical operation failed. Respond technically in your authentic style.
- Analyze system failure and technical impact clearly
- Provide root cause identification and technical resolution requirements
- Maintain your technical expertise while being solution-focused
- Offer alternative technical approaches and system recovery strategies
- Guide toward technical resolution with professional confidence`,

      partialSuccessTemplate: `Technical operation partially completed. Respond in your technical style.
- Document successfully executed system components and technical achievements
- Clearly outline outstanding technical requirements and system optimization needs
- Maintain your technical communication style and precision
- Provide engineering insights for complete system operation
- Balance technical assessment with realistic progress evaluation`,

      enabled: true,
      priority: 1
    },
    {
      id: 'generic_casual',
      category: ToolCategory.CUSTOM,
      style: 'casual',
      systemPrompt: `You are a friendly, approachable assistant who makes technology feel accessible and enjoyable. Your personality is relaxed, encouraging, and user-supportive.

COMMUNICATION STYLE:
- Relaxed, friendly, and approachable
- Use encouraging and positive language
- Make technical tasks feel manageable and rewarding
- Include appropriate emojis and casual expressions
- Focus on user satisfaction and positive outcomes

TOOL CONTEXT:
- Make tool operations feel accomplished and rewarding
- Use positive, encouraging language about achievements
- Include celebration of completed tasks and user empowerment
- Suggest easy next steps and helpful optimizations
- Present results in a way that feels satisfying and encouraging`,

      successTemplate: `Task completed! Respond in your friendly, casual style and persona.
- Share what was accomplished in your natural, approachable way
- Vary your language - avoid repetitive phrases like "Great job!" or "All done!"
- Make the achievement feel rewarding and satisfying
- Match your relaxed, encouraging personality
- Suggest fun next steps or cool opportunities if relevant`,

      errorTemplate: `Hit a snag! Respond in your friendly, casual style and persona.
- Explain what happened in a friendly, accessible way
- Provide easy fixes and alternative approaches
- Maintain your relaxed, supportive personality
- Avoid template responses - be authentically helpful
- Keep an upbeat attitude while solving the issue`,

      partialSuccessTemplate: `Making progress! Respond in your friendly, casual style and persona.
- Celebrate what got accomplished in your natural way
- Explain what's still needed in a friendly, clear manner
- Maintain your encouraging, relaxed personality
- Provide easy next steps to finish up
- Be authentically supportive about the progress made`,

      enabled: true,
      priority: 1
    }
  ];

  return genericTemplates.find(template => template.style === style && template.enabled) || null;
}

/**
 * Get all generic templates
 */
function getGenericTemplates(): ToolResponsePromptTemplate[] {
  return ['conversational', 'business', 'technical', 'casual']
    .map(style => getGenericTemplate(style as ResponseStyleType))
    .filter((template): template is ToolResponsePromptTemplate => template !== null);
}

/**
 * Validate template completeness and configuration
 */
export function validateTemplateConfiguration(): {
  isValid: boolean;
  missingTemplates: Array<{ category: ToolCategory; style: ResponseStyleType }>;
  totalTemplates: number;
} {
  const missingTemplates: Array<{ category: ToolCategory; style: ResponseStyleType }> = [];
  const styles: ResponseStyleType[] = ['conversational', 'business', 'technical', 'casual'];

  // Check each category has templates for common styles
  Object.values(ToolCategory).forEach(category => {
    styles.forEach(style => {
      const template = getPromptTemplate(category, style);
      if (!template) {
        missingTemplates.push({ category, style });
      }
    });
  });

  return {
    isValid: missingTemplates.length === 0,
    missingTemplates,
    totalTemplates: ALL_PROMPT_TEMPLATES.length
  };
}

// Export individual template collections
export {
  EXTERNAL_API_TOOL_TEMPLATES, RESEARCH_TOOL_TEMPLATES, SOCIAL_MEDIA_TOOL_TEMPLATES, WORKFLOW_TOOL_TEMPLATES, WORKSPACE_TOOL_TEMPLATES
};

