const express = require('express');
const router = express.Router();
const followController = require('../../controllers/follow.controller');
const auth = require('../../middleware/auth');

// Follow/Unfollow actions
router.post('/', auth.authMiddleware, followController.followUser);
router.delete('/', auth.authMiddleware, followController.unfollowUser);

// Follow data
router.get('/followers/:userId', auth.authMiddleware, followController.getFollowers);
router.get('/following/:userId', auth.authMiddleware, followController.getFollowing);
router.get('/stats/:userId', auth.authMiddleware, followController.getFollowStats);

// Follow suggestions and status
router.get('/suggestions', auth.authMiddleware, followController.getSuggestedUsers);
router.get('/check/:userId', auth.authMiddleware, followController.checkFollowStatus);

module.exports = router;
