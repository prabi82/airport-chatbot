# 🗄️ PostgreSQL Database Setup Guide

This guide will help you set up PostgreSQL for the Oman Airports AI Chatbot project.

## 📋 Prerequisites

- Windows 10/11
- Administrative privileges
- Node.js 18+ installed

## 🎯 Setup Options

### Option 1: Local PostgreSQL Installation (Recommended for Development)

#### Step 1: Download and Install PostgreSQL

1. **Download PostgreSQL**
   - Visit: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
   - Download PostgreSQL 15.x or 16.x for Windows x86-64
   - File size: ~300MB

2. **Run the Installer**
   ```bash
   # Run as Administrator
   postgresql-15.x-x-windows-x64.exe
   ```

3. **Installation Settings**
   - **Installation Directory**: `C:\Program Files\PostgreSQL\15`
   - **Data Directory**: `C:\Program Files\PostgreSQL\15\data`
   - **Port**: `5432` (default)
   - **Superuser**: `postgres`
   - **Password**: Choose a strong password (remember this!)
   - **Locale**: Default

4. **Components to Install**
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI tool)
   - ✅ Stack Builder (optional)
   - ✅ Command Line Tools

#### Step 2: Verify Installation

```bash
# Open Command Prompt and test
psql --version

# Connect to PostgreSQL
psql -U postgres -h localhost
```

#### Step 3: Create Project Database

```sql
-- Connect as postgres user
psql -U postgres

-- Create database
CREATE DATABASE omanairports_chatbot;

-- Create user (optional)
CREATE USER chatbot_user WITH ENCRYPTED PASSWORD 'your_secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE omanairports_chatbot TO chatbot_user;

-- Exit
\q
```

### Option 2: Docker Setup (Alternative)

If you have Docker installed:

```bash
# Start PostgreSQL and Redis with Docker Compose
docker-compose up -d

# This will start:
# - PostgreSQL on port 5432
# - Redis on port 6379
# - Adminer (DB GUI) on port 8080
```

**Docker Credentials:**
- Host: `localhost`
- Port: `5432`
- Database: `omanairports_chatbot`
- Username: `postgres`
- Password: `postgres123`

## ☁️ Cloud Database Options

### Option 3: Neon (Recommended Cloud Option)

**🌟 Best for: Development, Serverless, Auto-scaling**

**Features:**
- ✅ **Free Tier**: 0.5GB storage, 190 compute hours
- ✅ **Instant provisioning** (under 1 second)
- ✅ **Auto-scaling** with scale-to-zero
- ✅ **Database branching** (like Git for databases)
- ✅ **Built-in connection pooling**
- ✅ **No maintenance required**

**Pricing:**
- **Free**: $0/month - Perfect for development
- **Launch**: $19/month - Production ready
- **Scale**: $69/month - High performance

**Setup:**
1. Visit: https://neon.tech
2. Sign up with email/GitHub/Google
3. Create project and database
4. Copy connection string

**Connection String Format:**
```
postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname
```

### Option 4: Supabase

**🌟 Best for: Full-stack development, Real-time features**

**Features:**
- ✅ **Free Tier**: 500MB storage, 2 projects
- ✅ **Built-in Auth & APIs**
- ✅ **Real-time subscriptions**
- ✅ **Dashboard with SQL editor**
- ✅ **Edge functions**

**Pricing:**
- **Free**: $0/month
- **Pro**: $25/month
- **Team**: $599/month

**Setup:**
1. Visit: https://supabase.com
2. Create account and project
3. Go to Settings > Database
4. Copy connection details

### Option 5: Railway

**🌟 Best for: Simple deployment, Developer experience**

**Features:**
- ✅ **Free Tier**: $5 monthly credit
- ✅ **One-click PostgreSQL**
- ✅ **Automatic backups**
- ✅ **Built-in metrics**
- ✅ **Easy scaling**

**Pricing:**
- **Developer**: $5 credit/month
- **Team**: $20/month per seat

**Setup:**
1. Visit: https://railway.app
2. Create project
3. Add PostgreSQL service
4. Copy database URL

### Option 6: PlanetScale (MySQL Alternative)

**🌟 Best for: MySQL projects, Branching workflows**

**Features:**
- ✅ **Database branching**
- ✅ **Schema changes without downtime**
- ✅ **Built-in analytics**
- ✅ **Global replication**

**Note**: MySQL only, not PostgreSQL

### Option 7: AWS RDS

**🌟 Best for: Enterprise, AWS ecosystem**

**Features:**
- ✅ **Managed PostgreSQL**
- ✅ **Multi-AZ deployment**
- ✅ **Automated backups**
- ✅ **Performance insights**

**Pricing**: Pay-per-use, starts ~$20/month

### Option 8: Google Cloud SQL

**🌟 Best for: Google Cloud ecosystem**

**Features:**
- ✅ **Fully managed PostgreSQL**
- ✅ **High availability**
- ✅ **Automatic scaling**
- ✅ **Cloud integration**

**Pricing**: Pay-per-use, competitive rates

### Option 9: Azure Database for PostgreSQL

**🌟 Best for: Microsoft ecosystem**

**Features:**
- ✅ **Managed PostgreSQL**
- ✅ **Built-in security**
- ✅ **Flexible scaling**
- ✅ **Azure integration**

**Pricing**: Pay-per-use model

## 📊 Cloud Database Comparison

| Provider | Free Tier | Best For | Pricing | Special Features |
|----------|-----------|----------|---------|------------------|
| **Neon** | 0.5GB, 190h compute | Serverless, Auto-scale | $0-$19-$69 | Branching, Scale-to-zero |
| **Supabase** | 500MB, 2 projects | Full-stack apps | $0-$25-$599 | Auth, Real-time, APIs |
| **Railway** | $5 credit/month | Simple deployment | $5 credit-$20 | One-click setup |
| **AWS RDS** | 12 months free | Enterprise | ~$20+/month | AWS ecosystem |
| **Google Cloud SQL** | $300 credit | Google Cloud | Pay-per-use | GCP integration |
| **Azure PostgreSQL** | $200 credit | Microsoft stack | Pay-per-use | Azure integration |

## 🔧 Environment Configuration

### Step 1: Create Environment File

Create `.env.local` in your project root:

```env
# Database Configuration
# Choose ONE of the following:

# For Local PostgreSQL:
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/omanairports_chatbot"

# For Docker:
# DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/omanairports_chatbot"

# For Neon:
# DATABASE_URL="postgresql://username:password@ep-xxx.region.aws.neon.tech/dbname"

# For Supabase:
# DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# For Railway:
# DATABASE_URL="postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway"

# Redis Configuration
REDIS_URL="redis://localhost:6379"

# Ollama Configuration (Local AI)
OLLAMA_HOST="http://localhost:11434"
OLLAMA_MODEL="llama2"

# Flight APIs (Optional)
AVIATIONSTACK_API_KEY="your_api_key_here"
AVIATIONSTACK_API_URL="http://api.aviationstack.com/v1"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Setup Database Schema

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# Optional: Seed database with sample data
npx prisma db seed
```

### Step 4: Verify Database Connection

```bash
# Test database connection
npx prisma studio

# This opens a web interface at http://localhost:5555
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
- Ensure PostgreSQL service is running
- Check Windows Services: `services.msc`
- Start "postgresql-x64-15" service

#### 2. Authentication Failed
```
Error: password authentication failed for user "postgres"
```
**Solution:**
- Verify password in `.env.local`
- Reset postgres password if needed

#### 3. Database Does Not Exist
```
Error: database "omanairports_chatbot" does not exist
```
**Solution:**
```sql
-- Connect to postgres database first
psql -U postgres -d postgres

-- Create the database
CREATE DATABASE omanairports_chatbot;
```

#### 4. Port Already in Use
```
Error: Port 5432 is already in use
```
**Solution:**
- Check if PostgreSQL is already running
- Use different port in DATABASE_URL
- Stop conflicting services

#### 5. Cloud Database Connection Issues
```
Error: getaddrinfo ENOTFOUND
```
**Solution:**
- Check internet connection
- Verify connection string format
- Ensure database is running (not paused)
- Check firewall settings

### Reset Database

If you need to start fresh:

```bash
# Drop and recreate database
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Run all migrations
# 4. Run seed scripts
```

## 🎯 Quick Start Commands

```bash
# 1. Clone and setup
git clone https://github.com/prabi82/airport-chatbot.git
cd airport-chatbot

# 2. Install dependencies
npm install

# 3. Setup environment (interactive)
node setup-env.js

# 4. Setup database
npx prisma generate
npx prisma migrate dev --name init

# 5. Start development server
npm run dev

# 6. Test the application
# Open http://localhost:3000/demo.html
```

## 📊 Database Tools

### pgAdmin 4 (Installed with PostgreSQL)
- **URL**: http://localhost:5432
- **Username**: postgres
- **Password**: [your password]

### Prisma Studio (Built-in)
```bash
npx prisma studio
# Opens at http://localhost:5555
```

### Adminer (If using Docker)
- **URL**: http://localhost:8080
- **System**: PostgreSQL
- **Server**: postgres
- **Username**: postgres
- **Password**: postgres123
- **Database**: omanairports_chatbot

### Cloud Database Dashboards
- **Neon**: https://console.neon.tech
- **Supabase**: https://app.supabase.com
- **Railway**: https://railway.app/dashboard

## 🔒 Security Notes

1. **Change Default Passwords**: Never use default passwords in production
2. **Firewall Rules**: Configure firewall to restrict database access
3. **SSL/TLS**: Enable SSL for production databases
4. **Backup Strategy**: Implement regular database backups
5. **User Permissions**: Create specific users with limited privileges
6. **Environment Variables**: Never commit `.env.local` to version control

## 💡 Recommendations

### For Development:
1. **Local PostgreSQL** - Full control, no internet dependency
2. **Neon Free Tier** - Serverless, easy setup, great for testing

### For Production:
1. **Neon** - Serverless, auto-scaling, great performance
2. **Supabase** - Full-stack features, real-time capabilities
3. **AWS RDS** - Enterprise-grade, highly reliable

### For Learning:
1. **Docker** - Consistent environment, easy cleanup
2. **Neon Free Tier** - Production-like environment, no setup

## 📚 Next Steps

After setting up the database:

1. ✅ **Test the Demo**: Visit http://localhost:3000/demo.html
2. 🔄 **Setup Redis**: For caching (optional for demo)
3. 🤖 **Setup Ollama**: For AI responses (optional for demo)
4. 🚀 **Deploy**: Follow deployment guide for production

## 🆘 Need Help?

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Prisma Documentation**: https://www.prisma.io/docs/
- **Neon Documentation**: https://neon.tech/docs
- **Supabase Documentation**: https://supabase.com/docs
- **Project Issues**: https://github.com/prabi82/airport-chatbot/issues

---

**Happy Coding! 🚀** 