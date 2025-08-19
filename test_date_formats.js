// Test script to demonstrate different date formatting options
const dateHandler = require('./src/utils/dateHandler');

console.log('=== Date Handler Formatting Examples ===\n');

// Sample database timestamp (UTC)
const sampleDbTimestamp = '2025-08-20T00:56:27.000Z';

console.log('1. Original UTC timestamp:', sampleDbTimestamp);
console.log('2. IST timestamp (default):', dateHandler.dbTimestampToIST(sampleDbTimestamp));
console.log('3. IST timestamp (display format):', dateHandler.dbTimestampToISTDisplay(sampleDbTimestamp));
console.log('4. IST timestamp (custom format):', dateHandler.dbTimestampToISTCustom(sampleDbTimestamp, 'YYYY-MM-DD HH:mm:ss'));
console.log('5. IST timestamp (date only):', dateHandler.dbTimestampToISTCustom(sampleDbTimestamp, 'YYYY-MM-DD'));
console.log('6. IST timestamp (time only):', dateHandler.dbTimestampToISTCustom(sampleDbTimestamp, 'HH:mm'));
console.log('7. IST timestamp (with day):', dateHandler.dbTimestampToISTCustom(sampleDbTimestamp, 'dddd, YYYY-MM-DD HH:mm'));

console.log('\n=== Current Time Examples ===\n');

console.log('8. Current IST time (default):', dateHandler.getCurrentIST());
console.log('9. Current IST time (display):', dateHandler.getCurrentDisplayTime());
console.log('10. Current IST time (for DB):', dateHandler.getCurrentISTForDB());

console.log('\n=== Timezone Info ===\n');

console.log('11. IST timezone offset:', dateHandler.getISTOffset(), 'minutes');
console.log('12. Default timezone:', dateHandler.DEFAULT_TIMEZONE);
console.log('13. Display format:', dateHandler.DISPLAY_DATE_TIME_FORMAT);

console.log('\n=== Expected Output for Your API ===\n');

console.log('Registration/Login response timestamps will now show as:');
console.log('createdAt: "2025-08-20  00:56"');
console.log('updatedAt: "2025-08-20  00:56"');
console.log('(Note the double space between date and time as requested)');
