/**
 * Utility functions for formatting API responses
 */

/**
 * Creates a standardized success response
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {Object} pagination - Pagination information
 * @returns {Object} Formatted success response
 */
const successResponse = (message, data = null, pagination = null) => {
    const response = {
        success: true,
        message,
        timestamp: new Date().toISOString()
    };

    if (data !== null) {
        response.data = data;
    }

    if (pagination) {
        response.pagination = {
            currentPage: pagination.currentPage || 1,
            totalPages: pagination.totalPages || 1,
            totalItems: pagination.totalItems || 0,
            itemsPerPage: pagination.itemsPerPage || 10,
            hasNextPage: pagination.hasNextPage || false,
            hasPreviousPage: pagination.hasPreviousPage || false
        };
    }

    return response;
};

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {Array} errors - Array of detailed errors
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Formatted error response
 */
const errorResponse = (message, errors = null, statusCode = 400) => {
    const response = {
        success: false,
        message,
        statusCode,
        timestamp: new Date().toISOString()
    };

    if (errors && errors.length > 0) {
        response.errors = errors;
    }

    return response;
};

/**
 * Creates a validation error response
 * @param {Array} validationErrors - Array of validation errors
 * @returns {Object} Formatted validation error response
 */
const validationErrorResponse = (validationErrors) => {
    return errorResponse(
        'Validation failed',
        validationErrors.map(error => ({
            field: error.param || error.path,
            message: error.msg || error.message,
            value: error.value
        })),
        400
    );
};

/**
 * Creates a pagination object
 * @param {number} currentPage - Current page number
 * @param {number} totalItems - Total number of items
 * @param {number} itemsPerPage - Items per page
 * @returns {Object} Pagination object
 */
const createPagination = (currentPage, totalItems, itemsPerPage) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    return {
        currentPage: parseInt(currentPage),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(itemsPerPage),
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
        startIndex: (currentPage - 1) * itemsPerPage + 1,
        endIndex: Math.min(currentPage * itemsPerPage, totalItems)
    };
};

/**
 * Formats user data for API response (removes sensitive information)
 * @param {Object} user - User object
 * @returns {Object} Sanitized user object
 */
const formatUserForResponse = (user) => {
    if (!user) return null;

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

/**
 * Formats date for API response
 * @param {Date|string} date - Date to format
 * @returns {string} ISO string date
 */
const formatDateForResponse = (date) => {
    if (!date) return null;
    return new Date(date).toISOString();
};

/**
 * Sanitizes array data by removing null/undefined values
 * @param {Array} array - Array to sanitize
 * @returns {Array} Sanitized array
 */
const sanitizeArray = (array) => {
    if (!Array.isArray(array)) return [];
    return array.filter(item => item != null);
};

/**
 * Creates a response for list endpoints with proper formatting
 * @param {Array} items - Array of items
 * @param {string} message - Success message
 * @param {Object} paginationInfo - Pagination information
 * @returns {Object} Formatted list response
 */
const listResponse = (items, message = 'Data retrieved successfully', paginationInfo = null) => {
    const sanitizedItems = sanitizeArray(items);
    
    const response = successResponse(message, sanitizedItems);
    
    if (paginationInfo) {
        response.pagination = createPagination(
            paginationInfo.currentPage,
            paginationInfo.totalItems,
            paginationInfo.itemsPerPage
        );
    }

    response.count = sanitizedItems.length;
    
    return response;
};

/**
 * Creates a response for single item endpoints
 * @param {*} item - Single item
 * @param {string} message - Success message
 * @returns {Object} Formatted single item response
 */
const itemResponse = (item, message = 'Data retrieved successfully') => {
    return successResponse(message, item);
};

/**
 * Creates a response for creation endpoints
 * @param {*} item - Created item
 * @param {string} message - Success message
 * @returns {Object} Formatted creation response
 */
const createdResponse = (item, message = 'Created successfully') => {
    return {
        ...successResponse(message, item),
        statusCode: 201
    };
};

/**
 * Creates a response for update endpoints
 * @param {*} item - Updated item (optional)
 * @param {string} message - Success message
 * @returns {Object} Formatted update response
 */
const updatedResponse = (item = null, message = 'Updated successfully') => {
    return successResponse(message, item);
};

/**
 * Creates a response for deletion endpoints
 * @param {string} message - Success message
 * @returns {Object} Formatted deletion response
 */
const deletedResponse = (message = 'Deleted successfully') => {
    return successResponse(message);
};

/**
 * Handles common HTTP error status codes
 * @param {number} statusCode - HTTP status code
 * @param {string} customMessage - Custom error message
 * @returns {Object} Formatted error response
 */
const httpErrorResponse = (statusCode, customMessage = null) => {
    const defaultMessages = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        409: 'Conflict',
        422: 'Unprocessable Entity',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        503: 'Service Unavailable'
    };

    const message = customMessage || defaultMessages[statusCode] || 'An error occurred';
    
    return errorResponse(message, null, statusCode);
};

/**
 * Formats file upload response
 * @param {Object} fileInfo - File information
 * @param {string} message - Success message
 * @returns {Object} Formatted file upload response
 */
const fileUploadResponse = (fileInfo, message = 'File uploaded successfully') => {
    return successResponse(message, {
        filename: fileInfo.filename,
        originalName: fileInfo.originalname,
        size: fileInfo.size,
        mimeType: fileInfo.mimetype,
        url: fileInfo.url || fileInfo.path
    });
};

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    createPagination,
    formatUserForResponse,
    formatDateForResponse,
    sanitizeArray,
    listResponse,
    itemResponse,
    createdResponse,
    updatedResponse,
    deletedResponse,
    httpErrorResponse,
    fileUploadResponse
};
