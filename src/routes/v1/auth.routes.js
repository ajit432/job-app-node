const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const { validateRegistration, validateLogin, validateOtpRequest } = require('../../middleware/validation');

// Registration routes
router.post('/register', validateRegistration, authController.register);

// Login routes
router.post('/login', validateLogin, authController.login);

// OTP routes
router.post('/request-otp', validateOtpRequest, authController.requestOtp);
router.post('/verify-otp', authController.verifyOtp);

// Password reset
router.post('/reset-password', authController.resetPassword);

// Token management
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;
