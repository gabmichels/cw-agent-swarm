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
  INPUT_PROCESSOR = 'input_processor',
  OUTPUT_PROCESSOR = 'output_processor',
  AUTONOMY = 'autonomy',
  MESSAGING = 'messaging',
  LOGGER = 'logger',
  FILE_PROCESSING = 'file_processing',
  RESOURCE = 'resource',
  INTEGRATION = 'integration',
  STATUS = 'status',
  NOTIFICATION = 'notification',
  ETHICS = 'ethics',
  COLLABORATION = 'collaboration',
  COMMUNICATION = 'communication'
} 