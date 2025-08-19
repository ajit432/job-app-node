const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat.controller');
const auth = require('../../middleware/auth');

// Conversation management
router.get('/conversations', auth.authMiddleware, chatController.getConversations);
router.post('/conversations', auth.authMiddleware, chatController.createOrGetConversation);

// Messages
router.get('/conversations/:id/messages', auth.authMiddleware, chatController.getMessages);
router.post('/conversations/:id/messages', auth.authMiddleware, chatController.sendMessage);

// Message status
router.put('/messages/:id/read', auth.authMiddleware, chatController.markMessageAsRead);
router.put('/conversations/:id/read-all', auth.authMiddleware, chatController.markAllMessagesAsRead);

// Unread count
router.get('/unread-count', auth.authMiddleware, chatController.getUnreadCount);

module.exports = router;
