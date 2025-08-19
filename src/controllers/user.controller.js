const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');
const { sanitizeValue } = require('../utils/formatter');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = file.fieldname === 'resume' ? 'uploads/resumes' : 'uploads/images';
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'resume') {
            if (!file.originalname.match(/\.(pdf|doc|docx)$/)) {
                return cb(new Error('Only PDF, DOC, and DOCX files allowed for resume'), false);
            }
        } else {
            if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
                return cb(new Error('Only image files allowed'), false);
            }
        }
        cb(null, true);
    }
});

// GET /api/v1/users/profile
exports.getUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const userProfileQuery = `
            SELECT 
                u.id, u.email, u.is_active, u.profile_type, u.created_at, u.updated_at,
                up.full_name, up.profile_image, up.banner_image, up.bio, up.location, 
                up.preferred_job_location, up.phone, up.website,
                jsp.resume_url, jsp.experience_years, jsp.current_salary, jsp.expected_salary, 
                jsp.availability_status,
                rp.company_id, rp.position, rp.is_company_owner, rp.department, rp.hiring_authority_level
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
            LEFT JOIN recruiter_profiles rp ON u.id = rp.user_id
            WHERE u.id = ? AND u.is_active = 1
        `;

        const [user] = await sqlService.executeQuery('RAW', userProfileQuery, 
            { values: [userId] }, 
            { controller: 'user.controller', function: 'getUserProfile' });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user skills
        const skillsQuery = `
            SELECT us.id, us.proficiency_level, us.years_of_experience, us.created_at,
                   s.id as skill_id, s.name, s.category
            FROM user_skills us
            JOIN skills s ON us.skill_id = s.id
            WHERE us.user_id = ?
            ORDER BY us.created_at DESC
        `;

        const skills = await sqlService.executeQuery('RAW', skillsQuery, 
            { values: [userId] }, 
            { controller: 'user.controller', function: 'getUserProfile' });

        // Get education
        const educationQuery = `
            SELECT * FROM education 
            WHERE user_id = ? 
            ORDER BY CASE WHEN is_current = 1 THEN 0 ELSE 1 END, start_date DESC
        `;

        const education = await sqlService.executeQuery('RAW', educationQuery, 
            { values: [userId] }, 
            { controller: 'user.controller', function: 'getUserProfile' });

        // Get experience
        const experienceQuery = `
            SELECT * FROM experience 
            WHERE user_id = ? 
            ORDER BY CASE WHEN is_current = 1 THEN 0 ELSE 1 END, start_date DESC
        `;

        const experience = await sqlService.executeQuery('RAW', experienceQuery, 
            { values: [userId] }, 
            { controller: 'user.controller', function: 'getUserProfile' });

        // Get company info for recruiters
        let company = null;
        if (user.profile_type === 'recruiter' && user.company_id) {
            const [companyData] = await sqlService.executeQuery('SELECT', 'companies', {
                columns: ['id', 'name', 'description', 'website', 'logo_url', 'industry', 'location'],
                where: { id: user.company_id }
            }, { controller: 'user.controller', function: 'getUserProfile' });
            company = companyData;
        }

        const userProfile = {
            id: user.id,
            email: user.email,
            isActive: user.is_active,
            profileType: user.profile_type,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            profile: {
                id: user.id,
                userId: user.id,
                fullName: user.full_name,
                profileImage: user.profile_image,
                bannerImage: user.banner_image,
                bio: user.bio,
                location: user.location,
                preferredJobLocation: user.preferred_job_location,
                phone: user.phone,
                website: user.website,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            },
            jobSeekerProfile: user.profile_type === 'job_seeker' ? {
                id: user.id,
                userId: user.id,
                resumeUrl: user.resume_url,
                experienceYears: user.experience_years || 0,
                currentSalary: user.current_salary,
                expectedSalary: user.expected_salary,
                availabilityStatus: user.availability_status || 'not_looking',
                createdAt: user.created_at,
                updatedAt: user.updated_at
            } : null,
            recruiterProfile: user.profile_type === 'recruiter' ? {
                id: user.id,
                userId: user.id,
                companyId: user.company_id,
                position: user.position,
                isCompanyOwner: user.is_company_owner || false,
                department: user.department,
                hiringAuthorityLevel: user.hiring_authority_level || 'junior',
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                company: company
            } : null,
            skills: skills.map(skill => ({
                id: skill.id,
                userId: user.id,
                skillId: skill.skill_id,
                proficiencyLevel: skill.proficiency_level,
                yearsOfExperience: skill.years_of_experience,
                createdAt: skill.created_at,
                skill: {
                    id: skill.skill_id,
                    name: skill.name,
                    category: skill.category
                }
            })),
            education: education,
            experience: experience
        };

        res.status(200).json({
            success: true,
            message: 'User profile retrieved successfully',
            data: userProfile
        });

    } catch (error) {
        logger.logError('Get user profile error:', error);
        next(error);
    }
};

// PUT /api/v1/users/profile
exports.updateUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            fullName, bio, location, preferredJobLocation, phone, website,
            experienceYears, currentSalary, expectedSalary, availabilityStatus,
            position, department, hiringAuthorityLevel, companyId
        } = req.body;

        // Update user profile
        await sqlService.executeQuery('UPDATE', 'user_profiles', {
            set: {
                full_name: fullName,
                bio: bio,
                location: location,
                preferred_job_location: preferredJobLocation,
                phone: phone,
                website: website
            },
            where: { user_id: userId }
        }, { controller: 'user.controller', function: 'updateUserProfile' });

        // Get user's profile type
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['profile_type'],
            where: { id: userId }
        }, { controller: 'user.controller', function: 'updateUserProfile' });

        // Update specific profile based on type
        if (user.profile_type === 'job_seeker') {
            // Update or create job seeker profile
            const [existingJobSeekerProfile] = await sqlService.executeQuery('SELECT', 'job_seeker_profiles', {
                columns: ['id'],
                where: { user_id: userId }
            }, { controller: 'user.controller', function: 'updateUserProfile' });

            if (existingJobSeekerProfile) {
                await sqlService.executeQuery('UPDATE', 'job_seeker_profiles', {
                    set: {
                        experience_years: experienceYears,
                        current_salary: currentSalary,
                        expected_salary: expectedSalary,
                        availability_status: availabilityStatus
                    },
                    where: { user_id: userId }
                }, { controller: 'user.controller', function: 'updateUserProfile' });
            } else {
                await sqlService.executeQuery('INSERT', 'job_seeker_profiles', {
                    columns: ['user_id', 'experience_years', 'current_salary', 'expected_salary', 'availability_status'],
                    values: [userId, experienceYears || 0, currentSalary, expectedSalary, availabilityStatus || 'not_looking']
                }, { controller: 'user.controller', function: 'updateUserProfile' });
            }
        } else if (user.profile_type === 'recruiter') {
            // Update or create recruiter profile
            const [existingRecruiterProfile] = await sqlService.executeQuery('SELECT', 'recruiter_profiles', {
                columns: ['id'],
                where: { user_id: userId }
            }, { controller: 'user.controller', function: 'updateUserProfile' });

            if (existingRecruiterProfile) {
                await sqlService.executeQuery('UPDATE', 'recruiter_profiles', {
                    set: {
                        company_id: companyId,
                        position: position,
                        department: department,
                        hiring_authority_level: hiringAuthorityLevel
                    },
                    where: { user_id: userId }
                }, { controller: 'user.controller', function: 'updateUserProfile' });
            } else {
                await sqlService.executeQuery('INSERT', 'recruiter_profiles', {
                    columns: ['user_id', 'company_id', 'position', 'department', 'hiring_authority_level'],
                    values: [userId, companyId, position, department, hiringAuthorityLevel || 'junior']
                }, { controller: 'user.controller', function: 'updateUserProfile' });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        logger.logError('Update user profile error:', error);
        next(error);
    }
};

// POST /api/v1/users/set-profile-type
exports.setProfileType = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { profileType } = req.body;

        if (!profileType || !['job_seeker', 'recruiter'].includes(profileType)) {
            return res.status(400).json({
                success: false,
                message: 'Valid profile type is required (job_seeker or recruiter)'
            });
        }

        // Check if profile type is already set
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['profile_type'],
            where: { id: userId }
        }, { controller: 'user.controller', function: 'setProfileType' });

        if (user.profile_type) {
            return res.status(400).json({
                success: false,
                message: 'Profile type is already set and cannot be changed'
            });
        }

        // Set profile type
        await sqlService.executeQuery('UPDATE', 'users', {
            set: { profile_type: profileType },
            where: { id: userId }
        }, { controller: 'user.controller', function: 'setProfileType' });

        // Create appropriate profile
        if (profileType === 'job_seeker') {
            await sqlService.executeQuery('INSERT', 'job_seeker_profiles', {
                columns: ['user_id'],
                values: [userId]
            }, { controller: 'user.controller', function: 'setProfileType' });
        } else if (profileType === 'recruiter') {
            await sqlService.executeQuery('INSERT', 'recruiter_profiles', {
                columns: ['user_id'],
                values: [userId]
            }, { controller: 'user.controller', function: 'setProfileType' });
        }

        res.status(200).json({
            success: true,
            message: 'Profile type set successfully',
            data: { profileType }
        });

    } catch (error) {
        logger.logError('Set profile type error:', error);
        next(error);
    }
};

// POST /api/v1/users/upload-images
exports.uploadImages = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
]);

exports.updateProfileImages = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const files = req.files;

        if (!files || ((!files.profileImage || files.profileImage.length === 0) && 
                      (!files.bannerImage || files.bannerImage.length === 0))) {
            return res.status(400).json({
                success: false,
                message: 'At least one image file is required'
            });
        }

        const updateData = {};
        
        if (files.profileImage && files.profileImage.length > 0) {
            updateData.profile_image = `/uploads/images/${files.profileImage[0].filename}`;
        }
        
        if (files.bannerImage && files.bannerImage.length > 0) {
            updateData.banner_image = `/uploads/images/${files.bannerImage[0].filename}`;
        }

        await sqlService.executeQuery('UPDATE', 'user_profiles', {
            set: updateData,
            where: { user_id: userId }
        }, { controller: 'user.controller', function: 'updateProfileImages' });

        res.status(200).json({
            success: true,
            message: 'Profile images updated successfully',
            data: updateData
        });

    } catch (error) {
        logger.logError('Update profile images error:', error);
        next(error);
    }
};

// POST /api/v1/users/upload-resume
exports.uploadResume = upload.single('resume');

exports.updateResume = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'Resume file is required'
            });
        }

        const resumeUrl = `/uploads/resumes/${file.filename}`;

        // Update resume URL in job seeker profile
        await sqlService.executeQuery('UPDATE', 'job_seeker_profiles', {
            set: { resume_url: resumeUrl },
            where: { user_id: userId }
        }, { controller: 'user.controller', function: 'updateResume' });

        res.status(200).json({
            success: true,
            message: 'Resume uploaded successfully',
            data: { resumeUrl }
        });

    } catch (error) {
        logger.logError('Update resume error:', error);
        next(error);
    }
};

// POST /api/v1/users/skills
exports.addSkill = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { skillId, proficiencyLevel = 'intermediate', yearsOfExperience = 0 } = req.body;

        if (!skillId) {
            return res.status(400).json({
                success: false,
                message: 'Skill ID is required'
            });
        }

        // Check if skill exists
        const [skill] = await sqlService.executeQuery('SELECT', 'skills', {
            columns: ['id', 'name'],
            where: { id: skillId }
        }, { controller: 'user.controller', function: 'addSkill' });

        if (!skill) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }

        // Check if user already has this skill
        const [existingUserSkill] = await sqlService.executeQuery('SELECT', 'user_skills', {
            columns: ['id'],
            where: { user_id: userId, skill_id: skillId }
        }, { controller: 'user.controller', function: 'addSkill' });

        if (existingUserSkill) {
            return res.status(409).json({
                success: false,
                message: 'Skill already added'
            });
        }

        // Add skill
        const userSkillId = await sqlService.executeQuery('INSERT', 'user_skills', {
            columns: ['user_id', 'skill_id', 'proficiency_level', 'years_of_experience'],
            values: [userId, skillId, proficiencyLevel, yearsOfExperience]
        }, { controller: 'user.controller', function: 'addSkill' });

        res.status(201).json({
            success: true,
            message: 'Skill added successfully',
            data: {
                id: userSkillId,
                userId,
                skillId,
                proficiencyLevel,
                yearsOfExperience,
                skill
            }
        });

    } catch (error) {
        logger.logError('Add skill error:', error);
        next(error);
    }
};

// DELETE /api/v1/users/skills/:skillId
exports.removeSkill = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { skillId } = req.params;

        const deletedRows = await sqlService.executeQuery('DELETE', 'user_skills', {
            where: { user_id: userId, skill_id: skillId }
        }, { controller: 'user.controller', function: 'removeSkill' });

        if (deletedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Skill not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Skill removed successfully'
        });

    } catch (error) {
        logger.logError('Remove skill error:', error);
        next(error);
    }
};

// POST /api/v1/users/education
exports.addEducation = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            institutionName, degree, fieldOfStudy, educationLevel, 
            startDate, endDate, gradePercentage, isCurrent = false 
        } = req.body;

        if (!institutionName || !educationLevel) {
            return res.status(400).json({
                success: false,
                message: 'Institution name and education level are required'
            });
        }

        const educationId = await sqlService.executeQuery('INSERT', 'education', {
            columns: ['user_id', 'institution_name', 'degree', 'field_of_study', 'education_level', 
                     'start_date', 'end_date', 'grade_percentage', 'is_current'],
            values: [userId, institutionName, degree, fieldOfStudy, educationLevel, 
                    startDate, endDate, gradePercentage, isCurrent]
        }, { controller: 'user.controller', function: 'addEducation' });

        res.status(201).json({
            success: true,
            message: 'Education added successfully',
            data: { id: educationId }
        });

    } catch (error) {
        logger.logError('Add education error:', error);
        next(error);
    }
};

// POST /api/v1/users/experience
exports.addExperience = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            companyName, jobTitle, employmentType, startDate, endDate, 
            isCurrent = false, description, location 
        } = req.body;

        if (!companyName || !jobTitle || !employmentType || !startDate) {
            return res.status(400).json({
                success: false,
                message: 'Company name, job title, employment type, and start date are required'
            });
        }

        const experienceId = await sqlService.executeQuery('INSERT', 'experience', {
            columns: ['user_id', 'company_name', 'job_title', 'employment_type', 
                     'start_date', 'end_date', 'is_current', 'description', 'location'],
            values: [userId, companyName, jobTitle, employmentType, 
                    startDate, endDate, isCurrent, description, location]
        }, { controller: 'user.controller', function: 'addExperience' });

        res.status(201).json({
            success: true,
            message: 'Experience added successfully',
            data: { id: experienceId }
        });

    } catch (error) {
        logger.logError('Add experience error:', error);
        next(error);
    }
};

// GET /api/v1/users/search
exports.searchUsers = async (req, res, next) => {
    try {
        const { query, type, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let searchQuery = `
            SELECT 
                u.id, u.email, u.profile_type, u.created_at,
                up.full_name, up.profile_image, up.bio, up.location
            FROM users u
            JOIN user_profiles up ON u.id = up.user_id
            WHERE u.is_active = 1
        `;

        const queryParams = [];

        if (query) {
            searchQuery += ` AND (up.full_name LIKE ? OR up.bio LIKE ? OR up.location LIKE ?)`;
            queryParams.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }

        if (type && ['job_seeker', 'recruiter'].includes(type)) {
            searchQuery += ` AND u.profile_type = ?`;
            queryParams.push(type);
        }

        searchQuery += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const users = await sqlService.executeQuery('RAW', searchQuery, 
            { values: queryParams }, 
            { controller: 'user.controller', function: 'searchUsers' });

        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully',
            data: users
        });

    } catch (error) {
        logger.logError('Search users error:', error);
        next(error);
    }
};
