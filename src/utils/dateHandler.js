// utils/dateHandler.js
//This Files helps To Handel The Date And Time , To handle date and time, simply import this file.
const moment = require('moment-timezone');

const DEFAULT_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DEFAULT_DATE_ONLY_FORMAT = 'YYYY-MM-DD';

/**
 * Convert UTC date to IST and format it
 * @param {Date|string} date - UTC date or timestamp
 * @param {string} format - Optional format string
 * @returns {string} IST formatted date
 */
const convertToIST = (date, format = DEFAULT_DATE_TIME_FORMAT) => {
  if (!date) return null;
  return moment.utc(date).tz('Asia/Kolkata').format(format);
};

/**
 * Get current IST date/time
 */
const getCurrentIST = (format = DEFAULT_DATE_TIME_FORMAT) => {
  return moment().tz('Asia/Kolkata').format(format);
};

/**
 * Check if a given date is in the past
 */
const isPastDate = (date) => {
  return moment().isAfter(moment(date));
};

module.exports = {
  convertToIST,
  getCurrentIST,
  isPastDate,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_DATE_ONLY_FORMAT,
};

