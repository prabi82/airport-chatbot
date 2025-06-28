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

async function setupRailway() {
  console.log('🚂 Railway Database Setup for Local Development');
  console.log('==============================================\n');
  
  console.log('📋 Quick Setup Instructions:');
  console.log('1. Go to: https://railway.app');
  console.log('2. Sign up with GitHub (free)');
  console.log('3. Click "New Project"');
  console.log('4. Search for "PostgreSQL" and add it');
  console.log('5. Click on the PostgreSQL service');
  console.log('6. Go to "Connect" tab');
  console.log('7. Copy the "DATABASE_URL"\n');
  
  console.log('💡 Railway typically has better local connectivity than Neon!');
  console.log('⚡ It should work immediately from your local environment.\n');
  
  const databaseUrl = await question('Paste your Railway DATABASE_URL here: ');
  
  if (databaseUrl.trim()) {
    // Create new .env.local with Railway database
    const envContent = `# Local Development with Railway Database
DATABASE_URL="${databaseUrl.trim()}"
GEMINI_API_KEY="Add Key"
JWT_SECRET="Add Key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WIDGET_URL="http://localhost:3000/widget"
NODE_ENV="development"`;

    fs.writeFileSync('.env.local', envContent);
    
    console.log('\n✅ Railway Database Configuration Complete!');
    console.log('📝 Updated .env.local with Railway database URL');
    
    console.log('\n🔄 Next steps:');
    console.log('1. Run: npx prisma db push');
    console.log('2. Run: npm run dev');
    console.log('3. Your admin dashboard should now work locally!');
    
    console.log('\n🎯 Benefits of Railway:');
    console.log('• Better local network connectivity');
    console.log('• No suspension issues like Neon free tier');
    console.log('• Production still uses Neon (unchanged)');
    console.log('• Local development now reliable');
  }
  
  rl.close();
}

setupRailway(); 
