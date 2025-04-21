# Crowd Wisdom Employees - Node.js Migration

This repository contains the Node.js migration of the Chloe agent system, rebuilding it with modern JavaScript/TypeScript technologies.

## 🏗️ Tech Stack

- **Node.js & TypeScript** - Core platform
- **LangChain.js** - LLM orchestration and chains
- **LangGraph** - Agent workflows and state management
- **Qdrant** - Vector database for memory
- **Next.js** - UI frontend
- **Turborepo** - Monorepo management

## 📂 Project Structure

The project follows a monorepo structure:

```
/apps
  /ui                  → Next.js app (chat interface + dashboard)
/packages
  /agents              → Chloe and other agents
    /chloe             → Chloe agent implementation
  /core                → LangGraph logic, toolchains, routing, LLM setup
  /memory              → Vector DB connectors, embedding logic
  /shared              → Utilities, constants, types
  /data                → Initial documents and memory
/scripts               → Setup scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm/pnpm
- (Optional) Qdrant instance for vector storage

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/crowd-wisdom-employees.git
   cd crowd-wisdom-employees
   git checkout nodejs-migration
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build all packages:
   ```bash
   npm run build
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your API keys and configuration.

### Running the Development Environment

```bash
npm run dev
```

This starts the Next.js UI and watches for changes in all packages.

### Running the Agent Directly

```bash
cd packages/agents/chloe
npm run start
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

## 📝 License

[Specify your license here]

## 🙏 Acknowledgements

This project is a Node.js migration of the original Python-based Chloe agent system.
