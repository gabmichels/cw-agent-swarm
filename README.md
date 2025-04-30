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
