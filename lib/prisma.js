// A shared Prisma client instance.  Without this module each API
// route or page that instantiates Prisma would create its own
// connection pool which quickly exhausts the database on
// serverless platforms like Vercel.  By attaching the client to
// the global object during development we ensure that only one
// instance is created.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export default prisma;