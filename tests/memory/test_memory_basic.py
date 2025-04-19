import os
import sys
from pathlib import Path

print("Testing basic memory functions...")

# Import directly from the file
sys.path.append(str(Path(__file__).parent))
from apps.agents.shared.tools.memory_loader import save_chat_to_memory, retrieve_similar_chats

# Test basic functionality
try:
    print("\nTesting save_chat_to_memory...")
    save_chat_to_memory("This is a test memory", {"source": "test"})
    print("✅ Memory saved")
    
    print("\nTesting retrieve_similar_chats...")
    result = retrieve_similar_chats("test")
    print(f"Result: {result[:50]}...")
    print("✅ Memory retrieved")
    
    print("\nAll tests passed!")
except Exception as e:
    print(f"❌ Error during test: {e}")
    import traceback
    traceback.print_exc() 