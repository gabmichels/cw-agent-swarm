import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '../../../../../services/database/DatabaseService';

export async function POST(request: NextRequest) {
  try {
    const db = DatabaseService.getInstance();
    
    // Get all connections
    const allConnections = await db.findWorkspaceConnections({});
    console.log(`Found ${allConnections.length} total connections`);
    
    // Group by email + provider to find duplicates
    const connectionGroups = new Map<string, typeof allConnections>();
    
    allConnections.forEach(connection => {
      const key = `${connection.email}-${connection.provider}`;
      if (!connectionGroups.has(key)) {
        connectionGroups.set(key, []);
      }
      connectionGroups.get(key)!.push(connection);
    });
    
    let deletedCount = 0;
    const cleanupResults = [];
    
    // Process each group
    for (const [key, connections] of connectionGroups) {
      if (connections.length > 1) {
        console.log(`Found ${connections.length} duplicate connections for ${key}`);
        
        // Sort by creation date (keep the newest)
        connections.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Keep the first (newest) connection, delete the rest
        const toKeep = connections[0];
        const toDelete = connections.slice(1);
        
        const groupResult = {
          key,
          totalConnections: connections.length,
          kept: toKeep.id,
          deleted: [] as string[]
        };
        
        for (const connection of toDelete) {
          // Only delete test connections or connections without valid refresh tokens
          if (connection.email === 'test@example.com' || !connection.refreshToken) {
            try {
              // Delete related records first to avoid foreign key constraint violations
              await db.getClient().agentWorkspacePermission.deleteMany({
                where: { workspaceConnectionId: connection.id }
              });
              
                              await db.getClient().workspaceAuditLog.deleteMany({
                  where: { workspaceConnectionId: connection.id }
                });
                
                await db.getClient().agentNotification.deleteMany({
                where: { connectionId: connection.id }
              });
              
              // Now delete the connection
              await db.deleteWorkspaceConnection(connection.id);
              deletedCount++;
              groupResult.deleted.push(connection.id);
              console.log(`✓ Deleted connection ${connection.id} and related records`);
            } catch (deleteError) {
              console.error(`✗ Failed to delete connection ${connection.id}:`, deleteError);
            }
          } else {
            console.log(`⚠ Skipped deletion of ${connection.id} (has valid refresh token)`);
          }
        }
        
        cleanupResults.push(groupResult);
      }
    }
    
    // Get final count
    const finalConnections = await db.findWorkspaceConnections({});
    
    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Deleted ${deletedCount} duplicate connections.`,
      results: {
        initialCount: allConnections.length,
        finalCount: finalConnections.length,
        deletedCount,
        cleanupResults
      }
    });
    
  } catch (error) {
    console.error('Error during workspace connections cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
