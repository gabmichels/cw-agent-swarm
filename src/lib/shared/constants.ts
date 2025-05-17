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
  
  You have access to various tools and can use them to complete tasks.
  
  IMPORTANT TOOL USAGE GUIDELINES:
  - NEVER claim you have created or used a tool (like Coda documents, web searches, etc.) unless you have explicitly invoked the tool and received a result.
  - To use tools, you must follow this format:
    Thought: I need to [perform an action] because [reason]
    Action: [tool_name]
    Action Input: [parameters]
  - Only after receiving the tool output, mention the result in your response.
  - If you want to suggest using a tool, say "I can [action] for you if you'd like" instead of claiming you've already done it.
  - For document-related tasks (like creating Coda documents), explicitly say "I can create a document with this information" rather than claiming a document already exists.
  
  EXAMPLE OF PROPER TOOL USAGE:
  
  INCORRECT (claiming action without tool use):
  "I've created a Coda document with this information. You can access it at this link: [link]"
  
  CORRECT (offering the service):
  "I can create a Coda document with this information if you'd like."
  
  CORRECT (actually using the tool):
  Thought: I should create a Coda document with this marketing strategy
  Action: create_coda_doc
  Action Input: {"title": "Marketing Strategy 2024", "content": "# Marketing Strategy\n\n## Key Points\n..."}
  
  Then, after receiving the result:
  "I've created a Coda document titled 'Marketing Strategy 2024' with the information. You can access it at [actual link from tool result]."`,
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
export const DEFAULT_LLM_MODEL = process.env.OPENAI_MODEL_NAME || 'gpt-4.1';
export const CHEAP_LLM_MODEL = process.env.OPENAI_CHEAP_MODEL || 'gpt-4.1-nano-2025-04-14';

export const MEMORY_TYPES = {
  PERSONA: 'persona',
  KNOWLEDGE: 'knowledge',
  CONVERSATION: 'conversation',
};

/**
 * Task ID constants for scheduled tasks
 * Used to ensure consistency between frontend and backend
 */
export const TASK_IDS = {
  DAILY_BRIEFING: 'daily-briefing',
  DAILY_PLANNING: 'daily-planning', 
  WEEKLY_MARKETING_REVIEW: 'weekly-marketing-review',
  CONTENT_IDEA_GENERATION: 'content-idea-generation',
  MEMORY_CONSOLIDATION: 'memory-consolidation',
  MARKET_SCAN: 'market-scan',
  NEWS_SCAN: 'news-scan',
  TRENDING_TOPIC_RESEARCH: 'trending-topic-research',
  SOCIAL_MEDIA_TRENDS: 'social-media-trends',
  MONTHLY_STRATEGIC_PLANNING: 'monthly-strategic-planning',
  QUARTERLY_PERFORMANCE_REVIEW: 'quarterly-performance-review'
}; 