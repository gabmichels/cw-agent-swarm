import os
import sys
from langchain_core.messages import HumanMessage

# Add the parent directory to the path so we can import from apps
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import the LLM router
from apps.agents.shared.llm_router import get_llm, log_model_response

# Set up test environment variables (these would normally be in your .env file)
os.environ["OPENROUTER_API_KEY"] = "test_key"  # Replace with your actual key for testing

# Create an LLM instance
print("Creating LLM instance with default parameters...")
llm = get_llm()

# Inspect the LLM instance
print(f"\nLLM instance: {llm}")
print(f"LLM default headers: {getattr(llm, 'default_headers', 'No default_headers attribute')}")
print(f"LLM headers: {getattr(llm, 'headers', 'No headers attribute')}")

# Check what other attributes the LLM has that might be related to headers
print("\nAll LLM attributes:")
for attr in dir(llm):
    if not attr.startswith('_') and not callable(getattr(llm, attr)):
        try:
            print(f"{attr}: {getattr(llm, attr)}")
        except:
            print(f"{attr}: <unable to retrieve value>")

# Create a fixed version for comparison
print("\nCreating a fixed LLM instance with headers parameter explicitly set...")
try:
    # This is how it should be done, for comparison
    from langchain_openai import ChatOpenAI
    
    headers = {
        "HTTP-Referer": "https://crowd-wisdom.com",
        "X-Title": "Chloe AI CMO"
    }
    
    fixed_llm = ChatOpenAI(
        model="openai/gpt-4.1",
        temperature=0.4,
        base_url="https://openrouter.ai/api/v1",
        api_key="test_key",
        default_headers=headers  # Using default_headers instead of headers
    )
    
    print(f"\nFixed LLM instance: {fixed_llm}")
    print(f"Fixed LLM default headers: {getattr(fixed_llm, 'default_headers', 'No default_headers attribute')}")
    print(f"Fixed LLM headers: {getattr(fixed_llm, 'headers', 'No headers attribute')}")
except Exception as e:
    print(f"Error creating fixed LLM: {str(e)}") 