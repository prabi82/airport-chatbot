const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_FX5ySurgUmt8@ep-flat-cell-a8edph3u-pooler.eastus2.azure.neon.tech/neondb?sslmode=require'
    }
  }
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    // Test query
    const sessionCount = await prisma.chatSession.count();
    console.log(`📊 Found ${sessionCount} chat sessions in database`);
    
    // Test creating a session
    const testSession = await prisma.chatSession.create({
      data: {
        sessionId: `test-${Date.now()}`,
        userAgent: 'Test Agent',
        ipAddress: '127.0.0.1',
        language: 'en'
      }
    });
    console.log('✅ Successfully created test session:', testSession.sessionId);
    
    // Clean up test session
    await prisma.chatSession.delete({
      where: { id: testSession.id }
    });
    console.log('🧹 Test session cleaned up');
    
  } catch (error) {
    console.error('❌ Database connection error:');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    
    if (error.meta) {
      console.error('Error Meta:', error.meta);
    }
    
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

testConnection(); 