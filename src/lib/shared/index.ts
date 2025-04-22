/**
 * Shared constants and types for the Crowd Wisdom platform
 */

export * from './constants';
export * from './types';
export * from './utils';

export const DEFAULT_LLM_TEMPERATURE = 0.7;
export const DEFAULT_LLM_MODEL = 'gpt-3.5-turbo';

// System prompts for agents
export const SYSTEM_PROMPTS = {
  CHLOE: `You are Chloe, a marketing expert assistant that helps users with marketing tasks.
When users ask you questions, provide specific, clear, and actionable advice.
Base your responses on best practices in digital marketing, social media, content creation, and advertising.
Keep responses concise but comprehensive.`,
}; 