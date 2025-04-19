import os
import sys
from dotenv import load_dotenv

# Add the parent directory to the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
load_dotenv("apps/hq-ui/.env")

# Import our agent executor
from apps.agents.departments.marketing.cmo_executor import run_agent_loop

# Test with a marketing-related query
print("\n=== Testing Response Extraction Fix ===")
test_prompt = "Tell me about our brand positioning."
print(f"User prompt: {test_prompt}")

try:
    # Run the agent loop
    print("\nRunning agent loop...")
    response = run_agent_loop(test_prompt)
    
    # Display the response
    print("\n=== Agent Response ===")
    if response:
        print(f"Response length: {len(response)}")
        print(f"Response: {response}")
        print("\n✅ SUCCESS: Got a non-empty response!")
    else:
        print("❌ FAILURE: Response is empty!")
    
    # Now try a writing-related query
    print("\n=== Testing Different Task Type ===")
    writing_prompt = "Write a short paragraph about our product features."
    print(f"User prompt: {writing_prompt}")
    
    # Run the agent loop again
    print("\nRunning agent loop...")
    writing_response = run_agent_loop(writing_prompt)
    
    # Display the response
    print("\n=== Agent Response (Writing Task) ===")
    if writing_response:
        print(f"Response length: {len(writing_response)}")
        print(f"Response: {writing_response}")
        print("\n✅ SUCCESS: Got a non-empty response!")
    else:
        print("❌ FAILURE: Response is empty!")
        
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 