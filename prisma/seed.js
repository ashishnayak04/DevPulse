const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !username || !password) {
    console.error('Missing ADMIN_EMAIL, ADMIN_USERNAME, or ADMIN_PASSWORD in environment.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: { username, passwordHash, role: 'ADMIN', isActive: true },
    create: { email, username, passwordHash, role: 'ADMIN', isActive: true },
  });

  console.log(`Admin ready: ${user.email} (${user.username})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
