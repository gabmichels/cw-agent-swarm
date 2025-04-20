import os
import sys
from pathlib import Path

# Set up proper imports
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Check for API key
if 'OPENROUTER_API_KEY' not in os.environ:
    print("Please set OPENROUTER_API_KEY environment variable")
    sys.exit(1)

# Import once path is set
from shared.agent_core.llm_router import get_llm, log_model_response, get_model_for_task

def test_marketing_prompt():
    """Test a marketing-specific prompt"""
    print("\n=== Testing Marketing Prompt ===")
    
    llm = get_llm("marketing")
    prompt = """
    I need to create a content strategy for a new SaaS product.
    The target audience is small business owners.
    What are the key channels I should focus on?
    """
    
    response = llm.invoke(prompt)
    print(f"Response content (first 150 chars): {response.content[:150]}...")
    
    # Log the model that was used
    log_model_response(response)
    
    return True

def test_writing_prompt():
    """Test a writing-specific prompt"""
    print("\n=== Testing Writing Prompt ===")
    
    llm = get_llm("writing")
    prompt = """
    Write a short paragraph about artificial intelligence and its impact on society.
    Make it engaging and easy to understand for a general audience.
    """
    
    response = llm.invoke(prompt)
    print(f"Response content (first 150 chars): {response.content[:150]}...")
    
    # Log the model that was used
    log_model_response(response)
    
    return True

if __name__ == "__main__":
    # Run all tests
    test_marketing_prompt()
    test_writing_prompt() 