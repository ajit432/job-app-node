const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

// GET /api/v1/notifications
exports.getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20, isRead } = req.query;
        const offset = (page - 1) * limit;

        let notificationsQuery = `
            SELECT 
                n.id, n.user_id, n.title, n.content, n.notification_type, 
                n.related_id, n.metadata, n.is_read, n.created_at,
                ru.email as related_user_email,
                rup.full_name as related_user_name, rup.profile_image as related_user_image
            FROM notifications n
            LEFT JOIN users ru ON JSON_EXTRACT(n.metadata, '$.userId') = ru.id
            LEFT JOIN user_profiles rup ON ru.id = rup.user_id
            WHERE n.user_id = ?
        `;

        const queryParams = [userId];

        if (isRead !== undefined) {
            notificationsQuery += ` AND n.is_read = ?`;
            queryParams.push(isRead === 'true' ? 1 : 0);
        }

        notificationsQuery += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const notifications = await sqlService.executeQuery('RAW', notificationsQuery, 
            { values: queryParams }, 
            { controller: 'notification.controller', function: 'getNotifications' });

        const formattedNotifications = notifications.map(notification => ({
            id: notification.id,
            userId: notification.user_id,
            title: notification.title,
            content: notification.content,
            notificationType: notification.notification_type,
            relatedId: notification.related_id,
            metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
            isRead: notification.is_read,
            createdAt: notification.created_at,
            relatedUser: notification.related_user_email ? {
                email: notification.related_user_email,
                profile: {
                    fullName: notification.related_user_name,
                    profileImage: notification.related_user_image
                }
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Notifications retrieved successfully',
            data: formattedNotifications
        });

    } catch (error) {
        logger.logError('Get notifications error:', error);
        next(error);
    }
};

// PUT /api/v1/notifications/:id/read
exports.markNotificationAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Check if notification belongs to user
        const [notification] = await sqlService.executeQuery('SELECT', 'notifications', {
            columns: ['id', 'user_id'],
            where: { id, user_id: userId }
        }, { controller: 'notification.controller', function: 'markNotificationAsRead' });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        // Mark as read
        await sqlService.executeQuery('UPDATE', 'notifications', {
            set: { is_read: true },
            where: { id }
        }, { controller: 'notification.controller', function: 'markNotificationAsRead' });

        res.status(200).json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        logger.logError('Mark notification as read error:', error);
        next(error);
    }
};

// PUT /api/v1/notifications/read-all
exports.markAllNotificationsAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        await sqlService.executeQuery('UPDATE', 'notifications', {
            set: { is_read: true },
            where: { user_id: userId, is_read: false }
        }, { controller: 'notification.controller', function: 'markAllNotificationsAsRead' });

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        logger.logError('Mark all notifications as read error:', error);
        next(error);
    }
};

// DELETE /api/v1/notifications/:id
exports.deleteNotification = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const deletedRows = await sqlService.executeQuery('DELETE', 'notifications', {
            where: { id, user_id: userId }
        }, { controller: 'notification.controller', function: 'deleteNotification' });

        if (deletedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });

    } catch (error) {
        logger.logError('Delete notification error:', error);
        next(error);
    }
};

// GET /api/v1/notifications/unread-count
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const [unreadCount] = await sqlService.executeQuery('RAW', 
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', 
            { values: [userId] }, 
            { controller: 'notification.controller', function: 'getUnreadCount' });

        res.status(200).json({
            success: true,
            message: 'Unread count retrieved successfully',
            data: { unreadCount: unreadCount.count }
        });

    } catch (error) {
        logger.logError('Get unread count error:', error);
        next(error);
    }
};

// GET /api/v1/notifications/settings
exports.getNotificationSettings = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const [settings] = await sqlService.executeQuery('SELECT', 'notification_settings', {
            columns: ['*'],
            where: { user_id: userId }
        }, { controller: 'notification.controller', function: 'getNotificationSettings' });

        if (!settings) {
            // Create default settings if they don't exist
            await sqlService.executeQuery('INSERT', 'notification_settings', {
                columns: ['user_id'],
                values: [userId]
            }, { controller: 'notification.controller', function: 'getNotificationSettings' });

            const [newSettings] = await sqlService.executeQuery('SELECT', 'notification_settings', {
                columns: ['*'],
                where: { user_id: userId }
            }, { controller: 'notification.controller', function: 'getNotificationSettings' });

            res.status(200).json({
                success: true,
                message: 'Notification settings retrieved successfully',
                data: {
                    id: newSettings.id,
                    userId: newSettings.user_id,
                    jobApplications: newSettings.job_applications,
                    interviewSchedules: newSettings.interview_schedules,
                    newFollowers: newSettings.new_followers,
                    postInteractions: newSettings.post_interactions,
                    messages: newSettings.messages,
                    system: newSettings.system,
                    emailNotifications: newSettings.email_notifications,
                    pushNotifications: newSettings.push_notifications,
                    createdAt: newSettings.created_at,
                    updatedAt: newSettings.updated_at
                }
            });
        } else {
            res.status(200).json({
                success: true,
                message: 'Notification settings retrieved successfully',
                data: {
                    id: settings.id,
                    userId: settings.user_id,
                    jobApplications: settings.job_applications,
                    interviewSchedules: settings.interview_schedules,
                    newFollowers: settings.new_followers,
                    postInteractions: settings.post_interactions,
                    messages: settings.messages,
                    system: settings.system,
                    emailNotifications: settings.email_notifications,
                    pushNotifications: settings.push_notifications,
                    createdAt: settings.created_at,
                    updatedAt: settings.updated_at
                }
            });
        }

    } catch (error) {
        logger.logError('Get notification settings error:', error);
        next(error);
    }
};

// PUT /api/v1/notifications/settings
exports.updateNotificationSettings = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            jobApplications, interviewSchedules, newFollowers, postInteractions, 
            messages, system, emailNotifications, pushNotifications 
        } = req.body;

        const updateData = {};
        
        if (jobApplications !== undefined) updateData.job_applications = jobApplications;
        if (interviewSchedules !== undefined) updateData.interview_schedules = interviewSchedules;
        if (newFollowers !== undefined) updateData.new_followers = newFollowers;
        if (postInteractions !== undefined) updateData.post_interactions = postInteractions;
        if (messages !== undefined) updateData.messages = messages;
        if (system !== undefined) updateData.system = system;
        if (emailNotifications !== undefined) updateData.email_notifications = emailNotifications;
        if (pushNotifications !== undefined) updateData.push_notifications = pushNotifications;

        // Check if settings exist
        const [existingSettings] = await sqlService.executeQuery('SELECT', 'notification_settings', {
            columns: ['id'],
            where: { user_id: userId }
        }, { controller: 'notification.controller', function: 'updateNotificationSettings' });

        if (existingSettings) {
            await sqlService.executeQuery('UPDATE', 'notification_settings', {
                set: updateData,
                where: { user_id: userId }
            }, { controller: 'notification.controller', function: 'updateNotificationSettings' });
        } else {
            await sqlService.executeQuery('INSERT', 'notification_settings', {
                columns: ['user_id', ...Object.keys(updateData)],
                values: [userId, ...Object.values(updateData)]
            }, { controller: 'notification.controller', function: 'updateNotificationSettings' });
        }

        res.status(200).json({
            success: true,
            message: 'Notification settings updated successfully'
        });

    } catch (error) {
        logger.logError('Update notification settings error:', error);
        next(error);
    }
};

// POST /api/v1/notifications/test
exports.createTestNotification = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { title = 'Test Notification', content = 'This is a test notification' } = req.body;

        const notificationId = await sqlService.executeQuery('INSERT', 'notifications', {
            columns: ['user_id', 'title', 'content', 'notification_type'],
            values: [userId, title, content, 'system']
        }, { controller: 'notification.controller', function: 'createTestNotification' });

        // Emit real-time notification
        const io = req.app.get('io');
        io.emit(`notification_${userId}`, {
            id: notificationId,
            type: 'system',
            title,
            content,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Test notification created successfully',
            data: { id: notificationId }
        });

    } catch (error) {
        logger.logError('Create test notification error:', error);
        next(error);
    }
};
