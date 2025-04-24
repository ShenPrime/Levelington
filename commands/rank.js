const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { xpForLevel } = require('../utils'); // Assuming utils.js will be created for shared functions

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rank')
		.setDescription('Displays your current level and XP progress.'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const guildId = interaction.guild.id;

		try {
			// Fetch user data using the updated db function
			const userData = await db.getUser(userId, guildId);

			if (!userData) {
				// Check if the guild is set up at all
				const guildSettings = await db.getGuildSettings(guildId);
				if (!guildSettings) {
					return interaction.reply({ content: 'This server has not been set up yet. Please ask an administrator to run the `/setup` command.', ephemeral: true });
				}
				// If guild is set up, but user has no data
				return interaction.reply({ content: 'You don\'t have any XP yet. Send some messages!', ephemeral: true });
			}

			const currentLevel = userData.level;
			const currentXp = userData.xp;
			const xpNeeded = xpForLevel(currentLevel + 1);
            const progressXp = currentXp;
            const progressNeeded = xpNeeded;

            // Simple progress bar (adjust length as needed)

			const rankEmbed = new EmbedBuilder()
				.setColor('#0099ff')
				.setTitle(`${interaction.user.username}'s Rank`) 
                .setThumbnail(interaction.user.displayAvatarURL())
				.addFields(
					{ name: 'Level', value: `**${currentLevel}**`, inline: true },
					{ name: 'XP', value: `**${currentXp}** / ${xpNeeded}`, inline: true },

				)
				.setTimestamp();

			await interaction.reply({ embeds: [rankEmbed] });
		} catch (error) {
			console.error(`Error executing rank command for user ${userId} in guild ${guildId}:`, error);
            // Check if the error is due to the guild not being set up
            if (error.message.includes('does not exist') || error.code === '42P01') {
                 await interaction.reply({ content: 'The rank system is not available. Please run the `/setup` command first.', ephemeral: true });
            } else {
			    await interaction.reply({ content: 'There was an error trying to fetch your rank.', ephemeral: true });
            }
		}
	},
};