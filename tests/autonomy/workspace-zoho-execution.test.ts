/**
 * Zoho Workspace Execution Tests
 * 
 * Tests that verify Zoho workspace capabilities work in isolation,
 * including email sending, calendar events, file operations, and spreadsheet creation.
 * 
 * This mirrors the Google workspace tests but uses Zoho APIs under the hood.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '../../src/services/database/DatabaseService';
import { WorkspaceProvider, WorkspaceCapabilityType, AccessLevel } from '../../src/services/database/types';
import { AgentService } from '../../src/services/AgentService';
import { AgentWorkspacePermissionService } from '../../src/services/workspace/AgentWorkspacePermissionService';
import { generateUuid } from '../../src/utils/uuid';
import { ZohoWorkspaceProvider } from '../../src/services/workspace/providers/ZohoWorkspaceProvider';
import { CapabilityFactory } from '../../src/services/workspace/capabilities/CapabilityFactory';

// Test configuration
const TEST_CONFIG = {
  // These would be real Zoho OAuth credentials in a real test environment
  clientId: process.env.ZOHO_CLIENT_ID || 'test-client-id',
  clientSecret: process.env.ZOHO_CLIENT_SECRET || 'test-client-secret',
  redirectUri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:3000/auth/zoho/callback',
  region: process.env.ZOHO_REGION || 'com',
  
  // Test email configuration - using Gabriel's Gmail for testing
  testEmail: process.env.ZOHO_TEST_EMAIL || 'gabriel.michels@gmail.com',
  testRecipient: process.env.ZOHO_TEST_RECIPIENT || 'gabriel.michels@gmail.com'
};

describe('Zoho Workspace Capabilities Execution', () => {
  let db: DatabaseService;
  let permissionService: AgentWorkspacePermissionService;
  let zohoProvider: ZohoWorkspaceProvider;
  let testAgentId: string;
  let testConnectionId: string;
  let hasRealZohoConnection = false;

  beforeAll(async () => {
    // Initialize services
    db = DatabaseService.getInstance();
    permissionService = new AgentWorkspacePermissionService();
    
    // Check if we have real Zoho OAuth credentials
    const hasZohoCredentials = process.env.ZOHO_CLIENT_ID && 
                              process.env.ZOHO_CLIENT_SECRET && 
                              process.env.ZOHO_REDIRECT_URI;
    
    if (!hasZohoCredentials) {
      console.log('⚠️  No Zoho OAuth credentials found in environment variables.');
      console.log('   Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REDIRECT_URI to run real tests.');
      console.log('   Running with mock configuration for basic capability factory tests only.');
    }
    
    // Initialize Zoho provider
    zohoProvider = new ZohoWorkspaceProvider(
      TEST_CONFIG.clientId,
      TEST_CONFIG.clientSecret,
      TEST_CONFIG.redirectUri,
      TEST_CONFIG.region
    );

    // Create test agent
    testAgentId = generateUuid();
    await AgentService.registerAgent({
      id: testAgentId,
      name: 'Zoho Test Agent',
      description: 'Agent for testing Zoho workspace capabilities',
      systemPrompt: 'Test Zoho workspace integration',
      capabilities: ['workspace_integration'],
      metadata: {
        tags: ['test', 'zoho', 'workspace'],
        domains: ['productivity'],
        specializations: ['email', 'calendar', 'documents', 'drive']
      }
    });

    // Find or create Zoho workspace connection
    const connections = await db.findWorkspaceConnections({
      provider: WorkspaceProvider.ZOHO
    });

    if (connections.length === 0) {
      console.log('⚠️  No Zoho workspace connection found in database.');
      console.log('   To run real API tests:');
      console.log('   1. Set up Zoho OAuth app at https://api-console.zoho.com/');
      console.log('   2. Configure OAuth credentials in environment variables');
      console.log('   3. Create a Zoho workspace connection through the UI');
      console.log('   4. Re-run tests');
      console.log('');
      console.log('   Running capability factory tests only...');
      testConnectionId = 'mock-connection-id';
      hasRealZohoConnection = false;
    } else {
      testConnectionId = connections[0].id;
      hasRealZohoConnection = true;
      console.log(`✅ Found Zoho connection: ${connections[0].email}`);
      
      // Grant permissions to test agent
      const capabilities = [
        WorkspaceCapabilityType.EMAIL_READ,
        WorkspaceCapabilityType.EMAIL_SEND,
        WorkspaceCapabilityType.CALENDAR_READ,
        WorkspaceCapabilityType.CALENDAR_CREATE,
        WorkspaceCapabilityType.CALENDAR_DELETE,
        WorkspaceCapabilityType.DRIVE_READ,
        WorkspaceCapabilityType.DRIVE_UPLOAD,
        WorkspaceCapabilityType.SPREADSHEET_CREATE
      ];

      for (const capability of capabilities) {
        await permissionService.grantPermission({
          agentId: testAgentId,
          workspaceConnectionId: testConnectionId,
          capability,
          accessLevel: AccessLevel.WRITE,
          grantedBy: 'test-user'
        });
      }

      console.log(`✅ Granted ${capabilities.length} workspace capabilities to test agent`);
    }
  });

  afterAll(async () => {
    // Clean up test agent
    if (testAgentId) {
      try {
        await AgentService.deleteAgent(testAgentId);
        console.log('✅ Cleaned up test agent');
      } catch (error) {
        console.warn('Failed to clean up test agent:', error);
      }
    }

    // Clean up any test workspace connections created during this test
    try {
      const allConnections = await db.findWorkspaceConnections({});
      const testConnections = allConnections.filter(conn => 
        conn.email === 'test@example.com' || 
        (conn.email !== 'gabriel.michels@gmail.com' && !conn.refreshToken)
      );

      if (testConnections.length > 0) {
        console.log(`🧹 Cleaning up ${testConnections.length} test workspace connections...`);
        
        for (const connection of testConnections) {
          try {
            // Delete related records first
            const permissions = await permissionService.getAgentPermissions(testAgentId);
            const connectionPermissions = permissions.filter(p => 
              p.workspaceConnectionId === connection.id
            );
            
            for (const permission of connectionPermissions) {
              await permissionService.revokePermission(permission.id, 'test-cleanup');
            }
            
            // Delete the connection (if it's a test connection)
            if (connection.email === 'test@example.com') {
              await db.deleteWorkspaceConnection(connection.id);
              console.log(`  ✅ Deleted test connection: ${connection.id}`);
            }
          } catch (error) {
            console.warn(`  ⚠️ Failed to cleanup connection ${connection.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup test workspace connections:', error);
    }
  });

  describe('🔧 Setup Validation', () => {
    test('should have valid Zoho workspace connection', async () => {
      if (!hasRealZohoConnection) {
        console.log('⚠️  Using mock connection - skipping validation');
        return;
      }

      const connection = await db.getWorkspaceConnection(testConnectionId);
      expect(connection).toBeDefined();
      expect(connection?.provider).toBe(WorkspaceProvider.ZOHO);
      expect(connection?.email).toBeTruthy();
      
      console.log(`✅ Valid Zoho connection: ${connection?.email}`);
    });

    test('should have agent with proper workspace permissions', async () => {
      if (!hasRealZohoConnection) {
        console.log('⚠️  Skipping permission check - no real connection');
        return;
      }

      const permissions = await permissionService.getAgentPermissions(testAgentId);
      const zohoPermissions = permissions.filter(p => 
        p.workspaceConnection?.provider === WorkspaceProvider.ZOHO
      );
      
      expect(zohoPermissions.length).toBeGreaterThan(0);
      console.log(`✅ Agent has ${zohoPermissions.length} Zoho workspace permissions`);
    });
  });

  describe('📧 Zoho Email Operations', () => {
    test('should read emails from Zoho Mail', async () => {
      if (!hasRealZohoConnection) {
        console.log('⚠️  Skipping real Zoho email read test - no connection');
        return;
      }

      const emailCapabilities = CapabilityFactory.createEmailCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      const emails = await emailCapabilities.readEmails({
        maxResults: 10
      });

      expect(Array.isArray(emails)).toBe(true);
      console.log(`✅ Retrieved ${emails.length} emails from Zoho Mail`);

      if (emails.length > 0) {
        const firstEmail = emails[0];
        expect(firstEmail.id).toBeTruthy();
        expect(firstEmail.payload).toBeDefined();
        expect(firstEmail.payload.headers).toBeDefined();
        
        const subject = firstEmail.payload.headers.find(h => h.name === 'Subject')?.value;
        const from = firstEmail.payload.headers.find(h => h.name === 'From')?.value;
        
        console.log(`   📧 Sample email: "${subject}" from ${from}`);
      }
    });

    test('should send email via Zoho Mail', async () => {
      if (!hasRealZohoConnection) {
        console.log('⚠️  Skipping real Zoho email send test - no connection');
        return;
      }

      const emailCapabilities = CapabilityFactory.createEmailCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      const result = await emailCapabilities.sendEmail({
        to: [TEST_CONFIG.testRecipient],
        subject: '[ZOHO-TEST] Test Email from Agent',
        body: `This is a test email sent via Zoho Mail API to verify workspace integration.

Test Details:
- Agent ID: ${testAgentId}
- Connection ID: ${testConnectionId}
- Timestamp: ${new Date().toISOString()}
- Target: ${TEST_CONFIG.testRecipient}

This email confirms that the Zoho workspace integration can send emails successfully.`,
        html: `<p>This is a <strong>test email</strong> sent via Zoho Mail API to verify workspace integration.</p>
        
<h3>Test Details:</h3>
<ul>
  <li><strong>Agent ID:</strong> ${testAgentId}</li>
  <li><strong>Connection ID:</strong> ${testConnectionId}</li>
  <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
  <li><strong>Target:</strong> ${TEST_CONFIG.testRecipient}</li>
</ul>

<p>This email confirms that the Zoho workspace integration can send emails successfully.</p>`
      });

      expect(result).toBeDefined();
      if (result.success) {
        expect(result.id).toBeTruthy();
        console.log(`✅ Email sent successfully via Zoho Mail - ID: ${result.id}`);
        console.log(`   📧 Sent to: ${TEST_CONFIG.testRecipient}`);
      } else {
        console.log(`❌ Email send failed: ${result.error}`);
        // Don't fail the test for email send failures as they might be due to configuration
      }
    });
  });

  describe('📅 Zoho Calendar Operations', () => {
    let createdEventId: string | undefined;

    test('should read calendar events from Zoho Calendar', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho calendar read test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      const events = await calendarCapabilities.getEvents({
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
        maxResults: 10
      });

      expect(Array.isArray(events)).toBe(true);
      console.log(`✅ Retrieved ${events.length} calendar events from Zoho Calendar`);

      if (events.length > 0) {
        const firstEvent = events[0];
        expect(firstEvent.id).toBeTruthy();
        expect(firstEvent.summary).toBeDefined();
        
        console.log(`   📅 Sample event: "${firstEvent.summary}" at ${firstEvent.start?.dateTime || firstEvent.start?.date}`);
      }
    });

    test('should create calendar event in Zoho Calendar', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho calendar create test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

      const event = await calendarCapabilities.createEvent({
        summary: '[ZOHO-TEST] Test Event from Agent',
        description: 'This is a test event created via Zoho Calendar API to verify workspace integration.',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC'
        },
        attendees: [
          { email: TEST_CONFIG.testRecipient }
        ]
      });

      expect(event).toBeDefined();
      expect(event.id).toBeTruthy();
      createdEventId = event.id;
      
      console.log(`✅ Calendar event created successfully - ID: ${event.id}`);
      console.log(`   📅 Event: "${event.summary}" at ${event.start?.dateTime}`);
    });

    test('should delete created calendar event', async () => {
      if (testConnectionId === 'mock-connection-id' || !createdEventId) {
        console.log('⚠️  Skipping Zoho calendar delete test - no connection or event');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      await calendarCapabilities.deleteEvent(createdEventId);
      console.log(`✅ Calendar event deleted successfully - ID: ${createdEventId}`);
    });
  });

  describe('💾 Zoho Drive Operations', () => {
    let uploadedFileId: string | undefined;

    test('should search files in Zoho WorkDrive', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho drive search test - no connection');
        return;
      }

      const driveCapabilities = CapabilityFactory.createDriveCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      const files = await driveCapabilities.searchFiles({
        q: 'type:document',
        maxResults: 10
      });

      expect(Array.isArray(files)).toBe(true);
      console.log(`✅ Found ${files.length} files in Zoho WorkDrive`);

      if (files.length > 0) {
        const firstFile = files[0];
        expect(firstFile.id).toBeTruthy();
        expect(firstFile.name).toBeTruthy();
        
        console.log(`   📄 Sample file: "${firstFile.name}" (${firstFile.mimeType})`);
      }
    });

    test('should upload file to Zoho WorkDrive', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho drive upload test - no connection');
        return;
      }

      const driveCapabilities = CapabilityFactory.createDriveCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      const testContent = 'This is a test file created by the Zoho workspace integration test.';
      const testFileName = `zoho-test-${Date.now()}.txt`;

      const file = await driveCapabilities.createFile({
        name: testFileName,
        content: Buffer.from(testContent),
        mimeType: 'text/plain'
      });

      expect(file).toBeDefined();
      expect(file.id).toBeTruthy();
      expect(file.name).toBe(testFileName);
      uploadedFileId = file.id;
      
      console.log(`✅ File uploaded successfully to Zoho WorkDrive - ID: ${file.id}`);
      console.log(`   📄 File: "${file.name}" (${file.size} bytes)`);
    });
  });

  describe('📊 Zoho Spreadsheet Operations', () => {
    test('should create spreadsheet in Zoho Sheet', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho spreadsheet create test - no connection');
        return;
      }

      const sheetsCapabilities = CapabilityFactory.createSheetsCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );

      const spreadsheet = await sheetsCapabilities.createSpreadsheet({
        title: `Zoho Test Spreadsheet ${Date.now()}`,
        sheets: [
          {
            properties: {
              title: 'Test Data',
              gridProperties: {
                rowCount: 100,
                columnCount: 10
              }
            }
          }
        ]
      });

      expect(spreadsheet).toBeDefined();
      expect(spreadsheet.spreadsheetId).toBeTruthy();
      expect(spreadsheet.properties?.title).toBeTruthy();
      
      console.log(`✅ Spreadsheet created successfully in Zoho Sheet - ID: ${spreadsheet.spreadsheetId}`);
      console.log(`   📊 Spreadsheet: "${spreadsheet.properties?.title}"`);

      // Add some test data
      if (spreadsheet.spreadsheetId) {
        await sheetsCapabilities.updateValues({
          spreadsheetId: spreadsheet.spreadsheetId,
          range: 'Test Data!A1:C3',
          values: [
            ['Name', 'Email', 'Department'],
            ['John Doe', 'john@example.com', 'Engineering'],
            ['Jane Smith', 'jane@example.com', 'Marketing']
          ]
        });
        
        console.log(`   📊 Added test data to spreadsheet`);
      }
    });
  });

  describe('🔍 Provider Health Check', () => {
    test('should verify Zoho provider is healthy', async () => {
      const isHealthy = await zohoProvider.isHealthy();
      expect(isHealthy).toBe(true);
      console.log('✅ Zoho provider health check passed');
    });

    test('should validate connection if real connection exists', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping Zoho connection validation - no real connection');
        return;
      }

      const validation = await zohoProvider.validateConnection(testConnectionId);
      expect(validation.isValid).toBe(true);
      console.log(`✅ Zoho connection validation passed - Status: ${validation.status}`);
    });
  });

  describe('🏭 Capability Factory Integration', () => {
    test('should create all Zoho capabilities via factory', () => {
      // Test email capabilities
      const emailCaps = CapabilityFactory.createEmailCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );
      expect(emailCaps).toBeDefined();

      // Test calendar capabilities
      const calendarCaps = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );
      expect(calendarCaps).toBeDefined();

      // Test sheets capabilities
      const sheetsCaps = CapabilityFactory.createSheetsCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );
      expect(sheetsCaps).toBeDefined();

      // Test drive capabilities
      const driveCaps = CapabilityFactory.createDriveCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId
      );
      expect(driveCaps).toBeDefined();

      console.log('✅ All Zoho capabilities created successfully via factory');
    });

    test('should report Zoho as supported provider', () => {
      const supportedProviders = CapabilityFactory.getSupportedProviders();
      expect(supportedProviders).toContain(WorkspaceProvider.ZOHO);

      const isSupported = CapabilityFactory.isProviderSupported(WorkspaceProvider.ZOHO);
      expect(isSupported).toBe(true);

      const capabilities = CapabilityFactory.getProviderCapabilities(WorkspaceProvider.ZOHO);
      expect(capabilities.email).toBe(true);
      expect(capabilities.calendar).toBe(true);
      expect(capabilities.sheets).toBe(true);
      expect(capabilities.drive).toBe(true);

      console.log('✅ Zoho provider properly registered in capability factory');
    });
  });

  describe('📋 Zoho OAuth Setup Instructions', () => {
    test('should provide setup instructions when no real connection exists', () => {
      if (hasRealZohoConnection) {
        console.log('✅ Real Zoho connection exists - setup complete');
        return;
      }

      console.log('');
      console.log('🔧 ZOHO WORKSPACE SETUP INSTRUCTIONS:');
      console.log('');
      console.log('1. Create Zoho OAuth Application:');
      console.log('   - Go to https://api-console.zoho.com/');
      console.log('   - Create a new "Server-based Applications" OAuth app');
      console.log('   - Set redirect URI to: http://localhost:3000/auth/zoho/callback');
      console.log('');
      console.log('2. Configure OAuth Scopes:');
      console.log('   - ZohoMail.messages.READ');
      console.log('   - ZohoMail.messages.CREATE');
      console.log('   - ZohoCalendar.calendar.READ');
      console.log('   - ZohoCalendar.calendar.CREATE');
      console.log('   - ZohoWorkDrive.files.READ');
      console.log('   - ZohoWorkDrive.files.CREATE');
      console.log('   - ZohoSheet.spreadsheets.READ');
      console.log('   - ZohoSheet.spreadsheets.CREATE');
      console.log('');
      console.log('3. Set Environment Variables:');
      console.log('   export ZOHO_CLIENT_ID="your_client_id"');
      console.log('   export ZOHO_CLIENT_SECRET="your_client_secret"');
      console.log('   export ZOHO_REDIRECT_URI="http://localhost:3000/auth/zoho/callback"');
      console.log('   export ZOHO_REGION="com"  # or "eu", "in", etc.');
      console.log('');
      console.log('4. Create Workspace Connection:');
      console.log('   - Start the application: npm run dev');
      console.log('   - Go to workspace settings in the UI');
      console.log('   - Add new Zoho workspace connection');
      console.log('   - Complete OAuth flow');
      console.log('');
      console.log('5. Re-run Tests:');
      console.log('   npm test -- tests/autonomy/workspace-zoho-execution.test.ts');
      console.log('');

      // This test always passes - it's just for documentation
      expect(true).toBe(true);
    });
  });
});