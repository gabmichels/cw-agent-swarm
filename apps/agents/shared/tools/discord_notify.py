import discord
import asyncio
import os
import sys
import signal
from concurrent.futures import TimeoutError
import traceback

DISCORD_BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
print(f"Bot token starts with: {DISCORD_BOT_TOKEN[:10]}... (length: {len(DISCORD_BOT_TOKEN) if DISCORD_BOT_TOKEN else 0})")

# Safely parse DISCORD_USER_ID, handle invalid values
discord_user_id = os.environ.get("DISCORD_USER_ID", "0")
try:
    DISCORD_USER_ID = int(discord_user_id)
    print(f"Discord User ID: {DISCORD_USER_ID}")
except ValueError:
    print(f"Warning: Invalid DISCORD_USER_ID '{discord_user_id}'. Using default value 0.")
    DISCORD_USER_ID = 0

class NotificationClient(discord.Client):
    def __init__(self, message_to_send, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.message_to_send = message_to_send
        self.message_sent = False
        
    async def setup_hook(self):
        print("Setting up Discord client hooks...")
        
    async def on_connect(self):
        print("Discord client connected to gateway!")
        
    async def on_ready(self):
        print(f"Discord bot logged in as {self.user} (ID: {self.user.id})")
        print(f"Bot is in {len(self.guilds)} servers")
        for guild in self.guilds:
            print(f" - {guild.name} (ID: {guild.id})")
            
        try:
            print(f"Attempting to fetch user with ID: {DISCORD_USER_ID}")
            user = await self.fetch_user(DISCORD_USER_ID)
            print(f"Successfully fetched user: {user.name}#{user.discriminator} (ID: {user.id})")
            
            print(f"Attempting to send message to user...")
            await user.send(self.message_to_send)
            print(f"Message successfully sent to user {user.name}#{user.discriminator}")
            self.message_sent = True
        except discord.errors.Forbidden as e:
            print(f"ERROR: Forbidden - Bot doesn't have permission to message this user. The user may have DMs disabled. {e}")
        except discord.errors.NotFound as e:
            print(f"ERROR: Not Found - User ID {DISCORD_USER_ID} could not be found. {e}")
        except discord.errors.HTTPException as e:
            print(f"ERROR: HTTP Exception - {e}")
        except Exception as e:
            print(f"ERROR: Unexpected error sending message: {e}")
            traceback.print_exc()
        finally:
            print("Closing Discord client connection...")
            await self.close()
            print("Discord client closed")

async def run_discord_client(message):
    """Run the discord client with a timeout"""
    print(f"Setting up Discord client with intents...")
    intents = discord.Intents.default()
    intents.members = True
    intents.message_content = True
    print(f"Intents configured: {intents}")
    
    client = NotificationClient(message, intents=intents)
    
    try:
        print(f"Attempting to connect to Discord with token starting with {DISCORD_BOT_TOKEN[:5]}...")
        # Set a timeout for the login process
        await asyncio.wait_for(client.start(DISCORD_BOT_TOKEN), timeout=45)
    except TimeoutError:
        print("ERROR: Discord connection timed out after 45 seconds")
        return False
    except discord.errors.LoginFailure as e:
        print(f"ERROR: Discord login failed. The token may be invalid: {e}")
        return False
    except Exception as e:
        print(f"ERROR: Discord error: {e}")
        traceback.print_exc()
        return False
    finally:
        if not client.is_closed():
            await client.close()
            print("Forcibly closed Discord client")
    
    return client.message_sent

def send_discord_dm(message):
    """Send a Discord DM with timeout protection"""
    # Only proceed if Discord credentials are set
    if not DISCORD_BOT_TOKEN or DISCORD_USER_ID == 0:
        print("Discord notification skipped: Missing bot token or valid user ID")
        return False
        
    print("Attempting to send Discord notification...")
    print(f"Bot token: {DISCORD_BOT_TOKEN[:5]}...{DISCORD_BOT_TOKEN[-5:]} (length: {len(DISCORD_BOT_TOKEN)})")
    print(f"User ID: {DISCORD_USER_ID}")
    
    try:
        # Define a function to handle the asyncio timeout
        def force_exit():
            print("Discord notification timed out. Force exiting...")
            os._exit(0)
        
        # Set a 60-second timer to force exit if the process hangs
        timer = None
        if sys.platform != 'win32':  # Windows doesn't support SIGALRM
            signal.signal(signal.SIGALRM, lambda signum, frame: force_exit())
            signal.alarm(60)
        else:
            # For Windows, we'll use a different approach
            # Actually in our case we don't need this since we're using threading
            pass
            
        # Run the client with a separate event loop
        result = asyncio.run(run_discord_client(message))
        
        # Reset the alarm
        if sys.platform != 'win32':
            signal.alarm(0)
            
        return result
        
    except Exception as e:
        print(f"Error in Discord notification: {e}")
        traceback.print_exc()
        return False
    finally:
        print("Discord notification process completed")
        
    return False 