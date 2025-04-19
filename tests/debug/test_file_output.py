import os
import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

# Set up logging to file
logs_dir = Path("./logs")
logs_dir.mkdir(exist_ok=True)
log_file = logs_dir / "debug_direct_test.log"

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()  # Also output to console
    ]
)

logging.info(f"=== Debug script starting up ===")

# Add the parent directory to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
logging.info("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Import our test modules
from apps.agents.shared.llm_router import get_llm, log_model_response

logging.info("=== Testing Direct LLM Response For Debugging ===")

# Check environment variables
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
logging.info(f"OPENAI_API_KEY set: {'Yes' if openai_key else 'No'}")
logging.info(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key and not openai_key:
    logging.error("ERROR: No API keys found. Please set either OPENAI_API_KEY or OPENROUTER_API_KEY.")
    sys.exit(1)

# Simple writing prompt to test response structure
test_prompt = "Write a short slogan for Crowd Wisdom."

try:
    # First, log the environment
    logging.info("Python version: " + sys.version)
    logging.info("Working directory: " + os.getcwd())
    
    # Get LLM for writing task
    logging.info("Getting LLM...")
    llm = get_llm("writing", temperature=0.7)
    logging.info(f"Using model: {llm.model_name}")
    logging.info(f"LLM type: {type(llm)}")
    
    # Invoke the LLM
    logging.info("Invoking LLM...")
    try:
        response = llm.invoke(test_prompt)
        logging.info("LLM invocation successful")
    except Exception as invoke_e:
        logging.error(f"Error invoking LLM: {str(invoke_e)}")
        raise invoke_e
    
    # Log the raw response
    logging.info(f"Response type: {type(response)}")
    logging.info(f"Response dir: {dir(response)}")
    
    # Attempt to access key attributes
    try:
        if hasattr(response, "content"):
            logging.info(f"Response content: {response.content}")
        
        if hasattr(response, "additional_kwargs"):
            logging.info(f"Response additional_kwargs: {response.additional_kwargs}")
            
        # Try to log the raw representation
        response_str = str(response)
        logging.info(f"Response as string: {response_str[:500]}...")
        
        # If it's a dictionary, log its structure
        if isinstance(response, dict):
            logging.info(f"Response is a dictionary with keys: {list(response.keys())}")
            
            # Log values for each key
            for key in response.keys():
                try:
                    value = response[key]
                    logging.info(f"Key '{key}' has value of type {type(value)}")
                    if isinstance(value, (str, int, float, bool)):
                        logging.info(f"Key '{key}' value: {value}")
                    else:
                        logging.info(f"Key '{key}' value (repr): {repr(value)[:100]}")
                except Exception as key_e:
                    logging.error(f"Error accessing key '{key}': {str(key_e)}")
    
    except Exception as attr_e:
        logging.error(f"Error examining response: {str(attr_e)}")
    
    # Try some common response patterns
    logging.info("\n=== Testing Content Extraction ===")
    
    # Try various extraction methods in order of likelihood
    extraction_methods = [
        "response.content",
        "choices[0].message.content",
        "output",
        "content",
        "message",
        "str(response)"
    ]
    
    for method in extraction_methods:
        try:
            content = None
            
            # Try the different extraction methods
            if method == "response.content" and hasattr(response, "content"):
                content = response.content
            elif method == "choices[0].message.content" and isinstance(response, dict) and "choices" in response:
                if response["choices"] and isinstance(response["choices"][0], dict) and "message" in response["choices"][0]:
                    message = response["choices"][0]["message"]
                    if isinstance(message, dict) and "content" in message:
                        content = message["content"]
            elif method == "output" and isinstance(response, dict) and "output" in response:
                content = response["output"]
            elif method == "content" and isinstance(response, dict) and "content" in response:
                content = response["content"]
            elif method == "message" and isinstance(response, dict) and "message" in response:
                content = response["message"]
            elif method == "str(response)":
                content = str(response)
            
            if content:
                logging.info(f"Method '{method}' succeeded: {content[:100]}...")
            else:
                logging.info(f"Method '{method}' failed - no content found")
                
        except Exception as method_e:
            logging.error(f"Error with method '{method}': {str(method_e)}")
    
    logging.info("=== Content extraction test complete ===")
    
except Exception as e:
    logging.error(f"Error: {str(e)}")
    import traceback
    logging.error(traceback.format_exc())

logging.info("=== Test completed ===")
print(f"Debug log written to: {log_file}") 