import { createUser } from '../../../lib/users';

/**
 * API route for user registration. Accepts a POST request with
 * JSON body containing `email`, `name` and `password` fields. If
 * registration succeeds the response will contain the created
 * user's id and email. If a user already exists or the input
 * is invalid a 400 response is returned.
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { email, name, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    const user = createUser(email, name || email, password);
    return res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}