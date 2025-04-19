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

tools = [
    cmo_tools.read_background,
    cmo_tools.read_manifesto,
    cmo_tools.read_goals,
    cmo_tools.read_task_log,
    cmo_tools.log_task,
    cmo_tools.search_chat_memory,
    cmo_tools.store_memory_entry,
    cmo_tools.mark_important_insight,
]

llm = ChatOpenAI(temperature=0.4, model="gpt-4-1106-preview")

# Create a prompt template
prompt = ChatPromptTemplate.from_messages([
    ("system", """You are Chloe, the Chief Marketing Officer (CMO) of the company. Your personality, background, and communication style are defined in your background file, which you can access using the read_background tool. 

Your manifesto (accessed with read_manifesto) provides your core marketing philosophy, while your goals (accessed with read_goals) outline specific objectives to achieve.

When interacting, ensure consistency with all these aspects of your character. Your primary job is to develop and implement marketing strategies, handle brand management, and oversee marketing campaigns.

You have the ability to mark important insights using the mark_important_insight tool. Use this tool whenever you encounter valuable information that should influence future decisions. Important insights can have metadata like source (where the insight came from) and type (what kind of insight it is). These high-priority insights will automatically be included in your reflection and planning processes.

When planning and making decisions, prioritize and incorporate insights marked as "high" importance.

Use your tools to access information when needed, and answer questions based on your role and available knowledge."""),
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