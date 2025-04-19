"""
Analytics Summary Module

This module pulls recent analytics data, summarizes key changes and noteworthy trends,
and pushes a summary memory that Chloe can reflect on during her weekly planning.
"""
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

# Import from our modules
from apps.agents.shared.analytics.mock_analytics_agent import get_analytics_data, get_marketing_insights

# Import memory modules to store insights
try:
    from apps.agents.shared.memory.episodic_memory import store_memory
except ImportError:
    print("Warning: Could not import episodic_memory module. Using mock implementation.")
    def store_memory(content, context=None, tags=None, importance=0.5):
        print(f"[MOCK] Storing memory: {content[:50]}... with tags {tags}")
        return {"id": "mock_memory_id", "content": content}

# Path for storing summary data
DATA_DIR = Path("apps/agents/shared/analytics/data")
SUMMARY_FILE = DATA_DIR / "weekly_summary.md"

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def generate_weekly_summary() -> str:
    """
    Generate a weekly summary of marketing analytics.
    
    Returns:
        Markdown formatted summary
    """
    # Get the marketing insights from the analytics agent
    insights_report = get_marketing_insights()
    
    # Get the raw analytics data for additional analysis
    analytics_data = get_analytics_data()
    
    # Add a header
    summary = f"# Weekly Analytics Summary\n\n"
    summary += f"*Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M')}*\n\n"
    
    # Add the insights report
    summary += insights_report
    
    # Add additional custom analysis
    summary += "\n## Additional Observations\n\n"
    
    # Get the daily metrics for trend detection
    daily = analytics_data["daily_metrics"]
    
    # Check for any unusual spikes or drops in traffic
    visitors = daily["website"]["visitors"]
    avg_visitors = sum(visitors) / len(visitors)
    
    # Look for days with significant deviation from average
    anomalies = []
    for i, value in enumerate(visitors):
        # Skip first few days as they may not have enough context
        if i < 3:
            continue
            
        # Calculate percent change from previous 3-day average
        prev_avg = sum(visitors[i-3:i]) / 3
        percent_change = ((value - prev_avg) / prev_avg) * 100
        
        # Flag significant changes
        if abs(percent_change) > 20:
            direction = "increase" if percent_change > 0 else "decrease"
            anomalies.append({
                "date": daily["dates"][i],
                "value": value,
                "percent_change": percent_change,
                "direction": direction
            })
    
    # Add anomalies to the summary
    if anomalies:
        summary += "### Traffic Anomalies\n\n"
        for anomaly in anomalies:
            summary += f"- **{anomaly['date']}**: {anomaly['direction'].title()} of {abs(anomaly['percent_change']):.1f}% "
            summary += f"({anomaly['value']} visitors)\n"
        summary += "\n"
    
    # Analyze traffic source distribution
    traffic_sources = analytics_data["current_metrics"]["website"]["traffic_sources"]
    summary += "### Traffic Source Distribution\n\n"
    
    # Sort sources by percentage
    sorted_sources = sorted(traffic_sources.items(), key=lambda x: x[1], reverse=True)
    for source, percentage in sorted_sources:
        summary += f"- {source.title()}: {percentage}%\n"
    summary += "\n"
    
    # Email subscriber growth calculation
    if "subscribers" in analytics_data["current_metrics"]["email"]:
        current_subscribers = analytics_data["current_metrics"]["email"]["subscribers"]
        summary += f"### Email Subscriber Growth\n\n"
        summary += f"- Current subscribers: {current_subscribers:,}\n"
        
        # Calculate monthly growth rate
        monthly_growth = current_subscribers * 0.02  # From the mock data, we use 2% monthly growth
        summary += f"- Estimated monthly growth: ~{monthly_growth:.0f} new subscribers\n\n"
    
    # Add recommendations based on the data
    summary += "## Recommendations\n\n"
    
    # Traffic-based recommendations
    visitors_trend = sum(daily["website"]["visitors"][-7:]) - sum(daily["website"]["visitors"][-14:-7])
    if visitors_trend > 0:
        summary += "- 🌐 **Website Traffic**: Continue current content strategy as it's driving traffic growth.\n"
    else:
        summary += "- 🌐 **Website Traffic**: Consider refreshing content strategy to address declining traffic.\n"
    
    # Email-based recommendations
    open_rate = analytics_data["current_metrics"]["email"]["open_rate"]
    if open_rate < 20:
        summary += "- 📧 **Email Marketing**: Test new subject line formats to improve below-average open rates.\n"
    elif open_rate > 25:
        summary += "- 📧 **Email Marketing**: Current subject lines are effective. Maintain this approach.\n"
    
    # Social media recommendations
    social_followers = analytics_data["current_metrics"]["social"]["followers"]
    best_platform = max(social_followers.items(), key=lambda x: x[1])
    
    summary += f"- 📱 **Social Media**: Focus resources on {best_platform[0].title()} which has our largest audience ({best_platform[1]:,} followers).\n"
    
    # Conversion recommendations
    conversion_rate = analytics_data["current_metrics"]["conversions"]["overall_rate"]
    if conversion_rate < 2.5:
        summary += "- 💰 **Conversions**: Review call-to-action placement and messaging to improve below-benchmark conversion rate.\n"
    else:
        summary += "- 💰 **Conversions**: Current conversion rate is healthy. Consider A/B testing to optimize further.\n"
    
    return summary

def store_weekly_summary() -> Dict[str, Any]:
    """
    Generate and store the weekly summary as a memory.
    
    Returns:
        Memory object containing the summary
    """
    # Generate the summary
    summary = generate_weekly_summary()
    
    # Save to file for reference
    ensure_data_dir()
    with open(SUMMARY_FILE, "w", encoding="utf-8") as f:
        f.write(summary)
    
    # Store as a memory
    memory = store_memory(
        content="Weekly marketing analytics summary and recommendations",
        context=summary,
        tags=["analytics", "weekly_summary", "marketing_data"],
        importance=0.85  # Higher importance as this is a key strategic input
    )
    
    return memory

def get_latest_summary() -> str:
    """
    Get the latest analytics summary.
    
    Returns:
        The latest summary as a string
    """
    ensure_data_dir()
    
    if SUMMARY_FILE.exists():
        with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
            return f.read()
    
    # If no existing summary, generate a new one
    return generate_weekly_summary()

def get_performance_brief() -> Dict[str, Any]:
    """
    Get a brief performance snapshot for quick reference.
    
    Returns:
        Dictionary with key metrics
    """
    analytics_data = get_analytics_data()
    
    # Get daily metrics
    daily = analytics_data["daily_metrics"]
    
    # Calculate weekly changes
    weekly_visitors = sum(daily["website"]["visitors"][-7:])
    prev_weekly_visitors = sum(daily["website"]["visitors"][-14:-7])
    visitor_change_pct = ((weekly_visitors - prev_weekly_visitors) / prev_weekly_visitors) * 100 if prev_weekly_visitors else 0
    
    weekly_revenue = sum(daily["conversions"]["revenue"][-7:])
    prev_weekly_revenue = sum(daily["conversions"]["revenue"][-14:-7])
    revenue_change_pct = ((weekly_revenue - prev_weekly_revenue) / prev_weekly_revenue) * 100 if prev_weekly_revenue else 0
    
    # Get current metrics
    current = analytics_data["current_metrics"]
    
    # Format brief
    brief = {
        "last_7_days": {
            "visitors": weekly_visitors,
            "visitor_change_pct": visitor_change_pct,
            "revenue": weekly_revenue,
            "revenue_change_pct": revenue_change_pct,
            "conversion_rate": current["conversions"]["overall_rate"],
        },
        "email": {
            "open_rate": current["email"]["open_rate"],
            "click_rate": current["email"]["click_rate"],
            "subscribers": current["email"]["subscribers"]
        },
        "social": {
            "followers": current["social"]["followers"],
            "top_platform": max(current["social"]["followers"].items(), key=lambda x: x[1])[0]
        },
        "generated_at": datetime.now().isoformat()
    }
    
    return brief

if __name__ == "__main__":
    # Run a simple test when executed directly
    print("Analytics Summary Test")
    print("=====================")
    
    print("Generating weekly summary...")
    summary = generate_weekly_summary()
    print(f"Generated summary ({len(summary)} characters)")
    
    print("\nStoring summary as memory...")
    memory = store_weekly_summary()
    print(f"Stored memory with ID: {memory['id']}")
    
    print("\nBrief performance snapshot:")
    brief = get_performance_brief()
    for category, metrics in brief.items():
        if category != "generated_at":
            print(f"\n{category.upper()}:")
            for metric, value in metrics.items():
                print(f"  - {metric}: {value}")
    
    print("\nSummary excerpt:")
    lines = summary.split("\n")
    print("\n".join(lines[:20]) + "\n...") 
 