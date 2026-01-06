const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channelsettings')
        .setDescription('Lists ignored channels and channels with XP multipliers in this server.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guild = interaction.guild;
        const settings = await db.getGuildSettings(guildId);
        if (!settings) {
            return interaction.reply({ content: 'No settings found for this server. Please run /setup first.', ephemeral: true });
        }

        // Ignored channels
        let ignoredChannels = [];
        if (settings.ignored_channels) {
            ignoredChannels = settings.ignored_channels.split(',').filter(Boolean);
        }

        // Channel multipliers
        let channelMultipliers = {};
        if (settings.channel_multipliers) {
            try {
                channelMultipliers = JSON.parse(settings.channel_multipliers);
            } catch (e) {
                channelMultipliers = {};
            }
        }

        // Format ignored channels
        let ignoredList = 'None';
        if (ignoredChannels.length > 0) {
            // Separate categories and individual channels
            const categories = [];
            const individualChannels = [];
            
            ignoredChannels.forEach(id => {
                const channel = guild.channels.cache.get(id);
                if (channel) {
                    if (channel.type === 4) { // Category
                        categories.push({
                            id,
                            name: channel.name,
                            channels: []
                        });
                    } else { // Individual channel
                        individualChannels.push({ id, name: channel.name, parentId: channel.parentId });
                    }
                } else {
                    individualChannels.push({ id, name: `Unknown (${id})`, parentId: null });
                }
            });
            
            // Group individual channels under their categories
            const lines = [];
            
            // Add categories first
            categories.forEach(category => {
                lines.push(`**${category.name}** (Category - All channels ignored)`);
                
                // Find channels belonging to this category
                const categoryChannels = individualChannels.filter(ch => ch.parentId === category.id);
                categoryChannels.forEach(ch => {
                    lines.push(`  └─ <#${ch.id}> (${ch.name})`);
                });
            });
            
            // Add individual channels that don't belong to any listed category
            const orphanedChannels = individualChannels.filter(ch => {
                return !categories.some(cat => cat.id === ch.parentId);
            });
            
            if (orphanedChannels.length > 0) {
                orphanedChannels.forEach(ch => {
                    lines.push(`<#${ch.id}> (${ch.name})`);
                });
            }
            
            ignoredList = lines.length > 0 ? lines.join('\n') : 'None';
        }

        // Format multipliers
        let multiplierList = 'None';
        const multiplierEntries = Object.entries(channelMultipliers);
        if (multiplierEntries.length > 0) {
            // Filter out default (1x) multipliers
            const nonDefaultMultipliers = multiplierEntries.filter(([id, mult]) => mult !== 1);
            
            if (nonDefaultMultipliers.length > 0) {
                // Separate categories and individual channels
                const categories = [];
                const individualChannels = [];
                
                nonDefaultMultipliers.forEach(([id, mult]) => {
                    const channel = guild.channels.cache.get(id);
                    if (channel) {
                        if (channel.type === 4) { // Category
                            categories.push({ id, name: channel.name, multiplier: mult });
                        } else { // Individual channel
                            individualChannels.push({ id, name: channel.name, parentId: channel.parentId, multiplier: mult });
                        }
                    } else {
                        individualChannels.push({ id, name: `Unknown (${id})`, parentId: null, multiplier: mult });
                    }
                });
                
                // Group individual channels under their categories
                const lines = [];
                
                // Add categories first
                categories.forEach(category => {
                    lines.push(`**${category.name}** (Category - ${category.multiplier}x multiplier for all channels)`);
                    
                    // Find channels belonging to this category
                    const categoryChannels = individualChannels.filter(ch => ch.parentId === category.id);
                    categoryChannels.forEach(ch => {
                        lines.push(`  └─ <#${ch.id}> (${ch.name}): x${ch.multiplier}`);
                    });
                });
                
                // Add individual channels that don't belong to any listed category
                const orphanedChannels = individualChannels.filter(ch => {
                    return !categories.some(cat => cat.id === ch.parentId);
                });
                
                if (orphanedChannels.length > 0) {
                    orphanedChannels.forEach(ch => {
                        lines.push(`<#${ch.id}> (${ch.name}): x${ch.multiplier}`);
                    });
                }
                
                lines.push('\n*All other channels have default 1x multiplier*');
                multiplierList = lines.join('\n');
            } else {
                multiplierList = '*All channels have default 1x multiplier*';
            }
        } else {
            multiplierList = '*All channels have default 1x multiplier*';
        }

        const embed = new EmbedBuilder()
            .setTitle('Channel Settings')
            .setColor('#3498db')
            .addFields(
                { name: 'Ignored Channels', value: ignoredList },
                { name: 'XP Multipliers', value: multiplierList }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: 64 });
    },
};
