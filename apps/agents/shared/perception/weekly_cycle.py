"""
Weekly Perception Cycle

This module coordinates the collection and analysis of external data sources
and integrates them into Chloe's weekly planning cycle.

Key functions:
- Fetch RSS feeds and summarize key headlines
- Scan social mentions and store takeaways
- Pull analytics and summarize trends
- Update memory with perception results
- Run weekly strategy planning with fresh inputs
"""
import os
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional

# Import perception and analytics modules
from apps.agents.shared.perception.rss_monitor import (
    get_latest_headlines, store_all_headlines_as_memories, get_headlines_summary
)
from apps.agents.shared.perception.social_monitor import (
    get_latest_social_data, store_social_mentions_as_memories, get_social_insights
)
from apps.agents.shared.analytics.analytics_summary import (
    generate_weekly_summary, store_weekly_summary, get_performance_brief
)

# Import memory modules
try:
    from apps.agents.shared.memory.episodic_memory import store_memory
    from apps.agents.shared.memory.reflection import ReflectionSystem
except ImportError:
    print("Warning: Could not import memory modules. Using mock implementations.")
    def store_memory(content, context=None, tags=None, importance=0.5):
        print(f"[MOCK] Storing memory: {content[:50]}... with tags {tags}")
        return {"id": "mock_memory_id", "content": content}
    
    class ReflectionSystem:
        def __init__(self, reflection_file=None):
            pass
            
        def add_reflection(self, content, importance=0.7, tags=None):
            print(f"[MOCK] Adding reflection: {content[:50]}...")
            return {"id": "mock_reflection_id", "content": content}
            
        def analyze_memories(self, limit=20, memory_types=None, prompt=None):
            print(f"[MOCK] Analyzing memories with prompt: {prompt}")
            return {"id": "mock_reflection_id", "content": "Mock reflection content"}

# Path for storing weekly cycle data
DATA_DIR = Path("apps/agents/shared/perception/data")
WEEKLY_SUMMARY_FILE = DATA_DIR / "weekly_perception_summary.md"

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def gather_external_data(max_rss_entries: int = 5, max_social_entries: int = 5) -> Dict[str, Any]:
    """
    Gather fresh data from all external sources.
    
    Args:
        max_rss_entries: Maximum number of RSS entries to store
        max_social_entries: Maximum number of social entries to store
        
    Returns:
        Dictionary with gathered data summaries
    """
    print("Gathering external data...")
    
    # Fetch headlines and store as memories
    print("Fetching RSS headlines...")
    headlines = get_latest_headlines()
    headline_memories = store_all_headlines_as_memories(max_entries=max_rss_entries)
    headline_summary = get_headlines_summary()
    
    # Fetch social data and store as memories
    print("Fetching social mentions...")
    social_data = get_latest_social_data()
    social_memories = store_social_mentions_as_memories(max_entries=max_social_entries)
    social_insights = get_social_insights()
    
    # Generate analytics summary and store as memory
    print("Generating analytics summary...")
    analytics_summary = generate_weekly_summary()
    analytics_memory = store_weekly_summary()
    performance_brief = get_performance_brief()
    
    # Return collected data
    return {
        "headlines": {
            "count": len(headlines),
            "stored_memories": headline_memories,
            "summary": headline_summary
        },
        "social": {
            "count": len(social_data),
            "stored_memories": social_memories,
            "insights": social_insights
        },
        "analytics": {
            "memory": analytics_memory,
            "summary": analytics_summary,
            "brief": performance_brief
        },
        "timestamp": datetime.now().isoformat()
    }

def generate_integrated_perception_summary(data: Dict[str, Any]) -> str:
    """
    Generate an integrated summary of all perception data.
    
    Args:
        data: The collected external data
        
    Returns:
        Markdown formatted integrated summary
    """
    # Create summary document
    summary = "# Integrated Weekly Perception Summary\n\n"
    summary += f"*Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M')}*\n\n"
    
    # Add quick stats
    summary += "## Quick Stats\n\n"
    summary += f"- Headlines analyzed: {data['headlines']['count']}\n"
    summary += f"- Social mentions monitored: {data['social']['count']}\n"
    
    # Add performance metrics from analytics brief
    brief = data['analytics']['brief']
    summary += f"- Weekly visitors: {brief['last_7_days']['visitors']:,} "
    summary += f"({brief['last_7_days']['visitor_change_pct']:.1f}% vs previous week)\n"
    summary += f"- Weekly revenue: ${brief['last_7_days']['revenue']:,.2f} "
    summary += f"({brief['last_7_days']['revenue_change_pct']:.1f}% vs previous week)\n"
    summary += f"- Conversion rate: {brief['last_7_days']['conversion_rate']:.2f}%\n"
    summary += f"- Email subscribers: {brief['email']['subscribers']:,}\n"
    summary += f"- Top social platform: {brief['social']['top_platform'].title()} "
    summary += f"({brief['social']['followers'][brief['social']['top_platform']]:,} followers)\n\n"
    
    # Add headline summary
    summary += "## Recent Industry Headlines\n\n"
    # Extract content after the heading
    headline_content = data['headlines']['summary'].split('# Recent Marketing & Tech Headlines\n\n')[1]
    summary += headline_content
    
    # Add social insights
    summary += "\n## Social Media Insights\n\n"
    # Extract content after the heading
    social_content = data['social']['insights'].split('# Recent Social Media Insights\n\n')[1]
    summary += social_content
    
    # Add analytics insights (just the key insights section)
    analytics_content = data['analytics']['summary']
    if "## Key Insights" in analytics_content:
        insights_section = analytics_content.split("## Key Insights")[1].split("##")[0]
        summary += "\n## Analytics Insights\n\n"
        summary += insights_section
    
    # Add integrated analysis
    summary += "\n## Integrated Analysis\n\n"
    
    # This would be from a larger LLM analysis in a real implementation
    # For now, we'll add some placeholder text
    summary += "The following observations combine data across all monitored channels:\n\n"
    summary += "1. **Cross-channel trends**: Patterns observed across multiple data sources\n"
    summary += "2. **Correlation analysis**: Relationships between social activity and website traffic\n"
    summary += "3. **Strategic implications**: How these insights should inform marketing strategy\n\n"
    
    # In a real implementation, we might use an LLM to analyze this data more deeply
    
    return summary

def store_perception_summary(summary: str) -> Dict[str, Any]:
    """
    Store the integrated perception summary as a memory.
    
    Args:
        summary: The integrated summary text
        
    Returns:
        Memory object containing the summary
    """
    # Save to file for reference
    ensure_data_dir()
    with open(WEEKLY_SUMMARY_FILE, "w", encoding="utf-8") as f:
        f.write(summary)
    
    # Store as a high-importance memory
    memory = store_memory(
        content="Weekly integrated perception summary from external data sources",
        context=summary,
        tags=["perception", "weekly_summary", "integrated_data", "strategy_input"],
        importance=0.9  # Very high importance for strategy planning
    )
    
    return memory

def reflect_on_perception_data(summary: str) -> Dict[str, Any]:
    """
    Generate a reflection based on the perception data.
    
    Args:
        summary: The integrated summary text
        
    Returns:
        Reflection object
    """
    # Initialize reflection system
    reflection_system = ReflectionSystem()
    
    # Generate a reflection prompt based on the summary
    reflection_prompt = """
    Based on the external data collected this week (headlines, social media, and analytics):
    
    1. What are the most significant trends in our marketing performance?
    2. Are there any correlations between external events and our metrics?
    3. What strategic adjustments should we consider based on this data?
    4. What marketing opportunities or risks are emerging from these signals?
    5. How do these insights relate to our current marketing goals and campaigns?
    """
    
    # Analyze recent memories with this specific prompt
    reflection = reflection_system.analyze_memories(
        limit=30,  # Analyze 30 recent memories
        memory_types=None,  # All types of memories
        prompt=reflection_prompt
    )
    
    # Also add the full summary as a direct reflection
    summary_reflection = reflection_system.add_reflection(
        content=summary,
        importance=0.85,
        tags=["weekly_perception", "external_data", "strategy_input"]
    )
    
    return {
        "analysis_reflection": reflection,
        "summary_reflection": summary_reflection
    }

def run_weekly_perception_cycle() -> Dict[str, Any]:
    """
    Run the complete weekly perception cycle.
    
    Returns:
        Dictionary with results from the weekly cycle
    """
    # Gather fresh data from all sources
    external_data = gather_external_data()
    
    # Generate integrated summary
    integrated_summary = generate_integrated_perception_summary(external_data)
    
    # Store as memory
    summary_memory = store_perception_summary(integrated_summary)
    
    # Generate reflections
    reflections = reflect_on_perception_data(integrated_summary)
    
    # Return complete results
    results = {
        "external_data": external_data,
        "integrated_summary": integrated_summary,
        "summary_memory": summary_memory,
        "reflections": reflections,
        "run_at": datetime.now().isoformat()
    }
    
    print(f"Weekly perception cycle completed at {results['run_at']}")
    return results

def plan_weekly_strategy(perception_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Run the weekly strategy planning process with fresh perception input.
    
    Args:
        perception_data: Optional perception data (if None, fetches fresh data)
        
    Returns:
        Weekly strategy plan as markdown text
    """
    # If no perception data provided, run the cycle to get fresh data
    if perception_data is None:
        perception_data = run_weekly_perception_cycle()
    
    # In a real implementation, this would use the agent to generate a strategic plan
    # For now, we'll return a placeholder
    
    strategy = "# Weekly Marketing Strategy Plan\n\n"
    strategy += f"*Generated on {datetime.now().strftime('%Y-%m-%d')} based on fresh perception data*\n\n"
    
    strategy += "## Inputs\n\n"
    strategy += "This strategy is informed by:\n"
    strategy += "- Industry news and headlines\n"
    strategy += "- Social media sentiment and trends\n"
    strategy += "- Performance analytics and metrics\n"
    strategy += "- Integrated analysis of all data sources\n\n"
    
    strategy += "## Strategic Focus Areas\n\n"
    strategy += "1. **Content Strategy**: Adjust based on headline analysis\n"
    strategy += "2. **Channel Optimization**: Reallocate based on analytics\n"
    strategy += "3. **Engagement Tactics**: Respond to social insights\n\n"
    
    strategy += "## Action Items\n\n"
    strategy += "- [Action item 1]\n"
    strategy += "- [Action item 2]\n"
    strategy += "- [Action item 3]\n\n"
    
    strategy += "## Key Performance Indicators\n\n"
    strategy += "- [KPI 1]\n"
    strategy += "- [KPI 2]\n"
    strategy += "- [KPI 3]\n\n"
    
    # In a real implementation, this would be generated by an LLM agent
    # based on the perception data
    
    return strategy

if __name__ == "__main__":
    # Run a simple test when executed directly
    print("Weekly Perception Cycle Test")
    print("===========================")
    
    # Set environment variable for mock data in development
    os.environ["CHLOE_DEV_MODE"] = "1"
    
    print("Running weekly perception cycle...")
    results = run_weekly_perception_cycle()
    
    print("\nGenerated integrated summary:")
    summary_lines = results["integrated_summary"].split("\n")
    print("\n".join(summary_lines[:15]) + "\n...")
    
    print("\nRunning weekly strategy planning...")
    strategy = plan_weekly_strategy(results)
    
    print("\nStrategy plan excerpt:")
    strategy_lines = strategy.split("\n")
    print("\n".join(strategy_lines[:15]) + "\n...") 