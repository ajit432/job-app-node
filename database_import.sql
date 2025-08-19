-- Job Portal Database Schema
-- SQL Import File
-- Generated from DATABASE_SCHEMA.md

-- Create database (uncomment if needed)
-- CREATE DATABASE job_portal;
-- USE job_portal;

-- ==============================================
-- CORE TABLES
-- ==============================================

-- 1. Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    profile_type ENUM('job_seeker', 'recruiter') DEFAULT NULL, -- Set only once
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. OTP Verification Table
CREATE TABLE otp_verifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_expires (email, expires_at)
);

-- 3. User Profiles Table
CREATE TABLE user_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    full_name VARCHAR(255),
    profile_image VARCHAR(500),
    banner_image VARCHAR(500),
    bio TEXT,
    location VARCHAR(255),
    preferred_job_location VARCHAR(255),
    phone VARCHAR(20),
    website VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Job Seeker Profiles Table
CREATE TABLE job_seeker_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    resume_url VARCHAR(500),
    experience_years INT DEFAULT 0,
    current_salary DECIMAL(10,2),
    expected_salary DECIMAL(10,2),
    availability_status ENUM('immediately', 'within_month', 'within_3_months', 'not_looking') DEFAULT 'not_looking',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Skills Table
CREATE TABLE skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100), -- e.g., 'programming', 'design', 'management'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. User Skills Table
CREATE TABLE user_skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    skill_id INT NOT NULL,
    proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    years_of_experience INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_skill (user_id, skill_id)
);

-- 7. Education Table
CREATE TABLE education (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    institution_name VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    education_level ENUM('10th', '12th', 'diploma', 'bachelor', 'master', 'doctorate') NOT NULL,
    start_date DATE,
    end_date DATE,
    grade_percentage DECIMAL(5,2),
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Experience Table
CREATE TABLE experience (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    employment_type ENUM('full_time', 'part_time', 'contract', 'internship', 'freelance') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT false,
    description TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. Companies Table
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    website VARCHAR(500),
    logo_url VARCHAR(500),
    banner_url VARCHAR(500),
    industry VARCHAR(255),
    company_size ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
    location VARCHAR(255),
    founded_year YEAR,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 10. Recruiter Profiles Table
CREATE TABLE recruiter_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    company_id INT,
    position VARCHAR(255),
    is_company_owner BOOLEAN DEFAULT false,
    department VARCHAR(255),
    hiring_authority_level ENUM('junior', 'senior', 'lead', 'manager', 'director') DEFAULT 'junior',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- ==============================================
-- SOCIAL FEATURES TABLES
-- ==============================================

-- 11. Posts Table
CREATE TABLE posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    post_type ENUM('personal', 'job', 'company_update') NOT NULL,
    media_urls JSON, -- Array of image/video URLs
    is_comments_enabled BOOLEAN DEFAULT true,
    visibility ENUM('public', 'followers', 'private') DEFAULT 'followers',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_type_created (post_type, created_at)
);

-- 12. Job Posts Table
CREATE TABLE job_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    company_id INT,
    job_type ENUM('full_time', 'part_time', 'contract', 'internship', 'freelance') NOT NULL,
    experience_level ENUM('entry', 'mid', 'senior', 'lead', 'executive') NOT NULL,
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT false,
    application_deadline DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    INDEX idx_active_created (is_active, created_at),
    INDEX idx_location_type (location, job_type)
);

-- 13. Job Skills Required Table
CREATE TABLE job_skills_required (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_post_id INT NOT NULL,
    skill_id INT NOT NULL,
    is_required BOOLEAN DEFAULT true,
    proficiency_level ENUM('beginner', 'intermediate', 'advanced', 'expert') DEFAULT 'intermediate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    UNIQUE KEY unique_job_skill (job_post_id, skill_id)
);

-- 14. Follows Table
CREATE TABLE follows (
    id INT PRIMARY KEY AUTO_INCREMENT,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    following_type ENUM('user', 'company') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_follow (follower_id, following_id, following_type),
    INDEX idx_follower (follower_id),
    INDEX idx_following (following_id, following_type)
);

-- 15. Post Interactions Table
CREATE TABLE post_interactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    interaction_type ENUM('like', 'love', 'support', 'save') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_post_interaction (user_id, post_id, interaction_type),
    INDEX idx_post_type (post_id, interaction_type)
);

-- 16. Comments Table
CREATE TABLE comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    post_id INT NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INT, -- For nested comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_post_created (post_id, created_at)
);

-- ==============================================
-- JOB APPLICATION SYSTEM
-- ==============================================

-- 17. Job Applications Table
CREATE TABLE job_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    job_post_id INT NOT NULL,
    applicant_id INT NOT NULL,
    cover_letter TEXT,
    resume_url VARCHAR(500),
    status ENUM('applied', 'under_review', 'shortlisted', 'interview_scheduled', 'rejected', 'hired') DEFAULT 'applied',
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (job_post_id) REFERENCES job_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (job_post_id, applicant_id),
    INDEX idx_applicant_status (applicant_id, status),
    INDEX idx_job_status (job_post_id, status)
);

-- 18. Interview Schedules Table
CREATE TABLE interview_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    application_id INT UNIQUE NOT NULL,
    interviewer_id INT NOT NULL,
    interview_type ENUM('phone', 'video', 'in_person', 'technical', 'hr') NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INT DEFAULT 60,
    meeting_link VARCHAR(500),
    location VARCHAR(255),
    notes TEXT,
    status ENUM('scheduled', 'completed', 'cancelled', 'rescheduled') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==============================================
-- CHAT SYSTEM
-- ==============================================

-- 19. Chat Conversations Table
CREATE TABLE chat_conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id)),
    INDEX idx_users (user1_id, user2_id)
);

-- 20. Chat Messages Table
CREATE TABLE chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file', 'link') DEFAULT 'text',
    file_url VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation_created (conversation_id, created_at)
);

-- ==============================================
-- NOTIFICATION SYSTEM
-- ==============================================

-- 21. Notifications Table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    notification_type ENUM('job_application', 'interview_scheduled', 'new_follower', 'post_interaction', 'message', 'system') NOT NULL,
    related_id INT, -- ID of related entity (post_id, application_id, etc.)
    metadata JSON, -- Additional data specific to notification type
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read_created (user_id, is_read, created_at)
);

-- 22. Notification Settings Table
CREATE TABLE notification_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    job_applications BOOLEAN DEFAULT true,
    interview_schedules BOOLEAN DEFAULT true,
    new_followers BOOLEAN DEFAULT true,
    post_interactions BOOLEAN DEFAULT true,
    messages BOOLEAN DEFAULT true,
    system BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==============================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ==============================================

-- Performance indexes
CREATE INDEX idx_posts_user_type_created ON posts(user_id, post_type, created_at);
CREATE INDEX idx_job_posts_active_location ON job_posts(is_active, location, created_at);
CREATE INDEX idx_applications_status_date ON job_applications(status, applied_at);
CREATE INDEX idx_follows_follower_type ON follows(follower_id, following_type);
CREATE INDEX idx_user_skills_user ON user_skills(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at);

-- ==============================================
-- SAMPLE DATA (Optional - Remove if not needed)
-- ==============================================

-- Insert some sample skills
INSERT INTO skills (name, category) VALUES
('JavaScript', 'programming'),
('Python', 'programming'),
('Java', 'programming'),
('React', 'programming'),
('Node.js', 'programming'),
('SQL', 'database'),
('MongoDB', 'database'),
('Docker', 'devops'),
('AWS', 'cloud'),
('Project Management', 'management'),
('UI/UX Design', 'design'),
('Marketing', 'business'),
('Sales', 'business'),
('Communication', 'soft_skill'),
('Leadership', 'soft_skill');

-- ==============================================
-- END OF FILE
-- ==============================================
