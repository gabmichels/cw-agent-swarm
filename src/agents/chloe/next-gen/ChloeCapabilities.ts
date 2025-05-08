/**
 * ChloeCapabilities.ts - Defines Chloe-specific capabilities
 * 
 * This module defines the marketing-focused capabilities that Chloe possesses,
 * following the capability system patterns. These can be registered with the
 * capability registry to make Chloe discoverable for marketing tasks.
 */

import { Capability, CapabilityType, CapabilityLevel } from '../../shared/capability-system';

/**
 * Marketing skill capabilities
 */
export const MarketingSkillCapabilities: Capability[] = [
  // Marketing strategy capabilities
  {
    id: 'skill.marketing_strategy',
    name: 'Marketing Strategy',
    type: CapabilityType.SKILL,
    description: 'Creating and implementing marketing strategies for startups and early-stage companies'
  },
  {
    id: 'skill.growth_optimization',
    name: 'Growth Optimization',
    type: CapabilityType.SKILL,
    description: 'Strategies to scale from 0 → 10k MAUs in 2025 and 100k MAUs in 2026'
  },
  {
    id: 'skill.viral_marketing',
    name: 'Viral Marketing',
    type: CapabilityType.SKILL,
    description: 'Designing viral loops and referral systems'
  },
  {
    id: 'skill.low_budget_acquisition',
    name: 'Low-Budget Acquisition',
    type: CapabilityType.SKILL,
    description: 'User acquisition strategies with minimal budget'
  },
  
  // Content capabilities
  {
    id: 'skill.content_strategy',
    name: 'Content Strategy',
    type: CapabilityType.SKILL,
    description: 'Planning and executing content marketing strategies'
  },
  {
    id: 'skill.social_media_marketing',
    name: 'Social Media Marketing',
    type: CapabilityType.SKILL,
    description: 'Building brand presence and engagement on social media platforms'
  },
  {
    id: 'skill.seo_optimization',
    name: 'SEO Optimization',
    type: CapabilityType.SKILL,
    description: 'Optimizing content and websites for search engines'
  },
  
  // Marketing analysis capabilities
  {
    id: 'skill.market_research',
    name: 'Market Research',
    type: CapabilityType.SKILL,
    description: 'Researching market trends, competitors, and customer needs'
  },
  {
    id: 'skill.customer_segmentation',
    name: 'Customer Segmentation',
    type: CapabilityType.SKILL,
    description: 'Identifying and targeting specific customer segments'
  },
  {
    id: 'skill.marketing_analytics',
    name: 'Marketing Analytics',
    type: CapabilityType.SKILL,
    description: 'Analyzing marketing performance and effectiveness'
  }
];

/**
 * Marketing domain capabilities
 */
export const MarketingDomainCapabilities: Capability[] = [
  {
    id: 'domain.marketing',
    name: 'Marketing',
    type: CapabilityType.DOMAIN,
    description: 'General marketing knowledge and expertise'
  },
  {
    id: 'domain.growth',
    name: 'Growth Marketing',
    type: CapabilityType.DOMAIN,
    description: 'Specialized knowledge in growth marketing techniques'
  },
  {
    id: 'domain.startup_marketing',
    name: 'Startup Marketing',
    type: CapabilityType.DOMAIN,
    description: 'Marketing strategies specific to startups and early-stage companies'
  },
  {
    id: 'domain.digital_marketing',
    name: 'Digital Marketing',
    type: CapabilityType.DOMAIN,
    description: 'Online marketing techniques and platforms'
  }
];

/**
 * Marketing role capabilities
 */
export const MarketingRoleCapabilities: Capability[] = [
  {
    id: 'role.cmo',
    name: 'CMO',
    type: CapabilityType.ROLE,
    description: 'Chief Marketing Officer role with strategic leadership'
  },
  {
    id: 'role.marketing_strategist',
    name: 'Marketing Strategist',
    type: CapabilityType.ROLE,
    description: 'Strategic planning and direction for marketing efforts'
  },
  {
    id: 'role.growth_hacker',
    name: 'Growth Hacker',
    type: CapabilityType.ROLE,
    description: 'Focused on rapid growth and user acquisition'
  },
  {
    id: 'role.marketing_advisor',
    name: 'Marketing Advisor',
    type: CapabilityType.ROLE,
    description: 'Provides marketing advice and guidance'
  }
];

/**
 * All Chloe-specific capabilities
 */
export const AllChloeCapabilities: Capability[] = [
  ...MarketingSkillCapabilities,
  ...MarketingDomainCapabilities,
  ...MarketingRoleCapabilities
];

/**
 * Chloe's capability configuration for agent initialization
 */
export const ChloeCapabilityConfig = {
  skills: {
    'skill.marketing_strategy': CapabilityLevel.EXPERT,
    'skill.growth_optimization': CapabilityLevel.EXPERT,
    'skill.viral_marketing': CapabilityLevel.ADVANCED,
    'skill.low_budget_acquisition': CapabilityLevel.EXPERT,
    'skill.content_strategy': CapabilityLevel.ADVANCED,
    'skill.social_media_marketing': CapabilityLevel.ADVANCED,
    'skill.seo_optimization': CapabilityLevel.INTERMEDIATE,
    'skill.market_research': CapabilityLevel.ADVANCED,
    'skill.customer_segmentation': CapabilityLevel.ADVANCED, 
    'skill.marketing_analytics': CapabilityLevel.ADVANCED
  },
  domains: [
    'domain.marketing',
    'domain.growth',
    'domain.startup_marketing',
    'domain.digital_marketing'
  ],
  roles: [
    'role.cmo',
    'role.marketing_strategist',
    'role.growth_hacker',
    'role.marketing_advisor'
  ]
};

/**
 * Register all Chloe capabilities with the registry
 * @param registry The capability registry instance
 */
export function registerChloeCapabilities(registry: any): void {
  // Register capability definitions
  AllChloeCapabilities.forEach(capability => {
    registry.registerCapability(capability);
  });
  
  console.log(`Registered ${AllChloeCapabilities.length} Chloe-specific capabilities`);
}

/**
 * Register Chloe's capabilities for a specific agent instance
 * @param agentId The agent ID to register capabilities for
 * @param registry The capability registry instance
 */
export function registerChloeAgentCapabilities(agentId: string, registry: any): void {
  // Convert enum values to strings for the registry
  const skillsAsStrings: Record<string, string> = {};
  Object.entries(ChloeCapabilityConfig.skills).forEach(([key, value]) => {
    skillsAsStrings[key] = value;
  });
  
  // Register with the registry
  registry.registerAgentCapabilities(
    agentId,
    skillsAsStrings,
    {
      preferredDomains: ChloeCapabilityConfig.domains,
      primaryRoles: ChloeCapabilityConfig.roles
    }
  );
  
  console.log(`Registered Chloe's capabilities for agent ${agentId}`);
} 