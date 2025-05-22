# Crowd Wisdom Employees

This project has been converted from a monorepo to a single package structure for simplified development.

## Project Structure

- `src/` - Main source code directory
  - `app/` - Next.js application using the App Router
    - `api/` - API routes for backend functionality
    - `chat/` - Chat interface page
  - `components/` - Reusable React components
  - `lib/` - Shared utilities and core functionality
    - `core/` - Core functionality and LLM integration
    - `shared/` - Shared types, utilities, and constants
  - `agents/` - AI agent implementations
    - `chloe/` - Chloe marketing assistant agent
  - `persona/` - Personality and brand guidelines for agents
  - `types/` - TypeScript type definitions and ambient declarations

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/crowd-wisdom-employees.git
cd crowd-wisdom-employees
```

2. Install dependencies
```bash
npm install
# or
pnpm install
```

3. Setup environment variables
```bash
# Copy the example environment variables
cp .env.example .env
# Edit the .env file with your API keys and settings
```

4. Start the development server
```bash
npm run dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Using the Setup Script (Windows)

For Windows users, we've included a PowerShell script that handles installation and startup:

```powershell
# Run the setup script
.\setup.ps1
```

## Project Details

### Technology Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **AI/LLM**: LangChain, OpenAI API
- **Agent Framework**: Custom agent architecture with memory systems

### Key Features

- Chat interface with AI assistants
- Chloe marketing assistant agent with memory and reflection capabilities
- API endpoints for agent interaction and diagnostics

## Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

### Import Structure

After migration from the monorepo, imports now use relative paths:

```typescript
// Old monorepo import
import { ChloeAgent } from '@crowd-wisdom/agents-chloe';

// New relative import
import { ChloeAgent } from '../agents/chloe';
```

## Using Dry Run Mode for Planning

The Chloe Agent now supports a "dry run" mode for the planning system, which allows you to simulate the execution of a plan without actually running any of the tools or performing real actions. This is particularly useful for testing and debugging plans before executing them in a production environment.

### How to Use Dry Run Mode

Simply pass the `dryRun: true` option to the `planAndExecute` method:

```javascript
// Regular execution
const result = await chloeAgent.planAndExecute("Create a marketing campaign for our new product", {
  goalPrompt: "Create a marketing campaign for our new product"
});

// Dry run mode (simulated execution without real actions)
const dryRunResult = await chloeAgent.planAndExecute("Create a marketing campaign for our new product", {
  goalPrompt: "Create a marketing campaign for our new product",
  dryRun: true
});
```

### What Happens in Dry Run Mode

In dry run mode:

1. The planning phase runs normally, creating a hierarchy of sub-goals
2. Instead of actually executing the tools during the execution phase, the system simulates the execution
3. All steps are marked with a "SIMULATED" status in the logs
4. Tool calls return mock responses rather than actual results
5. The final result includes the complete plan structure with simulated execution results

This allows you to validate the plan structure and flow without any side effects or external API calls.

### Debugging with Dry Run Mode

Dry run mode is particularly useful for:

- Testing complex plans before execution
- Debugging plan structures
- Demonstrating planning capabilities to stakeholders
- Understanding how the agent would break down a complex task
- Performance testing of the planning system without external dependencies

## License

[MIT](LICENSE)

# File Storage System

The application supports multiple storage backends for file attachments:

- **MinIO**: S3-compatible object storage (preferred for development)
- **Local Storage**: Simple file system storage (fallback)
- **GCP Storage**: For production environments
- **AWS S3**: For production environments
- **Azure Blob Storage**: For production environments

## MinIO Setup

For development, we recommend using MinIO as the storage backend. It's S3-compatible and runs in a Docker container.

### Option 1: Using docker-compose (original method)

```bash
# Start MinIO
npm run storage:start

# Stop MinIO when done
npm run storage:stop
```

### Option 2: Using the helper script (enhanced method)

```bash
# Start MinIO with automatic validation
npm run minio:start
```

This script will:
- Check if MinIO is already running
- Start it only if needed
- Verify the bucket exists and is properly configured
- Provide clear feedback on the console

### Accessing MinIO

After starting with either method:
1. Access the MinIO Console at http://localhost:9001 
2. Login with: minioadmin / minioadmin

### Configuration

For production environments, update your `.env` file with the appropriate storage settings.

# Agent Swarm Architecture

This repository contains a flexible, extensible agent architecture designed for building AI agent systems. The architecture is based on a modular manager pattern, allowing agents to be composed of specialized components (managers) that provide different capabilities.

## Integrated Agent Bootstrap System

Agents are automatically bootstrapped when you start the Next.js server with `npm run dev`. The bootstrap process:

1. Loads agents from the database (if enabled)
2. Initializes the MCP (Master Control Program) agent system
3. Starts all agents in always-online mode, running in the background

### How It Works

The agent bootstrap is fully integrated with Next.js:

1. When you run `npm run dev`, Next.js starts its development server
2. During server startup, Next.js loads `src/app/layout.tsx`
3. The layout imports `src/lib/server-init.ts` which bootstraps the agents
4. Agents are initialized once, at server startup, and stay running in the background

> **Note:** You no longer need to run separate bootstrap scripts like `bootstrap-with-debug.js`. All bootstrapping happens automatically when the Next.js server starts.

### Configuration

You can configure the bootstrap process using environment variables:

```bash
# Enable enhanced debug mode with detailed logging
AGENT_DEBUG_MODE=true

# Debug level (error, warn, info, verbose, debug)
DEBUG_LEVEL=debug

# Whether to automatically bootstrap agents on server start
AGENT_AUTO_BOOTSTRAP=true

# Whether to load agents from database during bootstrap
AGENT_LOAD_FROM_DB=true
```

Copy the settings from `agent-env.example` to your `.env` file to customize the agent system behavior.

### Debug Mode

When debug mode is enabled:
- All agent actions are logged in detail
- Detailed logging is enabled system-wide using winston logger

This makes it easier to understand and debug the agent system's behavior.

## Core Architecture

The agent architecture is built around the following key components:

### Agent Base

The `AgentBase` interface defines the core functionality that all agent implementations provide:
- Unique identification
- Configuration management
- Manager registration and retrieval
- Lifecycle management (initialization, shutdown)
- Health monitoring

### Managers

Managers are specialized components that provide specific capabilities to agents. Each manager:
- Has a unique ID and type
- Can be enabled/disabled
- Has its own configuration
- Follows a consistent lifecycle (initialize, shutdown)
- Reports health status

The architecture includes several specialized manager types:

#### Tool Manager

Provides tools that agents can use to interact with their environment:
- Tool registration and discovery
- Tool execution with timeout and retry support
- Fallback mechanisms for tool failures
- Tool usage metrics and performance tracking

#### Task Manager

Handles task creation, scheduling, and execution:
- Task lifecycle management (creation, execution, completion)
- Priority-based task scheduling
- Task dependencies
- Task metrics and performance tracking

#### Planning Manager

Provides planning capabilities for agents:
- Plan creation based on goals and context
- Plan execution step by step
- Plan revision based on new information
- Plan monitoring and evaluation

#### Knowledge Manager

Manages the agent's knowledge and memory:
- Knowledge storage and retrieval
- Knowledge organization and categorization
- Knowledge updating and validation
- Knowledge sharing between agents

#### Scheduler Manager

Handles scheduling of recurring tasks and delayed execution:
- Schedule creation and management
- Cron-like scheduling support
- One-time and recurring task scheduling
- Execution hooks and callbacks

#### Reflection Manager

Provides self-improvement capabilities:
- Performance monitoring
- Behavior analysis
- Learning from past actions
- Adapting strategies based on outcomes

## Implementation

Each interface has a corresponding abstract implementation that provides common functionality:
- `AbstractAgentBase`: Base implementation of agent functionality
- `AbstractBaseManager`: Common manager functionality

To create custom agents and managers:
1. Extend the abstract classes
2. Implement the required methods
3. Register managers with the agent during initialization

## Usage Example

```typescript
// Create configuration for each manager
const toolManagerConfig: ToolManagerConfig = { enabled: true };
const taskManagerConfig: TaskManagerConfig = { enabled: true, maxConcurrentTasks: 5 };

// Create agent configuration
const agentConfig: AgentConfig = {
  agentId: 'agent-001',
  name: 'Example Agent',
  enabled: true,
  managers: {
    tool: toolManagerConfig,
    task: taskManagerConfig
  }
};

// Create agent instance
const agent = new MyCustomAgent(agentConfig);

// Create and register managers
const toolManager = new MyToolManager('tool', toolManagerConfig);
const taskManager = new MyTaskManager('task', taskManagerConfig);

agent.registerManager(toolManager);
agent.registerManager(taskManager);

// Initialize the agent
await agent.initialize();

// Use the agent...

// Shutdown when done
await agent.shutdown();
```

## Extending the Architecture

The architecture is designed to be extensible:

1. Create new manager types by extending `BaseManager`
2. Create specialized agents by extending `AbstractAgentBase`
3. Compose agents with different combinations of managers

## Project Structure

- `src/agents/shared/base/` - Core interfaces and abstract implementations
- `src/agents/shared/base/managers/` - Base manager implementations
- `src/lib/agents/base/managers/` - Specialized manager interfaces

## License

MIT

## File Storage Configuration

The project includes a multi-cloud compatible file storage solution that supports:

- Local filesystem storage (default for development)
- MinIO S3-compatible storage (local development with Docker)
- Google Cloud Storage (recommended for production)
- AWS S3 (alternative production option)
- Azure Blob Storage (alternative production option)

### Setting up local development with MinIO

1. Start the MinIO container using Docker Compose:

```powershell
docker-compose up -d minio createbuckets
```

2. Access the MinIO web console at http://localhost:9001 (credentials: minioadmin/minioadmin)

3. Update your `.env.local` file to use MinIO:

```
USE_MINIO=true
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

### Using GCP Cloud Storage in production

1. Create a GCP project and enable the Cloud Storage API
2. Create a service account with appropriate permissions
3. Download the service account key file
4. Configure your environment:

```
GCP_PROJECT_ID=your-project-id
GCP_STORAGE_BUCKET=your-bucket-name
GCP_KEY_FILENAME=path/to/keyfile.json
```
