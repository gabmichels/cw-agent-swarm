// Super Simple Discord Test
console.log('Starting Simple Discord Test...');

// Load environment variables from .env file manually
try {
  const fs = require('fs');
  const path = require('path');
  const envFile = path.resolve(process.cwd(), '.env');
  console.log('Attempting to load .env file from:', envFile);
  
  if (fs.existsSync(envFile)) {
    console.log('.env file exists, loading...');
    const envContent = fs.readFileSync(envFile, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove surrounding quotes if present
        process.env[key] = value;
        if (key.startsWith('DISCORD')) {
          console.log(`Loaded Discord env var: ${key}`);
        }
      }
    });
    console.log('Env file loaded successfully');
  } else {
    console.log('.env file not found');
  }
} catch (error) {
  console.log('Could not load .env file, using existing environment variables:', error);
}

// Get Discord configuration
const token = process.env.DISCORD_BOT_TOKEN;
const userId = process.env.DISCORD_USER_ID;

console.log('\nDiscord configuration:');
console.log('- Bot Token:', token ? '✓ Set' : '✗ Not set');
console.log('- User ID:', userId ? '✓ Set' : '✗ Not set');

// Step 1: First list guilds (servers) the bot is in
async function listGuilds() {
  console.log('\nFetching guilds (servers) the bot is in...');
  
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const guilds = await response.json();
      console.log(`Bot is in ${guilds.length} servers:`);
      
      for (const guild of guilds) {
        console.log(`- ${guild.name} (ID: ${guild.id})`);
      }
      
      // If we have at least one guild, get its channels
      if (guilds.length > 0) {
        return guilds[0].id; // Return the first guild ID
      } else {
        console.error('Bot is not in any servers!');
        return null;
      }
    } else {
      console.error('❌ ERROR: Failed to fetch guilds');
      console.error('Status:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Response:', errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ ERROR: Exception occurred while fetching guilds');
    console.error(error);
    return null;
  }
}

// Step 2: List channels in a guild
async function listChannels(guildId) {
  if (!guildId) return null;
  
  console.log(`\nFetching channels in guild ${guildId}...`);
  
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const channels = await response.json();
      const textChannels = channels.filter(channel => channel.type === 0); // Type 0 is text channel
      
      console.log(`Found ${textChannels.length} text channels:`);
      for (const channel of textChannels) {
        console.log(`- ${channel.name} (ID: ${channel.id})`);
      }
      
      // Return the first text channel ID if available
      return textChannels.length > 0 ? textChannels[0].id : null;
    } else {
      console.error('❌ ERROR: Failed to fetch channels');
      console.error('Status:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Response:', errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ ERROR: Exception occurred while fetching channels');
    console.error(error);
    return null;
  }
}

// Step 3: Send a message to a channel
async function sendMessage(channelId) {
  if (!channelId) {
    console.error('No valid channel ID to send message to');
    return false;
  }
  
  console.log(`\nSending message to channel ${channelId}...`);
  
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: '🔧 **SIMPLE TEST**\n\nThis is a simple test message from the Discord test script.\n\nIf you can see this, the Discord integration is working!'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS: Message sent successfully!');
      console.log('Message ID:', data.id);
      return true;
    } else {
      console.error('❌ ERROR: Failed to send message');
      console.error('Status:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Response:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ ERROR: Exception occurred while sending message');
    console.error(error);
    return false;
  }
}

// Run the full test
async function runTest() {
  try {
    // Step 1: Get guilds
    const guildId = await listGuilds();
    
    // Step 2: Get channels
    const channelId = guildId ? await listChannels(guildId) : null;
    
    // Step 3: Send message
    if (channelId) {
      await sendMessage(channelId);
    } else {
      console.error('❌ ERROR: Could not find a valid channel to send message to');
    }
  } catch (error) {
    console.error('❌ ERROR: Test failed with error:', error);
  }
}

// Run the test
console.log('Starting test sequence...');
runTest()
  .catch(error => {
    console.error('Unhandled error:', error);
  })
  .finally(() => {
    console.log('\nTest script finished.');
  }); 