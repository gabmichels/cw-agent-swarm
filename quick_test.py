import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Import the LLM router
sys.path.append("..")
from apps.agents.shared.llm_router import get_llm

# Prompt to test with
test_prompt = "Write a short slogan for our company."

# Get LLM
print("Getting LLM...")
llm = get_llm("writing", temperature=0.7)
print(f"Using model: {llm.model_name}")

# Invoke LLM directly
print("\nInvoking LLM with prompt: '{test_prompt}'")
response = llm.invoke(test_prompt)

# Print response details
print(f"\nResponse type: {type(response)}")
print(f"Response has content attribute: {hasattr(response, 'content')}")
print(f"Response has additional_kwargs: {hasattr(response, 'additional_kwargs')}")

# Extract and display content
if hasattr(response, "content"):
    print(f"\nExtracted content: '{response.content}'")
    print("\nTest SUCCESSFUL - content attribute exists and can be accessed directly")
else:
    print("\nWARNING: No content attribute found!")
    print(f"String representation: {str(response)}") 