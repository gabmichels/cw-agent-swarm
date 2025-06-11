import { DefaultCapabilityMemoryService } from '@/server/memory/services/multi-agent/capability-service';
import { CapabilityMemoryEntity, CapabilityType } from '@/server/memory/schema/capability';

/**
 * Standard capabilities that should be available for all agent templates
 */
const STANDARD_CAPABILITIES: Omit<CapabilityMemoryEntity, 'createdAt' | 'updatedAt' | 'schemaVersion'>[] = [
  // Core Skills
  {
    id: 'skill.programming',
    name: 'Programming',
    description: 'Ability to write, review, and debug code in various programming languages',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['coding', 'development', 'technical'],
    domains: [],
    content: 'Programming - Ability to write, review, and debug code in various programming languages (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  {
    id: 'skill.problem_solving',
    name: 'Problem Solving',
    description: 'Ability to analyze complex problems and develop effective solutions',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['analysis', 'reasoning', 'solutions'],
    domains: [],
    content: 'Problem Solving - Ability to analyze complex problems and develop effective solutions (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  {
    id: 'skill.creative_thinking',
    name: 'Creative Thinking',
    description: 'Ability to generate innovative ideas and creative solutions',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['creativity', 'innovation', 'ideas'],
    domains: [],
    content: 'Creative Thinking - Ability to generate innovative ideas and creative solutions (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  {
    id: 'skill.research',
    name: 'Research',
    description: 'Ability to gather, analyze, and synthesize information from various sources',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['research', 'information', 'analysis'],
    domains: [],
    content: 'Research - Ability to gather, analyze, and synthesize information from various sources (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  {
    id: 'skill.communication',
    name: 'Communication',
    description: 'Ability to communicate effectively with users and other agents',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['communication', 'writing', 'explanation'],
    domains: [],
    content: 'Communication - Ability to communicate effectively with users and other agents (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  {
    id: 'skill.data_analysis',
    name: 'Data Analysis',
    description: 'Ability to process, analyze, and derive insights from data',
    type: CapabilityType.SKILL,
    version: '1.0.0',
    parameters: { level: 'basic' },
    tags: ['data', 'analysis', 'insights'],
    domains: [],
    content: 'Data Analysis - Ability to process, analyze, and derive insights from data (skill)',
    metadata: { category: CapabilityType.SKILL }
  },
  
  // Domain Expertise
  {
    id: 'domain.general',
    name: 'General Knowledge',
    description: 'Broad knowledge across multiple domains and disciplines',
    type: CapabilityType.DOMAIN,
    version: '1.0.0',
    parameters: { coverage: 'broad' },
    tags: ['general', 'knowledge', 'broad'],
    domains: ['general'],
    content: 'General Knowledge - Broad knowledge across multiple domains and disciplines (domain)',
    metadata: { category: CapabilityType.DOMAIN }
  },
  {
    id: 'domain.technology',
    name: 'Technology',
    description: 'Specialized knowledge in technology, software, and digital systems',
    type: CapabilityType.DOMAIN,
    version: '1.0.0',
    parameters: { coverage: 'specialized' },
    tags: ['technology', 'software', 'digital'],
    domains: ['technology'],
    content: 'Technology - Specialized knowledge in technology, software, and digital systems (domain)',
    metadata: { category: CapabilityType.DOMAIN }
  },
  {
    id: 'domain.business',
    name: 'Business',
    description: 'Understanding of business processes, strategy, and operations',
    type: CapabilityType.DOMAIN,
    version: '1.0.0',
    parameters: { coverage: 'specialized' },
    tags: ['business', 'strategy', 'operations'],
    domains: ['business'],
    content: 'Business - Understanding of business processes, strategy, and operations (domain)',
    metadata: { category: CapabilityType.DOMAIN }
  },
  {
    id: 'domain.science',
    name: 'Science',
    description: 'Knowledge of scientific principles, methods, and discoveries',
    type: CapabilityType.DOMAIN,
    version: '1.0.0',
    parameters: { coverage: 'specialized' },
    tags: ['science', 'research', 'methods'],
    domains: ['science'],
    content: 'Science - Knowledge of scientific principles, methods, and discoveries (domain)',
    metadata: { category: CapabilityType.DOMAIN }
  },
  
  // Roles
  {
    id: 'role.assistant',
    name: 'Assistant',
    description: 'General-purpose assistant role for helping users with various tasks',
    type: CapabilityType.ROLE,
    version: '1.0.0',
    parameters: { scope: 'general' },
    tags: ['assistant', 'helper', 'general'],
    domains: [],
    content: 'Assistant - General-purpose assistant role for helping users with various tasks (role)',
    metadata: { category: CapabilityType.ROLE }
  },
  {
    id: 'role.specialist',
    name: 'Specialist',
    description: 'Specialized expert role for deep domain knowledge',
    type: CapabilityType.ROLE,
    version: '1.0.0',
    parameters: { scope: 'specialized' },
    tags: ['specialist', 'expert', 'domain'],
    domains: [],
    content: 'Specialist - Specialized expert role for deep domain knowledge (role)',
    metadata: { category: CapabilityType.ROLE }
  },
  {
    id: 'role.analyst',
    name: 'Analyst',
    description: 'Analytical role focused on data analysis and insights',
    type: CapabilityType.ROLE,
    version: '1.0.0',
    parameters: { scope: 'analytical' },
    tags: ['analyst', 'data', 'insights'],
    domains: [],
    content: 'Analyst - Analytical role focused on data analysis and insights (role)',
    metadata: { category: CapabilityType.ROLE }
  },
  
  // Tags/Attributes
  {
    id: 'tag.versatile',
    name: 'Versatile',
    description: 'Able to handle a wide variety of tasks and adapt to different contexts',
    type: CapabilityType.TAG,
    version: '1.0.0',
    parameters: { attribute: 'adaptability' },
    tags: ['versatile', 'adaptable', 'flexible'],
    domains: [],
    content: 'Versatile - Able to handle a wide variety of tasks and adapt to different contexts (tag)',
    metadata: { category: CapabilityType.TAG }
  },
  {
    id: 'tag.helpful',
    name: 'Helpful',
    description: 'Focused on providing useful assistance and support to users',
    type: CapabilityType.TAG,
    version: '1.0.0',
    parameters: { attribute: 'helpfulness' },
    tags: ['helpful', 'supportive', 'useful'],
    domains: [],
    content: 'Helpful - Focused on providing useful assistance and support to users (tag)',
    metadata: { category: CapabilityType.TAG }
  },
  {
    id: 'tag.reliable',
    name: 'Reliable',
    description: 'Consistent and dependable in performance and responses',
    type: CapabilityType.TAG,
    version: '1.0.0',
    parameters: { attribute: 'reliability' },
    tags: ['reliable', 'consistent', 'dependable'],
    domains: [],
    content: 'Reliable - Consistent and dependable in performance and responses (tag)',
    metadata: { category: CapabilityType.TAG }
  }
];

/**
 * Bootstrap standard capabilities into the collection
 * This ensures all template capabilities are available for agent creation
 */
export async function bootstrapCapabilities(): Promise<{
  success: boolean;
  created: number;
  existing: number;
  failed: number;
  errors: string[];
}> {
  console.log('🚀 Starting capabilities bootstrap...');
  
  const capabilityService = new DefaultCapabilityMemoryService();
  const results = {
    success: true,
    created: 0,
    existing: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  try {
    for (const capabilityTemplate of STANDARD_CAPABILITIES) {
      try {
        const now = new Date();
        const capability: CapabilityMemoryEntity = {
          ...capabilityTemplate,
          createdAt: now,
          updatedAt: now,
          schemaVersion: '1.0'
        };
        
        // Use findOrCreateCapability to avoid duplicates
        const mapping = await capabilityService.findOrCreateCapability(capability);
        
        if (mapping) {
          console.log(`  ✅ Processed: ${capability.name} (${capability.id}) - UUID: ${mapping.pointId}`);
          results.created++; // Count as success (whether created or found)
        } else {
          console.error(`  ❌ Failed: ${capability.name} (${capability.id})`);
          results.failed++;
          results.errors.push(`Failed to create/find capability: ${capability.id}`);
        }
      } catch (error) {
        const errorMsg = `Error processing capability ${capabilityTemplate.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`  ❌ ${errorMsg}`);
        results.failed++;
        results.errors.push(errorMsg);
      }
    }
    
    console.log('✅ Capabilities bootstrap completed:');
    console.log(`   - Processed: ${results.created}`);
    console.log(`   - Failed: ${results.failed}`);
    console.log(`   - Total: ${results.created + results.failed}`);
    
    if (results.failed > 0) {
      results.success = false;
      console.warn('⚠️ Some capabilities failed to bootstrap');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Capabilities bootstrap failed:', error);
    return {
      success: false,
      created: 0,
      existing: 0,
      failed: STANDARD_CAPABILITIES.length,
      errors: [`Bootstrap failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Get the list of standard capabilities
 */
export function getStandardCapabilities(): typeof STANDARD_CAPABILITIES {
  return STANDARD_CAPABILITIES;
} 