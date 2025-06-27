import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logging';
import { getAllAgents } from '../../../../server/agent/agent-service';
import { ManagerType } from '../../../../agents/shared/base/managers/ManagerType';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting agent tools audit...');

    // Check for agent ID filter in query params
    const { searchParams } = new URL(request.url);
    const targetAgentId = searchParams.get('agentId');

    // Get all agents from runtime registry
    const allAgents = getAllAgents();
    console.log(`📊 Found ${allAgents.length} agents in runtime registry`);

    // Filter agents if specific ID requested
    const agentsToCheck = targetAgentId
      ? allAgents.filter(agent => agent.getId() === targetAgentId)
      : allAgents;

    if (targetAgentId && agentsToCheck.length === 0) {
      console.log(`⚠️ No agent found with ID: ${targetAgentId}`);
      return NextResponse.json({
        success: true,
        message: `No agent found with ID: ${targetAgentId}`,
        agents: [],
        summary: {
          totalAgents: 0,
          totalTools: 0,
          agentsWithTools: 0,
          agentsWithoutTools: 0
        }
      });
    }

    console.log(`🎯 ${targetAgentId ? `Filtering for agent: ${targetAgentId}` : 'Checking all agents'}`);
    console.log(`📋 Will check ${agentsToCheck.length} agent(s)`);

    if (agentsToCheck.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No agents found to check',
        agents: [],
        summary: {
          totalAgents: 0,
          totalTools: 0,
          agentsWithTools: 0,
          agentsWithoutTools: 0
        }
      });
    }

    const agentToolsData = [];
    let totalToolsCount = 0;
    let agentsWithTools = 0;
    let agentsWithoutTools = 0;

    // Check each agent's tools
    for (const agent of agentsToCheck) {
      try {
        const agentId = agent.getId();
        const agentName = (agent as any).name || `Agent-${agentId.substring(0, 8)}`;

        console.log(`🤖 Checking tools for agent: ${agentName} (${agentId})`);

        // Get tool manager
        const toolManager = agent.getManager(ManagerType.TOOL);

        let toolsData = {
          agentId,
          agentName,
          agentType: agent.constructor.name,
          hasToolManager: !!toolManager,
          tools: [],
          toolCategories: {},
          toolCount: 0,
          error: null
        };

        if (toolManager) {
          try {
            // Try different methods to get tools
            let allTools = [];

            if (typeof (toolManager as any).getAllTools === 'function') {
              allTools = await (toolManager as any).getAllTools();
              console.log(`  📋 getAllTools() returned ${allTools?.length || 0} tools`);
            } else if (typeof (toolManager as any).getTools === 'function') {
              allTools = await (toolManager as any).getTools();
              console.log(`  📋 getTools() returned ${allTools?.length || 0} tools`);
            } else if (typeof (toolManager as any).listTools === 'function') {
              allTools = await (toolManager as any).listTools();
              console.log(`  📋 listTools() returned ${allTools?.length || 0} tools`);
            } else {
              console.log(`  ❌ No tool listing method found for ${agentName}`);
            }

            if (Array.isArray(allTools) && allTools.length > 0) {
              // Process tools
              const processedTools = allTools.map((tool: any) => {
                // Extract tool information safely
                const toolInfo = {
                  id: tool.id || tool.name || 'unknown',
                  name: tool.name || tool.id || 'Unknown Tool',
                  description: tool.description || 'No description available',
                  category: tool.category || 'Native Tools',
                  enabled: tool.enabled !== false, // Default to true unless explicitly false
                  costEstimate: tool.metadata?.costEstimate || tool.costEstimate || 'unknown',
                  usageLimit: tool.metadata?.usageLimit || tool.usageLimit || null,
                  version: tool.version || '1.0.0'
                };

                return toolInfo;
              });

              // Group by category
              const categorizedTools = {};
              processedTools.forEach(tool => {
                const category = tool.category || 'Native Tools';
                if (!categorizedTools[category]) {
                  categorizedTools[category] = [];
                }
                categorizedTools[category].push(tool);
              });

              toolsData.tools = processedTools;
              toolsData.toolCategories = categorizedTools;
              toolsData.toolCount = processedTools.length;

              totalToolsCount += processedTools.length;
              agentsWithTools++;

              console.log(`  ✅ ${agentName}: ${processedTools.length} tools registered`);

              // Log specific tools for debugging
              const toolNames = processedTools.map(t => t.name).join(', ');
              console.log(`    🔧 Tools: ${toolNames.substring(0, 200)}${toolNames.length > 200 ? '...' : ''}`);

              // Check for key tools
              const hasApifyTools = processedTools.some(t => t.name.includes('apify') || t.name.includes('twitter') || t.name.includes('linkedin'));
              const hasWorkspaceTools = processedTools.some(t => t.name.includes('email') || t.name.includes('calendar') || t.name.includes('send_email'));
              const hasCoreTools = processedTools.some(t => t.name.includes('send_message') || t.name.includes('llm'));

              console.log(`    📊 Tool types: Apify=${hasApifyTools}, Workspace=${hasWorkspaceTools}, Core=${hasCoreTools}`);

            } else {
              console.log(`  ⚠️ ${agentName}: No tools found or empty tools array`);
              agentsWithoutTools++;
            }

          } catch (toolError) {
            console.error(`  ❌ Error getting tools for ${agentName}:`, toolError);
            toolsData.error = toolError instanceof Error ? toolError.message : String(toolError);
            agentsWithoutTools++;
          }
        } else {
          console.log(`  ❌ ${agentName}: No tool manager found`);
          toolsData.error = 'No tool manager found';
          agentsWithoutTools++;
        }

        agentToolsData.push(toolsData);

      } catch (agentError) {
        console.error(`Error processing agent:`, agentError);
        agentToolsData.push({
          agentId: 'unknown',
          agentName: 'Error processing agent',
          agentType: 'unknown',
          hasToolManager: false,
          tools: [],
          toolCategories: {},
          toolCount: 0,
          error: agentError instanceof Error ? agentError.message : String(agentError)
        });
        agentsWithoutTools++;
      }
    }

    // Create summary
    const summary = {
      totalAgents: agentsToCheck.length,
      totalTools: totalToolsCount,
      averageToolsPerAgent: agentsToCheck.length > 0 ? Math.round(totalToolsCount / agentsToCheck.length) : 0,
      agentsWithTools,
      agentsWithoutTools,
      toolsBreakdown: {
        apifyTools: 0,
        workspaceTools: 0,
        coreTools: 0,
        otherTools: 0
      }
    };

    // Calculate tools breakdown
    agentToolsData.forEach(agentData => {
      agentData.tools.forEach(tool => {
        const toolName = tool.name.toLowerCase();
        if (toolName.includes('apify') || toolName.includes('twitter') || toolName.includes('linkedin') ||
          toolName.includes('instagram') || toolName.includes('facebook') || toolName.includes('reddit')) {
          summary.toolsBreakdown.apifyTools++;
        } else if (toolName.includes('email') || toolName.includes('calendar') || toolName.includes('drive') ||
          toolName.includes('spreadsheet') || toolName.includes('document')) {
          summary.toolsBreakdown.workspaceTools++;
        } else if (toolName.includes('send_message') || toolName.includes('llm') || toolName.includes('general')) {
          summary.toolsBreakdown.coreTools++;
        } else {
          summary.toolsBreakdown.otherTools++;
        }
      });
    });

    console.log(`🎉 Agent tools audit complete: ${totalToolsCount} total tools across ${agentsToCheck.length} agents`);
    console.log(`📊 Summary: ${agentsWithTools} agents with tools, ${agentsWithoutTools} without tools`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      agents: agentToolsData,
      summary,
      message: `Successfully audited ${agentsToCheck.length} agents with ${totalToolsCount} total tools`
    });

  } catch (error) {
    console.error('❌ Error in agent tools audit:', error);
    logger.error('Error in agent tools audit:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to audit agent tools'
    }, { status: 500 });
  }
} 