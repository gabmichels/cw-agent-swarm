import fs from 'fs';
import path from 'path';

export interface StateData {
  tenantId: string;
  userId: string;
  accountType?: string;
  timestamp: number;
  codeVerifier?: string; // For PKCE support
}

const STATE_FILE = path.join(process.cwd(), 'storage', 'oauth-states.json');

// Ensure storage directory exists
function ensureStorageDir() {
  const storageDir = path.dirname(STATE_FILE);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
}

// Load states from file
function loadStates(): Record<string, StateData> {
  try {
    ensureStorageDir();
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading states:', error);
  }
  return {};
}

// Save states to file
function saveStates(states: Record<string, StateData>) {
  try {
    ensureStorageDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(states, null, 2));
  } catch (error) {
    console.error('Error saving states:', error);
  }
}

// Clean up expired states
function cleanupExpiredStates() {
  const states = loadStates();
  const now = Date.now();
  let hasChanges = false;

  for (const [state, data] of Object.entries(states)) {
    // Remove states older than 10 minutes
    if (now - data.timestamp > 10 * 60 * 1000) {
      delete states[state];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    saveStates(states);
    console.log('Cleaned up expired OAuth states');
  }
}

export const fileStateStorage = {
  set(key: string, value: StateData): void {
    console.log('FileStateStorage.set called:', { key, value });
    const states = loadStates();
    states[key] = value;
    saveStates(states);
    console.log('State saved to file');
  },

  get(key: string): StateData | undefined {
    const states = loadStates();
    const result = states[key];
    console.log('FileStateStorage.get called:', { key, found: !!result, result });
    return result;
  },

  delete(key: string): boolean {
    const states = loadStates();
    const existed = key in states;
    if (existed) {
      delete states[key];
      saveStates(states);
    }
    console.log('FileStateStorage.delete called:', { key, deleted: existed });
    return existed;
  },

  entries(): [string, StateData][] {
    const states = loadStates();
    const entries = Object.entries(states);
    console.log('FileStateStorage.entries called, count:', entries.length);
    return entries;
  },

  size(): number {
    const states = loadStates();
    return Object.keys(states).length;
  },

  cleanup(): void {
    cleanupExpiredStates();
  }
}; 