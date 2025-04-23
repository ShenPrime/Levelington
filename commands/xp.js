const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { xpForLevel } = require('../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('xp')
		.setDescription('Checks the XP and level of a specific user.')
		.addUserOption(option => 
			option.setName('user')
				.setDescription('The user to check the XP for.')
				.setRequired(true)),
	async execute(interaction) {
		const targetUser = interaction.options.getUser('user');
		const userId = targetUser.id;
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
				return interaction.reply({ content: `${targetUser.username} doesn't have any XP yet.`, ephemeral: true });
			}

			const currentLevel = userData.level;
			const currentXp = userData.xp;
			const xpNeeded = xpForLevel(currentLevel + 1);
            const xpForCurrentLevel = xpForLevel(currentLevel);
            const progressXp = currentXp - xpForCurrentLevel;
            const progressNeeded = xpNeeded - xpForCurrentLevel;

            // Simple progress bar
            const progressBarLength = 10;
            const filledBlocks = Math.round((progressXp / progressNeeded) * progressBarLength);
            const emptyBlocks = progressBarLength - filledBlocks;
            const progressBar = '🟩'.repeat(filledBlocks) + '⬜'.repeat(emptyBlocks);

			const xpEmbed = new EmbedBuilder()
				.setColor('#0099ff')
				.setTitle(`${targetUser.username}'s XP Stats`)
                .setThumbnail(targetUser.displayAvatarURL())
				.addFields(
					{ name: 'Level', value: `**${currentLevel}**`, inline: true },
					{ name: 'XP', value: `**${currentXp}** / ${xpNeeded}`, inline: true },
                    { name: 'Progress', value: `${progressBar} (${progressXp}/${progressNeeded})` }
				)
				.setTimestamp();

			await interaction.reply({ embeds: [xpEmbed] });
		} catch (error) {
			console.error(`Error executing xp command for user ${targetUser.tag} (${userId}) in guild ${guildId}:`, error);
            // Check if the error is due to the guild not being set up
            if (error.message.includes('does not exist') || error.code === '42P01') {
                 await interaction.reply({ content: 'The XP system is not available. Please run the `/setup` command first.', ephemeral: true });
            } else {
			    await interaction.reply({ content: 'There was an error trying to fetch that user\'s XP.', ephemeral: true });
            }
		}
	},
};