const express = require('express');
const router = express.Router();
const companyController = require('../../controllers/company.controller');
const auth = require('../../middleware/auth');

// Company routes
router.get('/', auth.authMiddleware, companyController.getCompanies);
router.get('/search', auth.authMiddleware, companyController.searchCompanies);
router.post('/', auth.authMiddleware, companyController.createCompany);

// Individual company routes
router.get('/:id', auth.authMiddleware, companyController.getCompany);
router.put('/:id', auth.authMiddleware, companyController.updateCompany);

// Company-specific data
router.get('/:id/jobs', auth.authMiddleware, companyController.getCompanyJobs);
router.get('/:id/employees', auth.authMiddleware, companyController.getCompanyEmployees);

module.exports = router;
