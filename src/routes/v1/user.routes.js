const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const auth = require('../../middleware/auth');

// Profile routes
router.get('/profile', auth.authMiddleware, userController.getUserProfile);
router.put('/profile', auth.authMiddleware, userController.updateUserProfile);
router.post('/set-profile-type', auth.authMiddleware, userController.setProfileType);

// File upload routes
router.post('/upload-images', auth.authMiddleware, userController.uploadImages, userController.updateProfileImages);
router.post('/upload-resume', auth.authMiddleware, userController.uploadResume, userController.updateResume);

// Skills management
router.post('/skills', auth.authMiddleware, userController.addSkill);
router.delete('/skills/:skillId', auth.authMiddleware, userController.removeSkill);

// Education and experience
router.post('/education', auth.authMiddleware, userController.addEducation);
router.post('/experience', auth.authMiddleware, userController.addExperience);

// User search
router.get('/search', auth.authMiddleware, userController.searchUsers);

module.exports = router;