import { NextResponse } from 'next/server';
import { DefaultCapabilityMemoryService } from '@/server/memory/services/multi-agent/capability-service';

/**
 * GET /api/multi-agent/capabilities/collection
 * Gets all capabilities from the capabilities collection
 * This endpoint provides the actual stored capabilities for agent creation UI
 */
export async function GET() {
  try {
    console.log('📋 Loading capabilities from collection...');
    
    const capabilityService = new DefaultCapabilityMemoryService();
    
    // Get all capabilities from the collection
    const capabilities = await capabilityService.getAllCapabilities();
    
    console.log(`✅ Found ${capabilities.length} capabilities in collection`);
    
    // Transform to UI-friendly format
    const uiCapabilities = capabilities.map((cap: any) => ({
      id: cap.capabilityId, // Use the string ID for UI selection
      pointId: cap.pointId, // Include UUID for reference
      name: cap.entity.name,
      description: cap.entity.description,
      type: cap.entity.type,
      version: cap.entity.version,
      parameters: cap.entity.parameters,
      metadata: {
        category: cap.entity.metadata?.category,
        domains: cap.entity.domains,
        tags: cap.entity.tags
      }
    }));
    
    // Group by type for easier UI consumption
    const groupedCapabilities = {
      skill: uiCapabilities.filter((cap: any) => cap.type === 'skill'),
      domain: uiCapabilities.filter((cap: any) => cap.type === 'domain'),
      role: uiCapabilities.filter((cap: any) => cap.type === 'role'),
      tag: uiCapabilities.filter((cap: any) => cap.type === 'tag')
    };
    
    return NextResponse.json({
      success: true,
      message: `Found ${capabilities.length} capabilities`,
      capabilities: uiCapabilities,
      grouped: groupedCapabilities,
      total: capabilities.length
    });
    
  } catch (error) {
    console.error('Error loading capabilities from collection:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to load capabilities from collection',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 