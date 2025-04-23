require('dotenv').config(); 
// Script to register slash commands with Discord

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const clientId = process.env.CLIENT_ID; 
const token = process.env.DISCORD_TOKEN;

if (!clientId || !token) {
    console.error('Error: CLIENT_ID or DISCORD_TOKEN is missing in the .env file.');
    process.exit(1);
}

const commands = [];
// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file); // Construct full path
	const command = require(filePath); // Require using the full path
    if ('data' in command && 'execute' in command) { // Check for execute too
	    commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(token);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands globally.`);

		// The put method is used to fully refresh all commands globally
		const data = await rest.put(
			Routes.applicationCommands(clientId), // Deploy globally
			// Routes.applicationGuildCommands(clientId, guildId), // Use this for guild-specific commands during development
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();