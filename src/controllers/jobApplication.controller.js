const sqlService = require('../services/sql.service');
const logger = require('../utils/logger');
const mailer = require('../utils/mailer');
const templateService = require('../utils/template.service');
const emailManifest = require('../emailTemplates');
const { SUPPORT_EMAIL } = require('../config/appConfig');

// POST /api/v1/job-applications
exports.applyForJob = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { jobPostId, coverLetter, resumeUrl } = req.body;

        if (!jobPostId) {
            return res.status(400).json({
                success: false,
                message: 'Job post ID is required'
            });
        }

        // Check if user has job seeker profile
        const [userProfile] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['profile_type'],
            where: { id: userId }
        }, { controller: 'jobApplication.controller', function: 'applyForJob' });

        if (!userProfile || userProfile.profile_type !== 'job_seeker') {
            return res.status(403).json({
                success: false,
                message: 'Only job seekers can apply for jobs'
            });
        }

        // Check if job post exists and is active
        const jobQuery = `
            SELECT jp.*, p.user_id as poster_id, c.name as company_name
            FROM job_posts jp
            JOIN posts p ON jp.post_id = p.id
            LEFT JOIN companies c ON jp.company_id = c.id
            WHERE jp.id = ? AND jp.is_active = 1
        `;

        const [jobPost] = await sqlService.executeQuery('RAW', jobQuery, 
            { values: [jobPostId] }, 
            { controller: 'jobApplication.controller', function: 'applyForJob' });

        if (!jobPost) {
            return res.status(404).json({
                success: false,
                message: 'Job post not found or no longer active'
            });
        }

        // Check if application deadline has passed
        if (jobPost.application_deadline && new Date() > new Date(jobPost.application_deadline)) {
            return res.status(400).json({
                success: false,
                message: 'Application deadline has passed'
            });
        }

        // Check if user has already applied
        const [existingApplication] = await sqlService.executeQuery('SELECT', 'job_applications', {
            columns: ['id'],
            where: { job_post_id: jobPostId, applicant_id: userId }
        }, { controller: 'jobApplication.controller', function: 'applyForJob' });

        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message: 'You have already applied for this job'
            });
        }

        // Get user's resume URL if not provided
        let finalResumeUrl = resumeUrl;
        if (!finalResumeUrl) {
            const [jobSeekerProfile] = await sqlService.executeQuery('SELECT', 'job_seeker_profiles', {
                columns: ['resume_url'],
                where: { user_id: userId }
            }, { controller: 'jobApplication.controller', function: 'applyForJob' });

            finalResumeUrl = jobSeekerProfile?.resume_url;
        }

        // Create application
        const applicationId = await sqlService.executeQuery('INSERT', 'job_applications', {
            columns: ['job_post_id', 'applicant_id', 'cover_letter', 'resume_url', 'status'],
            values: [jobPostId, userId, coverLetter, finalResumeUrl, 'applied']
        }, { controller: 'jobApplication.controller', function: 'applyForJob' });

        // Create notification for job poster
        const io = req.app.get('io');
        
        await sqlService.executeQuery('INSERT', 'notifications', {
            columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
            values: [
                jobPost.poster_id, 
                'New Job Application', 
                `Someone applied for your job: ${jobPost.title}`, 
                'job_application', 
                applicationId,
                JSON.stringify({ jobPostId, applicationId, userId })
            ]
        }, { controller: 'jobApplication.controller', function: 'applyForJob' });

        // Emit real-time notification
        io.emit(`notification_${jobPost.poster_id}`, {
            type: 'job_application',
            message: `Someone applied for your job: ${jobPost.title}`,
            applicationId: applicationId
        });

        // Send email notification to job poster
        try {
            const [posterProfile] = await sqlService.executeQuery('RAW', 
                'SELECT u.email, up.full_name FROM users u LEFT JOIN user_profiles up ON u.id = up.user_id WHERE u.id = ?', 
                { values: [jobPost.poster_id] }, 
                { controller: 'jobApplication.controller', function: 'applyForJob' });

            if (posterProfile) {
                const html = await templateService.renderTemplate('jobApplication.html', {
                    title: 'New Job Application',
                    jobTitle: jobPost.title,
                    companyName: jobPost.company_name || 'Your Company',
                    showContainer: true,
                    isShowHeader: true,
                    isShowFooter: true
                });

                await mailer.sendMail({
                    to: posterProfile.email,
                    from: SUPPORT_EMAIL,
                    subject: `New Application for ${jobPost.title}`,
                    html: html,
                }, 'jobApplication.controller.js');
            }
        } catch (emailError) {
            logger.logError('Failed to send job application notification email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: { id: applicationId }
        });

    } catch (error) {
        logger.logError('Apply for job error:', error);
        next(error);
    }
};

// GET /api/v1/job-applications/my-applications
exports.getMyApplications = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let applicationsQuery = `
            SELECT 
                ja.id, ja.job_post_id, ja.cover_letter, ja.resume_url, ja.status, 
                ja.applied_at, ja.updated_at,
                jp.title, jp.description, jp.job_type, jp.experience_level, 
                jp.salary_min, jp.salary_max, jp.currency, jp.location, jp.is_remote,
                jp.application_deadline, jp.is_active,
                c.id as company_id, c.name as company_name, c.logo_url as company_logo,
                p.user_id as poster_id,
                up.full_name as poster_name,
                is_sched.id as interview_id, is_sched.interview_type, is_sched.scheduled_at, 
                is_sched.duration_minutes, is_sched.meeting_link, is_sched.location as interview_location,
                is_sched.status as interview_status
            FROM job_applications ja
            JOIN job_posts jp ON ja.job_post_id = jp.id
            JOIN posts p ON jp.post_id = p.id
            LEFT JOIN companies c ON jp.company_id = c.id
            LEFT JOIN user_profiles up ON p.user_id = up.user_id
            LEFT JOIN interview_schedules is_sched ON ja.id = is_sched.application_id
            WHERE ja.applicant_id = ?
        `;

        const queryParams = [userId];

        if (status) {
            applicationsQuery += ` AND ja.status = ?`;
            queryParams.push(status);
        }

        applicationsQuery += ` ORDER BY ja.applied_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const applications = await sqlService.executeQuery('RAW', applicationsQuery, 
            { values: queryParams }, 
            { controller: 'jobApplication.controller', function: 'getMyApplications' });

        const formattedApplications = applications.map(app => ({
            id: app.id,
            jobPostId: app.job_post_id,
            coverLetter: app.cover_letter,
            resumeUrl: app.resume_url,
            status: app.status,
            appliedAt: app.applied_at,
            updatedAt: app.updated_at,
            jobPost: {
                id: app.job_post_id,
                title: app.title,
                description: app.description,
                jobType: app.job_type,
                experienceLevel: app.experience_level,
                salaryMin: app.salary_min,
                salaryMax: app.salary_max,
                currency: app.currency,
                location: app.location,
                isRemote: app.is_remote,
                applicationDeadline: app.application_deadline,
                isActive: app.is_active,
                company: app.company_id ? {
                    id: app.company_id,
                    name: app.company_name,
                    logoUrl: app.company_logo
                } : null,
                poster: {
                    id: app.poster_id,
                    name: app.poster_name
                }
            },
            interview: app.interview_id ? {
                id: app.interview_id,
                interviewType: app.interview_type,
                scheduledAt: app.scheduled_at,
                durationMinutes: app.duration_minutes,
                meetingLink: app.meeting_link,
                location: app.interview_location,
                status: app.interview_status
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Applications retrieved successfully',
            data: formattedApplications
        });

    } catch (error) {
        logger.logError('Get my applications error:', error);
        next(error);
    }
};

// GET /api/v1/job-applications/job/:jobPostId
exports.getJobApplications = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { jobPostId } = req.params;
        const { status, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Check if user owns this job post or is authorized
        const jobQuery = `
            SELECT jp.*, p.user_id as poster_id
            FROM job_posts jp
            JOIN posts p ON jp.post_id = p.id
            WHERE jp.id = ?
        `;

        const [jobPost] = await sqlService.executeQuery('RAW', jobQuery, 
            { values: [jobPostId] }, 
            { controller: 'jobApplication.controller', function: 'getJobApplications' });

        if (!jobPost) {
            return res.status(404).json({
                success: false,
                message: 'Job post not found'
            });
        }

        if (jobPost.poster_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        let applicationsQuery = `
            SELECT 
                ja.id, ja.job_post_id, ja.applicant_id, ja.cover_letter, ja.resume_url, 
                ja.status, ja.applied_at, ja.updated_at,
                u.email as applicant_email,
                up.full_name, up.profile_image, up.bio, up.location, up.phone,
                jsp.experience_years, jsp.current_salary, jsp.expected_salary, jsp.availability_status,
                is_sched.id as interview_id, is_sched.interview_type, is_sched.scheduled_at, 
                is_sched.duration_minutes, is_sched.meeting_link, is_sched.location as interview_location,
                is_sched.status as interview_status
            FROM job_applications ja
            JOIN users u ON ja.applicant_id = u.id
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
            LEFT JOIN interview_schedules is_sched ON ja.id = is_sched.application_id
            WHERE ja.job_post_id = ?
        `;

        const queryParams = [jobPostId];

        if (status) {
            applicationsQuery += ` AND ja.status = ?`;
            queryParams.push(status);
        }

        applicationsQuery += ` ORDER BY ja.applied_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        const applications = await sqlService.executeQuery('RAW', applicationsQuery, 
            { values: queryParams }, 
            { controller: 'jobApplication.controller', function: 'getJobApplications' });

        // Get skills for each applicant
        for (let app of applications) {
            const skillsQuery = `
                SELECT us.proficiency_level, us.years_of_experience, s.id, s.name, s.category
                FROM user_skills us
                JOIN skills s ON us.skill_id = s.id
                WHERE us.user_id = ?
            `;
            const skills = await sqlService.executeQuery('RAW', skillsQuery, 
                { values: [app.applicant_id] }, 
                { controller: 'jobApplication.controller', function: 'getJobApplications' });
            
            app.applicant_skills = skills;
        }

        const formattedApplications = applications.map(app => ({
            id: app.id,
            jobPostId: app.job_post_id,
            applicantId: app.applicant_id,
            coverLetter: app.cover_letter,
            resumeUrl: app.resume_url,
            status: app.status,
            appliedAt: app.applied_at,
            updatedAt: app.updated_at,
            applicant: {
                id: app.applicant_id,
                email: app.applicant_email,
                profile: {
                    fullName: app.full_name,
                    profileImage: app.profile_image,
                    bio: app.bio,
                    location: app.location,
                    phone: app.phone
                },
                jobSeekerProfile: {
                    experienceYears: app.experience_years,
                    currentSalary: app.current_salary,
                    expectedSalary: app.expected_salary,
                    availabilityStatus: app.availability_status
                },
                skills: app.applicant_skills || []
            },
            interview: app.interview_id ? {
                id: app.interview_id,
                interviewType: app.interview_type,
                scheduledAt: app.scheduled_at,
                durationMinutes: app.duration_minutes,
                meetingLink: app.meeting_link,
                location: app.interview_location,
                status: app.interview_status
            } : null
        }));

        res.status(200).json({
            success: true,
            message: 'Job applications retrieved successfully',
            data: formattedApplications
        });

    } catch (error) {
        logger.logError('Get job applications error:', error);
        next(error);
    }
};

// PUT /api/v1/job-applications/:id/status
exports.updateApplicationStatus = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['applied', 'under_review', 'shortlisted', 'interview_scheduled', 'rejected', 'hired'];
        
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status is required'
            });
        }

        // Check if application exists and user is authorized
        const applicationQuery = `
            SELECT ja.*, jp.title as job_title, p.user_id as poster_id
            FROM job_applications ja
            JOIN job_posts jp ON ja.job_post_id = jp.id
            JOIN posts p ON jp.post_id = p.id
            WHERE ja.id = ?
        `;

        const [application] = await sqlService.executeQuery('RAW', applicationQuery, 
            { values: [id] }, 
            { controller: 'jobApplication.controller', function: 'updateApplicationStatus' });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        if (application.poster_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Update status
        await sqlService.executeQuery('UPDATE', 'job_applications', {
            set: { status },
            where: { id }
        }, { controller: 'jobApplication.controller', function: 'updateApplicationStatus' });

        // Create notification for applicant
        const io = req.app.get('io');
        
        const statusMessages = {
            under_review: 'Your application is under review',
            shortlisted: 'Congratulations! You have been shortlisted',
            interview_scheduled: 'Your interview has been scheduled',
            rejected: 'Your application was not selected',
            hired: 'Congratulations! You have been hired'
        };

        if (statusMessages[status]) {
            await sqlService.executeQuery('INSERT', 'notifications', {
                columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
                values: [
                    application.applicant_id, 
                    'Application Status Update', 
                    `${statusMessages[status]} for ${application.job_title}`, 
                    'job_application', 
                    id,
                    JSON.stringify({ status, jobTitle: application.job_title })
                ]
            }, { controller: 'jobApplication.controller', function: 'updateApplicationStatus' });

            // Emit real-time notification
            io.emit(`notification_${application.applicant_id}`, {
                type: 'application_status',
                message: `${statusMessages[status]} for ${application.job_title}`,
                applicationId: id,
                status: status
            });
        }

        res.status(200).json({
            success: true,
            message: 'Application status updated successfully'
        });

    } catch (error) {
        logger.logError('Update application status error:', error);
        next(error);
    }
};

// DELETE /api/v1/job-applications/:id
exports.withdrawApplication = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        // Check if application exists and belongs to user
        const [application] = await sqlService.executeQuery('SELECT', 'job_applications', {
            columns: ['id', 'applicant_id', 'status'],
            where: { id, applicant_id: userId }
        }, { controller: 'jobApplication.controller', function: 'withdrawApplication' });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Check if application can be withdrawn
        if (['hired', 'rejected'].includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot withdraw application with current status'
            });
        }

        // Delete application
        await sqlService.executeQuery('DELETE', 'job_applications', {
            where: { id }
        }, { controller: 'jobApplication.controller', function: 'withdrawApplication' });

        res.status(200).json({
            success: true,
            message: 'Application withdrawn successfully'
        });

    } catch (error) {
        logger.logError('Withdraw application error:', error);
        next(error);
    }
};

// POST /api/v1/job-applications/:id/schedule-interview
exports.scheduleInterview = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const { 
            interviewType, scheduledAt, durationMinutes = 60, 
            meetingLink, location, notes 
        } = req.body;

        if (!interviewType || !scheduledAt) {
            return res.status(400).json({
                success: false,
                message: 'Interview type and scheduled time are required'
            });
        }

        const validTypes = ['phone', 'video', 'in_person', 'technical', 'hr'];
        if (!validTypes.includes(interviewType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid interview type'
            });
        }

        // Check if application exists and user is authorized
        const applicationQuery = `
            SELECT ja.*, jp.title as job_title, p.user_id as poster_id
            FROM job_applications ja
            JOIN job_posts jp ON ja.job_post_id = jp.id
            JOIN posts p ON jp.post_id = p.id
            WHERE ja.id = ?
        `;

        const [application] = await sqlService.executeQuery('RAW', applicationQuery, 
            { values: [id] }, 
            { controller: 'jobApplication.controller', function: 'scheduleInterview' });

        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        if (application.poster_id !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check if interview already scheduled
        const [existingInterview] = await sqlService.executeQuery('SELECT', 'interview_schedules', {
            columns: ['id'],
            where: { application_id: id }
        }, { controller: 'jobApplication.controller', function: 'scheduleInterview' });

        if (existingInterview) {
            return res.status(409).json({
                success: false,
                message: 'Interview already scheduled for this application'
            });
        }

        // Create interview schedule
        const interviewId = await sqlService.executeQuery('INSERT', 'interview_schedules', {
            columns: ['application_id', 'interviewer_id', 'interview_type', 'scheduled_at', 
                     'duration_minutes', 'meeting_link', 'location', 'notes'],
            values: [id, userId, interviewType, scheduledAt, durationMinutes, 
                    meetingLink, location, notes]
        }, { controller: 'jobApplication.controller', function: 'scheduleInterview' });

        // Update application status
        await sqlService.executeQuery('UPDATE', 'job_applications', {
            set: { status: 'interview_scheduled' },
            where: { id }
        }, { controller: 'jobApplication.controller', function: 'scheduleInterview' });

        // Create notification for applicant
        const io = req.app.get('io');
        
        await sqlService.executeQuery('INSERT', 'notifications', {
            columns: ['user_id', 'title', 'content', 'notification_type', 'related_id', 'metadata'],
            values: [
                application.applicant_id, 
                'Interview Scheduled', 
                `Your interview has been scheduled for ${application.job_title}`, 
                'interview_scheduled', 
                interviewId,
                JSON.stringify({ 
                    applicationId: id, 
                    interviewType, 
                    scheduledAt, 
                    jobTitle: application.job_title 
                })
            ]
        }, { controller: 'jobApplication.controller', function: 'scheduleInterview' });

        // Emit real-time notification
        io.emit(`notification_${application.applicant_id}`, {
            type: 'interview_scheduled',
            message: `Your interview has been scheduled for ${application.job_title}`,
            interviewId: interviewId,
            scheduledAt: scheduledAt
        });

        res.status(201).json({
            success: true,
            message: 'Interview scheduled successfully',
            data: { id: interviewId }
        });

    } catch (error) {
        logger.logError('Schedule interview error:', error);
        next(error);
    }
};
