/**
 * Script to view admin TOTP secrets
 * Usage: ts-node scripts/view-admin-totp.ts [username]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function viewAdminTotp(username?: string) {
  try {
    if (username) {
      // View specific admin
      const admin = await prisma.admin.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          totpEnabled: true,
          totpSecret: true,
          createdAt: true,
        },
      });

      if (!admin) {
        console.error(`❌ Admin with username "${username}" not found`);
        process.exit(1);
      }

      console.log(`\n📋 Admin Information:`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   TOTP Enabled: ${admin.totpEnabled ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created At: ${admin.createdAt}`);
      
      if (admin.totpSecret) {
        console.log(`\n🔑 TOTP Secret: ${admin.totpSecret}`);
        console.log(`\n💡 You can use this secret to generate TOTP codes using:`);
        console.log(`   - Google Authenticator`);
        console.log(`   - Authy`);
        console.log(`   - Any TOTP-compatible authenticator app`);
        console.log(`\n📱 To add manually, use:`);
        console.log(`   Account: NFT Admin (${admin.username})`);
        console.log(`   Secret: ${admin.totpSecret}`);
        console.log(`   Type: Time-based (TOTP)`);
      } else {
        console.log(`\n⚠️  No TOTP secret found. TOTP is not set up for this admin.`);
        console.log(`   Use the /admin/auth/totp/setup API to generate a TOTP secret.`);
      }
    } else {
      // List all admins
      const admins = await prisma.admin.findMany({
        select: {
          id: true,
          username: true,
          totpEnabled: true,
          totpSecret: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (admins.length === 0) {
        console.log('❌ No admins found');
        process.exit(1);
      }

      console.log(`\n📋 All Admins (${admins.length}):\n`);
      
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.username}`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   TOTP Enabled: ${admin.totpEnabled ? '✅ Yes' : '❌ No'}`);
        if (admin.totpSecret) {
          console.log(`   TOTP Secret: ${admin.totpSecret}`);
        } else {
          console.log(`   TOTP Secret: Not set`);
        }
        console.log(`   Created: ${admin.createdAt}`);
        console.log('');
      });

      console.log(`\n💡 To view details for a specific admin, run:`);
      console.log(`   ts-node scripts/view-admin-totp.ts <username>`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const args = process.argv.slice(2);

if (args.length > 1) {
  console.error('Usage: ts-node scripts/view-admin-totp.ts [username]');
  process.exit(1);
}

const username = args[0];

viewAdminTotp(username);

