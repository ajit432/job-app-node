const express = require('express');
const router = express.Router();
const jobApplicationController = require('../../controllers/jobApplication.controller');
const auth = require('../../middleware/auth');

// Job application routes
router.post('/', auth.authMiddleware, jobApplicationController.applyForJob);
router.get('/my-applications', auth.authMiddleware, jobApplicationController.getMyApplications);
router.get('/job/:jobPostId', auth.authMiddleware, jobApplicationController.getJobApplications);

// Application management
router.put('/:id/status', auth.authMiddleware, jobApplicationController.updateApplicationStatus);
router.delete('/:id', auth.authMiddleware, jobApplicationController.withdrawApplication);

// Interview scheduling
router.post('/:id/schedule-interview', auth.authMiddleware, jobApplicationController.scheduleInterview);

module.exports = router;
