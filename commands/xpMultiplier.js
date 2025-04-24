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

        try {
            // Get current multipliers
            const settings = await db.getGuildSettings(guildId);
            let multipliers = settings.channel_multipliers ? JSON.parse(settings.channel_multipliers) : {};

            // Update multiplier
            multipliers[channel.id] = multiplier;

            // Update database
            await db.setGuildSetting(guildId, 'channel_multipliers', JSON.stringify(multipliers));

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Channel XP Multiplier Updated`)
                .setDescription(`${channel} now has a ${multiplier}x XP multiplier`)
                .addFields(
                    { name: 'Channel', value: `${channel}`, inline: true },
                    { name: 'Multiplier', value: `${multiplier}x`, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Error updating channel multiplier:', error);
            await interaction.reply({ content: 'Failed to update channel multiplier.', ephemeral: true });
        }
    }
};