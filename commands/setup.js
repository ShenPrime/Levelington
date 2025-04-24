const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_levelington')
        .setDescription('Sets up the XP bot for this server (Admin Only).')
        .addChannelOption(option =>
            option.setName('level_up_channel')
                .setDescription('The channel where level up announcements should be sent.')
                .addChannelTypes(ChannelType.GuildText) // Only allow text channels
                .setRequired(true))
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

        const guildId = interaction.guild.id;
        const selectedChannel = interaction.options.getChannel('level_up_channel');

        await interaction.deferReply({ ephemeral: true }); // Defer reply as DB operations might take time

        try {
            // 1. Create Schema and Tables for the guild
            await db.createGuildSchemaAndTables(guildId);
            console.log(`Database schema and tables initialized for guild ${guildId} by ${interaction.user.tag}.`);

            // 2. Set the level-up channel setting
            const success = await db.setGuildSetting(guildId, 'level_up_channel_id', selectedChannel.id);

            if (success) {
                const setupEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Setup Complete')
                    .setDescription(`The XP bot has been successfully set up for this server!`)
                    .addFields(
                        { name: 'Level Up Announcements', value: `Will be sent to ${selectedChannel}.` }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [setupEmbed] });
            } else {
                throw new Error('Failed to save level up channel setting.');
            }

        } catch (error) {
            console.error(`Error during setup for guild ${guildId}:`, error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Setup Failed')
                .setDescription('An error occurred during the setup process. Please check the bot logs or try again later.')
                .setTimestamp();
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};