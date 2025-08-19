const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Ensures a directory exists, creates it if it doesn't
 * @param {string} dirPath - The directory path to ensure
 */
const ensureDirectoryExists = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (error) {
        await fs.mkdir(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
    }
};

/**
 * Generates a unique filename with extension
 * @param {string} originalName - Original filename
 * @returns {string} Unique filename
 */
const generateUniqueFileName = (originalName) => {
    const extension = path.extname(originalName);
    const uniqueId = uuidv4();
    return `${uniqueId}${extension}`;
};

/**
 * Gets the file extension from a filename
 * @param {string} filename - The filename
 * @returns {string} File extension without dot
 */
const getFileExtension = (filename) => {
    return path.extname(filename).slice(1).toLowerCase();
};

/**
 * Checks if file type is allowed
 * @param {string} filename - The filename
 * @param {Array} allowedTypes - Array of allowed extensions
 * @returns {boolean} Whether file type is allowed
 */
const isFileTypeAllowed = (filename, allowedTypes) => {
    const extension = getFileExtension(filename);
    return allowedTypes.includes(extension);
};

/**
 * Formats file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Deletes a file if it exists
 * @param {string} filePath - Path to the file
 */
const deleteFileIfExists = async (filePath) => {
    try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        logger.info(`Deleted file: ${filePath}`);
    } catch (error) {
        // File doesn't exist or couldn't be deleted
        logger.warn(`Could not delete file: ${filePath}`);
    }
};

/**
 * Moves a file from source to destination
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination file path
 */
const moveFile = async (sourcePath, destinationPath) => {
    try {
        await ensureDirectoryExists(path.dirname(destinationPath));
        await fs.rename(sourcePath, destinationPath);
        logger.info(`Moved file from ${sourcePath} to ${destinationPath}`);
    } catch (error) {
        logger.logError(`Error moving file: ${error.message}`);
        throw error;
    }
};

/**
 * Gets file information
 * @param {string} filePath - Path to the file
 * @returns {Object} File information
 */
const getFileInfo = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            formattedSize: formatFileSize(stats.size),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory()
        };
    } catch (error) {
        throw new Error(`Could not get file info: ${error.message}`);
    }
};

/**
 * Validates uploaded file
 * @param {Object} file - Multer file object
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
const validateUploadedFile = (file, options = {}) => {
    const {
        maxSize = 10 * 1024 * 1024, // 10MB default
        allowedTypes = [],
        required = true
    } = options;

    const errors = [];

    if (required && !file) {
        errors.push('File is required');
        return { isValid: false, errors };
    }

    if (!file) {
        return { isValid: true, errors: [] };
    }

    // Check file size
    if (file.size > maxSize) {
        errors.push(`File size exceeds limit. Maximum allowed: ${formatFileSize(maxSize)}`);
    }

    // Check file type
    if (allowedTypes.length > 0 && !isFileTypeAllowed(file.originalname, allowedTypes)) {
        errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        fileInfo: {
            originalName: file.originalname,
            size: file.size,
            formattedSize: formatFileSize(file.size),
            mimeType: file.mimetype,
            extension: getFileExtension(file.originalname)
        }
    };
};

/**
 * Cleans up old files in a directory
 * @param {string} directoryPath - Directory to clean
 * @param {number} maxAgeHours - Maximum age in hours
 */
const cleanupOldFiles = async (directoryPath, maxAgeHours = 24) => {
    try {
        const files = await fs.readdir(directoryPath);
        const now = Date.now();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtime.getTime() > maxAge) {
                await fs.unlink(filePath);
                logger.info(`Cleaned up old file: ${filePath}`);
            }
        }
    } catch (error) {
        logger.logError(`Error cleaning up files: ${error.message}`);
    }
};

module.exports = {
    ensureDirectoryExists,
    generateUniqueFileName,
    getFileExtension,
    isFileTypeAllowed,
    formatFileSize,
    deleteFileIfExists,
    moveFile,
    getFileInfo,
    validateUploadedFile,
    cleanupOldFiles
};
