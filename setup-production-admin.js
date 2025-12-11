/**
 * Production Admin User Setup Script
 * This script will create the admin user in the production database
 * 
 * Usage: 
 *   Set DATABASE_URL to production database
 *   node setup-production-admin.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function setupProductionAdmin() {
  try {
    console.log('🔧 Setting up production admin user...\n');
    console.log('⚠️  Using DATABASE_URL from environment variables\n');

    // Check if admin_users table exists
    let tableExists = false;
    try {
      await prisma.$queryRaw`SELECT 1 FROM admin_users LIMIT 1`;
      tableExists = true;
      console.log('✅ admin_users table exists');
    } catch (error) {
      console.log('❌ admin_users table does not exist');
      console.log('   Please run the database migration first:');
      console.log('   node migrate-remove-username.js\n');
      return;
    }

    // Check if username column still exists (needs migration)
    try {
      await prisma.$queryRaw`SELECT username FROM admin_users LIMIT 1`;
      console.log('⚠️  WARNING: username column still exists!');
      console.log('   Please run migration first: node migrate-remove-username.js\n');
      return;
    } catch (error) {
      // Good - username column doesn't exist
      console.log('✅ Database schema is correct (no username column)');
    }

    // Check if admin user exists
    console.log('\n🔍 Checking for existing admin user...');
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: 'admin@omanairports.co.om' }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   Name:', existingAdmin.name || 'N/A');
      console.log('   Role:', existingAdmin.role);
      console.log('   Is Active:', existingAdmin.isActive);
      
      // Test password
      const testPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const isValid = await bcrypt.compare(testPassword, existingAdmin.password);
      
      if (isValid) {
        console.log('\n✅ Password is correct');
        console.log('\n📋 Login Credentials:');
        console.log('   Email: admin@omanairports.co.om');
        console.log('   Password: ' + testPassword);
      } else {
        console.log('\n⚠️  Password mismatch');
        console.log('   Resetting password...');
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        await prisma.adminUser.update({
          where: { id: existingAdmin.id },
          data: { password: hashedPassword }
        });
        console.log('✅ Password reset to:', testPassword);
      }
      return;
    }

    // Create admin user
    console.log('📝 Creating admin user...');
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const adminUser = await prisma.adminUser.create({
      data: {
        email: 'admin@omanairports.co.om',
        password: hashedPassword,
        name: 'System Administrator',
        role: 'super_admin',
        permissions: ['all'],
        isActive: true
      }
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📋 PRODUCTION LOGIN CREDENTIALS:');
    console.log('═══════════════════════════════════════════════════════');
    console.log('   Email: admin@omanairports.co.om');
    console.log('   Password: ' + defaultPassword);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('⚠️  IMPORTANT: Change the password after first login!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'P1001') {
      console.error('\n💡 Database connection error. Please check:');
      console.error('   1. DATABASE_URL environment variable is set correctly');
      console.error('   2. Database server is accessible');
      console.error('   3. Network/firewall allows connection');
    } else if (error.code === 'P2002') {
      console.error('\n💡 Email already exists. The user may need password reset.');
    } else if (error.code === '42P01') {
      console.error('\n💡 Table does not exist. Please run migration first.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupProductionAdmin();

