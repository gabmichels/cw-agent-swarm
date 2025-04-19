"""
Test the model badge extraction from LLM responses.

This test verifies that we can correctly extract model information from
different response formats, especially from OpenRouter responses.
"""

import os
from dotenv import load_dotenv
from langchain_core.messages import AIMessage
from apps.agents.shared.llm_router import get_llm, log_model_response

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Check API keys
print("\n=== Environment Variables ===")
openai_key = os.getenv("OPENAI_API_KEY")
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"OPENAI_API_KEY set: {'Yes' if openai_key else 'No'}")
print(f"OPENROUTER_API_KEY set: {'Yes' if openrouter_key else 'No'}")

if not openrouter_key:
    print("ERROR: No OpenRouter API key found!")
    exit(1)

# Test with different model response formats
try:
    print("\n=== Testing model badge extraction ===")
    
    # Get LLM with our router for direct tests
    llm = get_llm("default", temperature=0.1)
    print(f"Created LLM with model: {llm.model_name}")
    
    # Direct test with OpenRouter
    print("\n1. Testing direct response from OpenRouter:")
    response = llm.invoke("Tell me a short joke")
    print(f"Response content: {response.content}")
    print("Extracting model information:")
    log_model_response(response)
    
    # Test with marketing-specialized model
    print("\n2. Testing with marketing-specific model:")
    marketing_llm = get_llm("marketing", temperature=0.1)
    response = marketing_llm.invoke("Suggest a brief marketing tagline for a coffee shop")
    print(f"Response content: {response.content}")
    print("Extracting model information:")
    log_model_response(response)
    
    # Test with simulated response formats
    print("\n3. Testing with simulated response formats:")
    
    # Simulate OpenRouter response with model in additional_kwargs
    print("\na) Model in additional_kwargs:")
    simulated_response = AIMessage(content="Simulated response", 
                                  additional_kwargs={"model": "openai/gpt-4"})
    log_model_response(simulated_response)
    
    # Simulate OpenRouter response with model in metadata
    print("\nb) Model in metadata:")
    simulated_response = AIMessage(content="Simulated response", 
                                  additional_kwargs={"metadata": {"model": "anthropic/claude-3-opus"}})
    log_model_response(simulated_response)
    
    # Simulate standard response with model_name attribute
    print("\nc) Model in model_name attribute:")
    class MockResponse:
        def __init__(self):
            self.model_name = "google/gemini-pro"
            self.content = "Mock response"
    
    mock_response = MockResponse()
    log_model_response(mock_response)
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 