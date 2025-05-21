/**
 * Task Monitor - Actively monitors agent activity
 * 
 * This script polls the agent system for active tasks and logs them
 * to provide visibility into what's happening behind the scenes.
 */

// Set up environment
require('dotenv').config();
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2017',
  },
});

// Path aliases from tsconfig
const tsconfig = require('./tsconfig.json');
const moduleAlias = require('module-alias');

// Add path aliases from tsconfig
const pathAliases = tsconfig.compilerOptions.paths;
if (pathAliases) {
  const aliases = {};
  for (const [alias, pathValues] of Object.entries(pathAliases)) {
    const key = alias.replace(/\/\*$/, '');
    const targetPath = pathValues[0].replace(/\/\*$/, '');
    aliases[key] = `${__dirname}/${targetPath}`;
  }
  moduleAlias.addAliases(aliases);
}

// Add colorful console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Storage for tasks we've seen
const seenTasks = new Set();
const activeTaskDetails = new Map();

// Function to format date/time
function formatTime(date) {
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Task status colors
const statusColors = {
  'pending': colors.yellow,
  'in_progress': colors.cyan,
  'completed': colors.green,
  'failed': colors.red,
  'cancelled': colors.magenta
};

// Format a task for display
function formatTask(task) {
  const statusColor = statusColors[task.status] || colors.white;
  const timeAgo = task.startTime ? `${Math.floor((Date.now() - new Date(task.startTime).getTime()) / 1000)}s ago` : 'N/A';
  
  return `${colors.bright}${colors.white}[Task ${task.id.substring(0, 8)}]${colors.reset} ${statusColor}${task.status.toUpperCase()}${colors.reset} - ${task.name || 'Unnamed'} (${timeAgo})`;
}

// Function to check agent task status
async function checkTasks() {
  try {
    console.log(`\n${colors.bright}${colors.bgBlue}${colors.white} AGENT TASK MONITOR ${colors.reset} - ${formatTime(new Date())}`);
    
    // Get all agents from the registry
    const { getAllAgents } = require('./src/server/agent/agent-service');
    const agents = getAllAgents();
    
    console.log(`${colors.cyan}Found ${agents.length} registered agents${colors.reset}`);
    
    let foundTasks = false;
    
    // For each agent, check for tasks
    for (const agent of agents) {
      const agentId = agent.getAgentId();
      const agentName = agent.getName();
      
      console.log(`\n${colors.bright}${colors.bgWhite}${colors.black} AGENT: ${agentName} (${agentId}) ${colors.reset}`);
      
      // Get the autonomy manager if available
      const autonomyManager = agent.getManager ? agent.getManager('AUTONOMY') : null;
      if (!autonomyManager) {
        console.log(`${colors.dim}Agent does not have autonomy manager${colors.reset}`);
        continue;
      }
      
      // Check autonomy status
      const autonomyMode = autonomyManager.getAutonomyMode ? autonomyManager.getAutonomyMode() : 'unknown';
      console.log(`${colors.yellow}Autonomy mode: ${autonomyMode ? 'ENABLED' : 'DISABLED'}${colors.reset}`);
      
      // Get scheduled tasks if available
      const scheduledTasks = autonomyManager.getScheduledTasks ? autonomyManager.getScheduledTasks() : [];
      console.log(`${colors.yellow}Scheduled tasks: ${scheduledTasks.length}${colors.reset}`);
      
      // Get active tasks if available (all agents have different implementations)
      let tasks = [];
      
      // Try different methods that might exist on the agent
      if (agent.getAllTasks) {
        tasks = await agent.getAllTasks();
      } else if (autonomyManager.autonomySystem && autonomyManager.autonomySystem.getTasks) {
        tasks = await autonomyManager.autonomySystem.getTasks();
      } else if (agent.getTasks) {
        tasks = await agent.getTasks();
      }
      
      if (!tasks || tasks.length === 0) {
        console.log(`${colors.dim}No active tasks${colors.reset}`);
        continue;
      }
      
      foundTasks = true;
      console.log(`${colors.green}Active tasks: ${tasks.length}${colors.reset}`);
      
      // Display each task
      tasks.forEach(task => {
        // Mark as seen
        seenTasks.add(task.id);
        activeTaskDetails.set(task.id, task);
        
        // Print task info
        console.log(`  ${formatTask(task)}`);
        if (task.description) {
          console.log(`    ${colors.dim}${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}${colors.reset}`);
        }
      });
    }
    
    if (!foundTasks) {
      console.log(`\n${colors.yellow}No active tasks found in any agent${colors.reset}`);
      console.log(`${colors.dim}This might be because:${colors.reset}`);
      console.log(`${colors.dim}- No tasks have been created yet${colors.reset}`);
      console.log(`${colors.dim}- Tasks completed too quickly between polling intervals${colors.reset}`);
      console.log(`${colors.dim}- Agent autonomy mode is disabled${colors.reset}`);
    }
    
    // Check for web search activity
    checkWebSearchActivity();
    
  } catch (error) {
    console.error(`${colors.red}Error checking tasks:${colors.reset}`, error);
  }
}

// Function to check for web search activity
function checkWebSearchActivity() {
  try {
    // Look for the web search tool class
    const webSearchPath = './src/agents/shared/tools/web/ApifyWebSearchTool';
    const fs = require('fs');
    
    if (!fs.existsSync(webSearchPath + '.ts')) {
      console.log(`${colors.dim}Web search module not found${colors.reset}`);
      return;
    }
    
    const webSearchModule = require(webSearchPath);
    if (!webSearchModule || !webSearchModule.ApifyWebSearchTool) {
      console.log(`${colors.dim}Web search tool not available${colors.reset}`);
      return;
    }
    
    // Check if we have API keys for web search
    const apifyApiKey = process.env.APIFY_API_KEY;
    if (!apifyApiKey) {
      console.log(`\n${colors.yellow}⚠️ No APIFY_API_KEY found in environment${colors.reset}`);
      console.log(`${colors.dim}Web searches might fail due to missing API key${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✓ APIFY_API_KEY is configured${colors.reset}`);
    }
    
    // Check for other configurations that might affect web search
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (googleApiKey && googleSearchEngineId) {
      console.log(`${colors.green}✓ Google Custom Search is also configured${colors.reset}`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Error checking web search configuration:${colors.reset}`, error);
  }
}

// Start the monitor
console.log(`${colors.bright}${colors.bgGreen}${colors.black} AGENT TASK MONITOR STARTED ${colors.reset}`);
console.log(`${colors.dim}This tool will show you what your agent is doing behind the scenes.${colors.reset}`);
console.log(`${colors.dim}Press Ctrl+C to stop monitoring.${colors.reset}\n`);

// Initial check
checkTasks();

// Set up interval to check periodically
const POLL_INTERVAL = 5000; // Check every 5 seconds
const interval = setInterval(checkTasks, POLL_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log(`\n${colors.bright}${colors.bgRed}${colors.white} AGENT TASK MONITOR STOPPED ${colors.reset}`);
  process.exit(0);
});

// Keep the process running
process.stdin.resume(); 