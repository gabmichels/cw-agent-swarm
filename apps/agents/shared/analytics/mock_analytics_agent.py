"""
Mock Analytics Agent

This module simulates a data-fetching agent that provides Chloe with realistic
marketing analytics data, including:
- Website traffic
- Email campaign performance 
- Social media growth
- Conversion rates

This mock data can later be replaced with real analytics integrations.
"""
import json
import random
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Union

# Path for storing mock analytics data
DATA_DIR = Path("apps/agents/shared/analytics/data")
ANALYTICS_FILE = DATA_DIR / "marketing_analytics.json"

# Default starting metrics
DEFAULT_METRICS = {
    "website": {
        "daily_visitors": 1500,
        "bounce_rate": 45.0,  # percentage
        "avg_session_duration": 2.7,  # minutes
        "pages_per_session": 3.2,
        "top_landing_pages": [
            {"page": "/home", "views": 850, "conversion_rate": 2.1},
            {"page": "/products", "views": 620, "conversion_rate": 3.5},
            {"page": "/blog", "views": 450, "conversion_rate": 1.8},
            {"page": "/contact", "views": 210, "conversion_rate": 4.2},
            {"page": "/about", "views": 180, "conversion_rate": 0.9}
        ],
        "traffic_sources": {
            "organic": 42.0,  # percentage
            "direct": 28.0,
            "social": 15.0,
            "email": 10.0,
            "referral": 5.0
        },
        "device_breakdown": {
            "mobile": 58.0,  # percentage
            "desktop": 32.0,
            "tablet": 10.0
        }
    },
    "email": {
        "subscribers": 12500,
        "open_rate": 22.5,  # percentage
        "click_rate": 3.8,  # percentage
        "conversion_rate": 1.2,  # percentage
        "unsubscribe_rate": 0.3,  # percentage
        "campaigns": [
            {
                "name": "Weekly Newsletter",
                "sends": 12500,
                "opens": 2812,
                "clicks": 475,
                "conversions": 28
            },
            {
                "name": "Product Launch",
                "sends": 11200,
                "opens": 3584,
                "clicks": 896,
                "conversions": 112
            },
            {
                "name": "Holiday Promotion",
                "sends": 12300,
                "opens": 3075,
                "clicks": 615,
                "conversions": 98
            }
        ]
    },
    "social": {
        "followers": {
            "twitter": 8500,
            "instagram": 12000,
            "facebook": 15000,
            "linkedin": 5600
        },
        "engagement_rate": {
            "twitter": 1.2,  # percentage
            "instagram": 3.5,
            "facebook": 1.8,
            "linkedin": 2.2
        },
        "post_frequency": {
            "twitter": 5,  # posts per week
            "instagram": 3,
            "facebook": 4,
            "linkedin": 2
        },
        "top_performing_post": {
            "platform": "instagram",
            "content": "Behind the scenes look at our new product development",
            "engagement": 845,
            "conversion_value": 2800  # estimated $ value
        }
    },
    "conversions": {
        "overall_rate": 2.8,  # percentage
        "sales_funnel": {
            "awareness": 10000,  # visitors
            "interest": 3500,  # engaged with content
            "consideration": 1200,  # product page views
            "intent": 450,  # added to cart
            "purchase": 280  # completed purchases
        },
        "revenue": {
            "total": 42500,  # $
            "average_order": 151.8,  # $
            "cost_per_acquisition": 45.2  # $
        },
        "products": [
            {"name": "Product A", "sales": 120, "revenue": 17880},
            {"name": "Product B", "sales": 95, "revenue": 14250},
            {"name": "Product C", "sales": 65, "revenue": 10400}
        ]
    }
}

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def generate_trend(base_value: float, days: int, volatility: float = 0.05, 
                  trend: float = 0.01, seasonality: bool = True) -> List[float]:
    """
    Generate a realistic time series with trend and optional seasonality.
    
    Args:
        base_value: Starting value
        days: Number of days to generate
        volatility: Daily random fluctuation percentage
        trend: Daily trend percentage (positive or negative)
        seasonality: Whether to add weekly seasonality pattern
        
    Returns:
        List of daily values
    """
    values = []
    current = base_value
    
    for day in range(days):
        # Apply random volatility
        random_factor = 1 + random.uniform(-volatility, volatility)
        
        # Apply trend
        trend_factor = 1 + trend
        
        # Apply seasonality (higher on weekends, lower on Mondays)
        seasonality_factor = 1.0
        if seasonality:
            # Assume day 0 is Monday
            weekday = day % 7
            if weekday == 5 or weekday == 6:  # Weekend
                seasonality_factor = 1.15  # 15% higher on weekends
            elif weekday == 0:  # Monday
                seasonality_factor = 0.92  # 8% lower on Mondays
        
        # Calculate new value
        current = current * random_factor * trend_factor * seasonality_factor
        values.append(round(current, 2))
    
    return values

def generate_mock_analytics(days: int = 30, base_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Generate mock analytics data for the specified number of days.
    
    Args:
        days: Number of days to generate data for
        base_data: Optional base data to start from (uses DEFAULT_METRICS if None)
        
    Returns:
        Dictionary of mock analytics data
    """
    if not base_data:
        base_data = DEFAULT_METRICS
    
    # Start date is 'days' ago
    start_date = datetime.now() - timedelta(days=days)
    
    # Generate date strings for each day
    dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    
    # Generate website traffic data
    daily_visitors = generate_trend(
        base_data["website"]["daily_visitors"], 
        days, 
        volatility=0.08,
        trend=0.005  # 0.5% growth per day
    )
    
    bounce_rates = generate_trend(
        base_data["website"]["bounce_rate"], 
        days, 
        volatility=0.02,
        trend=-0.001  # Slight improvement over time
    )
    
    # Generate email performance data
    open_rates = generate_trend(
        base_data["email"]["open_rate"], 
        days, 
        volatility=0.03,
        trend=0.002  # Slight improvement
    )
    
    click_rates = generate_trend(
        base_data["email"]["click_rate"], 
        days, 
        volatility=0.04,
        trend=0.001
    )
    
    # Generate social follower growth
    social_followers = {}
    for platform, count in base_data["social"]["followers"].items():
        # Different growth rates for different platforms
        growth_rates = {
            "twitter": 0.004,
            "instagram": 0.006,
            "facebook": 0.002,
            "linkedin": 0.003
        }
        
        social_followers[platform] = generate_trend(
            count, 
            days, 
            volatility=0.01,
            trend=growth_rates.get(platform, 0.003),
            seasonality=False  # Followers don't typically have weekly seasonality
        )
    
    # Generate conversion data
    conversion_rates = generate_trend(
        base_data["conversions"]["overall_rate"], 
        days, 
        volatility=0.05,
        trend=0.0015
    )
    
    revenue_daily = []
    for i in range(days):
        # Revenue is related to visitors and conversion rate
        est_revenue = (daily_visitors[i] * conversion_rates[i] / 100) * base_data["conversions"]["revenue"]["average_order"]
        # Add some random variation
        revenue_daily.append(round(est_revenue * random.uniform(0.9, 1.1), 2))
    
    # Compile all data
    analytics_data = {
        "generated_at": datetime.now().isoformat(),
        "date_range": {
            "start": dates[0],
            "end": dates[-1],
            "days": days
        },
        "daily_metrics": {
            "dates": dates,
            "website": {
                "visitors": daily_visitors,
                "bounce_rate": bounce_rates
            },
            "email": {
                "open_rate": open_rates,
                "click_rate": click_rates
            },
            "social": {
                "followers": social_followers
            },
            "conversions": {
                "rate": conversion_rates,
                "revenue": revenue_daily
            }
        },
        "current_metrics": {
            "website": {
                "daily_visitors": daily_visitors[-1],
                "bounce_rate": bounce_rates[-1],
                "avg_session_duration": base_data["website"]["avg_session_duration"] * random.uniform(0.95, 1.05),
                "pages_per_session": base_data["website"]["pages_per_session"] * random.uniform(0.95, 1.05),
                "traffic_sources": {
                    k: round(v * random.uniform(0.9, 1.1), 1) for k, v in base_data["website"]["traffic_sources"].items()
                }
            },
            "email": {
                "subscribers": base_data["email"]["subscribers"] + int(base_data["email"]["subscribers"] * 0.02 * (days / 30)),
                "open_rate": open_rates[-1],
                "click_rate": click_rates[-1],
                "conversion_rate": base_data["email"]["conversion_rate"] * random.uniform(0.95, 1.05),
                "unsubscribe_rate": base_data["email"]["unsubscribe_rate"] * random.uniform(0.9, 1.1)
            },
            "social": {
                "followers": {
                    platform: values[-1] for platform, values in social_followers.items()
                },
                "engagement_rate": {
                    k: round(v * random.uniform(0.9, 1.1), 1) for k, v in base_data["social"]["engagement_rate"].items()
                }
            },
            "conversions": {
                "overall_rate": conversion_rates[-1],
                "revenue": {
                    "monthly_total": round(sum(revenue_daily[-30:]), 2),
                    "average_order": base_data["conversions"]["revenue"]["average_order"] * random.uniform(0.95, 1.05)
                }
            }
        },
        "campaigns": generate_mock_campaigns(base_data)
    }
    
    return analytics_data

def generate_mock_campaigns(base_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate mock campaign data based on base metrics.
    
    Args:
        base_data: Base metrics to use for calculations
        
    Returns:
        Dictionary of mock campaign data
    """
    # Email campaigns
    email_campaigns = []
    for campaign in base_data["email"]["campaigns"]:
        # Add some variation to the base campaigns
        new_campaign = campaign.copy()
        new_campaign["sends"] = int(campaign["sends"] * random.uniform(0.95, 1.05))
        new_campaign["opens"] = int(new_campaign["sends"] * (base_data["email"]["open_rate"] / 100) * random.uniform(0.9, 1.1))
        new_campaign["clicks"] = int(new_campaign["opens"] * (base_data["email"]["click_rate"] / 100) * random.uniform(0.9, 1.1))
        new_campaign["conversions"] = int(new_campaign["clicks"] * (base_data["email"]["conversion_rate"] / 100) * random.uniform(0.9, 1.1))
        new_campaign["revenue"] = round(new_campaign["conversions"] * base_data["conversions"]["revenue"]["average_order"], 2)
        new_campaign["date"] = (datetime.now() - timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
        
        email_campaigns.append(new_campaign)
    
    # Social campaigns
    social_campaigns = [
        {
            "name": "Product Awareness Campaign",
            "platform": "instagram",
            "budget": 1500,
            "impressions": 42500,
            "engagements": 2125,
            "clicks": 850,
            "conversions": 34,
            "revenue": 5100,
            "roi": 2.4,
            "date": (datetime.now() - timedelta(days=random.randint(1, 21))).strftime("%Y-%m-%d")
        },
        {
            "name": "Lead Generation Campaign",
            "platform": "facebook",
            "budget": 2000,
            "impressions": 55000,
            "engagements": 1650,
            "clicks": 1100,
            "conversions": 88,
            "revenue": 8800,
            "roi": 3.4,
            "date": (datetime.now() - timedelta(days=random.randint(1, 21))).strftime("%Y-%m-%d")
        },
        {
            "name": "Thought Leadership Series",
            "platform": "linkedin",
            "budget": 1200,
            "impressions": 25000,
            "engagements": 1500,
            "clicks": 500,
            "conversions": 15,
            "revenue": 3000,
            "roi": 1.5,
            "date": (datetime.now() - timedelta(days=random.randint(1, 21))).strftime("%Y-%m-%d")
        }
    ]
    
    # Add some randomization to social campaigns
    for campaign in social_campaigns:
        campaign["impressions"] = int(campaign["impressions"] * random.uniform(0.9, 1.1))
        campaign["engagements"] = int(campaign["engagements"] * random.uniform(0.9, 1.1))
        campaign["clicks"] = int(campaign["clicks"] * random.uniform(0.9, 1.1))
        campaign["conversions"] = int(campaign["conversions"] * random.uniform(0.9, 1.1))
        campaign["revenue"] = round(campaign["conversions"] * base_data["conversions"]["revenue"]["average_order"], 2)
        campaign["roi"] = round(campaign["revenue"] / campaign["budget"], 2)
    
    # Combine all campaigns
    return {
        "email": email_campaigns,
        "social": social_campaigns
    }

def store_analytics_data(data: Dict[str, Any]) -> None:
    """
    Store analytics data to a JSON file.
    
    Args:
        data: Analytics data to store
    """
    ensure_data_dir()
    
    with open(ANALYTICS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def get_analytics_data(max_age_hours: int = 24) -> Dict[str, Any]:
    """
    Get the latest analytics data, generating new data if needed.
    
    Args:
        max_age_hours: Maximum age of data in hours before refreshing
        
    Returns:
        Dictionary of analytics data
    """
    ensure_data_dir()
    
    # Check if we have recent data
    if ANALYTICS_FILE.exists():
        try:
            with open(ANALYTICS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            generated_at = datetime.fromisoformat(data.get("generated_at", "2000-01-01T00:00:00"))
            age_hours = (datetime.now() - generated_at).total_seconds() / 3600
            
            if age_hours < max_age_hours:
                return data
        except (json.JSONDecodeError, KeyError, ValueError):
            # If file is corrupted or format changed, we'll generate new data
            pass
    
    # Generate and store new data
    data = generate_mock_analytics(days=30)
    store_analytics_data(data)
    return data

def get_metric_change(current: float, previous: float) -> Dict[str, Union[float, str]]:
    """
    Calculate change between two metric values.
    
    Args:
        current: Current value
        previous: Previous value
        
    Returns:
        Dictionary with change value and trend
    """
    if previous == 0:
        return {"value": 0, "percentage": 0, "trend": "neutral"}
    
    change = current - previous
    percentage = (change / previous) * 100
    
    trend = "neutral"
    if percentage > 2:
        trend = "up"
    elif percentage < -2:
        trend = "down"
    
    return {
        "value": round(change, 2),
        "percentage": round(percentage, 2),
        "trend": trend
    }

def get_key_metrics_summary() -> Dict[str, Any]:
    """
    Generate a summary of key metrics with trends.
    
    Returns:
        Dictionary with key metrics and their changes
    """
    data = get_analytics_data()
    daily = data["daily_metrics"]
    
    # Get current and previous values for key metrics
    current_visitors = daily["website"]["visitors"][-1]
    prev_visitors = daily["website"]["visitors"][-8]  # Compare to a week ago
    
    current_conversion = daily["conversions"]["rate"][-1]
    prev_conversion = daily["conversions"]["rate"][-8]
    
    current_revenue = daily["conversions"]["revenue"][-1]
    prev_revenue = daily["conversions"]["revenue"][-8]
    
    # Calculate weekly totals
    weekly_visitors = sum(daily["website"]["visitors"][-7:])
    prev_weekly_visitors = sum(daily["website"]["visitors"][-14:-7])
    
    weekly_revenue = sum(daily["conversions"]["revenue"][-7:])
    prev_weekly_revenue = sum(daily["conversions"]["revenue"][-14:-7])
    
    # Social follower changes
    social_changes = {}
    for platform, values in daily["social"]["followers"].items():
        current = values[-1]
        prev = values[-8]
        social_changes[platform] = get_metric_change(current, prev)
    
    # Compile summary
    summary = {
        "time_period": {
            "current_date": daily["dates"][-1],
            "comparison_date": daily["dates"][-8],
            "days_analyzed": 7
        },
        "website": {
            "daily_visitors": {
                "current": current_visitors,
                "previous": prev_visitors,
                "change": get_metric_change(current_visitors, prev_visitors)
            },
            "weekly_visitors": {
                "current": weekly_visitors,
                "previous": prev_weekly_visitors,
                "change": get_metric_change(weekly_visitors, prev_weekly_visitors)
            },
            "bounce_rate": {
                "current": daily["website"]["bounce_rate"][-1],
                "previous": daily["website"]["bounce_rate"][-8],
                "change": get_metric_change(daily["website"]["bounce_rate"][-1], daily["website"]["bounce_rate"][-8])
            }
        },
        "email": {
            "open_rate": {
                "current": daily["email"]["open_rate"][-1],
                "previous": daily["email"]["open_rate"][-8],
                "change": get_metric_change(daily["email"]["open_rate"][-1], daily["email"]["open_rate"][-8])
            },
            "click_rate": {
                "current": daily["email"]["click_rate"][-1],
                "previous": daily["email"]["click_rate"][-8],
                "change": get_metric_change(daily["email"]["click_rate"][-1], daily["email"]["click_rate"][-8])
            }
        },
        "social": {
            "followers": {
                platform: {
                    "current": values[-1],
                    "previous": values[-8],
                    "change": get_metric_change(values[-1], values[-8])
                } for platform, values in daily["social"]["followers"].items()
            }
        },
        "conversions": {
            "rate": {
                "current": current_conversion,
                "previous": prev_conversion,
                "change": get_metric_change(current_conversion, prev_conversion)
            },
            "daily_revenue": {
                "current": current_revenue,
                "previous": prev_revenue,
                "change": get_metric_change(current_revenue, prev_revenue)
            },
            "weekly_revenue": {
                "current": weekly_revenue,
                "previous": prev_weekly_revenue,
                "change": get_metric_change(weekly_revenue, prev_weekly_revenue)
            }
        },
        "campaigns": {
            "email": sorted(data["campaigns"]["email"], key=lambda x: x.get("conversions", 0), reverse=True)[0],
            "social": sorted(data["campaigns"]["social"], key=lambda x: x.get("roi", 0), reverse=True)[0]
        }
    }
    
    return summary

def get_marketing_insights() -> str:
    """
    Generate a markdown report with key marketing insights.
    
    Returns:
        Markdown formatted string with insights
    """
    summary = get_key_metrics_summary()
    
    # Format the report
    report = "# Weekly Marketing Analytics Report\n\n"
    report += f"*Report Period: {summary['time_period']['comparison_date']} to {summary['time_period']['current_date']}*\n\n"
    
    # Website metrics
    report += "## Website Performance\n\n"
    
    visitors_change = summary['website']['weekly_visitors']['change']
    trend_icon = "📈" if visitors_change['trend'] == "up" else "📉" if visitors_change['trend'] == "down" else "➡️"
    
    report += f"Weekly Visitors: **{summary['website']['weekly_visitors']['current']:,}** {trend_icon} "
    report += f"({visitors_change['percentage']}% {visitors_change['trend']})\n\n"
    
    bounce_change = summary['website']['bounce_rate']['change']
    bounce_trend_icon = "📉" if bounce_change['trend'] == "down" else "📈" if bounce_change['trend'] == "up" else "➡️"
    # Note: For bounce rate, down is good
    bounce_trend_word = "down" if bounce_change['trend'] == "down" else "up" if bounce_change['trend'] == "up" else "unchanged"
    
    report += f"Bounce Rate: **{summary['website']['bounce_rate']['current']:.1f}%** {bounce_trend_icon} "
    report += f"({abs(bounce_change['percentage']):.1f}% {bounce_trend_word})\n\n"
    
    # Email metrics
    report += "## Email Performance\n\n"
    
    open_change = summary['email']['open_rate']['change']
    open_icon = "📈" if open_change['trend'] == "up" else "📉" if open_change['trend'] == "down" else "➡️"
    
    report += f"Open Rate: **{summary['email']['open_rate']['current']:.1f}%** {open_icon} "
    report += f"({open_change['percentage']:.1f}% {open_change['trend']})\n\n"
    
    click_change = summary['email']['click_rate']['change']
    click_icon = "📈" if click_change['trend'] == "up" else "📉" if click_change['trend'] == "down" else "➡️"
    
    report += f"Click Rate: **{summary['email']['click_rate']['current']:.1f}%** {click_icon} "
    report += f"({click_change['percentage']:.1f}% {click_change['trend']})\n\n"
    
    # Best performing email campaign
    best_email = summary['campaigns']['email']
    report += f"**Top Email Campaign:** {best_email['name']}\n"
    report += f"- Opens: {best_email['opens']:,} ({(best_email['opens']/best_email['sends']*100):.1f}%)\n"
    report += f"- Clicks: {best_email['clicks']:,} ({(best_email['clicks']/best_email['opens']*100):.1f}%)\n"
    report += f"- Conversions: {best_email['conversions']:,} (${best_email['revenue']:,.2f} revenue)\n\n"
    
    # Social metrics
    report += "## Social Media Performance\n\n"
    
    for platform, data in summary['social']['followers'].items():
        change = data['change']
        icon = "📈" if change['trend'] == "up" else "📉" if change['trend'] == "down" else "➡️"
        
        report += f"{platform.title()}: **{data['current']:,} followers** {icon} "
        report += f"({change['percentage']:.1f}% {change['trend']})\n"
    
    report += "\n"
    
    # Best performing social campaign
    best_social = summary['campaigns']['social']
    report += f"**Top Social Campaign:** {best_social['name']} ({best_social['platform'].title()})\n"
    report += f"- Budget: ${best_social['budget']:,}\n"
    report += f"- Impressions: {best_social['impressions']:,}\n"
    report += f"- Conversions: {best_social['conversions']} (${best_social['revenue']:,.2f} revenue)\n"
    report += f"- ROI: {best_social['roi']:.1f}x\n\n"
    
    # Conversion metrics
    report += "## Conversion Performance\n\n"
    
    conv_change = summary['conversions']['rate']['change']
    conv_icon = "📈" if conv_change['trend'] == "up" else "📉" if conv_change['trend'] == "down" else "➡️"
    
    report += f"Conversion Rate: **{summary['conversions']['rate']['current']:.2f}%** {conv_icon} "
    report += f"({conv_change['percentage']:.1f}% {conv_change['trend']})\n\n"
    
    revenue_change = summary['conversions']['weekly_revenue']['change']
    revenue_icon = "📈" if revenue_change['trend'] == "up" else "📉" if revenue_change['trend'] == "down" else "➡️"
    
    report += f"Weekly Revenue: **${summary['conversions']['weekly_revenue']['current']:,.2f}** {revenue_icon} "
    report += f"({revenue_change['percentage']:.1f}% {revenue_change['trend']})\n\n"
    
    # Key observations
    report += "## Key Insights\n\n"
    
    # Generate some dynamic insights based on the data
    insights = []
    
    # Website insights
    if visitors_change['percentage'] > 10:
        insights.append(f"📊 Website traffic is growing strongly (+{visitors_change['percentage']:.1f}%). Consider increasing content production to capitalize on this momentum.")
    elif visitors_change['percentage'] < -10:
        insights.append(f"⚠️ Website traffic has declined significantly ({visitors_change['percentage']:.1f}%). Investigate potential issues and consider a content refresh.")
    
    # Email insights
    if open_change['percentage'] > 5 and click_change['percentage'] > 5:
        insights.append("📧 Email performance is improving across all metrics. Consider scaling up email frequency.")
    elif open_change['percentage'] < -5 and click_change['percentage'] < -5:
        insights.append("⚠️ Email engagement is declining. Review subject lines and content strategy.")
    
    # Social insights
    social_growth = sum(data['change']['percentage'] for _, data in summary['social']['followers'].items()) / len(summary['social']['followers'])
    if social_growth > 5:
        insights.append(f"📱 Social media following is growing well (+{social_growth:.1f}% avg). Continue current strategy.")
    
    best_platform = max(summary['social']['followers'].items(), key=lambda x: x[1]['change']['percentage'])
    if best_platform[1]['change']['percentage'] > 8:
        insights.append(f"🌟 {best_platform[0].title()} is our fastest-growing platform (+{best_platform[1]['change']['percentage']:.1f}%). Consider increasing investment here.")
    
    # Revenue insights
    if revenue_change['percentage'] > 15:
        insights.append(f"💰 Revenue is up significantly (+{revenue_change['percentage']:.1f}%). Analyze which channels are driving this growth to optimize further.")
    elif revenue_change['percentage'] < -15:
        insights.append(f"⚠️ Revenue has decreased ({revenue_change['percentage']:.1f}%). Review conversion funnel for potential improvements.")
    
    # Add the insights to the report
    if insights:
        for insight in insights:
            report += f"- {insight}\n"
    else:
        report += "- All metrics are within normal ranges. Continue monitoring for trends.\n"
    
    return report

if __name__ == "__main__":
    # Run a simple test when executed directly
    print("Mock Analytics Agent Test")
    print("=======================")
    
    print("Generating analytics data...")
    data = get_analytics_data()
    print(f"Generated data for {data['date_range']['days']} days from {data['date_range']['start']} to {data['date_range']['end']}")
    
    print("\nKey metrics summary:")
    summary = get_key_metrics_summary()
    print(f"- Website Visitors (Weekly): {summary['website']['weekly_visitors']['current']:,} " + 
          f"({summary['website']['weekly_visitors']['change']['percentage']}% {summary['website']['weekly_visitors']['change']['trend']})")
    print(f"- Conversion Rate: {summary['conversions']['rate']['current']:.2f}% " +
          f"({summary['conversions']['rate']['change']['percentage']:.1f}% {summary['conversions']['rate']['change']['trend']})")
    print(f"- Weekly Revenue: ${summary['conversions']['weekly_revenue']['current']:,.2f} " +
          f"({summary['conversions']['weekly_revenue']['change']['percentage']:.1f}% {summary['conversions']['weekly_revenue']['change']['trend']})")
    
    print("\nMarketing insights report:")
    insights = get_marketing_insights()
    print(insights[:500] + "..." if len(insights) > 500 else insights) 
 