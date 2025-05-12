/**
 * memory.ts - Memory-related constants
 */

/**
 * Categories for memory types
 */
export enum MemoryTypeCategory {
  CORE = 'core',
  KNOWLEDGE = 'knowledge',
  DECISION = 'decision',
  AGENT_INTERACTION = 'agent',
  SYSTEM = 'system',
  VERSION_CONTROL = 'version_control',
  OTHER = 'other'
}

/**
 * Memory types
 */
export enum MemoryType {
  // Core memory types
  MESSAGE = 'message',           // General messages
  DOCUMENT = 'document',         // Document content
  THOUGHT = 'thought',          // Internal agent thoughts
  REFLECTION = 'reflection',     // Self-reflection
  INSIGHT = 'insight',          // Derived insights
  TASK = 'task',               // Task definitions

  // Knowledge and learning types (from legacy)
  FACT = 'fact',               // Verified factual information
  KNOWLEDGE = 'knowledge',      // Acquired knowledge
  SYSTEM_LEARNING = 'system_learning', // System-level learning
  IDEA = 'idea',              // Creative ideas or concepts
  SUMMARY = 'summary',         // Summarized information

  // Decision and feedback types (from legacy)
  DECISION = 'decision',        // Decision points and choices
  FEEDBACK = 'feedback',        // Feedback and evaluations
  CHAT = 'chat',              // Chat/conversation content

  // Agent interaction types
  AGENT_MESSAGE = 'agent_message',     // Direct messages between agents
  AGENT_REQUEST = 'agent_request',     // Formal requests between agents
  AGENT_RESPONSE = 'agent_response',   // Responses to agent requests
  AGENT_TASK = 'agent_task',          // Task assignments between agents
  AGENT_KNOWLEDGE = 'agent_knowledge', // Knowledge sharing between agents
  AGENT_COLLABORATION = 'agent_collaboration', // Collaborative work between agents

  // System types
  SYSTEM_EVENT = 'system_event',       // System-level events
  SYSTEM_COMMAND = 'system_command',   // System commands
  SYSTEM_STATUS = 'system_status',     // System status updates
  SYSTEM_ERROR = 'system_error',       // System errors

  // Version control types
  MEMORY_EDIT = 'memory_edit',

  // Fallback type for unclassified memories
  UNKNOWN = 'unknown'
}

// Helper type for memory type validation
export type MemoryTypeString = keyof typeof MemoryType;

// Helper function to check if a string is a valid memory type
export function isValidMemoryType(type: string): type is MemoryTypeString {
  return Object.values(MemoryType).includes(type as MemoryType);
}

// Helper function to get memory type category
export function getMemoryTypeCategory(type: MemoryType): MemoryTypeCategory {
  switch (type) {
    // Core types
    case MemoryType.MESSAGE:
    case MemoryType.DOCUMENT:
    case MemoryType.THOUGHT:
    case MemoryType.REFLECTION:
    case MemoryType.INSIGHT:
    case MemoryType.TASK:
      return MemoryTypeCategory.CORE;
      
    // Knowledge types
    case MemoryType.FACT:
    case MemoryType.KNOWLEDGE:
    case MemoryType.SYSTEM_LEARNING:
    case MemoryType.IDEA:
    case MemoryType.SUMMARY:
      return MemoryTypeCategory.KNOWLEDGE;
      
    // Decision types
    case MemoryType.DECISION:
    case MemoryType.FEEDBACK:
      return MemoryTypeCategory.DECISION;
      
    // Agent interaction types
    case MemoryType.AGENT_MESSAGE:
    case MemoryType.AGENT_REQUEST:
    case MemoryType.AGENT_RESPONSE:
    case MemoryType.AGENT_TASK:
    case MemoryType.AGENT_KNOWLEDGE:
    case MemoryType.AGENT_COLLABORATION:
      return MemoryTypeCategory.AGENT_INTERACTION;
      
    // System types
    case MemoryType.SYSTEM_EVENT:
    case MemoryType.SYSTEM_COMMAND:
    case MemoryType.SYSTEM_STATUS:
    case MemoryType.SYSTEM_ERROR:
      return MemoryTypeCategory.SYSTEM;
      
    // Version control types
    case MemoryType.MEMORY_EDIT:
      return MemoryTypeCategory.VERSION_CONTROL;
      
    // Fallback
    case MemoryType.UNKNOWN:
    default:
      return MemoryTypeCategory.OTHER;
  }
}

// Helper function to get memory type group for UI display
export function getMemoryTypeGroup(type: MemoryType): string {
  switch (type) {
    // Core types
    case MemoryType.MESSAGE:
    case MemoryType.DOCUMENT:
    case MemoryType.THOUGHT:
    case MemoryType.REFLECTION:
    case MemoryType.INSIGHT:
    case MemoryType.TASK:
      return 'Core Memories';
      
    // Knowledge types
    case MemoryType.FACT:
    case MemoryType.KNOWLEDGE:
    case MemoryType.SYSTEM_LEARNING:
    case MemoryType.IDEA:
    case MemoryType.SUMMARY:
      return 'Knowledge Base';
      
    // Decision types
    case MemoryType.DECISION:
    case MemoryType.FEEDBACK:
      return 'Decisions & Feedback';
      
    // Agent interaction types
    case MemoryType.AGENT_MESSAGE:
    case MemoryType.AGENT_REQUEST:
    case MemoryType.AGENT_RESPONSE:
    case MemoryType.AGENT_TASK:
    case MemoryType.AGENT_KNOWLEDGE:
    case MemoryType.AGENT_COLLABORATION:
      return 'Agent Interactions';
      
    // System types
    case MemoryType.SYSTEM_EVENT:
    case MemoryType.SYSTEM_COMMAND:
    case MemoryType.SYSTEM_STATUS:
    case MemoryType.SYSTEM_ERROR:
      return 'System Events';
      
    // Version control types
    case MemoryType.MEMORY_EDIT:
      return 'Version History';
      
    // Fallback
    case MemoryType.UNKNOWN:
    default:
      return 'Other';
  }
}

/**
 * Memory importance levels
 */
export enum ImportanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Memory sources
 */
export enum MemorySource {
  AGENT = 'agent',
  USER = 'user',
  SYSTEM = 'system',
  EXTERNAL = 'external'
} 