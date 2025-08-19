const express = require('express');
const router = express.Router();
const commentController = require('../../controllers/comment.controller');
const auth = require('../../middleware/auth');

// Comment management
router.put('/:id', auth.authMiddleware, commentController.updateComment);
router.delete('/:id', auth.authMiddleware, commentController.deleteComment);
router.get('/:id/replies', auth.authMiddleware, commentController.getCommentReplies);

module.exports = router;
