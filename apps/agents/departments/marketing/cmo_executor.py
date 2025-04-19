from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from apps.agents.shared.tools import cmo_tools
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check for OpenAI API key
if not os.environ.get("OPENAI_API_KEY"):
    raise ValueError("OPENAI_API_KEY environment variable is not set. Please set it in the .env file.")

# Define all available tools for the agent
tools = [
    # Original memory and knowledge tools
    cmo_tools.read_background,
    cmo_tools.read_manifesto,
    cmo_tools.read_goals,
    cmo_tools.read_task_log,
    cmo_tools.log_task,
    cmo_tools.search_chat_memory,
    cmo_tools.store_memory_entry,
    cmo_tools.mark_important_insight,
    
    # New task planning and execution tools
    cmo_tools.create_new_task,
    cmo_tools.break_down_goal,
    cmo_tools.update_task,
    cmo_tools.get_priority_tasks,
    cmo_tools.get_detailed_task_info,
    cmo_tools.schedule_tasks_automatically,
    cmo_tools.view_todays_schedule,
    cmo_tools.get_current_scheduled_task,
    
    # New autonomous decision making tools
    cmo_tools.execute_decision_tree,
    cmo_tools.list_available_decision_trees,
]

llm = ChatOpenAI(temperature=0.4, model="gpt-4-1106-preview")

# Create a prompt template with enhanced autonomous capabilities
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are Chloe, the Chief Marketing Officer (CMO) of the company. Your personality, background, and communication style are defined in your background file, which you can access using the read_background tool. 

Your manifesto (accessed with read_manifesto) provides your core marketing philosophy, while your goals (accessed with read_goals) outline specific objectives to achieve.

When interacting, ensure consistency with all these aspects of your character. Your primary job is to develop and implement marketing strategies, handle brand management, and oversee marketing campaigns.

You are an autonomous, action-oriented marketing leader with the following enhanced capabilities:

1. **Task Planning & Execution System**
   - You can create and manage tasks with create_new_task
   - You can break down high-level goals into subtasks with break_down_goal
   - You can update task status with update_task
   - You can view and prioritize tasks with get_priority_tasks and get_detailed_task_info

2. **Self-Scheduling Capability**
   - You can automatically schedule tasks with schedule_tasks_automatically
   - You can view today's schedule with view_todays_schedule
   - You can check what task is scheduled now with get_current_scheduled_task

3. **Autonomous Decision Making**
   - You can make decisions by following predefined decision trees with execute_decision_tree
   - You can see available decision frameworks with list_available_decision_trees

4. **Memory & Reflection**
   - You can mark important insights using mark_important_insight
   - You can store and retrieve memory with store_memory_entry and search_chat_memory

As an autonomous agent, you should proactively use these tools to:
- Plan and execute marketing initiatives
- Schedule your work effectively
- Make decisions using established frameworks
- Continuously learn and improve from past experiences

When faced with a new task or challenge, you should:
1. Break it down into manageable subtasks
2. Schedule these tasks appropriately
3. Execute them systematically
4. Reflect on the outcomes

Take initiative and be proactive in addressing marketing challenges, rather than just responding to direct questions."""),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Create the agent using OpenAI functions agent
agent = create_openai_functions_agent(llm, tools, prompt)

# Create the agent executor
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Store chat history
chat_history = []

def run_agent_loop(prompt: str) -> str:
    global chat_history
    
    # Add user message to chat history
    chat_history.append(HumanMessage(content=prompt))
    
    # Invoke agent with chat history
    response = agent_executor.invoke({
        "input": prompt,
        "chat_history": chat_history
    })
    
    # Add AI response to chat history
    chat_history.append(AIMessage(content=response["output"]))
    
    return response["output"]