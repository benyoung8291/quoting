import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * NextAuth configuration for credential-based authentication.
 * Credentials based authentication is implemented using Prisma
 * and PostgreSQL.  During sign‑in the user is looked up in
 * the database and their hashed password is compared using
 * bcrypt.  The session is stored as a JWT so that it can run
 * in a serverless environment like Vercel.
 */
export default NextAuth({
  // Use the Prisma adapter so NextAuth can persist sessions and
  // users directly in the database.  See
  // https://next-auth.js.org/adapters/prisma for details.
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'you@example.com' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const { email, password } = credentials || {};
        if (!email || !password) {
          throw new Error('Missing email or password');
        }
        // Look up the user in the database.  We store the hashed
        // password and role.  If no user exists or the password
        // does not match we throw an error to signal invalid
        // credentials.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password');
        }
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        };
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      // Persist the user ID and role into the JWT.  This runs
      // whenever a new JWT is issued or updated.
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose the ID and role on the session object so it can be
      // accessed client-side.
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login'
  },
  secret: process.env.NEXTAUTH_SECRET
});