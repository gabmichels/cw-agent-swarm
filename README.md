# Crowd Wisdom Employees

This repository contains the Node.js implementation of the Chloe agent system, rebuilt with modern JavaScript/TypeScript technologies.

## 🏗️ Tech Stack

- **Node.js & TypeScript** - Core platform
- **LangChain.js** - LLM orchestration and chains
- **LangGraph** - Agent workflows and state management
- **Qdrant** - Vector database for memory
- **Next.js** - UI frontend
- **Turborepo** - Monorepo management

## 📂 Project Structure

The project follows a clean monorepo structure:

```
/apps
  /ui                  → Next.js app (chat interface + dashboard)
/packages
  /agents
    /chloe             → Chloe agent implementation
  /core                → LangGraph logic, toolchains, routing, LLM setup
  /memory              → Vector DB connectors, embedding logic
  /shared              → Utilities, constants, types
  /data                → Data loaders and handlers
  /typescript-config   → Shared TypeScript configurations
/data                  → Static data files and resources
/scripts               → Setup and utility scripts
/legacy-python         → Original Python codebase (for reference)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) 8.x+
- (Optional) Qdrant instance for vector storage

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/crowd-wisdom-employees.git
   cd crowd-wisdom-employees
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the setup script:
   ```bash
   node scripts/setup.js
   ```

4. Build all packages:
   ```bash
   pnpm build
   ```

5. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your API keys and configuration.

### Running the Development Environment

```bash
pnpm dev
```

This starts the Next.js UI and watches for changes in all packages.

### Running the Agent Directly

```bash
cd packages/agents/chloe
pnpm start
```

## 🧠 Features

- **Memory System**: Long-term memory using vector embeddings
- **Autonomous Workflows**: Scheduled tasks and reflections
- **Discord Integration**: Notifications via Discord
- **Web Interface**: Chat and management UI with Next.js

## 💡 Architecture

The system is built around a modular agent architecture:

1. **Core Package**: Provides the LLM interfaces, prompt templates, and basic tools
2. **Memory Package**: Handles vector storage and retrieval
3. **Agent Packages**: Implement specific agent behaviors (Chloe)
4. **UI App**: Provides a web interface to interact with agents

## 📝 Legacy Python Code

The original Python implementation is preserved in the `/legacy-python` directory for reference. This code is not actively maintained but serves as a reference for implementing features in the Node.js version.

## 📝 License

[Specify your license here]

## 🙏 Acknowledgements

This project is a Node.js reimplementation of the original Python-based Chloe agent system.
