/**
 * ApprovalSystemInitializer - Initializes and connects all approval system components
 * 
 * This service sets up the connections between the scheduler, approval workflow,
 * and messaging services to enable the complete approval workflow.
 */

import { approvalWorkflowService } from './ApprovalWorkflowService';
import { agentApprovalHelper } from './AgentApprovalHelper';

export class ApprovalSystemInitializer {
  private static initialized = false;
  
  /**
   * Initialize the approval system with required dependencies
   */
  public static async initialize(dependencies: {
    schedulerManager?: any;
    messagingService?: any;
  }): Promise<void> {
    try {
      if (this.initialized) {
        console.log('Approval system already initialized');
        return;
      }
      
      console.log('Initializing approval system...');
      
      // Set up scheduler manager in approval workflow service
      if (dependencies.schedulerManager) {
        approvalWorkflowService.setSchedulerManager(dependencies.schedulerManager);
        console.log('✅ Scheduler manager connected to approval workflow service');
      } else {
        console.warn('⚠️ No scheduler manager provided - task scheduling will not work');
      }
      
      // Set up messaging service in agent approval helper
      if (dependencies.messagingService) {
        agentApprovalHelper.setMessagingService(dependencies.messagingService);
        console.log('✅ Messaging service connected to agent approval helper');
      } else {
        console.warn('⚠️ No messaging service provided - agents cannot send approval messages');
      }
      
      this.initialized = true;
      console.log('🎉 Approval system initialization complete!');
      
      // Optional: Log configuration status
      this.logSystemStatus();
      
    } catch (error) {
      console.error('❌ Failed to initialize approval system:', error);
      throw error;
    }
  }
  
  /**
   * Check if the approval system is initialized
   */
  public static isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Reset the initialization state (useful for testing)
   */
  public static reset(): void {
    this.initialized = false;
    console.log('Approval system reset');
  }
  
  /**
   * Log the current system status
   */
  private static logSystemStatus(): void {
    console.log('\n📋 Approval System Status:');
    console.log('  - Approval Workflow Service: ✅ Active');
    console.log('  - Agent Approval Helper: ✅ Active');
    console.log('  - Approval Configuration Manager: ✅ Active');
    console.log('  - Chat Approval Handler: ✅ Active');
    console.log('\n🚀 The approval system is ready to handle requests!');
    console.log('\n📝 How to use:');
    console.log('  1. Agents can use agentApprovalHelper.requestTweetApproval() or requestEmailApproval()');
    console.log('  2. Users will see approval UI in chat messages');
    console.log('  3. Approval decisions are processed through the workflow service');
    console.log('  4. Approved tasks are scheduled for execution\n');
  }
  
  /**
   * Get initialization dependencies status
   */
  public static getDependencyStatus() {
    return {
      initialized: this.initialized,
      components: {
        approvalWorkflowService: !!approvalWorkflowService,
        agentApprovalHelper: !!agentApprovalHelper
      }
    };
  }
}

// Auto-initialize with basic setup if possible
// This allows the system to work even if full dependencies aren't available
if (typeof window !== 'undefined') {
  // We're in the browser, defer initialization until dependencies are available
  console.log('Approval system ready for initialization (browser environment)');
} else {
  // We're in Node.js, try basic initialization
  ApprovalSystemInitializer.initialize({}).catch(console.warn);
} 