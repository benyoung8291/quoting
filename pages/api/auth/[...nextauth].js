import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyUser } from '../../../lib/users';

/**
 * NextAuth configuration for credential-based authentication.
 * Users are stored in-memory in lib/users.js. The authorize
 * function verifies the email/password combination and returns
 * a minimal user object for the session. The session uses JWT
 * tokens for storage so it can work seamlessly in serverless
 * environments like Vercel.
 */
export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const { email, password } = credentials || {};
        if (!email || !password) return null;
        const user = verifyUser(email, password);
        if (user) {
          return {
            id: user.id,
            name: user.name,
            email: user.email
          };
        }
        return null;
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
});