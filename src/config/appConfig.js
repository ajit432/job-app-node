const OTP_VALIDITY_MINUTES = 10;

module.exports = {
  // OTP Configuration
  OTP_VALIDITY_MINUTES: OTP_VALIDITY_MINUTES,
  OTP_EXPIRY_MS: OTP_VALIDITY_MINUTES * 60 * 1000,
  
  // Email Configuration
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'ajitoff875@gmail.com',
  
  // File Upload Configuration
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'gif'],
  ALLOWED_DOCUMENT_TYPES: ['pdf', 'doc', 'docx'],
  
  // Pagination
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // Security
  BCRYPT_ROUNDS: 12,
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  AUTH_RATE_LIMIT_MAX_REQUESTS: 10,
  
  // Database
  DB_CONNECTION_LIMIT: 10,
  
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // URLs
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000/api',
  
  // Upload Directories
  UPLOAD_DIR: 'uploads',
  IMAGE_UPLOAD_DIR: 'uploads/images',
  RESUME_UPLOAD_DIR: 'uploads/resumes',
  
  // Notification Settings
  NOTIFICATION_BATCH_SIZE: 50,
  
  // Cache Settings
  CACHE_TTL: 60 * 60 * 1000, // 1 hour
  
  // Social Features
  MAX_FOLLOW_SUGGESTIONS: 20,
  MAX_SKILL_SUGGESTIONS: 10,
  
  // Job Portal Specific
  JOB_APPLICATION_DEADLINE_DAYS: 30,
  MAX_JOB_APPLICATIONS_PER_USER: 50,
  
  // Search
  MIN_SEARCH_QUERY_LENGTH: 2,
  MAX_SEARCH_RESULTS: 100
};

 