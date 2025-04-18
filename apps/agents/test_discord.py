"""
A simple script to test Discord token and DM capabilities
"""
import os
import requests
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
DISCORD_USER_ID = os.environ.get("DISCORD_USER_ID")

def validate_token():
    """Test if the Discord token is valid"""
    if not DISCORD_BOT_TOKEN:
        print("ERROR: No Discord token found in .env file")
        return False
        
    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}"
    }
    
    try:
        print(f"Testing Discord token: {DISCORD_BOT_TOKEN[:10]}...")
        response = requests.get("https://discord.com/api/v10/users/@me", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Token is valid! Bot: {data['username']}#{data.get('discriminator', '0000')}")
            return True
        elif response.status_code == 401:
            print(f"ERROR: Invalid token (401 Unauthorized)")
            print(f"Response: {response.text}")
            return False
        else:
            print(f"ERROR: Unexpected response: {response.status_code}")
            print(f"Response: {response.text}")
            return False
    except Exception as e:
        print(f"ERROR: Failed to validate token: {e}")
        return False

def test_send_message():
    """Test sending a DM to the user"""
    if not DISCORD_USER_ID:
        print("ERROR: No Discord user ID found in .env file")
        return False
        
    try:
        # Convert user ID to integer
        user_id = int(DISCORD_USER_ID)
        
        # API endpoint for creating a DM channel
        create_dm_url = f"https://discord.com/api/v10/users/@me/channels"
        
        # Headers with authorization
        headers = {
            "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
            "Content-Type": "application/json"
        }
        
        # Payload for creating DM channel
        create_dm_payload = {
            "recipient_id": user_id
        }
        
        print(f"Creating DM channel with user ID: {user_id}...")
        dm_response = requests.post(create_dm_url, headers=headers, json=create_dm_payload)
        
        if dm_response.status_code != 200:
            print(f"ERROR: Failed to create DM channel: {dm_response.status_code}")
            print(f"Response: {dm_response.text}")
            return False
        
        # Get the DM channel ID
        dm_channel_id = dm_response.json()["id"]
        print(f"DM channel created: {dm_channel_id}")
        
        # API endpoint for sending a message
        message_url = f"https://discord.com/api/v10/channels/{dm_channel_id}/messages"
        
        # Test message
        message_payload = {
            "content": "🧪 This is a test message from the Weekly Strategy Bot!"
        }
        
        print("Sending test message...")
        message_response = requests.post(message_url, headers=headers, json=message_payload)
        
        if message_response.status_code == 200:
            print("SUCCESS: Test message sent!")
            return True
        else:
            print(f"ERROR: Failed to send message: {message_response.status_code}")
            print(f"Response: {message_response.text}")
            return False
            
    except Exception as e:
        print(f"ERROR: Failed to send test message: {e}")
        return False

def main():
    """Main function to run the tests"""
    print("\n== DISCORD TOKEN VALIDATION ==")
    token_valid = validate_token()
    
    if token_valid:
        print("\n== DISCORD DM TEST ==")
        message_sent = test_send_message()
        
        if message_sent:
            print("\n✅ ALL TESTS PASSED! Discord integration is working correctly.")
        else:
            print("\n❌ DM TEST FAILED. Your bot can authenticate but cannot send messages.")
            print("Please check if:")
            print("1. Your bot is in a server with you")
            print("2. You have DMs enabled from server members")
            print("3. The bot has the 'MESSAGE CONTENT INTENT' enabled in the Discord Developer Portal")
    else:
        print("\n❌ TOKEN VALIDATION FAILED. Cannot proceed with DM test.")
        print("Please generate a new token in the Discord Developer Portal.")

if __name__ == "__main__":
    main() 