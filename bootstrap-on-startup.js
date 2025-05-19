/**
 * Bootstrap On Startup - Run this script to bootstrap agents from database and MCP
 * 
 * This bypasses Next.js build complexities and can be run directly with Node.js
 */

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

// Load environment variables
require('dotenv').config();

// Explicitly log the state
console.log('🔄 Starting bootstrap process outside of Next.js build system...');
console.log('⚙️ Environment:', process.env.NODE_ENV);
console.log('📂 Working directory:', process.cwd());

async function bootstrap() {
  try {
    console.log('🧪 Loading bootstrap functions...');
    
    // Set NODE_ENV to development to ensure proper environment
    process.env.NODE_ENV = 'development';
    
    // Import bootstrap functions
    const { bootstrapAgentsFromDatabase } = require('./src/server/agent/bootstrap-agents');
    const { bootstrapAgentSystem } = require('./src/agents/mcp/bootstrapAgents');
    
    // Database bootstrap
    console.log('🚀 Bootstrapping agents from database...');
    const agentCount = await bootstrapAgentsFromDatabase();
    console.log(`✅ Bootstrapped ${agentCount} agents from database`);
    
    // MCP bootstrap
    console.log('🚀 Bootstrapping MCP agent system...');
    await bootstrapAgentSystem();
    console.log('✅ MCP agent system bootstrapped');
    
    console.log('🎉 Bootstrap process completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Bootstrap process failed:', error);
    process.exit(1);
  }
}

// Run the bootstrap
bootstrap(); 