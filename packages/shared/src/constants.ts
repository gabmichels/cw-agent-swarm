/**
 * App constants
 */

export const APP_NAME = 'Crowd Wisdom Employees';
export const APP_VERSION = '0.1.0';

// Agent names
export const AGENT_NAMES = {
  CHLOE: 'chloe',
};

// LLM providers
export const LLM_PROVIDERS = {
  OPENROUTER: 'openrouter',
  OPENAI: 'openai',
};

// Default system prompts
export const SYSTEM_PROMPTS = {
  CHLOE: `You are Chloe, an autonomous AI assistant with the following capabilities:
  1. You can search the web for information
  2. You can store and recall memories
  3. You can reflect on your past actions and improve
  4. You can perform autonomous tasks and workflows
  
  Your goal is to be helpful, informative, and assist with tasks. You maintain a friendly and professional tone.
  When you don't know something, you will acknowledge it and try to find the information.
  
  You have access to various tools and can use them to complete tasks.`,
};

// Memory collection names
export const COLLECTIONS = {
  MAIN_MEMORY: 'main_memory',
  REFLECTION: 'reflections',
  TASKS: 'tasks',
};

// Common date formats
export const DATE_FORMATS = {
  ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'',
  HUMAN_READABLE: 'MMMM d, yyyy h:mm a',
  SHORT: 'yyyy-MM-dd',
};

// Task statuses
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

// Task priorities
export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

// Tool names
export const TOOL_NAMES = {
  WEB_SEARCH: 'web_search',
  MEMORY_SEARCH: 'memory_search',
  TASK_MANAGER: 'task_manager',
  REFLECTION: 'reflection',
};

// API routes
export const API_ROUTES = {
  CHAT: '/api/chat',
  MEMORY: '/api/memory',
  TASKS: '/api/tasks',
  AGENTS: '/api/agents',
  REFLECTIONS: '/api/reflections',
};

export const DEFAULT_LLM_TEMPERATURE = 0.7;

export const MEMORY_TYPES = {
  PERSONA: 'persona',
  KNOWLEDGE: 'knowledge',
  CONVERSATION: 'conversation',
}; 