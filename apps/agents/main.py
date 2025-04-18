from departments.marketing.cmo_agent import plan_weekly_strategy
import asyncio
import os
from dotenv import load_dotenv

def send_discord_notification(strategy):
    """Send Discord notification using a simple HTTP request instead of the Discord client"""
    from dotenv import load_dotenv
    import requests
    import json
    
    # Load environment variables
    load_dotenv()
    
    discord_token = os.environ.get("DISCORD_BOT_TOKEN")
    discord_user_id = os.environ.get("DISCORD_USER_ID")
    
    if not discord_token or not discord_user_id:
        print("Discord notification skipped: Missing bot token or user ID")
        return
    
    try:
        # Convert user ID to integer
        user_id = int(discord_user_id)
        
        # API endpoint for creating a DM channel
        create_dm_url = f"https://discord.com/api/v10/users/@me/channels"
        
        # Headers with authorization
        headers = {
            "Authorization": f"Bot {discord_token}",
            "Content-Type": "application/json"
        }
        
        # Payload for creating DM channel
        create_dm_payload = {
            "recipient_id": user_id
        }
        
        print("Creating DM channel...")
        dm_response = requests.post(create_dm_url, headers=headers, json=create_dm_payload)
        
        if dm_response.status_code != 200:
            print(f"Failed to create DM channel: {dm_response.status_code}")
            print(dm_response.text)
            return
        
        # Get the DM channel ID
        dm_channel_id = dm_response.json()["id"]
        
        # API endpoint for sending a message
        message_url = f"https://discord.com/api/v10/channels/{dm_channel_id}/messages"
        
        # Prepare message content (truncate if too long)
        message_content = "📣 Weekly strategy is ready:\n" + strategy
        if len(message_content) > 2000:
            message_content = message_content[:1997] + "..."
            
        # Payload for sending message
        message_payload = {
            "content": message_content
        }
        
        print("Sending message...")
        message_response = requests.post(message_url, headers=headers, json=message_payload)
        
        if message_response.status_code == 200:
            print("✅ Discord notification sent successfully!")
        else:
            print(f"❌ Failed to send Discord message: {message_response.status_code}")
            print(message_response.text)
            
    except Exception as e:
        print(f"❌ Error sending Discord notification: {e}")

if __name__ == "__main__":
    try:
        print("Generating weekly strategy...")
        strategy = plan_weekly_strategy()
        print("\nWEEKLY STRATEGY FROM YOUR CMO AGENT:\n")
        print(strategy)
        
        # Send Discord notification
        print("\nSending Discord notification...")
        send_discord_notification(strategy)
        
        print("\nWeekly strategy process complete.")
        
    except Exception as e:
        print(f"An error occurred: {e}")
