const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');
const { sanitizeValue } = require('../utils/formatter');

// GET /api/v1/companies
exports.getCompanies = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { page = 1, limit = 10, search, industry, verified } = req.query;
        const offset = (page - 1) * limit;

        let companiesQuery = `
            SELECT 
                c.id, c.name, c.description, c.website, c.logo_url, c.banner_url,
                c.industry, c.company_size, c.location, c.founded_year, c.is_verified,
                c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = c.id AND f.following_type = 'company') as followers_count,
                CASE WHEN EXISTS(
                    SELECT 1 FROM follows f 
                    WHERE f.follower_id = ? AND f.following_id = c.id AND f.following_type = 'company'
                ) THEN 1 ELSE 0 END as is_following
            FROM companies c
            WHERE 1=1
        `;

        const queryParams = [userId];

        if (search) {
            companiesQuery += ` AND (c.name LIKE ? OR c.description LIKE ? OR c.industry LIKE ?)`;
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (industry) {
            companiesQuery += ` AND c.industry = ?`;
            queryParams.push(industry);
        }

        if (verified !== undefined) {
            companiesQuery += ` AND c.is_verified = ?`;
            queryParams.push(verified === 'true' ? 1 : 0);
        }

        companiesQuery += ` ORDER BY c.is_verified DESC, c.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const companies = await sqlService.executeQuery('RAW', companiesQuery, 
            { values: queryParams }, 
            { controller: 'company.controller', function: 'getCompanies' });

        const formattedCompanies = companies.map(company => ({
            id: company.id,
            name: company.name,
            description: company.description,
            website: company.website,
            logoUrl: company.logo_url,
            bannerUrl: company.banner_url,
            industry: company.industry,
            companySize: company.company_size,
            location: company.location,
            foundedYear: company.founded_year,
            isVerified: company.is_verified,
            createdAt: company.created_at,
            updatedAt: company.updated_at,
            followersCount: company.followers_count,
            isFollowing: company.is_following === 1
        }));

        res.status(200).json({
            success: true,
            message: 'Companies retrieved successfully',
            data: formattedCompanies
        });

    } catch (error) {
        logger.logError('Get companies error:', error);
        next(error);
    }
};

// GET /api/v1/companies/:id
exports.getCompany = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const companyQuery = `
            SELECT 
                c.id, c.name, c.description, c.website, c.logo_url, c.banner_url,
                c.industry, c.company_size, c.location, c.founded_year, c.is_verified,
                c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = c.id AND f.following_type = 'company') as followers_count,
                CASE WHEN EXISTS(
                    SELECT 1 FROM follows f 
                    WHERE f.follower_id = ? AND f.following_id = c.id AND f.following_type = 'company'
                ) THEN 1 ELSE 0 END as is_following
            FROM companies c
            WHERE c.id = ?
        `;

        const [company] = await sqlService.executeQuery('RAW', companyQuery, 
            { values: [userId, id] }, 
            { controller: 'company.controller', function: 'getCompany' });

        if (!company) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        // Get company's active job posts
        const jobPostsQuery = `
            SELECT 
                jp.id, jp.title, jp.description, jp.job_type, jp.experience_level,
                jp.salary_min, jp.salary_max, jp.currency, jp.location, jp.is_remote,
                jp.application_deadline, jp.is_active, jp.created_at,
                p.id as post_id, p.content as post_content,
                (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_post_id = jp.id) as applications_count
            FROM job_posts jp
            JOIN posts p ON jp.post_id = p.id
            WHERE jp.company_id = ? AND jp.is_active = 1
            ORDER BY jp.created_at DESC
            LIMIT 10
        `;

        const jobPosts = await sqlService.executeQuery('RAW', jobPostsQuery, 
            { values: [id] }, 
            { controller: 'company.controller', function: 'getCompany' });

        // Get company employees (recruiters)
        const employeesQuery = `
            SELECT 
                u.id, u.email,
                up.full_name, up.profile_image,
                rp.position, rp.department, rp.is_company_owner
            FROM recruiter_profiles rp
            JOIN users u ON rp.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE rp.company_id = ? AND u.is_active = 1
            ORDER BY rp.is_company_owner DESC, rp.created_at ASC
            LIMIT 10
        `;

        const employees = await sqlService.executeQuery('RAW', employeesQuery, 
            { values: [id] }, 
            { controller: 'company.controller', function: 'getCompany' });

        const formattedCompany = {
            id: company.id,
            name: company.name,
            description: company.description,
            website: company.website,
            logoUrl: company.logo_url,
            bannerUrl: company.banner_url,
            industry: company.industry,
            companySize: company.company_size,
            location: company.location,
            foundedYear: company.founded_year,
            isVerified: company.is_verified,
            createdAt: company.created_at,
            updatedAt: company.updated_at,
            followersCount: company.followers_count,
            isFollowing: company.is_following === 1,
            jobPosts: jobPosts.map(job => ({
                id: job.id,
                postId: job.post_id,
                title: job.title,
                description: job.description,
                jobType: job.job_type,
                experienceLevel: job.experience_level,
                salaryMin: job.salary_min,
                salaryMax: job.salary_max,
                currency: job.currency,
                location: job.location,
                isRemote: job.is_remote,
                applicationDeadline: job.application_deadline,
                isActive: job.is_active,
                createdAt: job.created_at,
                applicationsCount: job.applications_count
            })),
            employees: employees.map(emp => ({
                id: emp.id,
                email: emp.email,
                profile: {
                    fullName: emp.full_name,
                    profileImage: emp.profile_image
                },
                recruiterProfile: {
                    position: emp.position,
                    department: emp.department,
                    isCompanyOwner: emp.is_company_owner
                }
            }))
        };

        res.status(200).json({
            success: true,
            message: 'Company retrieved successfully',
            data: formattedCompany
        });

    } catch (error) {
        logger.logError('Get company error:', error);
        next(error);
    }
};

// POST /api/v1/companies
exports.createCompany = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { 
            name, description, website, logoUrl, bannerUrl, industry, 
            companySize, location, foundedYear 
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }

        // Check if user is a recruiter
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['profile_type'],
            where: { id: userId }
        }, { controller: 'company.controller', function: 'createCompany' });

        if (!user || user.profile_type !== 'recruiter') {
            return res.status(403).json({
                success: false,
                message: 'Only recruiters can create companies'
            });
        }

        // Check if company name already exists
        const [existingCompany] = await sqlService.executeQuery('SELECT', 'companies', {
            columns: ['id'],
            where: { name }
        }, { controller: 'company.controller', function: 'createCompany' });

        if (existingCompany) {
            return res.status(409).json({
                success: false,
                message: 'Company with this name already exists'
            });
        }

        // Create company
        const companyId = await sqlService.executeQuery('INSERT', 'companies', {
            columns: ['name', 'description', 'website', 'logo_url', 'banner_url', 'industry', 
                     'company_size', 'location', 'founded_year'],
            values: [name, description, website, logoUrl, bannerUrl, industry, 
                    companySize, location, foundedYear]
        }, { controller: 'company.controller', function: 'createCompany' });

        // Update recruiter profile to link to this company as owner
        await sqlService.executeQuery('UPDATE', 'recruiter_profiles', {
            set: { company_id: companyId, is_company_owner: true },
            where: { user_id: userId }
        }, { controller: 'company.controller', function: 'createCompany' });

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: { id: companyId }
        });

    } catch (error) {
        logger.logError('Create company error:', error);
        next(error);
    }
};

// PUT /api/v1/companies/:id
exports.updateCompany = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { 
            name, description, website, logoUrl, bannerUrl, industry, 
            companySize, location, foundedYear 
        } = req.body;

        // Check if user is authorized to update this company
        const authQuery = `
            SELECT c.id, rp.user_id, rp.is_company_owner
            FROM companies c
            JOIN recruiter_profiles rp ON c.id = rp.company_id
            WHERE c.id = ? AND rp.user_id = ?
        `;

        const [authorization] = await sqlService.executeQuery('RAW', authQuery, 
            { values: [id, userId] }, 
            { controller: 'company.controller', function: 'updateCompany' });

        if (!authorization) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!authorization.is_company_owner) {
            return res.status(403).json({
                success: false,
                message: 'Only company owners can update company details'
            });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (website !== undefined) updateData.website = website;
        if (logoUrl !== undefined) updateData.logo_url = logoUrl;
        if (bannerUrl !== undefined) updateData.banner_url = bannerUrl;
        if (industry !== undefined) updateData.industry = industry;
        if (companySize !== undefined) updateData.company_size = companySize;
        if (location !== undefined) updateData.location = location;
        if (foundedYear !== undefined) updateData.founded_year = foundedYear;

        // Update company
        await sqlService.executeQuery('UPDATE', 'companies', {
            set: updateData,
            where: { id }
        }, { controller: 'company.controller', function: 'updateCompany' });

        res.status(200).json({
            success: true,
            message: 'Company updated successfully'
        });

    } catch (error) {
        logger.logError('Update company error:', error);
        next(error);
    }
};

// GET /api/v1/companies/:id/jobs
exports.getCompanyJobs = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10, active = 'true' } = req.query;
        const offset = (page - 1) * limit;

        let jobsQuery = `
            SELECT 
                jp.id, jp.title, jp.description, jp.requirements, jp.job_type, 
                jp.experience_level, jp.salary_min, jp.salary_max, jp.currency,
                jp.location, jp.is_remote, jp.application_deadline, jp.is_active,
                jp.created_at, jp.updated_at,
                p.id as post_id, p.content as post_content, p.user_id as poster_id,
                up.full_name as poster_name,
                (SELECT COUNT(*) FROM job_applications ja WHERE ja.job_post_id = jp.id) as applications_count
            FROM job_posts jp
            JOIN posts p ON jp.post_id = p.id
            LEFT JOIN user_profiles up ON p.user_id = up.user_id
            WHERE jp.company_id = ?
        `;

        const queryParams = [id];

        if (active !== undefined) {
            jobsQuery += ` AND jp.is_active = ?`;
            queryParams.push(active === 'true' ? 1 : 0);
        }

        jobsQuery += ` ORDER BY jp.created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const jobs = await sqlService.executeQuery('RAW', jobsQuery, 
            { values: queryParams }, 
            { controller: 'company.controller', function: 'getCompanyJobs' });

        const formattedJobs = jobs.map(job => ({
            id: job.id,
            postId: job.post_id,
            title: job.title,
            description: job.description,
            requirements: job.requirements,
            jobType: job.job_type,
            experienceLevel: job.experience_level,
            salaryMin: job.salary_min,
            salaryMax: job.salary_max,
            currency: job.currency,
            location: job.location,
            isRemote: job.is_remote,
            applicationDeadline: job.application_deadline,
            isActive: job.is_active,
            createdAt: job.created_at,
            updatedAt: job.updated_at,
            applicationsCount: job.applications_count,
            poster: {
                id: job.poster_id,
                name: job.poster_name
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Company jobs retrieved successfully',
            data: formattedJobs
        });

    } catch (error) {
        logger.logError('Get company jobs error:', error);
        next(error);
    }
};

// GET /api/v1/companies/:id/employees
exports.getCompanyEmployees = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const employeesQuery = `
            SELECT 
                u.id, u.email, u.created_at as joined_at,
                up.full_name, up.profile_image, up.bio, up.location,
                rp.position, rp.department, rp.is_company_owner, rp.hiring_authority_level
            FROM recruiter_profiles rp
            JOIN users u ON rp.user_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE rp.company_id = ? AND u.is_active = 1
            ORDER BY rp.is_company_owner DESC, rp.created_at ASC
            LIMIT ? OFFSET ?
        `;

        const employees = await sqlService.executeQuery('RAW', employeesQuery, 
            { values: [id, parseInt(limit), parseInt(offset)] }, 
            { controller: 'company.controller', function: 'getCompanyEmployees' });

        const formattedEmployees = employees.map(emp => ({
            id: emp.id,
            email: emp.email,
            joinedAt: emp.joined_at,
            profile: {
                fullName: emp.full_name,
                profileImage: emp.profile_image,
                bio: emp.bio,
                location: emp.location
            },
            recruiterProfile: {
                position: emp.position,
                department: emp.department,
                isCompanyOwner: emp.is_company_owner,
                hiringAuthorityLevel: emp.hiring_authority_level
            }
        }));

        res.status(200).json({
            success: true,
            message: 'Company employees retrieved successfully',
            data: formattedEmployees
        });

    } catch (error) {
        logger.logError('Get company employees error:', error);
        next(error);
    }
};

// GET /api/v1/companies/search
exports.searchCompanies = async (req, res, next) => {
    try {
        const { query, industry, size, location, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        if (!query || query.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters long'
            });
        }

        let searchQuery = `
            SELECT 
                c.id, c.name, c.description, c.logo_url, c.industry, 
                c.company_size, c.location, c.is_verified,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = c.id AND f.following_type = 'company') as followers_count,
                (SELECT COUNT(*) FROM job_posts jp WHERE jp.company_id = c.id AND jp.is_active = 1) as active_jobs_count
            FROM companies c
            WHERE (c.name LIKE ? OR c.description LIKE ? OR c.industry LIKE ?)
        `;

        const queryParams = [`%${query}%`, `%${query}%`, `%${query}%`];

        if (industry) {
            searchQuery += ` AND c.industry = ?`;
            queryParams.push(industry);
        }

        if (size) {
            searchQuery += ` AND c.company_size = ?`;
            queryParams.push(size);
        }

        if (location) {
            searchQuery += ` AND c.location LIKE ?`;
            queryParams.push(`%${location}%`);
        }

        searchQuery += ` ORDER BY c.is_verified DESC, followers_count DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const companies = await sqlService.executeQuery('RAW', searchQuery, 
            { values: queryParams }, 
            { controller: 'company.controller', function: 'searchCompanies' });

        const formattedCompanies = companies.map(company => ({
            id: company.id,
            name: company.name,
            description: company.description,
            logoUrl: company.logo_url,
            industry: company.industry,
            companySize: company.company_size,
            location: company.location,
            isVerified: company.is_verified,
            followersCount: company.followers_count,
            activeJobsCount: company.active_jobs_count
        }));

        res.status(200).json({
            success: true,
            message: 'Companies found successfully',
            data: formattedCompanies
        });

    } catch (error) {
        logger.logError('Search companies error:', error);
        next(error);
    }
};
