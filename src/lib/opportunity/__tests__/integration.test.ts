/**
 * Integration tests for the Opportunity Management System
 * 
 * These tests verify that the system works correctly as an integrated whole
 * without using adapters.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import {
  createOpportunitySystem,
  OpportunityStorageType,
  OpportunityType,
  OpportunityPriority,
  OpportunityStatus,
  TimeSensitivity,
  OpportunitySource
} from '../index';

describe('Opportunity Management System - Integration', () => {
  const testDir = path.join(os.tmpdir(), 'opportunity-test-' + Date.now());
  
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('should create, evaluate, and process opportunities', async () => {
    // Create the opportunity system with file-based storage
    const opportunitySystem = createOpportunitySystem({
      storage: {
        type: OpportunityStorageType.FILE,
        storageDir: testDir,
        saveOnMutation: true
      },
      autoEvaluate: false // Disable auto-evaluation for testing
    });
    
    // Initialize the system
    await expect(opportunitySystem.initialize()).resolves.toBe(true);
    
    // Create an opportunity
    const opportunity = await opportunitySystem.createOpportunity({
      title: 'Test Task Opportunity',
      description: 'This is a test opportunity for integration testing',
      type: OpportunityType.TASK_OPTIMIZATION,
      priority: OpportunityPriority.MEDIUM,
      source: OpportunitySource.USER_INTERACTION,
      trigger: {
        type: 'test',
        source: OpportunitySource.USER_INTERACTION,
        content: 'Test trigger content',
        confidence: 0.85,
        timestamp: new Date(),
        context: {}
      },
      context: {
        agentId: 'test-agent',
        source: 'test-source',
        metadata: {}
      },
      timeSensitivity: TimeSensitivity.STANDARD,
      tags: ['test', 'integration']
    });
    
    // Verify opportunity was created
    expect(opportunity).toBeDefined();
    expect(opportunity.id).toBeDefined();
    expect(opportunity.status).toBe(OpportunityStatus.DETECTED);
    
    // Retrieve the opportunity
    const retrieved = await opportunitySystem.getOpportunityById(opportunity.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(opportunity.id);
    
    // Update opportunity status
    const updated = await opportunitySystem.updateOpportunityStatus(
      opportunity.id,
      OpportunityStatus.EVALUATING
    );
    expect(updated).toBeDefined();
    expect(updated?.status).toBe(OpportunityStatus.EVALUATING);
    
    // Find opportunities
    const opportunities = await opportunitySystem.findOpportunities({
      statuses: [OpportunityStatus.EVALUATING]
    });
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].id).toBe(opportunity.id);
    
    // Update opportunity to PENDING
    const pendingOpp = await opportunitySystem.updateOpportunityStatus(
      opportunity.id,
      OpportunityStatus.PENDING
    );
    expect(pendingOpp?.status).toBe(OpportunityStatus.PENDING);
    
    // Complete opportunity
    const completed = await opportunitySystem.updateOpportunityStatus(
      opportunity.id,
      OpportunityStatus.COMPLETED,
      {
        completedAt: new Date(),
        successful: true,
        outcomeDescription: 'Test opportunity successfully completed'
      }
    );
    expect(completed?.status).toBe(OpportunityStatus.COMPLETED);
    expect(completed?.result).toBeDefined();
    expect(completed?.result?.successful).toBe(true);
    
    // Get health status
    const health = await opportunitySystem.getHealth();
    expect(health.isHealthy).toBe(true);
    
    // Verify filesystem storage
    const files = fs.readdirSync(testDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('opportunities.json');
    
    // Read the file to verify content
    const fileContent = fs.readFileSync(path.join(testDir, 'opportunities.json'), 'utf8');
    const data = JSON.parse(fileContent);
    expect(data.opportunities).toBeDefined();
    expect(data.opportunities.length).toBe(1);
    expect(data.opportunities[0].id).toBe(opportunity.id);
  });
}); 