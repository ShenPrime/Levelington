const { SlashCommandBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete_server_data')
        .setDescription('Delete ALL server data including XP records and settings (ADMIN ONLY)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const confirmEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ **DANGER ZONE** ⚠️')
            .setDescription('This will **PERMANENTLY DELETE** all server data:\n- User XP records\n- Server settings\n- Leaderboard history\n\n**This action cannot be undone!**');

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_delete')
            .setLabel('CONFIRM DELETION')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_delete')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(cancelButton, confirmButton);

        const response = await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            ephemeral: true
        });

        const filter = i => i.user.id === interaction.user.id;
        try {
            const confirmation = await response.awaitMessageComponent({ filter, time: 60_000 });

            if (confirmation.customId === 'confirm_delete') {
                await db.deleteGuildSchema(interaction.guild.id);
                await confirmation.update({
                    content: '✅ All server data has been permanently deleted',
                    embeds: [],
                    components: []
                });
            } else {
                await confirmation.update({
                    content: '❌ Data deletion cancelled',
                    embeds: [],
                    components: []
                });
            }
        } catch (err) {
            await interaction.editReply({
                content: '⚠️ Deletion confirmation timed out',
                embeds: [],
                components: []
            });
        }
    }
};