const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, Permi } = require('discord.js');
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

        try {
            // Get current ignored channels
            const settings = await db.getGuildSettings(guildId);
            let ignoredChannels = settings.ignored_channels ? settings.ignored_channels.split(',') : [];

            // Toggle channel in list
            const index = ignoredChannels.indexOf(channel.id);
            if (index > -1) {
                ignoredChannels.splice(index, 1);
            } else {
                ignoredChannels.push(channel.id);
            }

            // Update database
            await db.setGuildSetting(guildId, 'ignored_channels', ignoredChannels.join(','));

            const action = index > -1 ? 'removed from' : 'added to';
            const embed = new EmbedBuilder()
                .setColor(index > -1 ? '#00FF00' : '#FF0000')
                .setTitle(`Channel ${action} ignore list`)
                .setDescription(`${channel} has been ${action} XP ignoring.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error updating ignored channels:', error);
            await interaction.reply({ content: 'Failed to update channel ignore status.', ephemeral: true });
        }
    }
};