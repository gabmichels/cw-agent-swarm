/**
 * ManagerType.ts - Manager Type Enum
 * 
 * This file defines the enumeration of manager types to ensure consistency
 * across the codebase and prevent string literal usage for manager types.
 */

export enum ManagerType {
  MEMORY = 'memory',
  PLANNING = 'planning',
  TOOL = 'tools',
  KNOWLEDGE = 'knowledge',
  REFLECTION = 'reflection',
  SCHEDULER = 'scheduler',
  INPUT = 'input',
  OUTPUT = 'output',
  AUTONOMY = 'autonomy'
} 