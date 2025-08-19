const camelCase = require('lodash.camelcase');

/**
 * Recursively converts object keys to camelCase
 * @param {object|Array} data
 * @returns {object|Array}
 */
function keysToCamelCase(data) {
    if (Array.isArray(data)) {
        return data.map(keysToCamelCase);
    } else if (data !== null && typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            acc[camelCase(key)] = keysToCamelCase(data[key]);
            return acc;
        }, {});
    }
    return data;
}

function normalizeBooleans(data, booleanFields = []) {
    if (Array.isArray(data)) {
        return data.map(item => normalizeBooleans(item, booleanFields));
    }

    if (data !== null && typeof data === 'object') {
        const result = { ...data };
        for (const key of booleanFields) {
            if (key in result && result[key] !== null && result[key] !== undefined) {
                result[key] = Boolean(result[key]);
            }
        }
        return result;
    }

    return data;
}

module.exports = {
    keysToCamelCase,
    normalizeBooleans
};