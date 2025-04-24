const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const db = require('../db');

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

			// Role management logic moved inside execute function
			const roleName = 'Biggest Yapper';
			let role = interaction.guild.roles.cache.find(r => r.name === roleName);
			if (!role) {
				role = await interaction.guild.roles.create({
					name: roleName,
					color: '#FFD700',
					permissions: [PermissionsBitField.Flags.ViewChannel],
					reason: 'Automatically created for XP leaderboard top user'
				});
			}

			const settings = await db.getGuildSettings(guildId);
			const previousTopUserId = settings?.top_user_id;
			const hasClearLeader = topUsers.length > 1 
				? topUsers[0].xp > topUsers[1].xp
				: true;

			if (hasClearLeader) {
				const currentTopUser = topUsers[0];
				
				if (previousTopUserId) {
					const previousMember = await interaction.guild.members.fetch(previousTopUserId).catch(() => null);
					if (previousMember && previousMember.roles.cache.has(role.id)) {
						await previousMember.roles.remove(role);
					}
				}
				
				const topMember = await interaction.guild.members.fetch(currentTopUser.user_id);
				if (topMember) {
					await topMember.roles.add(role);
					await db.setGuildSetting(guildId, 'top_user_id', currentTopUser.user_id);
				}
			} else if (previousTopUserId) {
				const previousMember = await interaction.guild.members.fetch(previousTopUserId).catch(() => null);
				if (previousMember && previousMember.roles.cache.has(role.id)) {
					await previousMember.roles.remove(role);
					await db.setGuildSetting(guildId, 'top_user_id', null);
				}
			}

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