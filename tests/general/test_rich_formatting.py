"""
Demo of rich text formatting capabilities for chat messages.

This test demonstrates how to use the formatting utilities to create
richly formatted messages with markdown, code blocks, tables, etc.
"""

import os
from dotenv import load_dotenv
from apps.agents.shared.formatting import (
    create_code_block, 
    create_table,
    create_blockquote,
    create_checklist,
    format_message_with_prompt,
    RICH_TEXT_EXAMPLES
)
from apps.agents.shared.llm_router import get_llm

# Load environment variables
print("Loading environment variables...")
load_dotenv("apps/hq-ui/.env")

# Show examples of rich text formatting
print("\n=== Rich Text Formatting Examples ===\n")

print("1. Code Block Example:")
print(RICH_TEXT_EXAMPLES["code_example"])

print("\n2. Table Example:")
print(RICH_TEXT_EXAMPLES["table_example"])

print("\n3. Blockquote Example:")
print(RICH_TEXT_EXAMPLES["quote_example"])

print("\n4. Checklist Example:")
print(RICH_TEXT_EXAMPLES["checklist_example"])

# Demonstrate using formatting with LLM responses
try:
    print("\n=== LLM Response Formatting Examples ===\n")
    
    # Get LLM 
    llm = get_llm("writing", temperature=0.7)  # Higher temperature for more creative responses
    
    # Example 1: Code formatting
    code_prompt = format_message_with_prompt(
        "code", 
        "Write a Python function that calculates the Fibonacci sequence up to n terms."
    )
    print("\n1. Code formatting example:")
    print("Prompt:", code_prompt)
    response = llm.invoke(code_prompt)
    print("\nResponse:")
    print(response.content)
    
    # Example 2: Marketing formatting 
    marketing_prompt = format_message_with_prompt(
        "marketing",
        "Create a social media campaign outline for a new coffee shop opening."
    )
    print("\n2. Marketing formatting example:")
    print("Prompt:", marketing_prompt)
    response = llm.invoke(marketing_prompt)
    print("\nResponse:")
    print(response.content)
    
    # Example 3: Data presentation
    data_prompt = format_message_with_prompt(
        "data",
        "Present sample data comparing sales performance of three product lines over the last quarter."
    )
    print("\n3. Data formatting example:")
    print("Prompt:", data_prompt)
    response = llm.invoke(data_prompt)
    print("\nResponse:")
    print(response.content)
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n=== Test completed ===") 
 