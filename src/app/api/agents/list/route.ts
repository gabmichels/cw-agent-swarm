import { NextRequest, NextResponse } from 'next/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { AgentMetadata } from '../../../../types/metadata';

/**
 * GET /api/agents/list
 * Fetch all agents from Qdrant for organizational chart
 */
export async function GET(request: NextRequest) {
  let qdrantClient: QdrantClient | null = null;
  
  try {
    console.log('Fetching agents from Qdrant...');
    
    // Initialize Qdrant client
    const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    
    qdrantClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey
    });
    
    // Fetch all agents from the 'agents' collection
    const response = await qdrantClient.scroll('agents', {
      limit: 10000, // Large limit to get all agents
      with_payload: true,
      with_vector: false // We don't need vectors for org chart
    });
    
    console.log(`Found ${response.points.length} agents in Qdrant`);
    
    // Transform Qdrant points to AgentMetadata
    const agents: AgentMetadata[] = response.points.map((point: any) => {
      const payload = point.payload as any;
      
      // Handle different payload structures that might exist in Qdrant
      // Extract metadata if it exists
      const metadata = payload.metadata || {};
      
      const agent: AgentMetadata = {
        schemaVersion: payload.schemaVersion || metadata.schemaVersion || '1.0.0',
        agentId: payload.agentId || metadata.agentId || payload.id || point.id.toString(),
        name: payload.name || metadata.name || payload.text || 'Unknown Agent',
        description: payload.description || metadata.description || '',
        status: payload.status || metadata.status || 'available',
        version: payload.version || metadata.version || '1.0.0',
        isPublic: payload.isPublic !== false,
        domain: Array.isArray(metadata.domain) ? metadata.domain : (metadata.domain ? [metadata.domain] : []),
        specialization: Array.isArray(metadata.specialization) ? metadata.specialization : (metadata.specialization ? [metadata.specialization] : []),
        performanceMetrics: metadata.performanceMetrics || {
          successRate: 0,
          averageResponseTime: 0,
          taskCompletionRate: 0
        },
        capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities : [],
        department: metadata.department || payload.department || null,
        position: metadata.position || payload.position || 'Agent',
        organizationLevel: metadata.organizationLevel || payload.organizationLevel || 1,
        createdAt: metadata.createdAt ? new Date(metadata.createdAt) : (payload.createdAt ? new Date(payload.createdAt) : new Date()),
        updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : (payload.updatedAt ? new Date(payload.updatedAt) : new Date())
      };
      
      return agent;
    });
    
    // Filter out any invalid agents
    const validAgents = agents.filter((agent: any) => agent.name && agent.name !== 'Unknown Agent');
    
    console.log(`Returning ${validAgents.length} valid agents`);
    
    return NextResponse.json({
      success: true,
      agents: validAgents,
      count: validAgents.length,
      total: response.points.length
    });
    
  } catch (error) {
    console.error('Error fetching agents from Qdrant:', error);
    
    // Return a more user-friendly error response
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      return NextResponse.json({
        success: false,
        error: 'Unable to connect to Qdrant database',
        details: 'Please ensure Qdrant is running and accessible',
        agents: [] // Return empty array so UI doesn't break
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch agents',
      details: error instanceof Error ? error.message : String(error),
      agents: [] // Return empty array so UI doesn't break
    }, { status: 500 });
  }
} 