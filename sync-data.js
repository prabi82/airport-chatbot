const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function syncData() {
  console.log('🔄 Database Data Synchronization Tool');
  console.log('=====================================\n');
  
  console.log('Choose synchronization direction:');
  console.log('1. Export from Railway → Import to Neon (Local to Production)');
  console.log('2. Export from Neon → Import to Railway (Production to Local)');
  console.log('3. Export data to JSON file (Backup)');
  console.log('4. Import data from JSON file (Restore)\n');
  
  const choice = await question('Enter your choice (1-4): ');
  
  switch (choice) {
    case '1':
      await syncLocalToProduction();
      break;
    case '2':
      await syncProductionToLocal();
      break;
    case '3':
      await exportToFile();
      break;
    case '4':
      await importFromFile();
      break;
    default:
      console.log('Invalid choice. Exiting...');
      break;
  }
  
  rl.close();
}

async function syncLocalToProduction() {
  console.log('\n🚀 Syncing Local (Railway) → Production (Neon)');
  
  const railwayUrl = await question('Enter Railway DATABASE_URL: ');
  const neonUrl = await question('Enter Neon DATABASE_URL: ');
  
  const railwayPrisma = new PrismaClient({
    datasources: { db: { url: railwayUrl } }
  });
  
  const neonPrisma = new PrismaClient({
    datasources: { db: { url: neonUrl } }
  });
  
  try {
    console.log('\n📤 Exporting from Railway...');
    const data = await exportAllData(railwayPrisma);
    
    console.log('\n📥 Importing to Neon...');
    await importAllData(neonPrisma, data);
    
    console.log('\n✅ Sync completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
  } finally {
    await railwayPrisma.$disconnect();
    await neonPrisma.$disconnect();
  }
}

async function syncProductionToLocal() {
  console.log('\n⬇️ Syncing Production (Neon) → Local (Railway)');
  
  const neonUrl = await question('Enter Neon DATABASE_URL: ');
  const railwayUrl = await question('Enter Railway DATABASE_URL: ');
  
  const neonPrisma = new PrismaClient({
    datasources: { db: { url: neonUrl } }
  });
  
  const railwayPrisma = new PrismaClient({
    datasources: { db: { url: railwayUrl } }
  });
  
  try {
    console.log('\n📤 Exporting from Neon...');
    const data = await exportAllData(neonPrisma);
    
    console.log('\n📥 Importing to Railway...');
    await importAllData(railwayPrisma, data);
    
    console.log('\n✅ Sync completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
  } finally {
    await neonPrisma.$disconnect();
    await railwayPrisma.$disconnect();
  }
}

async function exportToFile() {
  console.log('\n💾 Exporting to JSON file...');
  
  const databaseUrl = await question('Enter DATABASE_URL to export from: ');
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });
  
  try {
    const data = await exportAllData(prisma);
    const filename = `knowledge-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`\n✅ Data exported to: ${filename}`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function importFromFile() {
  console.log('\n📁 Importing from JSON file...');
  
  const filename = await question('Enter JSON file path: ');
  const databaseUrl = await question('Enter DATABASE_URL to import to: ');
  
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } }
  });
  
  try {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    await importAllData(prisma, data);
    
    console.log('\n✅ Data imported successfully!');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function exportAllData(prisma) {
  console.log('  📋 Exporting knowledge base...');
  const knowledgeBase = await prisma.knowledgeBase.findMany();
  
  console.log('  📋 Exporting scraping cache...');
  const scrapingCache = await prisma.scrapingCache.findMany();
  
  console.log('  📋 Exporting quick responses...');
  const quickResponses = await prisma.quickResponse.findMany();
  
  console.log('  📋 Exporting support agents...');
  const supportAgents = await prisma.supportAgent.findMany();
  
  console.log(`  ✅ Exported ${knowledgeBase.length} knowledge entries`);
  console.log(`  ✅ Exported ${scrapingCache.length} scraping cache entries`);
  console.log(`  ✅ Exported ${quickResponses.length} quick responses`);
  console.log(`  ✅ Exported ${supportAgents.length} support agents`);
  
  return {
    knowledgeBase,
    scrapingCache,
    quickResponses,
    supportAgents,
    exportedAt: new Date().toISOString()
  };
}

async function importAllData(prisma, data) {
  console.log('  🧹 Clearing existing data...');
  await prisma.knowledgeBase.deleteMany();
  await prisma.scrapingCache.deleteMany();
  await prisma.quickResponse.deleteMany();
  
  console.log('  📥 Importing knowledge base...');
  if (data.knowledgeBase.length > 0) {
    await prisma.knowledgeBase.createMany({
      data: data.knowledgeBase.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }))
    });
  }
  
  console.log('  📥 Importing scraping cache...');
  if (data.scrapingCache.length > 0) {
    await prisma.scrapingCache.createMany({
      data: data.scrapingCache.map(item => ({
        ...item,
        lastScraped: new Date(item.lastScraped),
        createdAt: new Date(item.createdAt)
      }))
    });
  }
  
  console.log('  📥 Importing quick responses...');
  if (data.quickResponses.length > 0) {
    await prisma.quickResponse.createMany({
      data: data.quickResponses.map(item => ({
        ...item,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }))
    });
  }
  
  console.log(`  ✅ Imported ${data.knowledgeBase.length} knowledge entries`);
  console.log(`  ✅ Imported ${data.scrapingCache.length} scraping cache entries`);
  console.log(`  ✅ Imported ${data.quickResponses.length} quick responses`);
}

syncData(); 