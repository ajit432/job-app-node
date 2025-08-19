const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');

// GET /api/v1/skills
exports.getSkills = async (req, res, next) => {
    try {
        const { category, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let skillsQuery = `
            SELECT 
                s.id, s.name, s.category, s.created_at,
                COUNT(us.user_id) as users_count
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id
            WHERE 1=1
        `;

        const queryParams = [];

        if (category) {
            skillsQuery += ` AND s.category = ?`;
            queryParams.push(category);
        }

        if (search) {
            skillsQuery += ` AND s.name LIKE ?`;
            queryParams.push(`%${search}%`);
        }

        skillsQuery += ` GROUP BY s.id, s.name, s.category, s.created_at`;
        skillsQuery += ` ORDER BY users_count DESC, s.name ASC`;
        skillsQuery += ` LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const skills = await sqlService.executeQuery('RAW', skillsQuery, 
            { values: queryParams }, 
            { controller: 'skill.controller', function: 'getSkills' });

        const formattedSkills = skills.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            createdAt: skill.created_at,
            usersCount: skill.users_count
        }));

        res.status(200).json({
            success: true,
            message: 'Skills retrieved successfully',
            data: formattedSkills
        });

    } catch (error) {
        logger.logError('Get skills error:', error);
        next(error);
    }
};

// GET /api/v1/skills/categories
exports.getSkillCategories = async (req, res, next) => {
    try {
        const categoriesQuery = `
            SELECT 
                s.category,
                COUNT(*) as skills_count,
                COUNT(DISTINCT us.user_id) as users_count
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id
            WHERE s.category IS NOT NULL
            GROUP BY s.category
            ORDER BY skills_count DESC
        `;

        const categories = await sqlService.executeQuery('RAW', categoriesQuery, 
            { values: [] }, 
            { controller: 'skill.controller', function: 'getSkillCategories' });

        const formattedCategories = categories.map(category => ({
            category: category.category,
            skillsCount: category.skills_count,
            usersCount: category.users_count
        }));

        res.status(200).json({
            success: true,
            message: 'Skill categories retrieved successfully',
            data: formattedCategories
        });

    } catch (error) {
        logger.logError('Get skill categories error:', error);
        next(error);
    }
};

// POST /api/v1/skills
exports.createSkill = async (req, res, next) => {
    try {
        const { name, category } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Skill name is required'
            });
        }

        // Check if skill already exists
        const [existingSkill] = await sqlService.executeQuery('SELECT', 'skills', {
            columns: ['id', 'name'],
            where: { name: name.trim() }
        }, { controller: 'skill.controller', function: 'createSkill' });

        if (existingSkill) {
            return res.status(409).json({
                success: false,
                message: 'Skill already exists',
                data: existingSkill
            });
        }

        // Create new skill
        const skillId = await sqlService.executeQuery('INSERT', 'skills', {
            columns: ['name', 'category'],
            values: [name.trim(), category || null]
        }, { controller: 'skill.controller', function: 'createSkill' });

        const [newSkill] = await sqlService.executeQuery('SELECT', 'skills', {
            columns: ['id', 'name', 'category', 'created_at'],
            where: { id: skillId }
        }, { controller: 'skill.controller', function: 'createSkill' });

        res.status(201).json({
            success: true,
            message: 'Skill created successfully',
            data: newSkill
        });

    } catch (error) {
        logger.logError('Create skill error:', error);
        next(error);
    }
};

// GET /api/v1/skills/search
exports.searchSkills = async (req, res, next) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters long'
            });
        }

        const searchQuery = `
            SELECT 
                s.id, s.name, s.category,
                COUNT(us.user_id) as users_count
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id
            WHERE s.name LIKE ?
            GROUP BY s.id, s.name, s.category
            ORDER BY users_count DESC, s.name ASC
            LIMIT ?
        `;

        const skills = await sqlService.executeQuery('RAW', searchQuery, 
            { values: [`%${q}%`, parseInt(limit)] }, 
            { controller: 'skill.controller', function: 'searchSkills' });

        const formattedSkills = skills.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            usersCount: skill.users_count
        }));

        res.status(200).json({
            success: true,
            message: 'Skills found successfully',
            data: formattedSkills
        });

    } catch (error) {
        logger.logError('Search skills error:', error);
        next(error);
    }
};

// GET /api/v1/skills/trending
exports.getTrendingSkills = async (req, res, next) => {
    try {
        const { limit = 20, category } = req.query;

        let trendingQuery = `
            SELECT 
                s.id, s.name, s.category,
                COUNT(us.user_id) as users_count,
                COUNT(CASE WHEN us.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as recent_users_count
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id
            WHERE 1=1
        `;

        const queryParams = [];

        if (category) {
            trendingQuery += ` AND s.category = ?`;
            queryParams.push(category);
        }

        trendingQuery += `
            GROUP BY s.id, s.name, s.category
            HAVING users_count > 0
            ORDER BY recent_users_count DESC, users_count DESC
            LIMIT ?
        `;
        queryParams.push(parseInt(limit));

        const skills = await sqlService.executeQuery('RAW', trendingQuery, 
            { values: queryParams }, 
            { controller: 'skill.controller', function: 'getTrendingSkills' });

        const formattedSkills = skills.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            usersCount: skill.users_count,
            recentUsersCount: skill.recent_users_count
        }));

        res.status(200).json({
            success: true,
            message: 'Trending skills retrieved successfully',
            data: formattedSkills
        });

    } catch (error) {
        logger.logError('Get trending skills error:', error);
        next(error);
    }
};

// GET /api/v1/skills/:id/users
exports.getSkillUsers = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20, proficiencyLevel } = req.query;
        const offset = (page - 1) * limit;

        // Check if skill exists
        const [skill] = await sqlService.executeQuery('SELECT', 'skills', {
            columns: ['id', 'name', 'category'],
            where: { id }
        }, { controller: 'skill.controller', function: 'getSkillUsers' });

        if (!skill) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }

        let usersQuery = `
            SELECT 
                u.id, u.email,
                up.full_name, up.profile_image, up.bio, up.location,
                us.proficiency_level, us.years_of_experience, us.created_at as skill_added_at
            FROM user_skills us
            JOIN users u ON us.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE us.skill_id = ? AND u.is_active = 1
        `;

        const queryParams = [id];

        if (proficiencyLevel) {
            usersQuery += ` AND us.proficiency_level = ?`;
            queryParams.push(proficiencyLevel);
        }

        usersQuery += ` ORDER BY us.years_of_experience DESC, us.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const users = await sqlService.executeQuery('RAW', usersQuery, 
            { values: queryParams }, 
            { controller: 'skill.controller', function: 'getSkillUsers' });

        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            profile: {
                fullName: user.full_name,
                profileImage: user.profile_image,
                bio: user.bio,
                location: user.location
            },
            skillInfo: {
                proficiencyLevel: user.proficiency_level,
                yearsOfExperience: user.years_of_experience,
                skillAddedAt: user.skill_added_at
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Skill users retrieved successfully',
            data: {
                skill: skill,
                users: formattedUsers
            }
        });

    } catch (error) {
        logger.logError('Get skill users error:', error);
        next(error);
    }
};

// GET /api/v1/skills/suggestions
exports.getSkillSuggestions = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { limit = 10 } = req.query;

        // Get user's current skills
        const userSkillsQuery = `
            SELECT skill_id FROM user_skills WHERE user_id = ?
        `;

        const userSkills = await sqlService.executeQuery('RAW', userSkillsQuery, 
            { values: [userId] }, 
            { controller: 'skill.controller', function: 'getSkillSuggestions' });

        const userSkillIds = userSkills.map(skill => skill.skill_id);

        // Get skills that other users with similar skills have
        let suggestionsQuery = `
            SELECT 
                s.id, s.name, s.category,
                COUNT(DISTINCT us.user_id) as users_count,
                COUNT(DISTINCT similar_users.user_id) as similar_users_count
            FROM skills s
            JOIN user_skills us ON s.id = us.skill_id
            JOIN (
                SELECT DISTINCT user_id 
                FROM user_skills 
                WHERE skill_id IN (${userSkillIds.map(() => '?').join(',')}) 
                AND user_id != ?
            ) similar_users ON us.user_id = similar_users.user_id
            WHERE s.id NOT IN (${userSkillIds.map(() => '?').join(',')})
            GROUP BY s.id, s.name, s.category
            ORDER BY similar_users_count DESC, users_count DESC
            LIMIT ?
        `;

        const queryParams = [...userSkillIds, userId, ...userSkillIds, parseInt(limit)];

        // If user has no skills, suggest popular skills
        if (userSkillIds.length === 0) {
            suggestionsQuery = `
                SELECT 
                    s.id, s.name, s.category,
                    COUNT(us.user_id) as users_count
                FROM skills s
                LEFT JOIN user_skills us ON s.id = us.skill_id
                GROUP BY s.id, s.name, s.category
                ORDER BY users_count DESC
                LIMIT ?
            `;
            queryParams.splice(0, queryParams.length, parseInt(limit));
        }

        const suggestions = await sqlService.executeQuery('RAW', suggestionsQuery, 
            { values: queryParams }, 
            { controller: 'skill.controller', function: 'getSkillSuggestions' });

        const formattedSuggestions = suggestions.map(skill => ({
            id: skill.id,
            name: skill.name,
            category: skill.category,
            usersCount: skill.users_count,
            similarUsersCount: skill.similar_users_count || 0
        }));

        res.status(200).json({
            success: true,
            message: 'Skill suggestions retrieved successfully',
            data: formattedSuggestions
        });

    } catch (error) {
        logger.logError('Get skill suggestions error:', error);
        next(error);
    }
};
