const express = require('express');
const router = express.Router();
const skillController = require('../../controllers/skill.controller');
const auth = require('../../middleware/auth');

// Skill routes
router.get('/', auth.authMiddleware, skillController.getSkills);
router.get('/categories', auth.authMiddleware, skillController.getSkillCategories);
router.post('/', auth.authMiddleware, skillController.createSkill);

// Skill discovery
router.get('/search', auth.authMiddleware, skillController.searchSkills);
router.get('/trending', auth.authMiddleware, skillController.getTrendingSkills);
router.get('/suggestions', auth.authMiddleware, skillController.getSkillSuggestions);

// Skill users
router.get('/:id/users', auth.authMiddleware, skillController.getSkillUsers);

module.exports = router;
