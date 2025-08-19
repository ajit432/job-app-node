const express = require('express');
const router = express.Router();
const postController = require('../../controllers/post.controller');
const commentController = require('../../controllers/comment.controller');
const auth = require('../../middleware/auth');

// Feed and general post routes
router.get('/feed', auth.authMiddleware, postController.getFeed);
router.post('/', auth.authMiddleware, postController.createPost);
router.get('/:id', auth.authMiddleware, postController.getPost);
router.delete('/:id', auth.authMiddleware, postController.deletePost);

// Post interactions
router.post('/:id/interact', auth.authMiddleware, postController.interactWithPost);

// Post comments
router.get('/:postId/comments', auth.authMiddleware, commentController.getComments);
router.post('/:postId/comments', auth.authMiddleware, commentController.createComment);

// User-specific posts
router.get('/user/:userId', auth.authMiddleware, postController.getUserPosts);

module.exports = router;
