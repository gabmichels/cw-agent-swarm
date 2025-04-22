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

## License

[MIT](LICENSE)
