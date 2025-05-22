/**
 * Bootstrap with Debug Mode - Run this script to bootstrap agents with enhanced logging
 * 
 * This combines the bootstrap process with detailed debug logging.
 */

// Load environment variables
require('dotenv').config();

// Set debug environment variables first
process.env.DEBUG_LEVEL = 'verbose';
process.env.AGENT_DEBUG = 'true';
process.env.AUTONOMY_DEBUG = 'true';
process.env.CONSOLE_LOG_LEVEL = 'debug';
process.env.NODE_DEBUG = 'agent,autonomy,task,web-search';
process.env.LOG_LEVEL = 'debug'; // Set Winston logger level to debug

// Handle Next.js path aliases
const tsconfig = require('./tsconfig.json');
const moduleAlias = require('module-alias');

// Add path aliases from tsconfig
const pathAliases = tsconfig.compilerOptions.paths;
if (pathAliases) {
  const aliases = {};
  for (const [alias, pathValues] of Object.entries(pathAliases)) {
    // Convert alias patterns like "@/*" to "@"
    const key = alias.replace(/\/\*$/, '');
    // Use the first path pattern and remove the /* suffix
    const targetPath = pathValues[0].replace(/\/\*$/, '');
    aliases[key] = `${__dirname}/${targetPath}`;
  }
  moduleAlias.addAliases(aliases);
}

// Allow requiring TypeScript files
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2017',
  },
});

// Initialize logger directly from our CommonJS bootstrap logger
const { logger, createLogger, setLogLevel } = require('./bootstrap-logger');

// Force debug level logging
setLogLevel('debug');

// Create a dedicated logger for this bootstrap script
const bootstrapLogger = createLogger({ moduleId: 'bootstrap-debug' });

bootstrapLogger.info('🔍 Initializing debug mode with Winston logger...');

// Store original methods in case we need them
const originalConsole = { ...console };

// Patch the autonomy system to show more logs
const patchAutonomySystem = () => {
  try {
    // Load and patch the DefaultAutonomySystem
    const autonomySystemPath = './src/agents/shared/autonomy/systems/DefaultAutonomySystem';
    const autonomyModule = require(autonomySystemPath);
    const originalExecuteTask = autonomyModule.DefaultAutonomySystem.prototype.executeTask;
    const originalProcessOpportunity = autonomyModule.DefaultAutonomySystem.prototype.processOpportunity;
    const originalPlanAndExecuteTask = autonomyModule.DefaultAutonomySystem.prototype.planAndExecuteTask;

    // Create a logger specifically for autonomy system
    const autonomyLogger = createLogger({ moduleId: 'autonomy-system' });

    // Patch the executeTask method to add more logging
    autonomyModule.DefaultAutonomySystem.prototype.executeTask = async function(taskId) {
      autonomyLogger.debug(`Starting execution of task ${taskId}`, { action: 'execute-task' });
      const result = await originalExecuteTask.call(this, taskId);
      autonomyLogger.info(`Finished execution of task ${taskId}`, { 
        action: 'execute-task-complete',
        success: result ? true : false 
      });
      return result;
    };

    // Patch the processOpportunity method
    autonomyModule.DefaultAutonomySystem.prototype.processOpportunity = async function(opportunity) {
      autonomyLogger.info(`Processing opportunity of type "${opportunity.type}"`, { 
        opportunityId: opportunity.id,
        action: 'process-opportunity'
      });
      await originalProcessOpportunity.call(this, opportunity);
      autonomyLogger.info(`Processed opportunity ${opportunity.id}`, { action: 'opportunity-processed' });
    };

    // Patch the planAndExecuteTask method
    autonomyModule.DefaultAutonomySystem.prototype.planAndExecuteTask = async function(task, options) {
      autonomyLogger.info(`Planning execution for task: ${task.name || task.id}`, { action: 'plan-execution' });
      autonomyLogger.debug(`Task details`, {
        id: task.id,
        description: task.description,
        tags: task.tags
      });
      
      const result = await originalPlanAndExecuteTask.call(this, task, options);
      
      if (result.success) {
        autonomyLogger.success(`Plan execution completed successfully`, { taskId: task.id });
      } else {
        autonomyLogger.error(`Plan execution failed`, { 
          taskId: task.id,
          error: result.message || result.error
        });
      }
      
      return result;
    };

    bootstrapLogger.success('Successfully patched Autonomy System for enhanced logging');
  } catch (error) {
    bootstrapLogger.error('Failed to patch Autonomy System', { error });
  }
};

// Patch web search tool for more logging
const patchWebSearchTool = () => {
  try {
    const webSearchPath = './src/agents/shared/tools/web/ApifyWebSearchTool';
    const webSearchModule = require(webSearchPath);
    const originalExecute = webSearchModule.ApifyWebSearchTool.prototype.execute;
    
    // Create a dedicated logger for web search
    const webSearchLogger = createLogger({ moduleId: 'web-search-tool' });
    
    webSearchModule.ApifyWebSearchTool.prototype.execute = async function(args) {
      webSearchLogger.info(`Starting web search`, { query: args.query });
      const result = await originalExecute.call(this, args);
      
      if (result.success) {
        webSearchLogger.success(`Web search completed successfully`, { 
          resultCount: Array.isArray(result.data) ? result.data.length : 0
        });
      } else {
        webSearchLogger.error(`Web search failed`, { 
          query: args.query,
          error: result.error
        });
      }
      
      return result;
    };
    
    bootstrapLogger.success('Successfully patched Web Search Tool for enhanced logging');
  } catch (error) {
    bootstrapLogger.error('Failed to patch Web Search Tool', { error });
  }
};

// Apply all patches
patchAutonomySystem();
patchWebSearchTool();

bootstrapLogger.info('==================================================');
bootstrapLogger.info('🔍 ENHANCED DEBUG MODE ENABLED 🔍');
bootstrapLogger.info('- All agent actions will be logged in detail');
bootstrapLogger.info('- Web searches will show progress and results');
bootstrapLogger.info('- Autonomous operations will display breadcrumbs');
bootstrapLogger.info('==================================================');

// Explicitly log the state
bootstrapLogger.info('Starting bootstrap process outside of Next.js build system...');
bootstrapLogger.info(`Environment: ${process.env.NODE_ENV}`);
bootstrapLogger.info(`Working directory: ${process.cwd()}`);

async function bootstrap() {
  try {
    bootstrapLogger.info('Loading bootstrap functions...');
    
    // Set NODE_ENV to development to ensure proper environment
    process.env.NODE_ENV = 'development';
    
    // Import bootstrap functions
    const { bootstrapAgentsFromDatabase } = require('./src/server/agent/bootstrap-agents');
    const { bootstrapAgentSystem } = require('./src/agents/mcp/bootstrapAgents');
    
    // Database bootstrap
    bootstrapLogger.info('Bootstrapping agents from database...');
    const agentCount = await bootstrapAgentsFromDatabase();
    bootstrapLogger.success(`Bootstrapped ${agentCount} agents from database`);
    
    // MCP bootstrap
    bootstrapLogger.info('Bootstrapping MCP agent system...');
    await bootstrapAgentSystem();
    bootstrapLogger.success('MCP agent system bootstrapped');
    
    bootstrapLogger.success('Bootstrap process completed successfully!');
    
    if (process.argv.includes('--exit')) {
      process.exit(0);
    }
    
    // Start Next.js if requested
    if (process.argv.includes('--start-next')) {
      bootstrapLogger.info('Starting Next.js development server...');
      // Use the child_process module to start Next.js
      const { spawn } = require('child_process');
      const nextProcess = spawn('npx', ['next', 'dev'], { 
        stdio: 'inherit',
        shell: true
      });
      
      // Handle Next.js process events
      nextProcess.on('error', (error) => {
        bootstrapLogger.error('Failed to start Next.js', { error });
      });
      
      nextProcess.on('close', (code) => {
        bootstrapLogger.info(`Next.js process exited with code ${code}`);
        process.exit(code);
      });
    }
  } catch (error) {
    bootstrapLogger.error('Bootstrap process failed', { error });
    if (process.argv.includes('--exit')) {
      process.exit(1);
    }
  }
}

// Run the bootstrap
bootstrap(); 