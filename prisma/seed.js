/*
 * Seed script for the quoting application.
 *
 * This script creates an initial SUPER_ADMIN account based on the
 * environment variables defined in `.env` or your deployment
 * environment.  If a user with the provided email already exists
 * their role will be upgraded to SUPER_ADMIN.  The script exits
 * gracefully if the required variables are not set.
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function run() {
  const prisma = new PrismaClient();
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const name = process.env.SEED_SUPERADMIN_NAME;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('Seed skipped: SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD must be set');
    await prisma.$disconnect();
    return;
  }
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    if (existing) {
      // Promote existing user to SUPER_ADMIN if necessary
      if (existing.role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { email },
          data: { role: 'SUPER_ADMIN', passwordHash, name: name || existing.name }
        });
        console.log(`Promoted existing user ${email} to SUPER_ADMIN`);
      } else {
        console.log(`User ${email} already has SUPER_ADMIN role`);
      }
    } else {
      await prisma.user.create({
        data: {
          email,
          name: name || email,
          passwordHash,
          role: 'SUPER_ADMIN'
        }
      });
      console.log(`Created SUPER_ADMIN user ${email}`);
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();