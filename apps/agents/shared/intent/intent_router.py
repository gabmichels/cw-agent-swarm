"""
Intent Router Module

This module maps recognized intents to specific tool chains and actions.
It serves as the bridge between intent detection and agent execution.
"""
import logging
from typing import Dict, List, Any, Optional, Union, Callable
from .preprocessor import preprocess_message

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntentRouter:
    """
    Routes recognized intents to appropriate tool chains and actions.
    """
    
    def __init__(self):
        """Initialize the intent router with default handlers."""
        # Register default intent handlers
        self.intent_handlers = {
            # Research and information gathering
            "research_request": self._handle_research_request,
            "information_query": self._handle_information_query,
            
            # Task management
            "task_request": self._handle_task_request,
            "status_update": self._handle_status_update,
            
            # Action execution
            "action_request": self._handle_action_request,
            
            # Reasoning and opinion
            "opinion_request": self._handle_opinion_request,
            "clarification": self._handle_clarification,
            
            # Default handler for unknown intents
            "unknown": self._handle_unknown_intent
        }
    
    def register_handler(self, intent: str, handler: Callable) -> None:
        """
        Register a custom handler for an intent.
        
        Args:
            intent: The intent name
            handler: The handler function
        """
        self.intent_handlers[intent] = handler
        logger.info(f"Registered custom handler for intent: {intent}")
    
    def _handle_research_request(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a research request intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        topic = parameters.get("topic", "")
        sources = parameters.get("sources", [])
        urgency = parameters.get("urgency", "medium")
        
        # Convert sources to string for the tool if needed
        sources_str = ""
        if sources:
            if isinstance(sources, list):
                sources_str = ",".join(sources)
            else:
                sources_str = str(sources)
        
        # Convert keywords to string for the tool if needed
        keywords = parameters.get("keywords", [])
        keywords_str = ""
        if keywords:
            if isinstance(keywords, list):
                keywords_str = ",".join(keywords)
            else:
                keywords_str = str(keywords)
        
        # Configure tool chain for research
        tool_chain = {
            "primary_tools": ["research_and_analyze", "collect_new_data"],
            "fallback_tools": ["query_perception"],
            "tool_parameters": {
                "research_and_analyze": {
                    "topic": topic,
                    "keywords": keywords_str
                },
                "collect_new_data": {
                    "topic": topic,
                    "keywords": keywords_str
                },
                "query_perception": {
                    "query": f"What's happening with {topic}?"
                }
            },
            "execution_strategy": "serial" if urgency == "high" else "parallel",
            "wait_for_completion": urgency == "high"
        }
        
        return {
            "intent": "research_request",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "execute_tool_chain",
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_information_query(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an information query intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        topic = parameters.get("topic", "")
        
        # Configure tool chain for information retrieval
        tool_chain = {
            "primary_tools": ["search_episodic_memory", "get_memories_by_concept"],
            "fallback_tools": ["query_perception"],
            "tool_parameters": {
                "search_episodic_memory": {
                    "query": topic
                },
                "get_memories_by_concept": {
                    "tag": topic.lower().split()[0] if topic else ""
                },
                "query_perception": {
                    "query": f"What do we know about {topic}?"
                }
            },
            "execution_strategy": "sequential"
        }
        
        return {
            "intent": "information_query",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "execute_tool_chain",
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_task_request(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a task request intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        task_type = parameters.get("task_type", "")
        item = parameters.get("item", "")
        deadline = parameters.get("deadline", "")
        priority = parameters.get("priority", "medium")
        
        # Create a title from task type and item
        title = f"{task_type} {item}" if task_type else item
        description = intent_data.get("raw_message", "")
        
        # Configure tool chain for task creation
        tool_chain = {
            "primary_tools": ["create_new_task"],
            "tool_parameters": {
                "create_new_task": {
                    "title": title,
                    "description": description,
                    "priority": priority,
                    "deadline": deadline
                }
            }
        }
        
        return {
            "intent": "task_request",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "execute_tool_chain",
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_status_update(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a status update intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        topic = parameters.get("topic", "")
        importance = parameters.get("importance", "medium")
        
        # Map importance to numeric value
        importance_map = {
            "high": "high",
            "medium": "medium",
            "low": "low"
        }
        importance_value = importance_map.get(importance.lower(), "medium")
        
        # Configure tool chain for memory storage
        tool_chain = {
            "primary_tools": ["store_episodic_memory"],
            "tool_parameters": {
                "store_episodic_memory": {
                    "content": intent_data.get("raw_message", ""),
                    "context": f"Status update from user about {topic}",
                    "importance": importance_value,
                    "tags": f"status_update,{topic}" if topic else "status_update"
                }
            }
        }
        
        return {
            "intent": "status_update",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "store_information",
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_action_request(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an action request intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        action_type = parameters.get("action_type", "")
        platform = parameters.get("platform", "")
        recipient = parameters.get("recipient", "")
        content = parameters.get("content", "")
        
        # Return a configuration for action execution
        # This depends on what actions are available in the system
        return {
            "intent": "action_request",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "execute_action",
            "action_type": action_type,
            "action_parameters": {
                "platform": platform,
                "recipient": recipient,
                "content": content
            },
            "preprocessing_result": intent_data
        }
    
    def _handle_opinion_request(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an opinion request intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        topic = parameters.get("topic", "")
        options = parameters.get("options", [])
        
        # Configure tool chain for forming an opinion
        tool_chain = {
            "primary_tools": ["search_episodic_memory", "query_perception"],
            "tool_parameters": {
                "search_episodic_memory": {
                    "query": topic
                },
                "query_perception": {
                    "query": f"What's the current thinking about {topic}?"
                }
            }
        }
        
        return {
            "intent": "opinion_request",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "form_opinion",
            "topic": topic,
            "options": options,
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_clarification(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle a clarification intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        parameters = intent_data.get("parameters", {})
        topic = parameters.get("topic", "")
        
        # Configure tool chain for clarification
        tool_chain = {
            "primary_tools": ["search_chat_memory"],
            "tool_parameters": {
                "search_chat_memory": {
                    "query": topic
                }
            }
        }
        
        return {
            "intent": "clarification",
            "confidence": intent_data.get("confidence", 0.8),
            "action": "clarify",
            "topic": topic,
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def _handle_unknown_intent(self, intent_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handle an unknown intent.
        
        Args:
            intent_data: The intent data from the preprocessor
            
        Returns:
            Tool chain configuration
        """
        # For unknown intents, try to use search_chat_memory
        tool_chain = {
            "primary_tools": ["search_chat_memory"],
            "tool_parameters": {
                "search_chat_memory": {
                    "query": intent_data.get("raw_message", "")
                }
            }
        }
        
        return {
            "intent": "unknown",
            "confidence": intent_data.get("confidence", 0.1),
            "action": "default_processing",
            "tool_chain": tool_chain,
            "preprocessing_result": intent_data
        }
    
    def route(self, user_message: str) -> Dict[str, Any]:
        """
        Process a user message and route it to the appropriate handler.
        
        Args:
            user_message: The message from the user
            
        Returns:
            Intent routing result with tool chain configuration
        """
        # Preprocess the message to identify intent
        intent_data = preprocess_message(user_message)
        
        # Get the intent
        intent = intent_data.get("intent", "unknown")
        
        # Get the handler for this intent
        handler = self.intent_handlers.get(intent, self._handle_unknown_intent)
        
        # Call the handler
        result = handler(intent_data)
        
        logger.info(f"Routed message to {intent} handler with confidence {intent_data.get('confidence', 0)}")
        
        return result

# Create a singleton instance
intent_router = IntentRouter()

def route_intent(user_message: str) -> Dict[str, Any]:
    """
    Route a user message to the appropriate intent handler.
    
    Args:
        user_message: The message from the user
        
    Returns:
        Intent routing result with tool chain configuration
    """
    return intent_router.route(user_message)

def register_custom_handler(intent: str, handler: Callable) -> None:
    """
    Register a custom handler for an intent.
    
    Args:
        intent: The intent name
        handler: The handler function
    """
    intent_router.register_handler(intent, handler)

if __name__ == "__main__":
    # Test the intent router
    test_messages = [
        "Can you look into the latest trends in AI translation?",
        "Bring yourself up to speed on language barriers in customer service",
        "Is there anything on social media about voice recognition problems?",
        "What do you know about our marketing campaign performance?",
        "Create a blog post about AI ethics",
        "Schedule a meeting with the marketing team for tomorrow",
        "I think we should pivot our strategy for Q4",
        "Can you explain more about the perception system you mentioned?"
    ]
    
    for message in test_messages:
        result = route_intent(message)
        print(f"\nMessage: {message}")
        print(f"Intent: {result.get('intent')} (Confidence: {result.get('confidence', 0)})")
        print(f"Action: {result.get('action')}")
        if "tool_chain" in result:
            print("Tool Chain:")
            for tool in result.get("tool_chain", {}).get("primary_tools", []):
                print(f"  - {tool}")
        print() 