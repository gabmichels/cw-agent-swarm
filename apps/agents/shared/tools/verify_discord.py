"""Discord token verification utility"""
import asyncio
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
DISCORD_USER_ID = os.environ.get("DISCORD_USER_ID")

def verify_user_id(user_id):
    """Verify if a Discord user ID is valid and reachable"""
    if not user_id:
        print("❌ Error: No Discord user ID provided")
        return False

    try:
        user_id_int = int(user_id)
        if user_id_int <= 0:
            print("❌ Error: Invalid Discord user ID format")
            return False
        
        print(f"✅ User ID format is valid: {user_id_int}")
        return True
    except ValueError:
        print(f"❌ Error: User ID '{user_id}' is not a valid integer")
        return False

def verify_token(token):
    """Verify if a Discord bot token is valid by making a request to the Discord API"""
    if not token:
        print("❌ Error: No Discord bot token provided")
        return False

    # Check token format - basic validation
    parts = token.split(".")
    if len(parts) != 3:
        print("❌ Error: Discord token doesn't have the expected format (should have 3 parts separated by periods)")
        return False

    # Make a request to Discord API
    headers = {
        "Authorization": f"Bot {token}"
    }
    
    try:
        print("📡 Making request to Discord API to verify token...")
        response = requests.get("https://discord.com/api/v10/users/@me", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Token is valid! Bot: {data['username']}#{data.get('discriminator', '0000')}")
            return True
        elif response.status_code == 401:
            print("❌ Error: Invalid token (401 Unauthorized)")
            return False
        else:
            print(f"❌ Error: Unexpected response from Discord API: {response.status_code}")
            print(f"Response content: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error connecting to Discord API: {e}")
        return False

def check_dm_permissions():
    """Check if the bot has permissions to send DMs"""
    print("\n📝 DM Permission Check:")
    print("For a bot to send DMs to a user:")
    print("1. The bot and user must share at least one server")
    print("2. The user must have DMs enabled for members of that server")
    print("3. The bot must have the proper intents enabled in Discord Developer Portal\n")
    
    # We can't programmatically check these without setting up a full bot
    print("⚠️ Note: You need to manually verify these requirements.")

def run_verification():
    """Run all verification checks"""
    print("\n🔍 Starting Discord Verification...")
    
    print("\n🤖 Checking Discord Bot Token:")
    token_valid = verify_token(DISCORD_BOT_TOKEN)
    
    print("\n👤 Checking Discord User ID:")
    user_valid = verify_user_id(DISCORD_USER_ID)
    
    check_dm_permissions()
    
    print("\n📋 Verification Summary:")
    print(f"Bot Token Status: {'✅ Valid' if token_valid else '❌ Invalid'}")
    print(f"User ID Status: {'✅ Valid format' if user_valid else '❌ Invalid format'}")
    
    if token_valid and user_valid:
        print("\n✅ Basic verification passed. If you're still having issues, check the DM permission requirements.")
    else:
        print("\n❌ Verification failed. Please fix the issues above.")

if __name__ == "__main__":
    run_verification() 