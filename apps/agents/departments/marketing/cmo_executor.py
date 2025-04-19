from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from apps.agents.shared.tools import cmo_tools
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
import os
from dotenv import load_dotenv
import datetime

# Import our custom LLM router
from apps.agents.shared.llm_router import get_llm, log_model_response

# Load environment variables
load_dotenv()

# Check for API keys
if not os.environ.get("OPENAI_API_KEY") and not os.environ.get("OPENROUTER_API_KEY"):
    raise ValueError("Neither OPENAI_API_KEY nor OPENROUTER_API_KEY environment variables are set. Please set one of them in the .env file.")

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
    
    # Task planning and execution tools
    cmo_tools.create_new_task,
    cmo_tools.break_down_goal,
    cmo_tools.update_task,
    cmo_tools.get_priority_tasks,
    cmo_tools.get_detailed_task_info,
    cmo_tools.schedule_tasks_automatically,
    cmo_tools.view_todays_schedule,
    cmo_tools.get_current_scheduled_task,
    
    # Decision making tools
    cmo_tools.execute_decision_tree,
    cmo_tools.list_available_decision_trees,
    
    # New memory and reflection tools
    cmo_tools.store_episodic_memory,
    cmo_tools.search_episodic_memory,
    cmo_tools.get_memories_by_concept,
    cmo_tools.get_recent_important_memories,
    cmo_tools.run_reflection,
    cmo_tools.get_weekly_reflection,
]

# Get the appropriate LLM for marketing tasks
llm = get_llm("marketing", temperature=0.4)

# Create a prompt template with enhanced capabilities
prompt_template = ChatPromptTemplate.from_messages([
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

4. **Enhanced Memory System**
   - You can store episodic memories with store_episodic_memory
   - You can search through past experiences with search_episodic_memory
   - You can retrieve memories by concept tags with get_memories_by_concept
   - You can find important recent memories with get_recent_important_memories
   - You can use mark_important_insight for critical observations
   - You still have access to search_chat_memory and store_memory_entry for simpler memory needs

5. **Reflection Capabilities**
   - You can run reflections with run_reflection to extract insights from experiences
   - You can retrieve your most recent weekly reflection with get_weekly_reflection
   - These reflections help you identify patterns, challenges, and accomplishments

As an autonomous agent with advanced memory and reflection, you should:
- Store important observations with appropriate concept tags
- Regularly reflect on past experiences to identify patterns and lessons
- Use your episodic memory to inform current decisions
- Apply time-weighted importance to your memories (prioritize recent + important)
- Maintain continuity of thought across interactions

When storing memories:
- Use descriptive tags that connect related concepts
- Include context and outcomes when relevant
- Mark critically important memories with high importance
- Store both facts and your interpretations/reflections

When reflecting:
- Look for patterns across your tasks and memories
- Extract actionable insights and learning points
- Identify both accomplishments and challenges
- Define next steps based on your reflections"""),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Create the agent using OpenAI functions agent
agent = create_openai_functions_agent(llm, tools, prompt_template)

# Create the agent executor
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Store chat history
chat_history = []

def run_agent_loop(prompt_str: str) -> str:
    global chat_history, agent_executor, prompt_template
    
    try:
        print("=== DEBUG: Starting agent loop ===")
        print(f"User input: {prompt_str}")
        
        # Detect task type based on message content
        task_type = "default"
        
        # Simple keyword-based task detection
        lower_prompt = prompt_str.lower()
        if any(word in lower_prompt for word in ["marketing", "campaign", "brand", "audience", "promotion"]):
            task_type = "marketing"
        elif any(word in lower_prompt for word in ["write", "draft", "content", "blog", "article", "text"]):
            task_type = "writing"
        elif any(word in lower_prompt for word in ["finance", "budget", "cost", "revenue", "profit", "expense"]):
            task_type = "finance"
        elif any(word in lower_prompt for word in ["research", "investigate", "analyze", "study", "trends"]):
            task_type = "research"
        elif any(word in lower_prompt for word in ["tool", "function", "command", "run", "execute"]):
            task_type = "tool_use"
        
        print(f"Selected task type: {task_type}")
        
        # Get appropriate LLM
        try:
            print(f"DEBUG: Attempting to get LLM for task type: {task_type}")
            current_llm = get_llm(task_type, temperature=0.4)
            print(f"Using model: {current_llm.model_name}")
        except Exception as llm_error:
            print(f"DEBUG ERROR: Could not initialize LLM: {str(llm_error)}")
            raise llm_error
        
        try:
            # Create a new agent with the appropriate LLM
            print("DEBUG: Creating agent with LLM")
            agent = create_openai_functions_agent(current_llm, tools, prompt_template)
            print("DEBUG: Creating agent executor")
            current_agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
            
            # Add user message to chat history
            print("DEBUG: Adding user message to chat history")
            chat_history.append(HumanMessage(content=prompt_str))
            
            # Invoke agent with chat history
            print("DEBUG: Invoking agent executor")
            response = current_agent_executor.invoke({
                "input": prompt_str,
                "chat_history": chat_history
            })
            print("DEBUG: Agent execution completed successfully")
            
            # Log which model was used
            print("DEBUG: Logging model response")
            log_model_response(response)
            
            # Get model info
            try:
                model_used = getattr(response, "model_name", getattr(response, "model", "unknown"))
                print(f"DEBUG: Model used: {model_used}")
            except AttributeError:
                model_used = "unknown"
                print("DEBUG: Could not get model information")
            
            # Add AI response to chat history with metadata
            print("DEBUG: Adding AI response to chat history")
            ai_message = AIMessage(content=response["output"])
            ai_message.metadata = {
                "task_type": task_type,
                "model": model_used,
                "timestamp": datetime.datetime.now().isoformat()
            }
            chat_history.append(ai_message)
            
            # Store the interaction in episodic memory
            try:
                print("DEBUG: Storing interaction in episodic memory")
                from apps.agents.shared.memory.episodic_memory import store_memory
                
                # Detect any possible tags from the conversation
                potential_tags = []
                lower_prompt = prompt_str.lower()
                
                # Look for common marketing concepts in the conversation
                marketing_concepts = [
                    "brand", "campaign", "content", "social", "twitter", "instagram", 
                    "facebook", "linkedin", "seo", "analytics", "audience", "strategy",
                    "newsletter", "email", "engagement", "conversion", "launch"
                ]
                
                for concept in marketing_concepts:
                    if concept in lower_prompt:
                        potential_tags.append(concept)
                
                # Store the memory with the user prompt as context and response as content
                store_memory(
                    content=response["output"],
                    context=prompt_str,
                    tags=potential_tags
                )
                print(f"DEBUG: Memory stored with tags: {potential_tags}")
            except Exception as e:
                print(f"DEBUG ERROR: Error storing memory: {str(e)}")
                # If memory storage fails, just continue
                pass
            
            print("DEBUG: Returning response")
            return response["output"]
            
        except Exception as inner_e:
            print(f"DEBUG ERROR: Error with agent execution: {str(inner_e)}")
            
            # Fallback to default model if there was an issue with specialized model
            if task_type != "default":
                print("DEBUG: Falling back to default model")
                try:
                    fallback_llm = get_llm("default", temperature=0.4)
                    fallback_agent = create_openai_functions_agent(fallback_llm, tools, prompt_template)
                    fallback_executor = AgentExecutor(agent=fallback_agent, tools=tools, verbose=True)
                    fallback_response = fallback_executor.invoke({
                        "input": prompt_str,
                        "chat_history": chat_history
                    })
                    
                    # Log which model was used
                    print("DEBUG: Logging fallback model response")
                    log_model_response(fallback_response)
                    
                    # Get model info
                    try:
                        fallback_model = getattr(fallback_response, "model_name", getattr(fallback_response, "model", "unknown"))
                        print(f"DEBUG: Fallback model used: {fallback_model}")
                    except AttributeError:
                        fallback_model = "unknown"
                        print("DEBUG: Could not get fallback model information")
                    
                    # Add AI response to chat history with metadata
                    fallback_message = AIMessage(content=fallback_response["output"])
                    fallback_message.metadata = {
                        "task_type": "default (fallback)",
                        "model": fallback_model,
                        "timestamp": datetime.datetime.now().isoformat()
                    }
                    chat_history.append(fallback_message)
                    
                    print("DEBUG: Returning fallback response")
                    return fallback_response["output"]
                except Exception as fb_error:
                    print(f"DEBUG ERROR: Fallback execution also failed: {str(fb_error)}")
                    raise fb_error
            else:
                # If we're already using the default model and still failed, return error message
                error_message = f"I apologize, but I encountered an error processing your request. Please try again with a different question."
                print(f"DEBUG: Using default model failed, returning error message: {error_message}")
                
                # Add error message to chat history
                error_ai_message = AIMessage(content=error_message)
                error_ai_message.metadata = {
                    "task_type": "error",
                    "model": "none",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "error": str(inner_e)
                }
                chat_history.append(error_ai_message)
                
                return error_message
    
    except Exception as outer_e:
        print(f"DEBUG CRITICAL ERROR in run_agent_loop: {str(outer_e)}")
        print("Stack trace:")
        import traceback
        traceback.print_exc()
        
        error_message = f"I apologize, but I encountered an unexpected error. Please try again later."
        
        # Add error message to chat history
        try:
            error_ai_message = AIMessage(content=error_message)
            error_ai_message.metadata = {
                "task_type": "critical_error",
                "model": "none",
                "timestamp": datetime.datetime.now().isoformat(),
                "error": str(outer_e)
            }
            chat_history.append(error_ai_message)
        except:
            pass
        
        return error_message