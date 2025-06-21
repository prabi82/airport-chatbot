#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗄️ Oman Airports Chatbot - Database Setup');
console.log('==========================================\n');

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  console.log('Choose your database setup option:');
  console.log('1. Local PostgreSQL');
  console.log('2. Docker PostgreSQL');
  console.log('3. Neon (Serverless PostgreSQL) - Recommended');
  console.log('4. Supabase (PostgreSQL with extras)');
  console.log('5. Railway (Simple cloud PostgreSQL)');
  console.log('6. AWS RDS (Enterprise PostgreSQL)');
  console.log('7. Google Cloud SQL');
  console.log('8. Azure Database for PostgreSQL');
  console.log('9. Skip database setup (use demo mode)\n');

  const choice = await question('Enter your choice (1-9): ');
  
  let databaseUrl = '';
  let additionalConfig = '';
  
  switch (choice) {
    case '1':
      console.log('\n📝 Local PostgreSQL Setup');
      console.log('Make sure PostgreSQL is installed and running on your system.');
      
      const host = await question('Database host (localhost): ') || 'localhost';
      const port = await question('Database port (5432): ') || '5432';
      const database = await question('Database name (omanairports_chatbot): ') || 'omanairports_chatbot';
      const username = await question('Username (postgres): ') || 'postgres';
      const password = await question('Password: ');
      
      databaseUrl = `postgresql://${username}:${password}@${host}:${port}/${database}`;
      break;
      
    case '2':
      console.log('\n🐳 Docker PostgreSQL Setup');
      console.log('This will use the docker-compose.yml configuration.');
      
      databaseUrl = 'postgresql://postgres:postgres123@localhost:5432/omanairports_chatbot';
      
      additionalConfig = `
# Docker Setup Instructions:
# 1. Make sure Docker is installed and running
# 2. Run: docker-compose up -d
# 3. Access Adminer at: http://localhost:8080
#    - System: PostgreSQL
#    - Server: postgres
#    - Username: postgres
#    - Password: postgres123
#    - Database: omanairports_chatbot`;
      break;
      
    case '3':
      console.log('\n🌟 Neon Setup (Recommended)');
      console.log('Neon is a serverless PostgreSQL platform with auto-scaling.');
      console.log('Visit: https://neon.tech');
      console.log('1. Sign up for free');
      console.log('2. Create a new project');
      console.log('3. Copy the connection string\n');
      
      const neonUrl = await question('Paste your Neon connection string: ');
      databaseUrl = neonUrl;
      
      additionalConfig = `
# Neon Features:
# - Free tier: 0.5GB storage, 190 compute hours
# - Auto-scaling and scale-to-zero
# - Database branching
# - Built-in connection pooling
# - Dashboard: https://console.neon.tech`;
      break;
      
    case '4':
      console.log('\n🚀 Supabase Setup');
      console.log('Supabase provides PostgreSQL with built-in Auth and APIs.');
      console.log('Visit: https://supabase.com');
      console.log('1. Create account and project');
      console.log('2. Go to Settings > Database');
      console.log('3. Copy the connection string\n');
      
      const supabaseUrl = await question('Paste your Supabase connection string: ');
      databaseUrl = supabaseUrl;
      
      additionalConfig = `
# Supabase Features:
# - Free tier: 500MB storage, 2 projects
# - Built-in authentication
# - Real-time subscriptions
# - Auto-generated APIs
# - Dashboard: https://app.supabase.com`;
      break;
      
    case '5':
      console.log('\n🚂 Railway Setup');
      console.log('Railway provides simple cloud PostgreSQL deployment.');
      console.log('Visit: https://railway.app');
      console.log('1. Create account and project');
      console.log('2. Add PostgreSQL service');
      console.log('3. Copy the database URL\n');
      
      const railwayUrl = await question('Paste your Railway database URL: ');
      databaseUrl = railwayUrl;
      
      additionalConfig = `
# Railway Features:
# - $5 monthly credit (free tier)
# - One-click PostgreSQL deployment
# - Automatic backups
# - Built-in metrics
# - Dashboard: https://railway.app/dashboard`;
      break;
      
    case '6':
      console.log('\n☁️ AWS RDS Setup');
      console.log('AWS RDS provides managed PostgreSQL for enterprise use.');
      console.log('Visit: https://aws.amazon.com/rds/');
      console.log('1. Create AWS account');
      console.log('2. Launch RDS PostgreSQL instance');
      console.log('3. Configure security groups');
      console.log('4. Get connection details\n');
      
      const awsUrl = await question('Paste your AWS RDS connection string: ');
      databaseUrl = awsUrl;
      
      additionalConfig = `
# AWS RDS Features:
# - Enterprise-grade reliability
# - Multi-AZ deployment
# - Automated backups
# - Performance insights
# - Free tier: 12 months`;
      break;
      
    case '7':
      console.log('\n🌐 Google Cloud SQL Setup');
      console.log('Google Cloud SQL provides managed PostgreSQL.');
      console.log('Visit: https://cloud.google.com/sql');
      console.log('1. Create Google Cloud account');
      console.log('2. Create Cloud SQL PostgreSQL instance');
      console.log('3. Configure authorized networks');
      console.log('4. Get connection details\n');
      
      const gcpUrl = await question('Paste your Google Cloud SQL connection string: ');
      databaseUrl = gcpUrl;
      
      additionalConfig = `
# Google Cloud SQL Features:
# - Fully managed PostgreSQL
# - High availability
# - Automatic scaling
# - Cloud integration
# - $300 free credit`;
      break;
      
    case '8':
      console.log('\n🔷 Azure Database for PostgreSQL Setup');
      console.log('Azure provides managed PostgreSQL service.');
      console.log('Visit: https://azure.microsoft.com/en-us/services/postgresql/');
      console.log('1. Create Azure account');
      console.log('2. Create PostgreSQL database');
      console.log('3. Configure firewall rules');
      console.log('4. Get connection details\n');
      
      const azureUrl = await question('Paste your Azure PostgreSQL connection string: ');
      databaseUrl = azureUrl;
      
      additionalConfig = `
# Azure PostgreSQL Features:
# - Managed PostgreSQL service
# - Built-in security
# - Flexible scaling
# - Azure integration
# - $200 free credit`;
      break;
      
    case '9':
      console.log('\n🎮 Demo Mode Setup');
      console.log('This will skip database setup and use mock data for testing.');
      
      databaseUrl = '# DATABASE_URL="postgresql://localhost:5432/demo" # Demo mode - no real database needed';
      
      additionalConfig = `
# Demo Mode:
# - No database required
# - Uses mock data for responses
# - Perfect for testing the UI
# - To enable real database later, uncomment and configure DATABASE_URL`;
      break;
      
    default:
      console.log('Invalid choice. Defaulting to demo mode.');
      databaseUrl = '# DATABASE_URL="postgresql://localhost:5432/demo" # Demo mode';
      break;
  }

  // Get additional configuration
  console.log('\n⚙️ Additional Configuration');
  
  const redisUrl = await question('Redis URL (redis://localhost:6379): ') || 'redis://localhost:6379';
  const ollamaHost = await question('Ollama host (http://localhost:11434): ') || 'http://localhost:11434';
  const ollamaModel = await question('Ollama model (llama2): ') || 'llama2';
  const jwtSecret = await question('JWT secret (leave empty for auto-generated): ') || generateRandomSecret();
  const appUrl = await question('App URL (http://localhost:3000): ') || 'http://localhost:3000';

  // Create .env.local file
  const envContent = `# Oman Airports AI Chatbot - Environment Configuration
# Generated on ${new Date().toISOString()}
${additionalConfig}

# Database Configuration
DATABASE_URL="${databaseUrl}"

# Redis Configuration
REDIS_URL="${redisUrl}"

# Ollama Configuration (Local AI)
OLLAMA_HOST="${ollamaHost}"
OLLAMA_MODEL="${ollamaModel}"

# Flight APIs (Optional - for real flight data)
# Get API key from: https://aviationstack.com/
AVIATIONSTACK_API_KEY="your_api_key_here"
AVIATIONSTACK_API_URL="http://api.aviationstack.com/v1"

# FlightAware API (Backup)
# FLIGHTAWARE_API_KEY="your_flightaware_api_key"
# FLIGHTAWARE_API_URL="https://aeroapi.flightaware.com/aeroapi"

# Security
JWT_SECRET="${jwtSecret}"

# App Configuration
NEXT_PUBLIC_APP_URL="${appUrl}"
NEXT_PUBLIC_WIDGET_URL="${appUrl}/widget"
NODE_ENV="development"

# Optional: Analytics and Monitoring
# SENTRY_DSN="your_sentry_dsn"
# GOOGLE_ANALYTICS_ID="your_ga_id"

# Optional: Email Configuration (for notifications)
# SMTP_HOST="smtp.gmail.com"
# SMTP_PORT="587"
# SMTP_USER="your_email@gmail.com"
# SMTP_PASS="your_app_password"
`;

  // Write .env.local file
  const envPath = path.join(process.cwd(), '.env.local');
  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ Environment configuration created successfully!');
  console.log(`📁 File created: ${envPath}`);
  
  // Show next steps
  console.log('\n🚀 Next Steps:');
  console.log('1. Install dependencies: npm install');
  
  if (choice !== '9') {
    console.log('2. Generate Prisma client: npx prisma generate');
    console.log('3. Run database migrations: npx prisma migrate dev --name init');
    console.log('4. Start development server: npm run dev');
    console.log('5. Open demo: http://localhost:3000/demo.html');
  } else {
    console.log('2. Start development server: npm run dev');
    console.log('3. Open demo: http://localhost:3000/demo.html');
    console.log('4. (Demo mode - no database setup needed)');
  }
  
  console.log('\n📚 Useful Commands:');
  console.log('- View database: npx prisma studio');
  console.log('- Reset database: npx prisma migrate reset');
  console.log('- Check status: npm run dev');
  
  console.log('\n🆘 Need Help?');
  console.log('- Read: DATABASE_SETUP_GUIDE.md');
  console.log('- Issues: https://github.com/prabi82/airport-chatbot/issues');
  
  console.log('\n🎉 Happy coding!');
}

function generateRandomSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Run the setup
setupEnvironment()
  .then(() => {
    rl.close();
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    rl.close();
    process.exit(1);
  }); 