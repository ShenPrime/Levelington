const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../db');
const { updateBiggestYapperRole } = require('../utils');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leaderboard')
		.setDescription('Shows the top 10 users by XP in this server.'),
	async execute(interaction) {
		const guildId = interaction.guild.id;

		try {
			// Fetch top 10 users using the new getLeaderboard function
			const topUsers = await db.getLeaderboard(guildId, 10);

			if (topUsers.length === 0) {
				return interaction.reply({ content: 'No one is on the leaderboard yet! Ensure the bot is set up using `/setup`.', ephemeral: true });
			}

			// Use the shared utility to update the Biggest Yapper role
			await updateBiggestYapperRole(interaction.guild, db);

			// Continue with leaderboard embed creation
			const leaderboardEmbed = new EmbedBuilder()
				.setColor('#FFD700')
				.setTitle(`🏆 Top 10 XP Leaders in ${interaction.guild.name}`)
				.setTimestamp();

            let description = '';
            // Use Promise.all for potentially faster member fetching
            const memberPromises = topUsers.map(user => interaction.guild.members.fetch(user.user_id).catch(() => null));
            const members = await Promise.all(memberPromises);

            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const member = members[i]; // Get the fetched member (or null if failed/left)

                const displayName = member ? member.displayName : `User (${user.user_id.substring(0, 6)}...)`; // Fallback display
                const rank = i + 1;
                description += `${rank}. **${displayName}** - Level ${user.level} (${user.xp} XP)\n`;
            }

            leaderboardEmbed.setDescription(description);

			await interaction.reply({ embeds: [leaderboardEmbed] });
		} catch (error) {
			console.error(`Error executing leaderboard command for guild ${guildId}:`, error);
            // Check if the error is due to the guild not being set up
            if (error.message.includes('does not exist') || error.code === '42P01') {
                 await interaction.reply({ content: 'The leaderboard is not available. Please run the `/setup` command first.', ephemeral: true });
            } else {
			    await interaction.reply({ content: 'There was an error trying to fetch the leaderboard.', ephemeral: true });
            }
		}
	},
};