# Multi-Agent System User Guide

This guide explains how to use the multi-agent collaboration system to create and manage conversations involving multiple AI agents with different capabilities.

## Getting Started

### Accessing the System

1. Navigate to the Multi-Agent Chat page at `/multi-agent-chat` in your browser
2. The system will automatically create a new chat session for you
3. If you want to join an existing chat, add the query parameter `?chatId=YOUR_CHAT_ID` to the URL

### Understanding the Interface

The multi-agent interface consists of three main sections:

1. **Chat Interface** (left/center): Where you send messages and see responses
2. **Agent Relationships** (top right): Visualization of connections between agents
3. **Activity Analytics** (bottom right): Performance metrics and collaboration insights

## Working with Agents

### Adding Agents to a Chat

1. Click the "**Add Agent**" button in the top-right corner of the chat interface
2. A dropdown will appear showing available agents
3. Hover over an agent to see their name and number of capabilities
4. Click the info icon to view detailed capabilities
5. Click on an agent to add them to the conversation

### Directing Messages to Specific Agents

1. In the chat participants bar, click on the agent you want to message
2. The agent will be highlighted, and a "To: [Agent Name]" indicator will appear in the input area
3. Type your message and send it - it will be directed to that specific agent
4. To cancel directed messaging, click the "×" on the agent indicator or click the currently selected agent again

### Viewing Agent Capabilities

1. When adding an agent, click the info (i) icon next to their name
2. A capabilities panel will open showing all abilities of that agent
3. Review the capabilities to understand what tasks the agent can perform

### Understanding Agent Status

Agent status is indicated by colored dots next to their names:

- **Green**: Available - ready to receive and process messages
- **Yellow**: Busy - currently processing a task
- **Gray**: Offline - not currently connected
- **Red**: Maintenance - temporarily unavailable

## Collaborative Features

### Task Delegation

To delegate tasks between agents:

1. Add multiple agents with complementary capabilities to your chat
2. Direct a message to an agent with a task they're specialized in
3. The agent can then pass results to another agent by mentioning them
4. Example: "@Research Agent please find recent papers on AI safety, then @Analysis Agent can evaluate them"

### Multi-Agent Problem Solving

For complex problems requiring multiple agents:

1. Start by describing the overall goal to all agents (without directing)
2. Agents will coordinate based on their capabilities
3. You can step in to redirect or clarify as needed
4. Monitor the agent relationship graph to see which agents are collaborating

### Reading the Relationship Graph

The relationship visualization shows:

1. **Nodes**: Each circle represents an agent, with size indicating capability count
2. **Colors**: Node colors show agent status (green=available, yellow=busy, etc.)
3. **Edges**: Lines between agents show relationships, with thicker lines indicating stronger connections
4. **Edge Colors**: Different colors indicate relationship types (green=collaboration, blue=supervision, etc.)

## Advanced Features

### Understanding Analytics

The Activity Analytics panel shows:

1. **Most Active Agent**: Which agent is handling the most tasks
2. **Strongest Collaboration**: Which agent pair works together most effectively
3. **Task Completion Rate**: Percentage of successfully completed tasks

### Session Management

To manage your multi-agent sessions:

1. **Creating a new session**: Simply navigate to `/multi-agent-chat` without parameters
2. **Joining an existing session**: Use `/multi-agent-chat?chatId=YOUR_CHAT_ID`
3. **Sharing a session**: Copy and share the URL with the chatId parameter

### Best Practices

For the most effective multi-agent collaboration:

1. **Start with clear goals**: Define what you want to accomplish
2. **Choose complementary agents**: Select agents with different but related capabilities
3. **Allow agent-to-agent communication**: Let agents delegate tasks to each other
4. **Provide feedback**: Guide the conversation if it goes off track
5. **Monitor relationships**: Watch the relationship graph to see which collaborations are most effective

## Troubleshooting

### Common Issues

1. **Agent not responding**: Check the agent's status indicator - they may be busy or offline
2. **Messages not delivering**: Ensure your connection is stable and WebSocket is connected
3. **Relationship graph not updating**: The graph updates based on interaction volume - new relationships take time to develop
4. **Agent capability mismatch**: If an agent is struggling with a task, check their capabilities and redirect to a more appropriate agent

### Getting Help

If you encounter issues:

1. Check the console for any error messages (Developer Tools in your browser)
2. Refresh the page to re-establish connections
3. Create a new chat session if the current one becomes unresponsive
4. Contact system administrators for persistent issues

## Example Workflow

Here's an example of how to use the multi-agent system effectively:

1. **Start a new chat** at `/multi-agent-chat`
2. **Add specialized agents**:
   - Research Agent (for information gathering)
   - Analysis Agent (for data evaluation)
   - Summary Agent (for creating final reports)
3. **Introduce the task**: "I need to understand the latest developments in quantum computing"
4. **Direct to Research Agent**: Click on Research Agent and ask "Can you find the latest breakthroughs in quantum computing from the past year?"
5. **Review findings**: Research Agent will share their findings
6. **Involve Analysis Agent**: "Thanks for the research. @Analysis Agent, can you analyze these findings and identify the most promising developments?"
7. **Generate summary**: "@Summary Agent, please create a comprehensive report based on the research and analysis"
8. **Review relationships**: Check the relationship graph to see how the collaboration developed

## Conclusion

The multi-agent system provides a powerful way to leverage specialized AI agents for complex tasks. By following this guide, you can effectively create, manage, and benefit from agent collaborations that combine the strengths of multiple AI specialists.

For technical details on integrating these components into your own applications, please refer to the [Multi-Agent UI Integration Guide](/docs/integration/MULTI_AGENT_UI_INTEGRATION.md). 