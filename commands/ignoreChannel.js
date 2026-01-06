const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ignore_channel')
        .setDescription('Add/remove channel from XP ignore list')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to toggle XP ignoring')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;

        // Defer reply immediately to avoid timeout
        await interaction.deferReply({ flags: 64 });

        try {
            // Get current ignored channels and multipliers
            const settings = await db.getGuildSettings(guildId);
            let ignoredChannels = settings.ignored_channels ? settings.ignored_channels.split(',').filter(id => id.trim() !== '') : [];
            const multipliers = settings.channel_multipliers ? JSON.parse(settings.channel_multipliers) : {};

            let channelsToToggle = [];
            let description = '';

            // Handle category channels
            if (channel.type === 4) { // Category channel
                // Get all channels in this category
                const categoryChannels = interaction.guild.channels.cache.filter(c => c.parentId === channel.id);
                channelsToToggle = categoryChannels.map(c => c.id);
                
                // Also include category itself in ignore list
                channelsToToggle.push(channel.id);
                description = `${channel.name} category and ${categoryChannels.length} channels`;
            } else {
                channelsToToggle = [channel.id];
                description = `${channel}`;
            }

            // Toggle channels in list and remove from multipliers if being ignored
            let addedCount = 0;
            let removedCount = 0;
            
            for (const channelId of channelsToToggle) {
                const index = ignoredChannels.indexOf(channelId);
                if (index > -1) {
                    ignoredChannels.splice(index, 1);
                    removedCount++;
                } else {
                    ignoredChannels.push(channelId);
                    addedCount++;
                }
                
                // Remove from multipliers if being ignored
                if (multipliers[channelId]) {
                    delete multipliers[channelId];
                    console.log(`[Ignore] Removing multiplier for channel ${channelId} - channel is now ignored`);
                }
            }

            // Update both ignored channels and multipliers
            await db.setGuildSetting(guildId, 'ignored_channels', ignoredChannels.join(','));
            if (Object.keys(multipliers).length > 0) {
                await db.setGuildSetting(guildId, 'channel_multipliers', JSON.stringify(multipliers));
            }

            let action;
            if (addedCount > 0 && removedCount === 0) {
                action = 'added to';
            } else if (removedCount > 0 && addedCount === 0) {
                action = 'removed from';
            } else {
                action = 'updated in';
            }

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle(`Channel ${action} ignore list`)
                .setDescription(`${description} has been ${action} XP ignoring.\nAdded: ${addedCount} | Removed: ${removedCount}`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], flags: 64 });
        } catch (error) {
            console.error('Error updating ignored channels:', error);
            
            // Check if interaction has expired
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: 'Failed to update channel ignore status.', flags: 64 });
            } else {
                await interaction.reply({ content: 'Failed to update channel ignore status.', flags: 64 });
            }
        }
    }
};