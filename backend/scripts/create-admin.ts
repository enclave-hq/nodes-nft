/**
 * Script to create an admin user
 * Usage: ts-node scripts/create-admin.ts <username> <password>
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin(username: string, password: string) {
  try {
    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { username },
    });

    if (existing) {
      console.error(`❌ Admin with username "${username}" already exists`);
      process.exit(1);
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create admin
    const admin = await prisma.admin.create({
      data: {
        username,
        passwordHash,
        totpEnabled: false,
      },
    });

    console.log(`✅ Admin created successfully!`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   TOTP Enabled: ${admin.totpEnabled}`);
    console.log(`\n⚠️  Remember to enable TOTP for enhanced security!`);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: ts-node scripts/create-admin.ts <username> <password>');
  process.exit(1);
}

const [username, password] = args;

if (username.length < 3) {
  console.error('❌ Username must be at least 3 characters long');
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

createAdmin(username, password);

