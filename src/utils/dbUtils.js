const sqlService = require('../services/sql.service');
const logger = require('./logger');

/**
 * Executes a transaction with rollback support
 * @param {Function} transactionCallback - Callback function containing transaction operations
 * @returns {Promise} Transaction result
 */
const executeTransaction = async (transactionCallback) => {
    const connection = await sqlService.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const result = await transactionCallback(connection);
        
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        logger.logError('Transaction rolled back due to error:', error);
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Builds WHERE clause with proper parameter binding
 * @param {Object} conditions - Conditions object
 * @returns {Object} WHERE clause and parameters
 */
const buildWhereClause = (conditions) => {
    if (!conditions || Object.keys(conditions).length === 0) {
        return { whereClause: '', params: [] };
    }

    const clauses = [];
    const params = [];

    Object.entries(conditions).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            if (typeof value === 'object' && value.operator) {
                // Handle operators like { operator: '>', value: 100 }
                clauses.push(`${key} ${value.operator} ?`);
                params.push(value.value);
            } else if (Array.isArray(value)) {
                // Handle IN operations
                const placeholders = value.map(() => '?').join(',');
                clauses.push(`${key} IN (${placeholders})`);
                params.push(...value);
            } else {
                clauses.push(`${key} = ?`);
                params.push(value);
            }
        } else if (value === null) {
            clauses.push(`${key} IS NULL`);
        }
    });

    return {
        whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
};

/**
 * Builds ORDER BY clause
 * @param {Object|Array} orderBy - Order by configuration
 * @returns {string} ORDER BY clause
 */
const buildOrderByClause = (orderBy) => {
    if (!orderBy) return '';

    if (Array.isArray(orderBy)) {
        const orderClauses = orderBy.map(order => {
            if (typeof order === 'string') {
                return order;
            }
            return `${order.field} ${order.direction || 'ASC'}`;
        });
        return `ORDER BY ${orderClauses.join(', ')}`;
    }

    if (typeof orderBy === 'string') {
        return `ORDER BY ${orderBy}`;
    }

    if (typeof orderBy === 'object') {
        const orderClauses = Object.entries(orderBy).map(([field, direction]) => {
            return `${field} ${direction || 'ASC'}`;
        });
        return `ORDER BY ${orderClauses.join(', ')}`;
    }

    return '';
};

/**
 * Builds LIMIT and OFFSET clause for pagination
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Object} Limit clause and offset value
 */
const buildPaginationClause = (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    return {
        limitClause: `LIMIT ${limit} OFFSET ${offset}`,
        offset,
        limit: parseInt(limit)
    };
};

/**
 * Counts total records for pagination
 * @param {string} tableName - Table name
 * @param {Object} conditions - WHERE conditions
 * @returns {Promise<number>} Total count
 */
const getTotalCount = async (tableName, conditions = {}) => {
    const { whereClause, params } = buildWhereClause(conditions);
    const query = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
    
    const [result] = await sqlService.executeQuery('RAW', query, 
        { values: params }, 
        { controller: 'dbUtils', function: 'getTotalCount' });
    
    return result.total;
};

/**
 * Generic find with pagination
 * @param {string} tableName - Table name
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Results with pagination info
 */
const findWithPagination = async (tableName, options = {}) => {
    const {
        conditions = {},
        select = '*',
        orderBy = 'id DESC',
        page = 1,
        limit = 10,
        joins = []
    } = options;

    // Build query parts
    const { whereClause, params } = buildWhereClause(conditions);
    const orderByClause = buildOrderByClause(orderBy);
    const { limitClause } = buildPaginationClause(page, limit);
    
    // Build JOIN clauses
    const joinClause = joins.length > 0 ? joins.join(' ') : '';

    // Get total count for pagination
    const totalItems = await getTotalCount(tableName, conditions);
    
    // Build and execute main query
    const query = `
        SELECT ${select} 
        FROM ${tableName} 
        ${joinClause}
        ${whereClause} 
        ${orderByClause} 
        ${limitClause}
    `.trim();

    const results = await sqlService.executeQuery('RAW', query, 
        { values: params }, 
        { controller: 'dbUtils', function: 'findWithPagination' });

    return {
        data: results,
        pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalItems / limit),
            totalItems,
            itemsPerPage: parseInt(limit),
            hasNextPage: page < Math.ceil(totalItems / limit),
            hasPreviousPage: page > 1
        }
    };
};

/**
 * Generic exists check
 * @param {string} tableName - Table name
 * @param {Object} conditions - Conditions to check
 * @returns {Promise<boolean>} Whether record exists
 */
const exists = async (tableName, conditions) => {
    const { whereClause, params } = buildWhereClause(conditions);
    const query = `SELECT 1 FROM ${tableName} ${whereClause} LIMIT 1`;
    
    const results = await sqlService.executeQuery('RAW', query, 
        { values: params }, 
        { controller: 'dbUtils', function: 'exists' });
    
    return results.length > 0;
};

/**
 * Generic soft delete (sets deleted_at timestamp)
 * @param {string} tableName - Table name
 * @param {Object} conditions - Conditions for deletion
 * @returns {Promise<number>} Number of affected rows
 */
const softDelete = async (tableName, conditions) => {
    const { whereClause, params } = buildWhereClause(conditions);
    const query = `UPDATE ${tableName} SET deleted_at = NOW() ${whereClause}`;
    
    const result = await sqlService.executeQuery('RAW', query, 
        { values: params }, 
        { controller: 'dbUtils', function: 'softDelete' });
    
    return result.affectedRows || 0;
};

/**
 * Bulk insert with error handling
 * @param {string} tableName - Table name
 * @param {Array} records - Array of records to insert
 * @param {Array} columns - Column names
 * @returns {Promise<Array>} Array of inserted IDs
 */
const bulkInsert = async (tableName, records, columns) => {
    if (!records || records.length === 0) {
        return [];
    }

    const placeholders = records.map(() => 
        `(${columns.map(() => '?').join(',')})`
    ).join(',');

    const values = records.flatMap(record => 
        columns.map(col => record[col])
    );

    const query = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${placeholders}`;
    
    const result = await sqlService.executeQuery('RAW', query, 
        { values }, 
        { controller: 'dbUtils', function: 'bulkInsert' });

    // Return array of inserted IDs
    const insertIds = [];
    for (let i = 0; i < records.length; i++) {
        insertIds.push(result.insertId + i);
    }
    
    return insertIds;
};

/**
 * Search with full-text search capabilities
 * @param {string} tableName - Table name
 * @param {Object} searchOptions - Search configuration
 * @returns {Promise<Array>} Search results
 */
const searchRecords = async (tableName, searchOptions) => {
    const {
        searchTerm,
        searchFields = [],
        conditions = {},
        orderBy = 'id DESC',
        page = 1,
        limit = 10
    } = searchOptions;

    let { whereClause, params } = buildWhereClause(conditions);
    
    // Add search conditions
    if (searchTerm && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => `${field} LIKE ?`).join(' OR ');
        const searchClause = `(${searchConditions})`;
        
        if (whereClause) {
            whereClause += ` AND ${searchClause}`;
        } else {
            whereClause = `WHERE ${searchClause}`;
        }
        
        // Add search parameters for each field
        searchFields.forEach(() => {
            params.push(`%${searchTerm}%`);
        });
    }

    const orderByClause = buildOrderByClause(orderBy);
    const { limitClause } = buildPaginationClause(page, limit);

    const query = `
        SELECT * FROM ${tableName} 
        ${whereClause} 
        ${orderByClause} 
        ${limitClause}
    `.trim();

    return await sqlService.executeQuery('RAW', query, 
        { values: params }, 
        { controller: 'dbUtils', function: 'searchRecords' });
};

/**
 * Updates records with optimistic locking (version check)
 * @param {string} tableName - Table name
 * @param {Object} updateData - Data to update
 * @param {Object} conditions - Update conditions
 * @param {number} expectedVersion - Expected version for optimistic locking
 * @returns {Promise<boolean>} Whether update was successful
 */
const updateWithVersion = async (tableName, updateData, conditions, expectedVersion) => {
    const updateConditions = { ...conditions, version: expectedVersion };
    const newUpdateData = { ...updateData, version: expectedVersion + 1 };

    const { whereClause, params: whereParams } = buildWhereClause(updateConditions);
    
    const updateFields = Object.keys(newUpdateData).map(key => `${key} = ?`).join(', ');
    const updateParams = Object.values(newUpdateData);

    const query = `UPDATE ${tableName} SET ${updateFields} ${whereClause}`;
    const allParams = [...updateParams, ...whereParams];

    const result = await sqlService.executeQuery('RAW', query, 
        { values: allParams }, 
        { controller: 'dbUtils', function: 'updateWithVersion' });

    return (result.affectedRows || 0) > 0;
};

module.exports = {
    executeTransaction,
    buildWhereClause,
    buildOrderByClause,
    buildPaginationClause,
    getTotalCount,
    findWithPagination,
    exists,
    softDelete,
    bulkInsert,
    searchRecords,
    updateWithVersion
};
