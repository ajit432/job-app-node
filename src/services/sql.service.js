const db = require('../config/db.js');
const logger = require('../utils/logger');
const { keysToCamelCase, normalizeBooleans }  = require('../utils/camleFormatters');
const camelCase = require('lodash.camelcase');

/**
 * Executes a SQL query. Can run on the main pool or a specific transaction connection.
 * @param {string} type - The type of query ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'RAW').
 * @param {string} tableOrSql - The table name or the raw SQL string for 'RAW' type.
 * @param {object} options - Options object (e.g., { columns, values, where, data, camelCase, booleanFields }).
 * @param {object} debugMeta - Metadata for logging.
 * @param {object|null} connection - An optional dedicated DB connection for transactions. If null, uses the main pool.
 * @returns {Promise<any>} The result of the query.
 */
exports.executeQuery = async (type, tableOrSql, options = {}, debugMeta = {}, connection = null) => {
    const queryRunner = connection || db;
    let query = '';
    let values = [];

    try {
        if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'RAW'].includes(type.toUpperCase())) {
            logger.logError(`Invalid SQL operation type: ${type}`);
            throw new Error(`Invalid query type: ${type}`);
        }

        switch (type.toUpperCase()) {
            case 'INSERT': {
                const target = tableOrSql;

                if (!Array.isArray(options.values[0])) {
                    const placeholders = options.columns.map(() => '?').join(', ');
                    query = `INSERT INTO ${target} (${options.columns.join(', ')}) VALUES (${placeholders})`;
                    values = options.values;
                } else {
                    const placeholders = options.values.map(
                        () => `(${options.columns.map(() => '?').join(', ')})`
                    ).join(', ');
                    query = `INSERT INTO ${target} (${options.columns.join(', ')}) VALUES ${placeholders}`;
                    values = options.values.flat();
                }

                break;
            }

            case 'UPDATE': {
                const target = tableOrSql;
                const setClause = Object.keys(options.data).map(key => `${key} = ?`).join(', ');
                const whereClause = Object.keys(options.where).map(key => `${key} = ?`).join(' AND ');
                query = `UPDATE ${target} SET ${setClause} WHERE ${whereClause}`;
                values = [...Object.values(options.data), ...Object.values(options.where)];
                break;
            }

            case 'DELETE': {
                const target = tableOrSql;
                const whereDel = Object.keys(options.where).map(key => `${key} = ?`).join(' AND ');
                query = `DELETE FROM ${target} WHERE ${whereDel}`;
                values = Object.values(options.where);
                break;
            }

            case 'SELECT': {
                const target = tableOrSql;
                const columns = options.columns?.length ? options.columns.join(', ') : '*';
                const whereSel = options.where
                    ? ' WHERE ' + Object.keys(options.where).map(key => `${key} = ?`).join(' AND ')
                    : '';
                query = `SELECT ${columns} FROM ${target}${whereSel}`;
                values = options.where ? Object.values(options.where) : [];
                break;
            }

            case 'RAW': {
                query = tableOrSql;
                values = options.values || [];
                break;
            }

            default:
                throw new Error(`Unsupported query type: ${type}`);
        }

        const [result] = await queryRunner.query(query, values);
        let finalResult = options.camelCase ? keysToCamelCase(result) : result;

        // If booleanFields are specified, normalize them
        if ((type === 'SELECT' || type === 'RAW') && Array.isArray(options.booleanFields)) {
            const fields = options.camelCase ? options.booleanFields.map(camelCase) : options.booleanFields;
            finalResult = normalizeBooleans(finalResult, fields);
        }

        return finalResult;

    } catch (err) {
        logger.logError(
            `[DB ERROR] ${debugMeta.controller || 'unknown'} → ${debugMeta.function || 'unknown'}\n` +
            `Query: ${query || 'N/A'}\n` +
            `Values: ${Array.isArray(values) ? JSON.stringify(values) : 'N/A'}\n` +
            `Error: ${err.stack || err}`
        );
        throw err;
    }
};

exports.getConnection = async () => {
    return db.getConnection();
};
