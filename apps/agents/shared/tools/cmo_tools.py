from langchain_core.tools import tool
from pathlib import Path
import datetime
import os

# Get the absolute path to the memory directory
script_dir = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_PATH = script_dir / "memory"

@tool
def read_background(_: str = "") -> str:
    """Read Chloe's background document.
    
    Returns the content of the Chloe's background file.
    """
    try:
        return (BASE_PATH / "chloe_background.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading background: {str(e)}"

@tool
def read_manifesto(_: str = "") -> str:
    """Read the CMO manifesto document.
    
    Returns the content of the CMO manifesto file.
    """
    try:
        return (BASE_PATH / "cmo_manifesto.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading manifesto: {str(e)}"

@tool
def read_goals(_: str = "") -> str:
    """Read the marketing goals document.
    
    Returns the content of the marketing goals file.
    """
    try:
        return (BASE_PATH / "marketing_goals.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading goals: {str(e)}"

@tool
def read_task_log(_: str = "") -> str:
    """Read the task log document.
    
    Returns the content of the task log file.
    """
    try:
        return (BASE_PATH / "task_log.md").read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading task log: {str(e)}"

@tool
def log_task(note: str = "") -> str:
    """Log a new task entry to the task log.
    
    Args:
        note: The text content to add to the task log.
        
    Returns:
        A confirmation message that the task was logged.
    """
    if not note:
        return "Error: No task content provided to log."
        
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        entry = f"\n### {today} – Task Entry\n{note}\n"
        with open(BASE_PATH / "task_log.md", "a", encoding="utf-8") as f:
            f.write(entry)
        return "Task logged successfully."
    except Exception as e:
        return f"Error logging task: {str(e)}" 