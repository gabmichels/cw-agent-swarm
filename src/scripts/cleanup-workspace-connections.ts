import { DatabaseService } from '../services/database/DatabaseService';

async function cleanupWorkspaceConnections(dryRun: boolean = false) {
  const db = DatabaseService.getInstance();
  
  try {
    // Get all connections
    const allConnections = await db.findWorkspaceConnections({});
    console.log(`Found ${allConnections.length} total connections`);
    
    // Separate real connections from test connections
    const realConnections = allConnections.filter(conn => 
      conn.email === 'gabriel.michels@gmail.com' || 
      (conn.email !== 'test@example.com' && conn.refreshToken)
    );
    
    const testConnections = allConnections.filter(conn => 
      conn.email === 'test@example.com' || 
      (!conn.refreshToken && conn.email !== 'gabriel.michels@gmail.com')
    );
    
    console.log(`Real connections to keep: ${realConnections.length}`);
    console.log(`Test connections to ${dryRun ? 'would delete' : 'delete'}: ${testConnections.length}`);
    
    // List real connections we're keeping
    if (realConnections.length > 0) {
      console.log('\n📌 Keeping these real connections:');
      realConnections.forEach(conn => {
        console.log(`  - ${conn.email} (${conn.provider}) - ID: ${conn.id}`);
      });
    }
    
    if (dryRun) {
      console.log('\n🔍 DRY RUN - Would delete these test connections:');
      testConnections.forEach(conn => {
        console.log(`  - ${conn.email} (${conn.provider}) - ID: ${conn.id}`);
      });
      console.log('\nRun without --dry-run to actually delete these connections.');
      return;
    }
    
    // Delete test connections with proper cascade handling
    if (testConnections.length > 0) {
      console.log('\n🗑️  Deleting test connections:');
      
      for (const connection of testConnections) {
        try {
          console.log(`Deleting connection: ${connection.email} (${connection.provider}) - ID: ${connection.id}`);
          
          // Delete related records first to avoid foreign key constraints
          
          // 1. Delete agent workspace permissions
          try {
            const permissions = await db.findAgentWorkspacePermissions({
              workspaceConnectionId: connection.id
            });
            
            for (const permission of permissions) {
              await db.deleteAgentWorkspacePermission(permission.id);
              console.log(`  ✓ Deleted permission ${permission.id}`);
            }
          } catch (error) {
            console.log(`  ⚠ Skipped permissions cleanup: ${error}`);
          }
          
          // 2. Delete workspace audit logs
          try {
            const auditLogs = await db.findWorkspaceAuditLogs({
              workspaceConnectionId: connection.id
            });
            
            for (const log of auditLogs) {
              await db.deleteWorkspaceAuditLog(log.id);
              console.log(`  ✓ Deleted audit log ${log.id}`);
            }
          } catch (error) {
            console.log(`  ⚠ Skipped audit logs cleanup: ${error}`);
          }
          
          // 3. Delete agent notifications
          try {
            const notifications = await db.findAgentNotifications({
              connectionId: connection.id
            });
            
            for (const notification of notifications) {
              await db.deleteAgentNotification(notification.id);
              console.log(`  ✓ Deleted notification ${notification.id}`);
            }
          } catch (error) {
            console.log(`  ⚠ Skipped notifications cleanup: ${error}`);
          }
          
          // 4. Finally delete the workspace connection
          await db.deleteWorkspaceConnection(connection.id);
          console.log(`  ✅ Deleted workspace connection ${connection.id}`);
          
        } catch (error) {
          console.error(`  ❌ Failed to delete connection ${connection.id}:`, error);
        }
      }
    }
    
    // Handle duplicates in real connections (keep newest)
    const realConnectionGroups = new Map<string, typeof realConnections>();
    
    realConnections.forEach(connection => {
      const key = `${connection.email}-${connection.provider}`;
      if (!realConnectionGroups.has(key)) {
        realConnectionGroups.set(key, []);
      }
      realConnectionGroups.get(key)!.push(connection);
    });
    
    // Process duplicate real connections
    for (const [key, connections] of realConnectionGroups) {
      if (connections.length > 1) {
        console.log(`\n🔄 Found ${connections.length} duplicate real connections for ${key}`);
        
        // Sort by creation date (keep the newest)
        connections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Keep the first (newest) connection, delete the rest
        const toKeep = connections[0];
        const toDelete = connections.slice(1);
        
        console.log(`Keeping connection ${toKeep.id} (created: ${toKeep.createdAt})`);
        
        for (const connection of toDelete) {
          console.log(`Deleting duplicate real connection ${connection.id} (created: ${connection.createdAt})`);
          
          try {
            // Delete related records first
            const permissions = await db.findAgentWorkspacePermissions({
              workspaceConnectionId: connection.id
            });
            
            for (const permission of permissions) {
              await db.deleteAgentWorkspacePermission(permission.id);
            }
            
            const auditLogs = await db.findWorkspaceAuditLogs({
              workspaceConnectionId: connection.id
            });
            
            for (const log of auditLogs) {
              await db.deleteWorkspaceAuditLog(log.id);
            }
            
            const notifications = await db.findAgentNotifications({
              connectionId: connection.id
            });
            
            for (const notification of notifications) {
              await db.deleteAgentNotification(notification.id);
            }
            
            // Delete the connection
            await db.deleteWorkspaceConnection(connection.id);
            console.log(`  ✅ Deleted duplicate connection ${connection.id}`);
            
          } catch (error) {
            console.error(`  ❌ Failed to delete duplicate connection ${connection.id}:`, error);
          }
        }
      }
    }
    
    // Get final count
    const finalConnections = await db.findWorkspaceConnections({});
    console.log(`\n✅ Cleanup complete!`);
    console.log(`Final connection count: ${finalConnections.length}`);
    
    if (finalConnections.length > 0) {
      console.log('\n📋 Remaining connections:');
      finalConnections.forEach(conn => {
        console.log(`  - ${conn.email} (${conn.provider}) - Status: ${conn.status}`);
      });
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Workspace Connections Cleanup Script

Usage:
  npx tsx src/scripts/cleanup-workspace-connections.ts [options]

Options:
  --dry-run, -d    Show what would be deleted without actually deleting
  --help, -h       Show this help message

Examples:
  npx tsx src/scripts/cleanup-workspace-connections.ts --dry-run
  npx tsx src/scripts/cleanup-workspace-connections.ts
`);
  process.exit(0);
}

// Run the cleanup
cleanupWorkspaceConnections(dryRun).catch(console.error); 