// Helps prevent null values in the response by always returning the default value for each field's data type

function sanitizeValue(value, type = 'string') {
    if (value === null || value === undefined) {
        switch (type) {
            case 'number': return 0;
            case 'boolean': return false;
            case 'date': return  null;
            case 'string': return null;
            default: return null;
        }
    }
        if (type === 'boolean') {
        // Normalize booleans like 1, 0, "true", "false", true, false
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value === 1;
        if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
        return false;
    }
    return value;
}

module.exports = { sanitizeValue };
