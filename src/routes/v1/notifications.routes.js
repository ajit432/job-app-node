const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notification.controller');
const auth = require('../../middleware/auth');

// Notification management
router.get('/', auth.authMiddleware, notificationController.getNotifications);
router.put('/:id/read', auth.authMiddleware, notificationController.markNotificationAsRead);
router.put('/read-all', auth.authMiddleware, notificationController.markAllNotificationsAsRead);
router.delete('/:id', auth.authMiddleware, notificationController.deleteNotification);

// Notification status
router.get('/unread-count', auth.authMiddleware, notificationController.getUnreadCount);

// Notification settings
router.get('/settings', auth.authMiddleware, notificationController.getNotificationSettings);
router.put('/settings', auth.authMiddleware, notificationController.updateNotificationSettings);

// Test notifications (development only)
router.post('/test', auth.authMiddleware, notificationController.createTestNotification);

module.exports = router;
