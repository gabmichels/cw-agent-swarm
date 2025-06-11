import { NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { DefaultCapabilityMemoryService } from '@/server/memory/services/multi-agent/capability-service';
import { getMemoryServices } from '@/server/memory/services';
import { CapabilityMemoryEntity, CapabilityType } from '@/server/memory/schema/capability';

/**
 * GET /api/multi-agent/capabilities
 * Retrieves all capabilities or searches based on query parameters
 * Supports: type, query, limit, offset
 */
export async function GET(request: Request) {
  try {
    // Parse URL to get query parameters
    const url = new URL(request.url);
    const searchText = url.searchParams.get('query') || '';
    const type = url.searchParams.get('type') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    
    // Get memory services
    const services = await getMemoryServices();
    const client = services.client;
    
    // Create capability service
    const capabilityService = new DefaultCapabilityMemoryService(client);
    
    let capabilities: CapabilityMemoryEntity[] = [];
    
    // If type is specified, filter by type
    if (type) {
      const rawCapabilities = await capabilityService.findCapabilitiesByType(type, limit + offset);
      
      // Deduplicate capabilities by ID
      const seenIds = new Set<string>();
      const deduplicatedCapabilities = rawCapabilities.filter(cap => {
        if (!cap || !cap.name || !cap.type || !cap.id) {
          return false;
        }
        if (seenIds.has(cap.id)) {
          return false;
        }
        seenIds.add(cap.id);
        return true;
      });
      
      // Apply offset
      capabilities = deduplicatedCapabilities.slice(offset, offset + limit);
    } 
    // If search text is specified, search by text
    else if (searchText) {
      const rawCapabilities = await capabilityService.searchCapabilities(searchText, limit + offset);
      
      // Deduplicate capabilities by ID
      const seenIds = new Set<string>();
      const deduplicatedCapabilities = rawCapabilities.filter(cap => {
        if (!cap || !cap.name || !cap.type || !cap.id) {
          return false;
        }
        if (seenIds.has(cap.id)) {
          return false;
        }
        seenIds.add(cap.id);
        return true;
      });
      
      // Apply offset
      capabilities = deduplicatedCapabilities.slice(offset, offset + limit);
    } 
    // Otherwise get all capabilities (limited)
    else {
      // For simplicity, we'll fetch all capability types with pagination
      const pageSize = Math.ceil(limit / 4); // Distribute the limit across 4 types
      
      const skillCapabilities = await capabilityService.findCapabilitiesByType(CapabilityType.SKILL, pageSize);
      const domainCapabilities = await capabilityService.findCapabilitiesByType(CapabilityType.DOMAIN, pageSize);
      const roleCapabilities = await capabilityService.findCapabilitiesByType(CapabilityType.ROLE, pageSize);
      const tagCapabilities = await capabilityService.findCapabilitiesByType(CapabilityType.TAG, pageSize);
      
      // Combine all capabilities
      const allCapabilities = [...skillCapabilities, ...domainCapabilities, ...roleCapabilities, ...tagCapabilities];
      
      // Deduplicate capabilities by ID - this is crucial to avoid React key errors
      const seenIds = new Set<string>();
      capabilities = allCapabilities.filter(cap => {
        // Skip if capability is malformed
        if (!cap || !cap.name || !cap.type || !cap.id) {
          return false;
        }
        
        // Skip if we've already seen this ID
        if (seenIds.has(cap.id)) {
          return false;
        }
        
        seenIds.add(cap.id);
        return true;
      });
      
      // Sort by name for consistent ordering (with null safety)
      capabilities.sort((a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      });
      
      // Apply pagination
      capabilities = capabilities.slice(offset, offset + limit);
    }
    
    // Get total count for pagination info
    const totalCount = await getCapabilityCount(capabilityService, type, searchText);
    
    return NextResponse.json({ 
      capabilities,
      pagination: {
        total: totalCount,
        offset,
        limit,
        hasMore: totalCount > (offset + limit)
      }
    });
  } catch (error) {
    console.error('Error retrieving capabilities:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get capability count
 */
async function getCapabilityCount(
  capabilityService: DefaultCapabilityMemoryService,
  type?: string,
  searchText?: string
): Promise<number> {
  try {
    if (type) {
      const capabilities = await capabilityService.findCapabilitiesByType(type, 1000);
      return capabilities.length;
    } else if (searchText) {
      const capabilities = await capabilityService.searchCapabilities(searchText, 1000);
      return capabilities.length;
    } else {
      // For simplicity, we'll estimate by getting counts of each type
      // In a real-world app, you'd use a more efficient counting mechanism
      const skillCount = (await capabilityService.findCapabilitiesByType(CapabilityType.SKILL, 1000)).length;
      const domainCount = (await capabilityService.findCapabilitiesByType(CapabilityType.DOMAIN, 1000)).length;
      const roleCount = (await capabilityService.findCapabilitiesByType(CapabilityType.ROLE, 1000)).length;
      const tagCount = (await capabilityService.findCapabilitiesByType(CapabilityType.TAG, 1000)).length;
      
      return skillCount + domainCount + roleCount + tagCount;
    }
  } catch (error) {
    console.error('Error getting capability count:', error);
    return 0;
  }
}

/**
 * POST /api/multi-agent/capabilities
 * Creates a new capability in the system
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const requestData = await request.json();
    
    // Validate capability data
    if (!requestData.name || !requestData.description || !requestData.type) {
      return NextResponse.json(
        { error: 'Name, description, and type are required' },
        { status: 400 }
      );
    }
    
    // Validate type
    if (!Object.values(CapabilityType).includes(requestData.type as CapabilityType)) {
      return NextResponse.json(
        { error: `Invalid capability type: ${requestData.type}. Must be one of: ${Object.values(CapabilityType).join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get memory services
    const services = await getMemoryServices();
    const client = services.client;
    
    // Check if capabilities collection exists, create it if it doesn't
    const collectionExists = await client.collectionExists(CAPABILITIES_COLLECTION);
    if (!collectionExists) {
      const dimensionSize = 1536; // Default dimension size for embedding vectors
      await client.createCollection(CAPABILITIES_COLLECTION, dimensionSize);
    }
    
    // Create capability service
    const capabilityService = new DefaultCapabilityMemoryService(client);
    
    // Check for duplicates - search for capabilities with same name and type
    const similarCapabilities = await capabilityService.searchCapabilities(
      `${requestData.name} ${requestData.type}`, 10
    );
    
    const isDuplicate = similarCapabilities.some(cap => 
      cap.name.toLowerCase() === requestData.name.toLowerCase() && 
      cap.type === requestData.type
    );
    
    if (isDuplicate) {
      return NextResponse.json(
        { error: `A capability with name "${requestData.name}" and type "${requestData.type}" already exists` },
        { status: 409 }
      );
    }
    
    // Generate a new capability ID
    const timestamp = new Date();
    const id = `capability_${requestData.type}_${requestData.name.toLowerCase().replace(/\s+/g, '_')}_${ulid(timestamp.getTime())}`;
    
    // Create capability entity
    const capability: CapabilityMemoryEntity = {
      id,
      name: requestData.name,
      description: requestData.description,
      type: requestData.type as CapabilityType,
      version: requestData.version || '1.0.0',
      parameters: requestData.parameters || {},
      tags: requestData.tags || [],
      domains: requestData.domains || [],
      relatedCapabilityIds: requestData.relatedCapabilityIds || [],
      content: `${requestData.name} - ${requestData.description} - ${requestData.type}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: '1.0',
      metadata: {} // Required by BaseMemoryEntity
    };
    
    // Add any extra fields from request that we haven't explicitly mapped
    if (requestData.usageStats) {
      capability.usageStats = requestData.usageStats;
    }
    
    // Store capability
    const result = await capabilityService.createCapability(capability);
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error?.message || 'Failed to create capability' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        success: true,
        capability,
        message: 'Capability created successfully'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating capability:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Collection name for capabilities
 */
const CAPABILITIES_COLLECTION = 'capabilities'; 