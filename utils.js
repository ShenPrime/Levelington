// Utility functions for the XP Bot

/**
 * Calculates the total XP required to reach a specific level.
 * Formula: 100 * (level ^ 1.5)
 * @param {number} level The target level.
 * @returns {number} The total XP needed for that level.
 */
const xpForLevel = (level) => Math.floor(100 * Math.pow(level, 1.5));

module.exports = {
    xpForLevel,
};