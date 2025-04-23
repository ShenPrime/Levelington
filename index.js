require('dotenv').config(); // Load .env file
// Main bot file for Discord XP Bot

const { Client, GatewayIntentBits, EmbedBuilder, Collection } = require('discord.js'); // Added Collection
const fs = require('node:fs'); // Added fs
const path = require('node:path'); // Added path
// const { token } = require('./config.json'); // Removed config.json require
const db = require('./db'); // Import database functions
const { xpForLevel } = require('./utils'); // Import utility function

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
    // Ignore bot messages and empty messages
    if (message.author.bot || !message.content || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const now = Date.now();
    const cooldownAmount = COOLDOWN_SECONDS * 1000;

    try {
        // Check if guild is set up
        const guildSettings = await db.getGuildSettings(guildId);
        if (!guildSettings) {
            // Maybe log this or inform an admin, but don't process XP
            // console.log(`Guild ${guildId} not set up. Ignoring message.`);
            return;
        }

        // Get user data from DB (passing guildId)
        let userData = await db.getUser(userId, guildId);

        // Check cooldown using DB timestamp
        if (userData && userData.last_message_timestamp) {
            const expirationTime = parseInt(userData.last_message_timestamp, 10) + cooldownAmount;
            if (now < expirationTime) {
                // Still on cooldown
                // const timeLeft = (expirationTime - now) / 1000;
                // console.log(`${message.author.tag} is on cooldown for ${timeLeft.toFixed(1)} more seconds.`);
                return;
            }
        }

        // Award XP (15-25)
        const xpToAward = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
        // console.log(`Awarding ${xpToAward} XP to ${message.author.tag} in guild ${guildId}`); // Less verbose logging

        // Update user in DB (passing guildId)
        const updatedUser = await db.updateUser(userId, guildId, xpToAward, now);

        if (updatedUser) {
            const currentLevel = updatedUser.level;
            const currentXp = updatedUser.xp;
            const xpNeeded = xpForLevel(currentLevel + 1);

            // Check for level up
            if (currentXp >= xpNeeded) {
                const newLevel = currentLevel + 1;
                await db.updateUserLevel(userId, guildId, newLevel); // Pass guildId
                console.log(`${message.author.tag} in guild ${guildId} leveled up to level ${newLevel}!`);

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
             console.error(`Failed to update user ${userId} in guild ${guildId}`);
        }

    } catch (error) {
        console.error(`Error processing message for XP in guild ${guildId}:`, error);
    }
});


// Login to Discord with your client's token from .env
client.login(process.env.DISCORD_TOKEN);