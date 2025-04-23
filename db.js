require('dotenv').config(); // Load .env file at the top
// Database connection and functions

const { Pool } = require('pg');
const { xpForLevel } = require('./utils'); // Import the utility function

// Use database connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Optional: Add SSL configuration if needed for your database provider
  // ssl: {
  //   rejectUnauthorized: false // Adjust based on your provider's requirements
  // }
});

pool.on('connect', () => {
  console.log('Connected to the database!');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Helper to get schema name
const getSchemaName = (guildId) => `guild_${guildId}`;

// Function to create guild-specific schema and tables
const createGuildSchemaAndTables = async (guildId) => {
    const schemaName = getSchemaName(guildId);
    const client = await pool.connect();
    try {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName};`);
        console.log(`Schema ${schemaName} created or already exists.`);

        // Create users table within the schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.users (
              user_id VARCHAR(255) NOT NULL,
              xp INT DEFAULT 0,
              level INT DEFAULT 0,
              last_message_timestamp BIGINT DEFAULT 0,
              PRIMARY KEY (user_id) -- User ID is unique within a guild
            );
        `);
        console.log(`Table ${schemaName}.users created or already exists.`);

        // Create settings table within the schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS ${schemaName}.settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value VARCHAR(255)
            );
        `);
         // Add default settings if needed, e.g., level_up_channel_id
        await client.query(`
            INSERT INTO ${schemaName}.settings (setting_key, setting_value)
            VALUES ('level_up_channel_id', NULL)
            ON CONFLICT (setting_key) DO NOTHING;
        `);
        console.log(`Table ${schemaName}.settings created or already exists.`);

    } catch (err) {
        console.error(`Error initializing schema/tables for guild ${guildId}:`, err.stack);
        throw err; // Re-throw error to be handled by caller
    } finally {
        client.release();
    }
};

// Function to get guild settings
const getGuildSettings = async (guildId) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `SELECT setting_key, setting_value FROM ${schemaName}.settings;`;
    try {
        // Check if schema exists first to avoid errors on non-setup guilds
        const schemaCheck = await pool.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1;`, [schemaName]);
        if (schemaCheck.rowCount === 0) {
            // console.log(`Schema ${schemaName} does not exist. Guild not set up.`);
            return null; // Indicate guild is not set up
        }

        const res = await pool.query(queryText);
        const settings = {};
        res.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        // Ensure essential keys exist, even if null
        if (!settings.hasOwnProperty('level_up_channel_id')) {
            settings.level_up_channel_id = null;
        }
        return settings;
    } catch (err) {
        // Handle specific error for relation not existing if schema exists but table doesn't (shouldn't happen with createGuildSchemaAndTables)
        if (err.code === '42P01') { // undefined_table
             console.warn(`Settings table not found for guild ${guildId} (Schema: ${schemaName}). Might need setup.`);
             return null;
        }
        console.error(`Error fetching settings for guild ${guildId}:`, err.stack);
        return null;
    }
};

// Function to set a specific guild setting
const setGuildSetting = async (guildId, key, value) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `
        INSERT INTO ${schemaName}.settings (setting_key, setting_value)
        VALUES ($1, $2)
        ON CONFLICT (setting_key)
        DO UPDATE SET setting_value = $2;
    `;
    try {
        await pool.query(queryText, [key, value]);
        console.log(`Setting '${key}' updated for guild ${guildId}.`);
        return true;
    } catch (err) {
        console.error(`Error setting '${key}' for guild ${guildId}:`, err.stack);
        return false;
    }
};


// Function to get user data from the correct schema
const getUser = async (userId, guildId) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `SELECT * FROM ${schemaName}.users WHERE user_id = $1`;
    try {
        const res = await pool.query(queryText, [userId]);
        return res.rows[0]; // Returns the user row or undefined
    } catch (err) {
         // If the table doesn't exist (e.g., guild not set up), return null
        if (err.code === '42P01') { // undefined_table
            // console.warn(`Users table not found for guild ${guildId}. Guild might not be set up.`);
            return null;
        }
        console.error(`Error fetching user ${userId} in guild ${guildId}:`, err.stack);
        return null;
    }
};

// Function to update or insert user data in the correct schema
const updateUser = async (userId, guildId, xpToAdd, currentTimestamp) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `
    INSERT INTO ${schemaName}.users (user_id, xp, last_message_timestamp, level) -- Ensure level is included if needed on insert
    VALUES ($1, $2, $3, 0) -- Start at level 0 if inserting
    ON CONFLICT (user_id)
    DO UPDATE SET
      xp = ${schemaName}.users.xp + $2,
      last_message_timestamp = $3
    RETURNING xp, level;
  `;
    try {
        const res = await pool.query(queryText, [userId, xpToAdd, currentTimestamp]);
        return res.rows[0]; // Returns the updated xp and level
    } catch (err) {
        // If the table doesn't exist (e.g., guild not set up), return null
        if (err.code === '42P01') { // undefined_table
            // console.warn(`Users table not found for guild ${guildId} during update. Guild might not be set up.`);
            return null;
        }
        console.error(`Error updating user ${userId} XP in guild ${guildId}:`, err.stack);
        return null;
    }
};

// Function to update user level in the correct schema
const updateUserLevel = async (userId, guildId, newLevel) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `
        UPDATE ${schemaName}.users
        SET level = $2
        WHERE user_id = $1;
    `;
    try {
        await pool.query(queryText, [userId, newLevel]);
    } catch (err) {
        // If the table doesn't exist (e.g., guild not set up), log warning
        if (err.code === '42P01') { // undefined_table
            console.warn(`Users table not found for guild ${guildId} during level update. Guild might not be set up.`);
            return; // Don't throw, just can't update
        }
        console.error(`Error updating user ${userId} level in guild ${guildId}:`, err.stack);
    }
};

// Function to get leaderboard data for a specific guild
const getLeaderboard = async (guildId, limit = 10) => {
    const schemaName = getSchemaName(guildId);
    const queryText = `
        SELECT user_id, xp, level
        FROM ${schemaName}.users
        ORDER BY xp DESC
        LIMIT $1;
    `;
    try {
        const res = await pool.query(queryText, [limit]);
        return res.rows;
    } catch (err) {
        // If the table doesn't exist (e.g., guild not set up), return empty array
        if (err.code === '42P01') { // undefined_table
            // console.warn(`Users table not found for guild ${guildId} when fetching leaderboard. Guild might not be set up.`);
            return [];
        }
        console.error(`Error fetching leaderboard for guild ${guildId}:`, err.stack);
        return []; // Return empty array on error
    }
};


module.exports = {
  pool,
  // initializeDB, // No longer needed globally
  createGuildSchemaAndTables,
  getGuildSettings,
  setGuildSetting,
  getUser,
  updateUser,
  updateUserLevel,
  setUserLevel, // Add the new function
  getLeaderboard
};