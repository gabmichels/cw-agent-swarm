import datetime
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
import os

# Import memory modules
from apps.agents.shared.memory.episodic_memory import (
    get_memories_by_timeframe, 
    get_all_memories,
    format_memory_for_human,
    store_memory,
    IMPORTANCE_HIGH
)

from apps.agents.shared.tools.task_planner import (
    get_tasks_by_status,
    STATUS_COMPLETED,
    get_all_active_tasks
)

# Define storage paths
MEMORY_DIR = Path("./apps/agents/shared/memory")
MEMORY_DIR.mkdir(parents=True, exist_ok=True)
REFLECTIONS_DIR = MEMORY_DIR / "reflections"
REFLECTIONS_DIR.mkdir(parents=True, exist_ok=True)

def get_week_date_range():
    """Get the date range for the current week."""
    today = datetime.datetime.now()
    start_of_week = today - datetime.timedelta(days=today.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_week = start_of_week + datetime.timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    return start_of_week, end_of_week

def get_last_week_date_range():
    """Get the date range for the previous week."""
    today = datetime.datetime.now()
    start_of_this_week = today - datetime.timedelta(days=today.weekday())
    start_of_this_week = start_of_this_week.replace(hour=0, minute=0, second=0, microsecond=0)
    
    start_of_last_week = start_of_this_week - datetime.timedelta(days=7)
    end_of_last_week = start_of_this_week - datetime.timedelta(seconds=1)
    
    return start_of_last_week, end_of_last_week

def gather_reflection_data(time_period: str = "week") -> Dict[str, Any]:
    """
    Gather data for reflection.
    
    Args:
        time_period: Period to reflect on ("week", "month", "custom")
        
    Returns:
        Dictionary of data for reflection
    """
    if time_period == "week":
        start_date, end_date = get_week_date_range()
    elif time_period == "last_week":
        start_date, end_date = get_last_week_date_range()
    elif time_period == "month":
        today = datetime.datetime.now()
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = today.month + 1 if today.month < 12 else 1
        next_month_year = today.year if today.month < 12 else today.year + 1
        end_date = datetime.datetime(next_month_year, next_month, 1) - datetime.timedelta(seconds=1)
    else:
        # Default to last 7 days
        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(days=7)
    
    # Get memories for the period
    memories = get_memories_by_timeframe(start_date, end_date)
    
    # Get completed tasks
    completed_tasks = get_tasks_by_status(STATUS_COMPLETED)
    
    # Get active tasks
    active_tasks = get_all_active_tasks()
    
    return {
        "time_period": time_period,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "memories": memories,
        "completed_tasks": completed_tasks,
        "active_tasks": active_tasks
    }

def extract_insights(reflection_data: Dict[str, Any]) -> Dict[str, List[str]]:
    """
    Extract insights from reflection data.
    
    Args:
        reflection_data: Data gathered for reflection
        
    Returns:
        Dictionary of insights categorized by type
    """
    # This would ideally use more sophisticated analysis,
    # but for now we'll extract basic insights
    
    insights = {
        "accomplishments": [],
        "challenges": [],
        "learning_points": [],
        "patterns": [],
        "action_items": []
    }
    
    # Extract from completed tasks
    for task in reflection_data.get("completed_tasks", []):
        insights["accomplishments"].append(f"Completed: {task.get('title')}")
        
        # Look for learning points in task notes
        for note in task.get("notes", []):
            if "learned" in note.get("content", "").lower() or "learning" in note.get("content", "").lower():
                insights["learning_points"].append(note.get("content"))
    
    # Extract from memories
    for memory in reflection_data.get("memories", []):
        content = memory.get("content", "").lower()
        
        # Categorize based on content keywords
        if "challenge" in content or "difficult" in content or "problem" in content:
            insights["challenges"].append(memory.get("content"))
        
        if "learned" in content or "realized" in content or "insight" in content:
            insights["learning_points"].append(memory.get("content"))
        
        if "next time" in content or "should" in content or "need to" in content:
            insights["action_items"].append(memory.get("content"))
    
    # Look for patterns in memories
    # In a real system, this would use more sophisticated NLP techniques
    tag_counts = {}
    for memory in reflection_data.get("memories", []):
        for tag in memory.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    # Find commonly occurring tags
    common_tags = [tag for tag, count in tag_counts.items() if count > 1]
    if common_tags:
        insights["patterns"].append(f"Frequent topics: {', '.join(common_tags)}")
    
    return insights

def generate_reflection(time_period: str = "week") -> Dict[str, Any]:
    """
    Generate a reflection for the specified time period.
    
    Args:
        time_period: Period to reflect on ("week", "month", "custom")
        
    Returns:
        Generated reflection data and file path
    """
    # Gather data
    reflection_data = gather_reflection_data(time_period)
    
    # Extract insights
    insights = extract_insights(reflection_data)
    
    # Format dates for display
    try:
        start_date = datetime.datetime.fromisoformat(reflection_data["start_date"])
        end_date = datetime.datetime.fromisoformat(reflection_data["end_date"])
        date_range = f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}"
    except (ValueError, KeyError):
        date_range = "recent period"
    
    # Generate reflection content
    reflection = {
        "id": f"reflection_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "time_period": time_period,
        "date_range": date_range,
        "timestamp": datetime.datetime.now().isoformat(),
        "insights": insights,
        "summary": ""
    }
    
    # Generate a summary
    summary_parts = []
    
    if insights["accomplishments"]:
        summary_parts.append(f"Accomplished {len(insights['accomplishments'])} tasks")
    
    if insights["challenges"]:
        summary_parts.append(f"Faced {len(insights['challenges'])} challenges")
    
    if insights["learning_points"]:
        summary_parts.append(f"Gained {len(insights['learning_points'])} insights")
    
    if insights["action_items"]:
        summary_parts.append(f"Identified {len(insights['action_items'])} action items")
    
    if summary_parts:
        reflection["summary"] = f"During this {time_period}, I {', '.join(summary_parts)}."
    else:
        reflection["summary"] = f"Reflection for {date_range}."
    
    # Save to file
    week_number = datetime.datetime.now().isocalendar()[1]
    year = datetime.datetime.now().year
    reflection_file = REFLECTIONS_DIR / f"reflection_{year}_week{week_number}.md"
    
    with open(reflection_file, "w") as f:
        f.write(f"# Reflection: {date_range}\n\n")
        f.write(f"{reflection['summary']}\n\n")
        
        if insights["accomplishments"]:
            f.write("## Accomplishments\n\n")
            for item in insights["accomplishments"]:
                f.write(f"- {item}\n")
            f.write("\n")
        
        if insights["challenges"]:
            f.write("## Challenges\n\n")
            for item in insights["challenges"]:
                f.write(f"- {item}\n")
            f.write("\n")
        
        if insights["learning_points"]:
            f.write("## Key Learnings\n\n")
            for item in insights["learning_points"]:
                f.write(f"- {item}\n")
            f.write("\n")
        
        if insights["patterns"]:
            f.write("## Patterns\n\n")
            for item in insights["patterns"]:
                f.write(f"- {item}\n")
            f.write("\n")
        
        if insights["action_items"]:
            f.write("## Action Items\n\n")
            for item in insights["action_items"]:
                f.write(f"- {item}\n")
            f.write("\n")
    
    # Also save the reflection as a high-importance memory
    store_memory(
        content=reflection["summary"],
        context=f"Weekly reflection for {date_range}",
        outcome="Generated insights and action items for future work",
        importance=IMPORTANCE_HIGH,
        tags=["reflection", time_period, "insights", "learning"]
    )
    
    reflection["file_path"] = str(reflection_file)
    return reflection

def get_latest_reflection() -> Optional[Dict[str, Any]]:
    """
    Get the latest reflection.
    
    Returns:
        Latest reflection content or None if no reflections exist
    """
    reflection_files = list(REFLECTIONS_DIR.glob("reflection_*.md"))
    
    if not reflection_files:
        return None
    
    # Sort by modification time (most recent first)
    latest_file = max(reflection_files, key=os.path.getmtime)
    
    if not latest_file.exists():
        return None
    
    content = latest_file.read_text()
    
    # Parse the content to extract parts
    sections = {}
    current_section = "summary"
    sections[current_section] = []
    
    for line in content.split("\n"):
        if line.startswith("# Reflection:"):
            date_range = line.replace("# Reflection:", "").strip()
            sections["date_range"] = date_range
        elif line.startswith("## "):
            current_section = line.replace("##", "").strip().lower()
            sections[current_section] = []
        elif line.strip() and not line.startswith("#"):
            sections[current_section].append(line)
    
    # Convert lists to strings
    for key, value in sections.items():
        if isinstance(value, list):
            sections[key] = "\n".join(value)
    
    return {
        "file_path": str(latest_file),
        "content": content,
        "sections": sections
    }

def get_all_reflections() -> List[Dict[str, Any]]:
    """
    Get all reflections.
    
    Returns:
        List of all reflection files with basic metadata
    """
    reflection_files = list(REFLECTIONS_DIR.glob("reflection_*.md"))
    
    reflections = []
    for file in reflection_files:
        try:
            # Get the first line as title
            with open(file, "r") as f:
                first_line = f.readline().strip()
                title = first_line.replace("# Reflection:", "").strip()
            
            # Get file modification time
            mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file))
            
            reflections.append({
                "file_path": str(file),
                "title": title,
                "date": mod_time.strftime("%Y-%m-%d")
            })
        except Exception:
            # Skip this file if there's an error
            continue
    
    # Sort by date (most recent first)
    reflections.sort(key=lambda x: x["date"], reverse=True)
    
    return reflections

def run_weekly_reflection() -> Dict[str, Any]:
    """
    Run a weekly reflection process.
    
    Returns:
        Generated reflection data
    """
    return generate_reflection("week") 
 