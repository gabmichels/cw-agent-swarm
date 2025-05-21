/**
 * Enhanced Debug Mode for Agent System
 * 
 * This script enables detailed logging for autonomous agent operations.
 * Run this before starting your agent to see detailed breadcrumbs of all actions.
 */

// Load environment variables
require('dotenv').config();

// Set debug environment variables
process.env.DEBUG_LEVEL = 'verbose';
process.env.AGENT_DEBUG = 'true';
process.env.AUTONOMY_DEBUG = 'true';
process.env.CONSOLE_LOG_LEVEL = 'debug';
process.env.NODE_DEBUG = 'agent,autonomy,task,web-search';

// Monkey patch console methods to add timestamps and improved formatting
const originalConsole = { ...console };
const getTimeStamp = () => {
  const now = new Date();
  return `[${now.toLocaleTimeString('en-US', { hour12: false })}:${now.getMilliseconds().toString().padStart(3, '0')}]`;
};

// Enhance console methods with timestamps and tag formatting
console.log = (...args) => {
  originalConsole.log(getTimeStamp(), ...args);
};

console.debug = (...args) => {
  originalConsole.debug('\x1b[36m' + getTimeStamp() + ' [DEBUG]', ...args, '\x1b[0m');
};

console.info = (...args) => {
  originalConsole.info('\x1b[32m' + getTimeStamp() + ' [INFO]', ...args, '\x1b[0m');
};

console.warn = (...args) => {
  originalConsole.warn('\x1b[33m' + getTimeStamp() + ' [WARN]', ...args, '\x1b[0m');
};

console.error = (...args) => {
  originalConsole.error('\x1b[31m' + getTimeStamp() + ' [ERROR]', ...args, '\x1b[0m');
};

// Patch the autonomy system to show more logs
const patchAutonomySystem = () => {
  try {
    // Load and patch the DefaultAutonomySystem
    const autonomySystemPath = './src/agents/shared/autonomy/systems/DefaultAutonomySystem';
    const autonomyModule = require(autonomySystemPath);
    const originalExecuteTask = autonomyModule.DefaultAutonomySystem.prototype.executeTask;
    const originalProcessOpportunity = autonomyModule.DefaultAutonomySystem.prototype.processOpportunity;
    const originalPlanAndExecuteTask = autonomyModule.DefaultAutonomySystem.prototype.planAndExecuteTask;

    // Patch the executeTask method to add more logging
    autonomyModule.DefaultAutonomySystem.prototype.executeTask = async function(taskId) {
      console.log(`🔍 [AUTONOMY DEBUG] Starting execution of task ${taskId}`);
      const result = await originalExecuteTask.call(this, taskId);
      console.log(`✅ [AUTONOMY DEBUG] Finished execution of task ${taskId}, result: ${result ? 'success' : 'failure'}`);
      return result;
    };

    // Patch the processOpportunity method
    autonomyModule.DefaultAutonomySystem.prototype.processOpportunity = async function(opportunity) {
      console.log(`🚀 [AUTONOMY DEBUG] Processing opportunity of type "${opportunity.type}": ${opportunity.id}`);
      await originalProcessOpportunity.call(this, opportunity);
      console.log(`✓ [AUTONOMY DEBUG] Processed opportunity ${opportunity.id}`);
    };

    // Patch the planAndExecuteTask method
    autonomyModule.DefaultAutonomySystem.prototype.planAndExecuteTask = async function(task, options) {
      console.log(`📝 [AUTONOMY DEBUG] Planning execution for task: ${task.name || task.id}`);
      console.log(`📋 Task details: ${JSON.stringify({
        id: task.id,
        description: task.description,
        tags: task.tags
      })}`);
      
      const result = await originalPlanAndExecuteTask.call(this, task, options);
      
      console.log(`🏁 [AUTONOMY DEBUG] Plan execution completed: ${result.success ? 'Success' : 'Failed'}`);
      if (!result.success) {
        console.error(`❌ Error: ${result.message || result.error}`);
      }
      
      return result;
    };

    console.log('✅ Successfully patched Autonomy System for enhanced logging');
  } catch (error) {
    console.error('❌ Failed to patch Autonomy System:', error);
  }
};

// Patch web search tool for more logging
const patchWebSearchTool = () => {
  try {
    const webSearchPath = './src/agents/shared/tools/web/ApifyWebSearchTool';
    const webSearchModule = require(webSearchPath);
    const originalExecute = webSearchModule.ApifyWebSearchTool.prototype.execute;
    
    webSearchModule.ApifyWebSearchTool.prototype.execute = async function(args) {
      console.log(`🌐 [WEB SEARCH DEBUG] Starting web search: "${args.query}"`);
      const result = await originalExecute.call(this, args);
      console.log(`🌐 [WEB SEARCH DEBUG] Web search completed with status: ${result.success ? 'Success' : 'Failed'}`);
      if (result.success) {
        console.log(`🌐 Found ${Array.isArray(result.data) ? result.data.length : '?'} results`);
      }
      return result;
    };
    
    console.log('✅ Successfully patched Web Search Tool for enhanced logging');
  } catch (error) {
    console.error('❌ Failed to patch Web Search Tool:', error);
  }
};

// Apply all patches
patchAutonomySystem();
patchWebSearchTool();

console.log('==================================================');
console.log('🔍 ENHANCED DEBUG MODE ENABLED 🔍');
console.log('- All agent actions will be logged in detail');
console.log('- Web searches will show progress and results');
console.log('- Autonomous operations will display breadcrumbs');
console.log('==================================================');

// Continue to bootstrap or let the next script run
console.log('✅ Debug mode initialized, continuing with bootstrap...');

// Conditionally bootstrap based on command-line argument
if (process.argv.includes('--bootstrap')) {
  require('./bootstrap-on-startup');
} 