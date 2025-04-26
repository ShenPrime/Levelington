// Utility functions for the XP Bot

/**
 * Calculates the total XP required to reach a specific level.
 * Formula: 100 * (level ^ 1.5)
 * @param {number} level The target level.
 * @returns {number} The total XP needed for that level.
 */
const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

/**
 * Assigns the 'Biggest Yapper' role to the top user in the guild based on XP leaderboard.
 * Removes the role from the previous holder if necessary.
 *
 * @param {Guild} guild - The Discord guild object
 * @param {Object} db - The database module
 */
async function updateBiggestYapperRole(guild, db) {
    const guildId = guild.id;
    const roleName = 'Biggest Yapper';
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        role = await guild.roles.create({
            name: roleName,
            color: '#FFD700',
            reason: 'Automatically created for XP leaderboard top user'
        });
    }
    const topUsers = await db.getLeaderboard(guildId, 10);
    if (!topUsers || topUsers.length === 0) return;
    const settings = await db.getGuildSettings(guildId);
    const previousTopUserId = settings?.top_user_id;
    const hasClearLeader = topUsers.length > 1 
        ? topUsers[0].xp > topUsers[1].xp
        : true;
    if (hasClearLeader) {
        const currentTopUser = topUsers[0];
        if (previousTopUserId) {
            const previousMember = await guild.members.fetch(previousTopUserId).catch(() => null);
            if (previousMember && previousMember.roles.cache.has(role.id)) {
                await previousMember.roles.remove(role);
            }
        }
        const topMember = await guild.members.fetch(currentTopUser.user_id).catch(() => null);
        if (topMember) {
            await topMember.roles.add(role);
            await db.setGuildSetting(guildId, 'top_user_id', currentTopUser.user_id);
        }
    } else if (previousTopUserId) {
        const previousMember = await guild.members.fetch(previousTopUserId).catch(() => null);
        if (previousMember && previousMember.roles.cache.has(role.id)) {
            await previousMember.roles.remove(role);
            await db.setGuildSetting(guildId, 'top_user_id', null);
        }
    }
}

module.exports = {
    xpForLevel,
    updateBiggestYapperRole,
};