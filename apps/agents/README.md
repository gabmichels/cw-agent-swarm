# CMO Agent

This project implements a CMO (Chief Marketing Officer) agent using LangChain and OpenAI.

## Project Structure

```
agents/
├── departments/           # Department-specific agents
│   └── marketing/         # Marketing department agents
│       └── cmo_executor.py  # CMO agent implementation
├── shared/                # Shared components
│   ├── memory/            # Agent memory files
│   │   ├── cmo_manifesto.md  # CMO beliefs and philosophy
│   │   ├── marketing_goals.md  # Marketing objectives
│   │   └── task_log.md    # Log of marketing tasks
│   └── tools/             # Shared tools
│       └── cmo_tools.py   # Tools for the CMO agent
├── main.py                # Main entry point
├── run_cmo.bat            # Windows batch script to run the CMO agent
├── cleanup.bat            # Cleanup script to remove artifacts
└── requirements.txt       # Python dependencies
```

## Setup

1. Ensure you have Python installed
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Set up the OpenAI API key in `.env` file

## Running the CMO Agent

On Windows, run:
```
run_cmo.bat
```

Or directly with Python:
```
python main.py
```

## Cleanup

To clean up artifacts like Python cache files:
```
cleanup.bat
```

## Features

- **Read CMO Manifesto**: Access the marketing philosophy and beliefs
- **View Marketing Goals**: See current marketing objectives
- **View Task Log**: Review past marketing tasks
- **Log New Tasks**: Add new entries to the task log

## Dependencies

- langchain
- langchain-community
- langchain-openai
- python-dotenv
