import { DatabaseService } from '../services/database/DatabaseService';

async function cleanupWorkspaceConnections() {
  const db = DatabaseService.getInstance();
  
  try {
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
    
    // Process each group
    for (const [key, connections] of connectionGroups) {
      if (connections.length > 1) {
        console.log(`\nFound ${connections.length} duplicate connections for ${key}`);
        
        // Sort by creation date (keep the newest)
        connections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Keep the first (newest) connection, delete the rest
        const toKeep = connections[0];
        const toDelete = connections.slice(1);
        
        console.log(`Keeping connection ${toKeep.id} (created: ${toKeep.createdAt})`);
        
        for (const connection of toDelete) {
          console.log(`Deleting duplicate connection ${connection.id} (created: ${connection.createdAt})`);
          
          // Only delete test connections or connections without valid refresh tokens
          if (connection.email === 'test@example.com' || !connection.refreshToken) {
            await db.deleteWorkspaceConnection(connection.id);
            console.log(`✓ Deleted connection ${connection.id}`);
          } else {
            console.log(`⚠ Skipped deletion of ${connection.id} (has valid refresh token)`);
          }
        }
      }
    }
    
    // Get final count
    const finalConnections = await db.findWorkspaceConnections({});
    console.log(`\nCleanup complete. ${finalConnections.length} connections remaining.`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupWorkspaceConnections().then(() => {
  console.log('Cleanup script finished');
  process.exit(0);
}).catch(error => {
  console.error('Cleanup script failed:', error);
  process.exit(1);
}); 