/**
 * Server Configuration
 * 
 * Central configuration file for the agent system's server-side settings.
 * This allows controlling behavior through environment variables or defaults.
 */

export interface ServerConfig {
  /**
   * Debug settings
   */
  debug: {
    /** Enable enhanced debug mode with detailed logging */
    enabled: boolean;
    /** Debug log level */
    level: 'error' | 'warn' | 'info' | 'verbose' | 'debug';
  };
  
  /**
   * Agent system settings
   */
  agents: {
    /** Whether to automatically bootstrap agents on server start */
    autoBootstrap: boolean;
    /** Whether to load agents from database during bootstrap */
    loadFromDatabase: boolean;
  };
}

/**
 * Get boolean value from environment variable with default
 */
function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Default server configuration
 */
export const serverConfig: ServerConfig = {
  debug: {
    enabled: getBoolEnv('AGENT_DEBUG_MODE', false),
    level: (process.env.DEBUG_LEVEL || 'info') as ServerConfig['debug']['level'],
  },
  agents: {
    autoBootstrap: getBoolEnv('AGENT_AUTO_BOOTSTRAP', true),
    loadFromDatabase: getBoolEnv('AGENT_LOAD_FROM_DB', true),
  }
};

export default serverConfig; 