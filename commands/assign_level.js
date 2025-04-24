const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { xpForLevel } = require('../utils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('assign_level')
        .setDescription('Manually assigns a level to a user (Admin Only).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose level you want to set.')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The level to assign to the user (must be 0 or greater).')
                .setRequired(true)
                .setMinValue(0)) // Ensure level is not negative
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator) // Only admins can run this
        .setDMPermission(false), // Command cannot be used in DMs

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        // Double-check permissions (though defaultMemberPermissions should handle this)
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You need Administrator permissions to run this command.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');
        const targetLevel = interaction.options.getInteger('level');
        const guildId = interaction.guild.id;

        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot assign levels to bots.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if the guild is set up first
            const guildSettings = await db.getGuildSettings(guildId);
            if (!guildSettings) {
                return interaction.editReply({ content: 'The XP bot has not been set up for this server yet. Use `/setup` first.', ephemeral: true });
            }

            const xpValue = xpForLevel(targetLevel);
const success = await db.setUserLevel(targetUser.id, guildId, targetLevel, xpValue);

            if (success) {
                const successEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Level Assigned')
                    .setDescription(`Successfully set ${targetUser.tag}'s level to **${targetLevel}**.`) // Use tag for clarity
                    .setTimestamp();
                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                // Check if the failure was due to the guild not being set up (though checked above, good failsafe)
                const checkAgain = await db.getGuildSettings(guildId);
                if (!checkAgain) {
                     return interaction.editReply({ content: 'The XP bot has not been set up for this server yet. Use `/setup` first.', ephemeral: true });
                }
                // Otherwise, a general DB error occurred
                throw new Error('Failed to update user level in the database.');
            }

        } catch (error) {
            console.error(`Error assigning level for user ${targetUser.id} in guild ${guildId}:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error Assigning Level')
                .setDescription('An error occurred while trying to assign the level. Please check the bot logs or try again later.')
                .setTimestamp();
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};