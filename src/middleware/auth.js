const jwt = require('../utils/jwt');
const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

exports.authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false,
            message: 'No token provided' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verifyToken(token);
        
        // Verify user still exists and is active
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email', 'is_active', 'profile_type'],
            where: { id: decoded.userId, is_active: true }
        }, { controller: 'auth.middleware', function: 'authMiddleware' });

        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'User not found or inactive' 
            });
        }

        req.user = {
            userId: user.id,
            email: user.email,
            profileType: user.profile_type,
            ...decoded
        };
        
        next();
    } catch (err) {
        logger.logError('Auth middleware error:', err);
        res.status(401).json({ 
            success: false,
            message: 'Invalid or expired token' 
        });
    }
};

// Middleware to check if user has specific profile type
exports.requireProfileType = (requiredType) => {
    return (req, res, next) => {
        if (!req.user || req.user.profileType !== requiredType) {
            return res.status(403).json({
                success: false,
                message: `Access denied. ${requiredType} profile required.`
            });
        }
        next();
    };
};

// Middleware to check if user has set their profile type
exports.requireProfileTypeSet = (req, res, next) => {
    if (!req.user || !req.user.profileType) {
        return res.status(403).json({
            success: false,
            message: 'Please set your profile type first (job_seeker or recruiter)'
        });
    }
    next();
};

// Optional auth middleware (doesn't fail if no token)
exports.optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verifyToken(token);
        
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email', 'is_active', 'profile_type'],
            where: { id: decoded.userId, is_active: true }
        }, { controller: 'auth.middleware', function: 'optionalAuth' });

        if (user) {
            req.user = {
                userId: user.id,
                email: user.email,
                profileType: user.profile_type,
                ...decoded
            };
        } else {
            req.user = null;
        }
    } catch (err) {
        req.user = null;
    }
    
    next();
};