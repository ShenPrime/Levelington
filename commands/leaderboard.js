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
			// Defer reply immediately to avoid timeout
			await interaction.deferReply();

			// Fetch more users than needed to account for users who may have left
			const topUsers = await db.getLeaderboard(guildId, 50);

			if (topUsers.length === 0) {
				return interaction.editReply({ content: 'No one is on the leaderboard yet! Ensure the bot is set up using `/setup`.', flags: 64 });
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

            // Filter to only include users still in the server
            let validCount = 0;
            for (let i = 0; i < topUsers.length && validCount < 10; i++) {
                const user = topUsers[i];
                const member = members[i];

                // Skip users who have left the server
                if (!member) continue;

                validCount++;
                const displayName = member.displayName;
                description += `${validCount}. **${displayName}** - Level ${user.level} (${user.xp} XP)\n`;
            }

            if (validCount === 0) {
                return interaction.editReply({ content: 'No one is on the leaderboard yet! Ensure the bot is set up using `/setup`.', flags: 64 });
            }

            leaderboardEmbed.setDescription(description);

			await interaction.editReply({ embeds: [leaderboardEmbed] });
		} catch (error) {
			console.error(`Error executing leaderboard command for guild ${guildId}:`, error);
            // Check if the error is due to the guild not being set up
            if (error.message.includes('does not exist') || error.code === '42P01') {
                 await interaction.editReply({ content: 'The leaderboard is not available. Please run the `/setup` command first.', flags: 64 });
            } else {
			    await interaction.editReply({ content: 'There was an error trying to fetch the leaderboard.', flags: 64 });
            }
		}
	},
};