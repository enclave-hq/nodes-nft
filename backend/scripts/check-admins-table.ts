/**
 * Script to check admins table structure
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminsTable() {
  try {
    // Try to query with new fields
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        username: true,
        passwordHash: true,
        totpSecret: true,
        totpEnabled: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 1,
    });

    console.log('✅ Admins table has all new fields!');
    console.log('Sample admin structure:', JSON.stringify(admins[0] || {}, null, 2));
    
    // Check if we can create a test admin
    console.log('\n📋 Table structure is correct. You can now:');
    console.log('   1. Create admin: npm run create-admin <username> <password>');
    console.log('   2. Start server: npm run start:dev');
  } catch (error: any) {
    if (error.message?.includes('username') || error.message?.includes('passwordHash')) {
      console.error('❌ Admins table does not have new fields yet.');
      console.error('Error:', error.message);
      console.log('\n💡 Try running: npx prisma db push');
    } else {
      console.error('Error:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminsTable();

