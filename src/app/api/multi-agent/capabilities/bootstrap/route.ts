import { NextResponse } from 'next/server';
import { bootstrapCapabilities } from '@/server/bootstrap/capabilities-bootstrap';

/**
 * POST /api/multi-agent/capabilities/bootstrap
 * Bootstraps standard capabilities into the capabilities collection
 * This ensures all template capabilities are available for agent creation
 */
export async function POST() {
  try {
    console.log('🚀 Starting capabilities bootstrap via API...');
    
    const results = await bootstrapCapabilities();
    
    if (results.success) {
      return NextResponse.json({
        success: true,
        message: 'Capabilities bootstrap completed successfully',
        results: {
          created: results.created,
          existing: results.existing,
          failed: results.failed,
          total: results.created + results.existing + results.failed
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Capabilities bootstrap completed with errors',
        results: {
          created: results.created,
          existing: results.existing,
          failed: results.failed,
          total: results.created + results.existing + results.failed
        },
        errors: results.errors
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Capabilities bootstrap API failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Capabilities bootstrap failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * GET /api/multi-agent/capabilities/bootstrap
 * Shows the status of standard capabilities that can be bootstrapped
 */
export async function GET() {
  try {
    const { getStandardCapabilities } = await import('@/server/bootstrap/capabilities-bootstrap');
    const standardCapabilities = getStandardCapabilities();
    
    // Group by type for easier viewing
    const grouped = {
      skill: standardCapabilities.filter((cap: any) => cap.type === 'skill'),
      domain: standardCapabilities.filter((cap: any) => cap.type === 'domain'),
      role: standardCapabilities.filter((cap: any) => cap.type === 'role'),
      tag: standardCapabilities.filter((cap: any) => cap.type === 'tag')
    };
    
    return NextResponse.json({
      success: true,
      message: `${standardCapabilities.length} standard capabilities available for bootstrap`,
      capabilities: {
        total: standardCapabilities.length,
        grouped,
        list: standardCapabilities.map((cap: any) => ({
          id: cap.id,
          name: cap.name,
          type: cap.type,
          description: cap.description
        }))
      }
    });
    
  } catch (error) {
    console.error('Error getting standard capabilities:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get standard capabilities',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 