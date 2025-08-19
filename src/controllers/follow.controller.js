const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

// POST /api/v1/follows
exports.followUser = async (req, res, next) => {
    try {
        const followerId = req.user.userId;
        const { followingId, followingType = 'user' } = req.body;

        if (!followingId) {
            return res.status(400).json({
                success: false,
                message: 'Following ID is required'
            });
        }

        if (!['user', 'company'].includes(followingType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid following type'
            });
        }

        if (followingType === 'user' && followerId === followingId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot follow yourself'
            });
        }

        // Check if target exists
        if (followingType === 'user') {
            const [user] = await sqlService.executeQuery('SELECT', 'users', {
                columns: ['id', 'is_active'],
                where: { id: followingId }
            }, { controller: 'follow.controller', function: 'followUser' });

            if (!user || !user.is_active) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        } else {
            const [company] = await sqlService.executeQuery('SELECT', 'companies', {
                columns: ['id'],
                where: { id: followingId }
            }, { controller: 'follow.controller', function: 'followUser' });

            if (!company) {
                return res.status(404).json({
                    success: false,
                    message: 'Company not found'
                });
            }
        }

        // Check if already following
        const [existingFollow] = await sqlService.executeQuery('SELECT', 'follows', {
            columns: ['id'],
            where: { follower_id: followerId, following_id: followingId, following_type: followingType }
        }, { controller: 'follow.controller', function: 'followUser' });

        if (existingFollow) {
            return res.status(409).json({
                success: false,
                message: 'Already following'
            });
        }

        // Create follow relationship
        const followId = await sqlService.executeQuery('INSERT', 'follows', {
            columns: ['follower_id', 'following_id', 'following_type'],
            values: [followerId, followingId, followingType]
        }, { controller: 'follow.controller', function: 'followUser' });

        // Create notification for user being followed (not for companies)
        if (followingType === 'user') {
            const io = req.app.get('io');
            
            await sqlService.executeQuery('INSERT', 'notifications', {
                columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
                values: [
                    followingId, 
                    'New Follower', 
                    'You have a new follower', 
                    'new_follower', 
                    followerId,
                    JSON.stringify({ followerId })
                ]
            }, { controller: 'follow.controller', function: 'followUser' });

            // Emit real-time notification
            io.emit(`notification_${followingId}`, {
                type: 'new_follower',
                message: 'You have a new follower',
                followerId: followerId
            });
        }

        res.status(201).json({
            success: true,
            message: `Successfully followed ${followingType}`,
            data: { id: followId }
        });

    } catch (error) {
        logger.logError('Follow user error:', error);
        next(error);
    }
};

// DELETE /api/v1/follows
exports.unfollowUser = async (req, res, next) => {
    try {
        const followerId = req.user.userId;
        const { followingId, followingType = 'user' } = req.body;

        if (!followingId) {
            return res.status(400).json({
                success: false,
                message: 'Following ID is required'
            });
        }

        // Delete follow relationship
        const deletedRows = await sqlService.executeQuery('DELETE', 'follows', {
            where: { follower_id: followerId, following_id: followingId, following_type: followingType }
        }, { controller: 'follow.controller', function: 'unfollowUser' });

        if (deletedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Follow relationship not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Successfully unfollowed ${followingType}`
        });

    } catch (error) {
        logger.logError('Unfollow user error:', error);
        next(error);
    }
};

// GET /api/v1/follows/followers/:userId
exports.getFollowers = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const followersQuery = `
            SELECT 
                f.id, f.follower_id, f.created_at,
                u.email,
                up.full_name, up.profile_image, up.bio, up.location
            FROM follows f
            JOIN users u ON f.follower_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE f.following_id = ? AND f.following_type = 'user' AND u.is_active = 1
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const followers = await sqlService.executeQuery('RAW', followersQuery, 
            { values: [userId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'follow.controller', function: 'getFollowers' });

        const formattedFollowers = followers.map(follower => ({
            id: follower.id,
            followerId: follower.follower_id,
            createdAt: follower.created_at,
            follower: {
                id: follower.follower_id,
                email: follower.email,
                profile: {
                    fullName: follower.full_name,
                    profileImage: follower.profile_image,
                    bio: follower.bio,
                    location: follower.location
                }
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Followers retrieved successfully',
            data: formattedFollowers
        });

    } catch (error) {
        logger.logError('Get followers error:', error);
        next(error);
    }
};

// GET /api/v1/follows/following/:userId
exports.getFollowing = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const followingQuery = `
            SELECT 
                f.id, f.following_id, f.following_type, f.created_at,
                u.email, up.full_name, up.profile_image, up.bio, up.location,
                c.name as company_name, c.logo_url as company_logo, c.industry
            FROM follows f
            LEFT JOIN users u ON f.following_id = u.id AND f.following_type = 'user'
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN companies c ON f.following_id = c.id AND f.following_type = 'company'
            WHERE f.follower_id = ? AND (u.is_active = 1 OR f.following_type = 'company')
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const following = await sqlService.executeQuery('RAW', followingQuery, 
            { values: [userId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'follow.controller', function: 'getFollowing' });

        const formattedFollowing = following.map(follow => ({
            id: follow.id,
            followingId: follow.following_id,
            followingType: follow.following_type,
            createdAt: follow.created_at,
            followingUser: follow.following_type === 'user' ? {
                id: follow.following_id,
                email: follow.email,
                profile: {
                    fullName: follow.full_name,
                    profileImage: follow.profile_image,
                    bio: follow.bio,
                    location: follow.location
                }
            } : null,
            followingCompany: follow.following_type === 'company' ? {
                id: follow.following_id,
                name: follow.company_name,
                logoUrl: follow.company_logo,
                industry: follow.industry
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Following list retrieved successfully',
            data: formattedFollowing
        });

    } catch (error) {
        logger.logError('Get following error:', error);
        next(error);
    }
};

// GET /api/v1/follows/stats/:userId
exports.getFollowStats = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Get followers count
        const [followersCount] = await sqlService.executeQuery('RAW', 
            'SELECT COUNT(*) as count FROM follows WHERE following_id = ? AND following_type = "user"', 
            { values: [userId] }, 
            { controller: 'follow.controller', function: 'getFollowStats' });

        // Get following count
        const [followingCount] = await sqlService.executeQuery('RAW', 
            'SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', 
            { values: [userId] }, 
            { controller: 'follow.controller', function: 'getFollowStats' });

        // Get following users count
        const [followingUsersCount] = await sqlService.executeQuery('RAW', 
            'SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND following_type = "user"', 
            { values: [userId] }, 
            { controller: 'follow.controller', function: 'getFollowStats' });

        // Get following companies count
        const [followingCompaniesCount] = await sqlService.executeQuery('RAW', 
            'SELECT COUNT(*) as count FROM follows WHERE follower_id = ? AND following_type = "company"', 
            { values: [userId] }, 
            { controller: 'follow.controller', function: 'getFollowStats' });

        const stats = {
            followersCount: followersCount.count,
            followingCount: followingCount.count,
            followingUsersCount: followingUsersCount.count,
            followingCompaniesCount: followingCompaniesCount.count
        };

        res.status(200).json({
            success: true,
            message: 'Follow stats retrieved successfully',
            data: stats
        });

    } catch (error) {
        logger.logError('Get follow stats error:', error);
        next(error);
    }
};

// GET /api/v1/follows/suggestions
exports.getSuggestedUsers = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 10 } = req.query;

        // Get mutual connections suggestions
        const mutualConnectionsQuery = `
            SELECT DISTINCT
                u.id, u.email,
                up.full_name, up.profile_image, up.bio, up.location,
                COUNT(DISTINCT mutual_follows.following_id) as mutual_count
            FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            JOIN follows mutual_follows ON u.id = mutual_follows.follower_id
            WHERE u.id != ? 
                AND u.is_active = 1
                AND u.id NOT IN (
                    SELECT following_id FROM follows 
                    WHERE follower_id = ? AND following_type = 'user'
                )
                AND mutual_follows.following_id IN (
                    SELECT following_id FROM follows 
                    WHERE follower_id = ? AND following_type = 'user'
                )
            GROUP BY u.id, u.email, up.full_name, up.profile_image, up.bio, up.location
            ORDER BY mutual_count DESC, RAND()
            LIMIT ?
        `;

        const suggestions = await sqlService.executeQuery('RAW', mutualConnectionsQuery, 
            { values: [userId, userId, userId, parseInt(limit)] }, 
            { controller: 'follow.controller', function: 'getSuggestedUsers' });

        const formattedSuggestions = suggestions.map(suggestion => ({
            user: {
                id: suggestion.id,
                email: suggestion.email,
                profile: {
                    fullName: suggestion.full_name,
                    profileImage: suggestion.profile_image,
                    bio: suggestion.bio,
                    location: suggestion.location
                }
            },
            reason: 'mutual_connections',
            mutualConnectionsCount: suggestion.mutual_count
        }));

        res.status(200).json({
            success: true,
            message: 'User suggestions retrieved successfully',
            data: formattedSuggestions
        });

    } catch (error) {
        logger.logError('Get suggested users error:', error);
        next(error);
    }
};

// GET /api/v1/follows/check/:userId
exports.checkFollowStatus = async (req, res, next) => {
    try {
        const followerId = req.user.userId;
        const { userId } = req.params;
        const { type = 'user' } = req.query;

        const [follow] = await sqlService.executeQuery('SELECT', 'follows', {
            columns: ['id', 'created_at'],
            where: { follower_id: followerId, following_id: userId, following_type: type }
        }, { controller: 'follow.controller', function: 'checkFollowStatus' });

        res.status(200).json({
            success: true,
            message: 'Follow status retrieved successfully',
            data: {
                isFollowing: !!follow,
                followedAt: follow?.created_at || null
            }
        });

    } catch (error) {
        logger.logError('Check follow status error:', error);
        next(error);
    }
};
