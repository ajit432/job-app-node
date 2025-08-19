const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';

/**
 * Generates a JWT access token
 * @param {object} payload - The payload to encode
 * @param {string} expiresIn - Token expiration time (default: 24h)
 * @returns {string} The signed token
 */
exports.generateToken = (payload, expiresIn = '24h') => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('JWT payload must be a non-null object.');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: 'job-portal-api',
    audience: 'job-portal-client'
  });
};

/**
 * Generates a JWT refresh token
 * @param {object} payload - The payload to encode
 * @returns {string} The signed refresh token
 */
exports.generateRefreshToken = (payload) => {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('JWT payload must be a non-null object.');
  }

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '30d',
    issuer: 'job-portal-api',
    audience: 'job-portal-client'
  });
};

/**
 * Verifies a JWT token
 * @param {string} token - The token string to verify
 * @param {boolean} isRefreshToken - Whether to verify as refresh token
 * @returns {object} The decoded payload
 */
exports.verifyToken = (token, isRefreshToken = false) => {
  const secret = isRefreshToken ? JWT_REFRESH_SECRET : JWT_SECRET;
  
  return jwt.verify(token, secret, {
    issuer: 'job-portal-api',
    audience: 'job-portal-client'
  });
};

/**
 * Decodes a JWT token without verification (for debugging)
 * @param {string} token - The token to decode
 * @returns {object} The decoded token
 */
exports.decodeToken = (token) => {
  return jwt.decode(token, { complete: true });
};

