"""
A simplified test for the OpenRouter integration.
This script directly verifies the response parsing.
"""
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Add the parent directory to the path so we can import our modules
sys.path.append(".")

# Import the LLM router
from apps.agents.shared.llm_router import get_llm

def main():
    """Main test function to verify OpenRouter integration."""
    print("\n=== TESTING OPENROUTER INTEGRATION ===\n")
    
    # Check environment variables
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        print("❌ Error: OPENROUTER_API_KEY not found in environment")
        return
    
    print("✓ OpenRouter API key found")
    
    try:
        # Get the LLM for marketing task type
        llm = get_llm("marketing", temperature=0.4)
        print(f"✓ Successfully created LLM with model: {llm.model_name}")
        print(f"✓ LLM class: {llm.__class__.__name__}")
        
        # Invoke the LLM
        print("\nSending test request to OpenRouter...")
        response = llm.invoke("Write a very short marketing tagline for a coffee shop.")
        
        # Check response
        print(f"\nResponse type: {type(response)}")
        
        # If response has content attribute (typical LangChain response)
        if hasattr(response, "content"):
            print(f"Response content: {response.content}")
        # If raw API response
        elif isinstance(response, dict) and "choices" in response:
            choices = response["choices"]
            if len(choices) > 0 and isinstance(choices[0], dict) and "message" in choices[0]:
                message = choices[0]["message"]
                if "content" in message:
                    print(f"Response content from choices: {message['content']}")
                else:
                    print(f"Message format unexpected: {message}")
            else:
                print(f"Choices format unexpected: {choices}")
        else:
            print(f"Unknown response format: {response}")
        
        print("\n✓ Test completed successfully")
        
    except Exception as e:
        print(f"\n❌ Error during test: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 