"""
Test for enhanced agent functionality, showing model badge extraction and rich formatting.

This test simulates an agent interaction that displays both the improved
model badge detection and rich formatting in responses.
"""

import os
import sys
from dotenv import load_dotenv
from apps.agents.shared.llm_router import get_llm, log_model_response
from apps.agents.shared.agent_prompts import enhance_prompt_with_formatting

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check environment variables
print("\n=== Environment Variables ===")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OPENROUTER_API_KEY found. Please set it in your environment.")
    sys.exit(1)

try:
    print("\n=== Testing Enhanced Agent Features ===")
    
    # First test: CMO persona with rich formatting
    print("\n1. CMO Agent Response with Rich Formatting:")
    
    # Get marketing-specific LLM
    llm = get_llm("marketing", temperature=0.4)
    print(f"Created LLM with model: {llm.model_name}")
    
    # Create enhanced prompt with formatting instructions
    cmo_prompt = enhance_prompt_with_formatting(
        "You are Chloe, a Chief Marketing Officer. Create a Twitter post for our upcoming product release.", 
        "cmo"
    )
    
    # Get the response
    response = llm.invoke(cmo_prompt + "\n\nWrite a Twitter post that hypes up our users for the next coming weeks.")
    
    # Show the response with model information
    print("\nPrompt used:", cmo_prompt)
    print("\nResponse:")
    print(response.content)
    print("\nModel information:")
    log_model_response(response)
    
    # Second test: CTO persona with code example
    print("\n2. CTO Agent Response with Code Formatting:")
    
    # Get technical LLM
    llm = get_llm("default", temperature=0.2)  # Lower temperature for more precise response
    print(f"Created LLM with model: {llm.model_name}")
    
    # Create enhanced prompt with formatting instructions
    cto_prompt = enhance_prompt_with_formatting(
        "You are Alex, a Chief Technology Officer. Provide a code example to solve the following problem.", 
        "cto"
    )
    
    # Get the response
    response = llm.invoke(cto_prompt + "\n\nProvide a simple Python function to validate if a password is strong enough.")
    
    # Show the response with model information
    print("\nPrompt used:", cto_prompt)
    print("\nResponse:")
    print(response.content)
    print("\nModel information:")
    log_model_response(response)
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 
 