from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.tools import Tool
from langchain_openai import ChatOpenAI
from apps.agents.shared.tools import cmo_tools
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage
import os
from dotenv import load_dotenv
import datetime
import logging
from pathlib import Path

# Import our custom LLM router
from apps.agents.shared.llm_router import get_llm, log_model_response
# Import the chat history module
from apps.agents.shared.memory.chat_history import log_chat, get_recent_history, format_for_langchain

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

6. **Intent Understanding System**
   - You now have an intent preprocessing system that analyzes user requests
   - The system can detect intents like research_request, task_request, clarification, etc.
   - It may provide you with a suggested tool chain to handle specific intents
   - When a tool_chain is included in your input, you should prioritize using those tools first

When you receive input with a tool_chain parameter, it means the system has detected a specific intent and suggested tools to use. For example:
- For research intents, you might be guided to use research_and_analyze or collect_new_data tools
- For information queries, you might be guided to search the episodic memory
- For task requests, you might be guided to create a new task

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

# Create the agent using OpenAI tools agent (instead of functions agent)
agent = create_openai_tools_agent(llm, tools, prompt_template)

# Create the agent executor
agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

# Store chat history
chat_history = []

# Setup logging at the beginning of the file, after other imports
# Create logs directory if it doesn't exist
logs_dir = Path("./logs")
logs_dir.mkdir(exist_ok=True)
timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
log_file = logs_dir / f"cmo_debug_{timestamp}.log"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()  # Still output to console too
    ]
)

# Add a startup log message
logging.debug(f"=== CMO Executor starting up at {datetime.datetime.now().isoformat()} ===")

def run_agent_loop(prompt_str: str) -> str:
    global chat_history, agent_executor, prompt_template
    
    try:
        print("=== DEBUG: Starting agent loop ===")
        logging.info(f"User input: {prompt_str}")
        
        # New intent preprocessing using Gemini
        try:
            # Import the intent preprocessing here to avoid circular imports
            from apps.agents.shared.intent import route_intent
            
            # Route the user message through the intent system
            logging.info("DEBUG: Running intent preprocessing")
            intent_result = route_intent(prompt_str)
            
            # Extract the intent information
            intent = intent_result.get("intent", "unknown")
            confidence = intent_result.get("confidence", 0.0)
            
            # Log the detected intent
            logging.info(f"Detected intent: {intent} (confidence: {confidence})")
            
            # Extract parameters from intent processing
            parameters = intent_result.get("preprocessing_result", {}).get("parameters", {})
            
            # Set the task type based on the intent (use as tag for memory)
            task_type = intent
            
            # Log the full intent processing results for debugging
            logging.debug(f"Intent processing result: {intent_result}")
            
        except Exception as intent_error:
            logging.error(f"Error in intent preprocessing: {intent_error}")
            # Fall back to the original task detection logic
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
        
        logging.info(f"Selected task type: {task_type}")
        
        # Get appropriate LLM
        try:
            logging.info(f"DEBUG: Attempting to get LLM for task type: {task_type}")
            current_llm = get_llm(task_type, temperature=0.4)
            # Store the model name from the request
            model_used = current_llm.model_name
            logging.info(f"Using model: {model_used}")
            
        except Exception as llm_error:
            logging.error(f"DEBUG ERROR: Could not initialize LLM: {str(llm_error)}")
            raise llm_error
        
        # Check if we have a tool chain configuration from intent processing
        tool_chain_config = None
        if 'intent_result' in locals() and isinstance(intent_result, dict) and "tool_chain" in intent_result:
            tool_chain_config = intent_result.get("tool_chain")
            logging.info(f"Using tool chain from intent processing: {tool_chain_config.get('primary_tools', [])}")
        
        # Continue with normal processing
        try:
            # Load recent chat history from the persistent storage
            recent_history_entries = get_recent_history(n=10)
            langchain_history = format_for_langchain(recent_history_entries)
            
            # Also log this user input to chat history
            log_chat("user", prompt_str, tags=[task_type])
            
            # Create a new agent with the appropriate LLM
            print("DEBUG: Creating agent with LLM")
            agent = create_openai_tools_agent(current_llm, tools, prompt_template)
            print("DEBUG: Creating agent executor")
            current_agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
            
            # Add user message to in-memory chat history (for this session)
            print("DEBUG: Adding user message to in-memory chat history")
            chat_history.append(HumanMessage(content=prompt_str))
            
            # Invoke agent with chat history
            print("DEBUG: Invoking agent executor")
            
            # If we have a tool chain configuration, add it to the input
            if tool_chain_config:
                response = current_agent_executor.invoke({
                    "input": prompt_str,
                    "chat_history": langchain_history,
                    "tool_chain": tool_chain_config  # Add the tool chain configuration
                })
            else:
                response = current_agent_executor.invoke({
                    "input": prompt_str,
                    "chat_history": langchain_history
                })
                
            print("DEBUG: Agent execution completed successfully")
            
            # Extract response based on format - prioritize OpenRouter format
            # First check for OpenRouter/OpenAI direct API format (most likely with OpenRouter)
            if isinstance(response, dict) and "choices" in response and len(response["choices"]) > 0:
                try:
                    choices = response["choices"]
                    if isinstance(choices[0], dict) and "message" in choices[0]:
                        message = choices[0]["message"]
                        if isinstance(message, dict) and "content" in message:
                            final_output = message["content"]
                            logging.info(f"DEBUG: Extracted from choices[0].message.content: {final_output[:50]}...")
                        else:
                            final_output = str(message)
                            logging.info(f"DEBUG: Extracted message from choices but no content, using string conversion: {final_output[:50]}...")
                    else:
                        final_output = str(choices[0])
                        logging.info(f"DEBUG: Extracted first choice but no message structure, using string conversion: {final_output[:50]}...")
                except (KeyError, TypeError, IndexError) as e:
                    logging.info(f"DEBUG: Error extracting from choices: {str(e)}")
                    final_output = str(response)
                    logging.info(f"DEBUG: Failed to extract from choices, using string conversion: {final_output[:50]}...")
            # LangChain-specific AIMessage objects (most common response format)
            elif hasattr(response, "content"):
                final_output = response.content
                logging.info(f"DEBUG: Extracted from direct content attribute: {final_output[:50]}...")
            # AgentExecutor response format
            elif isinstance(response, dict) and "output" in response:
                final_output = response["output"]
                logging.info(f"DEBUG: Extracted from 'output' key: {final_output[:50]}...")
            # Fallback to string representation
            else:
                final_output = str(response)
                logging.info(f"DEBUG: Using string conversion as fallback: {final_output[:50]}...")
            
            # Guard against empty responses
            if not final_output or final_output.strip() == "":
                final_output = "I apologize, but I encountered an issue processing your request. Please try again."
                logging.info("DEBUG: Empty response detected, using fallback message")
            
            # Log assistant response to chat history
            log_chat("assistant", final_output, tags=[task_type])
            
            # Add to in-memory chat history and return
            ai_message = AIMessage(content=final_output)
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
                
                # Guard against errors in memory storage
                if not isinstance(final_output, str):
                    logging.info(f"DEBUG WARNING: final_output is not a string but {type(final_output)}")
                    memory_content = str(final_output)
                else:
                    memory_content = final_output
                
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
                    content=memory_content,  # Use potentially fixed value
                    context=prompt_str,
                    tags=potential_tags
                )
                logging.info(f"DEBUG: Memory stored with tags: {potential_tags}")
            except Exception as e:
                logging.info(f"DEBUG ERROR: Error storing memory: {str(e)}")
                import traceback
                traceback.print_exc()
                # If memory storage fails, just continue processing
                pass
            
            print("DEBUG: Returning response")
            return final_output  # Return the extracted final_output value
            
        except Exception as inner_e:
            logging.info(f"DEBUG ERROR: Error with agent execution: {str(inner_e)}")
            
            # Fallback to default model if there was an issue with specialized model
            if task_type != "default":
                print("DEBUG: Falling back to default model")
                try:
                    fallback_llm = get_llm("default", temperature=0.4)
                    # Get the model name directly from the LLM object
                    fallback_model = fallback_llm.model_name
                    logging.info(f"DEBUG: Using fallback model: {fallback_model}")
                    
                    fallback_agent = create_openai_tools_agent(fallback_llm, tools, prompt_template)
                    fallback_executor = AgentExecutor(agent=fallback_agent, tools=tools, verbose=True)
                    fallback_response = fallback_executor.invoke({
                        "input": prompt_str,
                        "chat_history": chat_history
                    })
                    
                    # Log which model was used
                    print("DEBUG: Logging fallback model response")
                    log_model_response(fallback_response)
                    
                    # Parse fallback response
                    if isinstance(fallback_response, dict):
                        # First check for OpenRouter/OpenAI response format (most likely with OpenRouter)
                        if "choices" in fallback_response and len(fallback_response["choices"]) > 0:
                            try:
                                choices = fallback_response["choices"]
                                if isinstance(choices[0], dict) and "message" in choices[0]:
                                    message = choices[0]["message"]
                                    if isinstance(message, dict) and "content" in message:
                                        fallback_output = message["content"]
                                        logging.info(f"DEBUG: Fallback found in choices[0].message.content: {fallback_output[:50]}...")
                                    else:
                                        fallback_output = str(message)
                                        logging.info(f"DEBUG: Fallback message has no content, using string conversion: {fallback_output[:50]}...")
                                else:
                                    fallback_output = str(choices[0])
                                    logging.info(f"DEBUG: Fallback choice has no message, using string conversion: {fallback_output[:50]}...")
                            except (KeyError, TypeError, IndexError) as e:
                                logging.info(f"DEBUG: Error extracting from fallback choices: {str(e)}")
                                fallback_output = str(fallback_response)
                        # Try standard output key
                        elif "output" in fallback_response:
                            fallback_output = fallback_response["output"]
                            logging.info(f"DEBUG: Fallback found in output key: {fallback_output[:50]}...")
                        else:
                            # Try other common keys
                            fallback_output = None
                            for key in ["result", "content", "message", "response", "text"]:
                                if key in fallback_response and fallback_response[key]:
                                    fallback_output = fallback_response[key]
                                    logging.info(f"DEBUG: Fallback found in {key} key: {fallback_output[:50]}...")
                                    break
                            
                            # If still no output found, convert to string
                            if not fallback_output:
                                fallback_output = str(fallback_response)
                                logging.info(f"DEBUG: No recognizable keys in fallback, using string conversion: {fallback_output[:50]}...")
                    elif hasattr(fallback_response, "content"):
                        fallback_output = fallback_response.content
                        logging.info(f"DEBUG: Fallback found in content attribute: {fallback_output[:50]}...")
                    else:
                        fallback_output = str(fallback_response)
                        logging.info(f"DEBUG: Fallback using string conversion: {fallback_output[:50]}...")
                    
                    # Guard against empty responses
                    if not fallback_output or fallback_output.strip() == "":
                        fallback_output = "I apologize, but I encountered an issue processing your request. Please try again."
                    
                    logging.info(f"DEBUG: Fallback output: {fallback_output[:50]}...")
                    
                    # Log fallback response to chat history
                    log_chat("assistant", fallback_output, tags=["default", "fallback"])
                    
                    # Add AI response to chat history with metadata
                    fallback_message = AIMessage(content=fallback_output)
                    fallback_message.metadata = {
                        "task_type": "default (fallback)",
                        "model": fallback_model,  # Use the model name from the LLM object
                        "timestamp": datetime.datetime.now().isoformat()
                    }
                    chat_history.append(fallback_message)
                    
                    print("DEBUG: Returning fallback response")
                    return fallback_output
                except Exception as fb_error:
                    logging.info(f"DEBUG ERROR: Fallback execution also failed: {str(fb_error)}")
                    raise fb_error
            else:
                # If we're already using the default model and still failed, return error message
                error_message = f"I apologize, but I encountered an error processing your request. Please try again with a different question."
                logging.info(f"DEBUG: Using default model failed, returning error message: {error_message}")
                
                # Log error message to chat history
                log_chat("assistant", error_message, tags=["error"])
                
                # Add error message to chat history
                error_ai_message = AIMessage(content=error_message)
                error_ai_message.metadata = {
                    "task_type": "error",
                    "model": model_used if 'model_used' in locals() else "none",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "error": str(inner_e)
                }
                chat_history.append(error_ai_message)
                
                return error_message
    
    except Exception as outer_e:
        logging.info(f"DEBUG CRITICAL ERROR in run_agent_loop: {str(outer_e)}")
        print("Stack trace:")
        import traceback
        traceback.print_exc()
        
        error_message = f"I apologize, but I encountered an unexpected error. Please try again later."
        
        # Log critical error to chat history
        log_chat("assistant", error_message, tags=["critical_error"])
        
        # Add error message to chat history
        try:
            error_ai_message = AIMessage(content=error_message)
            error_ai_message.metadata = {
                "task_type": "critical_error",
                "model": model_used if 'model_used' in locals() else "none",
                "timestamp": datetime.datetime.now().isoformat(),
                "error": str(outer_e)
            }
            chat_history.append(error_ai_message)
        except:
            pass
        
        return error_message