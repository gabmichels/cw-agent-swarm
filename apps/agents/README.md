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
│       ├── memory_loader.py # Loads and embeds memory files
│       └── discord_notify.py # Sends notifications via Discord
├── main.py                 # Main entry point
├── run.bat                 # Batch script to run the agent (Windows)
├── requirements.txt        # Python dependencies
└── .env                    # Environment variables
```

## Getting Started

### Prerequisites

- Python 3.8+ (tested with Python 3.13)
- OpenAI API key
- (Optional) Discord bot token and user ID for notifications

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/crowd-wisdom-employees.git
   cd crowd-wisdom-employees/apps/agents
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   pip install discord.py  # For Discord notifications
   ```

3. Create a `.env` file in the `apps/agents` directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   
   # Discord integration (optional)
   DISCORD_BOT_TOKEN=your_discord_bot_token_here
   DISCORD_USER_ID=your_discord_user_id_here
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
6. (Optional) The response is sent as a Discord direct message notification

## Interacting with the CMO Agent

Currently, the CMO Agent generates a weekly marketing strategy based on the knowledge stored in the memory files. The strategy includes:

- Main goal of the week
- Campaign ideas
- Target audiences
- Recommended channels
- Metrics to track

If Discord integration is configured, the agent will also send the weekly strategy as a direct message to the specified Discord user.

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

### Discord Integration

To enable Discord notifications:

1. Create a Discord bot at https://discord.com/developers/applications
2. Get your bot token and add it to your `.env` file as `DISCORD_BOT_TOKEN`
3. Get your Discord user ID (in Developer Mode, right-click your username and select "Copy ID")
4. Add your user ID to your `.env` file as `DISCORD_USER_ID`

The CMO agent will send the weekly strategy directly to you via Discord DM when it's generated.
