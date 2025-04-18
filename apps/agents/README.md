# Crowd Wisdom AI Employees

This is a monorepo for building and managing AI agent employees that can replace human teams in startups. The system is designed to be modular and scalable, with each department having its own set of agents.

## Current Implementation

Currently, the system focuses on the Marketing Department with a Chief Marketing Officer (CMO) Agent.

### Project Structure

```
apps/agents/
├── departments/            # Contains different department agents
│   └── marketing/          # Marketing department
│       └── cmo_agent.py    # Chief Marketing Officer agent
├── shared/                 # Shared resources across departments
│   ├── memory/             # Memory files (markdown) for agents
│   │   ├── brand_guidelines.md
│   │   └── product_info.md
│   └── tools/              # Shared tools for agents
│       └── memory_loader.py # Loads and embeds memory files
├── main.py                 # Main entry point
├── run.bat                 # Batch script to run the agent (Windows)
├── requirements.txt        # Python dependencies
└── .env                    # Environment variables
```

## Getting Started

### Prerequisites

- Python 3.8+ (tested with Python 3.13)
- OpenAI API key

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/crowd-wisdom-employees.git
   cd crowd-wisdom-employees/apps/agents
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Create a `.env` file in the `apps/agents` directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

### Running the CMO Agent

#### Windows

Run the agent using the provided batch script:

```
run.bat
```

#### Other Platforms

Run the agent directly with Python:

```
python main.py
```

## How It Works

The CMO Agent works by:

1. Loading memory files from the `shared/memory` directory using LangChain's document loaders
2. Embedding these documents using OpenAI's embeddings
3. Creating a vector store for semantic search
4. When a query is made, it retrieves relevant context from the vector store
5. The context is passed to the OpenAI model, which generates a response

## Interacting with the CMO Agent

Currently, the CMO Agent generates a weekly marketing strategy based on the knowledge stored in the memory files. The strategy includes:

- Main goal of the week
- Campaign ideas
- Target audiences
- Recommended channels
- Metrics to track

To customize the agent's behavior:

1. Modify the memory files in `shared/memory/` directory to update its knowledge base
2. Adjust the prompt in `departments/marketing/cmo_agent.py` to change the output format
3. Modify the planning query in `plan_weekly_strategy()` function to focus on different aspects

## Future Roadmap

The system is designed to grow into a comprehensive suite of AI agents:

1. **More Marketing Roles**
   - Content Specialist
   - Social Media Manager
   - SEO Specialist

2. **Additional Departments**
   - Sales
   - Customer Support
   - Product Development
   - Operations

3. **Enhanced Capabilities**
   - Real-time data integration
   - Cross-agent collaboration
   - Task scheduling and automation
   - Performance analytics

4. **User Interface**
   - Web dashboard to interact with agents
   - Visualization of agent activity and results
   - Configuration panel for customizing agent behavior
   - Task management system

## Contributing

Contributions are welcome! Feel free to submit pull requests or open issues to improve the system.

## License

This project is licensed under the [MIT License](LICENSE).
