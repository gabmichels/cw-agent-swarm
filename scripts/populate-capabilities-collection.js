#!/usr/bin/env node

/**
 * Script to populate the capabilities collection with organized capabilities
 */

// New capabilities data structure
const NEW_CAPABILITIES = {
  skills: [
    {
      id: 'skill.growth.early_stage_startups',
      name: 'Early-stage Startup Growth',
      description: 'Expertise in developing and implementing growth strategies specifically for early-stage startups with limited resources.',
      type: 'skill'
    },
    {
      id: 'skill.growth.mid_stage_startups',
      name: 'Mid-stage Startup Growth', 
      description: 'Strategic planning and execution for scaling mid-stage startups focused on expanding market share and user base.',
      type: 'skill'
    },
    {
      id: 'skill.marketing.viral_strategy',
      name: 'Viral Marketing Strategy',
      description: 'Creating and optimizing marketing strategies designed to achieve rapid, viral growth through user sharing and network effects.',
      type: 'skill'
    },
    {
      id: 'skill.marketing.campaign_planning',
      name: 'Campaign Planning',
      description: 'End-to-end marketing campaign development, from concept to implementation and analysis.',
      type: 'skill'
    },
    {
      id: 'skill.social_media.organic_marketing',
      name: 'Organic Social Media Marketing',
      description: 'Creating effective organic content strategies for Instagram, TikTok, and YouTube to build audience without paid promotion.',
      type: 'skill'
    },
    {
      id: 'skill.influencer.micro_collaboration',
      name: 'Micro-influencer Collaboration',
      description: 'Developing and managing programs that leverage micro-influencers for authentic marketing at lower costs.',
      type: 'skill'
    },
    {
      id: 'skill.advertising.low_budget',
      name: 'Low-budget Ad Experimentation',
      description: 'Testing and optimizing paid advertising campaigns with minimal budgets while maximizing ROI.',
      type: 'skill'
    },
    {
      id: 'skill.analytics.growth_metrics',
      name: 'Growth Analytics',
      description: 'Monitoring and analyzing key growth metrics including MAU, K-Factor, and Customer Acquisition Cost (CAC).',
      type: 'skill'
    },
    {
      id: 'skill.planning.growth_cycles',
      name: 'Weekly Growth Planning',
      description: 'Implementing structured weekly growth planning and reflection loops to continuously improve marketing performance.',
      type: 'skill'
    }
  ],
  domains: [
    {
      id: 'domain.marketing',
      name: 'Marketing',
      description: 'Digital marketing, campaign management, and customer acquisition strategies.',
      type: 'domain'
    },
    {
      id: 'domain.growth',
      name: 'Growth',
      description: 'Growth hacking, user acquisition, and business scaling methodologies.',
      type: 'domain'
    },
    {
      id: 'domain.startups',
      name: 'Startups',
      description: 'Startup ecosystem knowledge, early-stage business development, and scaling strategies.',
      type: 'domain'
    },
    {
      id: 'domain.social_media',
      name: 'Social Media',
      description: 'Social media platforms, content creation, and community management.',
      type: 'domain'
    },
    {
      id: 'domain.analytics',
      name: 'Analytics',
      description: 'Data analysis, metrics tracking, and performance measurement.',
      type: 'domain'
    }
  ],
  roles: [
    {
      id: 'role.cmo',
      name: 'Chief Marketing Officer',
      description: 'Strategic marketing leadership, brand management, and revenue growth responsibility.',
      type: 'role'
    },
    {
      id: 'role.strategist',
      name: 'Strategist',
      description: 'Strategic planning, market analysis, and business development strategy.',
      type: 'role'
    },
    {
      id: 'role.growth_hacker',
      name: 'Growth Hacker',
      description: 'Growth-focused experimentation, viral marketing, and rapid user acquisition.',
      type: 'role'
    },
    {
      id: 'role.campaign_planner',
      name: 'Campaign Planner',
      description: 'Marketing campaign design, execution, and optimization across multiple channels.',
      type: 'role'
    }
  ]
};

/**
 * Create capability via API
 */
async function createCapabilityViaAPI(capability) {
  try {
    const response = await fetch('http://localhost:3000/api/multi-agent/capabilities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: capability.name,
        description: capability.description,
        type: capability.type,
        version: '1.0.0',
        parameters: {},
        tags: [],
        domains: capability.type === 'DOMAIN' ? [capability.name.toLowerCase()] : [],
        relatedCapabilityIds: []
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`API call failed: ${error.message}`);
  }
}

/**
 * Populate capabilities collection via API
 */
async function populateCapabilities() {
  console.log('📦 Populating capabilities collection via API...');
  
  try {
    // Collect all capabilities
    const allCapabilities = [
      ...NEW_CAPABILITIES.skills,
      ...NEW_CAPABILITIES.domains,
      ...NEW_CAPABILITIES.roles
    ];
    
    console.log(`📊 Preparing to create ${allCapabilities.length} capabilities:`);
    console.log(`  - ${NEW_CAPABILITIES.skills.length} Skills`);
    console.log(`  - ${NEW_CAPABILITIES.domains.length} Domains`);
    console.log(`  - ${NEW_CAPABILITIES.roles.length} Roles`);
    
    let successCount = 0;
    let failureCount = 0;
    let duplicateCount = 0;
    
    // Process each capability
    for (const capability of allCapabilities) {
      try {
        console.log(`🔄 Creating: ${capability.name} (${capability.type})`);
        
        const result = await createCapabilityViaAPI(capability);
        
        console.log(`✅ Created: ${capability.name}`);
        successCount++;
        
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️ Duplicate: ${capability.name} (already exists)`);
          duplicateCount++;
        } else {
          console.error(`❌ Failed to create ${capability.name}:`, error.message);
          failureCount++;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully created: ${successCount} capabilities`);
    console.log(`⚠️ Duplicates skipped: ${duplicateCount} capabilities`);
    console.log(`❌ Failed to create: ${failureCount} capabilities`);
    
    // Verify by fetching capabilities
    try {
      const response = await fetch('http://localhost:3000/api/multi-agent/capabilities?limit=100');
      const data = await response.json();
      console.log(`📋 Final collection size: ${data.capabilities.length} capabilities`);
    } catch (error) {
      console.warn('⚠️ Could not verify collection size:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error populating capabilities collection:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
populateCapabilities()
  .then(() => {
    console.log('🎉 Capabilities collection populated successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 