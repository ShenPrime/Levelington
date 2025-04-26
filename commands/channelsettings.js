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
            ignoredList = ignoredChannels.map(id => {
                const channel = guild.channels.cache.get(id);
                return channel ? `<#${id}> (${channel.name})` : `Unknown (${id})`;
            }).join('\n');
        }

        // Format multipliers
        let multiplierList = 'None';
        const multiplierEntries = Object.entries(channelMultipliers);
        if (multiplierEntries.length > 0) {
            multiplierList = multiplierEntries.map(([id, mult]) => {
                const channel = guild.channels.cache.get(id);
                return channel ? `<#${id}> (${channel.name}): x${mult}` : `Unknown (${id}): x${mult}`;
            }).join('\n');
        }

        const embed = new EmbedBuilder()
            .setTitle('Channel Settings')
            .setColor('#3498db')
            .addFields(
                { name: 'Ignored Channels', value: ignoredList },
                { name: 'XP Multipliers', value: multiplierList }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
