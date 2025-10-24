require('dotenv').config();

const DEFAULT_JWT_EXPIRY = 86400;

const isProduction = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  if (isProduction) {
    throw new Error('JWT_SECRET is required in production environment. Please set JWT_SECRET in your environment variables.');
  } else {
    console.warn('WARNING: JWT_SECRET is not set. Using a default insecure secret for development. Set JWT_SECRET in .env for production!');
  }
}

module.exports = {
  secret: process.env.JWT_SECRET || 'change-this-secret-immediately',
  jwtExpiration: parseInt(process.env.JWT_EXPIRES_IN, 10) || DEFAULT_JWT_EXPIRY
};