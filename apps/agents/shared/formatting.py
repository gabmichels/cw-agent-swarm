"""
Text formatting utilities for rich chat messages.

This module contains helper functions for formatting chat messages with
rich markdown, code blocks, quotes, and other formatting features.
"""

from typing import Dict, Any, Optional, List

def format_rich_text(content: str) -> str:
    """
    Ensure rich text formatting is properly preserved.
    This is a helper that can be called before returning responses.
    
    Args:
        content: The raw text content to format
        
    Returns:
        Properly formatted text with markdown features preserved
    """
    # Already properly formatted, just return it
    return content

def create_code_block(code: str, language: str = "") -> str:
    """
    Create a properly formatted code block.
    
    Args:
        code: The code to format
        language: The programming language (for syntax highlighting)
        
    Returns:
        A markdown-formatted code block
    """
    return f"```{language}\n{code}\n```"

def create_table(headers: List[str], rows: List[List[Any]]) -> str:
    """
    Create a markdown table.
    
    Args:
        headers: List of column headers
        rows: List of rows, each row being a list of values
        
    Returns:
        A markdown-formatted table
    """
    if not headers or not rows:
        return ""
    
    # Create header row
    table = "| " + " | ".join(str(h) for h in headers) + " |\n"
    
    # Create separator row
    table += "| " + " | ".join("---" for _ in headers) + " |\n"
    
    # Create data rows
    for row in rows:
        table += "| " + " | ".join(str(cell) for cell in row) + " |\n"
    
    return table

def create_blockquote(text: str) -> str:
    """
    Create a markdown blockquote.
    
    Args:
        text: The text to quote
        
    Returns:
        A markdown-formatted blockquote
    """
    # Add > prefix to each line
    lines = text.split("\n")
    quoted_lines = [f"> {line}" for line in lines]
    return "\n".join(quoted_lines)

def create_checklist(items: List[Dict[str, Any]]) -> str:
    """
    Create a markdown checklist.
    
    Args:
        items: List of items, each with 'text' and 'checked' keys
        
    Returns:
        A markdown-formatted checklist
    """
    result = ""
    for item in items:
        text = item.get("text", "")
        checked = item.get("checked", False)
        checkbox = "[x]" if checked else "[ ]"
        result += f"- {checkbox} {text}\n"
    return result

def format_message_with_prompt(prompt_type: str, user_query: str) -> str:
    """
    Get a prompt that encourages rich formatting based on the type of request.
    
    Args:
        prompt_type: The type of content being requested (e.g., "code", "explanation", "marketing")
        user_query: The user's original query
        
    Returns:
        A prompt that encourages rich formatting
    """
    # Base instructions for rich formatting
    base_prompt = f"{user_query}\n\n"
    
    formatting_instructions = {
        "code": "Please format any code samples using proper markdown code blocks with appropriate language syntax highlighting. Organize explanations with clear headings and bullet points where appropriate.",
        
        "marketing": "Format your response with clear sections using headings, bullet points for key points, and bold text for emphasis. Use markdown formatting to organize information effectively.",
        
        "data": "If presenting data, use markdown tables for structured information. Use headings to separate sections and bullet points for key insights.",
        
        "writing": "Structure your text with proper headings, paragraphs, and emphasis using markdown. Use blockquotes for important statements or quotes.",
        
        "explanation": "Organize your explanation with clear headings (using # and ##), bullet points for steps or key concepts, and code blocks for any technical examples.",
        
        "default": "Use markdown formatting where appropriate, including headings, bullet points, bold/italic text, and code blocks."
    }
    
    # Get specific formatting instructions or use default
    instructions = formatting_instructions.get(prompt_type, formatting_instructions["default"])
    
    return base_prompt + instructions

# Examples of rich text usage:
RICH_TEXT_EXAMPLES = {
    "code_example": create_code_block("def hello_world():\n    print('Hello, world!')", "python"),
    
    "table_example": create_table(
        ["Name", "Role", "Department"],
        [
            ["John", "Developer", "Engineering"],
            ["Lisa", "Manager", "Marketing"],
            ["Mike", "Designer", "UX"]
        ]
    ),
    
    "quote_example": create_blockquote("This is an important quote that stands out from the rest of the text."),
    
    "checklist_example": create_checklist([
        {"text": "Complete task 1", "checked": True},
        {"text": "Start task 2", "checked": False},
        {"text": "Plan for task 3", "checked": False}
    ])
} 
 