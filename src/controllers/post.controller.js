const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');
const { sanitizeValue } = require('../utils/formatter');

// GET /api/v1/posts/feed
exports.getFeed = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const feedQuery = `
            SELECT DISTINCT
                p.id, p.user_id, p.content, p.post_type, p.media_urls, 
                p.is_comments_enabled, p.visibility, p.created_at, p.updated_at,
                u.email,
                up.full_name, up.profile_image,
                
                -- Post interactions count
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'like') as likes_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'love') as loves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'support') as supports_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'save') as saves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id) as total_interactions,
                
                -- User's interactions
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'like') as is_liked,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'save') as is_saved,
                
                -- Comments count
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
                
                -- Job post details if applicable
                jp.id as job_post_id, jp.title, jp.description as job_description, jp.job_type, 
                jp.experience_level, jp.salary_min, jp.salary_max, jp.currency, jp.location as job_location, 
                jp.is_remote, jp.application_deadline, jp.is_active as job_is_active,
                
                -- Company details for job posts
                c.id as company_id, c.name as company_name, c.logo_url as company_logo
                
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN job_posts jp ON p.id = jp.post_id
            LEFT JOIN companies c ON jp.company_id = c.id
            WHERE 
                u.is_active = 1 
                AND (
                    p.visibility = 'public' 
                    OR (p.visibility = 'followers' AND (
                        p.user_id = ? 
                        OR EXISTS (
                            SELECT 1 FROM follows f 
                            WHERE f.follower_id = ? AND f.following_id = p.user_id AND f.following_type = 'user'
                        )
                    ))
                    OR (p.visibility = 'private' AND p.user_id = ?)
                )
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const posts = await sqlService.executeQuery('RAW', feedQuery, 
            { values: [userId, userId, userId, userId, userId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'post.controller', function: 'getFeed' });

        // Format the response
        const formattedPosts = posts.map(post => ({
            id: post.id,
            userId: post.user_id,
            content: post.content,
            postType: post.post_type,
            mediaUrls: post.media_urls ? JSON.parse(post.media_urls) : null,
            isCommentsEnabled: post.is_comments_enabled,
            visibility: post.visibility,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            user: {
                id: post.user_id,
                email: post.email,
                profile: {
                    fullName: post.full_name,
                    profileImage: post.profile_image
                }
            },
            interactions: {
                likesCount: post.likes_count,
                lovesCount: post.loves_count,
                supportsCount: post.supports_count,
                savesCount: post.saves_count,
                totalCount: post.total_interactions
            },
            commentsCount: post.comments_count,
            isLiked: post.is_liked > 0,
            isSaved: post.is_saved > 0,
            jobPost: post.job_post_id ? {
                id: post.job_post_id,
                title: post.title,
                description: post.job_description,
                jobType: post.job_type,
                experienceLevel: post.experience_level,
                salaryMin: post.salary_min,
                salaryMax: post.salary_max,
                currency: post.currency,
                location: post.job_location,
                isRemote: post.is_remote,
                applicationDeadline: post.application_deadline,
                isActive: post.job_is_active,
                company: post.company_id ? {
                    id: post.company_id,
                    name: post.company_name,
                    logoUrl: post.company_logo
                } : null
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Feed retrieved successfully',
            data: formattedPosts,
            pagination: {
                currentPage: parseInt(page),
                itemsPerPage: parseInt(limit),
                totalItems: formattedPosts.length
            }
        });

    } catch (error) {
        logger.logError('Get feed error:', error);
        next(error);
    }
};

// POST /api/v1/posts
exports.createPost = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            content, postType = 'personal', mediaUrls, isCommentsEnabled = true, 
            visibility = 'followers', jobPostData 
        } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: 'Content is required'
            });
        }

        // Create the post
        const postId = await sqlService.executeQuery('INSERT', 'posts', {
            columns: ['user_id', 'content', 'post_type', 'media_urls', 'is_comments_enabled', 'visibility'],
            values: [userId, content, postType, mediaUrls ? JSON.stringify(mediaUrls) : null, isCommentsEnabled, visibility]
        }, { controller: 'post.controller', function: 'createPost' });

        // If it's a job post, create job post details
        if (postType === 'job' && jobPostData) {
            const { 
                title, description, requirements, companyId, jobType, experienceLevel,
                salaryMin, salaryMax, currency = 'USD', location, isRemote = false,
                applicationDeadline, requiredSkills = []
            } = jobPostData;

            if (!title || !description || !jobType || !experienceLevel) {
                return res.status(400).json({
                    success: false,
                    message: 'Job title, description, job type, and experience level are required for job posts'
                });
            }

            const jobPostId = await sqlService.executeQuery('INSERT', 'job_posts', {
                columns: ['post_id', 'title', 'description', 'requirements', 'company_id', 'job_type', 
                         'experience_level', 'salary_min', 'salary_max', 'currency', 'location', 
                         'is_remote', 'application_deadline'],
                values: [postId, title, description, requirements, companyId, jobType, experienceLevel,
                        salaryMin, salaryMax, currency, location, isRemote, applicationDeadline]
            }, { controller: 'post.controller', function: 'createPost' });

            // Add required skills
            if (requiredSkills.length > 0) {
                for (const skillId of requiredSkills) {
                    await sqlService.executeQuery('INSERT', 'job_skills_required', {
                        columns: ['job_post_id', 'skill_id'],
                        values: [jobPostId, skillId]
                    }, { controller: 'post.controller', function: 'createPost' });
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Post created successfully',
            data: { id: postId, postType }
        });

    } catch (error) {
        logger.logError('Create post error:', error);
        next(error);
    }
};

// GET /api/v1/posts/:id
exports.getPost = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const postQuery = `
            SELECT 
                p.id, p.user_id, p.content, p.post_type, p.media_urls, 
                p.is_comments_enabled, p.visibility, p.created_at, p.updated_at,
                u.email,
                up.full_name, up.profile_image,
                
                -- Post interactions count
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'like') as likes_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'love') as loves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'support') as supports_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'save') as saves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id) as total_interactions,
                
                -- User's interactions
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'like') as is_liked,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'save') as is_saved,
                
                -- Comments count
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
                
                -- Job post details if applicable
                jp.id as job_post_id, jp.title, jp.description as job_description, jp.requirements,
                jp.job_type, jp.experience_level, jp.salary_min, jp.salary_max, jp.currency, 
                jp.location as job_location, jp.is_remote, jp.application_deadline, jp.is_active as job_is_active,
                
                -- Company details for job posts
                c.id as company_id, c.name as company_name, c.logo_url as company_logo
                
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN job_posts jp ON p.id = jp.post_id
            LEFT JOIN companies c ON jp.company_id = c.id
            WHERE p.id = ? AND u.is_active = 1
        `;

        const [post] = await sqlService.executeQuery('RAW', postQuery, 
            { values: [userId, userId, id] }, 
            { controller: 'post.controller', function: 'getPost' });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        // Check if user can view this post
        if (post.visibility === 'private' && post.user_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (post.visibility === 'followers' && post.user_id !== userId) {
            const [isFollowing] = await sqlService.executeQuery('SELECT', 'follows', {
                columns: ['id'],
                where: { follower_id: userId, following_id: post.user_id, following_type: 'user' }
            }, { controller: 'post.controller', function: 'getPost' });

            if (!isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // Get required skills for job posts
        let requiredSkills = [];
        if (post.job_post_id) {
            const skillsQuery = `
                SELECT s.id, s.name, s.category, jsr.is_required, jsr.proficiency_level
                FROM job_skills_required jsr
                JOIN skills s ON jsr.skill_id = s.id
                WHERE jsr.job_post_id = ?
            `;
            requiredSkills = await sqlService.executeQuery('RAW', skillsQuery, 
                { values: [post.job_post_id] }, 
                { controller: 'post.controller', function: 'getPost' });
        }

        const formattedPost = {
            id: post.id,
            userId: post.user_id,
            content: post.content,
            postType: post.post_type,
            mediaUrls: post.media_urls ? JSON.parse(post.media_urls) : null,
            isCommentsEnabled: post.is_comments_enabled,
            visibility: post.visibility,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            user: {
                id: post.user_id,
                email: post.email,
                profile: {
                    fullName: post.full_name,
                    profileImage: post.profile_image
                }
            },
            interactions: {
                likesCount: post.likes_count,
                lovesCount: post.loves_count,
                supportsCount: post.supports_count,
                savesCount: post.saves_count,
                totalCount: post.total_interactions
            },
            commentsCount: post.comments_count,
            isLiked: post.is_liked > 0,
            isSaved: post.is_saved > 0,
            jobPost: post.job_post_id ? {
                id: post.job_post_id,
                title: post.title,
                description: post.job_description,
                requirements: post.requirements,
                jobType: post.job_type,
                experienceLevel: post.experience_level,
                salaryMin: post.salary_min,
                salaryMax: post.salary_max,
                currency: post.currency,
                location: post.job_location,
                isRemote: post.is_remote,
                applicationDeadline: post.application_deadline,
                isActive: post.job_is_active,
                requiredSkills: requiredSkills,
                company: post.company_id ? {
                    id: post.company_id,
                    name: post.company_name,
                    logoUrl: post.company_logo
                } : null
            } : null
        };

        res.status(200).json({
            success: true,
            message: 'Post retrieved successfully',
            data: formattedPost
        });

    } catch (error) {
        logger.logError('Get post error:', error);
        next(error);
    }
};

// POST /api/v1/posts/:id/interact
exports.interactWithPost = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { interactionType } = req.body;

        if (!['like', 'love', 'support', 'save'].includes(interactionType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid interaction type'
            });
        }

        // Check if post exists
        const [post] = await sqlService.executeQuery('SELECT', 'posts', {
            columns: ['id', 'user_id'],
            where: { id }
        }, { controller: 'post.controller', function: 'interactWithPost' });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        // Check if interaction already exists
        const [existingInteraction] = await sqlService.executeQuery('SELECT', 'post_interactions', {
            columns: ['id'],
            where: { user_id: userId, post_id: id, interaction_type: interactionType }
        }, { controller: 'post.controller', function: 'interactWithPost' });

        if (existingInteraction) {
            // Remove interaction (toggle)
            await sqlService.executeQuery('DELETE', 'post_interactions', {
                where: { id: existingInteraction.id }
            }, { controller: 'post.controller', function: 'interactWithPost' });

            res.status(200).json({
                success: true,
                message: 'Interaction removed',
                data: { action: 'removed', interactionType }
            });
        } else {
            // Add interaction
            await sqlService.executeQuery('INSERT', 'post_interactions', {
                columns: ['user_id', 'post_id', 'interaction_type'],
                values: [userId, id, interactionType]
            }, { controller: 'post.controller', function: 'interactWithPost' });

            // Create notification for post owner (except for saves)
            if (interactionType !== 'save' && post.user_id !== userId) {
                const io = req.app.get('io');
                
                await sqlService.executeQuery('INSERT', 'notifications', {
                    columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
                    values: [
                        post.user_id, 
                        'Post Interaction', 
                        `Someone ${interactionType}d your post`, 
                        'post_interaction', 
                        id,
                        JSON.stringify({ interactionType, userId })
                    ]
                }, { controller: 'post.controller', function: 'interactWithPost' });

                // Emit real-time notification
                io.emit(`notification_${post.user_id}`, {
                    type: 'post_interaction',
                    message: `Someone ${interactionType}d your post`,
                    postId: id
                });
            }

            res.status(200).json({
                success: true,
                message: 'Interaction added',
                data: { action: 'added', interactionType }
            });
        }

    } catch (error) {
        logger.logError('Interact with post error:', error);
        next(error);
    }
};

// DELETE /api/v1/posts/:id
exports.deletePost = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Check if post exists and belongs to user
        const [post] = await sqlService.executeQuery('SELECT', 'posts', {
            columns: ['id', 'user_id'],
            where: { id, user_id: userId }
        }, { controller: 'post.controller', function: 'deletePost' });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found or access denied'
            });
        }

        // Delete post (cascading will handle related data)
        await sqlService.executeQuery('DELETE', 'posts', {
            where: { id }
        }, { controller: 'post.controller', function: 'deletePost' });

        res.status(200).json({
            success: true,
            message: 'Post deleted successfully'
        });

    } catch (error) {
        logger.logError('Delete post error:', error);
        next(error);
    }
};

// GET /api/v1/posts/user/:userId
exports.getUserPosts = async (req, res, next) => {
    try {
        const currentUserId = req.user.userId;
        const { userId } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const userPostsQuery = `
            SELECT 
                p.id, p.user_id, p.content, p.post_type, p.media_urls, 
                p.is_comments_enabled, p.visibility, p.created_at, p.updated_at,
                u.email,
                up.full_name, up.profile_image,
                
                -- Post interactions count
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'like') as likes_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'love') as loves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'support') as supports_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.interaction_type = 'save') as saves_count,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id) as total_interactions,
                
                -- Current user's interactions
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'like') as is_liked,
                (SELECT COUNT(*) FROM post_interactions pi WHERE pi.post_id = p.id AND pi.user_id = ? AND pi.interaction_type = 'save') as is_saved,
                
                -- Comments count
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
                
            FROM posts p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE 
                p.user_id = ? 
                AND u.is_active = 1 
                AND (
                    p.visibility = 'public' 
                    OR (p.visibility = 'followers' AND (
                        p.user_id = ? 
                        OR EXISTS (
                            SELECT 1 FROM follows f 
                            WHERE f.follower_id = ? AND f.following_id = p.user_id AND f.following_type = 'user'
                        )
                    ))
                    OR (p.visibility = 'private' AND p.user_id = ?)
                )
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const posts = await sqlService.executeQuery('RAW', userPostsQuery, 
            { values: [currentUserId, currentUserId, userId, currentUserId, currentUserId, currentUserId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'post.controller', function: 'getUserPosts' });

        const formattedPosts = posts.map(post => ({
            id: post.id,
            userId: post.user_id,
            content: post.content,
            postType: post.post_type,
            mediaUrls: post.media_urls ? JSON.parse(post.media_urls) : null,
            isCommentsEnabled: post.is_comments_enabled,
            visibility: post.visibility,
            createdAt: post.created_at,
            updatedAt: post.updated_at,
            user: {
                id: post.user_id,
                email: post.email,
                profile: {
                    fullName: post.full_name,
                    profileImage: post.profile_image
                }
            },
            interactions: {
                likesCount: post.likes_count,
                lovesCount: post.loves_count,
                supportsCount: post.supports_count,
                savesCount: post.saves_count,
                totalCount: post.total_interactions
            },
            commentsCount: post.comments_count,
            isLiked: post.is_liked > 0,
            isSaved: post.is_saved > 0
        }));

        res.status(200).json({
            success: true,
            message: 'User posts retrieved successfully',
            data: formattedPosts
        });

    } catch (error) {
        logger.logError('Get user posts error:', error);
        next(error);
    }
};
