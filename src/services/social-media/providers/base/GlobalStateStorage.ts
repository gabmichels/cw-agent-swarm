/**
 * Global State Storage for OAuth flows
 * 
 * Simple module-level Map that persists across API calls in Next.js
 */

export interface StateData {
  tenantId: string;
  userId: string;
  accountType?: string;
  timestamp: number;
  agentId?: string; // Agent ID for automatic permission granting
}

// Simple module-level storage that persists across API calls
const stateStorage = new Map<string, StateData>();

// Clean up expired states periodically
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      const expiredStates: string[] = [];

      for (const [state, data] of stateStorage.entries()) {
        // Remove states older than 10 minutes
        if (now - data.timestamp > 10 * 60 * 1000) {
          expiredStates.push(state);
        }
      }

      expiredStates.forEach(state => stateStorage.delete(state));

      if (expiredStates.length > 0) {
        console.log(`Cleaned up ${expiredStates.length} expired OAuth states`);
      }
    }, 10 * 60 * 1000); // Run every 10 minutes
  }
}

// Start cleanup when module is loaded
startCleanup();

export const globalStateStorage = {
  set(key: string, value: StateData): void {
    console.log('GlobalStateStorage.set called:', { key, value });
    stateStorage.set(key, value);
    console.log('Storage size after set:', stateStorage.size);
  },

  get(key: string): StateData | undefined {
    const result = stateStorage.get(key);
    console.log('GlobalStateStorage.get called:', { key, found: !!result, result });
    return result;
  },

  delete(key: string): boolean {
    const result = stateStorage.delete(key);
    console.log('GlobalStateStorage.delete called:', { key, deleted: result });
    return result;
  },

  entries(): IterableIterator<[string, StateData]> {
    console.log('GlobalStateStorage.entries called, size:', stateStorage.size);
    return stateStorage.entries();
  },

  size(): number {
    return stateStorage.size;
  }
}; 