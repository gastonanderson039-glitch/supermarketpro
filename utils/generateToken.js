const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for authentication
 * @param {string} id - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = generateToken;