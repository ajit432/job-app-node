const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

// GET /api/v1/posts/:postId/comments
exports.getComments = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { postId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Check if post exists and user can access it
        const [post] = await sqlService.executeQuery('SELECT', 'posts', {
            columns: ['id', 'user_id', 'visibility', 'is_comments_enabled'],
            where: { id: postId }
        }, { controller: 'comment.controller', function: 'getComments' });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        if (!post.is_comments_enabled) {
            return res.status(403).json({
                success: false,
                message: 'Comments are disabled for this post'
            });
        }

        // Check visibility permissions
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
            }, { controller: 'comment.controller', function: 'getComments' });

            if (!isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // Get comments with user details and reply counts
        const commentsQuery = `
            SELECT 
                c.id, c.user_id, c.post_id, c.content, c.parent_comment_id, 
                c.created_at, c.updated_at,
                u.email,
                up.full_name, up.profile_image,
                (SELECT COUNT(*) FROM comments replies WHERE replies.parent_comment_id = c.id) as replies_count,
                CASE WHEN c.user_id = ? OR ? = ? THEN 1 ELSE 0 END as can_delete
            FROM comments c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE c.post_id = ? AND c.parent_comment_id IS NULL
            ORDER BY c.created_at ASC
            LIMIT ? OFFSET ?
        `;

        const comments = await sqlService.executeQuery('RAW', commentsQuery, 
            { values: [userId, userId, post.user_id, postId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'comment.controller', function: 'getComments' });

        // Get replies for each comment
        for (let comment of comments) {
            const repliesQuery = `
                SELECT 
                    c.id, c.user_id, c.post_id, c.content, c.parent_comment_id, 
                    c.created_at, c.updated_at,
                    u.email,
                    up.full_name, up.profile_image,
                    CASE WHEN c.user_id = ? OR ? = ? THEN 1 ELSE 0 END as can_delete
                FROM comments c
                JOIN users u ON c.user_id = u.id
                LEFT JOIN user_profiles up ON u.id = up.user_id
                WHERE c.parent_comment_id = ?
                ORDER BY c.created_at ASC
                LIMIT 3
            `;

            const replies = await sqlService.executeQuery('RAW', repliesQuery, 
                { values: [userId, userId, post.user_id, comment.id] }, 
                { controller: 'comment.controller', function: 'getComments' });

            comment.replies = replies.map(reply => ({
                id: reply.id,
                userId: reply.user_id,
                postId: reply.post_id,
                content: reply.content,
                parentCommentId: reply.parent_comment_id,
                createdAt: reply.created_at,
                updatedAt: reply.updated_at,
                canDelete: reply.can_delete === 1,
                user: {
                    id: reply.user_id,
                    email: reply.email,
                    profile: {
                        fullName: reply.full_name,
                        profileImage: reply.profile_image
                    }
                }
            }));
        }

        const formattedComments = comments.map(comment => ({
            id: comment.id,
            userId: comment.user_id,
            postId: comment.post_id,
            content: comment.content,
            parentCommentId: comment.parent_comment_id,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            repliesCount: comment.replies_count,
            canDelete: comment.can_delete === 1,
            user: {
                id: comment.user_id,
                email: comment.email,
                profile: {
                    fullName: comment.full_name,
                    profileImage: comment.profile_image
                }
            },
            replies: comment.replies || []
        }));

        res.status(200).json({
            success: true,
            message: 'Comments retrieved successfully',
            data: formattedComments
        });

    } catch (error) {
        logger.logError('Get comments error:', error);
        next(error);
    }
};

// POST /api/v1/posts/:postId/comments
exports.createComment = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { postId } = req.params;
        const { content, parentCommentId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment content is required'
            });
        }

        // Check if post exists and comments are enabled
        const [post] = await sqlService.executeQuery('SELECT', 'posts', {
            columns: ['id', 'user_id', 'visibility', 'is_comments_enabled'],
            where: { id: postId }
        }, { controller: 'comment.controller', function: 'createComment' });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Post not found'
            });
        }

        if (!post.is_comments_enabled) {
            return res.status(403).json({
                success: false,
                message: 'Comments are disabled for this post'
            });
        }

        // Check visibility permissions
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
            }, { controller: 'comment.controller', function: 'createComment' });

            if (!isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // If it's a reply, check if parent comment exists
        if (parentCommentId) {
            const [parentComment] = await sqlService.executeQuery('SELECT', 'comments', {
                columns: ['id', 'post_id'],
                where: { id: parentCommentId, post_id: postId }
            }, { controller: 'comment.controller', function: 'createComment' });

            if (!parentComment) {
                return res.status(404).json({
                    success: false,
                    message: 'Parent comment not found'
                });
            }
        }

        // Create comment
        const commentId = await sqlService.executeQuery('INSERT', 'comments', {
            columns: ['user_id', 'post_id', 'content', 'parent_comment_id'],
            values: [userId, postId, content.trim(), parentCommentId || null]
        }, { controller: 'comment.controller', function: 'createComment' });

        // Create notification for post owner (unless commenting on own post)
        if (post.user_id !== userId) {
            const io = req.app.get('io');
            
            await sqlService.executeQuery('INSERT', 'notifications', {
                columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
                values: [
                    post.user_id, 
                    'New Comment', 
                    parentCommentId ? 'Someone replied to a comment on your post' : 'Someone commented on your post', 
                    'post_interaction', 
                    postId,
                    JSON.stringify({ commentId, parentCommentId, userId })
                ]
            }, { controller: 'comment.controller', function: 'createComment' });

            // Emit real-time notification
            io.emit(`notification_${post.user_id}`, {
                type: 'comment',
                message: parentCommentId ? 'Someone replied to a comment on your post' : 'Someone commented on your post',
                postId: postId,
                commentId: commentId
            });
        }

        // If it's a reply, notify the parent comment author
        if (parentCommentId) {
            const [parentComment] = await sqlService.executeQuery('SELECT', 'comments', {
                columns: ['user_id'],
                where: { id: parentCommentId }
            }, { controller: 'comment.controller', function: 'createComment' });

            if (parentComment && parentComment.user_id !== userId && parentComment.user_id !== post.user_id) {
                const io = req.app.get('io');
                
                await sqlService.executeQuery('INSERT', 'notifications', {
                    columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
                    values: [
                        parentComment.user_id, 
                        'Comment Reply', 
                        'Someone replied to your comment', 
                        'post_interaction', 
                        postId,
                        JSON.stringify({ commentId, parentCommentId, userId })
                    ]
                }, { controller: 'comment.controller', function: 'createComment' });

                // Emit real-time notification
                io.emit(`notification_${parentComment.user_id}`, {
                    type: 'comment_reply',
                    message: 'Someone replied to your comment',
                    postId: postId,
                    commentId: commentId
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Comment created successfully',
            data: { id: commentId }
        });

    } catch (error) {
        logger.logError('Create comment error:', error);
        next(error);
    }
};

// DELETE /api/v1/comments/:id
exports.deleteComment = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Get comment details
        const commentQuery = `
            SELECT c.id, c.user_id, c.post_id, p.user_id as post_owner_id
            FROM comments c
            JOIN posts p ON c.post_id = p.id
            WHERE c.id = ?
        `;

        const [comment] = await sqlService.executeQuery('RAW', commentQuery, 
            { values: [id] }, 
            { controller: 'comment.controller', function: 'deleteComment' });

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user can delete this comment (comment author or post owner)
        if (comment.user_id !== userId && comment.post_owner_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Delete comment (cascading will handle replies)
        await sqlService.executeQuery('DELETE', 'comments', {
            where: { id }
        }, { controller: 'comment.controller', function: 'deleteComment' });

        res.status(200).json({
            success: true,
            message: 'Comment deleted successfully'
        });

    } catch (error) {
        logger.logError('Delete comment error:', error);
        next(error);
    }
};

// PUT /api/v1/comments/:id
exports.updateComment = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comment content is required'
            });
        }

        // Check if comment exists and belongs to user
        const [comment] = await sqlService.executeQuery('SELECT', 'comments', {
            columns: ['id', 'user_id', 'post_id'],
            where: { id, user_id: userId }
        }, { controller: 'comment.controller', function: 'updateComment' });

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found or access denied'
            });
        }

        // Update comment
        await sqlService.executeQuery('UPDATE', 'comments', {
            set: { content: content.trim() },
            where: { id }
        }, { controller: 'comment.controller', function: 'updateComment' });

        res.status(200).json({
            success: true,
            message: 'Comment updated successfully'
        });

    } catch (error) {
        logger.logError('Update comment error:', error);
        next(error);
    }
};

// GET /api/v1/comments/:id/replies
exports.getCommentReplies = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Check if parent comment exists
        const [parentComment] = await sqlService.executeQuery('SELECT', 'comments', {
            columns: ['id', 'post_id'],
            where: { id }
        }, { controller: 'comment.controller', function: 'getCommentReplies' });

        if (!parentComment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check post visibility permissions
        const [post] = await sqlService.executeQuery('SELECT', 'posts', {
            columns: ['id', 'user_id', 'visibility'],
            where: { id: parentComment.post_id }
        }, { controller: 'comment.controller', function: 'getCommentReplies' });

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
            }, { controller: 'comment.controller', function: 'getCommentReplies' });

            if (!isFollowing) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // Get replies
        const repliesQuery = `
            SELECT 
                c.id, c.user_id, c.post_id, c.content, c.parent_comment_id, 
                c.created_at, c.updated_at,
                u.email,
                up.full_name, up.profile_image,
                CASE WHEN c.user_id = ? OR ? = ? THEN 1 ELSE 0 END as can_delete
            FROM comments c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE c.parent_comment_id = ?
            ORDER BY c.created_at ASC
            LIMIT ? OFFSET ?
        `;

        const replies = await sqlService.executeQuery('RAW', repliesQuery, 
            { values: [userId, userId, post.user_id, id, parseInt(limit), parseInt(offset)] }, 
            { controller: 'comment.controller', function: 'getCommentReplies' });

        const formattedReplies = replies.map(reply => ({
            id: reply.id,
            userId: reply.user_id,
            postId: reply.post_id,
            content: reply.content,
            parentCommentId: reply.parent_comment_id,
            createdAt: reply.created_at,
            updatedAt: reply.updated_at,
            canDelete: reply.can_delete === 1,
            user: {
                id: reply.user_id,
                email: reply.email,
                profile: {
                    fullName: reply.full_name,
                    profileImage: reply.profile_image
                }
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Comment replies retrieved successfully',
            data: formattedReplies
        });

    } catch (error) {
        logger.logError('Get comment replies error:', error);
        next(error);
    }
};
