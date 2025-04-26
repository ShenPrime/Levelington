require('dotenv').config(); // Load .env file
// Main bot file for Discord XP Bot

const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require('discord.js'); // Added Collection
const fs = require('node:fs'); // Added fs
const path = require('node:path'); // Added path
// const { token } = require('./config.json'); // Removed config.json require
const db = require('./db'); // Import database functions
const { xpForLevel, updateBiggestYapperRole } = require('./utils'); // Import utility functions

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Command handling
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	// Set a new item in the Collection with the key as the command name and the value as the exported module
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
	}
}


// Cooldowns map (UserId: Timestamp) - No longer needed, handled by DB
// const cooldowns = new Map();
const COOLDOWN_SECONDS = 30;

// Function to calculate XP needed for a level - Moved to utils.js
// const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

// When the client is ready, run this code (only once)
client.once('ready', async () => {
	console.log(`Ready! Logged in as ${client.user.tag}`);
    // Initialize the database (might need adjustment for per-guild schemas later)
    // await db.initializeDB(); // Initialization might be handled by /setup now
});

// Listen for interactions (slash commands)
client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
	}
});


// Listen for messages (for XP gain)
client.on('messageCreate', async message => {
    // Debug logging for message filtering

    
    // Ignore bot messages and empty messages
    //console.log(`[DEBUG] Full message object:`, message);
    if (message.author.bot || !message.guild) {
        //console.log(`[XP] Ignoring message - Bot: ${message.author.bot}, DM: ${!message.guild}`);
        return;
    }
    
    // Check for valid message content (including attachments, embeds, stickers)

    
    // Comprehensive message validation checking all possible content types
    const hasValidContent = !message.author.bot && message.guild && 
        (message.content?.trim().length > 0 || 
         message.attachments.size > 0 || 
         message.embeds.length > 0 || 
         message.stickers.size > 0);
    
    if (!hasValidContent) {
        console.log(`[XP] Ignoring message - Invalid content, system message or wrong type:`, {
            content: message.content,
            attachments: message.attachments.size,
            embeds: message.embeds.length,
            stickers: message.stickers.size,
            components: message.components?.length || 0,
            system: message.system,
            type: message.type,
            poll: message.poll !== null,
            reference: message.reference !== null,
            activity: message.activity !== null
        });
     
        // Additional debug for empty messages
        if (message.content === '') {
            console.log('[DEBUG] Empty message content detected, checking for attachments/embeds/stickers:', {
                hasAttachments: message.attachments.size > 0,
                hasEmbeds: message.embeds.length > 0,
                hasStickers: message.stickers.size > 0
            });
        }
        return;
    }
    
    // Debug log full message structure for analysis

    
    // Log XP processing decision

    
    // Additional validation check for non-empty strings
    //if (message.content?.trim() && message.content.trim().length > 0) {
        //console.log('[XP] Valid message content detected:', message.content.trim());
    //}

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Date.now();
    const cooldownAmount = COOLDOWN_SECONDS * 1000;

    try {
        // Check if guild is set up
        const guildSettings = await db.getGuildSettings(guildId);
        
        // Check if channel is ignored
        if (guildSettings?.ignored_channels?.split(',').includes(message.channel.id)) {
            console.log(`[XP] Ignoring message in ignored channel ${message.channel.id}`);
            return;
        }

        if (!guildSettings) {
            console.log(`[XP] Guild ${guildId} not set up. Ignoring message from ${message.author.tag}`);
            return;
        }

        // Get user data from DB (passing guildId)
        let userData = await db.getUser(userId, guildId);

        // Check cooldown using DB timestamp
        if (userData && userData.last_message_timestamp) {
            const expirationTime = parseInt(userData.last_message_timestamp, 10) + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                //console.log(`[XP] ${message.author.tag} is on cooldown for ${timeLeft.toFixed(1)} more seconds`);
                return;
            }
        }

        // Award XP (15-25)
        let xpToAward = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
            // Apply channel multiplier
            const multipliers = guildSettings.channel_multipliers ? JSON.parse(guildSettings.channel_multipliers) : {};
            const channelMultiplier = multipliers[message.channel.id] || 1.0;
            xpToAward = Math.round(xpToAward * channelMultiplier);
            console.log(`[XP] Applied ${channelMultiplier}x multiplier - Awarding ${xpToAward} XP`);
        console.log(`[XP] Awarding ${xpToAward} XP to ${message.author.tag} in guild ${guildId}`);
        //console.log(`Awarding ${xpToAward} XP to ${message.author.tag} in guild ${guildId}`); // Less verbose logging

        // Update user in DB (passing guildId)
        const updatedUser = await db.updateUser(userId, guildId, xpToAward, now);
        
        if (updatedUser) {
            console.log(`[XP] Successfully updated XP for ${message.author.tag} in guild ${guildId}`);
            const currentLevel = updatedUser.level;
            const currentXp = updatedUser.xp;
            const xpNeeded = xpForLevel(currentLevel + 1);

            // Check for level up
            if (currentXp >= xpNeeded) {
                const newLevel = currentLevel + 1;
                await db.updateUserLevel(userId, guildId, newLevel); // Pass guildId
                console.log(`${message.author.tag} in guild ${guildId} leveled up to level ${newLevel}!`);

                // Update the "Biggest Yapper" role after level up
                await updateBiggestYapperRole(message.guild, db);

                // Send level up notification using configured channel
                const levelUpChannelId = guildSettings.level_up_channel_id;
                if (levelUpChannelId) {
                    const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
                    if (levelUpChannel && levelUpChannel.isTextBased()) {
                        const levelUpEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Level Up!')
                            .setDescription(`${message.author} has reached level **${newLevel}**! 🎉`)
                            .setTimestamp();
                        try {
                            await levelUpChannel.send({ embeds: [levelUpEmbed] });
                        } catch (sendError) {
                            console.error(`Failed to send level up message to configured channel ${levelUpChannelId} in guild ${guildId}:`, sendError);
                        }
                    } else {
                        console.warn(`Configured level up channel (${levelUpChannelId}) for guild ${guildId} not found or not text-based.`);
                        // Optionally notify admin or log this issue
                    }
                } else {
                    console.log(`Level up channel not configured for guild ${guildId}.`);
                    // No fallback to current channel to avoid spam
                }
            }
        } else {
             console.error(`[XP] Failed to update user ${userId} in guild ${guildId}. Possible database issue or guild not properly set up.`);
             console.error(`[XP] Check if schema 'guild_${guildId}' and tables exist in the database.`);
        }

    } catch (error) {
        console.error(`Error processing message for XP in guild ${guildId}:`, error);
    }
});


// Login to Discord with your client's token from .env
client.login(process.env.DISCORD_TOKEN);