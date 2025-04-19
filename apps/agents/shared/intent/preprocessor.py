"""
Intent Preprocessor Module

This module uses a lightweight Gemini model to analyze user messages,
identify their intents, and extract relevant parameters before passing
the messages to the main agent processing pipeline.
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Keep track of known intents for analytics
KNOWN_INTENTS_FILE = os.path.join(os.path.dirname(__file__), "data", "known_intents.json")

# Ensure the data directory exists
os.makedirs(os.path.dirname(KNOWN_INTENTS_FILE), exist_ok=True)

# Try to import the Gemini model
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    logger.warning("Google Generative AI package not available. Will use fallback method.")

class IntentPreprocessor:
    """
    A preprocessor that uses Gemini to identify intents in user messages.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the intent preprocessor.
        
        Args:
            api_key: Optional Gemini API key. If not provided, will try to use environment variable.
        """
        self.model = None
        self.known_intents = self._load_known_intents()
        
        if GEMINI_AVAILABLE:
            try:
                # Use provided API key or environment variable
                api_key = api_key or os.environ.get("GEMINI_API_KEY")
                
                if api_key:
                    genai.configure(api_key=api_key)
                    # Use Gemini-1.0 Pro or Gemini-1.5 Flash for lightweight processing
                    model_name = "gemini-1.5-flash"
                    self.model = genai.GenerativeModel(model_name)
                    logger.info(f"Initialized Gemini model: {model_name}")
                else:
                    logger.warning("No Gemini API key provided. Will use fallback method.")
            except Exception as e:
                logger.error(f"Error initializing Gemini model: {e}")
    
    def _load_known_intents(self) -> Dict[str, Dict[str, Any]]:
        """
        Load the known intents from the JSON file.
        
        Returns:
            Dictionary of known intents and their metadata
        """
        if os.path.exists(KNOWN_INTENTS_FILE):
            try:
                with open(KNOWN_INTENTS_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading known intents: {e}")
        
        # Return default known intents if file doesn't exist or has an error
        return {
            "research_request": {
                "description": "User wants the agent to research a topic",
                "example_phrases": [
                    "look into {topic}",
                    "can you find information about {topic}",
                    "bring yourself up to speed on {topic}",
                    "is there anything on social media about {topic}",
                    "inform yourself about {topic}"
                ],
                "parameter_schema": {
                    "topic": "string", 
                    "sources": "list[string]", 
                    "urgency": "string"
                },
                "count": 0,
                "last_seen": None
            },
            "information_query": {
                "description": "User is asking for information the agent should already know",
                "example_phrases": [
                    "what do you know about {topic}",
                    "tell me about {topic}",
                    "any insights on {topic}",
                    "what's your understanding of {topic}"
                ],
                "parameter_schema": {
                    "topic": "string"
                },
                "count": 0,
                "last_seen": None
            },
            "task_request": {
                "description": "User wants the agent to perform a specific task",
                "example_phrases": [
                    "can you create {item}",
                    "please draft {item}",
                    "make a {item}",
                    "I need you to prepare {item}"
                ],
                "parameter_schema": {
                    "task_type": "string",
                    "item": "string",
                    "deadline": "string",
                    "priority": "string"
                },
                "count": 0,
                "last_seen": None
            },
            "status_update": {
                "description": "User is providing information or updates",
                "example_phrases": [
                    "just to let you know",
                    "FYI",
                    "here's an update",
                    "I wanted to inform you"
                ],
                "parameter_schema": {
                    "topic": "string",
                    "importance": "string"
                },
                "count": 0,
                "last_seen": None
            },
            "action_request": {
                "description": "User wants the agent to take a specific action now",
                "example_phrases": [
                    "send a message to {recipient}",
                    "schedule a meeting about {topic}",
                    "post an update on {platform}"
                ],
                "parameter_schema": {
                    "action_type": "string",
                    "platform": "string",
                    "recipient": "string",
                    "content": "string"
                },
                "count": 0,
                "last_seen": None
            },
            "opinion_request": {
                "description": "User wants the agent's perspective or recommendation",
                "example_phrases": [
                    "what do you think about {topic}",
                    "should we {action}",
                    "is {item} a good idea",
                    "your thoughts on {topic}"
                ],
                "parameter_schema": {
                    "topic": "string",
                    "options": "list[string]"
                },
                "count": 0,
                "last_seen": None
            },
            "clarification": {
                "description": "User is asking for details about something previously discussed",
                "example_phrases": [
                    "can you explain more about {topic}",
                    "I didn't understand {topic}",
                    "tell me more about {topic}"
                ],
                "parameter_schema": {
                    "topic": "string"
                },
                "count": 0,
                "last_seen": None
            }
        }
    
    def _save_known_intents(self) -> None:
        """Save the known intents to the JSON file."""
        try:
            os.makedirs(os.path.dirname(KNOWN_INTENTS_FILE), exist_ok=True)
            with open(KNOWN_INTENTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(self.known_intents, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving known intents: {e}")
    
    def _register_new_intent(self, intent: str, description: str) -> None:
        """
        Register a new intent in the known intents.
        
        Args:
            intent: Name of the new intent
            description: Description of the intent
        """
        self.known_intents[intent] = {
            "description": description,
            "example_phrases": [],
            "parameter_schema": {},
            "count": 1,
            "last_seen": datetime.now().isoformat()
        }
        logger.info(f"Registered new intent: {intent} - {description}")
        self._save_known_intents()
    
    def _update_intent_stats(self, intent: str) -> None:
        """
        Update statistics for an intent.
        
        Args:
            intent: Name of the intent
        """
        if intent in self.known_intents:
            self.known_intents[intent]["count"] += 1
            self.known_intents[intent]["last_seen"] = datetime.now().isoformat()
            self._save_known_intents()
    
    def preprocess(self, user_message: str) -> Dict[str, Any]:
        """
        Preprocess a user message to identify intent and extract parameters.
        
        Args:
            user_message: The message from the user
            
        Returns:
            Dictionary containing intent analysis
        """
        # Default response if Gemini not available
        default_response = {
            "intent": "unknown",
            "confidence": 0.0,
            "parameters": {},
            "raw_message": user_message,
            "preprocessed": False
        }
        
        # If Gemini not available or model not initialized, return default
        if not GEMINI_AVAILABLE or not self.model:
            logger.warning("Gemini not available. Using fallback method.")
            return default_response
        
        try:
            # Create the prompt for Gemini
            prompt = f"""
            Classify the following user message intent and extract key parameters.
            
            USER MESSAGE: {user_message}
            
            First, determine which of these intent categories BEST matches the message:
            {json.dumps([{"intent": k, "description": v["description"]} for k, v in self.known_intents.items()], indent=2)}
            
            If none match well, create a NEW intent label that accurately describes the user's intent.
            
            Return JSON with the following structure:
            {{
                "intent": "intent_label",
                "confidence": 0.0-1.0,
                "description": "Brief description of what this intent means",
                "parameters": {{
                    "topic": "main subject",
                    "sources": ["reddit", "rss", "news"],
                    "urgency": "high|medium|low",
                    "other_relevant_fields": "..."
                }}
            }}
            
            IMPORTANT: Return ONLY the JSON object, no other text. For parameters, extract ANY relevant information from the message.
            """
            
            # Generate response from Gemini
            response = self.model.generate_content(prompt)
            response_text = response.text
            
            # Clean up the response text to extract the JSON
            if "```json" in response_text:
                # Extract JSON from code block
                json_part = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                # Extract JSON from code block (no language specified)
                json_part = response_text.split("```")[1].strip()
            else:
                # No code block, assume the entire response is JSON
                json_part = response_text.strip()
            
            # Parse the JSON
            intent_data = json.loads(json_part)
            
            # Update or register the intent
            intent = intent_data.get("intent", "unknown")
            
            if intent not in self.known_intents:
                description = intent_data.get("description", "No description provided")
                self._register_new_intent(intent, description)
            else:
                self._update_intent_stats(intent)
            
            # Add the raw message and mark as preprocessed
            intent_data["raw_message"] = user_message
            intent_data["preprocessed"] = True
            
            return intent_data
            
        except Exception as e:
            logger.error(f"Error preprocessing intent: {e}")
            return default_response
    
    def get_known_intents(self) -> Dict[str, Dict[str, Any]]:
        """
        Get the known intents and their metadata.
        
        Returns:
            Dictionary of known intents
        """
        return self.known_intents

# Create a singleton instance
intent_preprocessor = IntentPreprocessor()

def preprocess_message(message: str) -> Dict[str, Any]:
    """
    Preprocess a user message to identify intent.
    
    Args:
        message: The message from the user
        
    Returns:
        Dictionary containing intent analysis
    """
    return intent_preprocessor.preprocess(message)

def get_intent_statistics() -> Dict[str, Dict[str, Any]]:
    """
    Get statistics about recognized intents.
    
    Returns:
        Dictionary of intent statistics
    """
    return intent_preprocessor.get_known_intents()

if __name__ == "__main__":
    # Test the intent preprocessor
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
        intent_data = preprocess_message(message)
        print(f"\nMessage: {message}")
        print(f"Intent: {intent_data.get('intent')} (Confidence: {intent_data.get('confidence', 0)})")
        print(f"Parameters: {json.dumps(intent_data.get('parameters', {}), indent=2)}") 