import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

# Set up path to include project root
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Check if we have required environment variables
if "OPENROUTER_API_KEY" not in os.environ:
    print("Warning: OPENROUTER_API_KEY not set. Tests will not make actual API calls.")
    MOCK_MODE = True
else:
    MOCK_MODE = False

# Import the module to test
from shared.agent_core.llm_router import get_llm

class TestLLMRouter(unittest.TestCase):
    """Test cases for the LLM Router module"""
    
    @patch("openai.OpenAI")
    def test_get_llm_with_mock(self, mock_openai):
        """Test the get_llm function with mocked OpenAI client"""
        # Setup the mock
        mock_instance = mock_openai.return_value
        mock_instance.chat.completions.create.return_value.choices[0].message.content = "Mocked response"
        
        # Test with various task types
        llm = get_llm("general")
        response = llm.invoke("Say hello")
        self.assertEqual(response, "Mocked response")
        
        llm = get_llm("writing")
        response = llm.invoke("Write a story")
        self.assertEqual(response, "Mocked response")
        
        llm = get_llm("marketing")
        response = llm.invoke("Create an ad campaign")
        self.assertEqual(response, "Mocked response")
        
        llm = get_llm("technical")
        response = llm.invoke("Explain APIs")
        self.assertEqual(response, "Mocked response")
    
    @unittest.skipIf(MOCK_MODE, "Skipping live API test because OPENROUTER_API_KEY is not set")
    def test_get_llm_live(self):
        """Test the get_llm function with live API calls"""
        # Only runs if OPENROUTER_API_KEY is set
        
        # Test with various task types
        print("\nTesting LLM router with live API calls...")
        
        print("\nTesting 'general' task type:")
        llm = get_llm("general")
        response = llm.invoke("Write one sentence about the weather.")
        print(f"Response from general LLM: {response[:100]}...")
        self.assertIsInstance(response, str)
        self.assertTrue(len(response) > 0)
        
        print("\nTesting 'writing' task type:")
        llm = get_llm("writing") 
        response = llm.invoke("Write one sentence about a cat.")
        print(f"Response from writing LLM: {response[:100]}...")
        self.assertIsInstance(response, str)
        self.assertTrue(len(response) > 0)
        
        print("\nTesting 'marketing' task type:")
        llm = get_llm("marketing")
        response = llm.invoke("Write one sentence for a coffee ad.")
        print(f"Response from marketing LLM: {response[:100]}...")
        self.assertIsInstance(response, str)
        self.assertTrue(len(response) > 0)
        
        print("\nTesting 'technical' task type:")
        llm = get_llm("technical")
        response = llm.invoke("Explain what an API is in one sentence.")
        print(f"Response from technical LLM: {response[:100]}...")
        self.assertIsInstance(response, str)
        self.assertTrue(len(response) > 0)

if __name__ == "__main__":
    unittest.main() 