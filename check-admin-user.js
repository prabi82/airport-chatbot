/**
 * Check and fix admin user in database
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAndFixAdmin() {
  try {
    console.log('🔍 Checking admin user...\n');

    // Check if admin user exists
    const admin = await prisma.adminUser.findUnique({
      where: { email: 'admin@omanairports.co.om' }
    });

    if (admin) {
      console.log('✅ Admin user found:');
      console.log('   Email:', admin.email);
      console.log('   Name:', admin.name || 'N/A');
      console.log('   Role:', admin.role);
      console.log('   Is Active:', admin.isActive);
      console.log('\n🔧 Testing password...');
      
      // Test password
      const isValid = await bcrypt.compare('admin123', admin.password);
      if (isValid) {
        console.log('✅ Password is correct');
      } else {
        console.log('❌ Password is incorrect - resetting...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await prisma.adminUser.update({
          where: { id: admin.id },
          data: { password: hashedPassword }
        });
        console.log('✅ Password reset to: admin123');
      }
    } else {
      console.log('❌ Admin user not found. Creating...');
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const newAdmin = await prisma.adminUser.create({
        data: {
          email: 'admin@omanairports.co.om',
          password: hashedPassword,
          name: 'System Administrator',
          role: 'super_admin',
          permissions: ['all'],
          isActive: true
        }
      });
      
      console.log('✅ Admin user created:');
      console.log('   Email:', newAdmin.email);
      console.log('   Password: admin123');
    }

    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@omanairports.co.om');
    console.log('   Password: admin123\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('   Email already exists. Try checking with a different email or update existing user.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixAdmin();

