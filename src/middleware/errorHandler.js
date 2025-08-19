const logger = require('../utils/logger');

exports.errorHandler = (err, req, res, next) => {
    logger.logError(err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
};
