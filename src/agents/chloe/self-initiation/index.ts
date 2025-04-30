/**
 * Chloe Self-Initiation System
 * 
 * A system that enables Chloe to proactively identify opportunities and schedule
 * her own tasks without human triggering.
 */

import { ChloeAgent } from '../core/agent';
import { OpportunityDetector, DetectedOpportunity, OpportunitySource, TimeSensitivity } from './opportunityDetector';
import { AutonomousScheduler, ScheduledAutonomousTask } from './autonomousScheduler';
import { ImportanceLevel, MemorySource } from '../../../constants/memory';
import { StrategicToolPlanner } from '../strategy/strategicPlanner';

// The main self-initiation system that combines the opportunity detection and autonomous scheduling
export class ChloeSelfInitiationSystem {
  private agent: ChloeAgent;
  private opportunityDetector: OpportunityDetector;
  private autonomousScheduler: AutonomousScheduler;
  private isInitialized: boolean = false;
  private strategicPlanner: StrategicToolPlanner | null = null;

  constructor(agent: ChloeAgent) {
    this.agent = agent;
    this.opportunityDetector = new OpportunityDetector(agent);
    this.autonomousScheduler = new AutonomousScheduler(agent);
    
    // Connect the components
    this.autonomousScheduler.connectOpportunityDetector(this.opportunityDetector);
    
    console.log('ChloeSelfInitiationSystem initialized');
  }

  /**
   * Initialize the self-initiation system
   */
  public async initialize(options?: {
    autoStart?: boolean;
    requireApproval?: boolean;
    strategicPlanner?: StrategicToolPlanner;
  }): Promise<boolean> {
    try {
      // Set strategic planner if provided
      if (options?.strategicPlanner) {
        this.setStrategicPlanner(options.strategicPlanner);
      }
      
      // Set approval requirement
      if (options?.requireApproval !== undefined) {
        this.autonomousScheduler.setHumanApprovalRequired(options.requireApproval);
      }
      
      // Start the system if requested
      if (options?.autoStart) {
        this.start();
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing self-initiation system:', error);
      return false;
    }
  }

  /**
   * Start the self-initiation system
   */
  public start(): void {
    this.opportunityDetector.start();
    this.autonomousScheduler.enable(true);
    
    this.agent.notify('🚀 Chloe self-initiation system started');
    console.log('Self-initiation system started');
  }

  /**
   * Stop the self-initiation system
   */
  public stop(): void {
    this.opportunityDetector.stop();
    this.autonomousScheduler.enable(false);
    
    this.agent.notify('⏸️ Chloe self-initiation system stopped');
    console.log('Self-initiation system stopped');
  }

  /**
   * Set the strategic planner for opportunity scoring and task prioritization
   */
  public setStrategicPlanner(planner: StrategicToolPlanner): void {
    this.strategicPlanner = planner;
    this.opportunityDetector.setStrategicPlanner(planner);
    this.autonomousScheduler.setStrategicPlanner(planner);
  }

  /**
   * Get status of the self-initiation system
   */
  public getStatus(): {
    isActive: boolean;
    pendingTasks: number;
    opportunitiesDetected: number;
    requiresApproval: boolean;
    performanceMetrics: ReturnType<AutonomousScheduler['getPerformanceMetrics']>;
  } {
    const pendingTasks = this.autonomousScheduler.getTasks({ status: 'pending' }).length;
    const autoTasks = this.autonomousScheduler.getPerformanceMetrics();
    
    return {
      isActive: this.opportunityDetector['isActive'] && this.autonomousScheduler.isAutonomousEnabled(),
      pendingTasks,
      opportunitiesDetected: this.opportunityDetector.getOpportunities().length,
      requiresApproval: true, // We don't expose a getter for this but default to true
      performanceMetrics: autoTasks
    };
  }

  /**
   * Get the opportunity detector
   */
  public getOpportunityDetector(): OpportunityDetector {
    return this.opportunityDetector;
  }

  /**
   * Get the autonomous scheduler
   */
  public getAutonomousScheduler(): AutonomousScheduler {
    return this.autonomousScheduler;
  }

  /**
   * Request human approval for pending tasks
   */
  public async requestApproval(): Promise<void> {
    await this.autonomousScheduler.requestHumanApproval();
  }

  /**
   * Run a forced opportunity check
   */
  public async checkForOpportunities(): Promise<DetectedOpportunity[]> {
    return await this.opportunityDetector.checkOpportunities();
  }
}

// Export the classes
export { OpportunityDetector, AutonomousScheduler };

// Export the types
export type { 
  DetectedOpportunity, 
  OpportunitySource, 
  TimeSensitivity, 
  ScheduledAutonomousTask 
}; 