"""
Agent Core Loop
-------------
Shared agent loop logic for all agent types. This module defines the main
behavior loop for agents, handling:
- User interaction
- Task planning and execution
- Memory and reflection
- Agent autonomy
"""

from typing import Dict, List, Any, Optional, Callable
import datetime
import logging
from pathlib import Path
import os
import json
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import AIMessage, HumanMessage

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentLoop:
    """Main agent behavior loop implementation"""
    
    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        llm_provider: Callable,
        tools: List,
        memory_provider: Optional[Callable] = None
    ):
        """
        Initialize the agent loop.
        
        Args:
            agent_name: Name of the agent
            system_prompt: System prompt for the agent
            llm_provider: Function that returns an LLM instance
            tools: List of tools available to the agent
            memory_provider: Optional function that returns a memory instance
        """
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.llm_provider = llm_provider
        self.tools = tools
        self.memory_provider = memory_provider
        self.chat_history = []
        self.execution_count = 0
        self.last_reflection_time = None
        
        # Set up the prompt template
        self.prompt_template = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        # Initialize the agent
        self._init_agent()
    
    def _init_agent(self):
        """Initialize or reinitialize the agent with current settings"""
        # Get LLM
        llm = self.llm_provider()
        
        # Create agent
        agent = create_openai_tools_agent(llm, self.tools, self.prompt_template)
        
        # Create agent executor
        self.agent_executor = AgentExecutor(agent=agent, tools=self.tools, verbose=True)
        
        logger.info(f"Initialized {self.agent_name} agent with {len(self.tools)} tools")
    
    def add_tool(self, tool):
        """
        Add a new tool to the agent.
        
        Args:
            tool: The tool to add
        """
        self.tools.append(tool)
        self._init_agent()  # Reinitialize agent with new tools
        logger.info(f"Added tool to {self.agent_name} agent")
    
    def run_agent(self, user_input: str) -> str:
        """
        Process a user input through the agent loop.
        
        Args:
            user_input: The user's input message
            
        Returns:
            The agent's response
        """
        # Load recent chat history if available
        if self.memory_provider:
            try:
                recent_history = self.memory_provider(limit=10)
                self.chat_history = recent_history
                logger.info(f"Loaded {len(recent_history)} recent chat messages")
            except Exception as e:
                logger.error(f"Error loading chat history: {str(e)}")
        
        # Log the user input
        self._log_message("user", user_input)
        
        # Track pre-processing
        self.execution_count += 1
        start_time = datetime.datetime.now()
        
        try:
            # Run the input through the agent
            logger.info(f"Processing user input: {user_input[:50]}...")
            response = self.agent_executor.invoke({
                "input": user_input,
                "chat_history": self.chat_history
            })
            
            # Extract the output text
            output = response.get("output", "I'm sorry, I couldn't process that.")
            logger.info(f"Agent response generated ({len(output)} chars)")
            
            # Log the agent's response
            self._log_message("ai", output)
            
            # Check if reflection is needed
            self._maybe_reflect()
            
            return output
        
        except Exception as e:
            error_msg = f"Error in agent execution: {str(e)}"
            logger.error(error_msg)
            self._log_message("ai", f"I encountered an error: {str(e)}")
            return f"I encountered an error: {str(e)}"
        
        finally:
            # Log execution time
            execution_time = (datetime.datetime.now() - start_time).total_seconds()
            logger.info(f"Agent execution completed in {execution_time:.2f} seconds")
    
    def _log_message(self, role: str, content: str) -> None:
        """
        Log a message to the chat history.
        
        Args:
            role: The role of the sender ('user' or 'ai')
            content: The message content
        """
        # Add message to in-memory history
        timestamp = datetime.datetime.now().isoformat()
        message = {
            "role": role,
            "content": content,
            "timestamp": timestamp
        }
        self.chat_history.append(message)
        
        # If memory provider available, save there too
        if self.memory_provider:
            try:
                self.memory_provider(role=role, content=content, timestamp=timestamp)
            except Exception as e:
                logger.error(f"Error saving message to memory: {str(e)}")
    
    def _maybe_reflect(self) -> None:
        """Check if it's time for the agent to reflect on recent interactions"""
        # Determine if reflection is needed
        now = datetime.datetime.now()
        
        # Reflect every 10 interactions or once per day
        should_reflect = (
            self.execution_count % 10 == 0 or
            self.last_reflection_time is None or
            (now - self.last_reflection_time).days >= 1
        )
        
        if should_reflect:
            self._run_reflection()
            self.last_reflection_time = now
    
    def _run_reflection(self) -> None:
        """Run a reflection process over recent interactions"""
        logger.info("Running agent reflection process")
        
        # In the future, this would connect to a reflection system
        # For now we'll just log that reflection would happen
        logger.info("Agent reflection completed")
    
    def get_agent_state(self) -> Dict[str, Any]:
        """
        Get the current state of the agent.
        
        Returns:
            Dictionary with agent state information
        """
        return {
            "agent_name": self.agent_name,
            "execution_count": self.execution_count,
            "chat_history_length": len(self.chat_history),
            "tool_count": len(self.tools),
            "last_reflection": self.last_reflection_time.isoformat() if self.last_reflection_time else None
        } 