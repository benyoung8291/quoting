import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * API route for user registration. Accepts a POST request with
 * JSON body containing `email`, `name` and `password` fields. If
 * registration succeeds the response will contain the created
 * user's id and email. If a user already exists or the input
 * is invalid a 400 response is returned.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const { email, name, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email,
        passwordHash,
        role: 'USER'
      }
    });
    return res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}