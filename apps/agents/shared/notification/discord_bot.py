"""
Discord Bot Module for direct messaging users.

This module provides functionality to send direct messages to Discord users
using a Discord bot token rather than webhooks.
"""

import asyncio
import logging
from typing import Optional, Dict, Any

import discord
from discord.ext import commands

# Configure logging
logger = logging.getLogger(__name__)

class DiscordNotifier:
    """Discord bot for sending direct messages to users."""
    
    _instance = None
    _initialized = False
    _client = None
    _bot_token = None
    _ready = False
    _pending_messages = []
    
    @classmethod
    def get_instance(cls, bot_token: Optional[str] = None) -> 'DiscordNotifier':
        """
        Get or create a singleton instance of the Discord notifier.
        
        Args:
            bot_token: The Discord bot token to use for authentication
            
        Returns:
            DiscordNotifier instance
        """
        if cls._instance is None:
            cls._instance = cls()
            
        if bot_token and not cls._initialized:
            cls._bot_token = bot_token
            cls._initialized = True
            cls._setup_client()
            
        return cls._instance
    
    @classmethod
    def _setup_client(cls):
        """Set up the Discord client with intents."""
        intents = discord.Intents.default()
        intents.messages = True
        intents.message_content = True
        
        cls._client = commands.Bot(command_prefix="!", intents=intents)
        
        @cls._client.event
        async def on_ready():
            logger.info(f"Discord bot logged in as {cls._client.user}")
            cls._ready = True
            # Process any pending messages
            await cls._process_pending_messages()
    
    @classmethod
    async def _process_pending_messages(cls):
        """Process any messages that were queued before the bot was ready."""
        if not cls._ready or not cls._pending_messages:
            return
            
        for user_id, title, message, task_id in cls._pending_messages:
            await cls.send_dm_async(user_id, title, message, task_id)
            
        cls._pending_messages = []
    
    @classmethod
    async def start_bot(cls):
        """Start the Discord bot if not already running."""
        if not cls._initialized or not cls._bot_token:
            logger.error("Discord bot not initialized or missing token")
            return False
            
        if cls._client and not cls._client.is_closed():
            return True
            
        try:
            # Run the bot in the background
            asyncio.create_task(cls._client.start(cls._bot_token))
            
            # Wait for the bot to be ready
            for _ in range(30):  # Wait up to 30 seconds
                if cls._ready:
                    return True
                await asyncio.sleep(1)
                
            logger.error("Timed out waiting for Discord bot to be ready")
            return False
            
        except Exception as e:
            logger.error(f"Error starting Discord bot: {e}")
            return False
    
    @classmethod
    async def send_dm_async(cls, user_id: str, title: str, message: str, task_id: str = None) -> bool:
        """
        Send a direct message to a Discord user asynchronously.
        
        Args:
            user_id: Discord user ID to send the message to
            title: Title of the message
            message: Content of the message
            task_id: Optional task ID for reference
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not cls._initialized:
            logger.error("Discord bot not initialized")
            return False
            
        # If bot isn't ready, queue the message and start the bot
        if not cls._ready:
            cls._pending_messages.append((user_id, title, message, task_id))
            await cls.start_bot()
            return True
            
        try:
            # Try to fetch the user
            user = await cls._client.fetch_user(int(user_id))
            if not user:
                logger.error(f"Could not find Discord user with ID {user_id}")
                return False
                
            # Create an embed for the message
            embed = discord.Embed(
                title=title,
                description=message[:4000],  # Discord has a limit
                color=discord.Color.blue()
            )
            
            if task_id:
                embed.set_footer(text=f"Task ID: {task_id}")
                
            # Send the DM
            await user.send(embed=embed)
            logger.info(f"Sent Discord DM to user {user_id}")
            return True
            
        except discord.Forbidden:
            logger.error(f"Forbidden to send DM to user {user_id}")
            return False
        except discord.HTTPException as e:
            logger.error(f"HTTP error sending DM to user {user_id}: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending Discord DM: {e}")
            return False
    
    @classmethod
    def send_dm(cls, user_id: str, title: str, message: str, task_id: str = None) -> bool:
        """
        Send a direct message to a Discord user (synchronous wrapper).
        
        Args:
            user_id: Discord user ID to send the message to
            title: Title of the message
            message: Content of the message
            task_id: Optional task ID for reference
            
        Returns:
            True if the message was sent or queued, False on initialization error
        """
        if not cls._initialized:
            logger.error("Discord bot not initialized")
            return False
            
        # Run in a new event loop
        async def _run_async():
            return await cls.send_dm_async(user_id, title, message, task_id)
            
        # For Jupyter notebooks or other environments where asyncio loop might be running
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Queue the message for later processing
                cls._pending_messages.append((user_id, title, message, task_id))
                asyncio.create_task(cls.start_bot())
                return True
            else:
                return loop.run_until_complete(_run_async())
        except RuntimeError:
            # No event loop, create a new one
            return asyncio.run(_run_async()) 