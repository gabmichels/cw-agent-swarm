# Crowd Wisdom Employees - Modularized AI Agents

## Overview
This project implements a modular architecture for AI agents, focused on creating specialized agent roles like Chloe (CMO).

## Directory Structure
```
agents/
  chloe/                        # Chloe-specific components
    agent_config.py             # Chloe's personality, tone, LLM preferences
    strategies/                 # Marketing-specific strategy modules
    tools/                      # Marketing-specific tools
    reflections/                # Chloe's reflection interpretations
    main.py                     # Assembles Chloe using shared core

shared/
  agent_core/                   # Shared agent infrastructure
    memory/                     # Memory systems
    tools/                      # Generic tools for all agents
```

## Getting Started

### Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API key:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

3. You can customize other settings in the `.env` file:
   - Model preferences by task type
   - Default LLM parameters
   - Memory locations
   - Debug settings

### Running with Docker

Build and run the Docker container:

```bash
docker build -t crowd-wisdom-hq .
docker run -p 8501:8501 -e OPENROUTER_API_KEY=your_key_here crowd-wisdom-hq
```

Then access the HQ interface at http://localhost:8501

### Running Locally

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the HQ app:
```bash
streamlit run hq_app.py
```

## Adding New Agents

To create a new agent, follow the modular structure in the `agents/` directory. 
See `README_AGENT_MODULARIZATION.md` for detailed instructions on creating new agents.
