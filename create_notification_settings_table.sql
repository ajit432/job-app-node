-- Create the missing notification_settings table
-- This table is required for user registration to work properly

-- Set MySQL timezone to IST (Asia/Kolkata) for this session
SET time_zone = '+05:30';

CREATE TABLE IF NOT EXISTS notification_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    job_alerts BOOLEAN DEFAULT true,
    application_updates BOOLEAN DEFAULT true,
    new_followers BOOLEAN DEFAULT true,
    post_interactions BOOLEAN DEFAULT true,
    messages BOOLEAN DEFAULT true,
    system_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for better performance
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);

-- Insert default notification settings for existing users (if any)
-- This will ensure existing users have notification settings
INSERT IGNORE INTO notification_settings (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM notification_settings);

-- Verify the table was created
SELECT 'notification_settings table created successfully' as status;

-- Show current timezone setting
SELECT @@time_zone as current_timezone;
