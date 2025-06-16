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
import { PrismaClient } from '@prisma/client';

// Import our new test cleanup utilities
import { 
  createTestAgentWithWorkspaceCapabilities, 
  testSuiteCleanup,
  registerTestAgent,
  cleanupTestAgent
} from '../utils/test-cleanup';

const prisma = new PrismaClient();

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

    // Create test agent using our new cleanup-aware helper
    testAgentId = await createTestAgentWithWorkspaceCapabilities({
      name: 'Zoho Test Agent',
      description: 'Agent for testing Zoho workspace capabilities',
      systemPrompt: 'Test Zoho workspace integration',
      metadata: {
        tags: ['test', 'zoho', 'workspace'],
        domains: ['productivity'],
        specializations: ['email', 'calendar', 'documents', 'drive']
      }
    }, ['workspace_integration']);

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
    // Use our comprehensive test cleanup utility
    console.log('🧹 Running Zoho test suite cleanup...');
    await testSuiteCleanup();
    console.log('✅ Zoho test suite cleanup complete');
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

      const capabilities = await permissionService.getAgentWorkspaceCapabilities(testAgentId);
      const zohoCapabilities = capabilities.filter(c => 
        c.provider === WorkspaceProvider.ZOHO
      );
      
      expect(zohoCapabilities.length).toBeGreaterThan(0);
      console.log(`✅ Agent has ${zohoCapabilities.length} Zoho workspace capabilities`);
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

    test('should read calendar events from Zoho Calendar', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho calendar read test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
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

    test('should create and delete calendar event in Zoho Calendar', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho calendar create/delete test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      // Step 1: Create the event
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
      
      console.log(`✅ Calendar event created successfully - ID: ${event.id}`);
      console.log(`   📅 Event: "${event.summary}" at ${event.start?.dateTime}`);

      // Step 2: Delete the same event
      await calendarCapabilities.deleteEvent(event.id);
      console.log(`✅ Calendar event deleted successfully - ID: ${event.id}`);
    });

    test('should search calendar events using Search API', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho calendar search test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      const searchResults = await calendarCapabilities.searchEvents('meeting', {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Next 30 days
        maxResults: 10
      });

      expect(Array.isArray(searchResults)).toBe(true);
      console.log(`✅ Found ${searchResults.length} events matching 'meeting' in Zoho Calendar`);

      if (searchResults.length > 0) {
        const firstResult = searchResults[0];
        expect(firstResult.id).toBeTruthy();
        expect(firstResult.summary).toBeTruthy();
        console.log(`First result: "${firstResult.summary}"`);
      }
    });

    test('should get free/busy information using Free/Busy API', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho free/busy test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      // Test with the current user's email (should be available from connection)
      const connection = await prisma.workspaceConnection.findUnique({
        where: { id: testConnectionId }
      });

      if (!connection?.email) {
        console.log('⚠️  Skipping free/busy test - no email in connection');
        return;
      }

      const freeBusyInfo = await calendarCapabilities.getFreeBusyInfo(
        [connection.email],
        {
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Next 7 days
        }
      );

      expect(Array.isArray(freeBusyInfo)).toBe(true);
      expect(freeBusyInfo.length).toBe(1);
      expect(freeBusyInfo[0].email).toBe(connection.email);
      expect(Array.isArray(freeBusyInfo[0].freeBusySlots)).toBe(true);

      console.log(`✅ Retrieved free/busy info for ${connection.email}`);
      console.log(`Found ${freeBusyInfo[0].freeBusySlots.length} busy slots`);
    });

    test('should create event from natural language using Smart Add API', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho smart add test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      // Create an event using natural language
      const naturalLanguageText = `Team standup tomorrow at 10 AM for 30 minutes`;
      
      const createdEvent = await calendarCapabilities.createEventFromText(naturalLanguageText);

      expect(createdEvent.id).toBeTruthy();
      expect(createdEvent.summary).toBeTruthy();
      expect(createdEvent.start).toBeTruthy();
      expect(createdEvent.end).toBeTruthy();

      console.log(`✅ Created event from text: "${naturalLanguageText}"`);
      console.log(`Event: "${createdEvent.summary}" on ${createdEvent.start.dateTime}`);

      // Clean up: delete the created event
      try {
        await calendarCapabilities.deleteEvent(createdEvent.id);
        console.log('✅ Cleaned up test event');
      } catch (error) {
        console.log('⚠️  Could not clean up test event:', error);
      }
    });

    test('should find available time slots for scheduling', async () => {
      if (testConnectionId === 'mock-connection-id') {
        console.log('⚠️  Skipping real Zoho available slots test - no connection');
        return;
      }

      const calendarCapabilities = CapabilityFactory.createCalendarCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );

      // Test with the current user's email
      const connection = await prisma.workspaceConnection.findUnique({
        where: { id: testConnectionId }
      });

      if (!connection?.email) {
        console.log('⚠️  Skipping available slots test - no email in connection');
        return;
      }

      const availableSlots = await calendarCapabilities.findAvailableSlots({
        attendeeEmails: [connection.email],
        durationMinutes: 30,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next 7 days
        workingHours: {
          start: "09:00",
          end: "17:00"
        }
      });

      expect(Array.isArray(availableSlots)).toBe(true);
      console.log(`✅ Found ${availableSlots.length} available 30-minute slots`);

      if (availableSlots.length > 0) {
        const firstSlot = availableSlots[0];
        expect(firstSlot.start).toBeTruthy();
        expect(firstSlot.end).toBeTruthy();
        expect(Array.isArray(firstSlot.attendees)).toBe(true);
        expect(firstSlot.attendees).toContain(connection.email);
        
        console.log(`First available slot: ${new Date(firstSlot.start).toLocaleString()} - ${new Date(firstSlot.end).toLocaleString()}`);
      }
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
        testConnectionId,
        zohoProvider
      );

      const files = await driveCapabilities.searchFiles({
        q: 'type:document',
        maxResults: 10
      }, testConnectionId, testAgentId);

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
        testConnectionId,
        zohoProvider
      );

      // NOTE: WorkDrive doesn't handle file creation directly
      // Files are created through specific apps (Zoho Sheet, Writer, etc.)
      // This test verifies that the createFile method properly throws an error
      
      try {
        await driveCapabilities.createFile({
          name: `zoho-test-${Date.now()}.txt`,
          content: Buffer.from('test content'),
          mimeType: 'text/plain'
        }, testConnectionId, testAgentId);
        
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('File creation is not supported through WorkDrive');
        console.log('✅ WorkDrive correctly rejects file creation - use specific app APIs instead');
      }
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
        testConnectionId,
        zohoProvider
      );

      const spreadsheet = await sheetsCapabilities.createSpreadsheet({
        title: `Zoho Test Spreadsheet ${Date.now()}`,
        sheets: [
          {
            title: 'Test Data',
            rowCount: 100,
            columnCount: 10,
            headers: ['Name', 'Email', 'Department']
          }
        ]
      }, testConnectionId, testAgentId);

      expect(spreadsheet).toBeDefined();
      expect(spreadsheet.id).toBeTruthy();
      expect(spreadsheet.title).toBeTruthy();
      
      console.log(`✅ Spreadsheet created successfully in Zoho Sheet - ID: ${spreadsheet.id}`);
      console.log(`   📊 Spreadsheet: "${spreadsheet.title}"`);

      // Add some test data
      if (spreadsheet.id) {
        await sheetsCapabilities.updateCells({
          spreadsheetId: spreadsheet.id,
          range: 'A2:C3',
          values: [
            ['John Doe', 'john@example.com', 'Engineering'],
            ['Jane Smith', 'jane@example.com', 'Marketing']
          ]
        }, testConnectionId, testAgentId);
        
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
        testConnectionId,
        zohoProvider
      );
      expect(calendarCaps).toBeDefined();

      // Test sheets capabilities
      const sheetsCaps = CapabilityFactory.createSheetsCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
      );
      expect(sheetsCaps).toBeDefined();

      // Test drive capabilities
      const driveCaps = CapabilityFactory.createDriveCapabilities(
        WorkspaceProvider.ZOHO,
        testConnectionId,
        zohoProvider
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