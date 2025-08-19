const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

// GET /api/v1/chat/conversations
exports.getConversations = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const conversationsQuery = `
            SELECT 
                cc.id, cc.user1_id, cc.user2_id, cc.last_message_at, cc.created_at,
                CASE 
                    WHEN cc.user1_id = ? THEN cc.user2_id 
                    ELSE cc.user1_id 
                END as other_user_id,
                ou.email as other_user_email,
                oup.full_name as other_user_name, oup.profile_image as other_user_image,
                lm.id as last_message_id, lm.content as last_message_content, 
                lm.message_type as last_message_type, lm.created_at as last_message_time,
                lm.sender_id as last_message_sender_id,
                (
                    SELECT COUNT(*) 
                    FROM chat_messages cm 
                    WHERE cm.conversation_id = cc.id 
                        AND cm.sender_id != ? 
                        AND cm.is_read = 0
                ) as unread_count
            FROM chat_conversations cc
            LEFT JOIN chat_messages lm ON cc.id = lm.conversation_id 
                AND lm.id = (
                    SELECT id FROM chat_messages 
                    WHERE conversation_id = cc.id 
                    ORDER BY created_at DESC 
                    LIMIT 1
                )
            JOIN users ou ON (
                CASE 
                    WHEN cc.user1_id = ? THEN cc.user2_id 
                    ELSE cc.user1_id 
                END
            ) = ou.id
            LEFT JOIN user_profiles oup ON ou.id = oup.user_id
            WHERE (cc.user1_id = ? OR cc.user2_id = ?) AND ou.is_active = 1
            ORDER BY cc.last_message_at DESC
            LIMIT ? OFFSET ?
        `;

        const conversations = await sqlService.executeQuery('RAW', conversationsQuery, 
            { values: [userId, userId, userId, userId, userId, parseInt(limit), parseInt(offset)] }, 
            { controller: 'chat.controller', function: 'getConversations' });

        const formattedConversations = conversations.map(conv => ({
            id: conv.id,
            user1Id: conv.user1_id,
            user2Id: conv.user2_id,
            lastMessageAt: conv.last_message_at,
            createdAt: conv.created_at,
            unreadCount: conv.unread_count,
            otherUser: {
                id: conv.other_user_id,
                email: conv.other_user_email,
                profile: {
                    fullName: conv.other_user_name,
                    profileImage: conv.other_user_image
                }
            },
            lastMessage: conv.last_message_id ? {
                id: conv.last_message_id,
                content: conv.last_message_content,
                messageType: conv.last_message_type,
                senderId: conv.last_message_sender_id,
                createdAt: conv.last_message_time
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Conversations retrieved successfully',
            data: formattedConversations
        });

    } catch (error) {
        logger.logError('Get conversations error:', error);
        next(error);
    }
};

// POST /api/v1/chat/conversations
exports.createOrGetConversation = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { otherUserId } = req.body;

        if (!otherUserId) {
            return res.status(400).json({
                success: false,
                message: 'Other user ID is required'
            });
        }

        if (userId === otherUserId) {
            return res.status(400).json({
                success: false,
                message: 'Cannot create conversation with yourself'
            });
        }

        // Check if other user exists and is active
        const [otherUser] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'is_active'],
            where: { id: otherUserId }
        }, { controller: 'chat.controller', function: 'createOrGetConversation' });

        if (!otherUser || !otherUser.is_active) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if conversation already exists
        const existingConversationQuery = `
            SELECT id FROM chat_conversations 
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        `;

        const [existingConversation] = await sqlService.executeQuery('RAW', existingConversationQuery, 
            { values: [userId, otherUserId, otherUserId, userId] }, 
            { controller: 'chat.controller', function: 'createOrGetConversation' });

        let conversationId;

        if (existingConversation) {
            conversationId = existingConversation.id;
        } else {
            // Create new conversation
            conversationId = await sqlService.executeQuery('INSERT', 'chat_conversations', {
                columns: ['user1_id', 'user2_id'],
                values: [Math.min(userId, otherUserId), Math.max(userId, otherUserId)]
            }, { controller: 'chat.controller', function: 'createOrGetConversation' });
        }

        res.status(200).json({
            success: true,
            message: 'Conversation retrieved successfully',
            data: { id: conversationId }
        });

    } catch (error) {
        logger.logError('Create or get conversation error:', error);
        next(error);
    }
};

// GET /api/v1/chat/conversations/:id/messages
exports.getMessages = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Check if user is part of this conversation
        const [conversation] = await sqlService.executeQuery('SELECT', 'chat_conversations', {
            columns: ['id', 'user1_id', 'user2_id'],
            where: { id }
        }, { controller: 'chat.controller', function: 'getMessages' });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const messagesQuery = `
            SELECT 
                cm.id, cm.conversation_id, cm.sender_id, cm.content, cm.message_type, 
                cm.file_url, cm.is_read, cm.created_at,
                u.email as sender_email,
                up.full_name as sender_name, up.profile_image as sender_image
            FROM chat_messages cm
            JOIN users u ON cm.sender_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE cm.conversation_id = ?
            ORDER BY cm.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const messages = await sqlService.executeQuery('RAW', messagesQuery, 
            { values: [id, parseInt(limit), parseInt(offset)] }, 
            { controller: 'chat.controller', function: 'getMessages' });

        // Mark messages as read
        await sqlService.executeQuery('UPDATE', 'chat_messages', {
            set: { is_read: true },
            where: { conversation_id: id, sender_id: { '!=': userId }, is_read: false }
        }, { controller: 'chat.controller', function: 'getMessages' });

        const formattedMessages = messages.reverse().map(message => ({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            content: message.content,
            messageType: message.message_type,
            fileUrl: message.file_url,
            isRead: message.is_read,
            createdAt: message.created_at,
            sender: {
                id: message.sender_id,
                email: message.sender_email,
                profile: {
                    fullName: message.sender_name,
                    profileImage: message.sender_image
                }
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Messages retrieved successfully',
            data: formattedMessages
        });

    } catch (error) {
        logger.logError('Get messages error:', error);
        next(error);
    }
};

// POST /api/v1/chat/conversations/:id/messages
exports.sendMessage = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { content, messageType = 'text', fileUrl } = req.body;

        if (!content && !fileUrl) {
            return res.status(400).json({
                success: false,
                message: 'Message content or file is required'
            });
        }

        // Check if user is part of this conversation
        const [conversation] = await sqlService.executeQuery('SELECT', 'chat_conversations', {
            columns: ['id', 'user1_id', 'user2_id'],
            where: { id }
        }, { controller: 'chat.controller', function: 'sendMessage' });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Create message
        const messageId = await sqlService.executeQuery('INSERT', 'chat_messages', {
            columns: ['conversation_id', 'sender_id', 'content', 'message_type', 'file_url'],
            values: [id, userId, content || '', messageType, fileUrl]
        }, { controller: 'chat.controller', function: 'sendMessage' });

        // Update conversation last message time
        await sqlService.executeQuery('UPDATE', 'chat_conversations', {
            set: { last_message_at: new Date() },
            where: { id }
        }, { controller: 'chat.controller', function: 'sendMessage' });

        // Get the created message with sender info
        const messageQuery = `
            SELECT 
                cm.id, cm.conversation_id, cm.sender_id, cm.content, cm.message_type, 
                cm.file_url, cm.is_read, cm.created_at,
                u.email as sender_email,
                up.full_name as sender_name, up.profile_image as sender_image
            FROM chat_messages cm
            JOIN users u ON cm.sender_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE cm.id = ?
        `;

        const [newMessage] = await sqlService.executeQuery('RAW', messageQuery, 
            { values: [messageId] }, 
            { controller: 'chat.controller', function: 'sendMessage' });

        // Get recipient ID
        const recipientId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;

        // Emit real-time message
        const io = req.app.get('io');
        io.emit(`conversation_${id}`, {
            type: 'new_message',
            message: {
                id: newMessage.id,
                conversationId: newMessage.conversation_id,
                senderId: newMessage.sender_id,
                content: newMessage.content,
                messageType: newMessage.message_type,
                fileUrl: newMessage.file_url,
                isRead: newMessage.is_read,
                createdAt: newMessage.created_at,
                sender: {
                    id: newMessage.sender_id,
                    email: newMessage.sender_email,
                    profile: {
                        fullName: newMessage.sender_name,
                        profileImage: newMessage.sender_image
                    }
                }
            }
        });

        // Create notification for recipient
        await sqlService.executeQuery('INSERT', 'notifications', {
            columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
            values: [
                recipientId, 
                'New Message', 
                content ? content.substring(0, 100) : 'File attachment', 
                'message', 
                id,
                JSON.stringify({ messageId, senderId: userId })
            ]
        }, { controller: 'chat.controller', function: 'sendMessage' });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: {
                id: newMessage.id,
                conversationId: newMessage.conversation_id,
                senderId: newMessage.sender_id,
                content: newMessage.content,
                messageType: newMessage.message_type,
                fileUrl: newMessage.file_url,
                isRead: newMessage.is_read,
                createdAt: newMessage.created_at
            }
        });

    } catch (error) {
        logger.logError('Send message error:', error);
        next(error);
    }
};

// PUT /api/v1/chat/messages/:id/read
exports.markMessageAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Get message and check if user is recipient
        const messageQuery = `
            SELECT cm.*, cc.user1_id, cc.user2_id
            FROM chat_messages cm
            JOIN chat_conversations cc ON cm.conversation_id = cc.id
            WHERE cm.id = ?
        `;

        const [message] = await sqlService.executeQuery('RAW', messageQuery, 
            { values: [id] }, 
            { controller: 'chat.controller', function: 'markMessageAsRead' });

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Check if user is part of conversation and not the sender
        if ((message.user1_id !== userId && message.user2_id !== userId) || message.sender_id === userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Mark as read
        await sqlService.executeQuery('UPDATE', 'chat_messages', {
            set: { is_read: true },
            where: { id }
        }, { controller: 'chat.controller', function: 'markMessageAsRead' });

        // Emit read receipt
        const io = req.app.get('io');
        io.emit(`conversation_${message.conversation_id}`, {
            type: 'message_read',
            messageId: id,
            readBy: userId
        });

        res.status(200).json({
            success: true,
            message: 'Message marked as read'
        });

    } catch (error) {
        logger.logError('Mark message as read error:', error);
        next(error);
    }
};

// PUT /api/v1/chat/conversations/:id/read-all
exports.markAllMessagesAsRead = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Check if user is part of this conversation
        const [conversation] = await sqlService.executeQuery('SELECT', 'chat_conversations', {
            columns: ['id', 'user1_id', 'user2_id'],
            where: { id }
        }, { controller: 'chat.controller', function: 'markAllMessagesAsRead' });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        if (conversation.user1_id !== userId && conversation.user2_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Mark all unread messages from other user as read
        await sqlService.executeQuery('UPDATE', 'chat_messages', {
            set: { is_read: true },
            where: { 
                conversation_id: id, 
                sender_id: { '!=': userId }, 
                is_read: false 
            }
        }, { controller: 'chat.controller', function: 'markAllMessagesAsRead' });

        res.status(200).json({
            success: true,
            message: 'All messages marked as read'
        });

    } catch (error) {
        logger.logError('Mark all messages as read error:', error);
        next(error);
    }
};

// GET /api/v1/chat/unread-count
exports.getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const [unreadCount] = await sqlService.executeQuery('RAW', 
            `SELECT COUNT(*) as count 
             FROM chat_messages cm
             JOIN chat_conversations cc ON cm.conversation_id = cc.id
             WHERE (cc.user1_id = ? OR cc.user2_id = ?) 
                AND cm.sender_id != ? 
                AND cm.is_read = 0`, 
            { values: [userId, userId, userId] }, 
            { controller: 'chat.controller', function: 'getUnreadCount' });

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
