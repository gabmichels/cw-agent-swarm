"""
Chloe - Chief Marketing Officer AI Agent
---------------------------------------
Main entry point for the Chloe agent that assembles all components.
"""

import sys
import os
import datetime
from pathlib import Path
import logging
from dotenv import load_dotenv

# Add the project root to Python path to enable imports
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
project_root = script_dir.parent.parent  # Up two levels (to project root)
sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"chloe_log_{datetime.datetime.now().strftime('%Y%m%d')}.log")
    ]
)
logger = logging.getLogger(__name__)

# Import shared components
from shared.agent_core.agent_loop import AgentLoop
from shared.agent_core.llm_router import get_llm, log_model_response
from shared.agent_core.reflection import (
    generate_reflection, 
    get_reflections_by_agent,
    run_weekly_reflection
)
from shared.agent_core.memory.chat_history import (
    log_chat,
    get_recent_history, 
    format_for_langchain
)

# Import Chloe-specific components
from .agent_config import AGENT_NAME, SYSTEM_PROMPT, MODEL_PREFERENCES
from .tools import content_planner
from .reflections import cmo_reflection  # This would be Chloe-specific reflection handling

def get_cmo_llm(task_type: str = "marketing"):
    """Get the appropriate LLM for CMO tasks with Chloe's preferences"""
    return get_llm(task_type, temperature=0.4)

def initialize_chloe():
    """Initialize and configure the Chloe agent"""
    # Configure available tools
    tools = [
        # Content planning tools
        content_planner.create_content_idea,
        content_planner.schedule_content_for_publishing,
        content_planner.view_content_calendar,
        content_planner.analyze_content_performance,
        content_planner.generate_content_brief,
        
        # Additional tools would be registered here
        # Including shared tools imported from the shared agent_core tools
    ]
    
    # Initialize memory system to handle chat history
    def memory_provider(role=None, content=None, timestamp=None, limit=None):
        """Memory provider function that handles both storing and retrieving"""
        if role and content:
            # Store mode
            log_chat(role, content, tags=["cmo"])
            return True
        elif limit:
            # Retrieve mode
            recent_history = get_recent_history(n=limit)
            return format_for_langchain(recent_history)
        return []

    # Create the agent
    agent = AgentLoop(
        agent_name=AGENT_NAME,
        system_prompt=SYSTEM_PROMPT,
        llm_provider=get_cmo_llm,
        tools=tools,
        memory_provider=memory_provider
    )
    
    logger.info(f"Initialized {AGENT_NAME} agent with {len(tools)} tools")
    return agent

def run_chloe(input_text: str):
    """Process a user input through Chloe"""
    # Initialize the agent if not already done
    if not hasattr(run_chloe, "agent"):
        run_chloe.agent = initialize_chloe()
    
    # Process the input
    logger.info(f"Processing input: {input_text[:50]}...")
    return run_chloe.agent.run_agent(input_text)

if __name__ == "__main__":
    print(f"🤖 Ask {AGENT_NAME} anything:")
    
    try:
        while True:
            prompt = input("🧠 You: ")
            if prompt.lower() in ["exit", "quit"]:
                break
                
            response = run_chloe(prompt)
            print(f"{AGENT_NAME}:", response)
    except KeyboardInterrupt:
        print("\nGoodbye!")
    except Exception as e:
        logger.error(f"Error in main loop: {str(e)}")
        print(f"An error occurred: {str(e)}")

    print("Thank you for using the CMO agent!") 