const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

// Registration validation
exports.validateRegistration = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    handleValidationErrors
];

// Login validation
exports.validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('loginType')
        .optional()
        .isIn(['password', 'otp'])
        .withMessage('Login type must be either password or otp'),
    body('password')
        .if(body('loginType').equals('password'))
        .notEmpty()
        .withMessage('Password is required for password login'),
    body('otp')
        .if(body('loginType').equals('otp'))
        .isLength({ min: 6, max: 6 })
        .isNumeric()
        .withMessage('OTP must be 6 digits'),
    handleValidationErrors
];

// OTP request validation
exports.validateOtpRequest = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('type')
        .optional()
        .isIn(['login', 'register', 'password_reset'])
        .withMessage('OTP type must be login, register, or password_reset'),
    handleValidationErrors
];

// Post creation validation
exports.validatePost = [
    body('content')
        .notEmpty()
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Post content is required and must be less than 5000 characters'),
    body('postType')
        .optional()
        .isIn(['personal', 'job', 'company_update'])
        .withMessage('Post type must be personal, job, or company_update'),
    body('visibility')
        .optional()
        .isIn(['public', 'followers', 'private'])
        .withMessage('Visibility must be public, followers, or private'),
    handleValidationErrors
];

// Job post validation
exports.validateJobPost = [
    body('jobPostData.title')
        .if(body('postType').equals('job'))
        .notEmpty()
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Job title is required and must be 5-200 characters'),
    body('jobPostData.description')
        .if(body('postType').equals('job'))
        .notEmpty()
        .trim()
        .isLength({ min: 20, max: 5000 })
        .withMessage('Job description is required and must be 20-5000 characters'),
    body('jobPostData.jobType')
        .if(body('postType').equals('job'))
        .isIn(['full_time', 'part_time', 'contract', 'internship', 'freelance'])
        .withMessage('Valid job type is required'),
    body('jobPostData.experienceLevel')
        .if(body('postType').equals('job'))
        .isIn(['entry', 'mid', 'senior', 'lead', 'executive'])
        .withMessage('Valid experience level is required'),
    handleValidationErrors
];

// Comment validation
exports.validateComment = [
    body('content')
        .notEmpty()
        .trim()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Comment content is required and must be less than 1000 characters'),
    handleValidationErrors
];

// User profile validation
exports.validateUserProfile = [
    body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be 2-100 characters'),
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio must be less than 500 characters'),
    body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
    body('website')
        .optional()
        .isURL()
        .withMessage('Please provide a valid website URL'),
    handleValidationErrors
];

// Company validation
exports.validateCompany = [
    body('name')
        .notEmpty()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Company name is required and must be 2-200 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description must be less than 2000 characters'),
    body('website')
        .optional()
        .isURL()
        .withMessage('Please provide a valid website URL'),
    body('companySize')
        .optional()
        .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
        .withMessage('Invalid company size'),
    handleValidationErrors
];

// Skill validation
exports.validateSkill = [
    body('name')
        .notEmpty()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Skill name is required and must be 2-100 characters'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Category must be less than 100 characters'),
    handleValidationErrors
];

// Education validation
exports.validateEducation = [
    body('institutionName')
        .notEmpty()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Institution name is required and must be 2-200 characters'),
    body('educationLevel')
        .isIn(['10th', '12th', 'diploma', 'bachelor', 'master', 'doctorate'])
        .withMessage('Valid education level is required'),
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid start date'),
    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid end date'),
    handleValidationErrors
];

// Experience validation
exports.validateExperience = [
    body('companyName')
        .notEmpty()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Company name is required and must be 2-200 characters'),
    body('jobTitle')
        .notEmpty()
        .trim()
        .isLength({ min: 2, max: 200 })
        .withMessage('Job title is required and must be 2-200 characters'),
    body('employmentType')
        .isIn(['full_time', 'part_time', 'contract', 'internship', 'freelance'])
        .withMessage('Valid employment type is required'),
    body('startDate')
        .isISO8601()
        .withMessage('Please provide a valid start date'),
    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Please provide a valid end date'),
    handleValidationErrors
];

// Follow validation
exports.validateFollow = [
    body('followingId')
        .isInt({ min: 1 })
        .withMessage('Valid following ID is required'),
    body('followingType')
        .optional()
        .isIn(['user', 'company'])
        .withMessage('Following type must be user or company'),
    handleValidationErrors
];

// Job application validation
exports.validateJobApplication = [
    body('jobPostId')
        .isInt({ min: 1 })
        .withMessage('Valid job post ID is required'),
    body('coverLetter')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Cover letter must be less than 2000 characters'),
    handleValidationErrors
];

// Interview schedule validation
exports.validateInterviewSchedule = [
    body('interviewType')
        .isIn(['phone', 'video', 'in_person', 'technical', 'hr'])
        .withMessage('Valid interview type is required'),
    body('scheduledAt')
        .isISO8601()
        .withMessage('Please provide a valid scheduled date and time'),
    body('durationMinutes')
        .optional()
        .isInt({ min: 15, max: 480 })
        .withMessage('Duration must be between 15 and 480 minutes'),
    handleValidationErrors
];

module.exports = exports;
