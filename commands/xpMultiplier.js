const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xp_multiplier')
        .setDescription('Set XP multiplier for a channel')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to modify XP multiplier')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('multiplier')
                .setDescription('XP multiplier (0.1-10.0)')
                .setRequired(true)
                .setMinValue(0.1)
                .setMaxValue(10.0))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const multiplier = interaction.options.getNumber('multiplier');
        const guildId = interaction.guild.id;

        // Defer reply immediately to avoid timeout
        await interaction.deferReply({ flags: 64 });

        try {
            // Get current multipliers and ignored channels
            const settings = await db.getGuildSettings(guildId);
            let multipliers = settings.channel_multipliers ? JSON.parse(settings.channel_multipliers) : {};
            const ignoredChannels = settings.ignored_channels ? settings.ignored_channels.split(',').filter(id => id.trim() !== '') : [];

            let channelsToUpdate = [];
            let description = '';

            // Handle category channels
            if (channel.type === 4) { // Category channel
                // Get all channels in this category
                const categoryChannels = interaction.guild.channels.cache.filter(c => c.parentId === channel.id);
                channelsToUpdate = categoryChannels.map(c => c.id);
                
                // Also include the category itself in multipliers
                channelsToUpdate.push(channel.id);
                description = `${channel.name} category and ${categoryChannels.length} channels`;
            } else {
                channelsToUpdate = [channel.id];
                description = `${channel}`;
            }

            // Update multipliers for all channels and remove from ignore list
            let updatedCount = 0;
            for (const channelId of channelsToUpdate) {
                multipliers[channelId] = multiplier;
                updatedCount++;
                
                // Remove from ignored channels if getting multiplier
                const ignoreIndex = ignoredChannels.indexOf(channelId);
                if (ignoreIndex > -1) {
                    ignoredChannels.splice(ignoreIndex, 1);
                    console.log(`[Multiplier] Removing ignore for channel ${channelId} - channel now has multiplier`);
                }
            }

            // Update both multipliers and ignored channels
            await db.setGuildSetting(guildId, 'channel_multipliers', JSON.stringify(multipliers));
            await db.setGuildSetting(guildId, 'ignored_channels', ignoredChannels.join(','));

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Channel XP Multiplier Updated`)
                .setDescription(`${description} now have a ${multiplier}x XP multiplier`)
                .addFields(
                    { name: 'Channels Updated', value: `${updatedCount}`, inline: true },
                    { name: 'Multiplier', value: `${multiplier}x`, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error updating channel multiplier:', error);
            
            // Check if interaction has expired
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: 'Failed to update channel multiplier.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Failed to update channel multiplier.', flags: 64 });
            }
        }
    }
};