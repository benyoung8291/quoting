import crypto from 'node:crypto';

// In-memory user store. In a real application you would persist this
// data in a database like PostgreSQL, MongoDB, or Supabase. Because
// this example runs in a serverless environment on Vercel and we
// cannot install additional dependencies, we maintain the user
// registry in memory. Each user object contains an id, email,
// optional name and a hashed password.

const users = [];

/**
 * Find a user by their email address.
 *
 * @param {string} email - Email address to search for
 * @returns {object|null} The user record or null if not found
 */
export function findUserByEmail(email) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Create a new user and add them to the in-memory store. Passwords
 * are hashed using a basic SHA-256 digest. This is not suitable for
 * production but demonstrates the concept of secure password storage.
 *
 * @param {string} email - User email address
 * @param {string} name - User display name
 * @param {string} password - User password (plaintext)
 * @returns {object} The newly created user object
 */
export function createUser(email, name, password) {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error('User already exists');
  }
  const id = crypto.randomUUID();
  const passwordHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
  const user = { id, email, name, passwordHash };
  users.push(user);
  return user;
}

/**
 * Verify a user's credentials. Returns the user if the password
 * matches, otherwise null. Password comparison is done by hashing the
 * provided password with SHA-256 and comparing to the stored hash.
 *
 * @param {string} email - User email address
 * @param {string} password - Candidate password
 * @returns {object|null} The user if authenticated or null
 */
export function verifyUser(email, password) {
  const user = findUserByEmail(email);
  if (!user) return null;
  const candidateHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');
  return candidateHash === user.passwordHash ? user : null;
}

// Export the underlying users array. This can be useful for debugging
// and inspection but should not be manipulated directly in production.
export { users };