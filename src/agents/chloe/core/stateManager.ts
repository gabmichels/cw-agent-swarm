import { ChloeState } from '../types/state';
import { TaskLogger } from '../task-logger';
import * as serverQdrant from '../../../server/qdrant';

interface StateCheckpoint {
  id: string;
  state: ChloeState;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class StateManager {
  private checkpoints: StateCheckpoint[] = [];
  private currentState: ChloeState | null = null;
  private readonly maxCheckpoints: number = 10;
  private readonly taskLogger: TaskLogger | undefined;
  private readonly stateCollection: string = 'agent_states';

  constructor(taskLogger?: TaskLogger) {
    this.taskLogger = taskLogger;
  }

  /**
   * Create a checkpoint of the current state
   */
  async createCheckpoint(state: ChloeState, metadata?: Record<string, any>): Promise<string> {
    try {
      const checkpoint: StateCheckpoint = {
        id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        state,
        timestamp: new Date(),
        metadata
      };

      // Add to memory
      this.checkpoints.push(checkpoint);
      
      // Trim old checkpoints if we exceed the limit
      if (this.checkpoints.length > this.maxCheckpoints) {
        this.checkpoints = this.checkpoints.slice(-this.maxCheckpoints);
      }

      // Persist to Qdrant if available
      if (typeof window === 'undefined') {
        try {
          const embedding = await serverQdrant.getEmbedding(JSON.stringify(state));
          await serverQdrant.addToCollection(this.stateCollection, embedding.embedding, {
            checkpoint,
            type: 'state_checkpoint'
          });
        } catch (error) {
          console.error('Error persisting checkpoint to Qdrant:', error);
        }
      }

      this.taskLogger?.logAction('Created state checkpoint', {
        checkpointId: checkpoint.id,
        timestamp: checkpoint.timestamp
      });

      return checkpoint.id;
    } catch (error) {
      console.error('Error creating checkpoint:', error);
      throw error;
    }
  }

  /**
   * Restore state from a checkpoint
   */
  async restoreCheckpoint(checkpointId: string): Promise<ChloeState | null> {
    try {
      // First try to find in memory
      const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
      if (checkpoint) {
        this.currentState = checkpoint.state;
        return checkpoint.state;
      }

      // If not in memory, try to load from Qdrant
      if (typeof window === 'undefined') {
        try {
          const embedding = await serverQdrant.getEmbedding(checkpointId);
          const results = await serverQdrant.search(this.stateCollection, embedding.embedding, 1);
          if (results.length > 0) {
            const checkpoint = results[0].payload.checkpoint as StateCheckpoint;
            this.currentState = checkpoint.state;
            return checkpoint.state;
          }
        } catch (error) {
          console.error('Error loading checkpoint from Qdrant:', error);
        }
      }

      return null;
    } catch (error) {
      console.error('Error restoring checkpoint:', error);
      return null;
    }
  }

  /**
   * Rollback to a previous state
   */
  async rollback(checkpointId: string): Promise<boolean> {
    try {
      const restoredState = await this.restoreCheckpoint(checkpointId);
      if (!restoredState) {
        return false;
      }

      // Create a new checkpoint of the rollback
      await this.createCheckpoint(restoredState, {
        type: 'rollback',
        fromCheckpoint: checkpointId
      });

      this.taskLogger?.logAction('Rolled back to checkpoint', {
        checkpointId,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error rolling back state:', error);
      return false;
    }
  }

  /**
   * Get the current state
   */
  getCurrentState(): ChloeState | null {
    return this.currentState;
  }

  /**
   * Set the current state
   */
  setCurrentState(state: ChloeState): void {
    this.currentState = state;
  }

  /**
   * Get all available checkpoints
   */
  getCheckpoints(): StateCheckpoint[] {
    return [...this.checkpoints];
  }

  /**
   * Clear all checkpoints
   */
  async clearCheckpoints(): Promise<void> {
    this.checkpoints = [];
    
    if (typeof window === 'undefined') {
      try {
        await serverQdrant.resetCollection('document');
      } catch (error) {
        console.error('Error clearing checkpoints from Qdrant:', error);
      }
    }
  }
} 