-- Configure MySQL timezone to IST (Asia/Kolkata) for proper timestamp handling
-- This script ensures all timestamps are stored and retrieved in IST timezone

-- Set timezone for current session
SET time_zone = '+05:30';

-- Set timezone globally (requires SUPER privilege)
-- SET GLOBAL time_zone = '+05:30';

-- Verify current timezone setting
SELECT @@time_zone as current_timezone;

-- Show current timestamp in IST
SELECT NOW() as current_ist_time;

-- Show UTC time for comparison
SELECT UTC_TIMESTAMP() as current_utc_time;

-- Update existing tables to use IST timezone (if needed)
-- This will ensure all future timestamps use IST

-- Check if timezone tables are loaded
SELECT COUNT(*) as timezone_tables_count 
FROM information_schema.tables 
WHERE table_schema = 'mysql' 
AND table_name = 'time_zone_name';

-- If timezone tables are not loaded, you may need to run:
-- mysql_tzinfo_to_sql /usr/share/zoneinfo | mysql -u root -p mysql

-- Alternative: Set timezone using offset
-- SET time_zone = '+05:30';

-- Verify the change took effect
SELECT 
    @@global.time_zone as global_timezone,
    @@session.time_zone as session_timezone,
    NOW() as current_time,
    UTC_TIMESTAMP() as utc_time;
