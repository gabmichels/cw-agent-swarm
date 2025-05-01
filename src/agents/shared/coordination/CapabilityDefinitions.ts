/**
 * CapabilityDefinitions.ts - Predefined capability definitions for the agent system
 * 
 * This module provides standard capability definitions that can be used
 * across different agents to ensure consistent capability declaration.
 */

import { Capability, CapabilityType, CapabilityLevel } from './CapabilityRegistry';

/**
 * Agent skill capabilities
 */
export const SkillCapabilities: Capability[] = [
  {
    id: 'skill.research',
    name: 'Research',
    type: CapabilityType.SKILL,
    description: 'Ability to search for and synthesize information from various sources'
  },
  {
    id: 'skill.planning',
    name: 'Planning',
    type: CapabilityType.SKILL,
    description: 'Ability to create and execute plans to achieve goals'
  },
  {
    id: 'skill.code_generation',
    name: 'Code Generation',
    type: CapabilityType.SKILL,
    description: 'Ability to generate code in various programming languages'
  },
  {
    id: 'skill.code_review',
    name: 'Code Review',
    type: CapabilityType.SKILL,
    description: 'Ability to review and provide feedback on code'
  },
  {
    id: 'skill.text_analysis',
    name: 'Text Analysis',
    type: CapabilityType.SKILL,
    description: 'Ability to analyze and summarize text content'
  },
  {
    id: 'skill.math',
    name: 'Mathematical Reasoning',
    type: CapabilityType.SKILL,
    description: 'Ability to solve mathematical problems and perform calculations'
  },
  {
    id: 'skill.decision_making',
    name: 'Decision Making',
    type: CapabilityType.SKILL,
    description: 'Ability to make decisions based on available information'
  },
  {
    id: 'skill.data_analysis',
    name: 'Data Analysis',
    type: CapabilityType.SKILL,
    description: 'Ability to analyze and interpret data'
  },
  {
    id: 'skill.tool_usage',
    name: 'Tool Usage',
    type: CapabilityType.SKILL,
    description: 'Ability to use various tools to accomplish tasks'
  },
  {
    id: 'skill.coordination',
    name: 'Agent Coordination',
    type: CapabilityType.SKILL,
    description: 'Ability to coordinate multiple agents for complex tasks'
  },
  {
    id: 'skill.creativity',
    name: 'Creative Generation',
    type: CapabilityType.SKILL,
    description: 'Ability to generate creative content like stories, ideas, or designs'
  }
];

/**
 * Role capabilities
 */
export const RoleCapabilities: Capability[] = [
  {
    id: 'role.researcher',
    name: 'Researcher',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in finding and analyzing information',
    dependencies: ['skill.research', 'skill.text_analysis']
  },
  {
    id: 'role.developer',
    name: 'Developer',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in code development',
    dependencies: ['skill.code_generation', 'skill.code_review']
  },
  {
    id: 'role.planner',
    name: 'Planner',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in task planning and decomposition',
    dependencies: ['skill.planning', 'skill.decision_making']
  },
  {
    id: 'role.analyst',
    name: 'Analyst',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in data and text analysis',
    dependencies: ['skill.data_analysis', 'skill.text_analysis']
  },
  {
    id: 'role.coordinator',
    name: 'Coordinator',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in delegating and coordinating other agents',
    dependencies: ['skill.coordination', 'skill.decision_making']
  },
  {
    id: 'role.creative',
    name: 'Creative',
    type: CapabilityType.ROLE,
    description: 'Agent that specializes in creative content generation',
    dependencies: ['skill.creativity']
  }
];

/**
 * Domain capabilities
 */
export const DomainCapabilities: Capability[] = [
  {
    id: 'domain.general',
    name: 'General Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about a wide range of general topics'
  },
  {
    id: 'domain.software',
    name: 'Software Development',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about software development practices, tools, and frameworks'
  },
  {
    id: 'domain.science',
    name: 'Scientific Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about scientific principles and research'
  },
  {
    id: 'domain.business',
    name: 'Business Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about business concepts, management, and strategy'
  },
  {
    id: 'domain.healthcare',
    name: 'Healthcare Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about healthcare, medicine, and wellness'
  },
  {
    id: 'domain.education',
    name: 'Education Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about education principles, teaching methods, and learning'
  },
  {
    id: 'domain.finance',
    name: 'Finance Knowledge',
    type: CapabilityType.DOMAIN,
    description: 'Knowledge about financial concepts, investments, and economics'
  }
];

/**
 * All predefined capabilities
 */
export const AllCapabilities: Capability[] = [
  ...SkillCapabilities,
  ...RoleCapabilities,
  ...DomainCapabilities
];

/**
 * Helper function to register all predefined capabilities with the registry
 */
export function registerPredefinedCapabilities(registry: any): void {
  AllCapabilities.forEach(capability => {
    registry.registerCapability(capability);
  });
  
  console.log(`Registered ${AllCapabilities.length} predefined capabilities`);
} 