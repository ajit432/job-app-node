// utils/dateHandler.js
//This Files helps To Handel The Date And Time , To handle date and time, simply import this file.
const moment = require('moment-timezone');

const DEFAULT_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DEFAULT_DATE_ONLY_FORMAT = 'YYYY-MM-DD';
const DEFAULT_TIMEZONE = 'Asia/Kolkata'; // IST timezone
const DISPLAY_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm'; // Display format for API responses

/**
 * Convert UTC date to IST and format it
 * @param {Date|string} date - UTC date or timestamp
 * @param {string} format - Optional format string
 * @returns {string} IST formatted date
 */
const convertToIST = (date, format = DEFAULT_DATE_TIME_FORMAT) => {
  if (!date) return null;
  return moment.utc(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Get current IST date/time
 */
const getCurrentIST = (format = DEFAULT_DATE_TIME_FORMAT) => {
  return moment().tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Get current IST date/time for database operations (MySQL TIMESTAMP format)
 * This ensures all database timestamps are stored in IST
 */
const getCurrentISTForDB = () => {
  return moment().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * Get current IST date/time as Date object for database operations
 */
const getCurrentISTDate = () => {
  return moment().tz(DEFAULT_TIMEZONE).toDate();
};

/**
 * Convert any date to IST and return as Date object
 * @param {Date|string} date - Date to convert
 * @returns {Date} IST date object
 */
const convertToISTDate = (date) => {
  if (!date) return null;
  return moment(date).tz(DEFAULT_TIMEZONE).toDate();
};

/**
 * Format date for display in IST
 * @param {Date|string} date - Date to format
 * @param {string} format - Format string
 * @returns {string} Formatted IST date string
 */
const formatISTDate = (date, format = DEFAULT_DATE_TIME_FORMAT) => {
  if (!date) return null;
  return moment(date).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Check if a given date is in the past
 */
const isPastDate = (date) => {
  return moment().isAfter(moment(date));
};

/**
 * Get IST timezone offset in minutes
 */
const getISTOffset = () => {
  return moment().tz(DEFAULT_TIMEZONE).utcOffset();
};

/**
 * Convert database UTC timestamp to IST for API responses
 * @param {string} dbTimestamp - Database timestamp (UTC)
 * @returns {string} IST formatted timestamp in display format (YYYY-MM-DD HH:mm)
 */
const dbTimestampToIST = (dbTimestamp) => {
  if (!dbTimestamp) return null;
  return moment.utc(dbTimestamp).tz(DEFAULT_TIMEZONE).format(DISPLAY_DATE_TIME_FORMAT);
};

/**
 * Convert database UTC timestamp to IST for API responses with custom format
 * @param {string} dbTimestamp - Database timestamp (UTC)
 * @param {string} format - Custom format string
 * @returns {string} IST formatted timestamp
 */
const dbTimestampToISTCustom = (dbTimestamp, format = DISPLAY_DATE_TIME_FORMAT) => {
  if (!dbTimestamp) return null;
  return moment.utc(dbTimestamp).tz(DEFAULT_TIMEZONE).format(format);
};

/**
 * Convert database UTC timestamp to IST in the specific format requested
 * Format: "2025-08-20  00:56" (with double space between date and time)
 * @param {string} dbTimestamp - Database timestamp (UTC)
 * @returns {string} IST formatted timestamp in requested format
 */
const dbTimestampToISTDisplay = (dbTimestamp) => {
  if (!dbTimestamp) return null;
  return moment.utc(dbTimestamp).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD  HH:mm');
};

/**
 * Get current timestamp in IST for database operations
 * This is the main function to use when inserting/updating timestamps
 */
const getCurrentTimestamp = () => {
  return getCurrentISTForDB();
};

/**
 * Format current time in display format (YYYY-MM-DD HH:mm)
 * @returns {string} Current IST time in display format
 */
const getCurrentDisplayTime = () => {
  return moment().tz(DEFAULT_TIMEZONE).format(DISPLAY_DATE_TIME_FORMAT);
};

module.exports = {
  convertToIST,
  getCurrentIST,
  getCurrentISTForDB,
  getCurrentISTDate,
  convertToISTDate,
  formatISTDate,
  isPastDate,
  getISTOffset,
  dbTimestampToIST,
  dbTimestampToISTCustom,
  dbTimestampToISTDisplay,
  getCurrentTimestamp,
  getCurrentDisplayTime,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_DATE_ONLY_FORMAT,
  DEFAULT_TIMEZONE,
  DISPLAY_DATE_TIME_FORMAT,
};

