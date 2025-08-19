const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const jwt = require('../utils/jwt');
const mailer = require('../utils/mailer');
const sqlService = require('../services/sql.service');
const templateService = require('../utils/template.service');
const emailManifest = require('../emailTemplates');
const { OTP_EXPIRY_MS, OTP_VALIDITY_MINUTES, SUPPORT_EMAIL } = require('../config/appConfig');
const { sanitizeValue } = require('../utils/formatter');

// POST /api/v1/auth/register
exports.register = async (req, res, next) => {
    const { email, password } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    if (!password) {
        return res.status(400).json({
            success: false,
            message: 'Password is required'
        });
    }

    try {
        // Check if user already exists
        const [existingUser] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email'],
            where: { email }
        }, { controller: 'auth.controller', function: 'register' });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Create new user
        const userData = {
            columns: ['email', 'password', 'is_active'],
            values: [email, hashedPassword, true]
        };

        const userResult = await sqlService.executeQuery('INSERT', 'users', userData, 
            { controller: 'auth.controller', function: 'register' });

        const newUserId = userResult.insertId;

        // Create user profile
        await sqlService.executeQuery('INSERT', 'user_profiles', {
            columns: ['user_id'],
            values: [newUserId]
        }, { controller: 'auth.controller', function: 'register' });

        // Create notification settings
        await sqlService.executeQuery('INSERT', 'notification_settings', {
            columns: ['user_id'],
            values: [newUserId]
        }, { controller: 'auth.controller', function: 'register' });

        // Get the created user
        const [newUser] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email', 'is_active', 'profile_type', 'created_at', 'updated_at'],
            where: { id: newUserId }
        }, { controller: 'auth.controller', function: 'register' });

        // Generate JWT token
        const token = jwt.generateToken({
            userId: newUser.id,
            email: newUser.email,
            profileType: newUser.profile_type
        });

        // Send welcome email
        try {
            const templateInfo = emailManifest.welcome;
            const html = await templateService.renderTemplate(templateInfo.templateFile, {
                title: 'Welcome to Job Portal',
                userEmail: email,
                showContainer: true,
                isShowHeader: true,
                isShowFooter: true
            });

            await mailer.sendMail({
                to: email,
                from: SUPPORT_EMAIL,
                subject: templateInfo.subject,
                html: html,
            }, 'auth.controller.js');
        } catch (emailError) {
            logger.logError('Failed to send welcome email:', emailError);
        }

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                accessToken: token,
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    isActive: newUser.is_active,
                    profileType: newUser.profile_type,
                    createdAt: newUser.created_at,
                    updatedAt: newUser.updated_at
                }
            }
        });

    } catch (error) {
        logger.logError('Registration error:', error);
        next(error);
    }
};



// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
    const { email, password, otp, loginType = 'password' } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    if (loginType === 'password' && !password) {
        return res.status(400).json({
            success: false,
            message: 'Password is required for password login'
        });
    }

    if (loginType === 'otp' && !otp) {
        return res.status(400).json({
            success: false,
            message: 'OTP is required for OTP login'
        });
    }

    try {
        // Find user
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email', 'password', 'is_active', 'profile_type', 'created_at', 'updated_at'],
            where: { email, is_active: true }
        }, { controller: 'auth.controller', function: 'login' });




        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify credentials based on login type
        if (loginType === 'password') {
            if (!user.password) {
                return res.status(401).json({
                    success: false,
                    message: 'Password not set. Please reset password.'
                });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }
        } else if (loginType === 'otp') {
            // Verify OTP
            const [validOtp] = await sqlService.executeQuery('SELECT', 'otp_verifications', {
                columns: ['id', 'expires_at'],
                where: { email, otp }
            }, { controller: 'auth.controller', function: 'login' });

            if (!validOtp) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid OTP'
                });
            }

            if (new Date() > new Date(validOtp.expires_at)) {
                await sqlService.executeQuery('DELETE', 'otp_verifications', {
                    where: { id: validOtp.id }
                }, { controller: 'auth.controller', function: 'login' });

                return res.status(401).json({
                    success: false,
                    message: 'OTP has expired'
                });
            }

            // Delete used OTP
            await sqlService.executeQuery('DELETE', 'otp_verifications', {
                where: { id: validOtp.id }
            }, { controller: 'auth.controller', function: 'login' });
        }

        // Generate JWT token
        const token = jwt.generateToken({
            userId: user.id,
            email: user.email,
            profileType: user.profile_type
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken: token,
                user: {
                    id: user.id,
                    email: user.email,
                    isActive: user.is_active,
                    profileType: user.profile_type,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            }
        });

    } catch (error) {
        logger.logError('Login error:', error);
        next(error);
    }
};

// POST /api/v1/auth/request-otp
exports.requestOtp = async (req, res, next) => {
    const { email, type = 'login' } = req.body;
    
    if (!email) {
        return res.status(400).json({
            success: false,
            message: 'Email is required'
        });
    }

    try {
        // For login OTP, check if user exists
        if (type === 'login') {
            const [user] = await sqlService.executeQuery('SELECT', 'users', {
                columns: ['id'],
                where: { email, is_active: true }
            }, { controller: 'auth.controller', function: 'requestOtp' });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'No active user found with this email'
                });
            }
        }

        // Delete existing OTPs for this email
        await sqlService.executeQuery('DELETE', 'otp_verifications', {
            where: { email }
        }, { controller: 'auth.controller', function: 'requestOtp' });

        // Generate new OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

        // Store OTP
        await sqlService.executeQuery('INSERT', 'otp_verifications', {
            columns: ['email', 'otp', 'expires_at'],
            values: [email, otpCode, expiresAt]
        }, { controller: 'auth.controller', function: 'requestOtp' });

        // Send OTP email
        const templateInfo = emailManifest.otpRequest;
        const html = await templateService.renderTemplate(templateInfo.templateFile, {
            title: 'Your One-Time Password (OTP)',
            otp: otpCode,
            validityMinutes: OTP_VALIDITY_MINUTES,
            showContainer: true,
            isShowHeader: false,
            isShowFooter: false
        });

        await mailer.sendMail({
            to: email,
            from: SUPPORT_EMAIL,
            subject: templateInfo.subject(false),
            html: html,
        }, 'auth.controller.js');

        res.status(200).json({
            success: true,
            message: 'OTP has been sent to your email',
            data: {
                expiresAt,
                otpCode
            }
        });

    } catch (error) {
        logger.logError('Request OTP error:', error);
        next(error);
    }
};

// POST /api/v1/auth/verify-otp
exports.verifyOtp = async (req, res, next) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({
            success: false,
            message: 'Email and OTP are required'
        });
    }

    try {
        // Find and verify OTP
        const [validOtp] = await sqlService.executeQuery('SELECT', 'otp_verifications', {
            columns: ['id', 'expires_at'],
            where: { email, otp }
        }, { controller: 'auth.controller', function: 'verifyOtp' });

        if (!validOtp) {
            return res.status(401).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        if (new Date() > new Date(validOtp.expires_at)) {
            await sqlService.executeQuery('DELETE', 'otp_verifications', {
                where: { id: validOtp.id }
            }, { controller: 'auth.controller', function: 'verifyOtp' });

            return res.status(401).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Delete used OTP
        await sqlService.executeQuery('DELETE', 'otp_verifications', {
            where: { id: validOtp.id }
        }, { controller: 'auth.controller', function: 'verifyOtp' });

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            data: {
                token: jwt.generateToken({ email, verified: true }, '15m') // Short-lived token for password reset
            }
        });

    } catch (error) {
        logger.logError('Verify OTP error:', error);
        next(error);
    }
};

// POST /api/v1/auth/reset-password
exports.resetPassword = async (req, res, next) => {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword) {
        return res.status(400).json({
            success: false,
            message: 'Email, OTP, and new password are required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters long'
        });
    }

    try {
        // Verify OTP
        const [validOtp] = await sqlService.executeQuery('SELECT', 'otp_verifications', {
            columns: ['id', 'expires_at'],
            where: { email, otp }
        }, { controller: 'auth.controller', function: 'resetPassword' });

        if (!validOtp) {
            return res.status(401).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        if (new Date() > new Date(validOtp.expires_at)) {
            await sqlService.executeQuery('DELETE', 'otp_verifications', {
                where: { id: validOtp.id }
            }, { controller: 'auth.controller', function: 'resetPassword' });

            return res.status(401).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Find user
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id'],
            where: { email, is_active: true }
        }, { controller: 'auth.controller', function: 'resetPassword' });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        await sqlService.executeQuery('UPDATE', 'users', {
            set: { password: hashedPassword },
            where: { id: user.id }
        }, { controller: 'auth.controller', function: 'resetPassword' });

        // Delete used OTP
        await sqlService.executeQuery('DELETE', 'otp_verifications', {
            where: { id: validOtp.id }
        }, { controller: 'auth.controller', function: 'resetPassword' });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        logger.logError('Reset password error:', error);
        next(error);
    }
};

// POST /api/v1/auth/refresh-token
exports.refreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: 'Refresh token is required'
        });
    }

    try {
        // Verify refresh token
        const decoded = jwt.verifyToken(refreshToken);
        
        // Check if user still exists and is active
        const [user] = await sqlService.executeQuery('SELECT', 'users', {
            columns: ['id', 'email', 'is_active', 'profile_type'],
            where: { id: decoded.userId, is_active: true }
        }, { controller: 'auth.controller', function: 'refreshToken' });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        // Generate new access token
        const newToken = jwt.generateToken({
            userId: user.id,
            email: user.email,
            profileType: user.profile_type
        });

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: newToken
            }
        });

    } catch (error) {
        logger.logError('Refresh token error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid refresh token'
        });
    }
};

// POST /api/v1/auth/logout
exports.logout = async (req, res, next) => {
    try {
        // In a stateless JWT system, logout is handled client-side
        // But we can add token blacklisting if needed
        
        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger.logError('Logout error:', error);
        next(error);
    }
};
