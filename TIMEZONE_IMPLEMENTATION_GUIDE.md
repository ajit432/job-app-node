# Timezone Implementation Guide

## Overview
This guide explains how to implement proper IST (Indian Standard Time) timezone handling across your Job Portal application to ensure all timestamps are stored and displayed in local time.

## Problem
Currently, your application stores timestamps in UTC format, but you want them to be stored and displayed in IST (UTC+5:30). For example:
- **Current (UTC):** `"2025-08-19T19:12:32.000Z"`
- **Desired (IST):** `"2025-08-20T00:42:32+05:30"`

## Solution Components

### 1. Enhanced Date Handler (`src/utils/dateHandler.js`)
The enhanced dateHandler now provides comprehensive timezone functions:

```javascript
const dateHandler = require('../utils/dateHandler');

// For database operations (storing timestamps)
const currentTime = dateHandler.getCurrentISTForDB(); // Returns IST in MySQL format

// For API responses (converting DB timestamps to IST)
const istTime = dateHandler.dbTimestampToIST(dbTimestamp); // Converts UTC to IST

// For general date formatting
const formattedTime = dateHandler.formatISTDate(date, 'YYYY-MM-DD HH:mm:ss');
```

### 2. Database Timezone Configuration
Run the timezone configuration script to set MySQL to IST:

```bash
mysql -u your_username -p your_database_name < configure_timezone.sql
```

### 3. Updated Database Schema
All tables now include proper charset and collation settings for better timezone support.

## Implementation Steps

### Step 1: Configure Database Timezone
```sql
-- Run this in your MySQL client
SET time_zone = '+05:30';
SET GLOBAL time_zone = '+05:30'; -- Requires SUPER privilege
```

### Step 2: Update All Controllers
Replace direct timestamp usage with dateHandler functions:

**Before:**
```javascript
createdAt: user.created_at,
updatedAt: user.updated_at
```

**After:**
```javascript
createdAt: dateHandler.dbTimestampToIST(user.created_at),
updatedAt: dateHandler.dbTimestampToIST(user.updated_at)
```

### Step 3: Update Database Operations
When inserting/updating records, use IST timestamps:

**Before:**
```javascript
created_at: new Date(),
updated_at: new Date()
```

**After:**
```javascript
created_at: dateHandler.getCurrentISTForDB(),
updated_at: dateHandler.getCurrentISTForDB()
```

## Files to Update

### Controllers
- ✅ `src/controllers/auth.controller.js` - Updated
- 🔄 `src/controllers/user.controller.js` - Needs update
- 🔄 `src/controllers/post.controller.js` - Needs update
- 🔄 `src/controllers/jobApplication.controller.js` - Needs update
- 🔄 All other controllers - Need update

### Services
- 🔄 `src/services/sql.service.js` - May need update for timestamp handling

### Database Schema
- ✅ `DATABASE_SCHEMA.md` - Updated with timezone configuration
- ✅ `create_notification_settings_table.sql` - Updated
- ✅ `configure_timezone.sql` - Created

## Testing the Implementation

### 1. Test Database Timezone
```sql
SELECT @@time_zone as current_timezone;
SELECT NOW() as current_ist_time;
SELECT UTC_TIMESTAMP() as current_utc_time;
```

### 2. Test User Registration
After implementing, register a new user and verify:
- Database stores timestamp in IST
- API response shows IST timestamp
- Time matches your local time (12:45 AM on Aug 20, 2025)

### 3. Expected Result
**Before (UTC):**
```json
{
  "createdAt": "2025-08-19T19:12:32.000Z",
  "updatedAt": "2025-08-19T19:12:32.000Z"
}
```

**After (IST):**
```json
{
  "createdAt": "2025-08-20T00:42:32+05:30",
  "updatedAt": "2025-08-20T00:42:32+05:30"
}
```

## Common Issues and Solutions

### Issue 1: Database Still Shows UTC
**Solution:** Ensure timezone configuration script is run and MySQL is restarted.

### Issue 2: Application Crashes
**Solution:** Check that moment-timezone is installed:
```bash
npm install moment-timezone
```

### Issue 3: Inconsistent Timestamps
**Solution:** Ensure all timestamp operations use dateHandler functions consistently.

## Best Practices

1. **Always use dateHandler functions** for timestamp operations
2. **Never use `new Date()`** directly for database timestamps
3. **Convert all database timestamps** to IST before sending in API responses
4. **Set database timezone** to IST for consistency
5. **Test timezone handling** across different endpoints

## Verification Checklist

- [ ] Database timezone set to IST (+05:30)
- [ ] dateHandler imported in all controllers
- [ ] All timestamp responses use `dateHandler.dbTimestampToIST()`
- [ ] All timestamp inserts use `dateHandler.getCurrentISTForDB()`
- [ ] User registration returns IST timestamps
- [ ] Login returns IST timestamps
- [ ] All other endpoints return IST timestamps

## Next Steps

1. **Run the timezone configuration script**
2. **Update all remaining controllers** to use dateHandler
3. **Test all endpoints** to ensure IST timestamps
4. **Monitor logs** for any timezone-related errors
5. **Update frontend** to handle IST timestamps properly

## Support

If you encounter issues:
1. Check the error logs
2. Verify database timezone settings
3. Ensure all imports are correct
4. Test with a simple endpoint first
