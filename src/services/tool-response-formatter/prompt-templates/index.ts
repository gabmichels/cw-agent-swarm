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

      successTemplate: `Tool operation completed successfully! Include:
- Clear summary of what was accomplished
- Practical value and benefits achieved
- Relevant details about the results
- Suggested next steps or follow-up actions
- Encouraging and supportive tone`,

      errorTemplate: `Tool operation encountered an issue. Provide:
- Clear explanation of what happened in accessible terms
- Suggested solutions or alternative approaches
- Reassurance and supportive guidance
- Practical next steps for resolution
- Encouraging tone focused on problem-solving`,

      partialSuccessTemplate: `Tool operation partially completed. Explain:
- What was successfully accomplished
- Value delivered and benefits achieved
- Outstanding items and what's needed to complete
- Clear next steps for full completion
- Supportive and encouraging tone`,

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

      successTemplate: `Operation completed successfully:
- Business outcome and operational impact achieved
- Key results and performance metrics delivered
- Strategic value and productivity improvements realized
- Recommended next steps for continued business success
- Professional confirmation of business objectives met`,

      errorTemplate: `Operation failed:
- Business impact assessment and operational considerations
- Root cause analysis and resolution approach
- Alternative strategies and business continuity measures
- Professional recommendations for issue resolution
- Strategic guidance for operational recovery`,

      partialSuccessTemplate: `Operation partially completed:
- Business value delivered and operational progress achieved
- Outstanding requirements and completion timeline
- Strategic recommendations for full business objective achievement
- Professional assessment of progress and business impact
- Next steps for complete operational success`,

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

      successTemplate: `Technical operation completed:
- System execution analysis and performance metrics
- Technical specifications and operational parameters achieved
- System reliability assessment and performance validation
- Technical insights and optimization recommendations
- Detailed technical confirmation of operation success`,

      errorTemplate: `Technical operation failed:
- System failure analysis and technical impact assessment
- Root cause identification and technical resolution requirements
- Alternative technical approaches and system recovery strategies
- Technical troubleshooting recommendations and system optimization
- Engineering solutions for technical reliability and system performance`,

      partialSuccessTemplate: `Technical operation partially completed:
- Successfully executed system components and technical achievements
- Outstanding technical requirements and system optimization opportunities
- Partial performance metrics and technical analysis results
- Technical considerations for complete system operation
- Engineering next steps for full technical implementation`,

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

      successTemplate: `Great job! Your task is all done! 🎉 Include:
- Celebration of what was accomplished
- User-friendly explanation of the results and benefits
- Cool next steps or awesome opportunities
- Encouraging and positive tone throughout
- Fun and supportive assessment of the achievement`,

      errorTemplate: `Oops, hit a little snag! 😅 Provide:
- Friendly explanation of what happened
- Easy fixes and alternative approaches
- Reassuring guidance and support
- Upbeat attitude about solving the issue
- Encouraging tone focused on getting things working`,

      partialSuccessTemplate: `Nice progress! We're getting there! 💪 Explain:
- Celebration of what got accomplished
- Friendly explanation of what's still needed
- Easy next steps to finish up
- Encouraging and supportive tone
- Positive assessment of progress and achievements`,

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

